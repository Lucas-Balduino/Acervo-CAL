/*
  sobre-fotogrametria.js — o 3D da seção "Outro caminho" da página Sobre: o Cangaceiro (CAL.0624)
  com o caminho do vídeo em volta dele (uma espiral de quadros, com um celular que percorre o
  caminho) e a troca entre as cores como saíram do aplicativo e as cores com a luz ajustada.
  Não cuida do texto nem dos botões da página (isso está em sobre.js).
*/

import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

const MODELO = "models/cal-0624/modelo.glb";
// Textura original do KIRI Engine (2048 px), no mesmo mapa de UV do modelo do site.
const TEXTURA_DO_APP = "img/processo/cangaceiro-textura-app.jpg";
const FRENTE_GRAUS = 90; // o mesmo "frente" de data/obras.json
const CAMPO_DE_VISAO = 30;
const FUNDO = 0xefe8dc;
const AZUL = 0x1d5c86;

// Caminho do vídeo: espiral em volta da peça, de baixo para cima (medidas em metros).
const CAMINHO = { voltas: 3, quadrosPorVolta: 22, raio: 0.52, baixo: 0.14, alto: 0.8, segundosPorVolta: 4.5 };
const QUADRO = { largura: 0.045, altura: 0.08 };
const GIRO = 0.18; // rad/s, giro lento da peça

export async function criarFotogrametria(palco, { leve = false, movimentoReduzido = false } = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, leve ? 1.5 : 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.setClearColor(FUNDO);
  const tela = renderer.domElement;
  tela.setAttribute("role", "img");
  tela.setAttribute("aria-label", "O Cangaceiro em 3D, com os quadros do vídeo de celular dispostos em espiral em volta dele");
  palco.prepend(tela);

  const cena = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  cena.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  cena.environmentIntensity = 0.8;
  const luz = new THREE.DirectionalLight(0xffffff, 0.9);
  luz.position.set(-1, 2, 1.5);
  cena.add(luz);

  const camera = new THREE.PerspectiveCamera(CAMPO_DE_VISAO, 1, 0.01, 20);
  const suporte = new THREE.Group(); // gira a peça junto com o caminho
  cena.add(suporte);

  // ----- Modelo e as duas texturas -----
  const loader = new GLTFLoader();
  const draco = new DRACOLoader();
  draco.setDecoderPath("https://cdn.jsdelivr.net/npm/three@0.169.0/examples/jsm/libs/draco/gltf/");
  loader.setDRACOLoader(draco);
  const [gltf, texturaDoApp] = await Promise.all([
    loader.loadAsync(MODELO),
    new THREE.TextureLoader().loadAsync(TEXTURA_DO_APP),
  ]);
  draco.dispose();

  const modelo = gltf.scene;
  const ajuste = new THREE.Group();
  ajuste.add(modelo);
  ajuste.rotation.y = -THREE.MathUtils.degToRad(FRENTE_GRAUS); // frente para a câmera
  suporte.add(ajuste);
  cena.updateMatrixWorld(true);
  const caixa = new THREE.Box3().setFromObject(modelo, true); // vértice a vértice (o nó tem rotação)
  const centroCaixa = caixa.getCenter(new THREE.Vector3());
  ajuste.position.set(-centroCaixa.x, -caixa.min.y, -centroCaixa.z);
  const altura = caixa.max.y - caixa.min.y;

  let malha = null;
  modelo.traverse((o) => {
    if (o.isMesh && !malha) malha = o;
  });
  const texturaAjustada = malha.material.map;
  texturaDoApp.flipY = false; // glTF guarda as texturas de cima para baixo
  texturaDoApp.colorSpace = THREE.SRGBColorSpace;
  texturaDoApp.wrapS = texturaAjustada.wrapS;
  texturaDoApp.wrapT = texturaAjustada.wrapT;
  texturaDoApp.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());

  // ----- Caminho do vídeo -----
  const totalDeQuadros = CAMINHO.voltas * CAMINHO.quadrosPorVolta;
  const pontoDoCaminho = (t, alvo = new THREE.Vector3()) => {
    const angulo = t * CAMINHO.voltas * Math.PI * 2;
    const y = THREE.MathUtils.lerp(CAMINHO.baixo, CAMINHO.alto, t) * (altura / 0.8);
    return alvo.set(Math.sin(angulo) * CAMINHO.raio, y, Math.cos(angulo) * CAMINHO.raio);
  };
  // Para onde o celular aponta: o eixo da peça, um pouco abaixo da altura dele.
  const miraDoCaminho = (posicao, alvo = new THREE.Vector3()) =>
    alvo.set(0, THREE.MathUtils.clamp(posicao.y * 0.75 + altura * 0.12, altura * 0.15, altura * 0.85), 0);

  const linha = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(Array.from({ length: 361 }, (_, i) => pontoDoCaminho(i / 360))),
    new THREE.LineBasicMaterial({ color: AZUL, transparent: true, opacity: 0.25 }),
  );
  suporte.add(linha);

  const contorno = new THREE.BufferGeometry().setFromPoints([
    [-1, -1], [1, -1], [1, 1], [-1, 1], [-1, -1],
  ].map(([x, y]) => new THREE.Vector3((x * QUADRO.largura) / 2, (y * QUADRO.altura) / 2, 0)));
  const quadros = [];
  const mira = new THREE.Vector3();
  for (let i = 0; i < totalDeQuadros; i++) {
    const t = i / (totalDeQuadros - 1);
    const quadro = new THREE.Line(contorno, new THREE.LineBasicMaterial({ color: AZUL, transparent: true, opacity: 0.2 }));
    pontoDoCaminho(t, quadro.position);
    quadro.lookAt(miraDoCaminho(quadro.position, mira));
    quadro.userData.t = t;
    suporte.add(quadro);
    quadros.push(quadro);
  }

  // O celular que percorre o caminho: corpo azul e tela clara.
  const celular = new THREE.Group();
  const corpo = new THREE.Mesh(
    new THREE.PlaneGeometry(QUADRO.largura * 1.25, QUADRO.altura * 1.2),
    new THREE.MeshBasicMaterial({ color: AZUL, side: THREE.DoubleSide }),
  );
  const visor = new THREE.Mesh(
    new THREE.PlaneGeometry(QUADRO.largura * 1.05, QUADRO.altura * 0.98),
    new THREE.MeshBasicMaterial({ color: 0xdbe9f4, side: THREE.DoubleSide }),
  );
  visor.position.z = -0.001; // lookAt aponta +z para a peça: a tela fica para fora, do lado de quem filma
  celular.add(corpo, visor);
  suporte.add(celular);

  // ----- Arrastar para girar (só na horizontal: no celular, a rolagem vertical continua) -----
  let giroUsuario = 0;
  let velocidade = 0;
  let arrastando = false;
  let ultimoX = 0;
  tela.addEventListener("pointerdown", (e) => {
    arrastando = true;
    ultimoX = e.clientX;
    velocidade = 0;
    tela.setPointerCapture(e.pointerId);
  });
  tela.addEventListener("pointermove", (e) => {
    if (!arrastando) return;
    const dx = e.clientX - ultimoX;
    ultimoX = e.clientX;
    giroUsuario += dx * 0.008;
    velocidade = dx * 0.5;
  });
  const soltar = () => (arrastando = false);
  tela.addEventListener("pointerup", soltar);
  tela.addEventListener("pointercancel", soltar);

  // ----- Tamanho: a peça e o caminho inteiros na tela -----
  const olhar = new THREE.Vector3(0, altura * 0.5, 0);
  function redimensionar() {
    const { clientWidth: w, clientHeight: h } = palco;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    const meiaTangente = Math.tan(THREE.MathUtils.degToRad(CAMPO_DE_VISAO) / 2);
    const largura = (CAMINHO.raio + QUADRO.largura) * 2;
    const alturaDaCena = altura * 1.12;
    const distancia = Math.max(alturaDaCena / 2 / meiaTangente, largura / 2 / (meiaTangente * camera.aspect)) * 1.15;
    const elevacao = THREE.MathUtils.degToRad(16);
    camera.position.set(0, olhar.y + Math.sin(elevacao) * distancia, Math.cos(elevacao) * distancia);
    camera.lookAt(olhar);
  }
  new ResizeObserver(redimensionar).observe(palco);
  redimensionar();

  // ----- Quadro a quadro -----
  const relogio = new THREE.Clock();
  let tempo = 0;
  let giroAutomatico = 0;
  let pausa = 0; // segundos sem giro automático (depois de virar a peça de costas)
  let virada = null; // { de, para, t }: a peça virando de costas, com curva suave
  function atualizar(dt) {
    tempo += dt;
    if (!arrastando) {
      giroUsuario += (velocidade * dt) / 60;
      velocidade *= Math.exp(-dt * 4);
    }
    pausa = Math.max(0, pausa - dt);
    if (!movimentoReduzido && !pausa && !virada) giroAutomatico += dt * GIRO;
    if (virada) {
      virada.t = Math.min(1, virada.t + dt / 1.6);
      if (arrastando || virada.t === 1) {
        giroUsuario = (arrastando ? suporte.rotation.y : virada.para) - giroAutomatico;
        virada = null;
      }
    }
    suporte.rotation.y = virada
      ? THREE.MathUtils.lerp(virada.de, virada.para, THREE.MathUtils.smootherstep(virada.t, 0, 1))
      : giroUsuario + giroAutomatico;

    // O celular dá as voltas; os quadros por onde ele acabou de passar acendem e vão apagando.
    const t = movimentoReduzido ? 1 : (tempo / (CAMINHO.segundosPorVolta * CAMINHO.voltas)) % 1;
    pontoDoCaminho(t, celular.position);
    celular.lookAt(miraDoCaminho(celular.position, mira));
    for (const quadro of quadros) {
      const atras = (t - quadro.userData.t + 1) % 1;
      quadro.material.opacity = movimentoReduzido ? 0.55 : 0.18 + 0.72 * Math.exp(-atras * 5);
    }
  }

  let rodando = false;
  function desenhar() {
    if (!rodando) return;
    atualizar(Math.min(relogio.getDelta(), 0.1));
    renderer.render(cena, camera);
    requestAnimationFrame(desenhar);
  }
  function ligar(sim) {
    if (sim === rodando) return;
    rodando = sim;
    if (sim) {
      relogio.getDelta();
      requestAnimationFrame(desenhar);
    }
  }

  function definirTextura(nome) {
    malha.material.map = nome === "app" ? texturaDoApp : texturaAjustada;
    malha.material.needsUpdate = true;
    if (!rodando) renderer.render(cena, camera);
  }

  // A diferença entre as texturas está nas costas: vira a peça de costas (pelo caminho mais curto)
  // e segura um pouco ali antes de voltar a girar.
  function mostrarCostas() {
    const atual = suporte.rotation.y;
    const costas = Math.PI + Math.PI * 2 * Math.round((atual - Math.PI) / (Math.PI * 2));
    pausa = 5;
    if (Math.abs(costas - atual) < 0.35) return;
    if (movimentoReduzido) {
      giroUsuario = costas - giroAutomatico;
      return;
    }
    virada = { de: atual, para: costas, t: 0 };
  }

  definirTextura("app");
  atualizar(0);
  renderer.render(cena, camera);
  return { ligar, definirTextura, mostrarCostas, camera, cena };
}
