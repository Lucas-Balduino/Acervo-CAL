---
name: nova-obra
description: Publica uma obra nova no site do Acervo CAL a partir do .glb exportado do Blender — otimiza o modelo, cadastra em data/obras.json com a ficha do Tainacan, ajuda a escolher a "frente", gera a miniatura, confere no site e no museu e faz o commit. Use quando o usuário pedir para adicionar, incluir, cadastrar ou publicar uma obra (ex.: "/nova-obra CAL.0612", "/nova-obra CAL.0612 ~/Downloads/moringa.glb").
argument-hint: CAL.0000 [caminho do .glb] [CAL.0001 ...]
---

# /nova-obra

Publica uma ou mais obras novas. Argumentos recebidos: `$ARGUMENTS`

Cada argumento é um número de registro (`CAL.0612`, `cal-0612` ou `0612`), seguido ou não do caminho do
`.glb` exportado do Blender. O processo segue o fluxo do `CLAUDE.md` ("Fluxo de um modelo 3D"); leia-o se
ainda não leu. Fale com o usuário em português simples. Pergunte só o que precisa do olho dele (a frente
da peça, medidas estranhas, publicar); o resto é feito sem pedir.

## 0. Preparar

- `id` = `cal-` + número com 4 dígitos (`CAL.612` → `cal-0612`); `registro` = `CAL.0612`.
- Sem argumento: pergunte o número de registro.
- `git status`: precisa estar na `main`, sem mudanças pendentes, e atualizada (`git pull`). Se estiver em
  outra branch ou com arquivos alterados, diga o que encontrou e pergunte antes de mexer.
- Se `ferramentas/node_modules` não existir: `cd ferramentas && npm install`.
- Se a obra já estiver em `data/obras.json`, avise: é uma atualização de modelo, não uma obra nova
  (siga os passos, mas sem criar outro item e mantendo `frente`, `resumo` e `destaque`).

## 1. Conferir a ficha no acervo

Antes de copiar arquivos, confirme que o registro existe no Tainacan:

```bash
node -e "fetch('https://www.acervocal.unb.br/wp-json/tainacan/v2/items/?search=CAL.0612&perpage=5').then(r=>r.json()).then(j=>console.log(j.items.filter(i=>i.metadata['numero-de-registro']?.value_as_string==='CAL.0612').map(i=>[i.title,i.url])))"
```

- Achou: diga o título ao usuário ("CAL.0612 é *Vaso com alças*").
- Não achou: pare e pergunte se o número está certo. Se o acervo estiver fora do ar, avise e siga
  (a sincronização depois pode ser repetida).
- O usuário disse que a obra não está no Tainacan (ou achou outra peça com o mesmo número): cadastre com
  `"semFicha": true` e escreva à mão título e os dados que ele passar. A sincronização então só mede o
  modelo. **Nunca** sincronize uma obra dessas sem o `semFicha`: viriam os dados da outra peça.
- Cuidado com números da planilha de curadoria do museólogo: lá a coluna "Número de patrimônio" tem a
  numeração de cada coleção (Moringa = 913186; Sapo = CNRC 307), não o número CAL. Peça fora da numeração
  CAL usa a sigla da coleção: `id` `cnrc-0307`, `registro` "CNRC 307".

## 2. Encontrar e otimizar o modelo

O `.glb` bruto do Blender tem ~20 MB e **não** entra no repositório; só a versão otimizada.

- Caminho dado no argumento: use-o.
- Sem caminho: procure `models/<id>/modelo.glb`; senão, os `.glb` mais recentes em `~/Downloads`,
  `~/Desktop` e `~/Documents` (`ls -t`). Mostre o candidato (nome, data, tamanho) e confirme antes de usar.
- Só `.obj`/`.mtl`: pare. O modelo precisa passar pelo Blender (centralizar, orientar, material) e ser
  exportado como `.glb` — a aparência é decidida lá, não aqui.

```bash
mkdir -p models/<id>
node ferramentas/otimizar-glb.mjs "<caminho do .glb>" models/<id>/modelo.glb
```

Confira a saída:
- tamanho final entre ~0,5 e ~5 MB (acima de 5 MB, avise: a página fica lenta no celular);
- medidas em cm plausíveis para uma peça de mesa (entre ~3 e ~150 cm). Se a ficha tiver `dimensoes`,
  compare. Medida absurda (ex.: 0,2 cm ou 4000 cm) = escala errada no Blender: pare e explique.
- **Não** altere material, cor ou textura (ver `CLAUDE.md`).

## 3. Cadastrar e sincronizar

Acrescente ao fim de `data/obras.json` (sem reordenar as outras):

```json
{ "id": "<id>", "registro": "<registro>", "resumo": "", "modelo": "models/<id>/modelo.glb", "poster": "models/<id>/poster.webp", "frente": 0 }
```

Depois `node ferramentas/sincronizar-acervo.mjs`, que traz título, procedência etc. e as medidas do modelo.
Confira com `git diff data/obras.json` que só a obra nova mudou (se outra obra mudou, é porque a ficha
dela foi editada no Tainacan — tudo bem, mas conte ao usuário).

**Resumo:** escreva uma frase no mesmo padrão das outras obras, só com dados da ficha, sem inventar:
"<Tipo de peça> doada pel<o/a> <procedência> em <ano>. Pertence à coleção <coleção> da CAL."
Adapte se a forma de aquisição não for doação ou se faltar algum dado (omita o trecho).

## 4. Escolher a frente

```bash
node ferramentas/navegador.mjs vistas <id>
```

Gera uma imagem com 8 ângulos (0°, 45°, …, 315°). Leia a imagem, escolha o ângulo que parece a frente
(rosto, figura de frente, desenho principal, alças simétricas) e mostre a imagem ao usuário
(`SendUserFile`). Pergunte com `AskUserQuestion`: sua sugestão primeiro "(Recomendado)" e mais 2 ou 3
ângulos plausíveis; o usuário pode digitar outro valor (ex.: 30°) em "Other". Com várias obras, uma
pergunta por obra na mesma chamada (até 4).

Grave o ângulo em `frente`. Se o usuário escolheu um valor entre os da imagem e quiser conferir,
rode `vistas` de novo (a vista atual fica com borda azul).

## 5. Miniatura

```bash
node ferramentas/navegador.mjs poster <id>
```

Deve terminar com `<id>: salva (~15–60 KB)`. Mostre a miniatura ao usuário junto do resultado final.

## 6. Conferir no site e no museu

```bash
node ferramentas/navegador.mjs conferir <id>
```

Confira no resultado e nas imagens (leia-as):
- `erros` vazios nas três páginas;
- medidas iguais às do passo 2; `larguraDaPagina` = 390 no celular;
- a obra aparece de frente na página dela;
- no museu, a obra nova está na sala da coleção dela (`conferir-museu-obra.png`, de frente para ela), sem
  ficar cortada ou atravessando parede, e a vista da entrada continua mostrando as salas em sequência.
  As salas crescem sozinhas com o número de obras (uma coleção nova ganha sala nova); se algo ficou
  estranho, não mexa em `SALA` por conta própria: mostre a imagem e explique.

Se o navegador sem janela falhar (Chrome não encontrado), o caminho pode ser dado com `CHROME=...`.

## 6b. Downloads em alta resolução (se houver o .blend completo)

Se existir um `.blend` com a malha completa (ex.: `D:/ObrasCAL/CAL.0612/CAL.0612-alta.blend`; ver
"Downloads em alta resolução" no `CLAUDE.md`), gere e envie os downloads:

```bash
node ferramentas/downloads.mjs <id> "<caminho do -alta.blend>" --enviar
```

Confira na saída: a escala detectada (milímetros), medidas iguais às do passo 2 e nenhum `.zip` perto de
2 GB. O release fica em rascunho. Na hora de publicar (passo 7), com o "pode publicar" do usuário, publique o
release **antes** do push: `gh release edit modelos-<id> --draft=false`. Sem o `.blend` completo, pule este
passo (a obra fica sem o botão de download até lá).

## 7. Commit e publicação

Adicionar obra é mudança de dados: vai direto na `main` (como as obras anteriores).

```bash
git add models/<id> data/obras.json
git commit -m "docs: Adicionar obra CAL 0612"
```

Várias obras: `docs: Adicionar obras CAL 0612 e 0613`. Termine a mensagem com a linha de coautoria
pedida pelo sistema.

Fazer `git push` publica no site em ~1 minuto. Mostre ao usuário o título, a miniatura, as medidas, o
resumo escrito e a frente escolhida, e pergunte se pode publicar. Depois do push, confira que o
GitHub Pages terminou (`gh api repos/Lucas-Balduino/Acervo-CAL/pages/builds/latest`) e dê o link
`https://lucas-balduino.github.io/Acervo-CAL/obra.html?id=<id>`. Mencione quantas obras faltam para a
meta de 20.
