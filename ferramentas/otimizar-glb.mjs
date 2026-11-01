/*
  otimizar-glb.mjs — prepara o .glb exportado do Blender para o site.

  Uso (na raiz do repositório):
    node ferramentas/otimizar-glb.mjs <entrada.glb> [saida.glb] [ajuste de cor]
  Sem [saida.glb], substitui o próprio arquivo de entrada.

  Ajuste de cor (opcional, comparando com uma foto da obra):
    --brilho 0.7       multiplica o brilho (1 = sem mudança)
    --saturacao 1.35   multiplica a saturação (1 = sem mudança)
    --matiz 5          gira a matiz em graus (positivo puxa o rosa para o laranja)

  O que faz:
    1. Escala: se a peça medir mais de 10 m, entende que veio em milímetros
       (padrão do scanner) e converte para metros.
    2. Material: tira a transparência (transmission) e o "metálico" que o
       importador de .obj do Blender liga por engano.
    3. Cor: se pedido, ajusta a textura. Os valores ficam gravados no próprio
       .glb, e o script recusa aplicar uma segunda vez (os ajustes somariam).
    4. Malha: une vértices repetidos (weld) e comprime com Draco.
  Não mexe na orientação da peça.
*/

import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { dedup, draco, getBounds, prune, weld } from "@gltf-transform/functions";
import draco3d from "draco3dgltf";
import sharp from "sharp";
import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";

const { values: opcoes, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    brilho: { type: "string" },
    saturacao: { type: "string" },
    matiz: { type: "string" },
  },
});
const [entrada, saida = entrada] = positionals;
if (!entrada) {
  console.error("Uso: node ferramentas/otimizar-glb.mjs <entrada.glb> [saida.glb] [--brilho 0.7 --saturacao 1.35 --matiz 5]");
  process.exit(1);
}

const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({
    "draco3d.decoder": await draco3d.createDecoderModule(),
    "draco3d.encoder": await draco3d.createEncoderModule(),
  });

const mb = (bytes) => (bytes / 1e6).toFixed(1) + " MB";
const tamanhoAntes = readFileSync(entrada).byteLength;
const doc = await io.read(entrada);
const root = doc.getRoot();
const cena = root.getDefaultScene() || root.listScenes()[0];

// 1. Escala (mm → m)
const medida = (b) => b.max.map((v, i) => v - b.min[i]);
const maior = Math.max(...medida(getBounds(cena)));
if (maior > 10) {
  for (const no of cena.listChildren()) {
    no.setTranslation(no.getTranslation().map((v) => v * 0.001));
    no.setScale(no.getScale().map((v) => v * 0.001));
  }
  console.log(`Escala: peça media ${maior.toFixed(0)} "m"; convertida de mm para m.`);
}

// 2. Material: obra escaneada é opaca e não é metal.
for (const nome of ["KHR_materials_transmission", "KHR_materials_ior", "KHR_materials_specular"]) {
  root.listExtensionsUsed().find((ext) => ext.extensionName === nome)?.dispose();
}
for (const material of root.listMaterials()) {
  material.setMetallicFactor(0);
}

// 3. Cor da textura
const ajuste = {
  brilho: Number(opcoes.brilho ?? 1),
  saturacao: Number(opcoes.saturacao ?? 1),
  matiz: Number(opcoes.matiz ?? 0),
};
const pediuAjuste = ajuste.brilho !== 1 || ajuste.saturacao !== 1 || ajuste.matiz !== 0;
const extras = root.getAsset().extras ?? {};
if (pediuAjuste) {
  if (extras.ajusteCor) {
    console.error(
      "Este arquivo já teve a cor ajustada:", JSON.stringify(extras.ajusteCor),
      "\nPara refazer, parta do arquivo original (reexporte do Blender ou recupere com git)."
    );
    process.exit(1);
  }
  for (const textura of root.listTextures()) {
    const imagem = await sharp(textura.getImage())
      .modulate({ brightness: ajuste.brilho, saturation: ajuste.saturacao, hue: ajuste.matiz })
      .jpeg({ quality: 90 })
      .toBuffer();
    textura.setImage(imagem).setMimeType("image/jpeg");
  }
  root.getAsset().extras = { ...extras, ajusteCor: ajuste };
  console.log("Cor ajustada:", JSON.stringify(ajuste));
}

// 4. Malha
await doc.transform(weld(), dedup(), prune(), draco({ method: "edgebreaker" }));

await io.write(saida, doc);

const [x, y, z] = medida(getBounds(cena)).map((v) => (v * 100).toFixed(1));
const tamanhoDepois = readFileSync(saida).byteLength;
console.log(`${saida}: ${mb(tamanhoAntes)} → ${mb(tamanhoDepois)} | ${x} × ${y} × ${z} cm (L × A × P)`);
