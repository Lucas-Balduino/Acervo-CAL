/*
  data.js — lê data/obras.json (e os textos das coleções, data/colecoes.json) e formata
  os dados de uma obra para exibição. Não desenha interface. Se um arquivo faltar ou
  estiver inválido, devolve vazio ([] ou {}).
*/

/** Meta do projeto PJ772-2026: quantas obras serão digitalizadas. */
export const META_DE_OBRAS = 20;

/**
 * @typedef {object} Obra
 * @property {string} id            pasta em models/ (ex.: "cal-0607")
 * @property {string} registro      número de registro no acervo (ex.: "CAL.0607")
 * @property {string} titulo
 * @property {string} [autoria]
 * @property {string} [resumo]
 * @property {string} [procedencia]
 * @property {string} [colecao]
 * @property {string} [formaAquisicao]
 * @property {string} [anoAquisicao]
 * @property {string} [materialTecnica]
 * @property {string} [localProducao]
 * @property {string} [dataProducao]
 * @property {{largura:number, altura:number, profundidade:number}} [dimensoes]  em cm, do modelo 3D
 * @property {string} modelo
 * @property {string} [poster]
 * @property {number} [frente]      ângulo (graus) da vista inicial
 * @property {boolean} [destaque]   aparece na página inicial
 * @property {string} [urlAcervo]
 */

/** @returns {Promise<Obra[]>} */
export async function carregarObras() {
  try {
    const resposta = await fetch("data/obras.json");
    if (!resposta.ok) {
      console.error("Não foi possível ler data/obras.json", resposta.status);
      return [];
    }
    const dados = await resposta.json();
    return Array.isArray(dados) ? dados : [];
  } catch (erro) {
    console.error("Erro ao carregar o catálogo local.", erro);
    return [];
  }
}

/**
 * Textos das coleções (data/colecoes.json), por nome: { "Chocó": { texto, fonte } }.
 * @returns {Promise<Record<string, {texto: string, fonte?: string}>>}  {} se o arquivo faltar
 */
export async function carregarColecoes() {
  try {
    const resposta = await fetch("data/colecoes.json");
    return resposta.ok ? await resposta.json() : {};
  } catch (erro) {
    console.error("Erro ao carregar os textos das coleções.", erro);
    return {};
  }
}

export function linkDaObra(obra) {
  return `obra.html?id=${encodeURIComponent(obra.id)}`;
}

export function textoAutoria(obra) {
  return obra.autoria || "Autoria não identificada";
}

const numero = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });

/** "19,1 × 40,7 × 19,3 cm" (largura × altura × profundidade) */
export function textoDimensoes(obra) {
  const d = obra.dimensoes;
  if (!d) return "";
  return `${numero.format(d.largura)} × ${numero.format(d.altura)} × ${numero.format(d.profundidade)} cm`;
}

/** Faixa de tamanho pela altura do modelo — usada no filtro da galeria. */
export function faixaDeTamanho(obra) {
  const altura = obra.dimensoes?.altura;
  if (!altura) return "";
  if (altura < 25) return "Até 25 cm";
  if (altura < 50) return "De 25 a 50 cm";
  return "Acima de 50 cm";
}

/** Linha curta para cartões: "Governo de Santa Catarina · 1993" */
export function textoProcedencia(obra) {
  return [obra.procedencia, obra.anoAquisicao].filter(Boolean).join(" · ");
}

/** Texto sem acento e em minúsculas, para a busca achar "maos" em "mãos". */
export function normalizar(texto) {
  return String(texto || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}
