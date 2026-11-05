# models/ — arquivos 3D

Cada obra ganha uma pasta com o mesmo `id` usado em `data/obras.json`.

```
models/
  cal-0000/
    modelo.glb      ← arquivo principal (depois de otimizado, ~1–3 MB)
    poster.webp     ← miniatura (cartões e imagem de espera), gerada por ferramentas/posters.html
```

## Convenção

- Nome da pasta: `cal-` + número de registro do acervo com 4 dígitos (CAL.0607 → `cal-0607`). Sem espaços.
- Nome do arquivo 3D: `modelo.glb` (glTF binário, o formato que o visualizador espera).
- Todo `.glb` passa pelo script de otimização antes de entrar no repositório (ver abaixo).
- Arquivos acima de ~50 MB disparam aviso no GitHub; acima de 100 MB o GitHub recusa.
  Depois de otimizado, nenhum modelo deve chegar perto disso.

## Otimizar um modelo exportado do Blender

Uma vez só, instale as ferramentas:

```bash
cd ferramentas && npm install
```

Depois, para cada obra (na raiz do repositório):

```bash
node ferramentas/otimizar-glb.mjs models/cal-0000/modelo.glb
```

O script:

1. converte a escala de milímetros para metros, se a peça vier em mm (o scanner exporta em mm);
2. mantém o material e a textura como saíram do Blender — a aparência no site fica igual;
3. une vértices repetidos e comprime a malha com Draco (de ~22 MB para ~1,5 MB).

No fim, ele mostra o tamanho do arquivo e as medidas da peça em cm. **Confira essas
medidas com a peça física**: se estiverem erradas, a escala precisa ser corrigida no Blender.

A aparência da obra no site é definida no Blender (aba *Material Properties*). O script
não muda cor nem material; se algo parecer diferente da peça, ajuste no Blender e exporte de novo.

## Miniatura (poster.webp)

O jeito mais simples: `node ferramentas/navegador.mjs poster cal-0000` (usa o Chrome sem abrir janela).
Para ver a obra de 8 ângulos e escolher a `frente`: `node ferramentas/navegador.mjs vistas cal-0000`.

Pelo navegador, com o servidor local ligado (`node ferramentas/servidor.mjs`), abra
`http://localhost:3000/ferramentas/posters.html?id=cal-0000` (sem `?id=`, gera todas).
A página renderiza a obra pela "frente" definida em `data/obras.json` e salva
`models/cal-0000/poster.webp` (~20–40 KB, fundo transparente).
