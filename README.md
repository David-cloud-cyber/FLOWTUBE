# FlowTube

Architecture fonctionnelle sans Next.js, synchronisée avec l'interface Huggy Flow.

## Stack

- Vite + React 19 + TypeScript pour le client.
- Tailwind CSS pour conserver le thème noir cinématique et l'accent vert citron.
- Vercel Serverless Functions dans `api/` pour le backend.
- Anthropic SDK pour l'agent avec tool use.
- fal.ai SDK via queue pour images, vidéos, voix et lipsync.
- PostgreSQL + Drizzle pour projets, conversations, messages, générations, crédits et collections.

## Scripts

```bash
npm install
npm run dev
npm run build
npm run db:push
```

## Variables

Voir `.env.example`.

```bash
ANTHROPIC_API_KEY=
ANTHROPIC_MODEL=claude-opus-4-8
ANTHROPIC_ROUTER_MODEL=claude-sonnet-4-6
FAL_KEY=
DATABASE_URL=
```

Sans secrets, l'app reste testable en mode démo: l'agent répond et les générations utilisent des jobs mockés.

## Routes API

- `GET /api/bootstrap`: état initial de l'interface.
- `POST /api/chat`: stream SSE des messages et générations.
- `GET /api/generations/:id`: polling des jobs fal.ai.
- `GET /api/models`: registre de modèles et crédits estimés.
- `GET/POST /api/projects`: projets.

## Important

L'objectif est de garder l'interface Huggy Flow comme surface produit, pas de créer une nouvelle interface. Les changements principaux sont internes: état réel, API, agent, fal.ai, crédits et persistance.
