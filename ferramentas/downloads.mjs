/*
  downloads.mjs — prepara os arquivos do botão "Baixar modelo 3D" da página da obra.
  A partir do .blend de alta resolução, o Blender (sem janela, com exportar-downloads.py) gera duas
  qualidades — alta (a malha inteira) e leve (simplificada) — em GLB, OBJ e STL, cada uma num .zip.
  Malha que já é leve (até --faces-leve faces, como as do ExScan) sai numa só qualidade, "unica".
  A peça sai virada e com a cor iguais às do modelo do site: o giro é medido no Blender e a cor por
  igualar-cor.mjs (a textura passa por uma curva de cor; --sem-igualar-cor desliga). Avisa se as medidas
  não batem com as do site (sinal de que a malha não é a mesma).
  Com --enviar, manda os .zip para o release "modelos-<id>" do GitHub (criado como rascunho, que só o
  dono do repositório vê) e grava em data/obras.json o endereço e o tamanho de cada arquivo.
  Não mexe no .blend nem no modelo do site (models/<id>/modelo.glb), e não publica o release.

  Uso:
    node ferramentas/downloads.mjs <id> <arquivo-alta.blend> [--faces-leve 500000] [--textura-leve 4096]
      [--sem-igualar-cor] [--enviar]

  Os .zip ficam em <pasta do .blend>/downloads/. O Blender é procurado em
  "C:/Program Files/Blender Foundation" (a versão mais nova); outro caminho pode ser dado com BLENDER=...
  Para publicar o release (os links do site passam a funcionar para todos):
    gh release edit modelos-<id> --draft=false
*/

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ARQUIVO_OBRAS = join(RAIZ, "data/obras.json");
const SCRIPT_BLENDER = join(RAIZ, "ferramentas/exportar-downloads.py");
const SITE = "https://lucas-balduino.github.io/Acervo-CAL/";
const ANO = 2026; // ano de publicação dos modelos, usado no "como citar"
// Malha com até --faces-leve faces (ex.: obras do ExScan, só com o modelo do site) sai numa só qualidade, "unica".
const NIVEIS = { alta: "Alta resolução", leve: "Leve", unica: "Única" };
const FORMATOS = { glb: "GLB (metros, com cor)", obj: "OBJ (milímetros, com cor)", stl: "STL (milímetros, sem cor)" };
// Diferença de cor (média do |log| da razão de luz) a partir da qual a textura é corrigida: ~4%.
const DIFERENCA_DE_COR = 0.04;
const porcento = (d) => `${Math.round((Math.exp(d) - 1) * 100)}%`;

// --- Argumentos ---
const args = process.argv.slice(2);
const opcao = (nome, padrao) => {
  const i = args.indexOf(nome);
  return i >= 0 ? args.splice(i, 2)[1] : padrao;
};
const enviar = args.includes("--enviar");
if (enviar) args.splice(args.indexOf("--enviar"), 1);
const igualarCor = !args.includes("--sem-igualar-cor");
if (!igualarCor) args.splice(args.indexOf("--sem-igualar-cor"), 1);
const facesLeve = Number(opcao("--faces-leve", 500000));
const texturaLeve = Number(opcao("--textura-leve", 4096));
const [id, blend] = args;

if (!id || !blend) {
  console.error("Uso: node ferramentas/downloads.mjs <id> <arquivo-alta.blend> [--faces-leve 500000] [--enviar]");
  process.exit(1);
}
if (!existsSync(blend)) sair(`Arquivo não encontrado: ${blend}`);

const obras = JSON.parse(readFileSync(ARQUIVO_OBRAS, "utf8"));
const obra = obras.find((o) => o.id === id);
if (!obra) sair(`Não há obra "${id}" em data/obras.json. Cadastre a obra antes (ver /nova-obra).`);

const site = `${SITE}obra.html?id=${id}`;
const citacao = `Casa da Cultura da América Latina (CAL/UnB). ${obra.titulo} (${obra.registro}). Modelo 3D, projeto Gêmeos Digitais CAL, ${ANO}. Disponível em: ${site}`;

// --- Exportar no Blender ---
const saida = join(dirname(resolve(blend)), "downloads");
mkdirSync(saida, { recursive: true });
const arquivoDados = join(saida, "dados.json");
// O modelo do site vai junto para o Blender virar a peça igual a ele (ver giro_ate_o_site).
const modeloSite = join(RAIZ, obra.modelo);
const blender = acharBlender();
console.log(`Blender: ${blender}\nExportando ${basename(blend)} → ${saida}`);
const inicio = Date.now();

/** Roda exportar-downloads.py; `extra` vai junto no dados.json (modo, curvaDeCor). */
function rodarBlender(extra = {}) {
  writeFileSync(
    arquivoDados,
    JSON.stringify({ id, registro: obra.registro, titulo: obra.titulo, facesLeve, texturaLeve, citacao, site, modeloSite, ...extra })
  );
  const rodada = spawnSync(
    blender,
    ["-b", "--factory-startup", resolve(blend), "--python-exit-code", "1", "--python", SCRIPT_BLENDER, "--", saida, arquivoDados],
    { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 }
  );
  const log = `${rodada.stdout ?? ""}\n${rodada.stderr ?? ""}`;
  if (!extra.modo) for (const linha of log.split(/\r?\n/)) if (linha.startsWith("[downloads]")) console.log("  " + linha.slice(12));
  if (rodada.status !== 0) {
    console.error(log.split(/\r?\n/).slice(-30).join("\n"));
    sair(rodada.error ? `Não consegui rodar o Blender (${rodada.error.message}). Indique o caminho com BLENDER=...` : "O Blender parou com erro (mensagens acima).");
  }
}

// Mesma cor do site: exporta um .glb leve, compara com o do site e, se a cor for diferente, passa a
// textura por uma curva de cor (igualar-cor.mjs). Nas obras do ExScan o site usa material metálico, que
// escurece a cor; os downloads saem com material simples, então a diferença vai para a textura.
let curvaDeCor = null;
if (igualarCor && existsSync(modeloSite)) {
  const { compararCor } = await import("./igualar-cor.mjs");
  const comparar = join(saida, "comparar.glb");
  rodarBlender({ modo: "comparar" });
  const { curva, diferenca } = await compararCor(modeloSite, comparar);
  if (diferenca > DIFERENCA_DE_COR) {
    curvaDeCor = curva;
    rodarBlender({ modo: "comparar", curvaDeCor });
    const depois = await compararCor(modeloSite, comparar);
    console.log(`  cor: ${porcento(diferenca)} de diferença para o site → ${porcento(depois.diferenca)} com a textura corrigida`);
  } else {
    console.log(`  cor: ${porcento(diferenca)} de diferença para o site, textura mantida`);
  }
  rmSync(comparar, { force: true });
}
rodarBlender(curvaDeCor ? { curvaDeCor } : {});
const manifesto = JSON.parse(readFileSync(join(saida, "manifesto.json"), "utf8"));
const niveis = Object.keys(NIVEIS).filter((nivel) => manifesto[nivel]);
console.log(`Pronto em ${Math.round((Date.now() - inicio) / 1000)} s.\n`);

// A peça precisa estar na mesma posição do modelo do site: as medidas (L × A × P) têm de bater.
const { medidas } = manifesto;
const site3d = obra.dimensoes;
if (site3d) {
  const diferenca = Math.max(...["largura", "altura", "profundidade"].map((k) => Math.abs(medidas[k] - site3d[k])));
  const cm = (v) => v.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
  const texto = (m) => `${cm(m.largura)} × ${cm(m.altura)} × ${cm(m.profundidade)} cm`;
  if (diferenca > 0.5) {
    console.warn(`ATENÇÃO: medidas ${texto(medidas)}, mas o modelo do site mede ${texto(site3d)}.`);
    console.warn("A malha do .blend parece não ser a mesma do site (o giro é corrigido sozinho); confira antes de enviar.\n");
  } else {
    console.log(`Medidas iguais às do site (${texto(medidas)}): mesma posição.\n`);
  }
}

const arquivos = [];
for (const nivel of niveis) {
  const m = manifesto[nivel];
  console.log(`${NIVEIS[nivel]}: ${m.faces.toLocaleString("pt-BR")} faces, textura ${m.textura?.join(" × ") ?? "—"} px`);
  for (const formato of Object.keys(FORMATOS)) {
    const nome = `${id}-${nivel}-${formato}.zip`;
    arquivos.push(join(saida, nome));
    console.log(`  ${nome.padEnd(26)} ${megas(m[formato]).padStart(9)}`);
  }
}

if (!enviar) {
  console.log("\nArquivos só no computador. Para mandar ao GitHub e gravar no obras.json, repita com --enviar.");
  process.exit(0);
}

// --- Enviar ao GitHub Releases ---
const repo = gh(["repo", "view", "--json", "nameWithOwner", "-q", ".nameWithOwner"]).trim();
const tag = `modelos-${id}`;
const notas = join(saida, "notas.md");
writeFileSync(notas, textoDoRelease());
const existe = spawnSync("gh", ["release", "view", tag, "--json", "isDraft"], { encoding: "utf8" }).status === 0;
if (existe) {
  gh(["release", "edit", tag, "--notes-file", notas]);
} else {
  gh(["release", "create", tag, "--draft", "--target", "main", "--title", `${obra.registro} · ${obra.titulo} — modelos 3D`, "--notes-file", notas]);
  console.log(`\nRelease ${tag} criado como rascunho.`);
}
console.log("Enviando os arquivos (pode demorar)…");
gh(["release", "upload", tag, ...arquivos, "--clobber"], "inherit");
const { isDraft, assets } = JSON.parse(gh(["release", "view", tag, "--json", "isDraft,assets"]));

// Arquivos de uma rodada anterior que não existem mais (ex.: a obra passou a ter uma só qualidade).
const atuais = new Set(arquivos.map((caminho) => basename(caminho)));
for (const { name } of assets) {
  if (name.startsWith(`${id}-`) && name.endsWith(".zip") && !atuais.has(name)) {
    gh(["release", "delete-asset", tag, name, "--yes"]);
    console.log(`Removido do release: ${name}`);
  }
}

obra.downloads = {
  endereco: `https://github.com/${repo}/releases/download/${tag}/`,
  pagina: `https://github.com/${repo}/releases/tag/${tag}`,
  ...Object.fromEntries(
    niveis.map((nivel) => {
      const { faces, glb, obj, stl } = manifesto[nivel];
      return [nivel, { faces, glb, obj, stl }];
    })
  ),
};
writeFileSync(ARQUIVO_OBRAS, JSON.stringify(obras, null, 2) + "\n");
console.log(`\ndata/obras.json: downloads de ${id} gravados.`);
if (isDraft) {
  console.log(`O release ainda é rascunho: os links só funcionam para todos depois de publicar com\n  gh release edit ${tag} --draft=false`);
}

// --- Funções ---

function acharBlender() {
  if (process.env.BLENDER) return process.env.BLENDER;
  const base = "C:/Program Files/Blender Foundation";
  if (existsSync(base)) {
    const versoes = readdirSync(base)
      .filter((pasta) => existsSync(join(base, pasta, "blender.exe")))
      .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
    if (versoes.length) return join(base, versoes[0], "blender.exe");
  }
  return "blender";
}

function gh(argumentos, stdio = "pipe") {
  const r = spawnSync("gh", argumentos, { encoding: "utf8", stdio: stdio === "inherit" ? "inherit" : "pipe" });
  if (r.status !== 0) sair(`gh ${argumentos.slice(0, 2).join(" ")} falhou: ${r.stderr || r.error?.message || ""}`);
  return r.stdout ?? "";
}

function megas(bytes) {
  return `${(bytes / 1024 ** 2).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} MB`;
}

function textoDoRelease() {
  const linhas = [
    `Modelos 3D de **${obra.titulo}** (${obra.registro}), do acervo da Casa da Cultura da América Latina (CAL/UnB), digitalizados pelo projeto de extensão Gêmeos Digitais CAL.`,
    "",
    `Página da obra: ${site}`,
    "",
    "| Arquivo | Qualidade | Formato | Tamanho |",
    "| --- | --- | --- | --- |",
  ];
  for (const nivel of niveis) {
    for (const [formato, descricao] of Object.entries(FORMATOS)) {
      linhas.push(`| \`${id}-${nivel}-${formato}.zip\` | ${NIVEIS[nivel]} (${manifesto[nivel].faces.toLocaleString("pt-BR")} faces) | ${descricao} | ${megas(manifesto[nivel][formato])} |`);
    }
  }
  linhas.push(
    "",
    manifesto.unica
      ? "Desta obra há uma só qualidade: o mesmo modelo exibido no site."
      : "**Alta resolução**: todo o detalhe do escaneamento, para estudo e impressão grande. **Leve**: abre em qualquer computador.",
    "Cada .zip traz um LEIA-ME com unidades, orientação, licença e como citar.",
    "",
    "**Licença:** [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/deed.pt-br): pode copiar, estudar, imprimir e adaptar, citando a fonte e sem fins comerciais.",
    "",
    `**Como citar:** ${citacao}`,
    ""
  );
  return linhas.join("\n");
}

function sair(mensagem) {
  console.error(mensagem);
  process.exit(1);
}
