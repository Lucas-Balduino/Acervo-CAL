/*
  museu-navegacao.js — câmera do museu virtual, com dois modos:

  ANDAR (primeira pessoa)
    Computador: arrastar olha em volta; clicar no chão anda até lá; clicar numa
    obra a examina; W A S D ou setas caminham; roda do mouse anda.
    Celular: arrastar olha; tocar no chão anda; tocar numa obra a examina.

  EXAMINAR (como no visualizador da obra)
    A câmera orbita a obra: arrastar gira, roda do mouse ou pinça aproxima,
    duplo clique volta à vista inicial, setas giram. A obra gira devagar
    sozinha até a primeira interação.

  As transições entre posições são suaves (posição interpolada e rotação por
  quaternion). Não monta a sala nem mostra textos: avisa museu.js pelos callbacks.
*/

import * as THREE from "three";

const ALTURA_OLHOS = 1.6;
const VELOCIDADE = 2.0; // m/s
const GIRO = 1.8; // rad/s nas setas ← →
const SENSIBILIDADE_OLHAR = 0.0042; // rad por pixel arrastado (andar)
const SENSIBILIDADE_ORBITA = 0.008; // rad por pixel arrastado (examinar)
const LIMITE_OLHAR = 1.2; // rad para cima/baixo
const FOLGA_PAREDE = 0.45; // m
const FOLGA_PEDESTAL = 0.35; // m
const GIRO_AUTOMATICO = 0.22; // rad/s ao examinar, até a primeira interação

const reduzirMovimento = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * @param {THREE.PerspectiveCamera} camera
 * @param {HTMLElement} elemento  onde ouvir mouse e toque (o canvas)
 * @param {object} sala  resultado de montarSala (cena, pecas, limites)
 * @param {object} eventos
 * @param {(indice: number) => void} eventos.aoClicarObra
 * @param {() => void} eventos.aoAndar  o visitante saiu andando por conta própria
 * @param {(indice: number, x: number, y: number) => void} eventos.aoPassar  -1 quando não está sobre obra
 */
export function criarNavegacao(camera, elemento, sala, eventos) {
  let modo = "andar";

  // Modo andar
  const andar = { posicao: new THREE.Vector3(0, ALTURA_OLHOS, -0.5), yaw: 0, pitch: -0.1 };
  let yaw = andar.yaw;
  let pitch = andar.pitch;

  // Modo examinar
  const exame = {
    peca: null,
    theta: 0, phi: 1.3, raio: 1,
    thetaAlvo: 0, phiAlvo: 1.3, raioAlvo: 1,
    raioMin: 0.3, raioMax: 3,
    thetaInicial: 0, raioInicial: 1,
    girando: true,
  };

  // Deslocamento da imagem (px) para abrir espaço ao painel da obra.
  const deslocamento = { atual: new THREE.Vector2(), alvo: new THREE.Vector2() };
  let transicao = 0; // segundos restantes de transição suave entre poses

  camera.position.copy(andar.posicao);
  camera.rotation.set(pitch, yaw, 0, "YXZ");

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
        if (d > 1e-4) {
          p.x = peca.posicao.x + (dx / d) * minimo;
          p.z = peca.posicao.z + (dz / d) * minimo;
        } else {
          p.x = peca.posicao.x + peca.direcao.x * minimo;
          p.z = peca.posicao.z + peca.direcao.z * minimo;
        }
      }
    }
    return p;
  }

  /* ----- Mouse e toque ----- */

  const ponteiros = new Map(); // pointerId → {x, y}
  let arraste = null; // { moveu, x, y }
  let pinca = null; // { distancia, raio }

  function paraRaio(evento) {
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

  const distanciaDaPinca = () => {
    const [a, b] = [...ponteiros.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  };

  elemento.addEventListener("pointerdown", (evento) => {
    if (evento.pointerType === "mouse" && evento.button !== 0) return;
    ponteiros.set(evento.pointerId, { x: evento.clientX, y: evento.clientY });
    elemento.setPointerCapture(evento.pointerId);
    if (ponteiros.size === 1) {
      arraste = { moveu: false, x: evento.clientX, y: evento.clientY };
    } else if (ponteiros.size === 2) {
      arraste = null;
      pinca = { distancia: distanciaDaPinca(), raio: exame.raioAlvo };
    }
  });

  elemento.addEventListener("pointermove", (evento) => {
    if (ponteiros.has(evento.pointerId)) {
      ponteiros.set(evento.pointerId, { x: evento.clientX, y: evento.clientY });

      if (pinca && ponteiros.size === 2) {
        if (modo === "obra") {
          exame.raioAlvo = THREE.MathUtils.clamp(
            pinca.raio * (pinca.distancia / Math.max(distanciaDaPinca(), 1)),
            exame.raioMin,
            exame.raioMax
          );
          exame.girando = false;
        }
        return;
      }

      if (arraste) {
        const dx = evento.clientX - arraste.x;
        const dy = evento.clientY - arraste.y;
        if (!arraste.moveu && Math.hypot(dx, dy) < 6) return;
        arraste.moveu = true;
        arraste.x = evento.clientX;
        arraste.y = evento.clientY;
        elemento.classList.add("arrastando");
        if (modo === "obra") {
          exame.thetaAlvo -= dx * SENSIBILIDADE_ORBITA;
          exame.phiAlvo = THREE.MathUtils.clamp(exame.phiAlvo - dy * SENSIBILIDADE_ORBITA, 0.3, 1.62);
          exame.girando = false;
        } else {
          andar.yaw += dx * SENSIBILIDADE_OLHAR;
          andar.pitch = THREE.MathUtils.clamp(andar.pitch + dy * SENSIBILIDADE_OLHAR, -LIMITE_OLHAR, LIMITE_OLHAR);
          yaw = andar.yaw;
          pitch = andar.pitch;
        }
      }
      return;
    }

    // Só passando o mouse por cima
    if (evento.pointerType === "mouse") {
      paraRaio(evento);
      const indice = obraSobPonteiro();
      const clicavel = indice >= 0 && !(modo === "obra" && exame.peca?.indice === indice);
      elemento.style.cursor = clicavel ? "pointer" : "";
      eventos.aoPassar(clicavel ? indice : -1, evento.clientX, evento.clientY);
    }
  });

  function soltar(evento) {
    if (!ponteiros.has(evento.pointerId)) return;
    ponteiros.delete(evento.pointerId);
    if (ponteiros.size < 2) pinca = null;
    const foiClique = arraste && !arraste.moveu && evento.type === "pointerup";
    if (ponteiros.size === 0) {
      arraste = null;
      elemento.classList.remove("arrastando");
    }
    if (!foiClique) return;

    paraRaio(evento);
    const indice = obraSobPonteiro();
    if (indice >= 0) {
      if (!(modo === "obra" && exame.peca?.indice === indice)) eventos.aoClicarObra(indice);
      return;
    }
    if (modo === "andar") {
      const noPiso = piso && raio.intersectObject(piso)[0];
      if (noPiso) {
        andar.posicao.set(noPiso.point.x, ALTURA_OLHOS, noPiso.point.z);
        restringir(andar.posicao);
        eventos.aoAndar();
      }
    }
  }
  elemento.addEventListener("pointerup", soltar);
  elemento.addEventListener("pointercancel", soltar);
  elemento.addEventListener("pointerleave", () => eventos.aoPassar(-1, 0, 0));

  elemento.addEventListener("dblclick", () => {
    if (modo === "obra") vistaInicialDoExame();
  });

  elemento.addEventListener(
    "wheel",
    (evento) => {
      evento.preventDefault();
      if (modo === "obra") {
        exame.raioAlvo = THREE.MathUtils.clamp(
          exame.raioAlvo * Math.exp(evento.deltaY * 0.0012),
          exame.raioMin,
          exame.raioMax
        );
        exame.girando = false;
        return;
      }
      const passo = THREE.MathUtils.clamp(-evento.deltaY * 0.004, -0.8, 0.8);
      const frente = new THREE.Vector3(-Math.sin(andar.yaw), 0, -Math.cos(andar.yaw));
      restringir(andar.posicao.addScaledVector(frente, passo));
      eventos.aoAndar();
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
    if (modo === "andar" && !teclas.has(acao)) eventos.aoAndar();
    teclas.add(acao);
  });
  window.addEventListener("keyup", (evento) => teclas.delete(MAPA[evento.code]));
  window.addEventListener("blur", () => teclas.clear());

  /* ----- Examinar uma obra ----- */

  function raioParaCaber(peca, ocupacao) {
    const esfera = peca.tamanho.length() / 2;
    const meioFov = THREE.MathUtils.degToRad(camera.fov / 2);
    return esfera / Math.tan(meioFov) / ocupacao;
  }

  /**
   * @param {object} peca
   * @param {object} opcoes
   * @param {number} opcoes.ocupacao  fração da altura da tela que a obra deve ocupar
   * @param {{x:number,y:number}} opcoes.deslocamento  px para mover a obra na tela (abre espaço ao painel)
   */
  function examinar(peca, { ocupacao = 0.7, deslocamento: d = { x: 0, y: 0 } } = {}) {
    const vindoDeAndar = modo === "andar";
    modo = "obra";
    exame.peca = peca;
    exame.thetaInicial = Math.atan2(peca.direcao.x, peca.direcao.z);
    exame.raioInicial = raioParaCaber(peca, ocupacao);
    exame.raioMin = Math.max(peca.tamanho.length() / 2 + 0.06, 0.18);
    exame.raioMax = Math.max(exame.raioInicial * 2.5, 1.2);
    deslocamento.alvo.set(d.x, d.y);

    // Começa a órbita do ângulo em que a câmera está, para a chegada ser contínua.
    if (vindoDeAndar) {
      const rel = camera.position.clone().sub(peca.centro);
      exame.theta = Math.atan2(rel.x, rel.z);
      exame.phi = THREE.MathUtils.clamp(Math.acos(rel.y / Math.max(rel.length(), 1e-3)), 0.3, 1.62);
      exame.raio = rel.length();
    }
    vistaInicialDoExame();
    exame.girando = true;
    transicao = 1.4;
    teclas.clear();
  }

  function vistaInicialDoExame() {
    // Gira pelo caminho mais curto até a frente.
    exame.thetaAlvo =
      exame.theta + Math.atan2(Math.sin(exame.thetaInicial - exame.theta), Math.cos(exame.thetaInicial - exame.theta));
    exame.phiAlvo = 1.32;
    exame.raioAlvo = exame.raioInicial;
  }

  /** Volta a andar, em frente à obra que estava sendo examinada. */
  function voltarAAndar() {
    if (modo !== "obra") return;
    const peca = exame.peca;
    modo = "andar";
    deslocamento.alvo.set(0, 0);

    const p = peca.posicao.clone().addScaledVector(peca.direcao, 1.5);
    andar.posicao.set(p.x, ALTURA_OLHOS, p.z);
    restringir(andar.posicao);
    const alvo = peca.centro;
    andar.yaw = Math.atan2(-(alvo.x - andar.posicao.x), -(alvo.z - andar.posicao.z));
    andar.pitch = Math.atan2(alvo.y - ALTURA_OLHOS, Math.hypot(alvo.x - andar.posicao.x, alvo.z - andar.posicao.z));
    yaw = andar.yaw;
    pitch = andar.pitch;
    transicao = 1.2;
  }

  /* ----- Atualização a cada quadro ----- */

  const frente = new THREE.Vector3();
  const lado = new THREE.Vector3();
  const destino = new THREE.Vector3();
  const quatDestino = new THREE.Quaternion();
  const matriz = new THREE.Matrix4();
  const euler = new THREE.Euler(0, 0, 0, "YXZ");

  function suavizar(dt, velocidade) {
    return reduzirMovimento ? 1 : 1 - Math.exp(-dt * velocidade);
  }

  function atualizarAndar(dt) {
    if (teclas.size) {
      if (teclas.has("girarEsq")) andar.yaw += GIRO * dt;
      if (teclas.has("girarDir")) andar.yaw -= GIRO * dt;
      frente.set(-Math.sin(andar.yaw), 0, -Math.cos(andar.yaw));
      lado.set(-frente.z, 0, frente.x);
      const passo = VELOCIDADE * dt;
      if (teclas.has("frente")) andar.posicao.addScaledVector(frente, passo);
      if (teclas.has("tras")) andar.posicao.addScaledVector(frente, -passo);
      if (teclas.has("esquerda")) andar.posicao.addScaledVector(lado, -passo);
      if (teclas.has("direita")) andar.posicao.addScaledVector(lado, passo);
      restringir(andar.posicao);
      if (teclas.has("girarEsq") || teclas.has("girarDir")) yaw = andar.yaw;
    }
    const k = suavizar(dt, 6);
    yaw += (andar.yaw - yaw) * k;
    pitch += (andar.pitch - pitch) * k;
    destino.copy(andar.posicao);
    quatDestino.setFromEuler(euler.set(pitch, yaw, 0));
  }

  function atualizarExame(dt) {
    if (teclas.has("girarEsq") || teclas.has("esquerda")) exame.thetaAlvo -= GIRO * dt;
    if (teclas.has("girarDir") || teclas.has("direita")) exame.thetaAlvo += GIRO * dt;
    if (teclas.has("frente")) exame.raioAlvo = Math.max(exame.raioMin, exame.raioAlvo * (1 - dt));
    if (teclas.has("tras")) exame.raioAlvo = Math.min(exame.raioMax, exame.raioAlvo * (1 + dt));
    if (teclas.size) exame.girando = false;
    if (exame.girando && !reduzirMovimento) exame.thetaAlvo += GIRO_AUTOMATICO * dt;

    const k = suavizar(dt, 6);
    exame.theta += (exame.thetaAlvo - exame.theta) * k;
    exame.phi += (exame.phiAlvo - exame.phi) * k;
    exame.raio += (exame.raioAlvo - exame.raio) * k;

    const c = exame.peca.centro;
    destino.set(
      c.x + exame.raio * Math.sin(exame.phi) * Math.sin(exame.theta),
      c.y + exame.raio * Math.cos(exame.phi),
      c.z + exame.raio * Math.sin(exame.phi) * Math.cos(exame.theta)
    );
    // Não atravessa paredes ao girar em volta de uma obra perto da parede.
    const { xMin, xMax, zMin, zMax } = sala.limites;
    destino.x = THREE.MathUtils.clamp(destino.x, xMin + 0.12, xMax - 0.12);
    destino.z = THREE.MathUtils.clamp(destino.z, zMin + 0.12, zMax - 0.12);
  }

  function atualizar(dt) {
    if (modo === "andar") atualizarAndar(dt);
    else atualizarExame(dt);

    // Durante uma transição, a câmera desliza até a pose desejada; fora dela, segue direto.
    const emTransicao = transicao > 0;
    transicao = Math.max(0, transicao - dt);
    const kPosicao = emTransicao ? suavizar(dt, 3.2) : modo === "andar" ? suavizar(dt, 5) : 1;
    camera.position.lerp(destino, kPosicao);

    if (modo === "obra") {
      matriz.lookAt(camera.position, exame.peca.centro, camera.up);
      quatDestino.setFromRotationMatrix(matriz);
    }
    camera.quaternion.slerp(quatDestino, emTransicao ? suavizar(dt, 3.6) : 1);

    // Desloca a imagem para a obra não ficar atrás do painel.
    deslocamento.atual.lerp(deslocamento.alvo, suavizar(dt, 4));
    const w = elemento.clientWidth;
    const h = elemento.clientHeight;
    if (deslocamento.atual.lengthSq() > 0.25) {
      camera.setViewOffset(w, h, -deslocamento.atual.x, -deslocamento.atual.y, w, h);
    } else if (camera.view?.enabled) {
      camera.clearViewOffset();
    }
  }

  return {
    atualizar,
    examinar,
    voltarAAndar,
    get modo() {
      return modo;
    },
  };
}
