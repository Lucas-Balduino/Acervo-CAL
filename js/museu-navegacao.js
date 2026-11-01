/*
  museu-navegacao.js — câmera em primeira pessoa do museu virtual.

  Computador: arrastar olha em volta; clicar no chão anda até lá; clicar numa
  obra se aproxima dela; W A S D ou setas caminham; roda do mouse anda para
  frente e para trás. Celular: arrastar olha; tocar no chão anda; tocar numa
  obra se aproxima.

  Não monta a sala nem mostra textos: avisa museu.js pelos callbacks.
*/

import * as THREE from "three";

const ALTURA_OLHOS = 1.6;
const VELOCIDADE = 2.2; // m/s
const GIRO = 1.8; // rad/s nas setas ← →
const SENSIBILIDADE = 0.0045; // rad por pixel arrastado
const LIMITE_OLHAR = 1.25; // rad para cima/baixo
const FOLGA_PAREDE = 0.45; // m
const FOLGA_PEDESTAL = 0.35; // m

const reduzirMovimento = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * @param {THREE.PerspectiveCamera} camera
 * @param {HTMLElement} elemento  onde ouvir mouse e toque (o canvas)
 * @param {object} sala
 * @param {{xMin:number,xMax:number,zMin:number,zMax:number}} sala.limites
 * @param {Array} sala.pecas  pedestais com posicao, direcao, raio, centro, altura
 * @param {THREE.Scene} sala.cena
 * @param {object} eventos
 * @param {(indice: number) => void} eventos.aoClicarObra
 * @param {() => void} eventos.aoMover   usuário saiu andando por conta própria
 * @param {(indice: number, x: number, y: number) => void} eventos.aoPassar  -1 quando não está sobre obra
 */
export function criarNavegacao(camera, elemento, sala, eventos) {
  const posicao = new THREE.Vector3(0, ALTURA_OLHOS, -0.7);
  const alvo = { posicao: posicao.clone(), yaw: 0, pitch: -0.05 };
  let yaw = alvo.yaw;
  let pitch = alvo.pitch;

  const teclas = new Set();
  const raio = new THREE.Raycaster();
  const ponteiro = new THREE.Vector2();
  const piso = sala.cena.getObjectByName("piso");

  /* ----- Restrições: paredes e pedestais ----- */

  function restringir(p) {
    const { xMin, xMax, zMin, zMax } = sala.limites;
    p.x = THREE.MathUtils.clamp(p.x, xMin + FOLGA_PAREDE, xMax - FOLGA_PAREDE);
    p.z = THREE.MathUtils.clamp(p.z, zMin + FOLGA_PAREDE, zMax - FOLGA_PAREDE);
    for (const peca of sala.pecas) {
      const dx = p.x - peca.posicao.x;
      const dz = p.z - peca.posicao.z;
      const minimo = peca.raio + FOLGA_PEDESTAL;
      const d = Math.hypot(dx, dz);
      if (d < minimo) {
        const fator = d > 1e-4 ? minimo / d : 1;
        p.x = peca.posicao.x + (d > 1e-4 ? dx * fator : peca.direcao.x * minimo);
        p.z = peca.posicao.z + (d > 1e-4 ? dz * fator : peca.direcao.z * minimo);
      }
    }
    return p;
  }

  /* ----- Mouse e toque ----- */

  let arraste = null;

  function paraNDC(evento) {
    const r = elemento.getBoundingClientRect();
    ponteiro.set(((evento.clientX - r.left) / r.width) * 2 - 1, -((evento.clientY - r.top) / r.height) * 2 + 1);
    raio.setFromCamera(ponteiro, camera);
  }

  /** Índice da obra sob o ponteiro, ou -1. */
  function obraSobPonteiro() {
    const alvos = sala.pecas.flatMap((p) => (p.grupo ? [p.pedestal, p.grupo] : [p.pedestal]));
    const acerto = raio.intersectObjects(alvos, true)[0];
    if (!acerto) return -1;
    let objeto = acerto.object;
    while (objeto && objeto.userData.indice === undefined) objeto = objeto.parent;
    return objeto ? objeto.userData.indice : -1;
  }

  elemento.addEventListener("pointerdown", (evento) => {
    if (evento.button !== 0) return;
    arraste = { x: evento.clientX, y: evento.clientY, moveu: false, id: evento.pointerId };
    elemento.setPointerCapture(evento.pointerId);
  });

  elemento.addEventListener("pointermove", (evento) => {
    if (arraste && evento.pointerId === arraste.id) {
      const dx = evento.clientX - arraste.x;
      const dy = evento.clientY - arraste.y;
      if (!arraste.moveu && Math.hypot(dx, dy) < 6) return;
      arraste.moveu = true;
      arraste.x = evento.clientX;
      arraste.y = evento.clientY;
      alvo.yaw += dx * SENSIBILIDADE;
      alvo.pitch = THREE.MathUtils.clamp(alvo.pitch + dy * SENSIBILIDADE, -LIMITE_OLHAR, LIMITE_OLHAR);
      yaw = alvo.yaw;
      pitch = alvo.pitch;
      elemento.classList.add("arrastando");
      return;
    }
    if (evento.pointerType === "mouse") {
      paraNDC(evento);
      const indice = obraSobPonteiro();
      elemento.style.cursor = indice >= 0 ? "pointer" : "";
      eventos.aoPassar(indice, evento.clientX, evento.clientY);
    }
  });

  elemento.addEventListener("pointerup", (evento) => {
    if (!arraste || evento.pointerId !== arraste.id) return;
    const foiClique = !arraste.moveu;
    arraste = null;
    elemento.classList.remove("arrastando");
    if (!foiClique) return;

    paraNDC(evento);
    const indice = obraSobPonteiro();
    if (indice >= 0) {
      eventos.aoClicarObra(indice);
      return;
    }
    const noPiso = piso && raio.intersectObject(piso)[0];
    if (noPiso) {
      andarAte(noPiso.point);
      eventos.aoMover();
    }
  });

  elemento.addEventListener("pointercancel", () => {
    arraste = null;
    elemento.classList.remove("arrastando");
  });

  elemento.addEventListener("pointerleave", () => eventos.aoPassar(-1, 0, 0));

  elemento.addEventListener(
    "wheel",
    (evento) => {
      evento.preventDefault();
      const passo = THREE.MathUtils.clamp(-evento.deltaY * 0.004, -0.8, 0.8);
      const frente = new THREE.Vector3(-Math.sin(alvo.yaw), 0, -Math.cos(alvo.yaw));
      restringir(alvo.posicao.addScaledVector(frente, passo));
      eventos.aoMover();
    },
    { passive: false }
  );

  /* ----- Teclado ----- */

  const MAPA = {
    KeyW: "frente", ArrowUp: "frente",
    KeyS: "tras", ArrowDown: "tras",
    KeyA: "esquerda", KeyD: "direita",
    ArrowLeft: "girarEsq", ArrowRight: "girarDir",
  };

  window.addEventListener("keydown", (evento) => {
    if (evento.target.closest?.("input, select, textarea, button, a")) return;
    const acao = MAPA[evento.code];
    if (!acao) return;
    evento.preventDefault();
    if (!teclas.has(acao)) eventos.aoMover();
    teclas.add(acao);
  });
  window.addEventListener("keyup", (evento) => teclas.delete(MAPA[evento.code]));
  window.addEventListener("blur", () => teclas.clear());

  /* ----- Movimentos programados ----- */

  function andarAte(ponto) {
    alvo.posicao.set(ponto.x, ALTURA_OLHOS, ponto.z);
    restringir(alvo.posicao);
  }

  /** Para em frente à obra, olhando para ela. */
  function focar(peca) {
    const distancia = THREE.MathUtils.clamp(0.55 + peca.altura * 1.6, 0.8, 2.2);
    const p = peca.posicao.clone().addScaledVector(peca.direcao, distancia);
    alvo.posicao.set(p.x, Math.min(ALTURA_OLHOS, peca.centro.y + 0.35), p.z);
    olharPara(peca.centro);
  }

  function olharPara(ponto) {
    const dx = ponto.x - alvo.posicao.x;
    const dy = ponto.y - alvo.posicao.y;
    const dz = ponto.z - alvo.posicao.z;
    const yawDestino = Math.atan2(-dx, -dz);
    // Gira pelo caminho mais curto.
    alvo.yaw = yaw + Math.atan2(Math.sin(yawDestino - yaw), Math.cos(yawDestino - yaw));
    alvo.pitch = Math.atan2(dy, Math.hypot(dx, dz));
  }

  /** Dá um passo para trás a partir da obra, voltando à altura dos olhos. */
  function recuar(peca) {
    const p = peca.posicao.clone().addScaledVector(peca.direcao, 2.6);
    alvo.posicao.set(p.x, ALTURA_OLHOS, p.z);
    restringir(alvo.posicao);
    alvo.pitch = -0.05;
  }

  /* ----- Atualização a cada quadro ----- */

  const frente = new THREE.Vector3();
  const lado = new THREE.Vector3();

  function atualizar(dt) {
    if (teclas.size) {
      if (teclas.has("girarEsq")) alvo.yaw += GIRO * dt;
      if (teclas.has("girarDir")) alvo.yaw -= GIRO * dt;
      frente.set(-Math.sin(alvo.yaw), 0, -Math.cos(alvo.yaw));
      lado.set(-frente.z, 0, frente.x);
      const passo = VELOCIDADE * dt;
      if (teclas.has("frente")) alvo.posicao.addScaledVector(frente, passo);
      if (teclas.has("tras")) alvo.posicao.addScaledVector(frente, -passo);
      if (teclas.has("esquerda")) alvo.posicao.addScaledVector(lado, -passo);
      if (teclas.has("direita")) alvo.posicao.addScaledVector(lado, passo);
      alvo.posicao.y = ALTURA_OLHOS;
      restringir(alvo.posicao);
      if (teclas.has("girarEsq") || teclas.has("girarDir")) yaw = alvo.yaw;
    }

    const k = reduzirMovimento ? 1 : 1 - Math.exp(-dt * 4.5);
    posicao.lerp(alvo.posicao, k);
    yaw += (alvo.yaw - yaw) * k;
    pitch += (alvo.pitch - pitch) * k;

    camera.position.copy(posicao);
    camera.rotation.set(pitch, yaw, 0, "YXZ");
  }

  atualizar(1);

  return { atualizar, focar, recuar, andarAte };
}
