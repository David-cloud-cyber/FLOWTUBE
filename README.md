# FlowTube

SaaS conversationnel de création de médias par IA: chat central, sidebar projets, cartes média inline, agent Anthropic et génération fal.ai.

## Fonctionnalités

- Interface Next.js App Router + TypeScript + Tailwind.
- Agent créatif en français avec tool use Anthropic.
- Tools: image, vidéo, retouche, video-to-video, TTS, lipsync, personnages, modèles.
- Jobs fal.ai via queue + polling `/api/generations/:id`.
- Registre de modèles centralisé dans `lib/models.ts`.
- Système de crédits rentable: coût fal x3,5 au prix plancher de 0,008 USD/crédit.
- Postgres + Drizzle pour users, projects, conversations, messages, generations, characters, collections et transactions.
- Clerk optionnel: si les variables Clerk sont présentes, les données sont liées à l'utilisateur connecté; sinon l'app tourne en mode démo.
- Mode démo sans secrets: Anthropic/fal.ai sont simulés pour que le site s'affiche immédiatement sur Vercel.

## Installation

```bash
npm install
npm run dev
```

## Variables d'environnement

Copier `.env.example` vers `.env.local`.

```bash
ANTHROPIC_API_KEY=
ANTHROPIC_MODEL=claude-opus-4-8
ANTHROPIC_ROUTER_MODEL=claude-sonnet-4-6
FAL_KEY=
DATABASE_URL=
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
```

## Base de données

Le schéma est dans `lib/db/schema.ts`.

```bash
npm run db:push
```

Sans `DATABASE_URL`, l'application utilise un stockage mémoire démo. Pour la production, configure Postgres sur Vercel, Neon, Supabase ou équivalent.

## Déploiement Vercel

1. Importer le dépôt GitHub dans Vercel.
2. Ajouter les variables d'environnement.
3. Build command: `npm run build`.
4. Framework preset: Next.js.

L'ancien problème `404: NOT_FOUND` venait de l'absence de `index.html`/app Next à la racine. Le projet est maintenant une app Next.js complète, donc Vercel sert `/` via `app/page.tsx`.

## Notes opérationnelles

- Les endpoints fal.ai changent vite. Ils sont centralisés et surchargeables via variables `FAL_*_ENDPOINT`.
- Les crédits sont estimés avant lancement; la vidéo et les actions chères demandent confirmation.
- Le débit réel de crédits doit rester à la réussite du job. Le schéma `credit_transactions` est prêt pour raccorder le paiement et la réconciliation.
