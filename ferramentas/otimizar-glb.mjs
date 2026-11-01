/*
  otimizar-glb.mjs — prepara o .glb exportado do Blender para o site.

  Uso (na raiz do repositório):
    node ferramentas/otimizar-glb.mjs <entrada.glb> [saida.glb]
  Sem [saida.glb], substitui o próprio arquivo de entrada.

  O que faz:
    1. Escala: se a peça medir mais de 10 m, entende que veio em milímetros
       (padrão do scanner) e converte para metros.
    2. Material: tira a transparência (transmission) e o "metálico" que o
       importador de .obj do Blender liga por engano.
    3. Malha: une vértices repetidos (weld) e comprime com Draco.
  Não mexe na textura nem na orientação da peça.
*/

import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { dedup, draco, getBounds, prune, weld } from "@gltf-transform/functions";
import draco3d from "draco3dgltf";
import { readFileSync } from "node:fs";

const [entrada, saida = entrada] = process.argv.slice(2);
if (!entrada) {
  console.error("Uso: node ferramentas/otimizar-glb.mjs <entrada.glb> [saida.glb]");
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

// 3. Malha
await doc.transform(weld(), dedup(), prune(), draco({ method: "edgebreaker" }));

await io.write(saida, doc);

const [x, y, z] = medida(getBounds(cena)).map((v) => (v * 100).toFixed(1));
const tamanhoDepois = readFileSync(saida).byteLength;
console.log(`${saida}: ${mb(tamanhoAntes)} → ${mb(tamanhoDepois)} | ${x} × ${y} × ${z} cm (L × A × P)`);
