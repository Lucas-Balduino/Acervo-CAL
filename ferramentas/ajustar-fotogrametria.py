"""
ajustar-fotogrametria.py — prepara no Blender um modelo de fotogrametria (KIRI Engine) para o site.

Uso (Blender sem janela; o .blend de origem não é alterado):
  blender -b <obra>.blend --python ferramentas/ajustar-fotogrametria.py -- <pasta_saida> <altura_cm>
          [--objeto 3DModel] [--matiz 220] [--fundo] [--alvo 80]

O que faz, nesta ordem:
  1. Aplica a rotação feita à mão, põe a peça no centro e apoiada no chão, e dá a altura real
     (a fotogrametria não sabe o tamanho da peça; usar a medida da planilha ou medida na CAL).
  2. Fecha os furinhos da malha (até 16 lados). Cada furo recebe a cor de um ponto vizinho.
  3. Reduz para 200 mil faces, como as outras obras.
  4. Clareia o lado que ficou na sombra nas fotos. Mede, numa cor que cobre a peça toda
     (--matiz: tom em graus, ex. 220 = azul, 25 = terracota; sem ele, a peça inteira), quanto o
     brilho e a cor mudam conforme o lado para onde a superfície aponta, e compensa até o nível
     do lado bem iluminado (--alvo: percentil, 80 por padrão; 60 = mais suave).
  5. --fundo: troca a base (faces viradas para baixo) pela cor da parte de baixo da peça, para
     tirar a mesa que aparece na textura.
  Salva <pasta_saida>/modelo.glb (para ferramentas/otimizar-glb.mjs), <obra>-ajustado.blend
  (com a textura dentro) e a textura nova em JPEG.

Não faz: não corrige detalhe que faltou nas fotos (lado borrado continua borrado), não mexe no
material e não escolhe a frente da peça (isso é a `frente` do obras.json).
"""

import argparse, colorsys, math, os, sys

import bmesh, bpy, mathutils
import numpy as np

FACES = 200_000

p = argparse.ArgumentParser()
p.add_argument("saida"); p.add_argument("altura_cm", type=float)
p.add_argument("--objeto", default="3DModel"); p.add_argument("--matiz", type=float)
p.add_argument("--fundo", action="store_true"); p.add_argument("--alvo", type=float, default=80)
args = p.parse_args(sys.argv[sys.argv.index("--") + 1:])
os.makedirs(args.saida, exist_ok=True)
nome = os.path.splitext(os.path.basename(bpy.data.filepath))[0]

# --- 1. Só a peça, com a rotação aplicada, no centro, apoiada no chão e na altura real ---
o = bpy.data.objects[args.objeto]
for x in list(bpy.data.objects):
    if x is not o: bpy.data.objects.remove(x)
if bpy.context.object and bpy.context.object.mode != "OBJECT": bpy.ops.object.mode_set(mode="OBJECT")
o.hide_viewport = o.hide_render = False; o.hide_set(False)
for c in bpy.data.collections: c.hide_viewport = False
bpy.context.view_layer.objects.active = o; o.select_set(True)
o.modifiers.clear(); o.data.transform(o.matrix_world); o.matrix_world = mathutils.Matrix.Identity(4)
m = o.data
co = np.empty(len(m.vertices) * 3, np.float32); m.vertices.foreach_get("co", co); co = co.reshape(-1, 3)
mn, mx = co.min(0), co.max(0)
co = (co - [(mn[0] + mx[0]) / 2, (mn[1] + mx[1]) / 2, mn[2]]) * (args.altura_cm / 100 / (mx[2] - mn[2]))
m.vertices.foreach_set("co", co.ravel()); m.update()
print("Medidas (cm):", " × ".join(f"{v * 100:.1f}" for v in co.max(0) - co.min(0)), "(L × P × A)")

# --- 2. Furinhos: um ponto de UV só por furo (vértice de borda pode estar em duas ilhas da textura,
#        e um triângulo entre ilhas atravessaria a textura inteira) ---
bm = bmesh.new(); bm.from_mesh(m); uv = bm.loops.layers.uv.active
novas = set(bmesh.ops.holes_fill(bm, edges=[e for e in bm.edges if e.is_boundary], sides=16)["faces"])
for f in novas:
    ponto = next((l2[uv].uv.copy() for l in f.loops for l2 in l.vert.link_loops if l2.face not in novas), None)
    if ponto is not None:
        for l in f.loops: l[uv].uv = ponto
bmesh.ops.triangulate(bm, faces=list(novas)); bm.to_mesh(m); bm.free()
print("Furos fechados:", len(novas))

# --- 3. Faces ---
if len(m.polygons) > FACES:
    dec = o.modifiers.new("reduzir", "DECIMATE"); dec.ratio = FACES / len(m.polygons)
    bpy.ops.object.modifier_apply(modifier="reduzir")
print("Faces:", len(o.data.polygons))

# --- 4. Lado na sombra ---
no_img = next(n for n in o.active_material.node_tree.nodes if n.bl_idname == "ShaderNodeTexImage")
img = no_img.image; W = img.size[0]
cena = bpy.context.scene; cena.render.engine = "CYCLES"; cena.cycles.samples = 1; cena.cycles.device = "CPU"

# Direção da superfície em cada texel, na resolução da textura (as ilhas do KIRI são pequenas demais
# para calcular em resolução menor: o ajuste vazaria de uma ilha para a vizinha).
alvo = bpy.data.images.new("normais", W, W, float_buffer=True, alpha=True)
alvo.colorspace_settings.name = "Non-Color"; alvo.generated_color = (0, 0, 0, 0)
nos = o.active_material.node_tree.nodes; no_bake = nos.new("ShaderNodeTexImage"); no_bake.image = alvo; nos.active = no_bake
cena.render.bake.margin = 6; cena.render.bake.margin_type = "EXTEND"
bpy.ops.object.bake(type="NORMAL", normal_space="OBJECT", margin=6)
buf = np.empty(W * W * 4, np.float32); alvo.pixels.foreach_get(buf)
nrm = buf.reshape(-1, 4)[:, :3] * 2 - 1; del buf
nos.remove(no_bake); bpy.data.images.remove(alvo)
valido = np.abs(np.linalg.norm(nrm, axis=1) - 1) < 0.15

px = np.empty(W * W * 4, np.float32); img.pixels.foreach_get(px); px = px.reshape(-1, 4)[:, :3]
lin = np.where(px <= 0.04045, px / 12.92, ((px + 0.055) / 1.055) ** 2.4).astype(np.float32); del px

base = valido.copy()
if args.matiz is not None:
    soma = lin.sum(1) + 1e-6; r, g, b = (lin / soma[:, None]).T
    # matiz pela cromaticidade (vale para texels escuros também, onde o HSV fica instável)
    ang = np.degrees(np.arctan2(math.sqrt(3) * (g - b), 2 * r - g - b)) % 360
    dif = np.abs((ang - args.matiz + 180) % 360 - 180)
    croma = np.hypot(math.sqrt(3) * (g - b), 2 * r - g - b)
    base &= (dif < 30) & (croma > 0.12)
print(f"Cor de referência: {base.sum() / valido.sum():.0%} da peça")

def harmonicos(n):
    x, y, z = n[:, 0], n[:, 1], n[:, 2]
    return np.stack([np.ones_like(x), x, y, z, x * y, y * z, x * z, x * x - y * y, 3 * z * z - 1], 1)

amostra = np.flatnonzero(base)
amostra = np.random.default_rng(1).choice(amostra, min(800_000, len(amostra)), replace=False)
X = harmonicos(nrm[amostra]); Y = np.log(lin[amostra] + 1e-3); usar = np.ones(len(X), bool)
for _ in range(5):  # ignora o que não é a cor de referência (pinturas, pontos brancos)
    coef = np.linalg.lstsq(X[usar], Y[usar], rcond=None)[0]
    r = (Y - X @ coef).mean(1); mad = np.median(np.abs(r[usar] - np.median(r[usar]))) * 1.4826
    usar = np.abs(r - np.median(r[usar])) < 2.5 * mad
f = X @ coef; L = f.mean(1); ref = f[L >= np.percentile(L, args.alvo)].mean(0); refL = ref.mean()

idx = np.flatnonzero(valido)
for k in range(0, len(idx), 2_000_000):
    q = idx[k:k + 2_000_000]; fv = harmonicos(nrm[q]) @ coef; Lv = fv.mean(1)
    luz = np.clip(np.exp(refL - Lv), 0.85, 8.0)[:, None]                            # brilho
    tom = np.clip(np.exp((ref - refL) - (fv - Lv[:, None])), 0.8, 1.25)             # cor da sombra
    v = lin[q] * luz * tom; lin[q] = v / np.maximum(1, v.max(1, keepdims=True))     # sem estourar o tom

# --- 5. Base ---
if args.fundo:
    nz = nrm[:, 2]; perto = base & (nz > -0.6) & (nz < -0.2)
    cor = np.median(lin[perto], 0); peso = (np.clip((-nz - 0.7) / 0.15, 0, 1) * valido)[:, None]
    lin = lin * (1 - peso) + cor * peso

srgb = np.where(lin <= 0.0031308, lin * 12.92, 1.055 * np.maximum(lin, 0) ** (1 / 2.4) - 0.055); del lin
nova = bpy.data.images.new(f"{nome}-textura", W, W); saida = np.ones((W * W, 4), np.float32); saida[:, :3] = srgb
nova.pixels.foreach_set(saida.ravel()); del saida, srgb
nova.filepath_raw = os.path.join(args.saida, f"{nome}-textura.jpg"); nova.file_format = "JPEG"
nova.save(filepath=nova.filepath_raw, quality=92); no_img.image = nova

bpy.ops.export_scene.gltf(filepath=os.path.join(args.saida, "modelo.glb"), export_format="GLB", use_selection=True)
nova.pack(); bpy.ops.wm.save_as_mainfile(filepath=os.path.join(args.saida, f"{nome}-ajustado.blend"), copy=True, compress=True)
print("Pronto:", args.saida)
