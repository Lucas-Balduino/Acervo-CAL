/*
  cartoes.js — monta o cartão de uma obra (miniatura + título + registro).
  Usado na página inicial e na página Obras. Não filtra nem ordena.
*/

import { linkDaObra, textoProcedencia } from "./data.js";

/**
 * @param {import("./data.js").Obra} obra
 * @returns {HTMLAnchorElement}
 */
export function criarCartao(obra) {
  const cartao = document.createElement("a");
  cartao.className = "cartao";
  cartao.href = linkDaObra(obra);

  const imagem = document.createElement("div");
  imagem.className = "cartao-imagem";
  if (obra.poster) {
    const img = document.createElement("img");
    img.src = obra.poster;
    img.alt = "";
    img.loading = "lazy";
    img.decoding = "async";
    img.width = 480;
    img.height = 600;
    imagem.appendChild(img);
  }
  const selo = document.createElement("span");
  selo.className = "cartao-selo";
  selo.textContent = "3D";
  selo.setAttribute("aria-hidden", "true");
  imagem.appendChild(selo);

  const texto = document.createElement("div");
  texto.className = "cartao-texto";

  const registro = document.createElement("span");
  registro.className = "cartao-registro";
  registro.textContent = obra.registro || "";

  const titulo = document.createElement("h3");
  titulo.className = "cartao-titulo";
  titulo.textContent = obra.titulo || "Sem título";

  const meta = document.createElement("p");
  meta.className = "cartao-meta";
  meta.textContent = textoProcedencia(obra);

  texto.append(registro, titulo, meta);
  cartao.append(imagem, texto);
  return cartao;
}
