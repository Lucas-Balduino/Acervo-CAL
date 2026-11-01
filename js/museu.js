/*
  museu.js — página Museu virtual: cria o renderizador, monta a sala
  (museu-sala.js), liga a câmera (museu-navegacao.js) e cuida da interface
  por cima do 3D: tela de entrada, ajuda, nome da obra sob o mouse,
  painel da obra em foco e o percurso anterior/próxima.
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
const painel = document.getElementById("museu-painel");
const ajuda = document.getElementById("museu-ajuda");
const botaoAjuda = document.getElementById("botao-ajuda");
const contador = document.getElementById("museu-contador");

const toque = window.matchMedia("(pointer: coarse)").matches;
document.body.classList.toggle("toque", toque);

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

const camera = new THREE.PerspectiveCamera(60, 1, 0.05, 60);

function redimensionar() {
  const { clientWidth: w, clientHeight: h } = palco;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  // Em tela em pé, abre o campo de visão para não parecer um corredor estreito.
  camera.fov = w < h ? 75 : 60;
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
  sombras: !toque,
  aoProgresso(carregadas, total) {
    estadoCarga.textContent = carregadas < total ? `Carregando obras: ${carregadas} de ${total}` : "Sala pronta";
    barraCarga.style.width = `${(carregadas / total) * 100}%`;
  },
});

// Percurso do tour: a ordem em que as peças estão na sala.
const percurso = sala.pecas;
let emFoco = -1;

const navegacao = criarNavegacao(camera, renderer.domElement, sala, {
  aoClicarObra: (indice) => focar(indice),
  aoMover: () => sairDoFoco(false),
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
  setTimeout(() => mostrarAjuda(false), 6000);
});

botaoAjuda.addEventListener("click", () => mostrarAjuda(ajuda.hidden));

function mostrarAjuda(visivel) {
  ajuda.hidden = !visivel;
  botaoAjuda.setAttribute("aria-expanded", String(visivel));
}

document.getElementById("botao-anterior").addEventListener("click", () =>
  focar(emFoco < 0 ? percurso.length - 1 : (emFoco - 1 + percurso.length) % percurso.length)
);
document.getElementById("botao-proxima").addEventListener("click", () =>
  focar(emFoco < 0 ? 0 : (emFoco + 1) % percurso.length)
);
document.getElementById("botao-voltar-sala").addEventListener("click", () => sairDoFoco(true));

window.addEventListener("keydown", (evento) => {
  if (evento.key === "Escape" && emFoco >= 0) sairDoFoco(true);
});

function focar(indice) {
  const peca = percurso[indice];
  if (!peca) return;
  emFoco = indice;
  navegacao.focar(peca);
  mostrarRotulo(-1);

  const { obra } = peca;
  painel.querySelector(".museu-painel-registro").textContent = obra.registro || "";
  painel.querySelector("h2").textContent = obra.titulo;
  painel.querySelector(".museu-painel-meta").textContent = [textoProcedencia(obra), textoDimensoes(obra)]
    .filter(Boolean)
    .join(" · ");
  painel.querySelector(".museu-painel-resumo").textContent = obra.resumo || "";
  painel.querySelector("a").href = linkDaObra(obra);
  painel.hidden = false;
  contador.textContent = `Obra ${indice + 1} de ${percurso.length}`;
}

function sairDoFoco(recuar) {
  if (emFoco < 0) return;
  if (recuar) navegacao.recuar(percurso[emFoco]);
  emFoco = -1;
  painel.hidden = true;
  contador.textContent = `${percurso.length} ${percurso.length === 1 ? "obra" : "obras"} na sala`;
}

function mostrarRotulo(indice, x, y) {
  if (indice < 0 || indice === emFoco) {
    rotulo.hidden = true;
    return;
  }
  const r = palco.getBoundingClientRect();
  rotulo.textContent = percurso[indice].obra.titulo;
  rotulo.style.transform = `translate(${x - r.left + 14}px, ${y - r.top + 14}px)`;
  rotulo.hidden = false;
}

contador.textContent = `${percurso.length} ${percurso.length === 1 ? "obra" : "obras"} na sala`;

function semWebGL() {
  estadoCarga.textContent = "Seu navegador não conseguiu abrir o 3D (WebGL).";
  botaoEntrar.hidden = true;
}

// Para testes e depuração no console.
window.museu = { focar, sairDoFoco, percurso, camera };
