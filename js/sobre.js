/*
  sobre.js — página "Sobre o processo": acompanha a rolagem, descobre qual etapa está sendo lida
  (e quanto dela já passou) e avisa o 3D (sobre-cena.js). Também cuida dos pontos de navegação,
  dos botões de camada da última etapa e da contagem de obras.
  Sem WebGL (ou se o 3D falhar), a página continua legível: as etapas viram uma lista comum.
*/

import { carregarObras, META_DE_OBRAS } from "./data.js";

const historia = document.getElementById("historia");
const palco = document.getElementById("palco");
const etapas = [...document.querySelectorAll(".etapa")];
const numero = document.getElementById("palco-numero");
const nome = document.getElementById("palco-nome");
const carga = document.getElementById("palco-carga");
const navPontos = document.getElementById("palco-pontos");

// Cor de fundo do palco em cada etapa (a mesma do 3D, para não piscar enquanto carrega).
const FUNDOS = {
  obra: "#efe8dc", captura: "#0f1720", projetos: "#0f1720", malha: "#1e2429",
  textura: "#ececec", blender: "#3d3d3d", web: "#ececec", site: "#efe8dc",
};

const movimentoReduzido = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const toque = window.matchMedia("(pointer: coarse)").matches;

contarObras();

let cena = null;
let etapaAtiva = -1;

if (temWebGL()) {
  historia.classList.add("com-3d");
  montarPontos();
  ligarCamadas();
  acompanharRolagem();
  iniciar3D();
}

async function iniciar3D() {
  try {
    const { criarCena } = await import("./sobre-cena.js");
    cena = await criarCena(palco, { leve: toque, movimentoReduzido });
    carga.hidden = true;
    palco.classList.add("pronto");
    atualizarRolagem();
    // Só desenha enquanto o palco aparece na tela.
    new IntersectionObserver(([registro]) => cena.ligar(registro.isIntersecting && !document.hidden)).observe(palco);
    document.addEventListener("visibilitychange", () => {
      const r = palco.getBoundingClientRect();
      cena.ligar(!document.hidden && r.bottom > 0 && r.top < innerHeight);
    });
    window.sobre = { cena, definirEtapa: cena.definirEtapa };
  } catch (erro) {
    console.error("Não foi possível montar o 3D da página", erro);
    historia.classList.remove("com-3d");
  }
}

/* ---------- Rolagem ---------- */

function acompanharRolagem() {
  let pedido = 0;
  const agendar = () => {
    if (!pedido) pedido = requestAnimationFrame(() => ((pedido = 0), atualizarRolagem()));
  };
  addEventListener("scroll", agendar, { passive: true });
  addEventListener("resize", agendar);
  atualizarRolagem();
}

// Onde o cartão de texto fica preso (logo abaixo do cabeçalho; no celular, abaixo do palco).
function topoDoCartao(etapa) {
  return parseFloat(getComputedStyle(etapa.querySelector(".etapa-cartao")).top) || 0;
}

// Progresso da etapa: 0 quando o cartão prende, 1 quando ele vai soltar.
function progressoDa(etapa) {
  const r = etapa.getBoundingClientRect();
  const percurso = r.height - etapa.querySelector(".etapa-cartao").offsetHeight;
  return percurso > 0 ? (topoDoCartao(etapa) - r.top) / percurso : 0;
}

function atualizarRolagem() {
  // A etapa ativa é a última cujo topo já passou do meio da área do texto.
  const topo = topoDoCartao(etapas[0]);
  const linha = topo + (innerHeight - topo) / 2;
  let indice = 0;
  etapas.forEach((etapa, i) => {
    if (etapa.getBoundingClientRect().top <= linha) indice = i;
  });
  const etapa = etapas[indice];
  const progresso = Math.min(1, Math.max(0, progressoDa(etapa)));

  if (indice !== etapaAtiva) {
    etapaAtiva = indice;
    etapas.forEach((e, i) => e.classList.toggle("ativa", i === indice));
    numero.textContent = String(indice + 1).padStart(2, "0");
    nome.textContent = etapa.dataset.nome;
    palco.style.backgroundColor = FUNDOS[etapa.dataset.etapa];
    palco.classList.toggle("escuro", ["captura", "projetos", "malha", "blender"].includes(etapa.dataset.etapa));
    navPontos.querySelectorAll("button").forEach((b, i) => b.setAttribute("aria-current", i === indice ? "step" : "false"));
  }
  cena?.definirEtapa(etapa.dataset.etapa, progresso);
}

/* ---------- Pontos de navegação ---------- */

function montarPontos() {
  etapas.forEach((etapa, i) => {
    const botao = document.createElement("button");
    botao.type = "button";
    botao.setAttribute("aria-label", `Etapa ${i + 1}: ${etapa.dataset.nome}`);
    botao.title = etapa.dataset.nome;
    botao.addEventListener("click", () => {
      // Para logo depois de o texto prender, no começo da animação da etapa.
      const r = etapa.getBoundingClientRect();
      const percurso = r.height - etapa.querySelector(".etapa-cartao").offsetHeight;
      const destino = scrollY + r.top - topoDoCartao(etapa) + percurso * 0.02;
      scrollTo({ top: destino, behavior: movimentoReduzido ? "auto" : "smooth" });
    });
    navPontos.appendChild(botao);
  });
}

/* ---------- Camadas (última etapa) ---------- */

function ligarCamadas() {
  const botoes = document.querySelectorAll("[data-camada]");
  botoes.forEach((botao) => {
    botao.addEventListener("click", () => {
      botoes.forEach((b) => b.setAttribute("aria-pressed", String(b === botao)));
      cena?.definirCamada(botao.dataset.camada);
    });
  });
}

/* ---------- Outros ---------- */

async function contarObras() {
  document.getElementById("meta-obras").textContent = META_DE_OBRAS;
  try {
    const obras = await carregarObras();
    document.getElementById("contagem-obras").textContent = obras.length;
  } catch {
    // Sem a lista de obras, a frase fica com o traço.
  }
}

function temWebGL() {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") || canvas.getContext("webgl"));
  } catch {
    return false;
  }
}
