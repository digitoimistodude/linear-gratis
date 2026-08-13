### 0.9.1: 2026-08-13

* Add a weekly `upstream-security-watch` GitHub Action that reports upstream commits whose subject or touched files look security-relevant and opens one GitHub issue for review, so dropping the fork sync does not mean losing sight of their security fixes (dude-specific change)
* Record the reviewed upstream commit in `.github/upstream-watch-state`, which only moves forward after a report has been read, so nothing is skipped silently (dude-specific change)

### 0.9.0: 2026-08-13

* Delete `/api/decrypt-token` and `/api/encrypt-token`: the decrypt route returned the caller's plaintext Linear API token to any same-origin script with no anti-CSRF token, so any future XSS anywhere on the origin could have lifted the token; ported from upstream `556f7be`
* Move public form submission server-side to a new `/api/form/[slug]/submit` route that resolves the form owner's token in the route and calls Linear directly, so the token never reaches the browser; ported from upstream `556f7be`
* Restore public form submissions, which had been broken since `/api/linear` started requiring an authenticated session that anonymous form visitors never have (dude-specific change)
* Make the profile Linear token write-only: the page now shows a configured or not-configured indicator plus a replace field backed by the new `/api/profile/linear-token` route, instead of round-tripping the plaintext token to display it; ported from upstream `d0dcfeb`
* Encrypt new tokens with AES-256-GCM behind a `v2:` version prefix, with existing CryptoJS rows read transparently and rotated to `v2` on first authenticated read; ported from upstream `c3dff90`
* Emit single-line JSON logs tagged `encryption.rotation.failure` so a failing rotation is alertable rather than silent; ported from upstream `f28a240`

### 0.8.1: 2026-08-12

* Reject Linear webhook payloads whose signature does not match: the check computed the HMAC and logged a mismatch but never returned, so any unauthenticated caller could forge a webhook and trigger customer reply emails from our sending domain plus unbounded Realtime broadcasts (dude-specific change)
* Validate the team and project ids from a webhook payload as UUIDs before they reach a PostgREST `.or()` filter, closing a filter-injection that could widen the notified view set (dude-specific change)
* Require an authenticated session on `/api/auth/linear/connect`, which revokes and clears the workspace Linear OAuth token before starting a new consent flow and was reachable by anyone (dude-specific change)
* Require an authenticated session on `/api/auth/linear/callback` so an OAuth token cannot be bound as the workspace token by an unauthenticated caller (dude-specific change)
* Derive the OAuth redirect URI from the request URL instead of the caller-supplied `Origin` and `Referer` headers (dude-specific change)
* Return an explicit column list from the public branding endpoint instead of `select('*')` (dude-specific change)
* Bump `ws` to clear a high-severity advisory reached through `@supabase/realtime-js`
* Run migration `024_fix_view_comments_rls.sql` in Supabase before deploying

### 0.8.0: 2026-08-12

* Replace the `x-view-password` header with a signed httpOnly access cookie: the password is proven once at the parent endpoint and the child endpoints verify a scoped, 24h, hash-fingerprinted token instead, so the plaintext password no longer sits in `localStorage` where any XSS could read it and no request pays a bcrypt compare; ported from upstream `fdda5c0`
* Route every public-view child endpoint through one `authorisePublicView` guard covering active state, expiry and password, so a new child endpoint cannot silently skip the check; ported from upstream `fdda5c0`
* Require the roadmap password on the public roadmap comment and vote endpoints, which previously checked only the slug and active state, via the matching `authoriseRoadmap` guard; ported from upstream `fdda5c0`
* Verify the caller-supplied issue id belongs to one of the roadmap's projects on the public roadmap comment and vote endpoints, so they can no longer store rows against arbitrary issue ids
* Visitors to a password-protected view or roadmap now re-enter the password once every 24 hours instead of never, because access is a signed cookie rather than a stored password

### 0.7.10: 2026-08-12

* Apply the view display flags server-side: `show_descriptions`, `show_labels`, `show_assignees` and `show_priorities` now strip the data from the public-view and roadmap payloads instead of leaving it in the JSON for the client to hide, closing a leak where a password-protected view returned descriptions the owner had switched off; ported from upstream `e74fdeb`
* Apply per-issue description overrides on password-protected views too, so the override feature works on the POST path and survives a hidden `show_descriptions` (dude-specific change)

### 0.7.9: 2026-08-11

* Escape the `title`, `subtitle` and `category` query parameters in `/api/og` and cap their length, closing a reflected XSS that ran same-origin on linear.dude.fi; ported verbatim from upstream `e74fdeb`, which fixed this in April
* Send `Content-Security-Policy` and `X-Content-Type-Options: nosniff` from `/api/og` so a future escaping regression cannot execute scripts (dude-specific change)

### 0.7.8: 2026-08-10

* Percent-encode the view password in the `x-view-password` header so non-ASCII passwords work: browsers write header values one byte per code unit, so an `ä` went out as a single latin-1 byte that the Worker then read as invalid UTF-8, breaking every child endpoint on password-protected views whose password is not pure ASCII (`fix/public-view-bola-scope`)

### 0.7.7: 2026-08-10

* Scope public-view child endpoints to the view: `issue/[issueId]` and its `comments` route now verify the requested issue belongs to the view's projects, exclusions and allowed statuses, so an active slug can no longer read or comment on arbitrary workspace issues (`fix/public-view-bola-scope`)
* Require the view password on every public-view child endpoint, not just the parent: issue detail, comments, project updates, creation metadata and issue creation all reject requests without it, sent as an `x-view-password` header (`fix/public-view-bola-scope`)
* Deny comment thread reads when the Linear token is missing instead of falling through to stored comments, so the scope check cannot be skipped (`fix/public-view-bola-scope`) (dude-specific change)
* Restrict creation metadata and issue creation to active views, matching the other public-view endpoints (`fix/public-view-bola-scope`)

### 0.7.6: 2026-06-18

* Fix inverted priority labels in the filter dropdown and the issue creation modal (`fix/inverted-priority-filter-labels`)

### 0.7.5: 2026-06-02

* Match luku.app footer structure on linear.dude.fi: nav left, version + attribution right; "Made with ♥ in Finland, sponsored by Dude" when signed in, "Forked by digitoimistodude" when signed out (dude-specific change)
* Hide the app footer on `/view/*` so it never leaks app chrome onto a branded customer view (dude-specific change)
* Strip owner-side notification emails entirely - workspace owners already get Linear's native notifications, so our duplicate mail is gone; bell-icon in-app notifications stay (dude-specific change)
* Drop the optimistic insert on the customer comment form; the Realtime fetch round-trip is the only source of truth so comments no longer flash twice before settling (dude-specific change)
* Remove the in-page footer on the landing page that was duplicating the new app footer (dude-specific change)
* Drop the `/use-cases`, `/integrations`, `/comparison` upstream marketing pages we don't ship, along with their data files and the nav links pointing at them (dude-specific change)
* Show the same "Forked by digitoimistodude" footer in both signed-in and signed-out states for consistency (dude-specific change)
* Let any signed-in workspace user edit, delete, and add per-issue description overrides on any public view, not only the original creator; logged-out and external visitors are still rejected by the API and never see the editor (dude-specific change)
* Run migration `023_share_public_views_admin_access.sql` in Supabase before deploying

### 0.7.4: 2026-06-02

* Fix silent Linear `commentCreate` 401: send OAuth tokens with the `Bearer` prefix Linear requires, keep raw personal API keys as-is (dude-specific change)
* Stop the customer comment double-rendering by deduping when the Supabase Realtime broadcast brings in the server row before the POST response handler runs (dude-specific change)

### 0.7.3: 2026-06-01

* Add bell icon to the top-right nav for logged-in admins with unread count, recent notifications dropdown, mark-as-read, and live Realtime updates when new notifications land (dude-specific change)
* Log the Linear `commentCreate` response when no comment id comes back, so the next test paste tells us why the customer-to-Linear sync is being silently rejected (dude-specific change)
* Run migration `022_add_notifications.sql` in Supabase before deploying

### 0.7.2: 2026-06-01

* Security/privacy fix: webhook notification dispatch now requires the new comment's parent to be a Linear comment we synced from a customer via linear.dude.fi. Top-level Linear comments and replies in unrelated internal threads no longer email subscribers or view owners (dude-specific change)

### 0.7.1: 2026-06-01

* Polish email templates: deep link straight to the issue in the public view, sender attribution and unsubscribe link in the footer (`feature/email-templates-polish`)
* `MAIL_FROM` is now required so the public repo never bakes in a specific sender address (`feature/email-templates-polish`)
* Customer email field on the comment form (optional); opting in subscribes the customer to that thread (dude-specific change)
* Linear-side replies now email every subscribed customer plus every owner of a view that includes the issue, all deduplicated (dude-specific change)
* `/unsubscribe?token=...` page removes the subscription matching the token from the email footer (dude-specific change)
* Run migration `021_add_view_subscriptions.sql` in Supabase before deploying

### 0.7.0: 2026-06-01

* Email the view owner via Resend whenever a customer files a new issue through `allow_issue_creation` (`feature/email-notifications`)
* Email the view owner via Resend whenever a customer posts a comment on a public view (dude-specific change)
* Requires `RESEND_API_KEY` Cloudflare secret and a verified sender domain in Resend; `MAIL_FROM` env overrides the default sender

### 0.6.6: 2026-05-22

* Fix issue creation on project-only views by deriving the team from the chosen Linear project instead of erroring with "View has no team configured" (dude-specific change)
* Show Linear-side replies on the public comment thread by nesting them under the customer comment they reply to, keeping unrelated internal Linear comments private (dude-specific change)
* Propagate Linear comment deletions to the public view so removed comments disappear (dude-specific change)
* Refetch the public comment thread live on Linear comment webhooks, matching the real-time behaviour of status changes (dude-specific change)
* Run migration `020_add_view_comment_linear_id.sql` in Supabase before deploying

### 0.6.5: 2026-05-15

* Add a "paste SVG markup" textarea to workspace branding admin alongside file upload and URL, render inline on public view header and navigation, sanitize on save and at render (`feature/branding-logo-svg`)
* Extend per-view branding override on `/views` with file upload and pasted-SVG markup alongside URL; render precedence is per-view SVG, workspace SVG, per-view URL, workspace URL, text (dude-specific change)
* Return `branding_logo_svg` from `/api/public-view/[slug]` so per-view SVG actually renders (dude-specific change)
* Render the view description next to the view title in the public header (`feature/show-view-description-on-public-page`)
* Replace absolute creation dates on views, forms, and domains admin with Linear-style relative labels and full timestamp tooltips (`feature/relative-dates`)
* Rename `Preview` button on `/views` to `Open view` to match what it actually does (dude-specific change)
* Run migrations `018_add_logo_svg.sql` and `019_add_view_branding_logo_svg.sql` in Supabase before deploying

### 0.6.2: 2026-05-13

* Add Linear-style Sort dropdown to public views (Last created, First created, Last updated, First updated, Priority, Title) with `createdAt-desc` as the default and `orderBy: createdAt` on the issues query (`feature/view-sort-options`)
* Persist sort choice in the URL and localStorage so reloads and shared links keep the same ordering (dude-specific change)

### 0.6.1: 2026-05-12

* Omit stateId on customer issue create when team has triage enabled so Linear auto-routes new issues into the triage queue (`feature/customer-issue-triage-routing`)
* Remove non-functional Display button from public view header (`fix/remove-non-functional-display-button`)
* Remove non-functional Insights icon from public view header (`fix/remove-non-functional-stats-insights`)
* Cache `/api/linear/issues` responses in KV for 60 seconds, keyed by workspace token hash and filters (`feature/cache-linear-issues-kv`)

### 0.6.0: 2026-05-12

* Cache Linear projects and teams in Cloudflare KV for 10 minutes per user, dropping CPU pressure on every `/views` render and preventing Worker exceeded-resource (1102) errors (`feature/linear-cache-kv`)
* Lazy-load Linear projects and teams - they no longer fetch on `/views` mount, only when the create or edit view form opens (`feature/linear-cache-kv`)

### 0.5.5: 2026-05-12

* Rebrand all user-facing `linear.gratis` mentions to `linear.dude.fi` (dude-specific change)
* Fix edit view save failing with "One or more selected projects are invalid" when the Linear projects fetch had errored - fall back to the existing view's project/team names so editing keeps working offline (`fix/edit-view-resilient-to-linear-failure`)
* Scroll to top when opening the edit view form so the form is actually visible (`fix/edit-view-resilient-to-linear-failure`)

### 0.5.4: 2026-04-21

* Accept Linear webhooks even when signature verification fails so real-time keeps working; log the mismatch as a warning (dude-specific change)

### 0.5.3: 2026-04-21

* Push real-time refresh into the open issue detail modal, project updates modal, and customer discussion thread so every view surface updates live (`feature/linear-webhook-realtime`)
* Drop duplicate padding on webhook status card (`feature/linear-webhook-realtime`)
* Add a Real-time updates card linking into the webhook wizard from workspace settings (dude-specific change)

### 0.5.2: 2026-04-21

* Match webhook status panel to the existing dot + button pattern used elsewhere in settings (`feature/linear-webhook-realtime`)

### 0.5.1: 2026-04-21

* Expand recommended webhook events to include Projects, Project labels, and Issue attachments, and rename Reactions to Emoji reactions in the wizard (`feature/linear-webhook-realtime`)

### 0.5.0: 2026-04-21

* Push real-time view updates via Linear webhook relayed through Supabase Realtime, with setup wizard at `/settings/webhooks` (`feature/linear-webhook-realtime`), Ref: DEV-871

### 0.4.4: 2026-04-21

* Fix public description override not rendering on views with show descriptions disabled (`feature/per-issue-description-override`)

### 0.4.3: 2026-04-21

* Add per-issue public description override that replaces the Linear description on a public view, editable inline by the view owner (`feature/per-issue-description-override`)

### 0.4.2: 2026-04-21

* Persist public view filters in URL and localStorage, remember password across reloads (`feature/persist-view-state`)

### 0.4.1: 2026-04-21

* Add Projects section to public view filter dropdown, active when issues span multiple projects (`feature/multi-project-views`), Ref: DEV-826

### 0.4.0: 2026-04-21

* Allow a public view to show issues from multiple Linear projects, with picker UX on project updates and issue creation (`feature/multi-project-views`), Ref: DEV-826

### 0.3.10: 2026-04-20

* Hide labels section in public view filter dropdown when view has show labels disabled (`feature/toggle-descriptions-labels`)

### 0.3.9: 2026-04-17

* Fix per-view branding primary color being shadowed by workspace color in inline styles on public view (`feature/view-branding`)

### 0.3.8: 2026-04-17

* Rename view Logo URL label to Logo or Favicon URL (svg, png) and drop optional suffix from Primary color (`feature/view-branding`)
* Drop optional suffix from form labels across admin and public forms in favour of required asterisks (`feature/remove-optional-labels`)

### 0.3.7: 2026-04-17

* Fix view logo not rendering for svg sources by adding min-height matching logo_height (`feature/view-branding`)

### 0.3.6: 2026-04-17

* Fix favicon preview not rendering for svg sources by adding min-height (`feature/dynamic-favicon`)

### 0.3.5: 2026-04-17

* Use Linear's copy icon svg instead of lucide Copy for the detail modal copy button (`feature/copyable-task-id`)

### 0.3.4: 2026-04-17

* Replace cursor-copy plus pointer on kanban card identifier with plain pointer and move copy action in detail modal to a dedicated Copy icon button next to the close button (`feature/copyable-task-id`)

### 0.3.3: 2026-04-17

* Surface admin load and fetch failures as visible toasts on views, forms, and roadmaps pages (`feature/api-error-display`)

### 0.3.2: 2026-04-17

* Add copyable issue identifier on kanban card and detail modal (`feature/copyable-task-id`)

### 0.3.1: 2026-04-17

* Fix React removeChild error and two-click navigation bug caused by branding favicon DOM manipulation in admin navigation (dude-specific change)
* Prevent home page content flash before redirecting authenticated users to public views (dude-specific change)
* Remove Problem/Solution section from logged-out landing page (dude-specific change)

### 0.3.0: 2026-03-18

* Add customer commenting on public view issues with Linear attachment sync (`feature/customer-comments`), Ref: DEV-825
* Add deep linking for issues via `/view/slug/IDENTIFIER` URL pattern (`feature/customer-comments`)
* Add show descriptions and show labels toggles to public view settings, default hidden for new views (`feature/toggle-descriptions-labels`)
* Default project updates to hidden for new views

### 0.2.4: 2026-03-17

* Add hide onboarding toggle in profile settings and dismissible views onboarding section (`feature/hide-onboarding`)
* Add Create new view button to public views list header (`feature/hide-onboarding`)
* Use branding logo and name in admin navigation, Ref: DEV-835 (dude-specific change)
* Use branding favicon in admin, Ref: DEV-836 (dude-specific change)

### 0.2.3: 2026-03-12

* Add toggle to hide project updates from public views (`feature/hide-project-updates`)
* Add Linear-accurate priority icons and estimate display on cards and detail modal (`feature/priority-icons`)
* Hide non-functional Display and Stats buttons until implemented, Ref: DEV-843, DEV-844 (dude-specific change)

### 0.2.2: 2026-03-11

* Add ability to exclude specific issues from public views (`feature/exclude-issues`)
* Show real profile photos from Linear in issue detail modal (`feature/profile-photos`)
* Fix Google Fonts not loading in branding custom fonts (`fix/google-fonts`)
* Fix checkbox gap not rendering due to inline margin override (dude-specific change)

### 0.2.1: 2026-03-10

* Add visibility controls to hide internal comments and activity from public views (`feature/hide-internal-data`)
* Respect `show_descriptions` setting in issue detail modal (`feature/hide-internal-data`)
* Set document title and favicon from branding settings on public pages (`feature/white-label-title`)
* Use auto width for branding logo to scale naturally (`fix/logo-auto-width`)
* Sort projects and teams dropdowns alphabetically (`fix/alphabetical-projects`)

### 0.2.0: 2026-03-09

* Add shared views, forms, domains and roadmaps across authenticated users (`feature/shared-views`)
* Allow all authenticated users to edit and delete shared resources (`feature/shared-views`)
* Add cursor pointer to all interactive elements (`fix/cursor-pointer`)
* Redirect to `/views` after login instead of `/profile` (dude-specific change)
* Remove unnecessary top padding from empty state card (dude-specific change)
* Remove sign-up link from login page (dude-specific change)

### 0.1.1: 2026-03-09

* Fork and self-host as linear.dude.fi on Cloudflare Workers (dude-specific change)
* Replace magic link and GitHub auth with email + password login (dude-specific change)
* Configure Supabase project under Dude org (dude-specific change)
* Fix login redirect after successful sign-in (dude-specific change)
* Add `CLAUDE.md` with project guidelines

### 0.1.0: 2025-09-18

* Fix read-only footer text visibility when issue creation is disabled
* Replace internal API calls with direct Linear API calls for issue creation
* Improve error handling in public view issue creation
* Hide status and labels from public issue submissions
* Implement semantic badge colour system with CSS variables
* Migrate to cookie-based auth with `@supabase/ssr`, add metrics API and new UI components
* Add public roadmaps with kanban and timeline views, order SQL migrations
* Fix custom domains, UI improvements, migrate to Cloudflare Worker
* Fix upload of branding assets, improve creating new issues
* Fix reset branding to default
* Add triage issue status functionality
