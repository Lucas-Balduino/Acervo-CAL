# CLAUDE.md

Contexto para agentes que trabalham neste repositório. Para o uso do dia a dia, ver `README.md`.

## O projeto

Projeto de extensão da UnB **PJ772-2026** — "Expansão do Acervo da CAL e Consolidação de Gêmeos
Digitais para Preservação e Acessibilidade". Orientador: Miguel Eduardo Gutierrez Paredes. Bolsista e
mantenedor do repositório: Lucas Balduino (Design – Programação Visual, Laboratório Protip, IdA/UnB).
Equipe: também Luara Piccinin (bolsista) e Vinicius Deleon (voluntário).
Vigência: 15/05/2026 a 31/12/2026.

- **Meta:** escanear 20 obras da Casa da Cultura da América Latina (CAL) e publicá-las em 3D.
- **Entregas do site até dez/2026** (decididas em 01/11/2026):
  1. visualizador 3D (pronto);
  2. galeria em grade com busca e filtros (aprovada pelo professor, no ar desde 04/11/2026);
  3. página "Sobre o processo": difusão do trabalho de extensão, interativa e visual, que torne o
     processo (escaneamento → tratamento → web) palpável para o público leigo (no ar desde 04/11/2026; falta o PDF da metodologia);
  4. museu virtual navegável — o principal diferencial do produto (aprovado, no ar desde 04/11/2026).
- **Direitos:** o aviso "Direitos Reservados" das fichas vale para republicação das obras; publicar os
  modelos 3D neste site está liberado.
- **Hospedagem:** hoje GitHub Pages (`main` → https://lucas-balduino.github.io/Acervo-CAL/). O objetivo é
  integrar ao acervocal.unb.br (WordPress + Tainacan, editado pelo museólogo da CAL), de preferência no
  servidor e domínio da UnB, mas o formato não está definido. Até lá, tratar como site à parte —
  e manter o site 100% estático e com caminhos relativos para que possa ser copiado para outro servidor.

## Regras do repositório

- Site em HTML/CSS/JS puros com ES modules, **sem framework e sem build**. Bibliotecas só por CDN com versão
  fixa: `<model-viewer>` 3.4.0 (ajax.googleapis.com) e three.js 0.169.0 (jsDelivr, por importmap no `museu.html` e no `sobre.html`).
  Cada arquivo de `css/` e `js/` abre com um comentário dizendo o que faz e o que não faz — manter isso.
- Código, comentários, nomes e textos em **português**.
- Commits em português no formato `tipo: descrição` (ex.: `docs: Adicionar obra CAL 0607`, `feat: ...`, `fix: ...`).
- `main` está no ar: mudanças entram por branch e PR. Pequenas correções de dados podem ir direto.
  Na prática só o Lucas (e eventualmente o professor) mexe no repositório.
- `ferramentas/` é Node só para preparar modelos; o site não depende dele.

## Estrutura do site

Várias páginas estáticas que repetem o mesmo cabeçalho e rodapé (sem build, então sem includes):
`index.html` (início), `obras.html` (grade com filtros), `obra.html?id=<id>` (visualizador + ficha),
`museu.html` (sala 3D) e `sobre.html` (o processo em etapas). Cada página carrega só o CSS e o
módulo JS dela; `js/data.js` e `js/cartoes.js` são compartilhados. Ao mudar o menu, mudar nas 5 páginas.

- Ordem padrão das obras: número de registro (galeria e anterior/próxima da página da obra).
- `frente` (graus) define a vista inicial, a miniatura e o botão "Frente" do cubo; as vistas do cubo são
  relativas a ela.
- Distância da câmera: 115% no computador e 130% em telas estreitas; precisa de
  `max-camera-orbit="auto auto 250%"`, senão o model-viewer trava o raio no padrão.

## Museu virtual

three.js direto (não usa model-viewer). `js/museu-sala.js` monta as salas a partir das obras; `js/museu-luz.js`
calcula os spots nos shaders; `js/museu-navegacao.js` é a câmera; `js/museu-contorno.js` desenha o contorno da obra
sob o mouse; `js/museu.js` liga tudo e cuida da interface HTML por cima do canvas.

- **Referência de estilo** (Lucas, 07/11/2026): https://www.magische-spiegelungen.de/ — ambiente simples, mas
  com muita profundidade: pouca luz geral, um facho por obra, cantos escurecidos, névoa ao longe.
- **Entrada e visita imersiva** (pedido do Lucas, 07/11/2026): enquanto as obras carregam, a tela de entrada
  mostra a marca UnB | CAL (símbolo `#marca-unb-cal` no `museu.html`, redesenhado em vetor, com o texto em
  Roboto) e uma barra fina; depois aparece o convite "Entrar no museu", com a sala desfocada por trás. Ao entrar,
  o cabeçalho do site sobe e some (`body.imersivo`), a câmera avança da porta (`navegacao.chegar()`) e ficam só
  botões escuros translúcidos: "Como navegar" e um X que sai da visita (a entrada volta com "Voltar ao museu").
  Comparamos as outras duas marcas da CAL (quadrado vermelho e "CAL" horizontal): o vermelho briga com a
  terracota e a horizontal pesa mais que o título; ficou a UnB | CAL.
- **Contorno ao passar o mouse** numa obra (no celular, um piscar ao tocar), para mostrar que dá para clicar:
  a obra é desenhada em branco numa máscara (camada 1 da câmera) e uma linha clara é pintada na borda dela,
  por cima da cena.

- **Ambientação inspirada nas salas da CAL** (fotos enviadas pelo Lucas em 01/11 e 07/11/2026): paredes
  terracota, pedestais um pouco mais escuros e menos saturados (senão o topo, sob o spot, vira laranja forte),
  piso de taco em espinha de peixe (textura desenhada em canvas, de contraste baixo — a primeira versão parecia
  um mosaico e o Lucas achou esquisita), teto claro com trilhos e spots. Cores e medidas nas constantes `SALA`,
  `LUZ`, `CORES` e `TACO`.
- **Uma sala por coleção** (decisão do Lucas, 07/11/2026), em sequência: entre elas, uma parede com passagem
  larga no meio (2,4 m) e viga mais baixa (2,4 m), com o nome da sala seguinte na viga ("Coleção X", dos dois
  lados). Ordem das salas: a da primeira obra em ordem de registro; a sala da obra em `destaque` vai por último,
  com ela na parede do fundo, no eixo das passagens (vista desde a entrada). O percurso segue sala por sala.
  O contador embaixo mostra a sala onde o visitante está.
- Obras ampliadas 1,5× (`SALA.escalaDasObras`; os `.glb` estão em metros reais). Cada sala cresce com o número
  de obras dela: as obras se alternam nas laterais (a alternância continua de uma sala para a outra), viradas
  um pouco para a entrada (`SALA.giroLateral`). A rotação de cada obra usa o mesmo `frente` do model-viewer.
- **Luz quente e marcante, sem pesar** (pedido do Lucas, 07/11/2026: mais perto da exposição real, sem
  hiper-realismo): pouca luz geral (hemisfério + uma direcional, cuja sombra é desenhada uma vez só) e um spot
  por obra, no trilho do outro lado do corredor, iluminando a obra de frente a ~35°; o facho segue até a parede
  de trás, com a sombra do pedestal e da obra. Os spots **não são `SpotLight`**: `js/museu-luz.js` calcula a luz
  em cada ponto, via `onBeforeCompile` (facho de borda suave, sombra do pedestal como caixa, sombra da obra como
  elipsoide do tamanho dela, escurecimento dos cantos). Antes eram texturas de mancha na parede, que de lado
  perdiam o sentido (Lucas, 07/11/2026); calculada, a luz fica certa de qualquer ângulo e é igual no celular.
  Cada ponto só soma os spots da própria sala (`salaDe`, pelas paredes entre salas). Nas obras entra só o spot
  delas, sem mexer em material ou textura. Fachos visíveis no ar: cones aditivos (`LUZ.facho`).
- Reflexo do ambiente: paredes, piso e teto usam um `envMap` próprio, escuro e quente (`cenaDeReflexo`); com o
  `RoomEnvironment` da cena o piso ficava claro e lavado ao longe. As obras mantêm o `RoomEnvironment` (as
  metálicas dependem dele). Névoa `FogExp2` quente (`LUZ.nevoa`) escurece o fundo e dá profundidade.
- **Dois modos de câmera:** andar (primeira pessoa) e examinar (órbita em volta da obra, como no visualizador:
  arrastar gira, roda/pinça aproxima, duplo clique centraliza, giro automático lento até a primeira interação).
  Referência de interação citada pelo Lucas: https://www.magische-spiegelungen.de/ — ao examinar, a ficha fica
  à esquerda em tipografia grande e a obra à direita (`camera.setViewOffset` desloca a imagem); no celular a
  ficha vira uma folha embaixo.
- O Lucas pediu três vezes obras maiores na tela. Decisão de 01/11/2026: **exibir as peças ampliadas 1,5× e
  não falar em "tamanho real"** no museu (as medidas reais continuam na ficha). Campo de visão 45° (60° em tela
  em pé), salas de 5,2 m de largura × pé-direito 3 m, pedestais de 1,05 m, laterais a 1,25 m da parede. Ao mexer
  em `SALA`, conferir a vista da entrada: a primeira obra, a seguinte pela passagem e a do destaque no fundo.
- Paredes entre salas na navegação: andar só passa pela abertura (`restringir` empurra para fora dos trechos
  cheios; a roda e as teclas andam em passos de até 10 cm para não atravessar), cliques no chão ou numa obra
  não atravessam paredes (`sala.paredes` entra no raycast) e a câmera do exame fica dentro da sala da obra.
- Enquadramento ao examinar (`raioParaCaber`): a obra é tratada como um cilindro (altura da peça, raio da
  diagonal da base) e precisa caber, vista ~14° de cima, em 96% do espaço livre — fora da ficha e da barra
  Anterior/Próxima. Antes era uma esfera ocupando 100% da altura, e a CAL.0504 (alta e fina) ficava com o topo
  cortado (07/11/2026).
- **Sensação dos controles** (pedido do Lucas, no estilo do Magical Reflections): pouca sensibilidade
  (arrastar 300 px gira ~15° andando, ~77° examinando; o Lucas pediu duas vezes para reduzir o olhar), vista amortecida com inércia ao soltar, leve balanço
  da vista seguindo o cursor, e transições com duração fixa e curva suave na entrada e na saída
  (`DURACAO`: examinar 2,2 s, entre obras 2,6 s com leve arco, voltar 1,8 s, chegar 3,2 s). A ficha entra com atraso
  para acompanhar a câmera. Constantes no topo de `js/museu-navegacao.js`.
- Os `.glb` chegam do Blender com rotação interna no nó. Para apoiar a obra no pedestal, a caixa precisa ser
  calculada vértice a vértice (`Box3.setFromObject(modelo, true)`); a caixa rápida deixava as obras até 8,5 cm
  acima do pedestal (corrigido em 04/11/2026).
- No celular (`pointer: coarse`) não há sombra da luz geral (shadow map); os spots, as sombras deles e os cantos
  escurecidos são os mesmos do computador.
- `window.museu` expõe `examinar`, `voltarAoMuseu`, `entrar`, `sair`, `percurso`, `camera`, `navegacao`, `sala` e
  `contorno` para testes no console; `navegacao.posicionar(x, z, giro, pitch)` põe o visitante num ponto.
- Desempenho (relato do Lucas, 05/11/2026): roda bem no PC; num iPhone XR a fluidez cai um pouco, sem
  atrapalhar a experiência.

## Página "Sobre o processo"

Rolagem guiada: um palco 3D fica preso à direita (no celular, em cima) e cada etapa é bem mais alta que a tela
(`--rolagem` em `css/sobre.css`: 480vh nas etapas animadas, 300vh nas outras), com o cartão de texto preso
(sticky) enquanto ela rola — o Lucas pediu duas vezes a animação mais longa e o texto parado na tela.
Para a rolagem não parecer parada: a trilha de etapas à esquerda (clicável) se preenche conforme a rolagem
(no celular, pontos e uma barra fina no palco) e rolar empurra o giro da peça (`empurrarGiro`). Os botões
Pontos/Malha/Textura ficam por cima do 3D, só na última etapa.
`js/sobre.js` descobre a etapa ativa e o progresso dela (0 quando o cartão prende, 1 quando vai soltar); `js/sobre-cena.js`
recebe isso e mostra a moringa (CAL.0607) naquela etapa. Partes da animação seguem a rolagem: o scanner dá a
volta, a segunda captura (peça virada) se encaixa, a câmera aproxima da malha, a textura se desdobra no plano
(cada vértice ganha uma segunda posição dada pelo `uv`, misturada com `morphTargetInfluences`) e o Blender põe a
peça em pé (da rotação "crua", sem a do nó, para a final).

- Cada etapa é uma função em `ETAPAS` que devolve valores-alvo (fundo, enquadramento, camadas...); o que
  não muda vem de `PADRAO`. As cores de fundo também estão em `FUNDOS`, em `sobre.js`, para o palco não piscar.
- Trocas de camada (pontos, argila, arame, textura) não usam transparência: uma linha horizontal sobe pela
  peça (`aplicarCorte`, com um fio azul) e a camada nova aparece opaca abaixo dela. Com opacidade parcial, a
  malha mostrava o próprio interior e os pontos ficavam por cima, e o Lucas viu isso como um glitch.
- A nuvem de pontos é sorteada na malha (`MeshSurfaceSampler`) com a cor da textura; a segunda captura cobre a
  base e a parte de baixo das laterais.
- O texto segue a metodologia do Lucas (seções 4 e 5), sem os trechos ainda marcados [CONFIRMAR] (modo NIR,
  resoluções etc.). Os tamanhos "≈ 22 MB → ≈ 1,5 MB" são a média das obras.
- O scanner da etapa 2 é um desenho do Creality CR-Scan Raptor em tamanho real (215 × 74 × 50 mm, preto, em pé,
  duas câmeras com anéis de LEDs), feito com formas do three.js em `montarScanner` — sem modelo baixado.
- `img/processo/` tem 5 fotos da equipe (enviadas pelo Lucas em 04/11/2026), da fase de testes com o scanner
  anterior (EinScan H) e um teste com celular; o texto da seção "Bastidores" diz isso.
  Clicar numa foto abre o visor em tela inteira (`js/fotos.js`, um `<dialog>`), com legenda e setas/teclado/deslizar.
- Download da metodologia: bloco `#metodologia` no fim da página, escondido (`hidden`) até o PDF final entrar em
  `docs/metodologia-gemeos-digitais-cal.pdf`. Ao adicionar o PDF, tirar o `hidden`; o botão mostra o tamanho sozinho.
  Não publicar a versão com trechos [CONFIRMAR].
- Sem WebGL, `sobre.js` não põe a classe `.com-3d` e as etapas viram uma lista comum.

## Fluxo de um modelo 3D

Scanner Creality CR-Scan Raptor (antes EinScan H1) → malha de 200.000 faces no Creality Scan → export
`.obj` + `.mtl` → Blender (centralizar, orientar, material) → export `.glb` →
`node ferramentas/otimizar-glb.mjs models/<id>/modelo.glb` → item em `data/obras.json` (id, modelo,
frente) → `node ferramentas/sincronizar-acervo.mjs` → miniatura em `ferramentas/posters.html`
(com `node ferramentas/servidor.mjs` ligado, que é o único que aceita gravar `models/<id>/poster.webp`).

**Skill `/nova-obra`** (`.claude/skills/nova-obra/SKILL.md`) faz esse fluxo a partir do `.glb` exportado:
confere a ficha, otimiza, cadastra, sincroniza, mostra 8 vistas para o Lucas escolher a `frente`, gera a
miniatura, confere o site e o museu e faz o commit na `main` (obra nova é mudança de dados; o push só com o
"pode publicar" dele). As etapas de navegador ficam em `ferramentas/navegador.mjs` (`vistas`, `poster`,
`conferir`), que liga o próprio servidor na porta 3101 e usa Chrome headless — a miniatura sai igual
byte a byte à gerada antes no navegador.

O script corrige a escala (o scanner exporta em mm e o glTF usa metros) e comprime a malha, que vem
sem vértices compartilhados: ~22 MB → ~1,5 MB por obra. O decodificador Draco é carregado pelo próprio
model-viewer.

**A aparência é decidida no Blender, não no script.** As três primeiras obras (0607, 0631, 0803) vieram do
EinScan H (ExScan H): material 100% metálico (com Transmission 1, que nesse caso não aparece) e textura JPEG.
As escaneadas com o Raptor (0504 e o Sapo) chegam sem essas características: material não metálico e textura
PNG. As duas formas ficam como foram exportadas. Em 01/11/2026 testamos trocar para material não metálico e
corrigir a cor da textura por foto: o Lucas achou que a aparência original representa melhor as obras.
O script só remove transmission/IOR/specular de material 100% metálico (sem efeito visível, mas a
transparência custa uma segunda renderização). Verificado pixel a pixel contra os originais.
Não alterar material ou textura sem pedir.

- `id` e pasta: `cal-` + número de registro com 4 dígitos (CAL.0607 → `cal-0607`).
- Título e link devem bater com a ficha no acervo. URL limpa: `https://www.acervocal.unb.br/acervo/<slug>/`.
- Exceção: obra fora do Tainacan leva `"semFicha": true` e dados escritos à mão (a sincronização só mede o
  modelo). Caso atual: o Sapo (Brinquedo trançado), da coleção CNRC, que não está no Tainacan. O "307" dele é o
  número de patrimônio na coleção (planilha de curadoria do museólogo), não um número CAL — no acervo,
  CAL.0307 é a Braçadeira emplumada. Por isso `id` `cnrc-0307` e `registro` "CNRC 307" (decisão do Lucas,
  07/11/2026). Na planilha, cada coleção tem a própria numeração (a Moringa é 913186 lá).

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
