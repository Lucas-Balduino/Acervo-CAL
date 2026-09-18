/*
  ui.js — tela de entrada, sidebar, gaveta de texto.
  Não fala com o model-viewer nem com o JSON.
*/

/**
 * @param {object} els
 */
export function iniciarUI(els) {
  els.botaoEntrar.addEventListener("click", () => {
    els.entrada.classList.add("oculta");
    window.setTimeout(() => {
      els.entrada.hidden = true;
    }, 450);
  });

  els.botaoSidebar.addEventListener("click", () => {
    const recolhida = els.sidebar.classList.toggle("recolhida");
    els.botaoSidebar.setAttribute("aria-expanded", String(!recolhida));
    els.botaoSidebar.textContent = recolhida ? "›" : "‹";
  });

  els.botaoFicha.addEventListener("click", () => abrirGaveta());
  els.botaoFecharGaveta.addEventListener("click", () => fecharGaveta());

  function abrirGaveta() {
    els.gaveta.classList.add("aberta");
    els.gaveta.setAttribute("aria-hidden", "false");
  }

  function fecharGaveta() {
    els.gaveta.classList.remove("aberta");
    els.gaveta.setAttribute("aria-hidden", "true");
  }

  /**
   * Preenche o cartão inferior e a gaveta com o texto da obra.
   * @param {object} obra
   */
  function mostrarObra(obra) {
    els.overlayInfo.classList.add("visivel");
    els.tituloAtivo.textContent = obra.titulo || "Obra";
    els.conteudoGaveta.replaceChildren();

    const nome = document.createElement("p");
    nome.className = "titulo-obra";
    nome.textContent = obra.titulo || "Sem título";
    els.conteudoGaveta.appendChild(nome);

    adicionarCampo("Autoria", obra.autoria);
    if (obra.resumo) adicionarCampo("Aproximação", obra.resumo);

    if (obra.urlAcervo) {
      const dt = document.createElement("dt");
      dt.textContent = "Ficha no Acervo CAL";
      const dd = document.createElement("dd");
      const link = document.createElement("a");
      link.href = obra.urlAcervo;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = "Ver informações técnicas no acervo 2D";
      dd.appendChild(link);
      els.conteudoGaveta.append(dt, dd);
    }
  }

  function adicionarCampo(rotulo, valor) {
    if (!valor) return;
    const dt = document.createElement("dt");
    dt.textContent = rotulo;
    const dd = document.createElement("dd");
    dd.textContent = valor;
    els.conteudoGaveta.append(dt, dd);
  }

  return { mostrarObra, abrirGaveta, fecharGaveta };
}
