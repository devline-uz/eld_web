# OneBook ELD — web panel

Back-office panel for OneBook ELD: React 19, TypeScript, Vite 6, TanStack Query, Tailwind 4.

## Requirements

- Node.js 24 or newer (`engines` in `package.json`)
- npm (the repo ships `package-lock.json`)

## Setup

```sh
npm install
cp .env.example .env.local
```

Vite reads `.env.local`, not `.env.example`, so the copy step is required.

`VITE_AUTH_MODE=dev` (the default in `.env.example`) shows the **Developer sign-in** block
(email + password) on the sign-in page. With any other value only Google sign-in is shown,
as in production.

## Run

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server on http://localhost:5173 against the real backend at `VITE_API_BASE_URL` (default `http://localhost:3002/api`). |
| `npm run build` | Typecheck, production build, bundle-budget check. |
| `npm run preview` | Serve the production build on http://localhost:4173. |

## Checks

| Command | What it does |
| --- | --- |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint with house rules, zero warnings allowed |
| `npm run test:unit` | Vitest unit/component tests with coverage |
| `npx vitest run <path>` | Run a single test file |
| `npm run test:contract` | API contract tests |
| `npx playwright test` | End-to-end tests |
| `npm run format` | Prettier over `src/` |
