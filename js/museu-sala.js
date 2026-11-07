/*
  museu-sala.js — constrói o museu virtual com three.js, inspirado nas salas de
  exposição da CAL: paredes terracota, piso de taco em espinha de peixe, teto
  claro com trilhos de spots e pedestais da cor da parede.

  As obras são agrupadas por coleção, uma sala para cada, uma depois da outra.
  Entre as salas há uma parede com uma passagem larga e uma viga mais baixa,
  e o nome da sala seguinte fica sobre a passagem. Cada obra entra num
  pedestal, ampliada (SALA.escalaDasObras) e virada pela sua "frente".

  Luz (LUZ): pouca luz geral e spots quentes, para dar profundidade e destacar
  as obras. As manchas de luz na parede e no chão são texturas (quase não pesam);
  no computador, alguns spots reais acompanham as obras mais perto do visitante
  (atualizarLuzes, chamado a cada quadro).

  Não cuida de câmera nem de cliques (isso está em museu-navegacao.js).

  Sistema de coordenadas: metros. A entrada fica em z = 0 e o museu avança
  para z negativo. A obra em destaque fica na parede do fundo da última sala;
  as outras se alternam nas paredes laterais, em fileiras.
*/

import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

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
  ambienteObrasLeve: 0.85, // no celular, sem spots reais
  ambienteSala: 0.4, // reflexo do ambiente em paredes, piso, teto e pedestais
  hemisferio: 0.3,
  geral: 0.35, // luz do teto, com sombra (só no computador)
  spot: 18, // candela
  aberturaSpot: 0.26, // rad
  spotsReais: 6, // no computador; o número é fixo porque mudá-lo recompila os shaders
};

const CORES = {
  parede: 0xa9452c, // terracota das salas da CAL
  rodape: 0x7f2f1d,
  pedestal: 0xa3412a,
  teto: 0xf1ebe5,
  trilho: 0xe9e6e1,
  luzSpot: 0xffd9b0, // branco quente, como lâmpada de 3000 K
  manchaDeLuz: "255, 214, 170",
  texto: "#212529",
  textoSuave: "#495057",
  textoParede: "#f7efe4",
  destaque: "#1d5c86",
};

// Reflexo do ambiente usado nas superfícies da sala (ver materialDaSala).
let ambienteDaSala = null;

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
 * @param {boolean} [opcoes.leve]  celular: sem sombras em tempo real e sem spots reais
 */
export async function montarSala(renderer, obras, { aoProgresso = () => {}, leve = false } = {}) {
  const cena = new THREE.Scene();
  cena.background = new THREE.Color(CORES.teto);

  // Luz ambiente "de estúdio", parecida com a do visualizador (model-viewer, neutral). As obras a
  // recebem com a força de cena.environmentIntensity; a sala, bem mais fraca (materialDaSala).
  const pmrem = new THREE.PMREMGenerator(renderer);
  ambienteDaSala = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  cena.environment = ambienteDaSala;
  cena.environmentIntensity = leve ? LUZ.ambienteObrasLeve : LUZ.ambienteObras;

  const plano = planejarSala(obras);
  const { lugares, comprimento } = plano;
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
  const atualizarLuzes = montarSpots(cena, pecas, plano, leve);

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

  return { cena, pecas, limites, comprimento, salas: plano.salas, paredes, atualizarLuzes };
}

/* ---------- Materiais e texturas ---------- */

/** Material das superfícies da sala: reflete pouco o ambiente, para a sala ficar mais escura que as obras. */
function materialDaSala(parametros) {
  // Com envMap próprio, vale o envMapIntensity do material (sem ele, valeria o da cena).
  return new THREE.MeshStandardMaterial({ envMap: ambienteDaSala, envMapIntensity: LUZ.ambienteSala, ...parametros });
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
 * repete a cada 2k unidades nos dois eixos. Depois a textura gira 45°.
 */
function texturaDeTaco() {
  const k = 4;
  const u = 64; // px por unidade (largura de um taco)
  const lado = 2 * k * u;
  let semente = 7;
  const aleatorio = () => ((semente = (semente * 16807) % 2147483647) / 2147483647);

  return texturaDeCanvas(lado, lado, (ctx) => {
    ctx.fillStyle = "#5a3416"; // rejunte
    ctx.fillRect(0, 0, lado, lado);
    const taco = (x, y, w, h, horizontal) => {
      const luz = 40 + aleatorio() * 13;
      const sat = 46 + aleatorio() * 12;
      const matiz = 29 + aleatorio() * 6;
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
          g.addColorStop(1, `hsl(${matiz + 2}, ${sat}%, ${luz - 5}%)`);
          ctx.fillStyle = g;
          ctx.fillRect(px, py, pw, ph);
          // veios
          ctx.strokeStyle = `hsla(${matiz - 4}, 45%, ${luz - 14}%, 0.25)`;
          ctx.lineWidth = 1;
          for (let v = 0; v < 3; v++) {
            const t = 0.2 + aleatorio() * 0.6;
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
    // Faixas suficientes para cobrir a peça repetida (o resto vem das cópias deslocadas).
    for (let faixa = -2; faixa <= 2; faixa++) {
      for (let n = -2 * k; n <= 2 * k; n++) {
        const ox = faixa * k;
        const oy = -faixa * k;
        taco(n + ox, n + oy, k, 1, true);
        taco(n + k + ox, n + 1 - k + oy, 1, k, false);
      }
    }
  });
}

/**
 * Facho de spot batendo na parede: borda de cima em arco (mais alta no meio), mais forte logo
 * abaixo dela, abrindo e apagando para baixo e para os lados. Desenhada pixel a pixel.
 */
function texturaDeManchaNaParede() {
  return texturaDeCanvas(256, 512, (ctx, w, h) => {
    const imagem = ctx.createImageData(w, h);
    const [r, g, b] = CORES.manchaDeLuz.split(",").map(Number);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const u = (x / (w - 1)) * 2 - 1; // −1 (esquerda) a 1 (direita)
        const abaixo = y / h - (0.06 + 0.3 * u * u); // distância até a borda em arco
        if (abaixo <= 0) continue;
        const borda = Math.min(1, abaixo / 0.035); // borda só um pouco suave
        const largura = 0.32 + 0.35 * abaixo; // o facho abre para baixo
        const lados = Math.exp(-(u * u) / (2 * largura * largura)) * (1 - u * u);
        const alfa = 0.7 * borda * Math.exp(-abaixo * 3.8) * lados;
        const i = (y * w + x) * 4;
        imagem.data.set([r, g, b, Math.round(alfa * 255)], i);
      }
    }
    ctx.putImageData(imagem, 0, 0);
  });
}

/** Poça de luz no chão em volta do pedestal. */
function texturaDeManchaNoPiso() {
  return texturaDeCanvas(256, 256, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, `rgba(${CORES.manchaDeLuz}, 0.42)`);
    g.addColorStop(0.45, `rgba(${CORES.manchaDeLuz}, 0.22)`);
    g.addColorStop(1, `rgba(${CORES.manchaDeLuz}, 0)`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
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
  const repeticao = 8 * SALA.larguraTaco; // a peça repetida tem 2k = 8 tacos de largura
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

/* ---------- Trilhos, spots e manchas de luz ---------- */

/** Monta trilhos, luminárias e manchas de luz. Devolve a função que move os spots reais (a cada quadro). */
function montarSpots(cena, pecas, plano, leve) {
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
  const zTravessa = -plano.comprimento + 2.2;
  const travessa = new THREE.Mesh(new THREE.BoxGeometry(xTrilho * 2, 0.03, 0.035), materialTrilho);
  travessa.position.set(0, yTrilho, zTravessa);
  cena.add(travessa);

  const corpo = new THREE.CylinderGeometry(0.045, 0.055, 0.16, 20);
  corpo.rotateX(Math.PI / 2); // o cilindro passa a apontar para +Z (lookAt)
  const lente = new THREE.CircleGeometry(0.04, 20);
  lente.translate(0, 0, 0.081);

  // Manchas de luz: texturas somadas à cor da parede e do chão. No computador, mais fracas,
  // porque o spot real perto do visitante já clareia um pouco.
  const mancha = (textura) =>
    new THREE.MeshBasicMaterial({
      map: textura,
      transparent: true,
      opacity: leve ? 1 : 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });
  const manchaParede = mancha(texturaDeManchaNaParede());
  const manchaPiso = mancha(texturaDeManchaNoPiso());

  for (const peca of pecas) {
    const destaque = peca.direcao.z > 0.99;
    const base = destaque
      ? new THREE.Vector3(0, yTrilho, zTravessa)
      : new THREE.Vector3(Math.sign(peca.posicao.x) * xTrilho, yTrilho, peca.posicao.z + 0.4);
    const alvo = new THREE.Vector3(peca.posicao.x, peca.topo + Math.max(0.12, peca.altura / 2), peca.posicao.z); // meio da obra

    const luminaria = new THREE.Group();
    luminaria.position.copy(base).add(new THREE.Vector3(0, -0.12, 0));
    luminaria.add(new THREE.Mesh(corpo, materialLuminaria), new THREE.Mesh(lente, materialLente));
    luminaria.lookAt(alvo);
    const haste = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.1, 8), materialTrilho);
    haste.position.copy(base).add(new THREE.Vector3(0, -0.05, 0));
    cena.add(luminaria, haste);
    peca.luz = { posicao: luminaria.position.clone(), alvo };

    // Mancha na parede atrás da obra (fundo ou lateral) e poça no chão em volta do pedestal.
    const naParede = new THREE.Mesh(new THREE.PlaneGeometry(destaque ? 2.4 : 1.7, 2.5), manchaParede);
    if (destaque) {
      naParede.position.set(0, 1.5, -plano.comprimento + 0.004);
    } else {
      const sinal = Math.sign(peca.posicao.x);
      naParede.position.set(sinal * (largura / 2 - 0.004), 1.5, peca.posicao.z - 0.15);
      naParede.rotation.y = -sinal * (Math.PI / 2);
    }
    const noChao = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 2.2), manchaPiso);
    noChao.rotation.x = -Math.PI / 2;
    noChao.position.set(peca.posicao.x + peca.direcao.x * 0.3, 0.0015, peca.posicao.z + peca.direcao.z * 0.3);
    naParede.renderOrder = noChao.renderOrder = -1; // antes dos textos e da sombra do pedestal
    cena.add(naParede, noChao);
  }

  return leve ? () => {} : criarSpotsReais(cena, pecas);
}

/**
 * Poucos spots reais (LUZ.spotsReais) que acompanham as obras mais perto do visitante. Um spot por
 * obra pesaria demais com 20 obras. Ao trocar de obra, o spot apaga e acende aos poucos.
 */
function criarSpotsReais(cena, pecas) {
  const luzes = Array.from({ length: Math.min(LUZ.spotsReais, pecas.length) }, () => {
    const spot = new THREE.SpotLight(CORES.luzSpot, 0, 0, LUZ.aberturaSpot, 0.6, 2);
    cena.add(spot, spot.target);
    return { spot, peca: null, nivel: 0 };
  });
  const distancias = new Map();
  let primeiraVez = true;

  return function atualizarLuzes(posicao, dt) {
    // As obras já iluminadas levam vantagem, para os spots não ficarem trocando no meio do caminho.
    for (const peca of pecas) {
      const acesa = luzes.some((luz) => luz.peca === peca);
      distancias.set(peca, peca.centro.distanceToSquared(posicao) * (acesa ? 0.7 : 1));
    }
    const perto = new Set([...pecas].sort((a, b) => distancias.get(a) - distancias.get(b)).slice(0, luzes.length));

    for (const luz of luzes) {
      if (!luz.peca) continue;
      luz.nivel = THREE.MathUtils.clamp(luz.nivel + (perto.has(luz.peca) ? dt : -dt) * 1.6, 0, 1);
      if (luz.nivel === 0) luz.peca = null;
    }
    for (const peca of perto) {
      if (luzes.some((luz) => luz.peca === peca)) continue;
      const livre = luzes.find((luz) => !luz.peca);
      if (!livre) break;
      livre.peca = peca;
      livre.nivel = primeiraVez ? 1 : 0;
      livre.spot.position.copy(peca.luz.posicao);
      livre.spot.target.position.copy(peca.luz.alvo);
    }
    primeiraVez = false;
    for (const luz of luzes) luz.spot.intensity = LUZ.spot * luz.nivel * luz.nivel * (3 - 2 * luz.nivel);
  };
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

let _materialSombra;
function materialSombraDeContato() {
  if (_materialSombra) return _materialSombra;
  const textura = texturaDeCanvas(128, 128, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, w * 0.2, w / 2, h / 2, w / 2);
    g.addColorStop(0, "rgba(40,15,0,0.45)");
    g.addColorStop(1, "rgba(40,15,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
  _materialSombra = new THREE.MeshBasicMaterial({ map: textura, transparent: true, depthWrite: false });
  return _materialSombra;
}

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

  const sombra = new THREE.Mesh(new THREE.PlaneGeometry(lado * 2, lado * 2), materialSombraDeContato());
  sombra.rotation.x = -Math.PI / 2;
  sombra.rotation.z = giro;
  sombra.position.set(posicao.x, 0.002, posicao.z);
  cena.add(sombra);

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
}
