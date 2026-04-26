# SEO Mini Audit Tool

![Deployment Status](https://img.shields.io/badge/Deployment-Docker%20Compose-blue)
![Live Site](https://img.shields.io/badge/Live-seo.irakli.life-brightgreen)

A comprehensive, AI-powered SEO auditing application designed to automatically scan, analyze, and generate actionable SEO insights for any entered URL.

## 🚀 Live Demo
Access the live deployed tool at: **[https://seo.irakli.life](https://seo.irakli.life/)**

## 💡 Key Features
- **Deep Page Analysis:** Quickly parses HTML meta tags, heading hierarchies (`H1`-`H6`), images matching lacking `alt` attributes, and general content metrics using `Cheerio`.
- **Intelligent Grouping:** Automatically merges identical issues into unified reporting blocks (e.g., consolidating multiple "Missing Alt Tags" or "Missing H1" flags into a single, clean overview).
- **Core Technical Checks:** Specifically targets and verifies `robots.txt` configuration and XML `sitemap` accessibility.
- **Claude AI Integration:** Leverages the `@anthropic-ai/sdk` to run advanced logic and NLP over extracted on-page signals, generating rich AI-backed audit summaries and recommendations.
- **Reporting & Exports:** Supports directly exporting the visually grouped audit data out into Word document (`.docx`) file formulas for easy client delivery.

## 🛠️ Tech Stack
- **Frontend:** Svelte + Vite single-page app.
- **Backend:** Node.js & Express.js.
- **Auth & Data Layer:** PocketBase for app authentication, audit persistence, and generated reports.
- **Crucial Dependencies:**
  - `axios`: For backend HTTP fetching of URLs and sitemaps.
  - `cheerio`: For rapid, jQuery-like DOM traversal and analysis on the server.
  - `@anthropic-ai/sdk`: Direct interactions with Claude AI to synthesize findings.
  - `cors` & `dotenv`: Basic infrastructure config and routing security.

## ⚙️ Local Development
If you're pulling this repository locally to work on the application:

1. **Install app dependencies once:**
   ```bash
   cd SEO-Test/App
   npm install
   ```

2. **Run the local stack from the repo root:**
   ```bash
   cd ..
   just dev
   ```

This starts both:
- PocketBase on `http://127.0.0.1:8090`
- the Svelte app on the next available local Vite port
- and resets the local PocketBase data on every run

Local credentials:
- App login: `demo@local.test` / `DemoUser123!`
- PocketBase superuser: `admin@local.test` / `LocalAdmin123!`

Useful recipes:
```bash
just
just dev
just dev-reset
just dev-keep
```

Notes:
- local PocketBase bootstrap tooling lives in `Infrastructure/pocketbase/` and `scripts/`
- app code stays isolated in `App/`

## 🌐 Docker Deployment
This app is now designed to run as a single Docker Compose stack with:
- `app`: the Express application
- `pocketbase`: the PocketBase service and SQLite data store
- `caddy`: the reverse proxy in front of the app

### Compose setup
1. Configure real secrets and API keys in `Infrastructure/.env`
2. Keep `App/.env.local` as a symlink to `../Infrastructure/.env`
3. Start the stack:
   ```bash
   cd Infrastructure
   docker compose up --build -d
   ```

### PocketBase behavior
- PocketBase runs on `http://localhost:8090`
- The shared migration in `Infrastructure/pocketbase/pb_migrations/1735689600_init_seo_tool.js` auto-creates:
  - `users` auth collection
  - `websites`
  - `audits`
  - `workflows`
  - `runs`
  - `audit_finding_types`
  - `audit_findings`
  - `audit_reports`
- The SvelteKit app authenticates users against PocketBase and protects audit routes through server-side session validation.
- The SvelteKit app saves websites, audits, workflows, runs, findings, and generated HTML reports into PocketBase.
- You can seed the initial login with `APP_AUTH_EMAIL`, `APP_AUTH_PASSWORD`, and `APP_AUTH_NAME` in `Infrastructure/.env`.

### Useful endpoints
- App health: `GET /api/health`
- PocketBase status from the app: `GET /api/pocketbase/status`

## 🤝 Known Adjustments
Recent workflow enhancements have integrated specific vocabulary updates (e.g. converting "AI visibility" to "not whitelisted") and advanced error-catches for empty H1 elements!
