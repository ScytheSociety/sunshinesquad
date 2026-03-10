# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Official website for **Sunshine Squad**, the gaming clan division of Scythe Society. The site is a **static HTML/CSS/JS site with no build step**, designed to be hosted on GitHub Pages.

## Development

No package manager or build tools. To develop locally, serve the root directory with any static HTTP server:

```bash
# Python
python -m http.server 8080

# Node.js
npx serve .
```

Opening files directly as `file://` will cause CORS errors when fetching JSON/HTML components — always use a local server.

## Architecture

### Core utilities (`assets/js/app.js`)

Exports used by all page scripts:
- `repoRoot()` — detects the GitHub Pages subdirectory prefix at runtime
- `url(path)` — builds an absolute URL relative to repo root
- `loadJson(path)` / `loadText(path)` — fetch wrappers that use `url()`

### Component system (`assets/js/components.js`)

On every page, `components.js` is loaded as a module and automatically:
1. Fetches and injects `components/navbar.html` into `#navbar-container`
2. Fetches and injects `components/footer.html` into `#footer-container`
3. Replaces `{{ROOT}}` placeholders in component HTML with `repoRoot()`
4. Dynamically populates the navbar's games dropdown from `data/games.json`

### Data layer (`data/`)

All content is driven by JSON files:
- `games.json` — game list with `guild`/`serie` flags and page URLs; drives the navbar dropdown
- `streams.json` — Twitch channel list shown on the home page
- `schedule.json` — weekly events with `id`, `fecha` (ISO date), `hora` (HH:MM in **America/Lima** timezone), `duracion` (hours), `juego`, `evento`
- `activities.json` — event detail keyed by event `id` (description, requirements, links); merged with schedule data in popups

**All times in `schedule.json` are stored in `America/Lima` and converted to the user's local timezone client-side.**

### Page structure

```
index.html                        ← Home (root depth)
pages/
  _template.html                  ← Template for pages/ depth (uses ../assets/)
  _template_nested.html           ← Template for pages/subdir/ depth (uses ../../assets/)
  horario/schedule.html           ← Weekly schedule calendar
  juegos/juegos.html              ← Games listing
  juegos/ragnarok/ragnarok.html   ← Per-game page (nested depth)
assets/
  css/main.css                    ← Global styles (dark theme, .card-dark, .btn-ss, .social-btn)
  css/pages/<page>.css            ← Per-page styles
  js/app.js                       ← Shared utilities (ES module)
  js/components.js                ← Navbar/footer loader (ES module)
  js/pages/<page>.js              ← Per-page logic (ES module)
components/
  navbar.html / footer.html       ← Shared HTML fragments
data/
  *.json                          ← All site content/config
```

### Adding a new page

- Use `pages/_template.html` (for `pages/mypage.html`) or `pages/_template_nested.html` (for `pages/mygame/mygame.html`)
- The `#navbar-container` and `#footer-container` divs plus the `components.js` script tag are required boilerplate — do not remove them
- Always load `components.js` before page-specific scripts
- Add the game entry to `data/games.json` to have it appear in the navbar dropdown

### Adding a new scheduled event

1. Add an entry to `data/schedule.json` with a unique `id` — time in **America/Lima**
2. Add a matching entry to `data/activities.json` keyed by the same `id` with description, requirements, and links
