/*
  museu-sala.js — constrói a sala do museu virtual com three.js:
  piso, paredes, teto, luz, textos de parede e um pedestal por obra,
  com a obra carregada em tamanho real e virada pela sua "frente".
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
  largura: 7,
  peDireito: 3.4,
  espacoEntreFileiras: 3.2,
  alturaPedestal: 1.0,
  afastamentoDaParede: 1.1,
  inicioDasFileiras: 3.6, // distância da entrada até a primeira fileira
  giroLateral: 0.55, // quanto as obras laterais se viram para quem entra (0 = de frente para o corredor)
};

const CORES = {
  piso: 0xb3ada4,
  parede: 0xf3f1ed,
  paredeFundo: 0xd6c7b0, // areia da CAL
  teto: 0xe6e4e0,
  rodape: 0x3a3a3a,
  pedestal: 0xfbfbfa,
  luminaria: 0xffffff,
  texto: "#212529",
  textoSuave: "#495057",
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
  const comprimento = SALA.inicioDasFileiras + (fileiras - 1) * SALA.espacoEntreFileiras + 5;
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
      posicao: new THREE.Vector3(0, 0, -comprimento + 1.6),
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
 * @param {boolean} [opcoes.sombras]
 */
export async function montarSala(renderer, obras, { aoProgresso = () => {}, sombras = true } = {}) {
  const cena = new THREE.Scene();
  cena.background = new THREE.Color(CORES.teto);

  // Luz ambiente "de estúdio", parecida com a do visualizador (model-viewer, neutral).
  const pmrem = new THREE.PMREMGenerator(renderer);
  cena.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  cena.environmentIntensity = 0.9;

  const { lugares, comprimento } = planejarSala(obras);
  const limites = {
    xMin: -SALA.largura / 2,
    xMax: SALA.largura / 2,
    zMin: -comprimento,
    zMax: 0,
  };

  montarArquitetura(cena, comprimento, sombras);
  await document.fonts.load('700 48px "Roboto"').catch(() => {});
  montarTextosDeParede(cena, comprimento, obras.length);

  const loader = new GLTFLoader();
  const draco = new DRACOLoader();
  draco.setDecoderPath("https://cdn.jsdelivr.net/npm/three@0.169.0/examples/jsm/libs/draco/gltf/");
  loader.setDRACOLoader(draco);

  const pecas = lugares.map((lugar, indice) => montarPedestal(cena, lugar, indice, sombras));

  let carregadas = 0;
  aoProgresso(0, pecas.length);
  await Promise.all(
    pecas.map(async (peca) => {
      try {
        const gltf = await loader.loadAsync(peca.obra.modelo);
        colocarObra(peca, gltf.scene, sombras);
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

/* ---------- Arquitetura ---------- */

function montarArquitetura(cena, comprimento, sombras) {
  const { largura, peDireito } = SALA;
  const centroZ = -comprimento / 2;

  const piso = new THREE.Mesh(
    new THREE.PlaneGeometry(largura, comprimento),
    new THREE.MeshStandardMaterial({ color: CORES.piso, roughness: 0.85, envMapIntensity: 0.45 })
  );
  piso.rotation.x = -Math.PI / 2;
  piso.position.set(0, 0, centroZ);
  piso.receiveShadow = sombras;
  piso.name = "piso";
  cena.add(piso);

  const teto = new THREE.Mesh(
    new THREE.PlaneGeometry(largura, comprimento),
    new THREE.MeshStandardMaterial({ color: CORES.teto, roughness: 1, envMapIntensity: 0.6 })
  );
  teto.rotation.x = Math.PI / 2;
  teto.position.set(0, peDireito, centroZ);
  cena.add(teto);

  const materialParede = new THREE.MeshStandardMaterial({ color: CORES.parede, roughness: 0.95, envMapIntensity: 0.6 });
  const parede = (larguraParede, cor, x, z, rotacaoY) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(larguraParede, peDireito),
      cor ? new THREE.MeshStandardMaterial({ color: cor, roughness: 0.95, envMapIntensity: 0.6 }) : materialParede
    );
    m.position.set(x, peDireito / 2, z);
    m.rotation.y = rotacaoY;
    m.receiveShadow = sombras;
    cena.add(m);

    const rodape = new THREE.Mesh(
      new THREE.BoxGeometry(larguraParede, 0.08, 0.02),
      new THREE.MeshStandardMaterial({ color: CORES.rodape, roughness: 0.6 })
    );
    rodape.position.set(x, 0.04, z);
    rodape.rotation.y = rotacaoY;
    rodape.translateZ(0.01);
    cena.add(rodape);
  };
  parede(comprimento, null, -largura / 2, centroZ, Math.PI / 2); // esquerda
  parede(comprimento, null, largura / 2, centroZ, -Math.PI / 2); // direita
  parede(largura, CORES.paredeFundo, 0, -comprimento, 0); // fundo
  parede(largura, null, 0, 0, Math.PI); // entrada

  // Luminárias: faixas claras no teto (só visuais) + luz real.
  const materialLuminaria = new THREE.MeshBasicMaterial({ color: CORES.luminaria });
  for (let z = -1.8; z > -comprimento + 1; z -= 2.8) {
    for (const x of [-1.6, 1.6]) {
      const faixa = new THREE.Mesh(new THREE.PlaneGeometry(0.25, 2.2), materialLuminaria);
      faixa.rotation.x = Math.PI / 2;
      faixa.position.set(x, peDireito - 0.01, z);
      cena.add(faixa);
    }
  }

  cena.add(new THREE.HemisphereLight(0xffffff, CORES.piso, 0.25));

  const sol = new THREE.DirectionalLight(0xffffff, 0.9);
  sol.position.set(1.5, peDireito * 2, centroZ + 2);
  sol.target.position.set(0, 0, centroZ);
  cena.add(sol, sol.target);
  if (sombras) {
    sol.castShadow = true;
    sol.shadow.mapSize.set(2048, 2048);
    const c = sol.shadow.camera;
    c.left = -largura / 2 - 1;
    c.right = largura / 2 + 1;
    c.top = comprimento / 2 + 1;
    c.bottom = -comprimento / 2 - 1;
    c.near = 1;
    c.far = peDireito * 3;
    sol.shadow.bias = -0.0005;
    sol.shadow.normalBias = 0.02;
    sol.shadow.radius = 4;
  }
}

/* ---------- Textos de parede (desenhados num canvas) ---------- */

function texturaDeTexto(larguraPx, alturaPx, desenhar) {
  const canvas = document.createElement("canvas");
  canvas.width = larguraPx;
  canvas.height = alturaPx;
  const ctx = canvas.getContext("2d");
  desenhar(ctx, larguraPx, alturaPx);
  const textura = new THREE.CanvasTexture(canvas);
  textura.colorSpace = THREE.SRGBColorSpace;
  textura.anisotropy = 4;
  return textura;
}

function painelDeTexto(larguraM, alturaM, textura) {
  return new THREE.Mesh(
    new THREE.PlaneGeometry(larguraM, alturaM),
    new THREE.MeshBasicMaterial({ map: textura, transparent: true, toneMapped: false })
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

function montarTextosDeParede(cena, comprimento, quantidade) {
  // Título na parede do fundo, acima da obra em destaque.
  const titulo = painelDeTexto(
    4.4,
    0.9,
    texturaDeTexto(1760, 360, (ctx, w) => {
      ctx.fillStyle = CORES.texto;
      ctx.textAlign = "center";
      ctx.font = '700 150px "Roboto", sans-serif';
      ctx.fillText("Gêmeos Digitais CAL", w / 2, 170);
      ctx.fillStyle = CORES.textoSuave;
      ctx.font = '400 62px "Roboto", sans-serif';
      ctx.fillText("Acervo da Casa da Cultura da América Latina · UnB", w / 2, 290);
    })
  );
  titulo.position.set(0, 2.45, -comprimento + 0.01);
  cena.add(titulo);

  // Texto de abertura, na parede esquerda perto da entrada.
  const apresentacao = painelDeTexto(
    1.5,
    1.1,
    texturaDeTexto(900, 660, (ctx, w) => {
      ctx.fillStyle = CORES.destaque;
      ctx.font = '500 34px "Roboto", sans-serif';
      ctx.fillText("MUSEU VIRTUAL", 0, 44);
      ctx.fillStyle = CORES.texto;
      ctx.font = '700 64px "Roboto", sans-serif';
      ctx.fillText("Obras em 3D", 0, 130);
      ctx.fillStyle = CORES.textoSuave;
      ctx.font = '400 36px "Roboto", sans-serif';
      const texto =
        "Cada peça desta sala foi escaneada na CAL e aparece no seu tamanho real. " +
        "Aproxime-se de uma obra para ver a ficha e abri-la em detalhe.";
      quebrarLinhas(ctx, texto, w - 20).forEach((linha, i) => ctx.fillText(linha, 0, 210 + i * 52));
    })
  );
  apresentacao.position.set(-SALA.largura / 2 + 0.01, 1.6, -1.4);
  apresentacao.rotation.y = Math.PI / 2;
  cena.add(apresentacao);

  // Progresso do projeto, na parede direita perto da entrada.
  const progresso = painelDeTexto(
    1.5,
    1.1,
    texturaDeTexto(900, 660, (ctx, w) => {
      ctx.fillStyle = CORES.destaque;
      ctx.font = '500 34px "Roboto", sans-serif';
      ctx.fillText("PROJETO DE EXTENSÃO PJ772-2026", 0, 44);
      ctx.fillStyle = CORES.texto;
      ctx.font = '700 140px "Roboto", sans-serif';
      ctx.fillText(`${quantidade}`, 0, 190);
      const larguraNumero = ctx.measureText(`${quantidade}`).width;
      ctx.font = '400 48px "Roboto", sans-serif';
      ctx.fillStyle = CORES.textoSuave;
      ctx.fillText("de 20 obras digitalizadas", larguraNumero + 20, 190);
      ctx.fillStyle = "#d6c7b0";
      ctx.fillRect(0, 230, w, 10);
      ctx.fillStyle = CORES.destaque;
      ctx.fillRect(0, 230, (w * Math.min(quantidade, 20)) / 20, 10);
      ctx.fillStyle = CORES.textoSuave;
      ctx.font = '400 36px "Roboto", sans-serif';
      const texto = "Laboratório Protip, Instituto de Artes da UnB, com a Casa da Cultura da América Latina.";
      quebrarLinhas(ctx, texto, w - 20).forEach((linha, i) => ctx.fillText(linha, 0, 320 + i * 52));
    })
  );
  progresso.position.set(SALA.largura / 2 - 0.01, 1.6, -1.4);
  progresso.rotation.y = -Math.PI / 2;
  cena.add(progresso);
}

/* ---------- Pedestais e obras ---------- */

let _materialSombra;
function materialSombraDeContato() {
  if (_materialSombra) return _materialSombra;
  const textura = texturaDeTexto(128, 128, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, w * 0.18, w / 2, h / 2, w / 2);
    g.addColorStop(0, "rgba(0,0,0,0.38)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
  _materialSombra = new THREE.MeshBasicMaterial({ map: textura, transparent: true, depthWrite: false });
  return _materialSombra;
}

function montarPedestal(cena, lugar, indice, sombras) {
  const { obra, posicao, direcao } = lugar;
  const d = obra.dimensoes || { largura: 30, profundidade: 30, altura: 30 };
  const lado = Math.max(0.42, Math.max(d.largura, d.profundidade) / 100 + 0.16);
  const altura = SALA.alturaPedestal;

  const pedestal = new THREE.Mesh(
    new THREE.BoxGeometry(lado, altura, lado),
    new THREE.MeshStandardMaterial({ color: CORES.pedestal, roughness: 0.7 })
  );
  pedestal.position.set(posicao.x, altura / 2, posicao.z);
  pedestal.rotation.y = Math.atan2(direcao.x, direcao.z);
  pedestal.castShadow = sombras;
  pedestal.receiveShadow = sombras;
  pedestal.userData.indice = indice;
  cena.add(pedestal);

  // Sombra suave no chão em volta do pedestal (barata; funciona mesmo sem sombras em tempo real).
  const sombra = new THREE.Mesh(new THREE.PlaneGeometry(lado * 2.2, lado * 2.2), materialSombraDeContato());
  sombra.rotation.x = -Math.PI / 2;
  sombra.position.set(posicao.x, 0.002, posicao.z);
  sombra.rotation.z = pedestal.rotation.y;
  cena.add(sombra);

  // Plaquinha com título na face do pedestal voltada para o visitante.
  const placa = painelDeTexto(
    0.34,
    0.13,
    texturaDeTexto(680, 260, (ctx, w, h) => {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = CORES.destaque;
      ctx.font = '500 34px "Roboto", sans-serif';
      ctx.fillText(obra.registro || "", 28, 56);
      ctx.fillStyle = CORES.texto;
      ctx.font = '700 46px "Roboto", sans-serif';
      const linhas = quebrarLinhas(ctx, obra.titulo || "", w - 56).slice(0, 2);
      linhas.forEach((linha, i) => ctx.fillText(linha, 28, 120 + i * 56));
      ctx.fillStyle = CORES.textoSuave;
      ctx.font = '400 30px "Roboto", sans-serif';
      ctx.fillText([obra.procedencia, obra.anoAquisicao].filter(Boolean).join(" · "), 28, 120 + linhas.length * 56 + 14);
    })
  );
  const frenteDoPedestal = posicao.clone().addScaledVector(direcao, lado / 2 + 0.003);
  placa.position.set(frenteDoPedestal.x, altura - 0.14, frenteDoPedestal.z);
  placa.lookAt(frenteDoPedestal.clone().add(direcao).setY(altura - 0.14));
  cena.add(placa);

  return {
    obra,
    indice,
    posicao,
    direcao,
    pedestal,
    raio: (lado / 2) * Math.SQRT2,
    topo: altura,
    grupo: null,
    centro: new THREE.Vector3(posicao.x, altura + (d.altura || 30) / 200, posicao.z),
    altura: (d.altura || 30) / 100,
  };
}

/** Coloca o modelo em cima do pedestal, centralizado e com a frente virada para o visitante. */
function colocarObra(peca, modelo, sombras) {
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
  grupo.rotation.y = direcao - frente;
  grupo.position.set(peca.posicao.x, peca.topo, peca.posicao.z);
  peca.grupo = grupo;
  peca.altura = tamanho.y;
  peca.centro.set(peca.posicao.x, peca.topo + tamanho.y / 2, peca.posicao.z);
  peca.pedestal.parent.add(grupo);
}
