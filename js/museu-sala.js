/*
  museu-sala.js — constrói o museu virtual com three.js, inspirado nas salas de
  exposição da CAL: paredes terracota, piso de taco em espinha de peixe, teto
  claro com trilhos de spots e pedestais terracota, um pouco mais escuros que a
  parede (o topo, sob o spot, não vira um laranja forte).

  As obras são agrupadas por coleção, uma sala para cada, uma depois da outra.
  Entre as salas há uma parede com uma passagem larga e uma viga mais baixa,
  e o nome da sala seguinte fica sobre a passagem. Cada obra entra num
  pedestal, ampliada (SALA.escalaDasObras) e virada pela sua "frente".

  Luz (LUZ): pouca luz geral e um spot quente por obra, para dar profundidade e
  destacar as obras. Cada spot fica no trilho do outro lado do corredor e ilumina
  a obra de frente, a uns 35°; o facho continua até a parede de trás, onde aparece
  a sombra do pedestal e da obra. Os spots, as sombras deles e o escurecimento dos
  cantos são calculados nos shaders (museu-luz.js), igual no computador e no celular.
  Uma névoa quente e leve escurece o que está longe.

  Não cuida de câmera nem de cliques (isso está em museu-navegacao.js).

  Sistema de coordenadas: metros. A entrada fica em z = 0 e o museu avança
  para z negativo. A obra em destaque fica na parede do fundo da última sala;
  as outras se alternam nas paredes laterais, em fileiras.
*/

import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { criarLuz } from "./museu-luz.js";

export const SALA = {
  largura: 5.2,
  peDireito: 3.0,
  espacoEntreFileiras: 2.4,
  alturaPedestal: 1.05, // com a ampliação, deixa as obras perto da altura dos olhos
  escalaDasObras: 1.5, // obras exibidas maiores que o real, para serem vistas melhor na tela
  afastamentoDaParede: 1.25,
  inicioDasFileiras: 2.6, // primeira sala: da entrada até a primeira fileira (espaço para os painéis)
  margemDaPassagem: 1.7, // outras salas: da parede entre salas até a fileira mais perto
  fundo: 3.1, // da última fileira até a parede do fundo (a obra em destaque fica a 1,1 m dela)
  comprimentoMinimo: 3.4,
  giroLateral: 0.45, // quanto as obras laterais se viram para quem entra (0 = de frente para o corredor)
  larguraTaco: 0.07, // m
  espessuraDivisoria: 0.2, // paredes entre as salas
  larguraPassagem: 2.4,
  alturaPassagem: 2.4, // altura livre embaixo da viga
};

// Luz: pouca luz geral, para as obras e as manchas dos spots se destacarem.
const LUZ = {
  ambienteObras: 0.75, // reflexo do ambiente nas obras, igual ao de antes (as metálicas dependem dele)
  ambienteSala: 1.5, // força do reflexo da sala (cenaDeReflexo) em paredes, piso, teto e pedestais
  reflexoParede: [0.14, 0.05, 0.026], // cores lineares do ambiente refletido
  reflexoPiso: [0.07, 0.035, 0.016],
  reflexoTeto: [0.24, 0.21, 0.18],
  reflexoSpot: [6, 5, 3.8],
  hemisferio: 0.2,
  geral: 0.25, // luz do teto, com sombra (só no computador)
  spot: 34, // candela
  aberturaSpot: 0.26, // rad, metade do facho
  penumbraSpot: 0.55, // parte do facho em que a luz vai sumindo (0 a 1)
  aberturaHalo: 0.8, // rad: luz fraca em volta do facho, que clareia a parede e o chão em volta
  halo: 0.16,
  facho: 0.12, // brilho do facho de luz no ar (0 = invisível)
  sombraObra: 0.8, // quanto a sombra da obra escurece o facho (0 a 1)
  nevoa: 0.03, // densidade: quanto mais longe, mais escuro e quente
};

const CORES = {
  parede: 0xa9452c, // terracota das salas da CAL
  rodape: 0x7f2f1d,
  pedestal: 0x86463a, // mais escuro e menos saturado que a parede: o topo, sob o spot, não estoura
  teto: 0xf1ebe5,
  trilho: 0xe9e6e1,
  luzSpot: 0xffd9b0, // branco quente, como lâmpada de 3000 K
  nevoa: 0x2b1810,
  texto: "#212529",
  textoSuave: "#495057",
  textoParede: "#f7efe4",
  destaque: "#1d5c86",
};

// Reflexo do ambiente e luz calculada, usados nas superfícies da sala (ver materialDaSala).
let ambienteDaSala = null;
let luz = null;

/**
 * Onde cada obra fica: sala, posição do pedestal e direção para onde a obra olha.
 * @param {import("./data.js").Obra[]} obras  já na ordem do percurso
 */
export function planejarSala(obras) {
  const destaque = obras[Math.max(0, obras.findIndex((o) => o.destaque))];
  const colecaoDe = (obra) => obra.colecao || "";

  // Uma sala por coleção, na ordem em que aparecem; a da obra em destaque fica por último.
  const grupos = new Map();
  for (const obra of obras) {
    if (!grupos.has(colecaoDe(obra))) grupos.set(colecaoDe(obra), []);
    grupos.get(colecaoDe(obra)).push(obra);
  }
  const ultimaColecao = destaque ? colecaoDe(destaque) : null;
  const colecoes = [...grupos.keys()].sort((a, b) => (a === ultimaColecao) - (b === ultimaColecao));

  const xLateral = SALA.largura / 2 - SALA.afastamentoDaParede;
  const salas = [];
  const divisorias = [];
  const lugares = [];
  let z = 0; // onde começa a sala atual
  let lado = 0; // as laterais continuam alternando esquerda/direita de uma sala para a outra

  colecoes.forEach((colecao, s) => {
    const primeira = s === 0;
    const ultima = s === colecoes.length - 1;
    const laterais = grupos.get(colecao).filter((obra) => obra !== destaque);
    const fileiras = Math.ceil(laterais.length / 2);
    const inicio = primeira ? SALA.inicioDasFileiras : SALA.margemDaPassagem;
    const fim = ultima ? SALA.fundo : SALA.margemDaPassagem;
    const ocupado = fileiras ? inicio + (fileiras - 1) * SALA.espacoEntreFileiras + fim : fim + 0.6;
    const sala = {
      indice: s,
      colecao,
      nome: colecao ? `Coleção ${colecao}` : "Outras obras",
      zMax: z,
      zMin: z - Math.max(SALA.comprimentoMinimo, ocupado),
    };
    salas.push(sala);

    laterais.forEach((obra, i) => {
      const esquerda = (lado + i) % 2 === 0;
      lugares.push({
        obra,
        sala,
        posicao: new THREE.Vector3(
          esquerda ? -xLateral : xLateral,
          0,
          z - inicio - Math.floor(i / 2) * SALA.espacoEntreFileiras
        ),
        // Virada para o corredor e um pouco para a entrada, para ser vista de frente ao chegar.
        direcao: new THREE.Vector3(esquerda ? 1 : -1, 0, SALA.giroLateral).normalize(),
      });
    });
    lado += laterais.length;

    if (ultima && destaque) {
      lugares.push({
        obra: destaque,
        sala,
        posicao: new THREE.Vector3(0, 0, sala.zMin + 1.1),
        direcao: new THREE.Vector3(0, 0, 1),
      });
    }

    z = sala.zMin;
    if (!ultima) {
      divisorias.push({ zMax: z, zMin: z - SALA.espessuraDivisoria });
      z -= SALA.espessuraDivisoria;
    }
  });

  return { lugares, salas, divisorias, comprimento: -z };
}

/**
 * @param {THREE.WebGLRenderer} renderer
 * @param {import("./data.js").Obra[]} obras  na ordem do percurso
 * @param {object} opcoes
 * @param {(carregadas: number, total: number) => void} [opcoes.aoProgresso]
 * @param {boolean} [opcoes.leve]  celular: sem sombras em tempo real
 */
export async function montarSala(renderer, obras, { aoProgresso = () => {}, leve = false } = {}) {
  const cena = new THREE.Scene();
  cena.background = new THREE.Color(CORES.nevoa);
  cena.fog = new THREE.FogExp2(CORES.nevoa, LUZ.nevoa);

  // Luz ambiente "de estúdio", parecida com a do visualizador (model-viewer, neutral), só nas obras
  // (as metálicas dependem dela). Paredes, piso e pedestais refletem uma sala escura e quente com
  // pontos de luz no teto (cenaDeReflexo); com o estúdio claro, o piso ficava esbranquiçado ao longe.
  const pmrem = new THREE.PMREMGenerator(renderer);
  cena.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  cena.environmentIntensity = LUZ.ambienteObras;
  ambienteDaSala = pmrem.fromScene(cenaDeReflexo(), 0.02).texture;
  pmrem.dispose();

  const plano = planejarSala(obras);
  const { lugares, comprimento } = plano;
  luz = criarLuz({
    quantidade: lugares.length,
    divisorias: plano.divisorias,
    sala: SALA,
    comprimento,
    spot: {
      cor: CORES.luzSpot,
      intensidade: LUZ.spot,
      abertura: LUZ.aberturaSpot,
      penumbra: LUZ.penumbraSpot,
      abertaHalo: LUZ.aberturaHalo,
      halo: LUZ.halo,
      sombraObra: LUZ.sombraObra,
    },
  });
  const limites = {
    xMin: -SALA.largura / 2,
    xMax: SALA.largura / 2,
    zMin: -comprimento,
    zMax: 0,
    divisorias: plano.divisorias,
    meiaPassagem: SALA.larguraPassagem / 2,
  };

  const paredes = montarArquitetura(cena, plano, renderer, !leve);
  await document.fonts.load('700 48px "Roboto"').catch(() => {});
  montarTextosDeParede(cena, plano, obras.length);

  const pecas = lugares.map((lugar, indice) => montarPedestal(cena, lugar, indice, !leve));
  montarSpots(cena, pecas, plano);

  const loader = new GLTFLoader();
  const draco = new DRACOLoader();
  draco.setDecoderPath("https://cdn.jsdelivr.net/npm/three@0.169.0/examples/jsm/libs/draco/gltf/");
  loader.setDRACOLoader(draco);

  let carregadas = 0;
  aoProgresso(0, pecas.length);
  await Promise.all(
    pecas.map(async (peca) => {
      try {
        const gltf = await loader.loadAsync(peca.obra.modelo);
        colocarObra(cena, peca, gltf.scene, !leve);
      } catch (erro) {
        console.error(`Não foi possível carregar ${peca.obra.modelo}`, erro);
      }
      carregadas += 1;
      aoProgresso(carregadas, pecas.length);
    })
  );
  draco.dispose();

  // Nada se move na sala: a sombra é desenhada uma vez, depois que as obras chegam.
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = true;

  return { cena, pecas, limites, comprimento, salas: plano.salas, paredes };
}

/* ---------- Materiais e texturas ---------- */

/**
 * Material das superfícies da sala: reflete pouco o ambiente, para a sala ficar mais escura que
 * as obras, e recebe a luz dos spots e o escurecimento dos cantos (museu-luz.js).
 */
function materialDaSala(parametros) {
  // Com envMap próprio, vale o envMapIntensity do material (sem ele, valeria o da cena).
  return luz.prepararMaterialDaSala(
    new THREE.MeshStandardMaterial({ envMap: ambienteDaSala, envMapIntensity: LUZ.ambienteSala, ...parametros })
  );
}

/**
 * Ambiente que as superfícies da sala refletem: uma caixa com paredes terracota na penumbra, piso
 * de madeira, teto claro e pontos de luz quentes, como os spots. Cores em valores lineares (HDR).
 */
function cenaDeReflexo() {
  const cena = new THREE.Scene();
  const caixa = (largura, altura, profundidade, cor, x = 0, y = 0, z = 0) => {
    const malha = new THREE.Mesh(
      new THREE.BoxGeometry(largura, altura, profundidade),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(...cor), side: THREE.BackSide })
    );
    malha.position.set(x, y, z);
    cena.add(malha);
  };
  const plano = (largura, profundidade, cor, x, y, z) => {
    const malha = new THREE.Mesh(
      new THREE.PlaneGeometry(largura, profundidade),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(...cor), side: THREE.DoubleSide })
    );
    malha.rotation.x = Math.PI / 2;
    malha.position.set(x, y, z);
    cena.add(malha);
  };
  caixa(5.2, 3, 12, LUZ.reflexoParede, 0, 0, 0);
  plano(5.2, 12, LUZ.reflexoPiso, 0, -1.49, 0);
  plano(5.2, 12, LUZ.reflexoTeto, 0, 1.49, 0);
  for (let z = -5; z <= 5; z += 1.25) {
    for (const x of [-0.8, 0.8]) plano(0.12, 0.12, LUZ.reflexoSpot, x, 1.45, z + (x > 0 ? 0.4 : 0));
  }
  return cena;
}

function texturaDeCanvas(larguraPx, alturaPx, desenhar) {
  const canvas = document.createElement("canvas");
  canvas.width = larguraPx;
  canvas.height = alturaPx;
  desenhar(canvas.getContext("2d"), larguraPx, alturaPx);
  const textura = new THREE.CanvasTexture(canvas);
  textura.colorSpace = THREE.SRGBColorSpace;
  textura.anisotropy = 8;
  return textura;
}

/**
 * Taco em espinha de peixe. Tacos de k × 1 unidades: a peça horizontal n ocupa
 * [n, n+k] × [n, n+1] e a vertical [n+k, n+k+1] × [n+1−k, n+1]; o desenho se
 * repete a cada 2k unidades nos dois eixos. A textura tem duas repetições, com
 * cores sorteadas, para a repetição não aparecer. Depois ela gira 45°.
 *
 * Os tacos variam pouco de tom entre si (como um piso encerado): com mais
 * contraste, o chão parecia um mosaico.
 */
const TACO = { k: 4, repeticoes: 2 };
function texturaDeTaco() {
  const { k, repeticoes } = TACO;
  const u = 64; // px por unidade (largura de um taco)
  const unidades = 2 * k * repeticoes;
  const lado = unidades * u;
  let semente = 7;
  const aleatorio = () => ((semente = (semente * 16807) % 2147483647) / 2147483647);

  return texturaDeCanvas(lado, lado, (ctx) => {
    ctx.fillStyle = "hsl(26, 40%, 27%)"; // junta entre os tacos
    ctx.fillRect(0, 0, lado, lado);
    const taco = (x, y, w, h, horizontal) => {
      const luz = 39 + aleatorio() * 5;
      const sat = 44 + aleatorio() * 6;
      const matiz = 27 + aleatorio() * 3;
      const veios = Array.from({ length: 3 }, () => 0.15 + aleatorio() * 0.7);
      for (const dx of [-lado, 0, lado]) {
        for (const dy of [-lado, 0, lado]) {
          const px = x * u + dx + 1;
          const py = y * u + dy + 1;
          const pw = w * u - 2;
          const ph = h * u - 2;
          if (px > lado || py > lado || px + pw < 0 || py + ph < 0) continue;
          const g = horizontal
            ? ctx.createLinearGradient(px, 0, px + pw, 0)
            : ctx.createLinearGradient(0, py, 0, py + ph);
          g.addColorStop(0, `hsl(${matiz}, ${sat}%, ${luz}%)`);
          g.addColorStop(1, `hsl(${matiz + 1}, ${sat}%, ${luz - 2.5}%)`);
          ctx.fillStyle = g;
          ctx.fillRect(px, py, pw, ph);
          // veios da madeira, bem leves
          ctx.strokeStyle = `hsla(${matiz - 3}, 45%, ${luz - 10}%, 0.16)`;
          ctx.lineWidth = 1;
          for (const t of veios) {
            ctx.beginPath();
            if (horizontal) {
              ctx.moveTo(px, py + ph * t);
              ctx.bezierCurveTo(px + pw * 0.3, py + ph * (t + 0.1), px + pw * 0.7, py + ph * (t - 0.1), px + pw, py + ph * t);
            } else {
              ctx.moveTo(px + pw * t, py);
              ctx.bezierCurveTo(px + pw * (t + 0.1), py + ph * 0.3, px + pw * (t - 0.1), py + ph * 0.7, px + pw * t, py + ph);
            }
            ctx.stroke();
          }
        }
      }
    };
    // Faixas suficientes para cobrir a textura (o resto vem das cópias deslocadas).
    for (let faixa = -2 * repeticoes; faixa <= 2 * repeticoes; faixa++) {
      for (let n = -unidades; n <= unidades; n++) {
        const ox = faixa * k;
        const oy = -faixa * k;
        taco(n + ox, n + oy, k, 1, true);
        taco(n + k + ox, n + 1 - k + oy, 1, k, false);
      }
    }
  });
}

function painelDeTexto(larguraM, alturaM, textura) {
  return new THREE.Mesh(
    new THREE.PlaneGeometry(larguraM, alturaM),
    new THREE.MeshStandardMaterial({ map: textura, transparent: true, roughness: 0.9 })
  );
}

/** Quebra o texto em linhas que caibam na largura. */
function quebrarLinhas(ctx, texto, largura) {
  const linhas = [];
  let atual = "";
  for (const palavra of texto.split(" ")) {
    const teste = atual ? `${atual} ${palavra}` : palavra;
    if (ctx.measureText(teste).width > largura && atual) {
      linhas.push(atual);
      atual = palavra;
    } else {
      atual = teste;
    }
  }
  if (atual) linhas.push(atual);
  return linhas;
}

/* ---------- Arquitetura ---------- */

/** Monta piso, teto, paredes e a luz geral. Devolve as paredes (para a navegação não atravessá-las). */
function montarArquitetura(cena, plano, renderer, sombras) {
  const { largura, peDireito } = SALA;
  const { comprimento } = plano;
  const centroZ = -comprimento / 2;
  const paredes = [];

  const taco = texturaDeTaco();
  taco.wrapS = taco.wrapT = THREE.RepeatWrapping;
  taco.center.set(0.5, 0.5);
  taco.rotation = Math.PI / 4;
  const repeticao = 2 * TACO.k * TACO.repeticoes * SALA.larguraTaco; // largura da textura, em metros
  taco.repeat.set(largura / repeticao, comprimento / repeticao);
  taco.anisotropy = renderer.capabilities.getMaxAnisotropy();

  const piso = new THREE.Mesh(
    new THREE.PlaneGeometry(largura, comprimento),
    materialDaSala({ map: taco, roughness: 0.42 })
  );
  piso.rotation.x = -Math.PI / 2;
  piso.position.set(0, 0, centroZ);
  piso.receiveShadow = sombras;
  piso.name = "piso";
  cena.add(piso);

  const teto = new THREE.Mesh(
    new THREE.PlaneGeometry(largura, comprimento),
    materialDaSala({ color: CORES.teto, roughness: 1, emissive: CORES.teto, emissiveIntensity: 0.3 })
  );
  teto.rotation.x = Math.PI / 2;
  teto.position.set(0, peDireito, centroZ);
  cena.add(teto);

  const materialParede = materialDaSala({ color: CORES.parede, roughness: 0.92 });
  const materialRodape = materialDaSala({ color: CORES.rodape, roughness: 0.8 });
  const materialFaixa = materialDaSala({ color: CORES.teto, roughness: 1, emissive: CORES.teto, emissiveIntensity: 0.12 });

  // Rodapé e faixa clara junto ao teto (como nas salas da CAL) numa face de parede.
  const acabamento = (larguraFace, x, z, rotacaoY, comRodape = true) => {
    if (comRodape) {
      const rodape = new THREE.Mesh(new THREE.BoxGeometry(larguraFace, 0.07, 0.015), materialRodape);
      rodape.position.set(x, 0.035, z);
      rodape.rotation.y = rotacaoY;
      rodape.translateZ(0.008);
      cena.add(rodape);
    }
    const faixa = new THREE.Mesh(new THREE.PlaneGeometry(larguraFace, 0.25), materialFaixa);
    faixa.position.set(x, peDireito - 0.125, z);
    faixa.rotation.y = rotacaoY;
    faixa.translateZ(0.002);
    cena.add(faixa);
  };

  const bloquear = (malha) => {
    malha.receiveShadow = sombras;
    malha.userData.parede = true;
    paredes.push(malha);
    cena.add(malha);
  };

  const parede = (larguraParede, x, z, rotacaoY) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(larguraParede, peDireito), materialParede);
    m.position.set(x, peDireito / 2, z);
    m.rotation.y = rotacaoY;
    bloquear(m);
    acabamento(larguraParede, x, z, rotacaoY);
  };
  parede(comprimento, -largura / 2, centroZ, Math.PI / 2); // esquerda
  parede(comprimento, largura / 2, centroZ, -Math.PI / 2); // direita
  parede(largura, 0, -comprimento, 0); // fundo
  parede(largura, 0, 0, Math.PI); // entrada

  // Paredes entre as salas: dois trechos cheios e uma viga sobre a passagem do meio.
  const meia = SALA.larguraPassagem / 2;
  const trecho = largura / 2 - meia;
  const alturaViga = peDireito - SALA.alturaPassagem;
  for (const d of plano.divisorias) {
    const espessura = d.zMax - d.zMin;
    const z = (d.zMax + d.zMin) / 2;
    for (const sinal of [-1, 1]) {
      const x = sinal * (meia + trecho / 2);
      const bloco = new THREE.Mesh(new THREE.BoxGeometry(trecho, peDireito, espessura), materialParede);
      bloco.position.set(x, peDireito / 2, z);
      bloco.castShadow = sombras;
      bloquear(bloco);
      acabamento(trecho, x, d.zMax, 0);
      acabamento(trecho, x, d.zMin, Math.PI);
    }
    const viga = new THREE.Mesh(new THREE.BoxGeometry(SALA.larguraPassagem, alturaViga, espessura), materialParede);
    viga.position.set(0, peDireito - alturaViga / 2, z);
    bloquear(viga);
    acabamento(SALA.larguraPassagem, 0, d.zMax, 0, false);
    acabamento(SALA.larguraPassagem, 0, d.zMin, Math.PI, false);
  }

  cena.add(new THREE.HemisphereLight(0xffeedd, 0x6b3a20, LUZ.hemisferio));

  // Luz geral do teto, fraca, com sombra suave (só no computador).
  const geral = new THREE.DirectionalLight(0xffeedd, LUZ.geral);
  geral.position.set(0.8, peDireito * 3, centroZ + 1.5);
  geral.target.position.set(0, 0, centroZ);
  cena.add(geral, geral.target);
  if (sombras) {
    geral.castShadow = true;
    geral.shadow.mapSize.set(2048, 2048);
    const c = geral.shadow.camera;
    c.left = -largura / 2 - 0.5;
    c.right = largura / 2 + 0.5;
    c.top = comprimento / 2 + 0.5;
    c.bottom = -comprimento / 2 - 0.5;
    c.near = 1;
    c.far = peDireito * 5;
    geral.shadow.bias = -0.0004;
    geral.shadow.normalBias = 0.02;
    geral.shadow.radius = 5;
  }

  return paredes;
}

/* ---------- Trilhos e spots ---------- */

/**
 * Monta trilhos e luminárias e passa a posição de cada spot para museu-luz.js. O spot de uma obra
 * lateral fica no trilho do outro lado do corredor, um pouco mais perto da entrada: ilumina a obra
 * de frente e de cima (~35°), como nas exposições, e o facho segue até a parede atrás dela.
 */
function montarSpots(cena, pecas, plano) {
  const { largura, peDireito } = SALA;
  const yTrilho = peDireito - 0.06;
  const xTrilho = largura / 2 - SALA.afastamentoDaParede - 0.55;
  const materialTrilho = new THREE.MeshStandardMaterial({ color: CORES.trilho, roughness: 0.5, metalness: 0.2 });
  const materialLuminaria = new THREE.MeshStandardMaterial({ color: 0xf7f6f3, roughness: 0.4, metalness: 0.1 });
  const materialLente = new THREE.MeshBasicMaterial({ color: 0xfff3e0 });

  // Em cada sala, dois trilhos ao longo dela; na última, um atravessado para a obra em destaque.
  for (const sala of plano.salas) {
    const comprimentoTrilho = sala.zMax - sala.zMin - 0.6;
    for (const x of [-xTrilho, xTrilho]) {
      const trilho = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.03, comprimentoTrilho), materialTrilho);
      trilho.position.set(x, yTrilho, (sala.zMax + sala.zMin) / 2);
      cena.add(trilho);
    }
  }
  // Trilho atravessado na última sala, à frente da obra em destaque (o facho dela chega à parede do fundo).
  const zTravessa = -plano.comprimento + 3.0;
  const travessa = new THREE.Mesh(new THREE.BoxGeometry(xTrilho * 2, 0.03, 0.035), materialTrilho);
  travessa.position.set(0, yTrilho, zTravessa);
  cena.add(travessa);

  const corpo = new THREE.CylinderGeometry(0.045, 0.055, 0.16, 20);
  corpo.rotateX(Math.PI / 2); // o cilindro passa a apontar para +Z (lookAt)
  const lente = new THREE.CircleGeometry(0.04, 20);
  lente.translate(0, 0, 0.081);
  const hasteGeo = new THREE.CylinderGeometry(0.008, 0.008, 0.1, 8);

  // Facho de luz no ar: um cone aberto, com a ponta na luminária e a base na obra.
  const coneGeo = new THREE.ConeGeometry(1, 1, 32, 1, true);
  coneGeo.translate(0, -0.5, 0);
  coneGeo.rotateX(-Math.PI / 2); // ponta na origem, base em z = 1
  const materialFacho = criarMaterialDoFacho();

  for (const peca of pecas) {
    const destaque = peca.direcao.z > 0.99;
    const base = destaque
      ? new THREE.Vector3(0, yTrilho, zTravessa)
      : new THREE.Vector3(-Math.sign(peca.posicao.x) * xTrilho, yTrilho, peca.posicao.z + 0.5);
    const alvo = new THREE.Vector3(peca.posicao.x, peca.topo + Math.max(0.12, peca.altura / 2), peca.posicao.z); // meio da obra

    const luminaria = new THREE.Group();
    luminaria.position.copy(base).add(new THREE.Vector3(0, -0.12, 0));
    luminaria.add(new THREE.Mesh(corpo, materialLuminaria), new THREE.Mesh(lente, materialLente));
    const haste = new THREE.Mesh(hasteGeo, materialTrilho);
    haste.position.copy(base).add(new THREE.Vector3(0, -0.05, 0));
    const facho = new THREE.Mesh(coneGeo, materialFacho);
    facho.renderOrder = 1; // depois das obras
    cena.add(luminaria, haste, facho);

    peca.luminaria = luminaria;
    peca.facho = facho;
    mirarSpot(peca);
    luz.definirForma(peca.indice, peca.tamanho, peca.giro);
  }
}

/**
 * Brilho do facho no ar: mais forte no meio do cone (onde a luz atravessa mais ar), some nas
 * bordas, perto da luminária, perto da obra e perto da câmera (para não embaçar a vista ao passar).
 */
function criarMaterialDoFacho() {
  return new THREE.ShaderMaterial({
    uniforms: { uCor: { value: new THREE.Color(CORES.luzSpot) }, uForca: { value: LUZ.facho } },
    vertexShader: /* glsl */ `
      varying float vT;
      varying vec3 vNormal;
      varying vec3 vVista;
      void main() {
        vT = position.z;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vVista = -mv.xyz;
        vNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uCor;
      uniform float uForca;
      varying float vT;
      varying vec3 vNormal;
      varying vec3 vVista;
      void main() {
        float distancia = length(vVista);
        float frente = abs(dot(normalize(vNormal), vVista / distancia));
        float alfa = uForca * frente * frente * smoothstep(0.0, 0.2, vT) * pow(1.0 - vT, 1.4) * smoothstep(0.4, 1.4, distancia);
        gl_FragColor = vec4(uCor * alfa, 1.0);
      }`,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
}

/** Aponta o spot para o meio da obra (de novo quando o modelo chega e a altura real é conhecida). */
function mirarSpot(peca) {
  const alvo = new THREE.Vector3(peca.posicao.x, peca.topo + Math.max(0.12, peca.altura / 2), peca.posicao.z);
  peca.luminaria.lookAt(alvo);
  // O facho no ar termina um pouco antes do meio da obra, para não velar a peça.
  const comprimento = peca.luminaria.position.distanceTo(alvo) * 0.9;
  const raio = comprimento * Math.tan(LUZ.aberturaSpot * 0.75);
  peca.facho.position.copy(peca.luminaria.position);
  peca.facho.lookAt(alvo);
  peca.facho.scale.set(raio, raio, comprimento);
  luz.definirObra(peca.indice, {
    luz: peca.luminaria.position,
    alvo,
    intensidade: LUZ.spot,
    pedestal: { x: peca.posicao.x, z: peca.posicao.z, giro: peca.giro, lado: peca.lado },
  });
}

/* ---------- Textos de parede ---------- */

function montarTextosDeParede(cena, plano, quantidade) {
  // Título em letras claras direto na parede do fundo, acima da obra em destaque.
  const titulo = painelDeTexto(
    3.2,
    0.66,
    texturaDeCanvas(1800, 370, (ctx, w) => {
      ctx.fillStyle = CORES.textoParede;
      ctx.textAlign = "center";
      ctx.font = '700 150px "Roboto", sans-serif';
      ctx.fillText("Gêmeos Digitais CAL", w / 2, 170);
      ctx.font = '400 60px "Roboto", sans-serif';
      ctx.fillText("Acervo da Casa da Cultura da América Latina · UnB", w / 2, 300);
    })
  );
  titulo.position.set(0, 2.32, -plano.comprimento + 0.01);
  cena.add(titulo);

  // Nome da sala na viga sobre cada passagem, dos dois lados: quem chega lê o nome da sala seguinte.
  const alturaLetreiro = 0.32;
  const yLetreiro = SALA.alturaPassagem + (SALA.peDireito - 0.25 - SALA.alturaPassagem) / 2;
  const letreiro = (nome, z, rotacaoY) => {
    const placa = painelDeTexto(
      SALA.larguraPassagem - 0.1,
      alturaLetreiro,
      texturaDeCanvas(1150, 160, (ctx, w, h) => {
        ctx.fillStyle = CORES.textoParede;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = '500 80px "Roboto", sans-serif';
        ctx.fillText(nome, w / 2, h / 2 + 4, w - 40);
      })
    );
    placa.position.set(0, yLetreiro, z);
    placa.rotation.y = rotacaoY;
    cena.add(placa);
  };
  plano.divisorias.forEach((d, i) => {
    letreiro(plano.salas[i + 1].nome, d.zMax + 0.003, 0);
    letreiro(plano.salas[i].nome, d.zMin - 0.003, Math.PI);
  });

  // Painéis emoldurados perto da entrada (como os textos de sala da CAL).
  const materialMoldura = new THREE.MeshStandardMaterial({ color: 0xf6f3ee, roughness: 0.6 });
  const painelEmoldurado = (x, rotacaoY, desenhar) => {
    const grupo = new THREE.Group();
    const moldura = new THREE.Mesh(new THREE.BoxGeometry(1.06, 0.82, 0.03), materialMoldura);
    const papel = painelDeTexto(0.92, 0.68, texturaDeCanvas(920, 680, desenhar));
    papel.position.z = 0.016;
    grupo.add(moldura, papel);
    grupo.position.set(x, 1.55, -1.0);
    grupo.rotation.y = rotacaoY;
    cena.add(grupo);
  };

  const fundoPapel = (ctx, w, h) => {
    ctx.fillStyle = "#fbf9f5";
    ctx.fillRect(0, 0, w, h);
  };

  painelEmoldurado(-SALA.largura / 2 + 0.02, Math.PI / 2, (ctx, w, h) => {
    fundoPapel(ctx, w, h);
    ctx.fillStyle = CORES.destaque;
    ctx.font = '500 30px "Roboto", sans-serif';
    ctx.fillText("MUSEU VIRTUAL", 60, 100);
    ctx.fillStyle = CORES.texto;
    ctx.font = '700 64px "Roboto", sans-serif';
    ctx.fillText("Obras em 3D", 60, 180);
    ctx.fillStyle = CORES.textoSuave;
    ctx.font = '400 32px "Roboto", sans-serif';
    const texto =
      "Cada peça deste museu foi escaneada na CAL com um scanner 3D. " +
      (plano.salas.length > 1 ? "Há uma sala para cada coleção do acervo. " : "") +
      "Clique numa obra para girá-la, aproximar-se e ver a ficha.";
    quebrarLinhas(ctx, texto, w - 120).forEach((linha, i) => ctx.fillText(linha, 60, 260 + i * 46));
  });

  painelEmoldurado(SALA.largura / 2 - 0.02, -Math.PI / 2, (ctx, w, h) => {
    fundoPapel(ctx, w, h);
    ctx.fillStyle = CORES.destaque;
    ctx.font = '500 30px "Roboto", sans-serif';
    ctx.fillText("PROJETO DE EXTENSÃO PJ772-2026", 60, 100);
    ctx.fillStyle = CORES.texto;
    ctx.font = '700 130px "Roboto", sans-serif';
    ctx.fillText(`${quantidade}`, 60, 235);
    const larguraNumero = ctx.measureText(`${quantidade}`).width;
    ctx.font = '400 44px "Roboto", sans-serif';
    ctx.fillStyle = CORES.textoSuave;
    ctx.fillText("de 20 obras digitalizadas", 80 + larguraNumero, 235);
    ctx.fillStyle = "#d6c7b0";
    ctx.fillRect(60, 275, w - 120, 10);
    ctx.fillStyle = CORES.destaque;
    ctx.fillRect(60, 275, ((w - 120) * Math.min(quantidade, 20)) / 20, 10);
    ctx.fillStyle = CORES.textoSuave;
    ctx.font = '400 32px "Roboto", sans-serif';
    const texto = "Laboratório Protip, Instituto de Artes da UnB, com a Casa da Cultura da América Latina.";
    quebrarLinhas(ctx, texto, w - 120).forEach((linha, i) => ctx.fillText(linha, 60, 360 + i * 46));
  });
}

/* ---------- Pedestais e obras ---------- */

let _materialPedestal;
function materialPedestal() {
  _materialPedestal ??= materialDaSala({ color: CORES.pedestal, roughness: 0.85 });
  return _materialPedestal;
}

function montarPedestal(cena, lugar, indice, sombras) {
  const { obra, sala, posicao, direcao } = lugar;
  const e = SALA.escalaDasObras;
  const real = obra.dimensoes || { largura: 30, profundidade: 30, altura: 30 };
  const d = { largura: real.largura * e, profundidade: real.profundidade * e, altura: real.altura * e };
  const lado = Math.max(0.5, Math.max(d.largura, d.profundidade) / 100 + 0.24);
  const altura = SALA.alturaPedestal;
  const giro = Math.atan2(direcao.x, direcao.z);

  const pedestal = new THREE.Mesh(new THREE.BoxGeometry(lado, altura, lado), materialPedestal());
  pedestal.position.set(posicao.x, altura / 2, posicao.z);
  pedestal.rotation.y = giro;
  pedestal.castShadow = sombras;
  pedestal.receiveShadow = sombras;
  pedestal.userData.indice = indice;
  cena.add(pedestal);
  // A sombra em volta da base vem do escurecimento dos cantos (museu-luz.js), igual no celular.

  // Etiqueta pequena na face do pedestal, como as legendas das exposições.
  const placa = painelDeTexto(
    0.22,
    0.085,
    texturaDeCanvas(660, 255, (ctx, w, h) => {
      ctx.fillStyle = "#fbf9f5";
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = CORES.destaque;
      ctx.font = '500 32px "Roboto", sans-serif';
      ctx.fillText(obra.registro || "", 30, 54);
      ctx.fillStyle = CORES.texto;
      ctx.font = '700 44px "Roboto", sans-serif';
      const linhas = quebrarLinhas(ctx, obra.titulo || "", w - 60).slice(0, 2);
      linhas.forEach((linha, i) => ctx.fillText(linha, 30, 116 + i * 52));
      ctx.fillStyle = CORES.textoSuave;
      ctx.font = '400 28px "Roboto", sans-serif';
      ctx.fillText([obra.procedencia, obra.anoAquisicao].filter(Boolean).join(" · "), 30, 116 + linhas.length * 52 + 12);
    })
  );
  const frenteDoPedestal = posicao.clone().addScaledVector(direcao, lado / 2 + 0.003);
  placa.position.set(frenteDoPedestal.x, altura - 0.16, frenteDoPedestal.z);
  placa.lookAt(frenteDoPedestal.clone().add(direcao).setY(altura - 0.16));
  cena.add(placa);

  const alturaObra = (d.altura || 30) / 100;
  return {
    obra,
    indice,
    sala, // { nome, zMin, zMax, ... } da sala onde a obra está
    posicao,
    direcao,
    pedestal,
    giro, // rotation.y do pedestal
    lado, // m
    luminaria: null,
    facho: null,
    raio: (lado / 2) * Math.SQRT2,
    topo: altura,
    grupo: null,
    altura: alturaObra,
    tamanho: new THREE.Vector3((d.largura || 30) / 100, alturaObra, (d.profundidade || 30) / 100),
    centro: new THREE.Vector3(posicao.x, altura + alturaObra / 2, posicao.z),
  };
}

/** Coloca o modelo em cima do pedestal, centralizado e com a frente virada para o visitante. */
function colocarObra(cena, peca, modelo, sombras) {
  // Caixa calculada vértice a vértice (precise = true). A caixa rápida usa a caixa de cada
  // malha girada junto com ela; como os modelos chegam do Blender com rotação interna, ela fica
  // maior que a peça e a obra acabava "flutuando" acima do pedestal.
  const caixa = new THREE.Box3().setFromObject(modelo, true);
  const centro = caixa.getCenter(new THREE.Vector3());
  const tamanho = caixa.getSize(new THREE.Vector3());
  modelo.position.set(-centro.x, -caixa.min.y, -centro.z);

  modelo.traverse((filho) => {
    if (filho.isMesh) {
      filho.castShadow = sombras;
      filho.receiveShadow = sombras;
      filho.userData.indice = peca.indice;
      // Só soma a luz do spot da obra; material e textura continuam os do arquivo.
      for (const material of [filho.material].flat()) luz.prepararMaterialDaObra(material, peca.indice);
    }
  });

  // "frente" segue o model-viewer: 0° = frente para +Z, 90° = frente para +X.
  const frente = THREE.MathUtils.degToRad(Number(peca.obra.frente) || 0);
  const direcao = Math.atan2(peca.direcao.x, peca.direcao.z);

  const grupo = new THREE.Group();
  grupo.add(modelo);
  grupo.scale.setScalar(SALA.escalaDasObras);
  grupo.rotation.y = direcao - frente;
  grupo.position.set(peca.posicao.x, peca.topo, peca.posicao.z);
  tamanho.multiplyScalar(SALA.escalaDasObras);
  peca.grupo = grupo;
  peca.altura = tamanho.y;
  peca.tamanho.copy(tamanho);
  peca.centro.set(peca.posicao.x, peca.topo + tamanho.y / 2, peca.posicao.z);
  cena.add(grupo);
  mirarSpot(peca);
  luz.definirForma(peca.indice, tamanho, grupo.rotation.y);
}
