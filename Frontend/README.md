# Wesal Frontend

React 19 + Vite + Tailwind CSS + React Router + Axios.

## Setup

```bash
cd Frontend
npm install
npm run dev
```

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start development server |
| `npm run build` | Production build |
| `npm run preview` | Preview production build |
| `npm run lint` | Run oxlint |

## Structure

```
src/
  pages/       # Route pages
  services/    # API clients (Axios)
  assets/      # Static assets
  App.jsx      # Router setup
  main.jsx     # Entry point
```

Copy `.env.example` to `.env` and set `VITE_API_BASE_URL` when the backend is ready.
