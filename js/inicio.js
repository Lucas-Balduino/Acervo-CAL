/*
  inicio.js — página inicial: obra em destaque girando, progresso da meta
  de obras digitalizadas e as obras mais recentes.
*/

import { carregarObras, linkDaObra, META_DE_OBRAS } from "./data.js";
import { criarCartao } from "./cartoes.js";

const QUANTAS_NA_INICIAL = 4;

const obras = await carregarObras();

// Progresso da meta do projeto
const feitas = obras.length;
document.getElementById("contagem-obras").textContent = String(feitas);
document.getElementById("meta-obras").textContent = String(META_DE_OBRAS);
const barra = document.getElementById("progresso-barra");
barra.parentElement.setAttribute("aria-valuenow", String(feitas));
barra.parentElement.setAttribute("aria-valuemax", String(META_DE_OBRAS));
requestAnimationFrame(() => {
  barra.style.width = `${Math.min(100, (feitas / META_DE_OBRAS) * 100)}%`;
});

// Obra em destaque: a marcada com "destaque": true, ou a primeira da lista.
const destaque = obras.find((o) => o.destaque) || obras[0];
const viewer = document.getElementById("destaque");
const legenda = document.getElementById("destaque-legenda");
if (destaque) {
  viewer.cameraOrbit = `${destaque.frente || 0}deg 78deg 115%`;
  if (destaque.poster) viewer.poster = destaque.poster;
  viewer.src = destaque.modelo;
  viewer.alt = `Modelo 3D de ${destaque.titulo}`;
  legenda.href = linkDaObra(destaque);
  legenda.querySelector("strong").textContent = destaque.titulo;
  legenda.querySelector("span").textContent = `${destaque.registro} · ver em detalhe →`;
} else {
  viewer.remove();
  legenda.remove();
}

// Mais recentes = últimas cadastradas no obras.json.
const recentes = obras.slice(-QUANTAS_NA_INICIAL).reverse();
document.getElementById("grade-inicio").replaceChildren(...recentes.map(criarCartao));
