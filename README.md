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

1. **Clone the repository:**
   ```bash
   git clone https://github.com/ikoanti/SEO-Test.git
   ```

2. **Navigate & Install Dependencies:**
   ```bash
   cd SEO-Test/App
   npm install
   ```

3. **Configure Environment Variables:**
   Create a `.env` file inside the `/App/` folder and insert your necessary APIs:
   ```env
   ANTHROPIC_API_KEY=your_claude_api_key_here
   OPEN_PAGE_RANK_API_KEY=your_open_page_rank_key_here
   PAGESPEED_API_KEY=your_pagespeed_key_here
   POCKETBASE_URL=http://127.0.0.1:8090
   POCKETBASE_SUPERUSER_EMAIL=admin@example.com
   POCKETBASE_SUPERUSER_PASSWORD=change-me-now
   POCKETBASE_AUTH_COLLECTION=app_users
   ```

4. **Run the API server:**
   ```bash
   npm run dev
   ```
   *(This runs the Express backend on port 3000.)*

5. **Run the Svelte frontend:**
   ```bash
   npm run dev:client
   ```
   *(This runs the Vite frontend on port 5173 and proxies `/api` to the backend.)*

## 🌐 Docker Deployment
This app is now designed to run as a single Docker Compose stack with:
- `app`: the Express application
- `pocketbase`: the PocketBase service and SQLite data store
- `caddy`: the reverse proxy in front of the app

### Compose setup
1. Copy `Infrastructure/.env.example` to `Infrastructure/.env`
2. Set real secrets and API keys
3. Start the stack:
   ```bash
   cd Infrastructure
   docker compose up --build -d
   ```

### PocketBase behavior
- PocketBase runs on `http://localhost:8090`
- The migration in `Infrastructure/pocketbase/pb_migrations/1735689600_init_seo_tool.js` auto-creates:
  - `app_users` auth collection
  - `audit_runs`
  - `audit_reports`
- The Express app authenticates users against PocketBase and protects the `/api/*` routes with bearer-token validation.
- The Express app saves audit payloads and generated HTML reports into PocketBase when the PocketBase env vars are configured.
- You can seed the initial login with `APP_AUTH_EMAIL`, `APP_AUTH_PASSWORD`, and `APP_AUTH_NAME` in `Infrastructure/.env`.

### Useful endpoints
- App health: `GET /health`
- PocketBase status from the app: `GET /api/pocketbase/status`

## 🤝 Known Adjustments
Recent workflow enhancements have integrated specific vocabulary updates (e.g. converting "AI visibility" to "not whitelisted") and advanced error-catches for empty H1 elements!
