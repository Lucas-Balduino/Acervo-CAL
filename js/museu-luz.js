/*
  museu-luz.js — a luz do museu calculada direto nos shaders, sem luzes extras
  do three.js:

  - um spot por obra, com facho de borda suave e luz que cai com a distância;
  - a sombra que o pedestal e a obra fazem nesse facho, na parede e no chão
    (a obra entra como um elipsoide do tamanho dela, então a sombra é suave);
  - o escurecimento suave dos cantos (parede com chão, teto e outra parede, e o
    chão em volta dos pedestais), que dá a sensação de luz "assada" da referência.

  Como a luz é calculada em cada ponto da superfície, a mancha na parede e no
  chão fica certa de qualquer ângulo, e o celular vê a mesma luz do computador.
  Custa pouco: cada ponto só considera os spots da própria sala.

  Não cria malhas nem luzes: só altera materiais (onBeforeCompile). As medidas
  da sala vêm de museu-sala.js.
*/

import * as THREE from "three";

/**
 * @param {object} p
 * @param {number} p.quantidade  número de obras (um spot para cada)
 * @param {{zMax: number, zMin: number}[]} p.divisorias  paredes entre as salas
 * @param {{largura: number, peDireito: number, alturaPedestal: number, larguraPassagem: number}} p.sala
 * @param {number} p.comprimento  da entrada (z = 0) até o fundo
 * @param {{cor: number, intensidade: number, abertura: number, penumbra: number, abertaHalo: number, halo: number, sombraObra: number}} p.spot
 */
export function criarLuz({ quantidade, divisorias, sala, comprimento, spot }) {
  const n = Math.max(1, quantidade);
  const m = Math.max(1, divisorias.length);
  const vetores = (k) => Array.from({ length: k }, () => new THREE.Vector4());

  // Sem divisórias, uma de mentira bem longe (nunca fica entre dois pontos do museu).
  const listaDivisorias = vetores(m);
  listaDivisorias.forEach((v) => v.set(1e4, 1e4, 1e4, 0));
  divisorias.forEach((d, i) => listaDivisorias[i].set(d.zMax, d.zMin, (d.zMax + d.zMin) / 2, 0));
  const salaDe = (z) => listaDivisorias.reduce((s, d) => s + (d.z >= z && d.z < 1e3 ? 1 : 0), 0);

  const uniformes = {
    uLuzA: { value: vetores(n) }, // posição da luminária (xyz), intensidade em candela (w)
    uLuzB: { value: vetores(n) }, // direção do facho (xyz), sala da obra (w)
    uPedestal: { value: vetores(n) }, // centro x, centro z, giro, meio lado
    uForma: { value: vetores(n) }, // raio x, meia altura, raio z, giro da obra
    uDivisorias: { value: listaDivisorias }, // zMax, zMin, meio
    uSala: { value: new THREE.Vector4(sala.largura / 2, sala.peDireito, sala.alturaPedestal, sala.larguraPassagem / 2) },
    uExtremos: { value: new THREE.Vector2(0, -comprimento) },
    uCorSpot: { value: new THREE.Color(spot.cor) },
    uCone: {
      value: new THREE.Vector4(
        Math.cos(spot.abertura),
        Math.cos(spot.abertura * (1 - spot.penumbra)),
        Math.cos(spot.abertaHalo),
        spot.halo
      ),
    },
    uSombraObra: { value: spot.sombraObra },
  };

  const declaracoes = /* glsl */ `
    #define N_OBRAS ${n}
    #define N_DIVISORIAS ${m}
    varying vec3 vPosMundo;
    uniform vec4 uLuzA[N_OBRAS];
    uniform vec4 uLuzB[N_OBRAS];
    uniform vec4 uPedestal[N_OBRAS];
    uniform vec4 uForma[N_OBRAS];
    uniform vec4 uDivisorias[N_DIVISORIAS];
    uniform vec4 uSala;
    uniform vec2 uExtremos;
    uniform vec3 uCorSpot;
    uniform vec4 uCone;
    uniform float uSombraObra;

    // Do mundo para o sistema do objeto girado em y (o inverso de rotation.y do three.js).
    vec2 paraLocal(vec2 v, float giro) {
      float c = cos(giro);
      float s = sin(giro);
      return vec2(c * v.x - s * v.y, s * v.x + c * v.y);
    }

    // Distância (com sinal) de um ponto a um retângulo centrado na origem.
    float distCaixa(vec2 p, vec2 meio) {
      vec2 d = abs(p) - meio;
      return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
    }

    float salaDe(float z) {
      float s = 0.0;
      for (int i = 0; i < N_DIVISORIAS; i++) s += step(z, uDivisorias[i].z) * step(uDivisorias[i].z, 1e3);
      return s;
    }

    // Força do facho: miolo com borda suave e um halo fraco em volta.
    float facho(float cosAngulo) {
      return smoothstep(uCone.x, uCone.y, cosAngulo) + uCone.w * smoothstep(uCone.z, uCone.y, cosAngulo);
    }

    // O raio de luz que sai do ponto p até a luminária passa pelo pedestal?
    // Visto de cima, o trecho do raio abaixo do topo do pedestal é um segmento: basta medir
    // a menor distância dele ao quadrado do pedestal. A borda fica um pouco suave.
    float sombraDoPedestal(vec3 p, vec3 luz, vec4 ped) {
      float topo = uSala.z;
      if (p.y >= topo) return 1.0;
      float t = min((topo - p.y) / max(luz.y - p.y, 1e-3), 1.0);
      vec2 a = paraLocal(p.xz - ped.xy, ped.z);
      vec2 b = paraLocal(mix(p.xz, luz.xz, t) - ped.xy, ped.z);
      vec2 ab = b - a;
      float k = clamp(-dot(a, ab) / max(dot(ab, ab), 1e-6), 0.0, 1.0);
      vec2 meio = vec2(ped.w);
      float d = min(distCaixa(a, meio), distCaixa(b, meio));
      d = min(d, distCaixa(a + ab * k, meio));
      d = min(d, distCaixa(a + ab * clamp(k - 0.2, 0.0, 1.0), meio));
      d = min(d, distCaixa(a + ab * clamp(k + 0.2, 0.0, 1.0), meio));
      float penumbra = 0.005 + 0.03 * max(distCaixa(a, meio), 0.0);
      return smoothstep(-penumbra, penumbra, d);
    }

    // Sombra suave da obra, tratada como um elipsoide do tamanho dela, em cima do pedestal.
    // Pontos do topo do pedestal que caem dentro do elipsoide (debaixo da obra) também ficam
    // na sombra: tratá-los como iluminados abria um disco claro com borda sob a peça.
    float sombraDaObra(vec3 p, vec3 luz, vec4 ped, vec4 forma) {
      vec3 centro = vec3(ped.x, uSala.z + forma.y, ped.y);
      vec3 a = p - centro;
      vec3 b = luz - centro;
      a.xz = paraLocal(a.xz, forma.w);
      b.xz = paraLocal(b.xz, forma.w);
      vec3 raios = max(forma.xyz, vec3(0.02));
      a /= raios;
      b /= raios;
      vec3 ab = b - a;
      float k = clamp(-dot(a, ab) / max(dot(ab, ab), 1e-6), 0.0, 1.0);
      float d = length(a + ab * k);
      return mix(1.0 - uSombraObra, 1.0, smoothstep(0.55, 1.15, d));
    }

    float canto(float d, float forca, float alcance) {
      return 1.0 - forca * exp(-max(d, 0.0) / alcance);
    }

    // Escurecimento suave perto dos cantos da sala e em volta dos pedestais.
    float oclusaoDaSala(vec3 p, vec3 n, float sala) {
      float dLateral = uSala.x - abs(p.x);
      float dPonta = min(uExtremos.x - p.z, p.z - uExtremos.y);
      float dDivisoria = 1e3;
      for (int i = 0; i < N_DIVISORIAS; i++) {
        dDivisoria = min(dDivisoria, max(p.z - uDivisorias[i].x, uDivisorias[i].y - p.z));
      }
      // 0 na passagem do meio, 1 onde a parede entre salas é cheia.
      float cheia = smoothstep(uSala.w - 0.02, uSala.w + 0.12, abs(p.x));
      float ao = 1.0;
      if (n.y > 0.5) {
        if (p.y < 0.02) {
          ao *= canto(dLateral, 0.45, 0.32);
          ao *= canto(dPonta, 0.45, 0.32);
          ao *= mix(1.0, canto(dDivisoria, 0.45, 0.32), cheia);
          for (int i = 0; i < N_OBRAS; i++) {
            if (abs(uLuzB[i].w - sala) > 0.5) continue;
            vec4 ped = uPedestal[i];
            ao *= canto(distCaixa(paraLocal(p.xz - ped.xy, ped.z), vec2(ped.w)), 0.5, 0.13);
          }
        } else {
          // Topo do pedestal: uma mancha suave sob a obra, mais escura no meio e sem borda.
          // (Antes era a elipse inteira da pegada escurecida por igual, e em peças largas e
          // vazadas, como o sapo de patas abertas, aparecia como um disco.)
          for (int i = 0; i < N_OBRAS; i++) {
            if (abs(uLuzB[i].w - sala) > 0.5) continue;
            vec4 ped = uPedestal[i];
            if (distCaixa(paraLocal(p.xz - ped.xy, ped.z), vec2(ped.w)) > 0.01) continue;
            vec4 forma = uForma[i];
            vec2 q = paraLocal(p.xz - ped.xy, forma.w) / max(forma.xz, vec2(0.02));
            ao *= 1.0 - 0.3 * exp(-2.5 * dot(q, q));
          }
        }
      } else if (n.y < -0.5) {
        if (p.y > uSala.y - 0.02) {
          ao *= canto(dLateral, 0.35, 0.4);
          ao *= canto(min(dPonta, dDivisoria), 0.35, 0.4);
        }
      } else {
        ao *= canto(p.y, 0.45, 0.28);
        ao *= canto(uSala.y - p.y, 0.3, 0.3);
        if (abs(n.x) > 0.5) {
          // Paredes laterais: escurecem perto das paredes que as encontram.
          if (dLateral < 0.05) ao *= canto(min(dPonta, dDivisoria), 0.4, 0.3);
        } else {
          ao *= canto(dLateral, 0.4, 0.3);
        }
      }
      return ao;
    }
  `;

  // Spots da sala: cada um soma luz como uma luz direta do three.js (difusa e brilho),
  // separada do resto para o escurecimento dos cantos não apagar as manchas de luz.
  const spotsDaSala = /* glsl */ `
    vec3 nMundo = normalize((vec4(geometryNormal, 0.0) * viewMatrix).xyz);
    float salaAqui = salaDe(vPosMundo.z);
    ReflectedLight luzDosSpots = ReflectedLight(vec3(0.0), vec3(0.0), vec3(0.0), vec3(0.0));
    for (int i = 0; i < N_OBRAS; i++) {
      if (abs(uLuzB[i].w - salaAqui) > 0.5) continue;
      vec3 posLuz = uLuzA[i].xyz;
      vec3 paraLuz = posLuz - vPosMundo;
      float distancia = length(paraLuz);
      vec3 l = paraLuz / distancia;
      float forca = facho(dot(-l, uLuzB[i].xyz));
      if (forca <= 0.0 || dot(nMundo, l) <= 0.0) continue;
      vec3 q = vPosMundo + nMundo * 0.02;
      forca *= sombraDoPedestal(q, posLuz, uPedestal[i]) * sombraDaObra(q, posLuz, uPedestal[i], uForma[i]);
      if (forca <= 0.0) continue;
      IncidentLight luzSpot;
      luzSpot.direction = normalize((viewMatrix * vec4(l, 0.0)).xyz);
      luzSpot.color = uCorSpot * (uLuzA[i].w * forca / max(distancia * distancia, 0.01));
      luzSpot.visible = true;
      RE_Direct(luzSpot, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, luzDosSpots);
    }
  `;

  const oclusao = /* glsl */ `
    float aoSala = oclusaoDaSala(vPosMundo, nMundo, salaAqui);
    reflectedLight.indirectDiffuse *= aoSala;
    reflectedLight.indirectSpecular *= aoSala;
    reflectedLight.directDiffuse *= mix(1.0, aoSala, 0.6);
    totalEmissiveRadiance *= aoSala;
    reflectedLight.directDiffuse += luzDosSpots.directDiffuse;
    reflectedLight.directSpecular += luzDosSpots.directSpecular;
  `;

  const posicaoNoMundo = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vPosMundo;")
      .replace("#include <project_vertex>", "#include <project_vertex>\nvPosMundo = (modelMatrix * vec4(transformed, 1.0)).xyz;");
  };

  /** Paredes, piso, teto, acabamentos e pedestais: spots com sombra e cantos escurecidos. */
  function prepararMaterialDaSala(material) {
    material.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, uniformes);
      posicaoNoMundo(shader);
      shader.fragmentShader = shader.fragmentShader
        .replace("#include <common>", `#include <common>\n${declaracoes}`)
        .replace("#include <lights_fragment_begin>", `#include <lights_fragment_begin>\n${spotsDaSala}`)
        .replace("#include <aomap_fragment>", `#include <aomap_fragment>\n${oclusao}`);
    };
    material.customProgramCacheKey = () => `museu-sala-${n}-${m}`;
    return material;
  }

  /** Material de uma obra: só o spot dela, sem sombras (o resto da aparência não muda). */
  function prepararMaterialDaObra(material, indice) {
    // Os vetores são os mesmos das listas: mudar a luz da obra (definirObra) muda aqui também.
    const proprios = {
      uLuzObra: { value: uniformes.uLuzA.value[indice] },
      uDirObra: { value: uniformes.uLuzB.value[indice] },
      uCorSpot: uniformes.uCorSpot,
      uCone: uniformes.uCone,
    };
    material.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, proprios);
      posicaoNoMundo(shader);
      shader.fragmentShader = shader.fragmentShader
        .replace(
          "#include <common>",
          /* glsl */ `#include <common>
          varying vec3 vPosMundo;
          uniform vec4 uLuzObra;
          uniform vec4 uDirObra;
          uniform vec3 uCorSpot;
          uniform vec4 uCone;`
        )
        .replace(
          "#include <lights_fragment_begin>",
          /* glsl */ `#include <lights_fragment_begin>
          {
            vec3 paraLuz = uLuzObra.xyz - vPosMundo;
            float distancia = length(paraLuz);
            vec3 l = paraLuz / distancia;
            float cosAngulo = dot(-l, uDirObra.xyz);
            float forca = smoothstep(uCone.x, uCone.y, cosAngulo) + uCone.w * smoothstep(uCone.z, uCone.y, cosAngulo);
            if (forca > 0.0) {
              IncidentLight luzSpot;
              luzSpot.direction = normalize((viewMatrix * vec4(l, 0.0)).xyz);
              luzSpot.color = uCorSpot * (uLuzObra.w * forca / max(distancia * distancia, 0.01));
              luzSpot.visible = true;
              RE_Direct(luzSpot, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight);
            }
          }`
        );
    };
    material.customProgramCacheKey = () => "museu-obra";
    material.needsUpdate = true;
    return material;
  }

  /**
   * Dados de uma obra: luminária, pedestal e forma da obra (para a sombra).
   * @param {number} i
   * @param {{luz: THREE.Vector3, alvo: THREE.Vector3, intensidade: number, pedestal: {x: number, z: number, giro: number, lado: number}}} dados
   */
  function definirObra(i, { luz, alvo, intensidade, pedestal }) {
    const direcao = alvo.clone().sub(luz).normalize();
    uniformes.uLuzA.value[i].set(luz.x, luz.y, luz.z, intensidade);
    uniformes.uLuzB.value[i].set(direcao.x, direcao.y, direcao.z, salaDe(pedestal.z));
    uniformes.uPedestal.value[i].set(pedestal.x, pedestal.z, pedestal.giro, pedestal.lado / 2);
  }

  /** Tamanho da obra (m, já ampliada) e giro, para a sombra dela. */
  function definirForma(i, tamanho, giro) {
    uniformes.uForma.value[i].set(tamanho.x / 2, tamanho.y / 2, tamanho.z / 2, giro);
  }

  return { prepararMaterialDaSala, prepararMaterialDaObra, definirObra, definirForma };
}
