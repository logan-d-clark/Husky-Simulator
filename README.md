# Husky Simulator

A top-down neighborhood treat-gathering game. Play as a husky loose on a hot
summer day — gather treats before your owner comes home, manage food/water
(and the poop/pee they become), win over households, and beat the rival
chihuahua.

## Develop
- `npm install`
- `npm run dev` — local dev server
- `npm test` — unit tests
- `npm run build` — production build to `dist/`

## Controls
WASD move · Q drink · E trick · C poop · Z pee

## Deploy (GitHub Pages)
Pushing to `main` runs `.github/workflows/deploy.yml`, which builds and
publishes `dist/` to Pages. One-time: repo Settings → Pages → Source = "GitHub
Actions". The site serves under `/husky-simulator/` (set by `vite.config.ts`
`base`); rename there if the repo name differs.
