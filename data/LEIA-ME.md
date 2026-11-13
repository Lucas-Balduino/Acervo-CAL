# data/ — lista das obras

`obras.json` é a lista que o site lê. Não há banco de dados nem painel admin: para incluir uma
peça, coloque o `.glb` (já otimizado, ver `models/LEIA-ME.md`) em `models/` e acrescente a obra aqui.

## Campos escritos à mão

| Campo | Obrigatório | Uso |
|---|---|---|
| `id` | sim | `cal-` + número de registro com 4 dígitos; igual ao nome da pasta em `models/` |
| `modelo` | sim | Caminho do `.glb`, a partir da raiz do site |
| `resumo` | não | Texto curto de aproximação (não é a ficha museológica) |
| `poster` | não | Miniatura (`models/<id>/poster.webp`), gerada por `ferramentas/posters.html` |
| `frente` | não | Ângulo em graus (0–359) do lado principal da obra. É a vista inicial, a miniatura e o botão "Frente" do cubo |
| `destaque` | não | `true` na obra que gira na página inicial (só uma) |
| `semFicha` | não | `true` se a obra ainda não está no Tainacan. A sincronização não busca dados dela (só mede o modelo); título, procedência etc. são escritos à mão |

## Campos vindos do Acervo CAL

Preenchidos por `node ferramentas/sincronizar-acervo.mjs`, que busca o número de registro na API
pública do acervocal.unb.br. **Não edite à mão**: a próxima sincronização sobrescreve.
Para corrigir um dado, corrija no Tainacan e sincronize de novo.

`registro`, `titulo`, `autoria`, `procedencia`, `colecao`, `formaAquisicao`, `anoAquisicao`,
`materialTecnica`, `localProducao`, `dataProducao`, `dimensoesFicha`, `urlAcervo`.
Exceção: nas obras com `"semFicha": true` esses campos são escritos à mão (sem `urlAcervo`, a página
da obra esconde o botão "Ficha completa no Acervo CAL").

O script também mede o modelo 3D e grava `dimensoes` (largura, altura e profundidade em cm).

## Downloads

`downloads` é gravado por `node ferramentas/downloads.mjs <id> <arquivo-alta.blend> --enviar` (não edite à
mão): endereço dos arquivos no GitHub Releases, página do release e, para cada qualidade (`alta` e `leve`),
o número de faces e o tamanho em bytes de cada `.zip` (`glb`, `obj`, `stl`). Sem esse campo, a página da
obra não mostra o botão "Baixar modelo 3D". Passo a passo no `README.md`.

## Textos das coleções (`colecoes.json`)

No museu virtual, cada coleção tem uma sala, e na parede do fundo dela aparecem o nome da coleção e um
texto curto sobre ela. O texto vem de `colecoes.json`, pelo nome da coleção (o mesmo do campo `colecao`
das obras):

```json
{ "Chocó": { "texto": "Reunida para a exposição…", "fonte": "https://www.acervocal.unb.br/sobre/" } }
```

Escrito à mão (o Tainacan não tem descrição das coleções). Coleção sem texto mostra só o nome. Mantenha
o texto curto, com umas 50 palavras, para caber na parede.

## Filtros da página Obras

Os filtros saem destes campos: procedência, tamanho (pela altura do modelo), material e técnica,
local de produção, ano de aquisição e coleção. Um filtro só aparece quando pelo menos duas obras
têm valores diferentes — com mais obras e fichas mais completas, aparecem sozinhos.

## Exemplo

```json
{
  "id": "cal-0607",
  "registro": "CAL.0607",
  "titulo": "Moringa com dois bicos",
  "autoria": "",
  "resumo": "Moringa doada pelo Governo de Santa Catarina em 1993.",
  "procedencia": "Governo de Santa Catarina",
  "colecao": "Inicial",
  "formaAquisicao": "Doação",
  "anoAquisicao": "1993",
  "dimensoes": { "largura": 19.1, "altura": 40.7, "profundidade": 19.3 },
  "modelo": "models/cal-0607/modelo.glb",
  "poster": "models/cal-0607/poster.webp",
  "frente": 90,
  "destaque": true,
  "urlAcervo": "https://www.acervocal.unb.br/acervo/moringa-com-dois-bicos/"
}
```
