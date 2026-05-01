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

## ⚙️ Development
Development now runs through Docker only.

From `SEO-Test/`:

```bash
just dev
```

This starts the full stack in containers:
- app on `http://127.0.0.1:3000`
- PocketBase on `http://127.0.0.1:8090`
- the same Chromium/Xvfb capture environment used by the app runtime
- and resets PocketBase data on every run

Local credentials:
- App login: `demo@local.test` / `DemoUser123!`
- PocketBase superuser: `admin@local.test` / `LocalAdmin123!`

Useful recipes:
```bash
just
just dev
just dev-reset
just dev-keep
just down
```

Notes:
- PocketBase bootstrap tooling lives in `Infrastructure/pocketbase/`
- `just dev` is intentionally Docker-first so development matches deployed runtime behavior

## 🌐 Docker Deployment
This app is now designed to run as a single Docker Compose stack with:
- `app`: the Express application
- `pocketbase`: the PocketBase service and SQLite data store
- `caddy`: the reverse proxy in front of the app

### Compose setup
1. Configure real secrets and API keys in `Infrastructure/.env`
   - Set `APP_ORIGIN` to the public HTTPS app URL, e.g. `https://seo.irakli.life`. If this is left as `http://localhost:3000` in production, SvelteKit will reject login/logout and other POST forms with `Cross-site POST form submissions are forbidden`.
2. Start the stack:
   ```bash
   cd Infrastructure
   docker compose up --build -d
   ```

### PocketBase behavior
- PocketBase binds to `127.0.0.1:8090` on the host in production, so it is not publicly exposed.
- Production deploys preserve the named `pocketbase_data` Docker volume. A deploy may recreate the PocketBase container, but it must not recreate or delete the persisted PocketBase database.
- Only local reset recipes (`just dev`, `just dev-reset`, `just dev-reset-no-build`) intentionally delete PocketBase data so migrations can rebuild a clean local database.
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

To access the PocketBase admin UI on production, open an SSH tunnel:

```bash
ssh -L 8090:127.0.0.1:8090 user@server
```

Then open `http://127.0.0.1:8090/_/` locally.

### Safe deployment
Use the root deploy script from `SEO-Test/`:

```bash
./deploy.sh
```

The deploy script:
- pulls the selected branch and rebuilds the app image
- pins `COMPOSE_PROJECT_NAME=seo-mini-tool` by default so named volume names stay stable across deploy paths
- starts `pocketbase`, `app`, and `caddy` explicitly
- runs cleanup without `docker compose down -v`, `docker volume rm`, or `docker system prune --volumes`
- refuses deploy cleanup if a volume-deleting command is introduced

### Useful endpoints
- App health: `GET /api/health`
- PocketBase status from the app: `GET /api/pocketbase/status`
- External audit API:
  - `POST /api/v1/audits` with `Authorization: Bearer $EXTERNAL_AUDIT_API_KEY` and JSON `{ "domain": "example.com", "displayDomain": "example.com" }`
  - `GET /api/v1/audits/:auditId` to check queued/running/completed/failed status
  - `GET /api/v1/audits/:auditId/result` after completion
  - `POST /api/v1/audits/:auditId/export/google-doc` with JSON `{}` to create/update the Google Doc export and return its Google Drive view URL

External API setup requires `EXTERNAL_AUDIT_API_KEY`, PocketBase superuser credentials, and the Google Workspace variables already used by the in-app Google Docs export. Access to the returned Google Doc URL follows the Drive folder/document sharing settings.

## 🤝 Known Adjustments
Recent workflow enhancements have integrated specific vocabulary updates (e.g. converting "AI visibility" to "not whitelisted") and advanced error-catches for empty H1 elements!
