/*
  navegador.mjs — faz no Chrome, sem abrir janela, as etapas de uma obra nova que precisam de navegador.

  Uso (na raiz do repositório):
    node ferramentas/navegador.mjs vistas   cal-0000   imagem com 8 ângulos, para escolher a "frente"
    node ferramentas/navegador.mjs poster   cal-0000   gera models/cal-0000/poster.webp
    node ferramentas/navegador.mjs conferir cal-0000   abre a página da obra e o museu, mede e fotografa

  Liga o próprio servidor (ferramentas/servidor.mjs) numa porta separada e desliga no fim.
  As imagens de conferência vão para uma pasta temporária (o caminho aparece no fim); nada disso
  entra no repositório. Usa o Chrome instalado no computador (ou o caminho em CHROME=...).
  Não edita data/obras.json nem os modelos: só lê e fotografa (exceto o poster).
*/

import puppeteer from "puppeteer-core";
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const RAIZ = resolve(import.meta.dirname, "..");
const PORTA = 3101;
const SITE = `http://localhost:${PORTA}`;
const SAIDA = join(tmpdir(), "acervo-cal");

const [modo, id] = process.argv.slice(2);
if (!["vistas", "poster", "conferir"].includes(modo) || !/^[a-z]+-\d{4}$/.test(id || "")) {
  console.error("Uso: node ferramentas/navegador.mjs vistas|poster|conferir cal-0000");
  process.exit(1);
}
const obras = JSON.parse(readFileSync(join(RAIZ, "data/obras.json"), "utf8"));
if (!obras.some((obra) => obra.id === id)) {
  console.error(`${id} não está em data/obras.json.`);
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

function ligarServidor() {
  return new Promise((ok, falha) => {
    const servidor = spawn(process.execPath, [join(RAIZ, "ferramentas/servidor.mjs")], {
      env: { ...process.env, PORTA: String(PORTA) },
    });
    servidor.stdout.on("data", (d) => String(d).includes("Site em") && ok(servidor));
    servidor.stderr.on("data", (d) => falha(new Error(String(d))));
  });
}

const espera = (ms) => new Promise((ok) => setTimeout(ok, ms));
mkdirSync(SAIDA, { recursive: true });
const servidor = await ligarServidor();
// SwiftShader: WebGL por software, funciona mesmo sem placa de vídeo ou com a tela bloqueada.
const navegador = await puppeteer.launch({
  executablePath: acharChrome(),
  headless: true,
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});

async function abrir(caminho, largura, altura) {
  const pagina = await navegador.newPage();
  const erros = [];
  pagina.on("console", (m) => m.type() === "error" && erros.push(m.text()));
  pagina.on("pageerror", (e) => erros.push(String(e)));
  await pagina.setViewport({ width: largura, height: altura, isMobile: largura < 600, hasTouch: largura < 600 });
  await pagina.goto(SITE + caminho, { waitUntil: "networkidle0", timeout: 180000 });
  return { pagina, erros };
}

async function esperarPronto(pagina) {
  await pagina.waitForFunction(() => document.getElementById("registro").textContent.includes("Pronto."), { timeout: 300000 });
  return pagina.$eval("#registro", (el) => el.textContent.trim());
}

try {
  if (modo === "vistas") {
    const { pagina, erros } = await abrir(`/ferramentas/posters.html?id=${id}&vistas`, 1100, 800);
    await esperarPronto(pagina);
    const arquivo = join(SAIDA, `vistas-${id}.png`);
    await (await pagina.$(".vistas")).screenshot({ path: arquivo });
    console.log(`Vistas: ${arquivo}`);
    if (erros.length) console.log("Erros:", erros);
  }

  if (modo === "poster") {
    const { pagina, erros } = await abrir(`/ferramentas/posters.html?id=${id}`, 800, 800);
    console.log(await esperarPronto(pagina));
    if (erros.length) console.log("Erros:", erros);
  }

  if (modo === "conferir") {
    const resultado = { obra: {}, celular: {}, museu: {} };

    // Página da obra no computador: carrega, mede e fotografa.
    let { pagina, erros } = await abrir(`/obra.html?id=${id}`, 1366, 820);
    await pagina.waitForFunction(() => document.getElementById("viewer")?.loaded, { timeout: 180000 });
    await espera(1500);
    resultado.obra = await pagina.evaluate(() => {
      const d = document.getElementById("viewer").getDimensions();
      const cm = (v) => Math.round(v * 1000) / 10;
      return { titulo: document.title, medidasCm: `${cm(d.x)} × ${cm(d.y)} × ${cm(d.z)} (L × A × P)` };
    });
    resultado.obra.imagem = join(SAIDA, `conferir-${id}-computador.png`);
    await pagina.screenshot({ path: resultado.obra.imagem });
    resultado.obra.erros = erros;
    await pagina.close();

    // Página da obra no celular (390 px).
    ({ pagina, erros } = await abrir(`/obra.html?id=${id}`, 390, 844));
    await pagina.waitForFunction(() => document.getElementById("viewer")?.loaded, { timeout: 180000 });
    await espera(1500);
    resultado.celular.larguraDaPagina = await pagina.evaluate(() => document.documentElement.scrollWidth);
    resultado.celular.imagem = join(SAIDA, `conferir-${id}-celular.png`);
    await pagina.screenshot({ path: resultado.celular.imagem });
    resultado.celular.erros = erros;
    await pagina.close();

    // Museu: as salas crescem com cada obra; confere que tudo carrega, entra e fotografa a vista da
    // entrada e a obra nova na sala dela (examina e volta: o visitante fica de frente para a obra).
    ({ pagina, erros } = await abrir("/museu.html", 1366, 820));
    await pagina.waitForFunction(() => !document.getElementById("botao-entrar")?.disabled, { timeout: 300000 });
    await espera(1500); // a tela de entrada troca o carregamento pelo convite
    await pagina.click("#botao-entrar");
    const parado = () => pagina.waitForFunction(() => !window.museu.navegacao.emTransicao, { timeout: 120000, polling: 200 });
    await parado(); // a câmera avança da porta para dentro da sala
    await espera(1500);
    resultado.museu.imagem = join(SAIDA, `conferir-museu.png`);
    await pagina.screenshot({ path: resultado.museu.imagem });
    resultado.museu.sala = await pagina.evaluate((id) => {
      const indice = window.museu.percurso.findIndex((peca) => peca.obra.id === id);
      window.museu.examinar(indice);
      return window.museu.percurso[indice].sala?.nome;
    }, id);
    await parado();
    await pagina.evaluate(() => window.museu.voltarAoMuseu());
    await parado();
    await espera(1500);
    resultado.museu.imagemDaObra = join(SAIDA, `conferir-museu-obra.png`);
    await pagina.screenshot({ path: resultado.museu.imagemDaObra });
    resultado.museu.erros = erros;

    console.log(JSON.stringify(resultado, null, 2));
  }
} finally {
  await navegador.close();
  servidor.kill();
}
