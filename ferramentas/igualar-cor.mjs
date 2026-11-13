/*
  igualar-cor.mjs — compara a cor do modelo do download com a do modelo do site e monta uma curva de
  cor (uma por canal) que leva uma à outra. Usado por downloads.mjs: a curva é aplicada na textura
  antes de exportar, para quem baixa ver a peça com a mesma cor do site.

  Por que precisa: nas obras do ExScan o site usa material metálico, que escurece e satura a cor; os
  downloads saem com material simples (o metálico some em OBJ e fica escuro em outros programas), então a
  cor é passada para a textura. Nas do Raptor, a textura da malha completa pode sair com outro tom.

  Como mede: renderiza os dois .glb com three.js (mesma luz, mesmos 6 ângulos, sem tone mapping) num
  Chrome sem janela e casa a distribuição de cores da peça, canal por canal (quantis). Não precisa que os
  pixels coincidam, então serve também quando a malha do download é outra (mais detalhada).
  Não grava nada e não mexe em arquivos: só devolve a curva e a diferença.
*/

import { createServer } from "node:http";
import { existsSync, readFileSync } from "node:fs";
import puppeteer from "puppeteer-core";

const TAMANHO = 384; // px de cada vista

const PAGINA = `<!DOCTYPE html><html><head><meta charset="utf-8">
<script type="importmap">{"imports":{"three":"https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js","three/addons/":"https://cdn.jsdelivr.net/npm/three@0.169.0/examples/jsm/"}}</script>
</head><body><script type="module">
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
const T = ${TAMANHO};
const renderer = new THREE.WebGLRenderer({ alpha: true, preserveDrawingBuffer: true });
renderer.setSize(T, T);
renderer.toneMapping = THREE.NoToneMapping;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.setClearColor(0x000000, 0);
const ambiente = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
const loader = new GLTFLoader();
const draco = new DRACOLoader();
draco.setDecoderPath("https://cdn.jsdelivr.net/npm/three@0.169.0/examples/jsm/libs/draco/gltf/");
loader.setDRACOLoader(draco);
window.vistas = async (url) => {
  const cena = new THREE.Scene();
  cena.environment = ambiente;
  const modelo = (await loader.loadAsync(url)).scene;
  cena.add(modelo);
  const caixa = new THREE.Box3().setFromObject(modelo, true);
  const centro = caixa.getCenter(new THREE.Vector3());
  const raio = caixa.getSize(new THREE.Vector3()).length() / 2;
  const camera = new THREE.PerspectiveCamera(30, 1, raio / 10, raio * 10);
  const gl = renderer.getContext();
  const saida = [];
  for (const [giro, altura] of [[0, 0.5], [90, 0.5], [180, 0.5], [270, 0.5], [45, 2], [225, 2]]) {
    const a = THREE.MathUtils.degToRad(giro);
    camera.position.set(centro.x + Math.sin(a) * raio * 3.6, centro.y + raio * altura, centro.z + Math.cos(a) * raio * 3.6);
    camera.lookAt(centro);
    renderer.render(cena, camera);
    const px = new Uint8Array(T * T * 4);
    gl.readPixels(0, 0, T, T, gl.RGBA, gl.UNSIGNED_BYTE, px);
    saida.push(Array.from(px));
  }
  return saida;
};
window.pronto = true;
</script></body></html>`;

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

/** Valores (0–255) de cada canal nos pixels de dentro da peça (longe da borda), ordenados. */
function coresDaPeca(vistas) {
  const T = TAMANHO;
  const canais = [[], [], []];
  const opaco = (img, x, y) => img[(y * T + x) * 4 + 3] === 255;
  for (const img of vistas) {
    for (let y = 2; y < T - 2; y++) {
      for (let x = 2; x < T - 2; x++) {
        if (!(opaco(img, x, y) && opaco(img, x - 2, y) && opaco(img, x + 2, y) && opaco(img, x, y - 2) && opaco(img, x, y + 2))) continue;
        const i = (y * T + x) * 4;
        for (let c = 0; c < 3; c++) canais[c].push(img[i + c]);
      }
    }
  }
  return canais.map((v) => Float64Array.from(v).sort());
}

const linear = (v) => {
  v /= 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};

/**
 * Curva de cada canal (256 valores de 0 a 1, em sRGB) que leva a cor do download à do site, e a diferença
 * média entre os dois (|log| da razão da luz, nos quantis de 5% a 95%; 0,05 ≈ 5% de diferença).
 */
function montarCurva(site, download) {
  const quantil = (v, q) => v[Math.min(v.length - 1, Math.floor(q * v.length))];
  const curva = [];
  const diferencas = [];
  for (let c = 0; c < 3; c++) {
    // Pares (download → site) de 0,5% em 0,5%, sem repetir x e sem descer (curva monótona).
    const pares = [];
    for (let q = 0.005; q < 0.9951; q += 0.005) {
      const x = quantil(download[c], q);
      const y = Math.max(quantil(site[c], q), pares.at(-1)?.[1] ?? 0);
      if (pares.length && x <= pares.at(-1)[0]) pares.at(-1)[1] = (pares.at(-1)[1] + y) / 2;
      else pares.push([x, y]);
    }
    const [x0, y0] = pares[0];
    const [x1, y1] = pares.at(-1);
    const tabela = [];
    for (let v = 0; v < 256; v++) {
      let saida;
      if (v <= x0) saida = x0 > 0 ? (v * y0) / x0 : y0; // da origem até o primeiro par
      else if (v >= x1) saida = y1 + ((v - x1) * (255 - y1)) / Math.max(1, 255 - x1); // do último par até o branco
      else {
        let k = 1;
        while (pares[k][0] < v) k++;
        const [xa, ya] = pares[k - 1];
        const [xb, yb] = pares[k];
        saida = ya + ((v - xa) * (yb - ya)) / (xb - xa);
      }
      tabela.push(Math.min(1, Math.max(0, saida / 255)));
    }
    curva.push(tabela.map((v) => +v.toFixed(5)));

    for (let q = 0.05; q < 0.951; q += 0.05) {
      const s = linear(quantil(site[c], q));
      const d = linear(quantil(download[c], q));
      if (s > 0.002 && d > 0.002) diferencas.push(Math.abs(Math.log(s / d)));
    }
  }
  const diferenca = diferencas.reduce((a, b) => a + b, 0) / Math.max(1, diferencas.length);
  return { curva, diferenca };
}

/**
 * Compara o .glb do site com o do download.
 * @returns {Promise<{curva: number[][], diferenca: number}>}
 */
export async function compararCor(glbSite, glbDownload) {
  const arquivos = { "/site.glb": glbSite, "/download.glb": glbDownload };
  const servidor = createServer((pedido, resposta) => {
    if (pedido.url === "/") {
      resposta.writeHead(200, { "content-type": "text/html" });
      return resposta.end(PAGINA);
    }
    const arquivo = arquivos[pedido.url];
    if (!arquivo) {
      resposta.writeHead(404);
      return resposta.end();
    }
    resposta.writeHead(200, { "content-type": "model/gltf-binary" });
    resposta.end(readFileSync(arquivo));
  });
  await new Promise((ok) => servidor.listen(0, ok));
  const porta = servidor.address().port;
  // SwiftShader: WebGL por software, funciona sem placa de vídeo.
  const navegador = await puppeteer.launch({
    executablePath: acharChrome(),
    headless: true,
    args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
  });
  try {
    const pagina = await navegador.newPage();
    await pagina.goto(`http://localhost:${porta}/`);
    await pagina.waitForFunction("window.pronto", { timeout: 120000 });
    const site = coresDaPeca(await pagina.evaluate(() => window.vistas("/site.glb")));
    const download = coresDaPeca(await pagina.evaluate(() => window.vistas("/download.glb")));
    return montarCurva(site, download);
  } finally {
    await navegador.close();
    servidor.close();
  }
}
