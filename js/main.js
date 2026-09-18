/*
  main.js — ponto de partida.
  Ordem: carregar JSON → ligar UI e visualizador → montar lista → abrir a primeira obra.
*/

import { carregarObras } from "./data.js";
import { iniciarGaleria } from "./gallery.js";
import { iniciarViewer } from "./viewer.js";
import { iniciarUI } from "./ui.js";

const ui = iniciarUI({
  entrada: document.getElementById("entrada"),
  botaoEntrar: document.getElementById("botao-entrar"),
  sidebar: document.getElementById("sidebar"),
  botaoSidebar: document.getElementById("botao-sidebar"),
  overlayInfo: document.getElementById("overlay-info"),
  tituloAtivo: document.getElementById("titulo-ativo"),
  botaoFicha: document.getElementById("botao-ficha"),
  gaveta: document.getElementById("gaveta"),
  botaoFecharGaveta: document.getElementById("botao-fechar-gaveta"),
  conteudoGaveta: document.getElementById("conteudo-gaveta"),
});

const viewer = iniciarViewer({
  viewer: document.getElementById("viewer"),
  barra: document.getElementById("barra-progresso"),
  aviso: document.getElementById("aviso-viewer"),
  cubo: document.getElementById("cubo"),
});

document.getElementById("botao-reset").addEventListener("click", () => {
  viewer.resetarCamera();
});

document.querySelectorAll("[data-orbit]").forEach((face) => {
  face.addEventListener("click", () => {
    viewer.rotacionarPara(face.getAttribute("data-orbit"));
  });
});

const obras = await carregarObras();

const galeria = iniciarGaleria(
  document.getElementById("lista-obras"),
  document.getElementById("busca"),
  obras,
  escolherObra
);

if (obras.length === 0) {
  viewer.mostrarAviso("Nenhuma obra cadastrada. Adicione itens em data/obras.json e os arquivos em models/.");
} else {
  galeria.selecionar(obras[0]);
  escolherObra(obras[0]);
}

function escolherObra(obra) {
  viewer.carregarModelo(obra);
  ui.mostrarObra(obra);
}
