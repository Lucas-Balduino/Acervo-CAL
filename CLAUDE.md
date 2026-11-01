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
  2. galeria em grade com busca e filtros (feita na branch `feat/grade-navegacao`, em avaliação pelo
     professor contra a versão antiga, de página única com lista lateral);
  3. página "Sobre o processo": difusão do trabalho de extensão, interativa e visual, que torne o
     processo (escaneamento → tratamento → web) palpável para o público leigo;
  4. museu virtual navegável — o principal diferencial do produto (primeira versão na branch
     `feat/museu-virtual`, criada a partir de `feat/grade-navegacao`).
- **Direitos:** o aviso "Direitos Reservados" das fichas vale para republicação das obras; publicar os
  modelos 3D neste site está liberado.
- **Hospedagem:** hoje GitHub Pages (`main` → https://lucas-balduino.github.io/Acervo-CAL/). O objetivo é
  integrar ao acervocal.unb.br (WordPress + Tainacan, editado pelo museólogo da CAL), de preferência no
  servidor e domínio da UnB, mas o formato não está definido. Até lá, tratar como site à parte —
  e manter o site 100% estático e com caminhos relativos para que possa ser copiado para outro servidor.

## Regras do repositório

- Site em HTML/CSS/JS puros com ES modules, **sem framework e sem build**. Bibliotecas só por CDN com versão
  fixa: `<model-viewer>` 3.4.0 (ajax.googleapis.com) e three.js 0.169.0 (jsDelivr, por importmap no `museu.html`).
  Cada arquivo de `css/` e `js/` abre com um comentário dizendo o que faz e o que não faz — manter isso.
- Código, comentários, nomes e textos em **português**.
- Commits em português no formato `tipo: descrição` (ex.: `docs: Adicionar obra CAL 0607`, `feat: ...`, `fix: ...`).
- `main` está no ar: mudanças entram por branch e PR. Pequenas correções de dados podem ir direto.
  Na prática só o Lucas (e eventualmente o professor) mexe no repositório.
- `ferramentas/` é Node só para preparar modelos; o site não depende dele.

## Estrutura do site

Várias páginas estáticas que repetem o mesmo cabeçalho e rodapé (sem build, então sem includes):
`index.html` (início), `obras.html` (grade com filtros), `obra.html?id=<id>` (visualizador + ficha),
`museu.html` (sala 3D) e `sobre.html` (por enquanto, aviso "em desenvolvimento"). Cada página carrega só o CSS e o
módulo JS dela; `js/data.js` e `js/cartoes.js` são compartilhados. Ao mudar o menu, mudar nas 5 páginas.

- Ordem padrão das obras: número de registro (galeria e anterior/próxima da página da obra).
- `frente` (graus) define a vista inicial, a miniatura e o botão "Frente" do cubo; as vistas do cubo são
  relativas a ela.
- Distância da câmera: 115% no computador e 130% em telas estreitas; precisa de
  `max-camera-orbit="auto auto 250%"`, senão o model-viewer trava o raio no padrão.

## Museu virtual

three.js direto (não usa model-viewer). `js/museu-sala.js` monta a sala a partir das obras; `js/museu-navegacao.js`
é a câmera; `js/museu.js` liga tudo e cuida da interface HTML por cima do canvas.

- **Ambientação inspirada nas salas da CAL** (fotos enviadas pelo Lucas em 01/11/2026): paredes e pedestais
  terracota, piso de taco em espinha de peixe (textura desenhada em canvas), teto claro com trilhos e spots
  (um `SpotLight` por obra, só no computador). Cores e medidas nas constantes `SALA` e `CORES`.
- Obras em tamanho real (os `.glb` já estão em metros). A sala cresce com o número de
  obras: a de `destaque` vai na parede do fundo; as outras se alternam nas laterais, viradas um pouco para a
  entrada (`SALA.giroLateral`). A rotação de cada obra usa o mesmo `frente` do model-viewer.
- **Dois modos de câmera:** andar (primeira pessoa) e examinar (órbita em volta da obra, como no visualizador:
  arrastar gira, roda/pinça aproxima, duplo clique centraliza, giro automático lento até a primeira interação).
  Referência de interação citada pelo Lucas: https://www.magische-spiegelungen.de/ — ao examinar, a ficha fica
  à esquerda em tipografia grande e a obra à direita (`camera.setViewOffset` desloca a imagem); no celular a
  ficha vira uma folha embaixo.
- O Lucas pediu duas vezes obras maiores na tela, sem abrir mão do tamanho real: campo de visão 45° (60° em
  tela em pé), sala de 5,2 m × pé-direito 3 m, pedestais de 1,22 m (obra perto da altura dos olhos) e laterais
  a 1,25 m da parede. Medido em 1366 × 820: na entrada as obras ocupam 13–21% da altura da tela; ao examinar,
  ~68% (computador) e ~50% (celular, por causa da ficha embaixo). Ao mexer em `SALA`, conferir que as três
  primeiras obras continuam visíveis da entrada.
- No celular (`pointer: coarse`) não há sombras em tempo real nem spots reais; a sombra sob os pedestais é uma
  textura e aparece sempre.
- `window.museu` expõe `examinar`, `voltarAoMuseu`, `percurso`, `camera` e `navegacao` para testes no console.
- Testado só em Chrome headless (SwiftShader, ~2 quadros/s): o desempenho em placa de vídeo e celular real
  ainda não foi medido.

## Fluxo de um modelo 3D

Scanner Creality CR-Scan Raptor (antes EinScan H1) → malha de 200.000 faces no Creality Scan → export
`.obj` + `.mtl` → Blender (centralizar, orientar, material) → export `.glb` →
`node ferramentas/otimizar-glb.mjs models/<id>/modelo.glb` → item em `data/obras.json` (id, modelo,
frente) → `node ferramentas/sincronizar-acervo.mjs` → miniatura em `ferramentas/posters.html`
(com `node ferramentas/servidor.mjs` ligado, que é o único que aceita gravar `models/<id>/poster.webp`).

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
Metadados úteis: `numero-de-registro`, `procedencia`, `data-de-aquisicao`, `forma-de-aquisicao`, `colecao`,
`autor`, `material-tecnica`, `local-de-producao`, `data-de-producao`, `dimensoes` (os últimos estão vazios
nas obras atuais). O site não consulta a API ao vivo: `ferramentas/sincronizar-acervo.mjs` copia os dados
para `data/obras.json`, para o site não depender do servidor da UnB estar no ar.
As fichas marcam as imagens como "Direitos Reservados" — não copiar fotos do acervo para este repositório.

## Testar

`preview_start` com a configuração `site` de `.claude/launch.json` (porta 3000, `ferramentas/servidor.mjs`).
Conferir que os modelos carregam, sem erros no console, e que `viewer.getDimensions()` dá medidas
plausíveis em metros. Testar também em 390 px de largura (celular).

O navegador embutido pausa o WebGL quando a janela do app está oculta ou minimizada (o `load` do
model-viewer nunca dispara). Nesse caso, usar Chrome headless via `puppeteer-core` com
`--use-angle=swiftshader --enable-unsafe-swiftshader` (Chrome em `C:/Program Files/Google/Chrome/Application/chrome.exe`),
instalado fora do repositório.
