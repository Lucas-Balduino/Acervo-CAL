/*
  sincronizar-acervo.mjs — atualiza data/obras.json com a ficha do Tainacan
  e com as medidas lidas do próprio modelo 3D.

  Uso (na raiz do repositório):
    node ferramentas/sincronizar-acervo.mjs

  Para cada obra, busca o número de registro (cal-0607 → CAL.0607) na API
  pública do acervocal.unb.br e copia título, autoria, procedência etc.
  Campos escritos à mão (resumo, frente, poster, modelo) não são tocados.
  Se o acervo estiver fora do ar, mantém o que já está no arquivo.
  Obras com "semFicha": true (ainda não cadastradas no Tainacan) não são buscadas: os dados
  delas são escritos à mão, e só as medidas do modelo são atualizadas. Sem isso, o número de
  registro poderia trazer a ficha de outra peça (ex.: o Sapo, etiqueta CAL.307, e a CAL.0307 do acervo).
*/

import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { getBounds } from "@gltf-transform/functions";
import draco3d from "draco3dgltf";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const ARQUIVO = "data/obras.json";
const API = "https://www.acervocal.unb.br/wp-json/tainacan/v2/items/";

// Campo no obras.json ← slug do metadado no Tainacan
const CAMPOS = {
  titulo: "title-3",
  autoria: "autor",
  procedencia: "procedencia",
  colecao: "colecao",
  formaAquisicao: "forma-de-aquisicao",
  anoAquisicao: "data-de-aquisicao",
  materialTecnica: "material-tecnica",
  localProducao: "local-de-producao",
  dataProducao: "data-de-producao",
  dimensoesFicha: "dimensoes",
};

const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ "draco3d.decoder": await draco3d.createDecoderModule() });

const registroDe = (obra) => obra.registro || obra.id.toUpperCase().replace("-", ".");
const cm = (metros) => Math.round(metros * 1000) / 10;

async function buscarFicha(registro) {
  const url = `${API}?search=${encodeURIComponent(registro)}&perpage=5`;
  const resposta = await fetch(url, { signal: AbortSignal.timeout(20000) });
  if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`);
  const { items } = await resposta.json();
  return items.find((item) => item.metadata?.["numero-de-registro"]?.value_as_string === registro);
}

async function medir(caminho) {
  if (!existsSync(caminho)) return null;
  const doc = await io.read(caminho);
  const cena = doc.getRoot().getDefaultScene() || doc.getRoot().listScenes()[0];
  const { min, max } = getBounds(cena);
  const [largura, altura, profundidade] = max.map((v, i) => cm(v - min[i]));
  return { largura, altura, profundidade };
}

const obras = JSON.parse(readFileSync(ARQUIVO, "utf8"));
const atualizadas = [];

for (const obra of obras) {
  const registro = registroDe(obra);
  const nova = { id: obra.id, registro, ...obra };

  if (obra.semFicha) {
    console.log(`${registro}: sem ficha no acervo (semFicha); dados escritos à mão mantidos.`);
  } else try {
    const item = await buscarFicha(registro);
    if (!item) {
      console.warn(`${registro}: não encontrado no acervo.`);
    } else {
      for (const [campo, slug] of Object.entries(CAMPOS)) {
        nova[campo] = (item.metadata[slug]?.value_as_string || "").trim();
      }
      nova.urlAcervo = item.url;
      console.log(`${registro}: ficha atualizada (${nova.titulo}).`);
    }
  } catch (erro) {
    console.warn(`${registro}: acervo indisponível (${erro.message}); mantendo dados atuais.`);
  }

  const medidas = await medir(obra.modelo);
  if (medidas) nova.dimensoes = medidas;

  // Ordem fixa das chaves, para o arquivo ficar fácil de ler.
  const ordem = ["id", "registro", "titulo", "autoria", "resumo", ...Object.keys(CAMPOS), "dimensoes", "modelo", "poster", "frente", "destaque", "semFicha", "urlAcervo"];
  atualizadas.push(Object.fromEntries([...new Set([...ordem, ...Object.keys(nova)])].filter((k) => k in nova).map((k) => [k, nova[k] ?? ""])));
}

writeFileSync(ARQUIVO, JSON.stringify(atualizadas, null, 2) + "\n");
console.log(`${ARQUIVO}: ${atualizadas.length} obras.`);
