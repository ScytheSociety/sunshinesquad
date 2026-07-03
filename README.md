# Sunshine Squad — web

Sitio estatico, minimalista, en blanco y negro con fuente monoespaciada.
Sin frameworks, sin dependencias: solo HTML y CSS.

## Estructura

```
Web Page/
├── index.html            <- portada
├── blog.html             <- lista de entradas del blog
├── guias.html            <- lista de guias
├── css/
│   └── style.css         <- TODO el estilo esta aqui
├── posts/
│   └── bienvenida.html   <- plantilla de post (copiala para uno nuevo)
├── guias/
│   └── ragnarok-paladin.html  <- plantilla de guia
├── .nojekyll             <- que GitHub Pages no procese nada, sirve tal cual
└── .gitignore
```

## Como agregar un post nuevo

1. Copia `posts/bienvenida.html` y renombralo, ej: `posts/mi-post.html`.
2. Cambia el `<title>`, el `<h1>`, la fecha (`AAAA.MM.DD`) y el contenido.
3. Abre `blog.html` y `index.html` y agrega un `<li>` apuntando al post nuevo
   (lo mas reciente va arriba).

## Como agregar una guia

Igual que un post, pero copiando `guias/ragnarok-paladin.html` y enlazandola
desde `guias.html`.

## Ver la web en local

Doble clic en `index.html` la abre en el navegador. Todo funciona sin servidor.

## Publicar

`git add .` -> `git commit -m "mensaje"` -> `git push`
GitHub Pages actualiza el sitio en 1-2 minutos.
