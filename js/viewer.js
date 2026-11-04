/*
  viewer.js — controla o <model-viewer>: carregar .glb, progresso, câmera e cubo.
  Não lê o JSON nem preenche a ficha; recebe o objeto da obra já escolhido.

  As vistas do cubo são relativas à "frente" da obra (campo frente, em graus),
  então "Frente" sempre mostra o lado principal da peça.
*/

const ALTURA_INICIAL = 78; // graus a partir do topo: um pouco acima da linha do olhar

// Distância da câmera: em telas estreitas (palco mais alto que largo) afasta um pouco mais.
const raio = () => (window.matchMedia("(max-width: 860px)").matches ? "130%" : "115%");

/**
 * @param {object} refs
 * @param {HTMLElement} refs.viewer
 * @param {HTMLElement} refs.barra
 * @param {HTMLElement} refs.aviso
 * @param {HTMLElement} refs.cubo
 * @param {HTMLElement} [refs.dica]
 */
export function iniciarViewer({ viewer, barra, aviso, cubo, dica }) {
  let frente = 0;

  viewer.addEventListener("progress", (evento) => {
    const progresso = evento.detail.totalProgress ?? 0;
    barra.style.width = `${progresso * 100}%`;
    if (progresso >= 1) {
      window.setTimeout(() => {
        barra.style.width = "0";
      }, 300);
    }
  });

  viewer.addEventListener("error", () => {
    mostrarAviso("Não foi possível carregar este modelo. Confira o caminho em data/obras.json e o arquivo em models/.");
  });

  viewer.addEventListener("load", () => {
    aviso.classList.remove("visivel");
    aviso.textContent = "";
  });

  viewer.addEventListener("camera-change", (evento) => {
    const orbita = viewer.getCameraOrbit();
    const theta = orbita.theta * (180 / Math.PI) - frente;
    const phi = orbita.phi * (180 / Math.PI);
    cubo.style.transform = `rotateX(${phi - 90}deg) rotateY(${-theta}deg)`;
    if (dica && evento.detail.source === "user-interaction") dica.classList.add("oculta");
  });

  function mostrarAviso(texto) {
    aviso.textContent = texto;
    aviso.classList.add("visivel");
  }

  function irPara(theta, phi) {
    viewer.cameraOrbit = `${frente + theta}deg ${phi}deg ${raio()}`;
    viewer.jumpCameraToGoal();
  }

  return {
    /** @param {import("./data.js").Obra} obra */
    carregarModelo(obra) {
      frente = Number(obra.frente) || 0;
      aviso.classList.remove("visivel");
      barra.style.width = "0";
      if (obra.poster) viewer.poster = obra.poster;
      else viewer.removeAttribute("poster");
      viewer.alt = `Modelo 3D de ${obra.titulo}`;
      viewer.cameraOrbit = `${frente}deg ${ALTURA_INICIAL}deg ${raio()}`;
      viewer.src = obra.modelo || "";
    },

    resetarCamera() {
      irPara(0, ALTURA_INICIAL);
    },

    /** Vista relativa à frente da obra (ex.: 90, 90 = lado esquerdo). */
    irPara,

    mostrarAviso,
  };
}
