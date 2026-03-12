### 0.2.3: 2026-03-12

* Add toggle to hide project updates from public views (`feature/hide-project-updates`)

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
