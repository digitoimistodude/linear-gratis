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
- Features should be built inside branches from `main`
- PR-able changes must be done in their feature branch first, then merged to `dude` — never the other way around
- Dude-specific changes go directly on the `dude` branch

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

## Commits and code style

- Always commit build and asset files
- One logical change per commit
- Keep commit messages concise (one line), use sentence case
- Reference Linear issues at end: `Fix navigation bug, Ref: DEV-123`, but follow the original repo commit style if it goes to shared/PR feature
- Never use Claude watermark in commits (FORBIDDEN: "Co-Authored-By")
- No emojis in commits or code
- Use sentence case for headings (not Title Case)
- Never use bold text as headings, use proper heading levels instead
- Always add an empty line after headings
- No formatting in CHANGELOG.md except `inline code` and when absolute necessary

## Claude Code workflow

- Always add tasks to the Claude Code to-do list and keep it up to date
- Always show a task status list to the user after completing actions
- Review your to-do list and prioritize before starting
- If new tasks come in, don't jump to them right away — add them to the list in order of urgency and finish your current work first
- Do not ever guess features, always proof them via looking up the repo, official docs, GitHub code, issues, if possible
- When looking things up, do not use years in search terms like 2024 or 2025, look up recent information
- Keep documentation up to date — when making changes, update internal docs at ~/Projects/internal.docs.dude.fi and add relevant comments to the Linear issue
