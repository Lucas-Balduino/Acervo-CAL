/*
  museu-contorno.js — contorno claro em volta da obra sob o mouse (ou tocada no
  celular), para mostrar que dá para clicar nela.

  Como funciona: a obra é desenhada sozinha, em branco, numa imagem à parte (a
  "máscara"); depois, por cima da cena já pronta, um retângulo do tamanho da tela
  pinta uma linha onde a máscara termina. Só trabalha enquanto há contorno na
  tela, e o contorno aparece e some aos poucos.

  Não decide qual obra contornar (isso vem de museu.js) nem desenha a cena.
*/

import * as THREE from "three";

const CAMADA = 1; // camada do three.js usada só para desenhar a máscara
const ESPESSURA = 2.2; // px de tela (antes da densidade de pixels)
const COR = new THREE.Color(0xfff4e6);
const VELOCIDADE = 6; // quanto maior, mais rápido aparece e some

/** @param {THREE.WebGLRenderer} renderer */
export function criarContorno(renderer) {
  const mascara = new THREE.WebGLRenderTarget(1, 1);
  const branco = new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false });

  const pintura = new THREE.ShaderMaterial({
    uniforms: {
      tMascara: { value: mascara.texture },
      uPasso: { value: new THREE.Vector2() },
      uCor: { value: COR },
      uOpacidade: { value: 0 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4(position.xy, 0.0, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D tMascara;
      uniform vec2 uPasso;
      uniform vec3 uCor;
      uniform float uOpacidade;
      varying vec2 vUv;
      void main() {
        float dentro = texture2D(tMascara, vUv).r;
        // Maior valor da máscara num anel em volta do ponto (dois raios, para a linha ficar cheia).
        float perto = 0.0;
        for (int i = 0; i < 16; i++) {
          float a = float(i) * 0.3926991;
          vec2 d = vec2(cos(a), sin(a)) * uPasso;
          perto = max(perto, texture2D(tMascara, vUv + d).r);
          perto = max(perto, texture2D(tMascara, vUv + d * 0.5).r);
        }
        float linha = clamp(perto - dentro, 0.0, 1.0);
        gl_FragColor = vec4(uCor, linha * uOpacidade);
      }`,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });
  // Um triângulo que cobre a tela toda.
  const geometria = new THREE.BufferGeometry();
  geometria.setAttribute("position", new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
  geometria.setAttribute("uv", new THREE.Float32BufferAttribute([0, 0, 2, 0, 0, 2], 2));
  const tela = new THREE.Mesh(geometria, pintura);
  tela.frustumCulled = false;
  const cenaDaTela = new THREE.Scene();
  cenaDaTela.add(tela);
  const cameraDaTela = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  let objeto = null; // obra contornada agora
  let alvo = null; // obra que deve ficar contornada
  let opacidade = 0;
  let piscando = 0; // segundos até o contorno do toque sumir
  const tamanho = new THREE.Vector2();
  const corDeFundo = new THREE.Color();

  const marcar = (obj, ligado) =>
    obj?.traverse((filho) => (ligado ? filho.layers.enable(CAMADA) : filho.layers.disable(CAMADA)));

  /** Obra a contornar (um THREE.Object3D) ou null. */
  function mostrar(novo) {
    piscando = 0;
    alvo = novo || null;
  }

  /** Contorno rápido, para o toque no celular: aparece e some sozinho. */
  function piscar(novo) {
    alvo = novo || null;
    piscando = 0.9;
  }

  /** Desenha o contorno por cima da cena (chamar logo depois de renderer.render). */
  function desenhar(cena, camera, dt) {
    if (piscando > 0) {
      piscando -= dt;
      if (piscando <= 0) alvo = null;
    }
    // Troca de obra: a nova entra no lugar; sem obra, o contorno some e só então solta a antiga.
    if (alvo && alvo !== objeto) {
      marcar(objeto, false);
      objeto = alvo;
      marcar(objeto, true);
      opacidade = 0;
    }
    opacidade = THREE.MathUtils.clamp(opacidade + (alvo ? 1 : -1) * dt * VELOCIDADE, 0, 1);
    if (!objeto) return;
    if (opacidade === 0 && !alvo) {
      marcar(objeto, false);
      objeto = null;
      return;
    }

    renderer.getDrawingBufferSize(tamanho);
    if (mascara.width !== tamanho.x || mascara.height !== tamanho.y) mascara.setSize(tamanho.x, tamanho.y);

    // Máscara: só a obra, em branco, sobre fundo preto.
    const fundo = cena.background;
    const camadas = camera.layers.mask;
    renderer.getClearColor(corDeFundo);
    const alfaDeFundo = renderer.getClearAlpha();
    cena.background = null;
    cena.overrideMaterial = branco;
    camera.layers.set(CAMADA);
    renderer.setRenderTarget(mascara);
    renderer.setClearColor(0x000000, 1);
    renderer.clear();
    renderer.render(cena, camera);
    renderer.setRenderTarget(null);
    renderer.setClearColor(corDeFundo, alfaDeFundo);
    camera.layers.mask = camadas;
    cena.overrideMaterial = null;
    cena.background = fundo;

    // Linha por cima da cena.
    const espessura = ESPESSURA * renderer.getPixelRatio();
    pintura.uniforms.uPasso.value.set(espessura / tamanho.x, espessura / tamanho.y);
    pintura.uniforms.uOpacidade.value = opacidade * (piscando > 0 ? Math.min(1, piscando / 0.3) : 1);
    const limpar = renderer.autoClear;
    renderer.autoClear = false;
    renderer.render(cenaDaTela, cameraDaTela);
    renderer.autoClear = limpar;
  }

  return { mostrar, piscar, desenhar };
}
