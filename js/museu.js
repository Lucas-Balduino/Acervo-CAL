/*
  museu.js — página Museu virtual: cria o renderizador, monta a sala
  (museu-sala.js), liga a câmera (museu-navegacao.js) e o contorno das obras
  (museu-contorno.js), e cuida da interface por cima do 3D: tela de entrada
  (marca e carregamento, depois o convite), modo de visita sem o cabeçalho do
  site (com o X que fecha a obra ou sai), ajuda, nome da obra sob o mouse, ficha da obra
  examinada, o percurso anterior/próxima e o nome da sala onde o visitante está.
*/

import * as THREE from "three";
import { carregarObras, linkDaObra, textoDimensoes, textoProcedencia } from "./data.js";
import { montarSala } from "./museu-sala.js";
import { criarNavegacao } from "./museu-navegacao.js";
import { criarContorno } from "./museu-contorno.js";

const palco = document.getElementById("museu-palco");
const entrada = document.getElementById("museu-entrada");
const botaoEntrar = document.getElementById("botao-entrar");
const botaoSair = document.getElementById("botao-sair");
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
  entrada.classList.add("sem-3d");
  botaoEntrar.hidden = true;
  throw new Error("Sem obras");
}

const sala = await montarSala(renderer, obras, {
  leve: toque,
  aoProgresso(carregadas, total) {
    estadoCarga.textContent = carregadas < total ? `Carregando as obras · ${carregadas} de ${total}` : "Salas prontas";
    barraCarga.style.width = `${(carregadas / total) * 100}%`;
  },
});

// Percurso: a ordem em que as peças estão no museu (sala por sala).
const percurso = sala.pecas;
let examinando = -1;
let salaNoContador = null; // sala mostrada no contador (null = recalcular)

const contorno = criarContorno(renderer);
const navegacao = criarNavegacao(camera, renderer.domElement, sala, {
  aoClicarObra(indice) {
    examinar(indice);
    if (toque) contorno.piscar(percurso[indice].grupo); // no celular não há "passar o mouse"
  },
  aoAndar: () => {},
  aoPassar(indice, x, y) {
    mostrarRotulo(indice, x, y);
    contorno.mostrar(indice >= 0 ? percurso[indice].grupo : null);
  },
});

/* ----- Laço de desenho ----- */

const relogio = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const dt = Math.min(relogio.getDelta(), 0.1);
  navegacao.atualizar(dt);
  atualizarContador();
  renderer.render(sala.cena, camera);
  contorno.desenhar(sala.cena, camera, dt);
});

// Obras prontas: a marca sobe e aparece o convite para entrar, com a sala de leve por trás.
entrada.classList.add("pronta");
botaoEntrar.disabled = false;

/* ----- Entrar e sair da visita ----- */

let jaEntrou = false;

botaoEntrar.addEventListener("click", entrar);
// O X do canto fecha primeiro a obra examinada; só fora do exame ele sai do museu.
botaoSair.addEventListener("click", () => (examinando >= 0 ? voltarAoMuseu() : sair()));

/** Ajusta o nome do X ao que ele faz agora (fechar a obra ou sair do museu). */
function nomearBotaoSair() {
  const nome = examinando >= 0 ? "Fechar a obra e voltar a andar" : "Sair do museu";
  botaoSair.setAttribute("aria-label", nome);
  botaoSair.title = nome;
}

function entrar() {
  document.body.classList.add("imersivo");
  entrada.classList.add("oculta");
  setTimeout(() => {
    if (document.body.classList.contains("imersivo")) entrada.hidden = true;
  }, 800);
  renderer.domElement.focus({ preventScroll: true });
  if (!jaEntrou) {
    jaEntrou = true;
    navegacao.chegar(); // a câmera avança devagar sala adentro
    mostrarAjuda(true);
    fechamentoDaAjuda = setTimeout(() => mostrarAjuda(false), 7000);
  }
}

/** Sai da visita: o cabeçalho volta e a tela de entrada reaparece (dá para voltar de onde parou). */
function sair() {
  if (examinando >= 0) voltarAoMuseu();
  mostrarAjuda(false);
  mostrarRotulo(-1);
  contorno.mostrar(null);
  document.body.classList.remove("imersivo");
  botaoEntrar.textContent = "Voltar ao museu";
  entrada.hidden = false;
  requestAnimationFrame(() => entrada.classList.remove("oculta"));
  botaoEntrar.focus({ preventScroll: true });
}

botaoAjuda.addEventListener("click", () => mostrarAjuda(ajuda.hidden));
document.getElementById("botao-fechar-ajuda").addEventListener("click", () => {
  mostrarAjuda(false);
  botaoAjuda.focus({ preventScroll: true });
});

let fechamentoDaAjuda = 0;

function mostrarAjuda(visivel) {
  clearTimeout(fechamentoDaAjuda); // aberta pelo botão, a ajuda não some sozinha
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
  if (evento.key !== "Escape") return;
  if (examinando >= 0) voltarAoMuseu();
  else if (!ajuda.hidden) mostrarAjuda(false);
});

let saidaDaFicha = 0;

function examinar(indice) {
  const peca = percurso[indice];
  if (!peca) return;
  clearTimeout(saidaDaFicha);
  ficha.classList.remove("saindo");
  examinando = indice;
  nomearBotaoSair();
  mostrarRotulo(-1);
  contorno.mostrar(null);
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
  salaNoContador = null;

  // Abre espaço para a ficha (à esquerda no computador, embaixo no celular) e para a barra do
  // percurso; a obra é enquadrada no espaço que sobra.
  const caixa = ficha.getBoundingClientRect();
  const estreita = telaEstreita();
  const barra = palco.getBoundingClientRect().bottom - document.querySelector(".museu-percurso").getBoundingClientRect().top;
  navegacao.examinar(peca, {
    ocupacao: 0.96,
    deslocamento: estreita ? { x: 0, y: -(caixa.height + 72) / 2 } : { x: caixa.width / 2, y: -barra / 2 },
  });
}

function voltarAoMuseu() {
  if (examinando < 0) return;
  examinando = -1;
  nomearBotaoSair();
  navegacao.voltarAAndar();
  // A ficha sai devagar, junto com a câmera.
  ficha.classList.add("saindo");
  saidaDaFicha = setTimeout(() => {
    ficha.hidden = true;
    ficha.classList.remove("saindo");
  }, 500);
  document.body.classList.remove("examinando");
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

// Fora do exame, o contador diz em que sala o visitante está (ou quantas obras há, se for uma só).
function atualizarContador() {
  if (examinando >= 0) return;
  const z = camera.position.z;
  const atual = sala.salas.find((s) => z > s.zMin - 0.1) || sala.salas.at(-1);
  if (atual === salaNoContador) return;
  salaNoContador = atual;
  contador.textContent =
    sala.salas.length > 1 ? atual.nome : `${percurso.length} ${percurso.length === 1 ? "obra" : "obras"} na sala`;
}
atualizarContador();

function semWebGL() {
  estadoCarga.textContent = "Seu navegador não conseguiu abrir o 3D (WebGL).";
  entrada.classList.add("sem-3d");
  botaoEntrar.hidden = true;
}

// Para testes e depuração no console.
window.museu = { examinar, voltarAoMuseu, entrar, sair, percurso, camera, navegacao, sala, contorno };
