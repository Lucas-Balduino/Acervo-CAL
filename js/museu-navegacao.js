/*
  museu-navegacao.js — câmera do museu virtual, com dois modos:

  ANDAR (primeira pessoa)
    Computador: arrastar olha em volta; clicar no chão anda até lá; clicar numa
    obra a examina; W A S D ou setas caminham; roda do mouse anda. A vista
    acompanha levemente o cursor, mesmo sem clicar.
    Celular: arrastar olha; tocar no chão anda; tocar numa obra a examina.

  EXAMINAR (como no visualizador da obra)
    A câmera orbita a obra: arrastar gira, roda do mouse ou pinça aproxima,
    duplo clique volta à vista inicial, setas giram. A obra gira devagar
    sozinha até a primeira interação.

  Sensação inspirada em https://www.magische-spiegelungen.de/: pouca
  sensibilidade, movimento amortecido com inércia ao soltar, e transições com
  duração fixa (2 a 2,6 s) que começam e terminam devagar.

  Não monta a sala nem mostra textos: avisa museu.js pelos callbacks.
*/

import * as THREE from "three";

const ALTURA_OLHOS = 1.6;
const VELOCIDADE = 1.6; // m/s nas teclas
const GIRO = 1.1; // rad/s nas setas ← →
const SENSIBILIDADE_OLHAR = 0.0009; // rad por pixel arrastado (andar): 300 px ≈ 15°
const SENSIBILIDADE_ORBITA = 0.0045; // rad por pixel arrastado (examinar): 300 px ≈ 77°
const SUAVIDADE_OLHAR = 5; // quanto maior, mais rápido a vista alcança o arraste
const ATRITO_INERCIA = 6; // quanto maior, mais rápido a inércia para
const LIMITE_OLHAR = 0.7; // rad para cima/baixo
const BALANCO_CURSOR = { yaw: 0.035, pitch: 0.02 }; // rad: quanto a vista segue o cursor
const FOLGA_PAREDE = 0.45; // m
const FOLGA_PEDESTAL = 0.35; // m
const GIRO_AUTOMATICO = 0.15; // rad/s ao examinar, até a primeira interação

// Durações das transições (segundos)
const DURACAO = { examinar: 2.2, entreObras: 2.6, voltar: 1.8 };

const reduzirMovimento = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Começa devagar, acelera no meio e chega devagar. */
const suaveEntradaSaida = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

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

  // Modo andar: alvo (para onde o visitante quer olhar) e valor atual (amortecido).
  const andar = { posicao: new THREE.Vector3(0, ALTURA_OLHOS, -0.5), yaw: 0, pitch: -0.1 };
  let yaw = andar.yaw;
  let pitch = andar.pitch;
  const balanco = { alvo: new THREE.Vector2(), atual: new THREE.Vector2() };

  // Modo examinar
  const exame = {
    peca: null,
    theta: 0, phi: 1.32, raio: 1,
    thetaAlvo: 0, phiAlvo: 1.32, raioAlvo: 1,
    raioMin: 0.3, raioMax: 3,
    thetaInicial: 0, raioInicial: 1,
    girando: false,
    esperaGiro: 0, // segundos até o giro automático começar
  };

  // Inércia depois de soltar o arraste (rad/s), nos dois modos.
  const inercia = { x: 0, y: 0 };

  // Deslocamento da imagem (px) para abrir espaço ao painel da obra.
  const deslocamento = { atual: new THREE.Vector2(), alvo: new THREE.Vector2() };

  // Transição com duração fixa: parte da pose atual da câmera até a pose desejada.
  let transicao = null; // { t, duracao, posicao, quaternion, deslocamento, arco }

  camera.position.copy(andar.posicao);
  camera.rotation.set(pitch, yaw, 0, "YXZ");

  const teclas = new Set();
  const raio = new THREE.Raycaster();
  const ponteiro = new THREE.Vector2();
  const piso = sala.cena.getObjectByName("piso");

  function iniciarTransicao(duracao, arco = 0) {
    transicao = {
      t: 0,
      duracao: reduzirMovimento ? 0.01 : duracao,
      posicao: camera.position.clone(),
      quaternion: camera.quaternion.clone(),
      deslocamento: deslocamento.atual.clone(),
      arco,
    };
  }

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
  let arraste = null; // { moveu, x, y, tempo, vx, vy }
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
    inercia.x = inercia.y = 0;
    if (ponteiros.size === 1) {
      arraste = { moveu: false, x: evento.clientX, y: evento.clientY, tempo: evento.timeStamp, vx: 0, vy: 0 };
    } else if (ponteiros.size === 2) {
      arraste = null;
      pinca = { distancia: distanciaDaPinca(), raio: exame.raioAlvo };
    }
  });

  elemento.addEventListener("pointermove", (evento) => {
    if (evento.pointerType === "mouse") {
      const r = elemento.getBoundingClientRect();
      balanco.alvo.set(((evento.clientX - r.left) / r.width) * 2 - 1, ((evento.clientY - r.top) / r.height) * 2 - 1);
    }

    if (ponteiros.has(evento.pointerId)) {
      ponteiros.set(evento.pointerId, { x: evento.clientX, y: evento.clientY });

      if (pinca && ponteiros.size === 2) {
        if (modo === "obra") {
          exame.raioAlvo = THREE.MathUtils.clamp(
            pinca.raio * (pinca.distancia / Math.max(distanciaDaPinca(), 1)),
            exame.raioMin,
            exame.raioMax
          );
          pararGiro();
        }
        return;
      }

      if (arraste) {
        const dx = evento.clientX - arraste.x;
        const dy = evento.clientY - arraste.y;
        if (!arraste.moveu && Math.hypot(dx, dy) < 6) return;
        arraste.moveu = true;

        const sensibilidade = modo === "obra" ? SENSIBILIDADE_ORBITA : SENSIBILIDADE_OLHAR;
        const ax = dx * sensibilidade;
        const ay = dy * sensibilidade;
        // Velocidade do arraste (rad/s), para a inércia ao soltar.
        const dt = Math.max((evento.timeStamp - arraste.tempo) / 1000, 1 / 240);
        arraste.vx = arraste.vx * 0.6 + (ax / dt) * 0.4;
        arraste.vy = arraste.vy * 0.6 + (ay / dt) * 0.4;
        arraste.x = evento.clientX;
        arraste.y = evento.clientY;
        arraste.tempo = evento.timeStamp;
        elemento.classList.add("arrastando");
        girarPor(ax, ay);
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

  /** Aplica um giro (rad) vindo do arraste ou da inércia. */
  function girarPor(ax, ay) {
    if (modo === "obra") {
      exame.thetaAlvo -= ax;
      exame.phiAlvo = THREE.MathUtils.clamp(exame.phiAlvo - ay, 0.35, 1.62);
      pararGiro();
    } else {
      andar.yaw += ax;
      andar.pitch = THREE.MathUtils.clamp(andar.pitch + ay, -LIMITE_OLHAR, LIMITE_OLHAR);
    }
  }

  function soltar(evento) {
    if (!ponteiros.has(evento.pointerId)) return;
    ponteiros.delete(evento.pointerId);
    if (ponteiros.size < 2) pinca = null;
    const foiClique = arraste && !arraste.moveu && evento.type === "pointerup";
    if (arraste?.moveu && evento.timeStamp - arraste.tempo < 80) {
      // Soltou ainda em movimento: continua girando e para aos poucos.
      inercia.x = THREE.MathUtils.clamp(arraste.vx, -2.5, 2.5);
      inercia.y = THREE.MathUtils.clamp(arraste.vy, -1.5, 1.5);
    }
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
        const destinoNoPiso = restringir(new THREE.Vector3(noPiso.point.x, ALTURA_OLHOS, noPiso.point.z));
        const distancia = destinoNoPiso.distanceTo(andar.posicao);
        andar.posicao.copy(destinoNoPiso);
        iniciarTransicao(THREE.MathUtils.clamp(0.9 + distancia * 0.45, 1.1, 3));
        eventos.aoAndar();
      }
    }
  }
  elemento.addEventListener("pointerup", soltar);
  elemento.addEventListener("pointercancel", soltar);
  elemento.addEventListener("pointerleave", () => {
    balanco.alvo.set(0, 0);
    eventos.aoPassar(-1, 0, 0);
  });

  elemento.addEventListener("dblclick", () => {
    if (modo === "obra") vistaInicialDoExame();
  });

  elemento.addEventListener(
    "wheel",
    (evento) => {
      evento.preventDefault();
      if (modo === "obra") {
        exame.raioAlvo = THREE.MathUtils.clamp(
          exame.raioAlvo * Math.exp(evento.deltaY * 0.0008),
          exame.raioMin,
          exame.raioMax
        );
        pararGiro();
        return;
      }
      const passo = THREE.MathUtils.clamp(-evento.deltaY * 0.003, -0.6, 0.6);
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
    if (modo === "andar" && !teclas.has(acao)) {
      transicao = null; // as teclas assumem o controle
      eventos.aoAndar();
    }
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

  function pararGiro() {
    exame.girando = false;
    exame.esperaGiro = Infinity;
  }

  /**
   * @param {object} peca
   * @param {object} opcoes
   * @param {number} opcoes.ocupacao  fração da altura da tela que a obra deve ocupar
   * @param {{x:number,y:number}} opcoes.deslocamento  px para mover a obra na tela (abre espaço ao painel)
   */
  function examinar(peca, { ocupacao = 0.7, deslocamento: d = { x: 0, y: 0 } } = {}) {
    const deOutraObra = modo === "obra";
    modo = "obra";
    exame.peca = peca;
    exame.thetaInicial = Math.atan2(peca.direcao.x, peca.direcao.z);
    exame.raioInicial = raioParaCaber(peca, ocupacao);
    exame.raioMin = Math.max(peca.tamanho.length() / 2 + 0.06, 0.18);
    exame.raioMax = Math.max(exame.raioInicial * 2.5, 1.2);
    deslocamento.alvo.set(d.x, d.y);

    // Vai direto para a vista de frente; o caminho até lá é a transição suave.
    exame.theta = exame.thetaAlvo = exame.thetaInicial;
    exame.phi = exame.phiAlvo = 1.32;
    exame.raio = exame.raioAlvo = exame.raioInicial;
    exame.girando = false;
    exame.esperaGiro = 1.2; // começa a girar sozinha pouco depois de chegar
    inercia.x = inercia.y = 0;
    teclas.clear();

    const distancia = camera.position.distanceTo(peca.centro);
    iniciarTransicao(deOutraObra ? DURACAO.entreObras : DURACAO.examinar, deOutraObra ? Math.min(0.3, distancia * 0.06) : 0);
  }

  function vistaInicialDoExame() {
    // Gira pelo caminho mais curto até a frente.
    exame.thetaAlvo =
      exame.theta + Math.atan2(Math.sin(exame.thetaInicial - exame.theta), Math.cos(exame.thetaInicial - exame.theta));
    exame.phiAlvo = 1.32;
    exame.raioAlvo = exame.raioInicial;
    inercia.x = inercia.y = 0;
  }

  /** Volta a andar, em frente à obra que estava sendo examinada. */
  function voltarAAndar() {
    if (modo !== "obra") return;
    const peca = exame.peca;
    modo = "andar";
    deslocamento.alvo.set(0, 0);
    inercia.x = inercia.y = 0;

    const p = peca.posicao.clone().addScaledVector(peca.direcao, 1.5);
    andar.posicao.set(p.x, ALTURA_OLHOS, p.z);
    restringir(andar.posicao);
    const alvo = peca.centro;
    andar.yaw = Math.atan2(-(alvo.x - andar.posicao.x), -(alvo.z - andar.posicao.z));
    andar.pitch = Math.atan2(alvo.y - ALTURA_OLHOS, Math.hypot(alvo.x - andar.posicao.x, alvo.z - andar.posicao.z));
    yaw = andar.yaw;
    pitch = andar.pitch;
    iniciarTransicao(DURACAO.voltar);
  }

  /* ----- Atualização a cada quadro ----- */

  const frente = new THREE.Vector3();
  const lado = new THREE.Vector3();
  const destino = new THREE.Vector3();
  const quatDestino = new THREE.Quaternion();
  const matriz = new THREE.Matrix4();
  const euler = new THREE.Euler(0, 0, 0, "YXZ");

  const suavizar = (dt, velocidade) => (reduzirMovimento ? 1 : 1 - Math.exp(-dt * velocidade));

  function aplicarInercia(dt) {
    if (arraste || (Math.abs(inercia.x) < 1e-3 && Math.abs(inercia.y) < 1e-3)) return;
    girarPor(inercia.x * dt, inercia.y * dt);
    const fator = Math.exp(-dt * ATRITO_INERCIA);
    inercia.x *= fator;
    inercia.y *= fator;
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
    }
    const k = suavizar(dt, SUAVIDADE_OLHAR);
    yaw += (andar.yaw - yaw) * k;
    pitch += (andar.pitch - pitch) * k;

    // Balanço leve seguindo o cursor (não no celular nem com movimento reduzido).
    if (!reduzirMovimento) balanco.atual.lerp(arraste ? balanco.atual : balanco.alvo, suavizar(dt, 1.5));
    destino.copy(andar.posicao);
    quatDestino.setFromEuler(
      euler.set(pitch - balanco.atual.y * BALANCO_CURSOR.pitch, yaw - balanco.atual.x * BALANCO_CURSOR.yaw, 0)
    );
  }

  function atualizarExame(dt) {
    if (teclas.has("girarEsq") || teclas.has("esquerda")) exame.thetaAlvo -= GIRO * dt;
    if (teclas.has("girarDir") || teclas.has("direita")) exame.thetaAlvo += GIRO * dt;
    if (teclas.has("frente")) exame.raioAlvo = Math.max(exame.raioMin, exame.raioAlvo * (1 - dt * 0.6));
    if (teclas.has("tras")) exame.raioAlvo = Math.min(exame.raioMax, exame.raioAlvo * (1 + dt * 0.6));
    if (teclas.size) pararGiro();

    if (!transicao && !exame.girando && exame.esperaGiro !== Infinity) {
      exame.esperaGiro -= dt;
      if (exame.esperaGiro <= 0) exame.girando = true;
    }
    if (exame.girando && !reduzirMovimento) exame.thetaAlvo += GIRO_AUTOMATICO * dt;

    const k = suavizar(dt, 4);
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
    matriz.lookAt(destino, c, camera.up);
    quatDestino.setFromRotationMatrix(matriz);
  }

  function atualizar(dt) {
    aplicarInercia(dt);
    if (modo === "andar") atualizarAndar(dt);
    else atualizarExame(dt);

    if (transicao) {
      transicao.t = Math.min(1, transicao.t + dt / transicao.duracao);
      const e = suaveEntradaSaida(transicao.t);
      camera.position.lerpVectors(transicao.posicao, destino, e);
      camera.position.y += transicao.arco * Math.sin(Math.PI * e); // leve arco ao viajar entre obras
      camera.quaternion.slerpQuaternions(transicao.quaternion, quatDestino, e);
      deslocamento.atual.lerpVectors(transicao.deslocamento, deslocamento.alvo, e);
      if (transicao.t >= 1) transicao = null;
    } else {
      camera.position.lerp(destino, modo === "andar" ? suavizar(dt, 3.5) : 1);
      camera.quaternion.copy(quatDestino);
      deslocamento.atual.copy(deslocamento.alvo);
    }

    // Desloca a imagem para a obra não ficar atrás do painel.
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
    get emTransicao() {
      return transicao !== null;
    },
  };
}
