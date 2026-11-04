/*
  sobre-cena.js — o 3D da página "Sobre o processo". Carrega a moringa (CAL.0607) e mostra a
  mesma peça em cada etapa: a nuvem de pontos sendo escaneada, as duas capturas se juntando,
  a malha de triângulos, a textura desdobrada, o ajuste no Blender e o modelo final.
  Cada etapa é uma lista de valores-alvo (ETAPAS); a cena desliza suavemente até eles.
  Não cuida da rolagem nem do texto da página (isso está em sobre.js).
*/

import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { MeshSurfaceSampler } from "three/addons/math/MeshSurfaceSampler.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

const MODELO = "models/cal-0607/modelo.glb";
const FRENTE_GRAUS = 90; // o mesmo "frente" de data/obras.json: vira a obra de frente para a câmera
const CAMPO_DE_VISAO = 30;

const CORES = {
  laser: new THREE.Color(0x4da3ff),
  segundaCaptura: new THREE.Color(0xf0a050),
  argila: 0xd8d2c8,
  arame: 0x6fb2ff,
  grade: 0x5a5a5a,
  eixoX: 0xff3352, // como no Blender: X vermelho, Y verde
  eixoY: 0x8bdc00,
};

/* ---------- Etapas ---------- */

// Valores de partida; cada etapa muda só o que precisa.
// enquadrar: altura (m) que precisa caber na tela · alvoY: fração da altura da obra para onde a câmera olha
// giro: velocidade do giro automático (rad/s); 0 deixa a obra parada de frente (mais "rumo")
const PADRAO = {
  fundo: "#efe8dc",
  enquadrar: 0.62,
  alvoY: 0.5,
  alvoX: 0,
  elevacao: 0.14,
  giro: 0.25,
  rumo: 0,
  pontos: 0,
  varredura: 1,
  laser: 0,
  scanner: 0,
  segunda: 0,
  uniao: 1,
  argila: 0,
  arame: 0,
  textura: 1,
  desdobrar: 0,
  blender: 1,
  grade: 0,
};

// Trecho [a, b] da rolagem da etapa (p vai de 0 a 1) convertido em 0 → 1, com curva suave.
const faixa = (p, a, b) => THREE.MathUtils.smoothstep(p, a, b);
const misturar = THREE.MathUtils.lerp;

const ETAPAS = {
  obra: () => ({ varredura: 0 }),
  captura: (p) => ({
    fundo: "#0f1720", enquadrar: 0.9, elevacao: 0.3, giro: 0, textura: 0,
    pontos: 1, scanner: 1, laser: 1, varredura: faixa(p, 0.04, 0.88), uniao: 0,
  }),
  projetos: (p) => {
    const uniao = faixa(p, 0.2, 0.8);
    return {
      fundo: "#0f1720", giro: 0, textura: 0, pontos: 1, segunda: 1, uniao,
      enquadrar: misturar(1.0, 0.66, uniao), alvoX: misturar(0.24, 0, uniao), elevacao: 0.18,
    };
  },
  malha: (p) => {
    const zoom = faixa(p, 0.08, 0.85);
    return {
      fundo: "#1e2429", giro: 0.1, textura: 0, argila: 1, arame: 1,
      enquadrar: misturar(0.62, 0.15, zoom), alvoY: misturar(0.5, 0.84, zoom), elevacao: misturar(0.14, 0.3, zoom),
    };
  },
  textura: (p) => {
    const aberta = faixa(p, 0.15, 0.45) * (1 - faixa(p, 0.7, 0.95));
    return {
      fundo: "#ececec", giro: 0, argila: 1, textura: faixa(p, 0, 0.12), desdobrar: aberta,
      enquadrar: misturar(0.62, 0.72, aberta), elevacao: misturar(0.14, 0, aberta),
    };
  },
  blender: (p) => ({
    fundo: "#3d3d3d", giro: 0, rumo: 0.6, grade: 1, blender: faixa(p, 0.12, 0.8),
    enquadrar: 0.92, elevacao: 0.42, alvoY: 0.3,
  }),
  web: () => ({ fundo: "#ececec", giro: 0.35 }),
  site: () => ({ enquadrar: 0.76, alvoY: 0.4 }), // peça um pouco acima, para caber os botões de camada
};

// Camadas que a pessoa escolhe na última etapa.
const CAMADAS = {
  pontos: { pontos: 1, textura: 0 },
  malha: { argila: 1, arame: 1, textura: 0, enquadrar: 0.32, alvoY: 0.72, elevacao: 0.25 }, // de perto, para ver os triângulos
  textura: {},
};

// Valores que seguem a rolagem de perto (os outros deslizam mais devagar).
const RAPIDOS = new Set(["varredura", "uniao", "desdobrar", "blender"]);

/* ---------- Cena ---------- */

/**
 * Cria a cena dentro de `palco` e carrega a moringa.
 * @param {HTMLElement} palco
 * @param {{ leve?: boolean, movimentoReduzido?: boolean }} opcoes
 */
export async function criarCena(palco, { leve = false, movimentoReduzido = false } = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, leve ? 1.5 : 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.domElement.setAttribute("role", "img");
  renderer.domElement.setAttribute("aria-label", "Moringa com dois bicos em 3D, mostrada na etapa atual do processo");
  palco.prepend(renderer.domElement);

  const cena = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  cena.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  cena.environmentIntensity = 0.8;
  const luz = new THREE.DirectionalLight(0xffffff, 0.9);
  luz.position.set(-1, 2, 1.5);
  cena.add(luz);

  const camera = new THREE.PerspectiveCamera(CAMPO_DE_VISAO, 1, 0.01, 20);
  // Névoa da cor do fundo: faz a grade do Blender sumir aos poucos na distância.
  cena.fog = new THREE.Fog(0x000000, 1, 4);

  // suporte (gira a obra) → pivo (ajuste do Blender) → ajuste (apoia a base em y = 0) → modelo
  const suporte = new THREE.Group();
  const pivo = new THREE.Group();
  const ajuste = new THREE.Group();
  cena.add(suporte);
  suporte.add(pivo);
  pivo.add(ajuste);

  const grade = montarGrade();
  cena.add(grade);

  // ----- Modelo -----
  const loader = new GLTFLoader();
  const draco = new DRACOLoader();
  draco.setDecoderPath("https://cdn.jsdelivr.net/npm/three@0.169.0/examples/jsm/libs/draco/gltf/");
  loader.setDRACOLoader(draco);
  const gltf = await loader.loadAsync(MODELO);
  draco.dispose();

  const modelo = gltf.scene;
  ajuste.add(modelo);
  const caixa = new THREE.Box3().setFromObject(modelo, true); // vértice a vértice (o nó tem rotação)
  const centroCaixa = caixa.getCenter(new THREE.Vector3());
  modelo.position.set(-centroCaixa.x, -caixa.min.y, -centroCaixa.z);
  const altura = caixa.max.y - caixa.min.y;
  const centro = new THREE.Vector3(0, altura / 2, 0);
  cena.updateMatrixWorld(true);

  let malha = null;
  modelo.traverse((o) => {
    if (o.isMesh && !malha) malha = o;
  });
  const materialTextura = malha.material;
  materialTextura.transparent = false;
  materialTextura.fog = false;
  malha.renderOrder = 1;

  const materialArgila = new THREE.MeshStandardMaterial({
    color: CORES.argila, roughness: 0.85, metalness: 0, fog: false,
    polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1,
  });
  const materialArame = new THREE.MeshBasicMaterial({
    color: CORES.arame, wireframe: true, transparent: true, opacity: 0.35, depthWrite: false, fog: false,
  });
  const argila = new THREE.Mesh(malha.geometry, materialArgila);
  const arame = new THREE.Mesh(malha.geometry, materialArame);
  arame.renderOrder = 2;
  // Irmãs da malha original, na mesma posição (como filhas, sumiriam junto quando a textura some).
  for (const copia of [argila, arame]) {
    copia.position.copy(malha.position);
    copia.quaternion.copy(malha.quaternion);
    copia.scale.copy(malha.scale);
    malha.parent.add(copia);
  }
  cena.updateMatrixWorld(true);

  // Trocas de camada sem transparência: cada superfície aparece de baixo para cima (ver aplicarCorte).
  const corteTextura = aplicarCorte(materialTextura);
  const corteArgila = aplicarCorte(materialArgila);
  const corteArame = aplicarCorte(materialArame);

  // Direções "de frente para a câmera" no espaço do suporte (a obra fica girada em -frente).
  const frente = THREE.MathUtils.degToRad(FRENTE_GRAUS);
  const paraCamera = new THREE.Vector3(Math.sin(frente), 0, Math.cos(frente));
  const direita = new THREE.Vector3(Math.cos(frente), 0, -Math.sin(frente));

  prepararDesdobramento(malha, [malha, argila, arame], materialTextura.map, centro, altura, paraCamera, direita);

  const pontos = montarNuvem(malha, materialTextura.map, altura, leve ? 35000 : 70000);
  pontos.material.uniforms.uCentro.value.copy(centro);
  pontos.material.uniforms.uEixo.value.copy(paraCamera);
  pontos.material.uniforms.uDeslocamento.value.copy(direita).multiplyScalar(0.48);
  pontos.material.uniforms.uInicio.value = Math.atan2(paraCamera.x, paraCamera.z) - 0.7;
  suporte.add(pontos);

  const scanner = montarScanner();
  suporte.add(scanner);

  // Rotação original (do Blender) e a "crua", de quando o modelo sai do scanner.
  const rotacaoCrua = malha.getWorldQuaternion(new THREE.Quaternion()).invert();
  const deslocamentoCru = new THREE.Vector3(0.16, 0.12, -0.12);

  // ----- Estado -----
  const atual = { ...PADRAO, fundo: new THREE.Color(PADRAO.fundo) };
  let alvo = { ...PADRAO };
  let camada = "textura";
  let etapaAtual = "obra";
  let anguloObra = -frente;
  let giroUsuario = 0;
  let velocidadeArrasto = 0;
  let arrastando = false;
  const corAlvo = new THREE.Color();

  function definirEtapa(nome, progresso = 0) {
    etapaAtual = nome;
    const p = THREE.MathUtils.clamp(progresso, 0, 1);
    alvo = { ...PADRAO, ...(ETAPAS[nome]?.(p) ?? {}) };
    if (nome === "site") Object.assign(alvo, CAMADAS[camada]);
    if (movimentoReduzido) alvo.giro = 0;
  }

  // Rolar a página empurra o giro da obra (só nas etapas em que ela gira sozinha):
  // ~100 px de rolagem dão uns 20° a mais, que vão freando aos poucos.
  function empurrarGiro(pixels) {
    // Saltos grandes (clicar numa etapa distante) não contam como rolagem.
    if (alvo.giro <= 0 || movimentoReduzido || arrastando || Math.abs(pixels) > 600) return;
    velocidadeArrasto = THREE.MathUtils.clamp(velocidadeArrasto + pixels * 0.01, -8, 8);
  }

  function definirCamada(nome) {
    camada = nome in CAMADAS ? nome : "textura";
    if (etapaAtual === "site") definirEtapa("site");
  }

  // ----- Arrastar para girar -----
  const tela = renderer.domElement;
  let ultimoX = 0;
  tela.addEventListener("pointerdown", (e) => {
    arrastando = true;
    ultimoX = e.clientX;
    velocidadeArrasto = 0;
    tela.setPointerCapture(e.pointerId);
  });
  tela.addEventListener("pointermove", (e) => {
    if (!arrastando) return;
    const dx = e.clientX - ultimoX;
    ultimoX = e.clientX;
    giroUsuario += dx * 0.008;
    velocidadeArrasto = dx * 0.008 * 60;
  });
  const soltar = () => (arrastando = false);
  tela.addEventListener("pointerup", soltar);
  tela.addEventListener("pointercancel", soltar);

  // ----- Tamanho -----
  function redimensionar() {
    const { clientWidth: w, clientHeight: h } = palco;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    pontos.material.uniforms.uEscala.value =
      (h * renderer.getPixelRatio()) / (2 * Math.tan(THREE.MathUtils.degToRad(CAMPO_DE_VISAO) / 2));
  }
  new ResizeObserver(redimensionar).observe(palco);
  redimensionar();

  // ----- Quadro a quadro -----
  const relogio = new THREE.Clock();
  const qPivo = new THREE.Quaternion();
  const alvoCamera = new THREE.Vector3();
  const tmp = new THREE.Vector3();

  function atualizar(dt) {
    const suave = 1 - Math.exp(-dt * 3.5);
    const rapido = 1 - Math.exp(-dt * 9);
    for (const chave in PADRAO) {
      if (chave === "fundo") continue;
      atual[chave] += (alvo[chave] - atual[chave]) * (RAPIDOS.has(chave) ? rapido : suave);
    }
    atual.fundo.lerp(corAlvo.set(alvo.fundo), suave);

    // Giro da obra: livre nas etapas com giro; nas outras, volta para a frente (+ rumo).
    if (!arrastando) {
      giroUsuario += velocidadeArrasto * dt;
      velocidadeArrasto *= Math.exp(-dt * 4);
    }
    if (alvo.giro > 0) {
      anguloObra += giroUsuario + atual.giro * dt;
      giroUsuario = 0;
    } else {
      const destino = -frente + alvo.rumo;
      const diferenca = Math.atan2(Math.sin(destino - anguloObra), Math.cos(destino - anguloObra));
      anguloObra += diferenca * suave;
      if (!arrastando) giroUsuario *= Math.exp(-dt * 1.5);
    }
    suporte.rotation.y = anguloObra + (alvo.giro > 0 ? 0 : giroUsuario);

    // Blender: da posição "crua" (deitada, fora do centro) para a final, girando em volta do centro.
    const b = atual.blender;
    qPivo.slerpQuaternions(rotacaoCrua, new THREE.Quaternion(), b);
    pivo.quaternion.copy(qPivo);
    tmp.copy(centro).applyQuaternion(qPivo);
    pivo.position.copy(centro).sub(tmp).addScaledVector(deslocamentoCru, 1 - b);

    /*
      Camadas. Nada fica semitransparente durante a troca (antes, a superfície meio transparente
      mostrava o próprio interior e os pontos ficavam por cima, e a peça parecia "estranha" até a
      troca terminar). Agora uma linha horizontal sobe pela peça: abaixo dela, a camada nova, opaca;
      acima, a antiga. Os valores 0 → 1 de cada camada dizem até onde a linha já subiu.
    */
    revelar(corteTextura, malha, atual.textura);
    revelar(corteArgila, argila, atual.argila);
    revelar(corteArame, arame, atual.arame);
    if (atual.textura >= 0.999) argila.visible = false; // escondida embaixo da textura
    // Arame mais fraco quando os triângulos ficam minúsculos na tela (senão vira uma mancha azul).
    const ladoDoTriangulo = (0.002 * palco.clientHeight) / atual.enquadrar; // em pixels; arestas de ~2 mm
    materialArame.opacity = 0.45 * THREE.MathUtils.smoothstep(ladoDoTriangulo, 1, 5);
    for (const m of [malha, argila, arame]) m.morphTargetInfluences[0] = atual.desdobrar;

    const u = pontos.material.uniforms;
    // Os pontos somem de baixo para cima, na mesma linha em que a superfície aparece.
    u.uCorteBaixo.value = atual.pontos >= 0.999 ? -1e3 : misturar(altura + 0.01, -0.01, atual.pontos);
    u.uBrilhoCorte.value = emTroca(atual.pontos) ? 1 : 0;
    u.uVarredura.value = atual.varredura;
    u.uLaser.value = atual.laser;
    u.uSegunda.value = atual.segunda;
    u.uUniao.value = atual.uniao;
    pontos.visible = atual.pontos > 0.001;

    // Scanner: dá a volta na obra acompanhando a varredura, subindo e descendo um pouco.
    scanner.visible = atual.scanner > 0.01;
    if (scanner.visible) {
      const angulo = u.uInicio.value + atual.varredura * Math.PI * 2;
      const raio = 0.42;
      scanner.position.set(
        Math.sin(angulo) * raio,
        altura * 0.55 + Math.sin(angulo * 2) * 0.1,
        Math.cos(angulo) * raio
      );
      scanner.lookAt(suporte.localToWorld(tmp.copy(centro)));
      scanner.traverse((o) => {
        if (o.material) o.material.opacity = o.userData.opacidade * atual.scanner;
      });
    }

    grade.visible = atual.grade > 0.01;
    grade.traverse((o) => {
      if (o.material) o.material.opacity = o.userData.opacidade * atual.grade;
    });

    // Câmera: enquadra a altura pedida, também em telas mais estreitas que altas.
    const meiaVisao = Math.tan(THREE.MathUtils.degToRad(CAMPO_DE_VISAO) / 2);
    const distancia = atual.enquadrar / 2 / meiaVisao / Math.min(1, camera.aspect * 0.9);
    alvoCamera.set(atual.alvoX, altura * atual.alvoY, 0);
    camera.position.set(
      alvoCamera.x,
      alvoCamera.y + Math.sin(atual.elevacao) * distancia,
      Math.cos(atual.elevacao) * distancia
    );
    camera.lookAt(alvoCamera);

    renderer.setClearColor(atual.fundo);
    cena.fog.color.copy(atual.fundo);
    cena.fog.near = distancia * 0.8;
    cena.fog.far = distancia * 2.4;
  }

  let rodando = false;
  function quadro() {
    if (!rodando) return;
    atualizar(Math.min(relogio.getDelta(), 0.1));
    renderer.render(cena, camera);
    requestAnimationFrame(quadro);
  }
  function ligar(sim) {
    if (sim === rodando) return;
    rodando = sim;
    if (sim) {
      relogio.getDelta();
      requestAnimationFrame(quadro);
    }
  }

  // Prepara todos os shaders agora, para a primeira troca de camada não travar.
  const objetos = [malha, argila, arame, pontos, scanner, grade];
  const visiveis = objetos.map((o) => o.visible);
  objetos.forEach((o) => (o.visible = true));
  renderer.compile(cena, camera);
  objetos.forEach((o, i) => (o.visible = visiveis[i]));

  definirEtapa("obra");
  for (let i = 0; i < 300; i++) atualizar(1 / 30); // começa já no estado da primeira etapa
  renderer.render(cena, camera);

  // Até onde (altura no mundo) a superfície aparece: 0 = nada, 1 = tudo (sem corte).
  function revelar(uniformes, objeto, valor) {
    uniformes.uCorte.value = valor >= 0.999 ? 1e3 : misturar(-0.01, altura + 0.01, valor);
    uniformes.uBrilhoCorte.value = emTroca(valor) ? 1 : 0;
    objeto.visible = valor > 0.001;
  }

  return { definirEtapa, definirCamada, empurrarGiro, ligar, atualizar, camera, renderer, cena };
}

const emTroca = (valor) => valor > 0.001 && valor < 0.999;

/*
  Corte horizontal num material do three.js: some tudo acima da altura uCorte (no mundo) e
  desenha um fio azul, como o laser do scanner, na linha do corte enquanto a troca acontece.
*/
function aplicarCorte(material) {
  const uniformes = { uCorte: { value: 1e3 }, uBrilhoCorte: { value: 0 } };
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniformes);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", `#include <common>
        varying float vAlturaMundo;`)
      .replace("#include <project_vertex>", `#include <project_vertex>
        vAlturaMundo = (modelMatrix * vec4(transformed, 1.0)).y;`);
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>
        varying float vAlturaMundo;
        uniform float uCorte, uBrilhoCorte;`)
      .replace("#include <clipping_planes_fragment>", `#include <clipping_planes_fragment>
        if (vAlturaMundo > uCorte) discard;`)
      .replace("#include <dithering_fragment>", `#include <dithering_fragment>
        float fio = uBrilhoCorte * (1.0 - smoothstep(0.0, 0.006, uCorte - vAlturaMundo));
        gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(0.30, 0.64, 1.0), fio);`);
  };
  material.transparent = material.transparent && material.wireframe; // só o arame é transparente
  material.needsUpdate = true;
  return uniformes;
}

/* ---------- Textura desdobrada ---------- */

/*
  A moringa "se abre" na imagem da textura: cada vértice ganha uma segunda posição, no plano,
  dada pela coordenada da textura (uv). O three.js mistura as duas com morphTargetInfluences.
  O plano fica de frente para a câmera quando a obra está de frente.
*/
function prepararDesdobramento(malha, objetos, textura, centro, altura, paraCamera, direita) {
  const geometria = malha.geometry;
  const uv = geometria.getAttribute("uv");
  const n = uv.count;
  const imagem = textura?.image;
  const proporcao = imagem ? imagem.width / imagem.height : 1;
  const ladoY = altura * 1.3;
  const ladoX = ladoY * proporcao;

  // Do espaço do suporte para o espaço da geometria (o nó do modelo tem rotação e escala).
  const inversa = malha.matrixWorld.clone().invert();
  const giroInverso = malha.getWorldQuaternion(new THREE.Quaternion()).invert();
  const normalPlana = paraCamera.clone().applyQuaternion(giroInverso).normalize();

  const posicoes = new Float32Array(n * 3);
  const normais = new Float32Array(n * 3);
  const ponto = new THREE.Vector3();
  const cima = new THREE.Vector3(0, 1, 0);
  const meio = centro.clone().addScaledVector(paraCamera, 0.05);
  for (let i = 0; i < n; i++) {
    ponto
      .copy(meio)
      .addScaledVector(direita, (uv.getX(i) - 0.5) * ladoX)
      .addScaledVector(cima, (0.5 - uv.getY(i)) * ladoY)
      .applyMatrix4(inversa);
    posicoes.set([ponto.x, ponto.y, ponto.z], i * 3);
    normais.set([normalPlana.x, normalPlana.y, normalPlana.z], i * 3);
  }
  geometria.morphAttributes.position = [new THREE.BufferAttribute(posicoes, 3)];
  geometria.morphAttributes.normal = [new THREE.BufferAttribute(normais, 3)];
  for (const objeto of objetos) {
    objeto.updateMorphTargets();
    objeto.morphTargetInfluences[0] = 0;
  }
}

/* ---------- Nuvem de pontos ---------- */

/*
  Pontos sorteados na superfície da malha, com a cor da textura naquele ponto.
  Ficam no espaço do suporte (em metros). Cada ponto guarda o ângulo em volta da obra (para o
  scanner "revelar" os pontos ao passar) e a qual captura pertence: a primeira (laterais e topo)
  ou a segunda (a base, escaneada com a peça de cabeça para baixo).
*/
function montarNuvem(malha, textura, altura, quantidade) {
  const amostrador = new MeshSurfaceSampler(malha).build();
  const cores = lerTextura(textura);
  const matriz = malha.matrixWorld;
  const giro = malha.getWorldQuaternion(new THREE.Quaternion());

  // A segunda captura (peça virada) cobre a base e a parte de baixo das laterais; essa faixa
  // aparece nas duas capturas, como na prática, e é por ela que as duas se alinham.
  const extras = Math.round(quantidade * 0.35);
  const total = quantidade + extras;
  const posicoes = new Float32Array(total * 3);
  const corPontos = new Float32Array(total * 3);
  const angulos = new Float32Array(total);
  const capturas = new Float32Array(total);
  const acasos = new Float32Array(total);
  const p = new THREE.Vector3();
  const n = new THREE.Vector3();
  const uv = new THREE.Vector2();
  const cor = new THREE.Color();

  for (let i = 0; i < total; i++) {
    const extra = i >= quantidade;
    for (let tentativa = 0; tentativa < 20; tentativa++) {
      amostrador.sample(p, n, undefined, uv);
      p.applyMatrix4(matriz);
      if (!extra || p.y < altura * 0.45) break;
    }
    n.applyQuaternion(giro);
    posicoes.set([p.x, p.y, p.z], i * 3);
    angulos[i] = Math.atan2(p.x, p.z);
    capturas[i] = extra || p.y < altura * 0.04 || (p.y < altura * 0.12 && n.y < -0.35) ? 1 : 0;
    acasos[i] = Math.random();
    if (cores) {
      const x = Math.min(cores.largura - 1, Math.max(0, Math.floor(uv.x * cores.largura)));
      const y = Math.min(cores.altura - 1, Math.max(0, Math.floor(uv.y * cores.altura)));
      const k = (y * cores.largura + x) * 4;
      cor.setRGB(cores.dados[k] / 255, cores.dados[k + 1] / 255, cores.dados[k + 2] / 255, THREE.SRGBColorSpace);
    } else {
      cor.set(0xb08060);
    }
    corPontos.set([cor.r, cor.g, cor.b], i * 3);
  }

  const geometria = new THREE.BufferGeometry();
  geometria.setAttribute("position", new THREE.BufferAttribute(posicoes, 3));
  geometria.setAttribute("cor", new THREE.BufferAttribute(corPontos, 3));
  geometria.setAttribute("angulo", new THREE.BufferAttribute(angulos, 1));
  geometria.setAttribute("captura", new THREE.BufferAttribute(capturas, 1));
  geometria.setAttribute("acaso", new THREE.BufferAttribute(acasos, 1));

  // Tamanho do ponto no mundo: menor quando há mais pontos, para a nuvem ficar fechada.
  const tamanho = 0.0025 * Math.sqrt(70000 / quantidade);

  const material = new THREE.ShaderMaterial({
    transparent: true,
    uniforms: {
      uTamanho: { value: tamanho },
      uEscala: { value: 800 },
      uOpacidade: { value: 1 },
      uVarredura: { value: 1 },
      uInicio: { value: 0 },
      uLaser: { value: 0 },
      uSegunda: { value: 0 },
      uUniao: { value: 1 },
      uCentro: { value: new THREE.Vector3() },
      uEixo: { value: new THREE.Vector3(0, 0, 1) },
      uDeslocamento: { value: new THREE.Vector3() },
      uCorLaser: { value: CORES.laser },
      uCorSegunda: { value: CORES.segundaCaptura },
      uCorteBaixo: { value: -1e3 },
      uBrilhoCorte: { value: 0 },
    },
    vertexShader: /* glsl */ `
      attribute vec3 cor;
      attribute float angulo;
      attribute float captura;
      attribute float acaso;
      uniform float uTamanho, uEscala, uOpacidade, uVarredura, uInicio, uLaser, uSegunda, uUniao, uCorteBaixo, uBrilhoCorte;
      uniform vec3 uCentro, uEixo, uDeslocamento, uCorLaser, uCorSegunda;
      varying vec3 vCor;
      varying float vAlfa;
      const float VOLTA = 6.28318530718;

      vec3 girar(vec3 v, vec3 k, float a) {
        float c = cos(a), s = sin(a);
        return v * c + cross(k, v) * s + k * dot(k, v) * (1.0 - c);
      }

      void main() {
        vec3 p = position;
        vec3 c = cor;
        float alfa = uOpacidade;

        if (captura > 0.5) {
          // Segunda captura: começa de cabeça para baixo, ao lado, e se encaixa na primeira.
          float falta = 1.0 - uUniao;
          p = girar(p - uCentro, uEixo, 3.14159265 * falta) + uCentro + uDeslocamento * falta;
          c = mix(c, uCorSegunda, 0.55 * falta);
          alfa *= uSegunda;
        } else {
          // Primeira captura: o ponto aparece quando o scanner passa por ele.
          float lugar = fract((angulo - uInicio) / VOLTA);
          float visto = uVarredura >= 0.999 ? 1.0 : step(lugar, uVarredura);
          // Logo atrás do scanner: 7 faixas de luz azul (como as linhas de laser do Raptor)
          // e, mais para trás, um brilho azul que vai apagando.
          float atras = uVarredura - lugar;
          float recente = 1.0 - smoothstep(0.0, 0.06, atras);
          float naJanela = step(0.0, atras) * (1.0 - step(0.035, atras));
          float faixa = naJanela * step(fract(atras / 0.035 * 7.0), 0.45);
          c = mix(c, uCorLaser, uLaser * visto * max(0.45 * recente, faixa));
          alfa *= visto;
        }

        // Troca com a superfície: abaixo da linha o ponto some; perto dela, fica azul.
        if (p.y < uCorteBaixo) alfa = 0.0;
        c = mix(c, uCorLaser, uBrilhoCorte * (1.0 - smoothstep(0.0, 0.008, p.y - uCorteBaixo)));

        vCor = c;
        vAlfa = alfa;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = max(1.5, uTamanho * uEscala / -mv.z * (0.8 + 0.4 * acaso));
        if (alfa < 0.01) gl_Position = vec4(2.0, 2.0, 2.0, 1.0); // fora da tela
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vCor;
      varying float vAlfa;
      void main() {
        vec2 d = gl_PointCoord - 0.5;
        if (dot(d, d) > 0.25) discard;
        gl_FragColor = vec4(vCor, vAlfa);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });

  const nuvem = new THREE.Points(geometria, material);
  nuvem.frustumCulled = false; // a segunda captura sai da caixa original
  return nuvem;
}

// Copia a imagem da textura para um canvas pequeno, para ler a cor de cada ponto.
function lerTextura(textura) {
  const imagem = textura?.image;
  if (!imagem) return null;
  const largura = Math.min(1024, imagem.width);
  const altura = Math.round((largura * imagem.height) / imagem.width);
  const canvas = document.createElement("canvas");
  canvas.width = largura;
  canvas.height = altura;
  const contexto = canvas.getContext("2d", { willReadFrequently: true });
  // A textura do glTF não é invertida (flipY = false): v = 0 é a primeira linha da imagem.
  contexto.drawImage(imagem, 0, 0, largura, altura);
  return { largura, altura, dados: contexto.getImageData(0, 0, largura, altura).data };
}

/* ---------- Scanner e grade do Blender ---------- */

/*
  Scanner Creality CR-Scan Raptor em tamanho real (215 × 74 × 50 mm): corpo preto em pé, segurado
  pela capa antiderrapante do meio; na frente, duas câmeras com anéis de LEDs e, entre elas, o
  projetor de luz e a câmera de cor. O cabo USB sai por baixo. A frente (+z) aponta para a obra.
*/
function montarScanner() {
  const grupo = new THREE.Group();
  const padrao = { fog: false };
  const preto = new THREE.MeshStandardMaterial({ ...padrao, color: 0x1b1c1e, roughness: 0.4, metalness: 0.35 });
  const borracha = new THREE.MeshStandardMaterial({ ...padrao, color: 0x2e2f33, roughness: 0.95, metalness: 0 });
  const vidro = new THREE.MeshStandardMaterial({ ...padrao, color: 0x050607, roughness: 0.12, metalness: 0.6 });
  const lente = new THREE.MeshStandardMaterial({ ...padrao, color: 0x0d1622, roughness: 0.05, metalness: 0.9 });
  const ledAzul = new THREE.MeshBasicMaterial({ ...padrao, color: CORES.laser });
  const ledBranco = new THREE.MeshBasicMaterial({ ...padrao, color: 0xf4f7ff });
  const frente = 0.0252; // meia espessura do corpo + um fio, para as peças da frente não brigarem com ele

  const corpo = new THREE.Mesh(new RoundedBoxGeometry(0.074, 0.215, 0.05, 4, 0.014), preto);
  const capa = new THREE.Mesh(new RoundedBoxGeometry(0.078, 0.085, 0.044, 3, 0.012), borracha);
  capa.position.set(0, -0.004, -0.005);
  const painel = new THREE.Mesh(new THREE.PlaneGeometry(0.058, 0.196), vidro);
  painel.position.z = frente;
  grupo.add(corpo, capa, painel);

  // Câmeras de cima e de baixo, cada uma com um anel de LEDs azuis.
  for (const y of [0.066, -0.066]) {
    const camera = new THREE.Mesh(new THREE.CircleGeometry(0.011, 32), lente);
    const anel = new THREE.Mesh(new THREE.RingGeometry(0.0145, 0.0175, 32), ledAzul);
    camera.position.set(0, y, frente + 0.0004);
    anel.position.set(0, y, frente + 0.0004);
    grupo.add(camera, anel);
  }
  // Meio: projetor de luz (azul) e câmera de cor com LEDs brancos em volta.
  const projetor = new THREE.Mesh(new THREE.PlaneGeometry(0.024, 0.007), ledAzul);
  projetor.position.set(0, 0.014, frente + 0.0004);
  const cameraCor = new THREE.Mesh(new THREE.CircleGeometry(0.005, 24), lente);
  cameraCor.position.set(0, -0.014, frente + 0.0004);
  const anelBranco = new THREE.Mesh(new THREE.RingGeometry(0.0068, 0.0085, 24), ledBranco);
  anelBranco.position.copy(cameraCor.position);
  grupo.add(projetor, cameraCor, anelBranco);

  // Cabo USB saindo por baixo.
  const caminho = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, -0.105, -0.004),
    new THREE.Vector3(0, -0.15, -0.012),
    new THREE.Vector3(0.012, -0.2, -0.04),
    new THREE.Vector3(0.03, -0.27, -0.09),
  ]);
  grupo.add(new THREE.Mesh(new THREE.TubeGeometry(caminho, 24, 0.0032, 6), preto));

  // Feixe de luz: pirâmide do projetor até a obra.
  const comprimento = 0.34;
  const feixeGeometria = new THREE.ConeGeometry(0.11, comprimento, 4, 1, true);
  feixeGeometria.rotateX(-Math.PI / 2);
  feixeGeometria.translate(0, 0.014, comprimento / 2 + frente);
  const feixe = new THREE.Mesh(
    feixeGeometria,
    new THREE.MeshBasicMaterial({
      ...padrao, color: CORES.laser, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending,
    })
  );
  feixe.userData.opacidade = 0.14;
  grupo.add(feixe);

  // Todas as peças somem juntas (opacidade controlada em atualizar).
  grupo.traverse((o) => {
    if (!o.material) return;
    o.material.transparent = true;
    o.userData.opacidade ??= 1;
  });
  return grupo;
}

// Grade do chão no estilo do Blender. As linhas param antes da câmera (z = 1,2 m):
// linhas que passam por trás dela podem sumir em algumas placas de vídeo.
function montarGrade() {
  const grupo = new THREE.Group();
  const [xMin, xMax, zMin, zMax, passo] = [-3, 3, -3, 1.2, 0.05];
  const vertices = [];
  for (let x = xMin; x <= xMax + 1e-6; x += passo) {
    if (Math.abs(x) > 1e-6) vertices.push(x, 0, zMin, x, 0, zMax);
  }
  for (let z = zMin; z <= zMax + 1e-6; z += passo) {
    if (Math.abs(z) > 1e-6) vertices.push(xMin, 0, z, xMax, 0, z);
  }
  const geometria = new THREE.BufferGeometry();
  geometria.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  const linhas = new THREE.LineSegments(
    geometria,
    new THREE.LineBasicMaterial({ color: CORES.grade, transparent: true, depthWrite: false, toneMapped: false })
  );
  linhas.userData.opacidade = 0.7;
  grupo.add(linhas);

  for (const [cor, de, ate] of [
    [CORES.eixoX, [xMin, 0, 0], [xMax, 0, 0]],
    [CORES.eixoY, [0, 0, zMin], [0, 0, zMax]],
  ]) {
    const eixoGeometria = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(...de), new THREE.Vector3(...ate)]);
    const eixo = new THREE.Line(eixoGeometria, new THREE.LineBasicMaterial({ color: cor, transparent: true, toneMapped: false }));
    eixo.position.y = 0.001;
    eixo.renderOrder = 1;
    eixo.userData.opacidade = 0.9;
    grupo.add(eixo);
  }
  grupo.visible = false;
  return grupo;
}
