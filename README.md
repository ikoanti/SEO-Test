# SEO Mini Audit Tool

![Deployment Status](https://img.shields.io/badge/Deployment-cPanel-blue)
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
- **Frontend:** Vanilla HTML/CSS/JavaScript with responsive layout structure.
- **Backend:** Node.js & Express.js.
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
   # Add any other required configs
   ```

4. **Run the Server:**
   ```bash
   npm run dev
   ```
   *(This uses `node --watch` automatically from standard npm scripts).*

## 🌐 Deployment Details
This application is designed specifically for **Node.js hosting via cPanel**.
- It leverages automated webhook implementations connecting this repository directly to the cPanel terminal.
- Pushes to the `main` branch trigger immediate syncs that update the server dependencies and live app cache on `seo.irakli.life`.
- The infrastructure and `App` boundaries separate deployment logic dynamically.

## 🤝 Known Adjustments
Recent workflow enhancements have integrated specific vocabulary updates (e.g. converting "AI visibility" to "not whitelisted") and advanced error-catches for empty H1 elements!
