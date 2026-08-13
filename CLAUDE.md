# linear-gratis (linear.dude.fi)

Self-hosted Linear feedback collection tool deployed at https://linear.dude.fi.
Fork of [curiousgeorgios/linear-gratis](https://github.com/curiousgeorgios/linear-gratis).

## This is a public repository

Never commit secrets, API keys, tokens, passwords, or internal credentials.
All sensitive values go in `.env.local` (gitignored) or Cloudflare secrets.
The Supabase anon key and Cloudflare account ID in `wrangler.jsonc` are public by design.

## Branch strategy

- `main` — the fork point, frozen at `d77c950` (14.4.2026). We no longer pull upstream, so this is a historical marker, not a live branch
- `dude` — Dude-specific customizations, deploy from this branch
- Features should be built inside branches from `main`
- PR-able changes must be done in their feature branch first, then merged to `dude` — never the other way around
- Dude-specific changes go directly on the `dude` branch

## We do not merge upstream

Decided 13.8.2026, DEV-1199. The remaining upstream commits are features we don't
want, and one of them deletes `issue-detail-modal.tsx`, which hosts customer
comments. Migration numbering also collided from 015 onward, so a merge was never
cheap.

That is only safe because we still watch their security work: the weekly
`.github/workflows/upstream-security-watch.yml` reports upstream commits that
look security-relevant and opens one GitHub issue for review. Port what applies
by hand, then move the SHA in `.github/upstream-watch-state` forward. Never
advance that file without reviewing, or commits get skipped silently — which is
how six vulnerabilities stayed live for four months.

Run it locally with `node .github/scripts/check-upstream-security.mjs`, or against any
baseline with `node .github/scripts/check-upstream-security.mjs <sha>`.

## PR draft tasks for upstream PRs

- Whenever a new PR-able feature/fix branch is created, also create a Linear PR draft task as a subtask of `DEV-814`
- Title format: `PR: feature/branch-name - Short description` (or `fix/branch-name - Short description` for fixes)
- Status: `In Review`
- Description: summary of the change, which files were modified, and the branch name
- Purpose: tracks upstream PRs that need to be opened against `curiousgeorgios/linear-gratis`

## Deployment

- Build: `npm run build:worker`
- Deploy: `npx wrangler deploy`
- ALWAYS rebuild (`npm run build:worker`) before `npx wrangler deploy`. Wrangler ships whatever is already in `.open-next/`, so deploying without a fresh build can silently push the previous build's bundle. Verify the deploy by curling the live URL or checking a tagged string in the new chunk.
- Secrets managed via `npx wrangler secret put <KEY>`
- Local dev env vars in `.env.local` (gitignored)
- A passing curl does not mean a passing browser. `fetch` writes a header value one byte per JS code unit, so `ä` leaves the browser as latin-1 `0xE4`, while curl sends the shell's UTF-8 `0xC3 0xA4` and the Worker decodes headers as UTF-8. Anything non-ASCII crossing a header must be percent-encoded, and verification has to use the bytes the browser actually sends. This shipped a broken password-protected view once.

## Auth

- Email + password authentication via Supabase
- Users are created in Supabase dashboard with auto-confirm enabled

## Database

- Database migrations are in `supabase/migrations/`
- New migrations should be run in the Supabase SQL Editor, in numeric order
- There is no tracking table: forgetting a migration shows up at runtime as `column "X" does not exist`
- Whenever a new migration ships, the CHANGELOG entry must say `Run migration NNN_*.sql in Supabase before deploying`

## Design guidelines

- All components must look like Linear.app
- Use existing shadcn/ui components from `src/components/ui/`

## Changelog

- CHANGELOG.md format: `### x.x.x: yyyy-mm-dd` headings with `*` bullets, no main heading
- Keep version in package.json in sync with CHANGELOG.md
- Reference Linear issues at end: `Fix navigation bug, Ref: DEV-123`
- Update CHANGELOG.md after each change
- Use present tense in commits and CHANGELOG.md
- No formatting in CHANGELOG.md except `inline code` and when absolute necessary
- Use `*` as bullets in CHANGELOG.md
- Keep CHANGELOG.md date up to date when adding entries
- Use semver, major only with major changes, minor for "major" changes, patches for small changes - never continue longer than .20 patch
- Add branch name in parentheses for PR-able features: `Add feature x (`feature/branch-name`)`
- Mark dude-specific changes with `(dude-specific change)` at the end

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
