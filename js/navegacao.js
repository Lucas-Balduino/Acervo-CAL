/*
  navegacao.js — abre e fecha o menu do cabeçalho no celular.
  Carregado em todas as páginas. No computador o menu fica sempre visível (CSS).
*/

const botao = document.querySelector(".botao-menu");
const menu = document.getElementById("menu");

if (botao && menu) {
  const definir = (aberto) => {
    menu.classList.toggle("aberto", aberto);
    botao.setAttribute("aria-expanded", String(aberto));
  };

  botao.addEventListener("click", () => definir(!menu.classList.contains("aberto")));

  document.addEventListener("keydown", (evento) => {
    if (evento.key === "Escape" && menu.classList.contains("aberto")) {
      definir(false);
      botao.focus();
    }
  });

  document.addEventListener("click", (evento) => {
    if (!menu.contains(evento.target) && !botao.contains(evento.target)) definir(false);
  });
}
