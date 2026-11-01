/*
  museu-sala.js — constrói a sala do museu virtual com three.js, inspirada nas
  salas de exposição da CAL: paredes terracota, piso de taco em espinha de
  peixe, teto claro com trilhos de spots e pedestais da cor da parede.
  Cada obra entra num pedestal, ampliada (SALA.escalaDasObras) e virada pela sua "frente".
  Não cuida de câmera nem de cliques (isso está em museu-navegacao.js).

  Sistema de coordenadas: metros. A entrada fica em z = 0 e a sala avança
  para z negativo. A obra em destaque fica na parede do fundo; as outras
  se alternam nas paredes laterais, em fileiras.
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
  inicioDasFileiras: 2.6, // distância da entrada até a primeira fileira
  giroLateral: 0.45, // quanto as obras laterais se viram para quem entra (0 = de frente para o corredor)
  larguraTaco: 0.07, // m
};

const CORES = {
  parede: 0xa9452c, // terracota das salas da CAL
  rodape: 0x7f2f1d,
  pedestal: 0xa3412a,
  teto: 0xf1ebe5,
  trilho: 0xe9e6e1,
  luzSpot: 0xfff0dc,
  texto: "#212529",
  textoSuave: "#495057",
  textoParede: "#f7efe4",
  destaque: "#1d5c86",
};

/**
 * Onde cada obra fica: posição do pedestal e direção para onde a obra olha.
 * @param {import("./data.js").Obra[]} obras  já na ordem do percurso
 */
export function planejarSala(obras) {
  const indiceDestaque = Math.max(0, obras.findIndex((o) => o.destaque));
  const laterais = obras.filter((_, i) => i !== indiceDestaque);
  const fileiras = Math.max(1, Math.ceil(laterais.length / 2));
  const comprimento = SALA.inicioDasFileiras + (fileiras - 1) * SALA.espacoEntreFileiras + 3.1;
  const xLateral = SALA.largura / 2 - SALA.afastamentoDaParede;

  const lugares = [];
  laterais.forEach((obra, i) => {
    const fileira = Math.floor(i / 2);
    const esquerda = i % 2 === 0;
    lugares.push({
      obra,
      posicao: new THREE.Vector3(
        esquerda ? -xLateral : xLateral,
        0,
        -(SALA.inicioDasFileiras + fileira * SALA.espacoEntreFileiras)
      ),
      // Virada para o corredor e um pouco para a entrada, para ser vista de frente ao chegar.
      direcao: new THREE.Vector3(esquerda ? 1 : -1, 0, SALA.giroLateral).normalize(),
    });
  });
  if (obras.length) {
    lugares.push({
      obra: obras[indiceDestaque],
      posicao: new THREE.Vector3(0, 0, -comprimento + 1.1),
      direcao: new THREE.Vector3(0, 0, 1),
    });
  }
  return { lugares, comprimento };
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

  // Luz ambiente "de estúdio", parecida com a do visualizador (model-viewer, neutral).
  const pmrem = new THREE.PMREMGenerator(renderer);
  cena.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  cena.environmentIntensity = 0.75;

  const { lugares, comprimento } = planejarSala(obras);
  const limites = { xMin: -SALA.largura / 2, xMax: SALA.largura / 2, zMin: -comprimento, zMax: 0 };

  montarArquitetura(cena, comprimento, renderer, !leve);
  await document.fonts.load('700 48px "Roboto"').catch(() => {});
  montarTextosDeParede(cena, comprimento, obras.length);

  const pecas = lugares.map((lugar, indice) => montarPedestal(cena, lugar, indice, !leve));
  montarSpots(cena, pecas, comprimento, leve);

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

  return { cena, pecas, limites, comprimento };
}

/* ---------- Texturas desenhadas em canvas ---------- */

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

function montarArquitetura(cena, comprimento, renderer, sombras) {
  const { largura, peDireito } = SALA;
  const centroZ = -comprimento / 2;

  const taco = texturaDeTaco();
  taco.wrapS = taco.wrapT = THREE.RepeatWrapping;
  taco.center.set(0.5, 0.5);
  taco.rotation = Math.PI / 4;
  const repeticao = 8 * SALA.larguraTaco; // a peça repetida tem 2k = 8 tacos de largura
  taco.repeat.set(largura / repeticao, comprimento / repeticao);
  taco.anisotropy = renderer.capabilities.getMaxAnisotropy();

  const piso = new THREE.Mesh(
    new THREE.PlaneGeometry(largura, comprimento),
    new THREE.MeshStandardMaterial({ map: taco, roughness: 0.42, envMapIntensity: 0.55 })
  );
  piso.rotation.x = -Math.PI / 2;
  piso.position.set(0, 0, centroZ);
  piso.receiveShadow = sombras;
  piso.name = "piso";
  cena.add(piso);

  const teto = new THREE.Mesh(
    new THREE.PlaneGeometry(largura, comprimento),
    new THREE.MeshStandardMaterial({ color: CORES.teto, roughness: 1, emissive: CORES.teto, emissiveIntensity: 0.45 })
  );
  teto.rotation.x = Math.PI / 2;
  teto.position.set(0, peDireito, centroZ);
  cena.add(teto);

  const materialParede = new THREE.MeshStandardMaterial({ color: CORES.parede, roughness: 0.92, envMapIntensity: 0.5 });
  const materialRodape = new THREE.MeshStandardMaterial({ color: CORES.rodape, roughness: 0.8 });
  const materialFaixa = new THREE.MeshStandardMaterial({ color: CORES.teto, roughness: 1 });
  const parede = (larguraParede, x, z, rotacaoY) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(larguraParede, peDireito), materialParede);
    m.position.set(x, peDireito / 2, z);
    m.rotation.y = rotacaoY;
    m.receiveShadow = sombras;
    cena.add(m);

    const rodape = new THREE.Mesh(new THREE.BoxGeometry(larguraParede, 0.07, 0.015), materialRodape);
    rodape.position.set(x, 0.035, z);
    rodape.rotation.y = rotacaoY;
    rodape.translateZ(0.008);
    cena.add(rodape);

    // Faixa clara entre parede e teto, como nas salas da CAL.
    const faixa = new THREE.Mesh(new THREE.PlaneGeometry(larguraParede, 0.25), materialFaixa);
    faixa.position.set(x, peDireito - 0.125, z);
    faixa.rotation.y = rotacaoY;
    faixa.translateZ(0.002);
    cena.add(faixa);
  };
  parede(comprimento, -largura / 2, centroZ, Math.PI / 2); // esquerda
  parede(comprimento, largura / 2, centroZ, -Math.PI / 2); // direita
  parede(largura, 0, -comprimento, 0); // fundo
  parede(largura, 0, 0, Math.PI); // entrada

  cena.add(new THREE.HemisphereLight(0xfff6ee, 0x8a4a26, 0.35));

  // Luz geral do teto, com sombra suave (só no computador).
  const geral = new THREE.DirectionalLight(0xfff4e8, 0.55);
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
}

/* ---------- Trilhos e spots ---------- */

function montarSpots(cena, pecas, comprimento, leve) {
  const { largura, peDireito } = SALA;
  const yTrilho = peDireito - 0.06;
  const xTrilho = largura / 2 - SALA.afastamentoDaParede - 0.55;
  const materialTrilho = new THREE.MeshStandardMaterial({ color: CORES.trilho, roughness: 0.5, metalness: 0.2 });
  const materialLuminaria = new THREE.MeshStandardMaterial({ color: 0xf7f6f3, roughness: 0.4, metalness: 0.1 });
  const materialLente = new THREE.MeshBasicMaterial({ color: 0xfff7e8 });

  // Dois trilhos ao longo da sala e um atravessado perto do fundo.
  for (const x of [-xTrilho, xTrilho]) {
    const trilho = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.03, comprimento - 1), materialTrilho);
    trilho.position.set(x, yTrilho, -comprimento / 2);
    cena.add(trilho);
  }
  const zTravessa = -comprimento + 2.2;
  const travessa = new THREE.Mesh(new THREE.BoxGeometry(xTrilho * 2, 0.03, 0.035), materialTrilho);
  travessa.position.set(0, yTrilho, zTravessa);
  cena.add(travessa);

  const corpo = new THREE.CylinderGeometry(0.045, 0.055, 0.16, 20);
  corpo.rotateX(Math.PI / 2); // o cilindro passa a apontar para +Z (lookAt)
  const lente = new THREE.CircleGeometry(0.04, 20);
  lente.translate(0, 0, 0.081);

  for (const peca of pecas) {
    const destaque = peca.direcao.z > 0.99;
    const base = destaque
      ? new THREE.Vector3(0, yTrilho, zTravessa)
      : new THREE.Vector3(Math.sign(peca.posicao.x) * xTrilho, yTrilho, peca.posicao.z + 0.4);
    const alvo = new THREE.Vector3(peca.posicao.x, peca.topo + 0.2, peca.posicao.z);

    const luminaria = new THREE.Group();
    luminaria.position.copy(base).add(new THREE.Vector3(0, -0.12, 0));
    luminaria.add(new THREE.Mesh(corpo, materialLuminaria), new THREE.Mesh(lente, materialLente));
    luminaria.lookAt(alvo);
    const haste = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.1, 8), materialTrilho);
    haste.position.copy(base).add(new THREE.Vector3(0, -0.05, 0));
    cena.add(luminaria, haste);

    if (!leve) {
      const spot = new THREE.SpotLight(CORES.luzSpot, 14, 0, 0.32, 0.65, 2);
      spot.position.copy(luminaria.position);
      spot.target.position.copy(alvo);
      cena.add(spot, spot.target);
    }
  }
}

/* ---------- Textos de parede ---------- */

function montarTextosDeParede(cena, comprimento, quantidade) {
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
  titulo.position.set(0, 2.32, -comprimento + 0.01);
  cena.add(titulo);

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
      "Cada peça desta sala foi escaneada na CAL com um scanner 3D. " +
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

function montarPedestal(cena, lugar, indice, sombras) {
  const { obra, posicao, direcao } = lugar;
  const e = SALA.escalaDasObras;
  const real = obra.dimensoes || { largura: 30, profundidade: 30, altura: 30 };
  const d = { largura: real.largura * e, profundidade: real.profundidade * e, altura: real.altura * e };
  const lado = Math.max(0.5, Math.max(d.largura, d.profundidade) / 100 + 0.24);
  const altura = SALA.alturaPedestal;
  const giro = Math.atan2(direcao.x, direcao.z);

  const pedestal = new THREE.Mesh(
    new THREE.BoxGeometry(lado, altura, lado),
    new THREE.MeshStandardMaterial({ color: CORES.pedestal, roughness: 0.85, envMapIntensity: 0.5 })
  );
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
  const caixa = new THREE.Box3().setFromObject(modelo);
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
