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
