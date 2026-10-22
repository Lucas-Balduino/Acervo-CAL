# data/ — lista das obras

`obras.json` é a lista que o visualizador lê. Não há banco de dados nem painel admin: para incluir uma peça, edite este arquivo e coloque o `.glb` em `models/`.

## Campos de cada item

| Campo | Obrigatório | Uso |
|---|---|---|
| `id` | sim | Identificador curto, igual ao nome da pasta em `models/` |
| `titulo` | sim | Nome da obra na lista e no visualizador |
| `autoria` | sim | Artista ou atribuição |
| `resumo` | não | Texto curto de aproximação (não é a ficha museológica) |
| `modelo` | sim | Caminho relativo ao `.glb`, a partir da raiz do site |
| `poster` | não | Imagem de espera enquanto o 3D carrega (jpg/webp/png) |
| `urlAcervo` | não | Link da ficha 2D em acervocal.unb.br |

## Exemplo de uma obra real

```json
{
  "id": "cal-0000",
  "titulo": "Título da obra",
  "autoria": "Nome da artista",
  "resumo": "Um parágrafo para a visita em 3D.",
  "modelo": "models/cal-0000/modelo.glb",
  "poster": "models/cal-0000/poster.webp",
  "urlAcervo": "https://www.acervocal.unb.br/acervo/..."
}
```

Depois de salvar o JSON, recarregue a página no navegador (com o servidor local ligado).
