# linear-gratis (linear.dude.fi)

Self-hosted Linear feedback collection tool deployed at https://linear.dude.fi.
Fork of [curiousgeorgios/linear-gratis](https://github.com/curiousgeorgios/linear-gratis).

## This is a public repository

Never commit secrets, API keys, tokens, passwords, or internal credentials.
All sensitive values go in `.env.local` (gitignored) or Cloudflare secrets.
The Supabase anon key and Cloudflare account ID in `wrangler.jsonc` are public by design.

## Branch strategy

- `main` — upstream-compatible, keep clean for pulling updates
- `dude` — Dude-specific customizations, deploy from this branch

## Deployment

- Build: `npm run build:worker`
- Deploy: `npx wrangler deploy`
- Secrets managed via `npx wrangler secret put <KEY>`
- Local dev env vars in `.env.local` (gitignored)

## Auth

- Email + password authentication via Supabase
- Users are created in Supabase dashboard with auto-confirm enabled

## Database

- Database migrations are in `supabase/migrations/`
- New migrations should be run in the Supabase SQL Editor

## Design guidelines

- All components must look like Linear.app
- Use existing shadcn/ui components from `src/components/ui/`

## Commit style

- Single line, concise commit messages
- No Co-Authored-By tags
