/*
  versao-museu.mjs — gera a versão leve de uma obra para o museu virtual (models/<id>/museu.glb).

  Uso (na raiz do repositório):
    node ferramentas/versao-museu.mjs cal-0000
    node ferramentas/versao-museu.mjs todas

  Andando pelo museu, cada obra é a versão leve; ao examinar, o museu troca pela completa
  (modelo.glb). Com todas as obras completas na cena, a memória de vídeo passaria de 800 MB com
  20 obras, quase tudo das texturas (as de 4096 px ocupam ~95 MB cada).
  A versão leve tem até FACES faces (a simplificação não passa das emendas da textura: nas obras
  do ExScan e da fotogrametria, com muitas ilhas pequenas, a malha quase não diminui) e textura de
  até LADO px, em JPEG. Comparada no museu a 1,5 m, a diferença média ficou abaixo de 1 em 255
  (aprovada pelo Lucas em 16/11/2026).

  A textura é reduzida no Chrome sem janela (o sharp não funciona nesta máquina). Grava o campo
  "museu" em data/obras.json. Não mexe no modelo.glb, no material nem nas cores.
*/

import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { draco, prune, simplify, weld } from "@gltf-transform/functions";
import draco3d from "draco3dgltf";
import { MeshoptSimplifier } from "meshoptimizer";
import puppeteer from "puppeteer-core";
import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const FACES = 50000;
const LADO = 1024; // px
const QUALIDADE = 0.85; // JPEG

const RAIZ = resolve(import.meta.dirname, "..");
const ARQUIVO_OBRAS = join(RAIZ, "data/obras.json");

const pedido = process.argv[2];
const obras = JSON.parse(readFileSync(ARQUIVO_OBRAS, "utf8"));
const escolhidas = pedido === "todas" ? obras : obras.filter((obra) => obra.id === pedido);
if (!pedido || escolhidas.length === 0) {
  console.error("Uso: node ferramentas/versao-museu.mjs cal-0000|todas (a obra precisa estar em data/obras.json)");
  process.exit(1);
}

function acharChrome() {
  const candidatos = [
    process.env.CHROME,
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
    `${process.env.LOCALAPPDATA}/Google/Chrome/Application/chrome.exe`,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/usr/bin/google-chrome",
  ];
  const chrome = candidatos.find((c) => c && existsSync(c));
  if (!chrome) throw new Error("Chrome não encontrado. Indique o caminho com CHROME=...");
  return chrome;
}

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  "draco3d.decoder": await draco3d.createDecoderModule(),
  "draco3d.encoder": await draco3d.createEncoderModule(),
});
await MeshoptSimplifier.ready;

const navegador = await puppeteer.launch({ executablePath: acharChrome(), headless: true });
const pagina = await navegador.newPage();

/** Reduz a imagem para no máximo LADO px no lado maior (no Chrome) e devolve JPEG ou PNG. */
async function reduzir(imagem, tipo, comTransparencia) {
  const base64 = await pagina.evaluate(
    async (dados, tipo, lado, saida, qualidade) => {
      const blob = await (await fetch(`data:${tipo};base64,${dados}`)).blob();
      const bitmap = await createImageBitmap(blob, { colorSpaceConversion: "none", premultiplyAlpha: "none" });
      const escala = Math.min(1, lado / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(bitmap.width * escala);
      canvas.height = Math.round(bitmap.height * escala);
      const ctx = canvas.getContext("2d");
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      return [canvas.toDataURL(saida, qualidade).split(",")[1], canvas.width, canvas.height];
    },
    Buffer.from(imagem).toString("base64"),
    tipo,
    LADO,
    comTransparencia ? "image/png" : "image/jpeg",
    QUALIDADE
  );
  return base64;
}

const faces = (doc) =>
  doc
    .getRoot()
    .listMeshes()
    .flatMap((malha) => malha.listPrimitives())
    .reduce((soma, p) => soma + (p.getIndices()?.getCount() ?? p.getAttribute("POSITION").getCount()) / 3, 0);
const mb = (bytes) => (bytes / 1e6).toFixed(2) + " MB";

try {
  for (const obra of escolhidas) {
    const entrada = join(RAIZ, obra.modelo);
    const saida = join(RAIZ, "models", obra.id, "museu.glb");
    const doc = await io.read(entrada);
    const antes = faces(doc);

    await doc.transform(
      weld(),
      simplify({ simplifier: MeshoptSimplifier, ratio: Math.min(1, FACES / antes), error: 0.01 }),
      prune()
    );

    // Textura com transparência continua PNG; as outras viram JPEG.
    const transparente = doc.getRoot().listMaterials().some((m) => m.getAlphaMode() !== "OPAQUE");
    const texturas = [];
    for (const textura of doc.getRoot().listTextures()) {
      const [dados, largura, altura] = await reduzir(textura.getImage(), textura.getMimeType(), transparente);
      const antesTex = textura.getSize()?.join(" × ");
      textura.setImage(new Uint8Array(Buffer.from(dados, "base64"))).setMimeType(transparente ? "image/png" : "image/jpeg");
      if (textura.getURI()) textura.setURI(textura.getURI().replace(/\.\w+$/, transparente ? ".png" : ".jpg"));
      texturas.push(`${antesTex} → ${largura} × ${altura}`);
    }

    await doc.transform(draco({ method: "edgebreaker" }));
    await io.write(saida, doc);
    console.log(
      `${obra.id}: ${antes} → ${faces(doc)} faces; textura ${texturas.join(", ")}; ` +
        `${mb(statSync(entrada).size)} → ${mb(statSync(saida).size)}`
    );

    // Campo "museu" logo depois de "modelo", no mesmo arquivo que a sincronização mantém.
    const atual = JSON.parse(readFileSync(ARQUIVO_OBRAS, "utf8"));
    const novas = atual.map((item) => {
      if (item.id !== obra.id) return item;
      const { museu, ...resto } = item;
      return Object.fromEntries(
        Object.entries(resto).flatMap(([k, v]) => (k === "modelo" ? [[k, v], ["museu", `models/${obra.id}/museu.glb`]] : [[k, v]]))
      );
    });
    writeFileSync(ARQUIVO_OBRAS, JSON.stringify(novas, null, 2) + "\n");
  }
} finally {
  await navegador.close();
}
