/*
  galeria.js — página Obras: busca, filtros, ordenação e grade de cartões.
  Os filtros guardam o estado no endereço (ex.: obras.html?procedencia=PNDA),
  então dá para compartilhar uma busca. Um filtro só aparece quando há pelo
  menos dois valores diferentes entre as obras.
*/

import { carregarObras, faixaDeTamanho, normalizar } from "./data.js";
import { criarCartao } from "./cartoes.js";

/** Filtros possíveis: chave no endereço, rótulo e como ler o valor da obra. */
const FACETAS = [
  { chave: "procedencia", rotulo: "Procedência", valor: (o) => o.procedencia },
  {
    chave: "tamanho",
    rotulo: "Tamanho",
    valor: faixaDeTamanho,
    ordem: ["Até 25 cm", "De 25 a 50 cm", "Acima de 50 cm"],
  },
  { chave: "material", rotulo: "Material e técnica", valor: (o) => o.materialTecnica },
  { chave: "local", rotulo: "Local de produção", valor: (o) => o.localProducao },
  { chave: "aquisicao", rotulo: "Ano de aquisição", valor: (o) => o.anoAquisicao },
  { chave: "colecao", rotulo: "Coleção", valor: (o) => o.colecao },
];

const ORDENS = {
  registro: (a, b) => (a.registro || a.id).localeCompare(b.registro || b.id, "pt-BR", { numeric: true }),
  titulo: (a, b) => (a.titulo || "").localeCompare(b.titulo || "", "pt-BR"),
  altura: (a, b) => (b.dimensoes?.altura || 0) - (a.dimensoes?.altura || 0),
};

const CAMPOS_DE_BUSCA = ["titulo", "registro", "autoria", "procedencia", "resumo", "materialTecnica", "localProducao"];

const grade = document.getElementById("grade");
const busca = document.getElementById("busca");
const ordem = document.getElementById("ordem");
const facetasEl = document.getElementById("facetas");
const contagem = document.getElementById("contagem");
const limpar = document.getElementById("limpar");
const formulario = document.getElementById("filtros");

const obras = await carregarObras();
const parametros = new URLSearchParams(location.search);

// Monta um <select> para cada filtro que faz sentido com as obras atuais.
const ativas = [];
for (const faceta of FACETAS) {
  const contas = new Map();
  for (const obra of obras) {
    const v = faceta.valor(obra);
    if (v) contas.set(v, (contas.get(v) || 0) + 1);
  }
  if (contas.size < 2) continue;

  const valores = [...contas.keys()].sort((a, b) =>
    faceta.ordem ? faceta.ordem.indexOf(a) - faceta.ordem.indexOf(b) : a.localeCompare(b, "pt-BR")
  );

  const rotulo = document.createElement("label");
  rotulo.className = "campo";
  const nome = document.createElement("span");
  nome.textContent = faceta.rotulo;
  const select = document.createElement("select");
  select.name = faceta.chave;
  select.add(new Option("Todas", ""));
  for (const v of valores) select.add(new Option(`${v} (${contas.get(v)})`, v));
  select.value = valores.includes(parametros.get(faceta.chave)) ? parametros.get(faceta.chave) : "";
  rotulo.append(nome, select);
  facetasEl.appendChild(rotulo);
  ativas.push({ ...faceta, select });
}

busca.value = parametros.get("q") || "";
if (ORDENS[parametros.get("ordem")]) ordem.value = parametros.get("ordem");

function desenhar() {
  const termos = normalizar(busca.value).split(/\s+/).filter(Boolean);
  const filtradas = obras
    .filter((obra) => {
      const texto = normalizar(CAMPOS_DE_BUSCA.map((c) => obra[c]).join(" "));
      if (!termos.every((t) => texto.includes(t))) return false;
      return ativas.every((f) => !f.select.value || f.valor(obra) === f.select.value);
    })
    .sort(ORDENS[ordem.value] || ORDENS.registro);

  grade.replaceChildren(...filtradas.map(criarCartao));

  const filtrando = termos.length > 0 || ativas.some((f) => f.select.value);
  if (filtradas.length === 0) {
    const vazio = document.createElement("p");
    vazio.className = "lista-vazia";
    vazio.textContent = obras.length
      ? "Nenhuma obra encontrada com esses filtros."
      : "Nenhuma obra cadastrada ainda.";
    grade.appendChild(vazio);
  }

  const n = filtradas.length;
  contagem.textContent =
    (n === 1 ? "1 obra" : `${n} obras`) + (filtrando ? ` de ${obras.length}` : "");
  limpar.hidden = !filtrando;

  // Guarda o estado no endereço, sem criar entradas novas no histórico.
  const novo = new URLSearchParams();
  if (busca.value.trim()) novo.set("q", busca.value.trim());
  for (const f of ativas) if (f.select.value) novo.set(f.chave, f.select.value);
  if (ordem.value !== "registro") novo.set("ordem", ordem.value);
  const consulta = novo.toString();
  history.replaceState(null, "", consulta ? `?${consulta}` : location.pathname);
}

formulario.addEventListener("input", desenhar);
formulario.addEventListener("submit", (evento) => evento.preventDefault());
limpar.addEventListener("click", () => {
  busca.value = "";
  for (const f of ativas) f.select.value = "";
  desenhar();
  busca.focus();
});

desenhar();
