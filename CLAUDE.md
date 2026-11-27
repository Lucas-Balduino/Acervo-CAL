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
- `ferramentas/` é Node só para preparar modelos; o site não depende dele. A única exceção em Python é
  `exportar-downloads.py`, que roda dentro do Blender (chamado por `downloads.mjs`).

## Estrutura do site

Várias páginas estáticas que repetem o mesmo cabeçalho e rodapé (sem build, então sem includes):
`index.html` (início), `obras.html` (grade com filtros), `obra.html` (visualizador + ficha),
`museu.html` (sala 3D) e `sobre.html` (o processo em etapas). Cada página carrega só o CSS e o
módulo JS dela; `js/data.js` e `js/cartoes.js` são compartilhados. Ao mudar o menu, mudar nas 5 páginas
e no `404.html`.

- **Página 404** (`404.html`, 27/11/2026): o GitHub Pages a mostra em qualquer endereço que não existe, inclusive
  dentro de pastas (`obra/cal-9999.html`); um script no `<head>` aponta a `<base>` para a raiz do site (a pasta
  antes de `obra/`, `models/`... ou a do endereço pedido), para os caminhos relativos valerem. O
  `servidor.mjs` faz o mesmo no localhost. Repete o cabeçalho e o rodapé das outras páginas.
- Sem JavaScript, cada página mostra um aviso (`<noscript>` com `.aviso-sem-js`); no museu, dentro da tela de entrada.

- **Marca UnB | CAL** no cabeçalho (ao lado de "Gêmeos Digitais", sem o "CAL", que já está na marca — pedido
  do Lucas; o nome completo continua no título da aba e nas prévias; no celular, menor e em cima) e no
  rodapé das 5 páginas (19/11/2026): cada página tem o `<symbol id="marca-unb-cal">` logo depois do `<body>`
  e usa `<use href="#marca-unb-cal">`. "UnB" (Roboto Black) e "CAL" (Roboto Light) estão convertidos em
  curvas, para não depender de a fonte carregar nem trocar de letra na abertura; ao mudar a marca, mudar nas 5
  páginas e rodar `paginas-das-obras.mjs`. O ícone da aba é o símbolo da UnB em branco sobre o azul do site.

- **Uma página por obra** (`obra/<id>.html`, 16/11/2026): cópias de `obra.html` geradas por
  `ferramentas/paginas-das-obras.mjs` (roda sozinho no fim da sincronização), com título, descrição e
  etiquetas de prévia (Open Graph) da obra; WhatsApp e redes sociais não rodam JavaScript, e antes todo link
  aparecia como "Obra · Gêmeos Digitais CAL", sem imagem. Usam `<base href="../">` (os caminhos relativos
  continuam valendo; links `#` precisam do caminho da página) e `obra.js` lê a obra de `data-obra`.
  **Não editar `obra/` à mão:** mudou `obra.html`, rodar o script de novo. `obra.html?id=<id>` continua
  funcionando (links antigos), mas o site aponta para `obra/<id>.html` (`linkDaObra`).
- Imagem de prévia: `models/<id>/previa.jpg`, 1200 × 630, a vista da miniatura no cinza da página da obra
  (`node ferramentas/navegador.mjs previa <id>`, ou `todas`). Início, Obras e Sobre usam a da moringa; o Museu,
  `img/previa-museu.jpg` (a chegada, sem a interface; refazer à mão se a sala mudar muito). As etiquetas de
  prévia pedem endereço completo: `ENDERECO_DO_SITE` no script e as etiquetas das 4 páginas fixas. Ao mudar
  o site de servidor, trocar os dois e rodar o script.
- **Convite do museu na página inicial** (16/11/2026): para o site e o museu não parecerem dois produtos, o
  convite é uma foto do próprio museu (`img/museu-convite.webp`, 2400 × 1000, e `-1200`; a sala da coleção
  Inicial com o Pote CAL.0630 inteiro à direita, `posicionar(0.4, -13.0, -0.191, -0.08)`, `?versao=original`,
  sem a interface) com degradê escuro quente sob o texto. Obra cortada na borda da foto não: ou aparece
  inteira ou não aparece (Lucas). Refazer a foto se a sala mudar muito.
- **Identidade** (decisão do Lucas, 16/11/2026): o site segue a identidade do acervo da CAL (paleta
  institucional); o museu tem liberdade para seguir a das exposições da CAL (terracota, penumbra). Os tons
  `--cor-terracota` e `--cor-museu-escuro` (`css/tokens.css`) só entram onde o site fala do museu.

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
  botões escuros translúcidos: "Como navegar" (as instruções abrem sozinhas na primeira entrada
  e saem quando o visitante anda ou examina uma obra — antes sumiam em 7 s, às vezes antes de a pessoa
  terminar de ler (27/11/2026); têm um X próprio; Esc também fecha) e um X no canto que, com uma obra aberta, fecha a obra e, andando, sai
  da visita (a entrada volta com "Voltar ao museu"). Antes o X saía do museu mesmo com a obra aberta (08/11/2026).
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
  larga no meio (2,8 m) e viga mais baixa (2,6 m), sem nada escrito na viga. Na parede do fundo de cada sala (a que se vê ao entrar), à esquerda da
  passagem, ficam em letras claras "Sala 1 de 3", o nome da coleção e um texto curto sobre ela, vindo de
  `data/colecoes.json` (resumo, com palavras nossas, da página Sobre do acervocal.unb.br). Antes o nome da sala
  seguinte ficava na viga e parecia dizer em que sala o visitante estava (pedido do Lucas, 08/11/2026). Ordem das salas: a da primeira obra em ordem de registro; a sala da obra em `destaque` vai por último,
  com ela na parede do fundo, no eixo das passagens (vista desde a entrada). O percurso segue sala por sala.
  O contador embaixo mostra a sala onde o visitante está.
- Obras ampliadas 1,5× (`SALA.escalaDasObras`; os `.glb` estão em metros reais). Cada sala cresce com o número
  de obras dela: as obras se alternam nas laterais (a alternância continua de uma sala para a outra), viradas
  um pouco para a entrada (`SALA.giroLateral`). A rotação de cada obra usa o mesmo `frente` do model-viewer.
  Sala de uma obra só (hoje Chocó e CNRC): a obra vai para a parede do fundo, à direita da passagem
  (`SALA.xObraNoFundo`), simétrica ao texto da sala, e a sala tem 6,4 m (`comprimentoComUmaObra`), para ela
  caber inteira na tela desde a chegada. Numa lateral, ela ficava na borda da tela com o pedestal cortado (16/11/2026).
  Exceção: na primeira sala ela fica na parede esquerda, a 4,4 m da entrada (`obraSozinhaNaEntrada`; fora da
  alternância das laterais). Do fundo à direita, "Próxima obra" levava a câmera em linha reta através da parede
  entre as salas (pedido do Lucas, 16/11/2026). Ao mudar o arranjo, conferir que as transições passam pelas aberturas.
  Obras na parede do fundo (essas e o destaque) têm `fundo: true` e o spot num trilho atravessado à frente delas.
- **Luz quente e marcante, sem pesar** (pedido do Lucas, 07/11/2026: mais perto da exposição real, sem
  hiper-realismo): pouca luz geral (hemisfério + uma direcional, cuja sombra é desenhada uma vez só) e um spot
  por obra, no trilho do outro lado do corredor, iluminando a obra de frente a ~35°; o facho segue até a parede
  de trás, com a sombra do pedestal e da obra. Os spots **não são `SpotLight`**: `js/museu-luz.js` calcula a luz
  em cada ponto, via `onBeforeCompile` (facho de borda suave, sombra do pedestal como caixa, sombra da obra como
  elipsoide do tamanho dela, escurecimento dos cantos). Antes eram texturas de mancha na parede, que de lado
  perdiam o sentido (Lucas, 07/11/2026); calculada, a luz fica certa de qualquer ângulo e é igual no celular.
  Cada ponto só soma os spots da própria sala (`salaDe`, pelas paredes entre salas). Nas obras entra só o spot
  delas, sem mexer em material ou textura. Fachos visíveis no ar: cones aditivos (`LUZ.facho`).
  Debaixo da obra, o topo do pedestal fica na sombra do elipsoide e escurece numa mancha suave (gaussiana);
  antes os pontos dentro do elipsoide contavam como iluminados e a pegada escurecia por igual, e sob o Sapo
  (patas abertas) aparecia um disco com borda (corrigido em 08/11/2026).
- Reflexo do ambiente: paredes, piso e teto usam um `envMap` próprio, escuro e quente (`cenaDeReflexo`); com o
  `RoomEnvironment` da cena o piso ficava claro e lavado ao longe. As obras mantêm o `RoomEnvironment` (as
  metálicas dependem dele). Névoa `FogExp2` quente (`LUZ.nevoa`) escurece o fundo e dá profundidade.
- **Dois modos de câmera:** andar (primeira pessoa) e examinar (órbita em volta da obra, como no visualizador:
  arrastar gira, roda/pinça aproxima, duplo clique centraliza, giro automático lento até a primeira interação).
  Referência de interação citada pelo Lucas: https://www.magische-spiegelungen.de/ — ao examinar, a ficha fica
  à esquerda em tipografia grande e a obra à direita (`camera.setViewOffset` desloca a imagem); no celular a
  ficha vira uma folha embaixo. A ficha segue a UI do museu, não a do site (pedido do Lucas, 17/11/2026: o
  painel creme quebrava a imersão): texto claro sobre uma sombra quente que se desfaz para a direita, título
  grande em Roboto leve, registro em terracota, botões de vidro como os da visita; no celular, um cartão de
  vidro escuro. O site segue a paleta do acervo; o museu, a das exposições (`--cor-terracota`,
  `--cor-museu-escuro` em `css/tokens.css`).
- O Lucas pediu três vezes obras maiores na tela. Decisão de 01/11/2026: **exibir as peças ampliadas 1,5× e
  não falar em "tamanho real"** no museu (as medidas reais continuam na ficha). Campo de visão 45° (60° em tela
  em pé), salas de 6,4 m de largura × pé-direito 3,4 m, 3 m entre fileiras, pedestais de 1,05 m, laterais a 1,5 m
  da parede e o destaque a 1,3 m do fundo. Eram 5,2 m × 3 m com 2,4 m entre fileiras; com a 4ª obra na coleção
  Inicial o Lucas achou a sala apertada e pediu mais espaço (07/11/2026). As salas crescem todas juntas (a largura
  é a mesma em todas; o comprimento depende das obras de cada uma). Ao mexer em `SALA`, conferir a vista da
  entrada: a primeira obra, a seguinte pela passagem e a do destaque no fundo.
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
- **Endereço por obra** (27/11/2026): `museu.html#<id>` abre o museu direto examinando aquela obra. O convite
  diz "Direto para: <título>", o botão vira "Ver a obra no museu", a versão completa da obra começa a baixar
  e o visitante já fica na entrada da sala dela (`ficarNaSalaDa`; da porta do museu, a câmera atravessaria as
  paredes entre as salas). Sem a chegada e sem as instruções. Durante a visita, o endereço segue a obra
  examinada (`history.replaceState`, sem encher o histórico) e volta a `museu.html` ao andar; assim, quem abre
  "Ver ficha completa" e volta cai na mesma obra. A página da obra tem o botão "Ver no museu virtual".
- `window.museu` expõe `examinar`, `voltarAoMuseu`, `entrar`, `sair`, `percurso`, `camera`, `navegacao`, `sala` e
  `contorno` para testes no console; `navegacao.posicionar(x, z, giro, pitch)` põe o visitante num ponto.
- Desempenho (relato do Lucas, 05/11/2026): roda bem no PC; num iPhone XR a fluidez cai um pouco, sem
  atrapalhar a experiência.
- **Carga em fila** (16/11/2026): "Entrar" libera quando chegam as obras vistas da chegada (as da primeira
  sala e o destaque); as outras vêm depois, 3 por vez (`CARGAS_SIMULTANEAS`), na ordem do percurso, e só
  começam quando as da chegada terminam (a banda é dividida). Examinar uma obra que não chegou passa ela à
  frente (`sala.priorizar`); o enquadramento usa as medidas do `obras.json` até o modelo chegar.
  `sala.carregamento` resolve com todas. Medido numa rede de 10 Mbit/s com 8 obras: a entrada liberava em
  19,4 s (19,8 MB); agora em 6,1 s (4,4 MB), e todas chegam nos mesmos ~19 s.
- **Versão leve no museu** (aprovada pelo Lucas em 16/11/2026, avaliando no próprio museu): andando, cada obra é
  `models/<id>/museu.glb` (campo `museu` no `obras.json`), com até 50 mil faces e textura de até 1024 px em JPEG,
  gerada por `node ferramentas/versao-museu.mjs <id>|todas`. Ao examinar, `sala.mostrarCompleta` troca pela
  `modelo.glb`, uma de cada vez (a anterior volta para a leve e sai da memória). Com as 8 obras: download de
  19,8 → 6,0 MB e memória de vídeo estimada de ~320 → ~65 MB (~800 → ~160 MB com 20 obras); quase tudo vem das
  texturas (as de 4096 px da fotogrametria ocupam ~95 MB cada). Nas obras do ExScan e da fotogrametria a malha
  quase não simplifica (as emendas das muitas ilhas de UV travam o simplificador); só a textura diminui.
  Comparadas no museu a 1,5 m, a diferença média ficou abaixo de 1 em 255. `museu.html?versao=original` usa só as
  completas, para comparar. Obra sem `museu` usa a completa. A textura é reduzida no Chrome sem janela (o sharp
  não funciona nesta máquina); com o Pillow a cor deu igual.

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
  resoluções etc.). A etapa 7 compara a moringa (≈ 22 MB ao sair do Blender → ≈ 1,6 MB no site, 13 vezes
  menos) e diz, numa nota, a faixa atual das obras (1,4 a 3,8 MB); ao entrar obra maior ou menor, conferir a nota.
- O scanner da etapa 2 é um desenho do Creality CR-Scan Raptor em tamanho real (215 × 74 × 50 mm, preto, em pé,
  duas câmeras com anéis de LEDs), feito com formas do three.js em `montarScanner` — sem modelo baixado.
- `img/processo/` tem 5 fotos da equipe (enviadas pelo Lucas em 04/11/2026), da fase de testes com o scanner
  anterior (EinScan H) e um teste com celular; o texto da seção "Bastidores" diz isso.
  Clicar numa foto abre o visor em tela inteira (`js/fotos.js`, um `<dialog>`), com legenda e setas/teclado/deslizar.
- Download da metodologia: bloco `#metodologia` no fim da página, escondido (`hidden`) até o PDF final entrar em
  `docs/metodologia-gemeos-digitais-cal.pdf`. Ao adicionar o PDF, tirar o `hidden`; o botão mostra o tamanho sozinho.
  Não publicar a versão com trechos [CONFIRMAR].
- Sem WebGL, `sobre.js` não põe a classe `.com-3d` e as etapas viram uma lista comum.
- **Outro caminho: fotogrametria** (pedido do Lucas, 15/11/2026): seção própria depois das 8 etapas, antes dos
  Bastidores. A fotogrametria foi usada quando o ExScan H1 não funcionava direito e no período sem scanner até
  chegar o Raptor; a captura é um vídeo de celular dando voltas na peça (app KIRI Engine). O 3D é o Cangaceiro
  (CAL.0624) em `js/sobre-fotogrametria.js`, carregado só quando a seção se aproxima: uma espiral de quadros do
  vídeo em volta da peça, com um celular que percorre o caminho. Os botões "Como saiu do app" / "Com a luz
  ajustada" trocam a textura (a original do KIRI, `img/processo/cangaceiro-textura-app.jpg`, no mesmo UV) e
  viram a peça de costas, onde fica a diferença. A foto do Cangaceiro na CAL (`cangaceiro-na-cal.webp`) é da equipe.

## Fluxo de um modelo 3D

Scanner Creality CR-Scan Raptor (antes EinScan H1) → malha de 200.000 faces no Creality Scan → export
`.obj` + `.mtl` → Blender (centralizar, orientar, material) → export `.glb` →
`node ferramentas/otimizar-glb.mjs models/<id>/modelo.glb` → item em `data/obras.json` (id, modelo,
frente) → `node ferramentas/sincronizar-acervo.mjs` → miniatura em `ferramentas/posters.html`
(com `node ferramentas/servidor.mjs` ligado, que é o único que aceita gravar `models/<id>/poster.webp`)
→ prévia (`navegador.mjs previa <id>`) → `node ferramentas/paginas-das-obras.mjs` → versão leve do museu
(`node ferramentas/versao-museu.mjs <id>`).

**Skill `/nova-obra`** (`.claude/skills/nova-obra/SKILL.md`) faz esse fluxo a partir do `.glb` exportado:
confere a ficha, otimiza, cadastra, sincroniza, mostra 8 vistas para o Lucas escolher a `frente`, gera a
miniatura e a prévia, confere o site e o museu e faz o commit na `main` (obra nova é mudança de dados; o push só com o
"pode publicar" dele). As etapas de navegador ficam em `ferramentas/navegador.mjs` (`vistas`, `poster`,
`conferir`), que liga o próprio servidor na porta 3101 e usa Chrome headless — a miniatura sai igual
byte a byte à gerada antes no navegador.

O script corrige a escala (o scanner exporta em mm e o glTF usa metros) e comprime a malha, que vem
sem vértices compartilhados: ~22 MB → ~1,5 MB nas obras do ExScan (textura JPEG); nas do Raptor, a
textura PNG é ~80% do arquivo e elas ficam entre 2,8 e 3,8 MB. O decodificador Draco é carregado pelo próprio
model-viewer.

**A aparência é decidida no Blender, não no script.** As três primeiras obras (0607, 0631, 0803) vieram do
EinScan H (ExScan H): material 100% metálico (com Transmission 1, que nesse caso não aparece) e textura JPEG.
As escaneadas com o Raptor (0504 e o Sapo) chegam sem essas características: material não metálico e textura
PNG. As duas formas ficam como foram exportadas. Em 01/11/2026 testamos trocar para material não metálico e
corrigir a cor da textura por foto: o Lucas achou que a aparência original representa melhor as obras.
O script só remove transmission/IOR/specular de material 100% metálico (sem efeito visível, mas a
transparência custa uma segunda renderização). Verificado pixel a pixel contra os originais.
Não alterar material ou textura sem pedir.

**Fotogrametria** (Luara, app KIRI Engine; obras a partir da 0624 e 0630, 15/11/2026). O KIRI entrega
`3DModel.obj` + `3DModel.jpg` (4096 px, ilhas de UV pequenas), ~500 mil faces, sem tamanho real e com a
sombra das fotos gravada na textura (o lado longe da janela fica escuro). O Lucas orienta a peça no Blender e
`ferramentas/ajustar-fotogrametria.py` faz o resto: altura real (a da planilha do museólogo, até alguém
medir), furinhos, 200 mil faces e o lado escuro clareado (o Lucas pediu esse ajuste de textura). O clareamento
é medido numa cor que cobre a peça toda (`--matiz`); `--alvo 60` deixa mais suave (o Pote ficava pálido nas
costas com 80). Os `.blend` ajustados ficam em `D:\ObrasCAL\<obra>\Ajustado`. Detalhe borrado nas costas
não tem conserto: a equipe vai fotografar com luz por igual e mais fotos de trás.

- `id` e pasta: `cal-` + número de registro com 4 dígitos (CAL.0607 → `cal-0607`).
- Título e link devem bater com a ficha no acervo. URL limpa: `https://www.acervocal.unb.br/acervo/<slug>/`.
- Exceção: obra fora do Tainacan leva `"semFicha": true` e dados escritos à mão (a sincronização só mede o
  modelo). Caso atual: o Sapo (Brinquedo trançado), da coleção CNRC, que não está no Tainacan. O "307" dele é o
  número de patrimônio na coleção (planilha de curadoria do museólogo), não um número CAL — no acervo,
  CAL.0307 é a Braçadeira emplumada. Por isso `id` `cnrc-0307` e `registro` "CNRC 307" (decisão do Lucas,
  07/11/2026). Na planilha, cada coleção tem a própria numeração (a Moringa é 913186 lá).

## Downloads em alta resolução

Botão "Baixar modelo 3D" na página da obra (`js/downloads.js`, uma `<dialog>`): a pessoa escolhe a qualidade
(leve ou alta resolução) e baixa GLB (metros, com cor), OBJ (mm, com `.mtl` e textura) ou STL (mm, sem cor,
Z para cima). Cada arquivo é um `.zip` com um LEIA-ME (unidades, licença, como citar). Decisões do Lucas em
07/11/2026: arquivos no **GitHub Releases** (grátis, até 2 GiB por arquivo, sem limite de total nem de
downloads), um release por obra com a tag `modelos-<id>`, e licença **CC BY-NC 4.0**. O Zenodo (DOI) ficou
como ideia para uma cópia de preservação depois.

- `node ferramentas/downloads.mjs <id> <arquivo-alta.blend> [--faces-leve 500000] [--enviar]`: o Blender
  sem janela aplica as transformações, apoia a peça no chão, centraliza e converte mm → m (só na memória; o
  `.blend` não é salvo), exporta a alta como está, simplifica (Decimate) para a leve e exporta de novo. Com
  `--enviar`, cria o release como **rascunho** (ou atualiza, com `--clobber`) e grava em `data/obras.json` o
  campo `downloads` (`endereco` dos arquivos, `pagina` do release, `faces` e bytes de cada `.zip` por
  qualidade). Obra sem `downloads` fica sem o botão.
- O release precisa ser publicado (`gh release edit modelos-<id> --draft=false`) antes de o `obras.json`
  com os downloads ir para a `main`; enquanto é rascunho, os links só funcionam para o dono do repositório.
  Publicar o release torna os arquivos públicos: só com o "pode publicar" do Lucas.
- **Quantas faces na alta:** a malha completa do Creality Scan, sem simplificar. O detalhe real vem do voxel
  do escaneamento, não do número de faces: a 0808 foi fundida a ~0,22 mm (`scanDataConfig.dat` no projeto) e
  cada captura completa tem 3,5 e 6,7 milhões de faces (`result/Fused.ply` em cada pasta de sessão) —
  ~7 milhões para a peça inteira. Teto: **20 milhões** (fotogrametria ou voxel menor); nesse ponto o maior
  arquivo, o OBJ descompactado, chega perto de 2 GB. Medido por milhão de faces: STL 50 MB (22 MB no zip),
  OBJ ~100 MB (25 MB no zip), GLB ~30 MB, mais a textura. A 0808 com 6,7 milhões levou ~5 min: zips de
  82 MB (GLB), 117 MB (OBJ) e 141 MB (STL).
- **Leve:** 500 mil faces e textura de até 4096 px. A simplificação do Blender não borrou a textura nas
  emendas (conferido na 0808 com 50 mil faces). A textura da alta sai idêntica à do `.blend`.
- **Mesma rotação do site:** nos `.blend` do site (0504, 0808, Sapo), a malha é o `.obj` do Creality importado
  sem troca de eixos (Z para cima) e só deslocada; a posição final vem da rotação e da posição do objeto. A malha
  completa sai do mesmo projeto, nas mesmas coordenadas. O script importa o `.glb` do site no Blender, compara
  a rotação do objeto com a do nó e gira a malha do download para ficar igual (`giro_ate_o_site`; nos `.blend`
  do ExScan a diferença era de 90° a 177°, em 13/11/2026). Depois compara as medidas com as do `obras.json` e
  avisa se passarem de 0,5 cm de diferença (aí a malha não é a mesma do site).
- **Uma só qualidade:** malha com até `--faces-leve` faces sai como `unica` (arquivos `<id>-unica-*.zip`) e a
  janela esconde a escolha Leve/Alta. É o caso das obras do ExScan (0607, 0631, 0803): o escaneamento completo
  não foi guardado, então os downloads usam o `.blend` do site (~200 mil faces), que está no laptop do laboratório.
- **Plano combinado (07/11/2026):** o Lucas exporta sem simplificar as 3 obras do Raptor (0504, 0808, Sapo;
  estimativa pelas capturas: ~3–4, ~7 e ~2–3 milhões de faces) e eu avalio; com as 3 na branch, o professor
  avalia. Aprovado, entram as do ExScan (qualidade única). O processo da fotogrametria (Luara) será definido
  quando as obras chegarem.
- **Malhas detalhadas (08/11/2026):** `D:/ObrasCAL/<pasta>/DetalhadoCAL.<n>.blend`, exportadas pelo Lucas sem
  simplificar: 0504 com 2,2 milhões de faces, Sapo 2,1 milhões e 0808 7,1 milhões (zips de 40 a 190 MB). A textura
  sai na mesma resolução das do site (2048 px; 4096 na 0808). As três estão nos rascunhos `modelos-cal-0504`,
  `modelos-cnrc-0307` e `modelos-cal-0808`. Na 0504 a textura nova tem cor diferente da do site (corpo mais
  rosado e claro); o Lucas escolheu usar a nova nos downloads, e o site continua com a dele. Em 13/11/2026 ele
  pediu que os downloads tenham a mesma cor do site: ver "Mesma cor do site" abaixo.
- **Mesma cor do site** (pedido do Lucas, 13/11/2026): `downloads.mjs` exporta um `comparar.glb` leve, e
  `ferramentas/igualar-cor.mjs` renderiza ele e o `.glb` do site com three.js num Chrome sem janela (mesma luz,
  6 ângulos, sem tone mapping) e casa a distribuição de cores da peça canal por canal (quantis). Se a diferença
  passar de 4%, a textura passa por essa curva de cor (`aplicar_curva`, no Blender) e é medida de novo.
  Medido: 0607 77% → 4%, 0803 109% → 5%, 0631 24% → 7% (o brilho do metálico do site não cabe na textura),
  0504 14%, 0808 6%; o Sapo tinha 2% e ficou como estava. Nas do ExScan a diferença vem do material metálico do
  site, que escurece e satura; os downloads têm material simples e a cor vai para a textura.
  `--sem-igualar-cor` desliga.
- **Obras do ExScan (13/11/2026):** `D:/ObrasCAL/CAL.<n>/CAL.<n>.blend` (0607, 0631, 0803), os `.blend` do site
  trazidos do laptop. O Lucas tirou o metálico e a transparência (Transmission) só nesses arquivos: no site elas
  continuam como estão, e nos downloads a cor do site vai para a textura. Qualidade única: 199 a 245 mil faces, zips de
  7 a 11 MB, nos rascunhos `modelos-cal-0607`, `modelos-cal-0631` e `modelos-cal-0803`. A textura da 0607 estava
  em `Original/`; foi copiada para o lado do `.blend`. A 0803 tem textura de só 1024 px. As obras de
  fotogrametria (Luara) ainda estão em tratamento de malha e textura.

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
