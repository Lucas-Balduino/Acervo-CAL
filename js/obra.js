/*
  obra.js — página de uma obra (obra.html?id=cal-0000): carrega o modelo,
  preenche a ficha e liga os botões de câmera, de obra anterior/próxima e de download.
*/

import { carregarObras, linkDaObra, textoAutoria, textoDimensoes } from "./data.js";
import { ligarDownloads } from "./downloads.js";
import { iniciarViewer } from "./viewer.js";

const viewer = iniciarViewer({
  viewer: document.getElementById("viewer"),
  barra: document.getElementById("barra-progresso"),
  aviso: document.getElementById("aviso-viewer"),
  cubo: document.getElementById("cubo"),
  dica: document.getElementById("dica"),
});

document.getElementById("botao-reset").addEventListener("click", () => viewer.resetarCamera());

document.querySelectorAll("[data-vista]").forEach((face) => {
  face.addEventListener("click", () => {
    const [theta, phi] = face.dataset.vista.split(" ").map(Number);
    viewer.irPara(theta, phi);
  });
});

// Mesma ordem padrão da página Obras (número de registro), para "anterior/próxima" fazer sentido.
const obras = (await carregarObras()).sort((a, b) =>
  (a.registro || a.id).localeCompare(b.registro || b.id, "pt-BR", { numeric: true })
);
const id = new URLSearchParams(location.search).get("id");
const indice = obras.findIndex((o) => o.id === id);
const obra = obras[indice];

if (!obra) {
  document.title = "Obra não encontrada · Gêmeos Digitais CAL";
  document.getElementById("ficha-titulo").textContent = "Obra não encontrada";
  document.getElementById("ficha-autoria").textContent = "";
  viewer.mostrarAviso(id ? `Não há obra com o código “${id}”.` : "Nenhuma obra escolhida.");
  document.getElementById("ficha-resumo").textContent =
    "O endereço pode estar incompleto, ou a obra ainda não foi publicada. Escolha uma na lista de obras.";
  // Sem obra, os controles do 3D e as partes da ficha não têm o que mostrar.
  for (const seletor of [".cubo-caixa", "#botao-reset", "#dica", "#ficha-dados", ".ficha-nota"]) {
    document.querySelector(seletor).hidden = true;
  }
  // O botão do Acervo CAL vira o caminho de volta para a lista.
  const acervo = document.getElementById("ficha-acervo");
  acervo.textContent = "Ver todas as obras";
  acervo.href = "obras.html";
  acervo.classList.add("botao-primario");
  acervo.removeAttribute("target");
  acervo.removeAttribute("rel");
} else {
  document.title = `${obra.titulo} · Gêmeos Digitais CAL`;
  viewer.carregarModelo(obra);
  preencherFicha(obra);
  ligarDownloads(obra);
  ligarNavegacao(obras[indice - 1], obras[indice + 1]);
}

/** @param {import("./data.js").Obra} obra */
function preencherFicha(obra) {
  document.getElementById("ficha-registro").textContent = obra.registro || "";
  document.getElementById("ficha-titulo").textContent = obra.titulo || "Sem título";
  document.getElementById("ficha-autoria").textContent = textoAutoria(obra);
  document.getElementById("ficha-resumo").textContent = obra.resumo || "";

  const dados = document.getElementById("ficha-dados");
  const campos = [
    ["Procedência", obra.procedencia],
    ["Aquisição", [obra.formaAquisicao, obra.anoAquisicao].filter(Boolean).join(", ")],
    ["Coleção", obra.colecao],
    ["Material e técnica", obra.materialTecnica],
    ["Produção", [obra.localProducao, obra.dataProducao].filter(Boolean).join(", ")],
    ["Medidas (L × A × P)", textoDimensoes(obra)],
  ];
  for (const [rotulo, valor] of campos) {
    if (!valor) continue;
    const dt = document.createElement("dt");
    dt.textContent = rotulo;
    const dd = document.createElement("dd");
    dd.textContent = valor;
    dados.append(dt, dd);
  }

  const acervo = document.getElementById("ficha-acervo");
  if (obra.urlAcervo) acervo.href = obra.urlAcervo;
  else acervo.hidden = true;
}

function ligarNavegacao(anterior, proxima) {
  const nav = document.getElementById("ficha-navegacao");
  for (const [obra, sentido, rotulo] of [
    [anterior, "anterior", "← Anterior"],
    [proxima, "proxima", "Próxima →"],
  ]) {
    const link = document.createElement("a");
    link.className = sentido;
    if (obra) {
      link.href = linkDaObra(obra);
      const r = document.createElement("span");
      r.textContent = rotulo;
      const t = document.createElement("strong");
      t.textContent = obra.titulo;
      link.append(r, t);
    } else {
      link.setAttribute("aria-hidden", "true");
    }
    nav.appendChild(link);
  }

  // Setas do teclado trocam de obra quando o foco não está num campo.
  document.addEventListener("keydown", (evento) => {
    if (evento.target.closest("input, select, textarea, model-viewer, dialog")) return;
    if (evento.key === "ArrowLeft" && anterior) location.href = linkDaObra(anterior);
    if (evento.key === "ArrowRight" && proxima) location.href = linkDaObra(proxima);
  });
}
