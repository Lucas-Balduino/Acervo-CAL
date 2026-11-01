# Gêmeos Digitais CAL

Site de visita em 3D a obras da Casa da Cultura da América Latina (UnB),
produzido pelo projeto de extensão PJ772-2026. A ficha museológica (técnica,
aquisição, registro) continua no [Acervo CAL](https://www.acervocal.unb.br/).

No ar em: https://lucas-balduino.github.io/Acervo-CAL/

O site é HTML, CSS e JavaScript, sem framework e sem etapa de build, para
permanecer legível. Não abra o `index.html` direto do disco (`file://`): o
catálogo e os modelos só carregam por HTTP.

## Como abrir

Na pasta do projeto (precisa do Node instalado):

```bash
node ferramentas/servidor.mjs
```

Depois abra `http://localhost:3000`. Qualquer servidor estático também serve
(`npx --yes serve .`, Live Server do VS Code), mas só o `servidor.mjs` salva
as miniaturas geradas por `ferramentas/posters.html`.

## Páginas

| Página | O que é |
|---|---|
| `index.html` | Início: obra em destaque girando, progresso da meta de 20 obras, obras recentes e o projeto |
| `obras.html` | Grade de obras com busca, filtros e ordenação (o estado fica no endereço) |
| `obra.html?id=cal-0607` | Uma obra: visualizador 3D, cubo de vistas, ficha e obra anterior/próxima |
| `museu.html` | Museu virtual — em desenvolvimento |
| `sobre.html` | Sobre o processo — em desenvolvimento |

## Mapa da pasta

| Caminho | O que é |
|---|---|
| `css/tokens.css` | Cores, fonte e medidas da CAL |
| `css/base.css` | Reset, tipografia, botões |
| `css/layout.css` | Cabeçalho, menu, seções, rodapé |
| `css/galeria.css` | Cartões de obra, busca e filtros |
| `css/inicio.css` | Página inicial |
| `css/viewer.css` | Página da obra: palco 3D, cubo e ficha |
| `js/data.js` | Lê `data/obras.json` e formata os dados |
| `js/navegacao.js` | Menu do celular (todas as páginas) |
| `js/cartoes.js` | Monta o cartão de uma obra |
| `js/inicio.js` | Página inicial |
| `js/galeria.js` | Página Obras: busca, filtros, ordenação |
| `js/obra.js` | Página da obra: ficha e navegação |
| `js/viewer.js` | Carrega o `.glb`, câmera e cubo |
| `data/obras.json` | Obras visíveis no site |
| `data/LEIA-ME.md` | Como cadastrar uma obra |
| `models/` | Uma pasta por obra: `modelo.glb` e `poster.webp` |
| `ferramentas/` | Scripts de preparo (não fazem parte do site) |

Cada arquivo em `css/` e `js/` começa com um comentário dizendo o que
ele faz e o que ele **não** faz.

## Como incluir uma obra

1. Exporte o `.glb` do Blender para `models/cal-<número>/modelo.glb`.
2. Otimize: `node ferramentas/otimizar-glb.mjs models/cal-<número>/modelo.glb`
   (detalhes e instalação em `models/LEIA-ME.md`).
3. Acrescente `{ "id": "cal-<número>", "modelo": "...", "frente": 0 }` em
   `data/obras.json` e rode `node ferramentas/sincronizar-acervo.mjs` para trazer
   título, procedência etc. do Acervo CAL e as medidas do modelo.
4. Com o servidor ligado, abra `http://localhost:3000/ferramentas/posters.html?id=cal-<número>`
   para gerar a miniatura.
5. Recarregue o site e confira a peça.

Detalhes dos campos em `data/LEIA-ME.md`.

## Como publicar

O GitHub Pages publica a branch `main`. Mudanças maiores entram por uma
branch separada e só vão para a `main` depois de testadas localmente.
