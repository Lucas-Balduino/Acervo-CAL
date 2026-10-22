/*
  gallery.js — lista e busca na sidebar.
  Recebe as obras já carregadas e avisa o main.js quando uma é escolhida.
*/

/**
 * @param {HTMLElement} listaEl
 * @param {HTMLInputElement} buscaEl
 * @param {object[]} obras
 * @param {(obra: object) => void} aoEscolher
 */
export function iniciarGaleria(listaEl, buscaEl, obras, aoEscolher) {
  let idAtivo = null;

  function desenhar() {
    const termo = buscaEl.value.trim().toLowerCase();
    const filtradas = obras.filter((obra) => {
      const texto = `${obra.titulo} ${obra.autoria}`.toLowerCase();
      return texto.includes(termo);
    });

    listaEl.replaceChildren();

    if (filtradas.length === 0) {
      const vazio = document.createElement("p");
      vazio.className = "lista-vazia";
      vazio.textContent = obras.length
        ? "Nenhuma obra com esse termo."
        : "Nenhuma obra em data/obras.json. Veja data/LEIA-ME.md.";
      listaEl.appendChild(vazio);
      return;
    }

    filtradas.forEach((obra) => {
      const botao = document.createElement("button");
      botao.type = "button";
      botao.className = "item-obra" + (obra.id === idAtivo ? " ativa" : "");
      botao.setAttribute("aria-pressed", obra.id === idAtivo ? "true" : "false");

      const titulo = document.createElement("span");
      titulo.className = "item-obra-titulo";
      titulo.textContent = obra.titulo || "Sem título";

      const autor = document.createElement("span");
      autor.className = "item-obra-autor";
      autor.textContent = obra.autoria || "";

      botao.append(titulo, autor);
      botao.addEventListener("click", () => {
        idAtivo = obra.id;
        desenhar();
        aoEscolher(obra);
      });
      listaEl.appendChild(botao);
    });
  }

  buscaEl.addEventListener("input", desenhar);
  desenhar();

  return {
    /** Marca a obra ativa e redesenha (usado ao abrir a primeira peça). */
    selecionar(obra) {
      idAtivo = obra.id;
      desenhar();
    },
  };
}
