/*
  downloads.js — janela "Baixar modelo 3D" da página da obra: a pessoa escolhe a qualidade (leve ou
  alta resolução) e baixa no formato que precisa (GLB, OBJ ou STL), direto do GitHub Releases.
  Endereço, faces e tamanhos vêm do campo "downloads" de data/obras.json, gravado por
  ferramentas/downloads.mjs; obra sem esse campo fica sem o botão.
  Não gera nem guarda arquivos: só monta os links. Usa o <dialog> do navegador (Esc fecha).
*/

import { linkDaObra } from "./data.js";

/** Ano de publicação dos modelos, usado no "como citar" (o mesmo de ferramentas/downloads.mjs). */
const ANO_DOS_MODELOS = 2026;

const FORMATOS = [
  { chave: "glb", nome: "GLB", uso: "Para ver em 3D", texto: "Abre no Blender, no Visualizador 3D do Windows e em sites. Com cor." },
  { chave: "obj", nome: "OBJ", uso: "Para editar e estudar", texto: "Abre em quase todo programa 3D (Blender, MeshLab, CloudCompare). Com cor." },
  { chave: "stl", nome: "STL", uso: "Para imprimir em 3D", texto: "Abre no fatiador da impressora (Cura, PrusaSlicer, Bambu Studio). Sem cor, em milímetros." },
];

// "unica": obra com um só modelo (ex.: as do ExScan, sem o escaneamento completo); aí não há escolha de qualidade.
const NOMES = { leve: "leve", alta: "alta resolução", unica: "qualidade única" };

const ICONE_BAIXAR =
  '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4v11"/><path d="m7 10 5 5 5-5"/><path d="M5 20h14"/></svg>';

const numero = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });

/** "7,4 MB", "350 MB", "1,2 GB" (em potências de 1024, como o Windows mostra; espaço que não quebra a linha). */
export function textoTamanho(bytes) {
  const mb = bytes / 1024 ** 2;
  if (mb >= 1000) return `${numero.format(mb / 1024)} GB`;
  return `${mb >= 100 ? Math.round(mb) : numero.format(mb)} MB`;
}

/** "217 mil faces", "1,5 milhão de faces", "6,7 milhões de faces" */
export function textoFaces(faces) {
  if (faces >= 1e6) {
    const milhoes = Math.round(faces / 1e5) / 10;
    return `${numero.format(milhoes)} ${milhoes < 2 ? "milhão" : "milhões"} de faces`;
  }
  return `${Math.round(faces / 1000)} mil faces`;
}

/** @param {import("./data.js").Obra & {downloads?: object}} obra */
export function ligarDownloads(obra) {
  const botao = document.getElementById("botao-download");
  const janela = document.getElementById("janela-download");
  const d = obra.downloads;
  if (!d?.endereco || !botao || !janela || typeof janela.showModal !== "function") return;

  const lista = document.getElementById("download-formatos");
  const citacao = `Casa da Cultura da América Latina (CAL/UnB). ${obra.titulo} (${obra.registro}). Modelo 3D, projeto Gêmeos Digitais CAL, ${ANO_DOS_MODELOS}. Disponível em: ${new URL(linkDaObra(obra), location.href).href}`;

  document.getElementById("download-obra").textContent = `${obra.registro} · ${obra.titulo}`;
  document.getElementById("download-citacao").textContent = citacao;
  const resumo = (nivel) => {
    const maior = Math.max(...FORMATOS.map((f) => d[nivel]?.[f.chave] || 0));
    return `${textoFaces(d[nivel].faces)} · até ${textoTamanho(maior)}`;
  };
  const unica = !(d.alta && d.leve);
  if (unica) {
    const nivel = d.unica ? "unica" : d.alta ? "alta" : "leve";
    janela.querySelector(`input[value="${nivel}"]`)?.click();
    document.getElementById("download-qualidade").hidden = true;
    document.getElementById("download-legenda-formato").textContent = "Escolha o formato";
    const aviso = document.getElementById("download-unica");
    aviso.textContent = `Esta obra tem uma só versão, a mesma exibida no site: ${resumo(nivel)}.`;
    aviso.hidden = false;
  } else {
    for (const nivel of ["leve", "alta"]) janela.querySelector(`[data-faces="${nivel}"]`).textContent = resumo(nivel);
  }
  const pagina = document.getElementById("download-pagina");
  if (d.pagina) pagina.href = d.pagina;
  else pagina.hidden = true;

  function montarLista(nivel) {
    lista.replaceChildren(
      ...FORMATOS.filter((f) => d[nivel]?.[f.chave]).map((formato) => {
        const tamanho = textoTamanho(d[nivel][formato.chave]);
        const item = document.createElement("li");
        const link = document.createElement("a");
        link.className = "download-item";
        link.href = `${d.endereco}${obra.id}-${nivel}-${formato.chave}.zip`;
        link.setAttribute("download", "");
        link.setAttribute("aria-label", `Baixar ${formato.nome}, ${NOMES[nivel]}, ${tamanho}: ${formato.uso[0].toLowerCase()}${formato.uso.slice(1)}`);
        link.innerHTML = `
          <span class="download-formato">${formato.nome}</span>
          <span class="download-info"><strong>${formato.uso}</strong><span>${formato.texto}</span></span>
          <span class="download-tamanho">${tamanho}${ICONE_BAIXAR}</span>`;
        item.appendChild(link);
        return item;
      })
    );
  }

  const escolhida = () => (d.unica ? "unica" : janela.querySelector('input[name="qualidade"]:checked')?.value || "leve");
  janela.querySelectorAll('input[name="qualidade"]').forEach((opcao) => opcao.addEventListener("change", () => montarLista(escolhida())));
  montarLista(escolhida());

  botao.hidden = false;
  botao.addEventListener("click", () => janela.showModal());
  janela.querySelector("[data-fechar]").addEventListener("click", () => janela.close());
  // Clique fora da caixa (no fundo escurecido) fecha.
  janela.addEventListener("click", (evento) => {
    if (evento.target === janela) janela.close();
  });

  const copiar = document.getElementById("download-copiar");
  copiar.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(citacao);
      copiar.textContent = "Copiado";
    } catch {
      getSelection().selectAllChildren(document.getElementById("download-citacao"));
      copiar.textContent = "Selecionado";
    }
    setTimeout(() => (copiar.textContent = "Copiar"), 2000);
  });
}
