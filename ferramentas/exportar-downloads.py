"""
exportar-downloads.py — roda dentro do Blender, chamado por ferramentas/downloads.mjs (não rode à mão).
Abre o .blend de uma obra e gera os arquivos de download em duas qualidades:
  - alta: a malha como está no .blend (todo o detalhe);
  - leve: a mesma malha simplificada para N faces (modificador Decimate), com a textura limitada a M px.
Cada qualidade sai em GLB (metros, com textura), OBJ (milímetros, com .mtl e textura) e STL (milímetros,
sem cor), cada formato num .zip com um LEIA-ME.txt (licença e como citar). A peça sai na posição do
.blend (a mesma do site), apoiada no chão e centrada. No fim grava manifesto.json com faces e tamanhos.

Não salva o .blend (tudo o que muda fica só na memória) e não mexe em material nem na textura da
versão alta. A textura só é reduzida na versão leve, quando passa do limite.

Uso (feito pelo downloads.mjs):
  blender -b --factory-startup obra.blend --python-exit-code 1 --python exportar-downloads.py -- <pasta> <dados.json>
"""

import json
import os
import shutil
import sys
import zipfile

import bpy
import numpy as np
from mathutils import Matrix

LIMITE_GITHUB = 2 * 1024**3  # cada arquivo de um release do GitHub precisa ter menos de 2 GiB
NOMES = {"alta": "Alta resolução", "leve": "Leve"}


def avisar(texto):
    print(f"[downloads] {texto}", flush=True)


def triangulos(malhas):
    total = 0
    for o in malhas:
        o.data.calc_loop_triangles()
        total += len(o.data.loop_triangles)
    return total


def caixa(malhas):
    """Menor e maior ponto de todas as malhas (coordenadas do mundo, depois de aplicar as transformações)."""
    pontos = []
    for o in malhas:
        co = np.empty(len(o.data.vertices) * 3, dtype=np.float32)
        o.data.vertices.foreach_get("co", co)
        pontos.append(co.reshape(-1, 3))
    todos = np.concatenate(pontos)
    return todos.min(axis=0), todos.max(axis=0)


def selecionar(malhas):
    for o in bpy.context.view_layer.objects:
        o.select_set(False)
    for o in malhas:
        o.select_set(True)
    bpy.context.view_layer.objects.active = malhas[0]


def imagens_usadas(malhas):
    vistas = {}
    for o in malhas:
        for slot in o.material_slots:
            mat = slot.material
            if not (mat and mat.use_nodes):
                continue
            for no in mat.node_tree.nodes:
                if no.bl_idname == "ShaderNodeTexImage" and no.image:
                    vistas[no.image.name] = no.image
    return list(vistas.values())


def preparar_imagens(malhas, pasta):
    """Garante que cada textura exista como arquivo (o OBJ copia o arquivo, não a imagem da memória)."""
    for img in imagens_usadas(malhas):
        caminho = bpy.path.abspath(img.filepath) if img.filepath else ""
        if img.packed_file or not os.path.isfile(caminho):
            nome = bpy.path.clean_name(img.name) + (".jpg" if img.file_format == "JPEG" else ".png")
            img.filepath_raw = os.path.join(pasta, nome)
            img.save()
            avisar(f"textura {img.name} salva fora do .blend para exportar")


def limitar_texturas(malhas, maximo, pasta):
    for img in imagens_usadas(malhas):
        w, h = img.size
        if max(w, h) <= maximo:
            continue
        fator = maximo / max(w, h)
        img.scale(max(1, round(w * fator)), max(1, round(h * fator)))
        extensao = ".jpg" if img.file_format == "JPEG" else ".png"
        img.filepath_raw = os.path.join(pasta, os.path.splitext(bpy.path.basename(img.filepath))[0] + "-leve" + extensao)
        img.save()
        avisar(f"textura {img.name}: {w}×{h} → {img.size[0]}×{img.size[1]} px (versão leve)")


def tamanho_da_textura(malhas):
    tamanhos = [list(img.size) for img in imagens_usadas(malhas)]
    return max(tamanhos, key=lambda s: s[0] * s[1]) if tamanhos else None


def leia_me(dados, nivel, formato, faces, dimensoes):
    unidade = "metros" if formato == "glb" else "milímetros"
    eixo = "Z" if formato == "stl" else "Y"
    cor = "sem cor (só a forma)" if formato == "stl" else "com a textura (cor) do escaneamento"
    linhas = [
        f"{dados['titulo']} ({dados['registro']})",
        "Casa da Cultura da América Latina (CAL) – Universidade de Brasília",
        "Modelo 3D do projeto de extensão Gêmeos Digitais CAL",
        "",
        f"Qualidade: {NOMES[nivel]} – {faces:,} faces".replace(",", "."),
        f"Formato: {formato.upper()}, {cor}",
        f"Unidade: {unidade}. Medidas da peça (L × A × P): {dimensoes}.",
        f"A peça está na mesma posição do site, apoiada no chão e centrada (eixo {eixo} para cima).",
        "",
        "Licença: Creative Commons Atribuição-NãoComercial 4.0 Internacional (CC BY-NC 4.0)",
        "https://creativecommons.org/licenses/by-nc/4.0/deed.pt-br",
        "Você pode copiar, estudar, imprimir e adaptar este modelo, desde que cite a fonte",
        "e não o use para fins comerciais.",
        "",
        "Como citar:",
        dados["citacao"],
        "",
        f"Página da obra: {dados['site']}",
        "",
    ]
    return "\r\n".join(linhas)


def compactar(destino, pasta, leia):
    with zipfile.ZipFile(destino, "w", zipfile.ZIP_DEFLATED, compresslevel=6) as zf:
        for nome in sorted(os.listdir(pasta)):
            zf.write(os.path.join(pasta, nome), nome)
        zf.writestr("LEIA-ME.txt", leia.encode("utf-8"))
    return os.path.getsize(destino)


def exportar(nivel, malhas, dados, saida, dimensoes):
    faces = triangulos(malhas)
    resultado = {"faces": faces, "textura": tamanho_da_textura(malhas)}
    base = f"{dados['id']}-{nivel}"
    for formato in ("glb", "obj", "stl"):
        temporaria = os.path.join(saida, f"tmp-{nivel}-{formato}")
        shutil.rmtree(temporaria, ignore_errors=True)
        os.makedirs(temporaria)
        arquivo = os.path.join(temporaria, f"{base}.{formato}")
        selecionar(malhas)
        if formato == "glb":
            bpy.ops.export_scene.gltf(
                filepath=arquivo, export_format="GLB", use_selection=True, export_apply=True, export_yup=True,
                export_draco_mesh_compression_enable=False, export_image_format="AUTO",
                export_cameras=False, export_lights=False, export_animations=False,
            )
        elif formato == "obj":
            bpy.ops.wm.obj_export(
                filepath=arquivo, export_selected_objects=True, global_scale=1000.0,
                forward_axis="NEGATIVE_Z", up_axis="Y", export_uv=True, export_normals=True,
                export_materials=True, path_mode="COPY", apply_modifiers=True,
            )
        else:
            bpy.ops.wm.stl_export(
                filepath=arquivo, export_selected_objects=True, global_scale=1000.0,
                forward_axis="Y", up_axis="Z", ascii_format=False, apply_modifiers=True,
            )
        zip_destino = os.path.join(saida, f"{base}-{formato}.zip")
        bytes_zip = compactar(zip_destino, temporaria, leia_me(dados, nivel, formato, faces, dimensoes))
        shutil.rmtree(temporaria, ignore_errors=True)
        if bytes_zip >= LIMITE_GITHUB:
            raise SystemExit(f"{os.path.basename(zip_destino)} tem {bytes_zip / 1024**3:.2f} GiB: passa do limite de 2 GiB do GitHub. Simplifique a malha.")
        resultado[formato] = bytes_zip
        avisar(f"{os.path.basename(zip_destino)}: {bytes_zip / 1024**2:.1f} MB")
    return resultado


def principal():
    saida, arquivo_dados = sys.argv[sys.argv.index("--") + 1:]
    with open(arquivo_dados, encoding="utf-8") as f:
        dados = json.load(f)

    if bpy.context.object and bpy.context.object.mode != "OBJECT":
        bpy.ops.object.mode_set(mode="OBJECT")
    malhas = [o for o in bpy.context.scene.objects if o.type == "MESH" and o.visible_get() and not o.hide_render]
    if not malhas:
        raise SystemExit("Nenhuma malha visível no .blend.")
    avisar(f"malhas: {', '.join(o.name for o in malhas)}")

    # Aplica modificadores e transformações (só na memória) para medir e exportar a forma final.
    selecionar(malhas)
    bpy.ops.object.make_single_user(object=True, obdata=True)
    for o in malhas:
        bpy.context.view_layer.objects.active = o
        for mod in list(o.modifiers):
            bpy.ops.object.modifier_apply(modifier=mod.name)
    selecionar(malhas)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

    # O scanner exporta em milímetros; o .blend fica nessa escala (centenas de unidades).
    minimo, maximo = caixa(malhas)
    em_mm = float((maximo - minimo).max()) > 10
    metros = 0.001 if em_mm else 1.0
    centro = (minimo + maximo) / 2
    ajuste = Matrix.Scale(metros, 4) @ Matrix.Translation((-centro[0], -centro[1], -minimo[2]))
    for o in malhas:
        o.data.transform(ajuste)
        o.data.update()
    minimo, maximo = caixa(malhas)
    l, p, a = ((maximo - minimo) * 100).round(1)
    dimensoes = f"{l:.1f} × {a:.1f} × {p:.1f} cm".replace(".", ",")
    avisar(f"escala do .blend: {'milímetros' if em_mm else 'metros'}; medidas {dimensoes}")

    pasta_texturas = os.path.join(saida, "tmp-texturas")
    os.makedirs(pasta_texturas, exist_ok=True)
    preparar_imagens(malhas, pasta_texturas)

    manifesto = {"id": dados["id"], "dimensoes": dimensoes}
    manifesto["alta"] = exportar("alta", malhas, dados, saida, dimensoes)

    alvo = int(dados["facesLeve"])
    total = manifesto["alta"]["faces"]
    if alvo < total:
        avisar(f"simplificando {total:,} → {alvo:,} faces…".replace(",", "."))
        for o in malhas:
            bpy.context.view_layer.objects.active = o
            mod = o.modifiers.new("Simplificar", "DECIMATE")
            mod.decimate_type = "COLLAPSE"
            mod.ratio = alvo / total
            mod.use_collapse_triangulate = True
            bpy.ops.object.modifier_apply(modifier=mod.name)
    else:
        avisar(f"a malha já tem {total:,} faces ou menos: a versão leve fica igual à alta".replace(",", "."))
    limitar_texturas(malhas, int(dados["texturaLeve"]), pasta_texturas)
    manifesto["leve"] = exportar("leve", malhas, dados, saida, dimensoes)

    shutil.rmtree(pasta_texturas, ignore_errors=True)
    with open(os.path.join(saida, "manifesto.json"), "w", encoding="utf-8") as f:
        json.dump(manifesto, f, ensure_ascii=False, indent=2)
    avisar("pronto")


principal()
