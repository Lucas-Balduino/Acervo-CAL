# CLAUDE.md

Contexto para agentes que trabalham neste repositório. Para o uso do dia a dia, ver `README.md`.

## O projeto

Projeto de extensão da UnB **PJ772-2026** — "Expansão do Acervo da CAL e Consolidação de Gêmeos
Digitais para Preservação e Acessibilidade". Orientador: Miguel Eduardo Gutierrez Paredes. Bolsista e
mantenedor do repositório: Lucas Balduino (Design – Programação Visual, Laboratório Protip, IdA/UnB).
Vigência: 15/05/2026 a 31/12/2026.

- **Meta:** escanear 20 obras da Casa da Cultura da América Latina (CAL) e publicá-las em 3D.
- **Entregas do site até dez/2026** (decididas em 01/11/2026):
  1. visualizador 3D (pronto);
  2. galeria em grade com busca e filtros;
  3. página "Sobre o processo": difusão do trabalho de extensão, interativa e visual, que torne o
     processo (escaneamento → tratamento → web) palpável para o público leigo;
  4. museu virtual navegável — o principal diferencial do produto.
- **Direitos:** o aviso "Direitos Reservados" das fichas vale para republicação das obras; publicar os
  modelos 3D neste site está liberado.
- **Hospedagem:** hoje GitHub Pages (`main` → https://lucas-balduino.github.io/Acervo-CAL/). O objetivo é
  integrar ao acervocal.unb.br (WordPress + Tainacan, editado pelo museólogo da CAL), de preferência no
  servidor e domínio da UnB, mas o formato não está definido. Até lá, tratar como site à parte —
  e manter o site 100% estático e com caminhos relativos para que possa ser copiado para outro servidor.

## Regras do repositório

- Site em HTML/CSS/JS puros com ES modules, **sem framework e sem build**. Só o `<model-viewer>` vem de CDN.
  Cada arquivo de `css/` e `js/` abre com um comentário dizendo o que faz e o que não faz — manter isso.
- Código, comentários, nomes e textos em **português**.
- Commits em português no formato `tipo: descrição` (ex.: `docs: Adicionar obra CAL 0607`, `feat: ...`, `fix: ...`).
- `main` está no ar: mudanças entram por branch e PR. Pequenas correções de dados podem ir direto.
  Na prática só o Lucas (e eventualmente o professor) mexe no repositório.
- `ferramentas/` é Node só para preparar modelos; o site não depende dele.

## Fluxo de um modelo 3D

Scanner Creality CR-Scan Raptor (antes EinScan H1) → malha de 200.000 faces no Creality Scan → export
`.obj` + `.mtl` → Blender (centralizar, orientar, material) → export `.glb` →
`node ferramentas/otimizar-glb.mjs models/<id>/modelo.glb` → item em `data/obras.json`.

O script corrige a escala (o scanner exporta em mm e o glTF usa metros) e comprime a malha, que vem
sem vértices compartilhados: ~22 MB → ~1,5 MB por obra. O decodificador Draco é carregado pelo próprio
model-viewer.

**A aparência é decidida no Blender, não no script.** Os materiais exportados são 100% metálicos (com
Transmission 1, que nesse caso não aparece). Em 01/11/2026 testamos trocar para material não metálico e
corrigir a cor da textura por foto: o Lucas achou que a aparência original representa melhor as obras.
O script só remove transmission/IOR/specular de material 100% metálico (sem efeito visível, mas a
transparência custa uma segunda renderização). Verificado pixel a pixel contra os originais.
Não alterar material ou textura sem pedir.

- `id` e pasta: `cal-` + número de registro com 4 dígitos (CAL.0607 → `cal-0607`).
- Título e link devem bater com a ficha no acervo. URL limpa: `https://www.acervocal.unb.br/acervo/<slug>/`.

## Integração com o Tainacan

A API REST do acervo é pública e aceita CORS do GitHub Pages:
`https://www.acervocal.unb.br/wp-json/tainacan/v2/items/?search=CAL.0607` (coleção "Acervo", id 1565).
Metadados úteis: `numero-de-registro`, `procedencia`, `data-de-aquisicao`, `forma-de-aquisicao`, `colecao`.
As fichas marcam as imagens como "Direitos Reservados" — não copiar fotos do acervo para este repositório.

## Testar

`preview_start` com a configuração `site` de `.claude/launch.json` (porta 3000). Conferir que os modelos
carregam, sem erros no console, e que `viewer.getDimensions()` dá medidas plausíveis em metros.
