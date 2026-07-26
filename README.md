# AstroSaathi

AstroSaathi is a Vedic astrology web app built around "Chat with your Kundli" — an AI chat companion personalized by the user's real birth chart. Charts are computed in the Parāśara tradition with the Lahiri (sidereal) ayanamsa.

## Stack

- React 19 + TypeScript
- TanStack Start / Router / Query
- Vite
- Tailwind CSS 4 + shadcn/ui
- i18next (English, Hindi, Marathi)
- Supabase (Postgres, Auth, Edge Functions)
- OpenRouter for the chat model

## Local development

```bash
npm install
npm run dev
```

The dev server runs on port 3000.

## Environment variables

See [.env.example](.env.example):

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

Never commit secrets — real values live in `.env` (gitignored) or in your deployment provider's environment settings.

## Deployment

Pushes to GitHub are auto-deployed by Vercel. Supabase Edge Functions live in `supabase/functions/` in this repo and are deployed separately via the Supabase CLI/dashboard.
