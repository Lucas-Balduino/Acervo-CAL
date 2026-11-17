/*
  paginas-das-obras.mjs — gera uma página por obra (obra/cal-0000.html) a partir de obra.html.

  Uso (na raiz do repositório):
    node ferramentas/paginas-das-obras.mjs

  Roda sozinho no fim de sincronizar-acervo.mjs. Cada página é uma cópia de obra.html com o título,
  a descrição e as etiquetas de prévia (Open Graph) da obra. WhatsApp, redes sociais e buscadores
  não rodam JavaScript; sem isso, todo link de obra aparecia como "Obra · Gêmeos Digitais CAL", sem imagem.
  A página usa <base href="../">, então os caminhos relativos do site continuam valendo, e obra.js lê
  a obra de data-obra (obra.html?id= continua funcionando).

  A imagem de prévia é models/<id>/previa.jpg (node ferramentas/navegador.mjs previa <id>); sem ela,
  usa a miniatura. As etiquetas de prévia pedem endereço completo: ENDERECO_DO_SITE. Ao mudar o site
  de servidor, trocar a constante e rodar de novo.
  Não mexe em data/obras.json, nos modelos nem em obra.html. Apaga de obra/ as páginas de obras que
  saíram do catálogo.
*/

import { existsSync, mkdirSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

export const ENDERECO_DO_SITE = "https://lucas-balduino.github.io/Acervo-CAL/";
const RAIZ = resolve(import.meta.dirname, "..");
const PASTA = join(RAIZ, "obra");

const escapar = (texto) =>
  String(texto ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");

/** Troca um trecho que precisa existir uma única vez no modelo; avisa se obra.html mudou. */
function trocar(html, antes, depois) {
  if (html.split(antes).length !== 2) throw new Error(`obra.html mudou: não achei (uma vez) ${antes.slice(0, 60)}`);
  return html.replace(antes, () => depois);
}

function descricaoDe(obra) {
  const base = obra.resumo || [obra.registro, obra.procedencia].filter(Boolean).join(" · ");
  return `${base} Veja em 3D: gire, aproxime e baixe o modelo.`.trim();
}

function paginaDe(modelo, obra) {
  const endereco = `${ENDERECO_DO_SITE}obra/${obra.id}.html`;
  const previa = existsSync(join(RAIZ, "models", obra.id, "previa.jpg")) ? `models/${obra.id}/previa.jpg` : obra.poster;
  const titulo = `${obra.titulo} · Gêmeos Digitais CAL`;
  const descricao = descricaoDe(obra);
  const etiquetas = [
    `<link rel="canonical" href="${endereco}">`,
    `<meta property="og:type" content="website">`,
    `<meta property="og:site_name" content="Gêmeos Digitais CAL">`,
    `<meta property="og:locale" content="pt_BR">`,
    `<meta property="og:url" content="${endereco}">`,
    `<meta property="og:title" content="${escapar(obra.titulo)}">`,
    `<meta property="og:description" content="${escapar(descricao)}">`,
    `<meta property="og:image" content="${ENDERECO_DO_SITE}${previa}">`,
    ...(previa.endsWith(".jpg")
      ? [`<meta property="og:image:width" content="1200">`, `<meta property="og:image:height" content="630">`]
      : []),
    `<meta property="og:image:alt" content="${escapar(`${obra.titulo} (${obra.registro}), modelo 3D`)}">`,
    `<meta name="twitter:card" content="summary_large_image">`,
  ];

  let html = modelo;
  html = trocar(html, '<html lang="pt-BR">', `<html lang="pt-BR" data-obra="${obra.id}">`);
  html = trocar(
    html,
    '<meta charset="UTF-8">',
    '<meta charset="UTF-8">\n' +
      "  <!-- Gerado por ferramentas/paginas-das-obras.mjs a partir de obra.html: não editar à mão. -->\n" +
      '  <base href="../">'
  );
  html = trocar(html, "<title>Obra · Gêmeos Digitais CAL</title>", `<title>${escapar(titulo)}</title>`);
  html = trocar(
    html,
    '<meta name="description" content="Obra do acervo da CAL em 3D.">',
    `<meta name="description" content="${escapar(descricao)}">\n  ` + etiquetas.join("\n  ")
  );
  // Com <base>, "#ficha" apontaria para a página inicial.
  html = trocar(html, 'href="#ficha"', `href="obra/${obra.id}.html#ficha"`);
  html = trocar(html, '<h1 id="ficha-titulo">Carregando…</h1>', `<h1 id="ficha-titulo">${escapar(obra.titulo)}</h1>`);
  // Mesmo fim de linha de obra.html.
  return html.replace(/\r?\n/g, modelo.includes("\r\n") ? "\r\n" : "\n");
}

export function gerarPaginas() {
  const modelo = readFileSync(join(RAIZ, "obra.html"), "utf8");
  const obras = JSON.parse(readFileSync(join(RAIZ, "data/obras.json"), "utf8"));
  mkdirSync(PASTA, { recursive: true });

  const feitas = new Set();
  for (const obra of obras) {
    const arquivo = `${obra.id}.html`;
    writeFileSync(join(PASTA, arquivo), paginaDe(modelo, obra));
    feitas.add(arquivo);
    if (!existsSync(join(RAIZ, "models", obra.id, "previa.jpg"))) {
      console.warn(`${obra.id}: sem previa.jpg (node ferramentas/navegador.mjs previa ${obra.id}); usando a miniatura.`);
    }
  }
  for (const arquivo of readdirSync(PASTA)) {
    if (arquivo.endsWith(".html") && !feitas.has(arquivo)) {
      unlinkSync(join(PASTA, arquivo));
      console.log(`obra/${arquivo}: apagada (a obra não está mais no catálogo).`);
    }
  }
  console.log(`obra/: ${feitas.size} páginas.`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) gerarPaginas();
