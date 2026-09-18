/*
  data.js — lê data/obras.json.
  Não desenha interface. Se o arquivo faltar ou estiver inválido, devolve [].
*/

/**
 * @typedef {object} Obra
 * @property {string} id
 * @property {string} titulo
 * @property {string} autoria
 * @property {string} [resumo]
 * @property {string} modelo
 * @property {string} [poster]
 * @property {string} [urlAcervo]
 */

/**
 * @returns {Promise<Obra[]>}
 */
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
