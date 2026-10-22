# Gêmeos Digitais CAL

Site de visita em 3D a obras da Casa da Cultura da América Latina (UnB).
A ficha museológica (técnica, aquisição, registro) continua no
[Acervo CAL](https://www.acervocal.unb.br/).

Este repositório está em HTML, CSS e JavaScript, sem framework, para
permanecer legível. Não use `arquivo://` no navegador: o catálogo e os
modelos só carregam por HTTP.

## Como abrir

Na pasta do projeto:

```bash
npx --yes serve .
```

Ou, no Cursor/VS Code, a extensão Live Server. Depois abra o endereço
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
| `models/` | Arquivos `.glb` (um pasta por obra) |

Cada arquivo em `css/` e `js/` começa com um comentário dizendo o que
ele faz e o que ele **não** faz.

## Como incluir uma obra

1. Crie `models/<id>/modelo.glb`.
2. Acrescente um item em `data/obras.json` (campos em `data/LEIA-ME.md`).
3. Recarregue a página.

A pasta `models/exemplo/` tem um cubo só para testar o visualizador.
Pode apagar quando a primeira obra escaneada entrar no repositório.

## O que ainda não está neste site

Páginas extras (grade de obras, metodologia), integração como página
dentro de acervocal.unb.br e painel de edição no navegador. A estrutura
de pastas já deixa espaço para isso.
