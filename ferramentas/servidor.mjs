/*
  servidor.mjs — servidor local para ver o site e gerar miniaturas.

  Uso (na raiz do repositório):
    node ferramentas/servidor.mjs
  Depois abra http://localhost:3000

  Além de servir os arquivos, aceita um único tipo de escrita:
  POST /salvar-poster?id=cal-0000 grava models/cal-0000/poster.webp.
  É usado por ferramentas/posters.html. Só escuta na própria máquina.
*/

import { createServer } from "node:http";
import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";

const RAIZ = resolve(import.meta.dirname, "..");
const PORTA = Number(process.env.PORTA || 3000);

const TIPOS = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".glb": "model/gltf-binary",
  ".webp": "image/webp",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".pdf": "application/pdf",
};

function salvarPoster(req, res, url) {
  const id = url.searchParams.get("id") || "";
  const pasta = join(RAIZ, "models", id);
  if (!/^[a-z0-9-]+$/.test(id) || !existsSync(pasta)) {
    res.writeHead(400).end("id inválido");
    return;
  }
  const partes = [];
  req.on("data", (p) => partes.push(p));
  req.on("end", () => {
    const corpo = Buffer.concat(partes);
    // Confere a assinatura de um arquivo WebP (RIFF....WEBP).
    if (corpo.subarray(0, 4).toString() !== "RIFF" || corpo.subarray(8, 12).toString() !== "WEBP") {
      res.writeHead(400).end("não é WebP");
      return;
    }
    writeFileSync(join(pasta, "poster.webp"), corpo);
    console.log(`Miniatura salva: models/${id}/poster.webp (${(corpo.length / 1024).toFixed(0)} KB)`);
    res.writeHead(200).end("ok");
  });
}

createServer((req, res) => {
  const url = new URL(req.url, "http://localhost");

  if (req.method === "POST" && url.pathname === "/salvar-poster") {
    salvarPoster(req, res, url);
    return;
  }

  let caminho = normalize(join(RAIZ, decodeURIComponent(url.pathname)));
  if (!caminho.startsWith(RAIZ)) {
    res.writeHead(403).end();
    return;
  }
  if (existsSync(caminho) && statSync(caminho).isDirectory()) caminho = join(caminho, "index.html");
  if (!existsSync(caminho)) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }).end("Não encontrado");
    return;
  }
  res.writeHead(200, {
    "Content-Type": TIPOS[extname(caminho).toLowerCase()] || "application/octet-stream",
    "Cache-Control": "no-store",
  });
  res.end(readFileSync(caminho));
}).listen(PORTA, "127.0.0.1", () => {
  console.log(`Site em http://localhost:${PORTA}`);
});
