# models/ — arquivos 3D

Cada obra ganha uma pasta com o mesmo `id` usado em `data/obras.json`.

```
models/
  cal-0000/
    modelo.glb      ← arquivo principal (depois de otimizado, ~1–3 MB)
    poster.webp     ← opcional, miniatura / imagem de espera
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
2. tira a transparência e o "metálico" que o importador de `.obj` do Blender liga por engano;
3. se pedido, ajusta a cor da textura (ver abaixo);
4. une vértices repetidos e comprime a malha com Draco (de ~22 MB para ~1,5 MB).

No fim, ele mostra o tamanho do arquivo e as medidas da peça em cm. **Confira essas
medidas com a peça física**: se estiverem erradas, a escala precisa ser corrigida no Blender.

## Ajuste de cor

A textura capturada pelo scanner sai mais clara e menos saturada que a obra (efeito do
LED do scanner). Com uma foto da obra como referência, ajuste brilho, saturação e matiz:

```bash
node ferramentas/otimizar-glb.mjs models/cal-0000/modelo.glb --brilho 0.7 --saturacao 1.35 --matiz 5
```

- `--brilho` e `--saturacao` multiplicam (1 = sem mudança); `--matiz` gira a cor em graus
  (positivo puxa do rosa para o laranja).
- Teste os valores numa cópia (`... modelo.glb teste.glb --brilho ...`), compare no site
  com a foto e só depois aplique no `modelo.glb`.
- Os valores ficam gravados no `.glb` e o script se recusa a ajustar duas vezes o mesmo
  arquivo. Para refazer, parta do arquivo original.

Valores já usados:

| Obra | Brilho | Saturação | Matiz | Referência |
|---|---|---|---|---|
| cal-0607 | 0.70 | 1.35 | 5 | foto do dia do escaneamento |
| cal-0631 | — | — | — | sem ajuste (falta foto) |
| cal-0803 | — | — | — | sem ajuste (falta foto) |
