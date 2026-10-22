# models/ — arquivos 3D

Cada obra ganha uma pasta com o mesmo `id` usado em `data/obras.json`.

```
models/
  cal-0000/
    modelo.glb      ← arquivo principal (cerca de 10 MB)
    poster.webp     ← opcional, miniatura / imagem de espera
```

## Convenção

- Nome do arquivo 3D: `modelo.glb` (formato glTF binário, o que o visualizador espera).
- Não use espaços no nome da pasta.
- Arquivos acima de ~50 MB disparam aviso no GitHub; acima de 100 MB o GitHub recusa. Nesse caso, fale com a equipe sobre Git LFS.

