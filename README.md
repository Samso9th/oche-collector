# oche-collector

The Oche dashboard: projects, one-click promotions, fast/strict mode, activity, people and CLI tokens.

Vite, React 19, TanStack Router and Query, Tailwind 4, Base UI, Sonner, cmdk.

## Run locally

```sh
npm install
VITE_API_URL=http://localhost:3100 npm run dev   # http://localhost:5173
```

## Deploy on Coolify

Add this repo as an application with the Dockerfile build pack, port 80, and one variable:

| Variable | Example |
| --- | --- |
| `API_URL` | `https://api.oche.example.com` |

The container writes `API_URL` into `/config.js` when it starts, so moving the API doesn't need a rebuild. Serve the dashboard on the same parent domain as the API (`oche.example.com`), and set the server's `OCHE_COLLECTOR_URL` to this URL.
