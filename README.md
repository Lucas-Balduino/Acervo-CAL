# Gêmeos Digitais CAL

Site de visita em 3D a obras da Casa da Cultura da América Latina (UnB),
produzido pelo projeto de extensão PJ772-2026. A ficha museológica (técnica,
aquisição, registro) continua no [Acervo CAL](https://www.acervocal.unb.br/).

No ar em: https://lucas-balduino.github.io/Acervo-CAL/

O site é HTML, CSS e JavaScript, sem framework, para permanecer legível.
Não abra o `index.html` direto do disco (`file://`): o catálogo e os
modelos só carregam por HTTP.

## Como abrir

Na pasta do projeto:

```bash
npx --yes serve .
```

Ou, no VS Code, a extensão Live Server. Depois abra o endereço
indicado (em geral `http://localhost:3000`).

## Mapa da pasta

| Caminho | O que é |
|---|---|
| `index.html` | Única página: entrada + visualizador (só marcação) |
| `css/tokens.css` | Cores e fonte da CAL |
| `css/base.css` | Tipografia e reset |
| `css/layout.css` | Cabeçalho, entrada, sidebar |
| `css/viewer.css` | model-viewer, cubo, painel da obra |
| `js/main.js` | Ponto de partida — liga os outros scripts |
| `js/data.js` | Lê `data/obras.json` |
| `js/gallery.js` | Lista e busca |
| `js/viewer.js` | Carrega o `.glb` e a câmera |
| `js/ui.js` | Entrada, sidebar, gaveta de texto |
| `data/obras.json` | Obras visíveis no site |
| `data/LEIA-ME.md` | Como cadastrar uma obra |
| `models/` | Arquivos `.glb` (uma pasta por obra) |
| `ferramentas/` | Script que otimiza o `.glb` antes de publicar (não faz parte do site) |

Cada arquivo em `css/` e `js/` começa com um comentário dizendo o que
ele faz e o que ele **não** faz.

## Como incluir uma obra

1. Exporte o `.glb` do Blender para `models/cal-<número>/modelo.glb`.
2. Otimize: `node ferramentas/otimizar-glb.mjs models/cal-<número>/modelo.glb`
   (detalhes e instalação em `models/LEIA-ME.md`).
3. Acrescente um item em `data/obras.json` (campos em `data/LEIA-ME.md`).
4. Recarregue a página e confira a peça.

## Como publicar

O GitHub Pages publica a branch `main`. Mudanças maiores entram por uma
branch separada e só vão para a `main` depois de testadas localmente.

## O que ainda não está neste site

Página sobre o processo e a metodologia do projeto, galeria com filtros e
a integração com o acervocal.unb.br.
