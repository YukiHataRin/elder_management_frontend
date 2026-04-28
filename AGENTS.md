# Repository Guidelines

## Project Structure & Module Organization

This is a Vite + React frontend for the Elder Management admin system. Application code lives in `src/`: `src/pages/` holds route-level screens, `src/components/` reusable UI, `src/context/` React context state, and `src/api/` backend wrappers (`client.js`, `management.js`). Global styling is in `src/index.css` and `src/App.css`; Tailwind configuration is in `tailwind.config.js`. Static assets belong in `public/` or `src/assets/`. API references and integration notes live at the root, including `openapi.json` and `API_REQUIREMENTS_V2_EXT.md`.

## Build, Test, and Development Commands

- `npm install`: install Node dependencies from `package-lock.json`.
- `npm run dev`: start the Vite development server with hot reload.
- `npm run build`: create the production bundle in `dist/`.
- `npm run preview`: serve the built bundle locally for verification.
- `npm run lint`: run ESLint across JavaScript and JSX files.
- `python3 test_api_v2.py`, `python3 test_user_api.py`, `python3 test_returns.py`: run API/integration checks when backend contracts change.

## Coding Style & Naming Conventions

Use ES modules, React function components, and hooks. Name components and context providers in `PascalCase` (`PatientDetail.jsx`, `AuthContext.jsx`); name helpers and API functions in `camelCase`. Keep page logic in `src/pages/` and shared request logic in `src/api/`. Follow the existing JSX style: two-space indentation and Tailwind utilities for layout and visual styling. ESLint uses React Hooks and React Refresh rules; unused variables are errors unless they match the allowed uppercase constant pattern.

## Testing Guidelines

There is no dedicated frontend unit-test runner configured yet. For UI changes, run `npm run lint` and `npm run build`, then manually verify key flows with `npm run dev`. For API schema, authentication, patient, task, or return-data changes, run the relevant Python checks from the root. Update fixtures such as `user5_logs.json` only when API output intentionally changes. Name new test scripts clearly, for example `test_<feature>.py`.

## Commit & Pull Request Guidelines

Recent history uses Conventional Commit-style prefixes such as `feat:`, `chore:`, and `docs:`. Keep commit subjects imperative and scoped to one change, for example `feat: add patient risk filters`. Pull requests should include a short summary, linked issue or task, screenshots for UI changes, and verification notes listing commands run. Mention API contract or environment assumptions explicitly.

## Security & Configuration Tips

Do not commit `.env` files, credentials, generated debug dumps, or private patient data. Keep API base URL changes centralized in `src/api/client.js`, and cross-check endpoint changes against `openapi.json` or `API_REQUIREMENTS_V2_EXT.md`.
