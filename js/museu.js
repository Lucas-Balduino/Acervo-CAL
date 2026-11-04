/*
  museu.js — página Museu virtual: cria o renderizador, monta a sala
  (museu-sala.js), liga a câmera (museu-navegacao.js) e cuida da interface
  por cima do 3D: tela de entrada, ajuda, nome da obra sob o mouse,
  ficha da obra examinada e o percurso anterior/próxima.
*/

import * as THREE from "three";
import { carregarObras, linkDaObra, textoDimensoes, textoProcedencia } from "./data.js";
import { montarSala } from "./museu-sala.js";
import { criarNavegacao } from "./museu-navegacao.js";

const palco = document.getElementById("museu-palco");
const entrada = document.getElementById("museu-entrada");
const botaoEntrar = document.getElementById("botao-entrar");
const estadoCarga = document.getElementById("museu-estado");
const barraCarga = document.getElementById("museu-barra");
const rotulo = document.getElementById("museu-rotulo");
const ficha = document.getElementById("museu-ficha");
const ajuda = document.getElementById("museu-ajuda");
const botaoAjuda = document.getElementById("botao-ajuda");
const contador = document.getElementById("museu-contador");

const toque = window.matchMedia("(pointer: coarse)").matches;
document.body.classList.toggle("toque", toque);
const telaEstreita = () => palco.clientWidth < 760;

/* ----- Renderizador ----- */

let renderer;
try {
  renderer = new THREE.WebGLRenderer({ antialias: true });
} catch (erro) {
  semWebGL();
  throw erro;
}
renderer.setPixelRatio(Math.min(window.devicePixelRatio, toque ? 1.5 : 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.shadowMap.enabled = !toque;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.domElement.setAttribute("aria-label", "Sala do museu virtual em 3D");
renderer.domElement.setAttribute("role", "img");
renderer.domElement.tabIndex = 0; // permite focar o 3D pelo teclado (Tab) e usar as setas
palco.prepend(renderer.domElement);

const camera = new THREE.PerspectiveCamera(50, 1, 0.03, 60);

function redimensionar() {
  const { clientWidth: w, clientHeight: h } = palco;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  // Campo de visão próximo ao do olho; em tela em pé, um pouco mais aberto.
  camera.fov = w < h ? 60 : 45;
  camera.updateProjectionMatrix();
}
new ResizeObserver(redimensionar).observe(palco);
redimensionar();

/* ----- Obras e sala ----- */

const obras = (await carregarObras()).sort((a, b) =>
  (a.registro || a.id).localeCompare(b.registro || b.id, "pt-BR", { numeric: true })
);

if (obras.length === 0) {
  estadoCarga.textContent = "Nenhuma obra cadastrada ainda.";
  throw new Error("Sem obras");
}

const sala = await montarSala(renderer, obras, {
  leve: toque,
  aoProgresso(carregadas, total) {
    estadoCarga.textContent = carregadas < total ? `Carregando obras: ${carregadas} de ${total}` : "Sala pronta";
    barraCarga.style.width = `${(carregadas / total) * 100}%`;
  },
});

// Percurso: a ordem em que as peças estão na sala.
const percurso = sala.pecas;
let examinando = -1;

const navegacao = criarNavegacao(camera, renderer.domElement, sala, {
  aoClicarObra: (indice) => examinar(indice),
  aoAndar: () => {},
  aoPassar: mostrarRotulo,
});

botaoEntrar.disabled = false;
botaoEntrar.textContent = "Entrar no museu";

/* ----- Laço de desenho ----- */

const relogio = new THREE.Clock();
renderer.setAnimationLoop(() => {
  navegacao.atualizar(Math.min(relogio.getDelta(), 0.1));
  renderer.render(sala.cena, camera);
});

/* ----- Interface ----- */

botaoEntrar.addEventListener("click", () => {
  entrada.classList.add("oculta");
  setTimeout(() => (entrada.hidden = true), 400);
  renderer.domElement.focus();
  mostrarAjuda(true);
  setTimeout(() => mostrarAjuda(false), 7000);
});

botaoAjuda.addEventListener("click", () => mostrarAjuda(ajuda.hidden));

function mostrarAjuda(visivel) {
  ajuda.hidden = !visivel;
  botaoAjuda.setAttribute("aria-expanded", String(visivel));
}

document.getElementById("botao-anterior").addEventListener("click", () =>
  examinar(examinando < 0 ? percurso.length - 1 : (examinando - 1 + percurso.length) % percurso.length)
);
document.getElementById("botao-proxima").addEventListener("click", () =>
  examinar(examinando < 0 ? 0 : (examinando + 1) % percurso.length)
);
document.getElementById("botao-voltar-museu").addEventListener("click", voltarAoMuseu);

window.addEventListener("keydown", (evento) => {
  if (evento.key === "Escape" && examinando >= 0) voltarAoMuseu();
});

let saidaDaFicha = 0;

function examinar(indice) {
  const peca = percurso[indice];
  if (!peca) return;
  clearTimeout(saidaDaFicha);
  ficha.classList.remove("saindo");
  examinando = indice;
  mostrarRotulo(-1);
  mostrarAjuda(false);

  const { obra } = peca;
  ficha.querySelector(".museu-ficha-registro").textContent = obra.registro || "";
  ficha.querySelector("h2").textContent = obra.titulo;
  ficha.querySelector(".museu-ficha-procedencia").textContent = textoProcedencia(obra);
  ficha.querySelector(".museu-ficha-medidas").textContent = textoDimensoes(obra);
  ficha.querySelector(".museu-ficha-resumo").textContent = obra.resumo || "";
  ficha.querySelector(".museu-ficha-link").href = linkDaObra(obra);
  ficha.hidden = false;
  document.body.classList.add("examinando");
  contador.textContent = `${indice + 1} de ${percurso.length}`;

  // Abre espaço para a ficha: à esquerda no computador, embaixo no celular.
  const caixa = ficha.getBoundingClientRect();
  const estreita = telaEstreita();
  navegacao.examinar(peca, {
    ocupacao: estreita ? 0.62 : 1.0,
    // No celular, centraliza a obra no espaço livre acima da ficha e da barra do percurso.
    deslocamento: estreita ? { x: 0, y: -(caixa.height + 72) / 2 } : { x: caixa.width / 2, y: 0 },
  });
}

function voltarAoMuseu() {
  if (examinando < 0) return;
  examinando = -1;
  navegacao.voltarAAndar();
  // A ficha sai devagar, junto com a câmera.
  ficha.classList.add("saindo");
  saidaDaFicha = setTimeout(() => {
    ficha.hidden = true;
    ficha.classList.remove("saindo");
  }, 500);
  document.body.classList.remove("examinando");
  contador.textContent = textoDaSala();
  renderer.domElement.focus();
}

function mostrarRotulo(indice, x, y) {
  if (indice < 0) {
    rotulo.hidden = true;
    return;
  }
  const r = palco.getBoundingClientRect();
  rotulo.textContent = percurso[indice].obra.titulo;
  rotulo.style.transform = `translate(${x - r.left + 14}px, ${y - r.top + 14}px)`;
  rotulo.hidden = false;
}

const textoDaSala = () => `${percurso.length} ${percurso.length === 1 ? "obra" : "obras"} na sala`;
contador.textContent = textoDaSala();

function semWebGL() {
  estadoCarga.textContent = "Seu navegador não conseguiu abrir o 3D (WebGL).";
  botaoEntrar.hidden = true;
}

// Para testes e depuração no console.
window.museu = { examinar, voltarAoMuseu, percurso, camera, navegacao };
