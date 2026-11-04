/*
  fotos.js — visor de fotos em tela inteira: ao clicar numa foto de uma galeria, abre a foto grande
  com a legenda, e dá para passar entre elas (setas na tela, setas do teclado ou deslizando o dedo).
  Usa o <dialog> do navegador (Esc fecha e o foco volta para a foto). Não monta a galeria em si:
  recebe as <figure> (com <img> e <figcaption>) que já estão na página.
*/

/**
 * @param {HTMLElement[]} figuras  cada uma com <img> e <figcaption>
 * @param {HTMLDialogElement} visor
 */
export function ligarVisor(figuras, visor) {
  if (!figuras.length || !visor || typeof visor.showModal !== "function") return;

  const imagem = visor.querySelector(".visor-imagem");
  const legenda = visor.querySelector(".visor-legenda");
  const contador = visor.querySelector(".visor-contador");
  const fotos = figuras.map((figura) => ({
    src: figura.querySelector("img").currentSrc || figura.querySelector("img").src,
    alt: figura.querySelector("img").alt,
    legenda: figura.querySelector("figcaption")?.textContent.trim() ?? "",
  }));
  let atual = 0;

  // Cada foto vira um botão (sem JS, ela continua só uma imagem).
  figuras.forEach((figura, i) => {
    const img = figura.querySelector("img");
    const botao = document.createElement("button");
    botao.type = "button";
    botao.className = "foto-abrir";
    botao.setAttribute("aria-label", `Ampliar foto ${i + 1} de ${fotos.length}: ${fotos[i].legenda}`);
    img.replaceWith(botao);
    botao.appendChild(img);
    botao.addEventListener("click", () => abrir(i));
  });

  function mostrar(indice) {
    atual = (indice + fotos.length) % fotos.length;
    const foto = fotos[atual];
    imagem.classList.add("trocando");
    imagem.onload = () => imagem.classList.remove("trocando");
    imagem.src = foto.src;
    imagem.alt = foto.alt;
    if (imagem.complete) imagem.classList.remove("trocando");
    legenda.textContent = foto.legenda;
    contador.textContent = `${atual + 1} de ${fotos.length}`;
  }

  function abrir(indice) {
    mostrar(indice);
    document.documentElement.classList.add("visor-aberto"); // a página atrás não rola
    visor.showModal();
  }

  visor.addEventListener("close", () => document.documentElement.classList.remove("visor-aberto"));
  visor.querySelector(".visor-fechar").addEventListener("click", () => visor.close());
  visor.querySelector(".visor-anterior").addEventListener("click", () => mostrar(atual - 1));
  visor.querySelector(".visor-proxima").addEventListener("click", () => mostrar(atual + 1));

  visor.addEventListener("keydown", (evento) => {
    if (evento.key === "ArrowLeft") mostrar(atual - 1);
    if (evento.key === "ArrowRight") mostrar(atual + 1);
  });

  // Clicar no fundo escuro (fora da foto, da legenda e dos botões) fecha.
  visor.addEventListener("click", (evento) => {
    if (evento.target === visor || evento.target.classList.contains("visor-palco")) visor.close();
  });

  // Deslizar o dedo para os lados troca de foto.
  let inicioX = null;
  visor.addEventListener("pointerdown", (evento) => {
    if (evento.pointerType !== "mouse") inicioX = evento.clientX;
  });
  visor.addEventListener("pointerup", (evento) => {
    if (inicioX === null) return;
    const deslocamento = evento.clientX - inicioX;
    inicioX = null;
    if (Math.abs(deslocamento) > 50) mostrar(atual + (deslocamento < 0 ? 1 : -1));
  });
}
