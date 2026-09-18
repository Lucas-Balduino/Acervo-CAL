/*
  viewer.js — controla o <model-viewer>: carregar .glb, progresso, câmera e cubo.
  Não lê o JSON; recebe o objeto da obra já escolhido.
*/

const ORBITA_INICIAL = "45deg 75deg 105%";

/**
 * @param {object} refs
 * @param {HTMLElement} refs.viewer
 * @param {HTMLElement} refs.barra
 * @param {HTMLElement} refs.aviso
 * @param {HTMLElement} refs.cubo
 */
export function iniciarViewer({ viewer, barra, aviso, cubo }) {
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

  viewer.addEventListener("camera-change", () => {
    const orbita = viewer.getCameraOrbit();
    cubo.style.transform = `rotateX(${orbita.phi * (180 / Math.PI) - 90}deg) rotateY(${-orbita.theta * (180 / Math.PI)}deg)`;
  });

  function mostrarAviso(texto) {
    aviso.textContent = texto;
    aviso.classList.add("visivel");
  }

  return {
    /**
     * @param {object} obra
     */
    carregarModelo(obra) {
      aviso.classList.remove("visivel");
      barra.style.width = "0";
      viewer.src = obra.modelo || "";
      if (obra.poster) {
        viewer.setAttribute("poster", obra.poster);
      } else {
        viewer.removeAttribute("poster");
      }
      viewer.cameraOrbit = ORBITA_INICIAL;
      viewer.jumpCameraToGoal();
    },

    resetarCamera() {
      viewer.cameraOrbit = ORBITA_INICIAL;
      viewer.jumpCameraToGoal();
    },

    rotacionarPara(orbit) {
      viewer.cameraOrbit = orbit;
      viewer.jumpCameraToGoal();
    },

    mostrarAviso,
  };
}
