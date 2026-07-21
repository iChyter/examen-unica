# Examen UNICA

Simulacro tipo examen de admisión UNICA 2026-1, Área C (Ingeniería).

## Estructura
```
├── index.html              ← menú principal (lee examenes/indice.json)
└── examenes/
    ├── indice.json         ← catálogo de simulacros
    └── unica-2026-1/
        ├── index.html      ← examen
        └── preguntas.json  ← clave + metadatos
```

## Agregar un examen nuevo
1. Crear carpeta `examenes/<slug>/` con su `index.html` y datos.
2. Agregar entrada en `examenes/indice.json`.

## Stack
- Tailwind (CDN) + Inter/JetBrains Mono.
- LocalStorage: respuestas y flags persisten entre refreshes.
- **PWA instalable** (manifest + service worker + íconos).
- Sin build step. Abrir con `python -m http.server 8000` → `http://localhost:8000`.
