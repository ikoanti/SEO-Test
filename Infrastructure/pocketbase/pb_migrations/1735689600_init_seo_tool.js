migrate(
  (app) => {
    const authenticatedRule = '@request.auth.id != ""';
    const superuserEmail = $os.getenv("POCKETBASE_SUPERUSER_EMAIL");
    const superuserPassword = $os.getenv("POCKETBASE_SUPERUSER_PASSWORD");

    if (superuserEmail && superuserPassword) {
      try {
        app.findAuthRecordByEmail("_superusers", superuserEmail);
      } catch {
        const superusers = app.findCollectionByNameOrId("_superusers");
        const record = new Record(superusers);
        record.set("email", superuserEmail);
        record.set("password", superuserPassword);
        app.save(record);
      }
    }

    const authCollectionName =
      $os.getenv("POCKETBASE_AUTH_COLLECTION") || "users";
    let authCollection;

    try {
      authCollection = app.findCollectionByNameOrId(authCollectionName);
    } catch {
      authCollection = new Collection({
        type: "auth",
        name: authCollectionName,
        listRule: "id = @request.auth.id",
        viewRule: "id = @request.auth.id",
        createRule: null,
        updateRule: "id = @request.auth.id",
        deleteRule: null,
        authRule: "",
        passwordAuth: {
          enabled: true,
          identityFields: ["email"],
        },
        fields: [{ name: "name", type: "text", required: true, max: 120 }],
        indexes: [
          `CREATE UNIQUE INDEX idx_${authCollectionName}_email ON ${authCollectionName} (email)`,
        ],
      });
      app.save(authCollection);
    }

    try {
      app.findCollectionByNameOrId("websites");
    } catch {
      app.save(
        new Collection({
          type: "base",
          name: "websites",
          listRule: authenticatedRule,
          viewRule: authenticatedRule,
          createRule: authenticatedRule,
          updateRule: authenticatedRule,
          deleteRule: authenticatedRule,
          fields: [
            { name: "url", type: "url", required: true, presentable: true },
            { name: "domain", type: "text", required: true, max: 255 },
          ],
          indexes: [
            "CREATE UNIQUE INDEX idx_websites_url ON websites (url)",
            "CREATE INDEX idx_websites_domain ON websites (domain)",
          ],
        }),
      );
    }

    try {
      app.findCollectionByNameOrId("audit_finding_types");
    } catch {
      app.save(
        new Collection({
          type: "base",
          name: "audit_finding_types",
          listRule: authenticatedRule,
          viewRule: authenticatedRule,
          createRule: authenticatedRule,
          updateRule: authenticatedRule,
          deleteRule: authenticatedRule,
          fields: [
            {
              name: "key",
              type: "text",
              required: true,
              max: 120,
              presentable: true,
            },
            { name: "label", type: "text", required: true, max: 160 },
            {
              name: "sort_order",
              type: "number",
              required: true,
              onlyInt: true,
              min: 1,
            },
            {
              name: "severity",
              type: "select",
              required: false,
              maxSelect: 1,
              values: ["Urgent", "High", "Medium"],
            },
            { name: "report_template", type: "editor", required: false },
          ],
          indexes: [
            "CREATE UNIQUE INDEX idx_audit_finding_types_key ON audit_finding_types (key)",
            "CREATE INDEX idx_audit_finding_types_sort ON audit_finding_types (sort_order)",
          ],
        }),
      );
    }

    const findingTypesCollection = app.findCollectionByNameOrId(
      "audit_finding_types",
    );
    const findingTypes = [
      ["pageSpeed", "Page Speed"],
      ["openPageRank", "Open PageRank"],
      ["h1Tags", "H1 Tags"],
      ["metaTitles", "Meta Titles"],
      ["imageAltTags", "Image Alt Tags"],
      ["canonicalUrls", "Canonical URLs"],
      ["internalLinks", "Internal Links"],
      ["sitemap", "Sitemap"],
      ["robotsTxt", "Robots.txt"],
      ["llmsTxt", "LLMs.txt"],
      ["structuredData", "Structured Data"],
      ["security", "Security"],
      ["mixedContent", "Mixed Content"],
      ["contentQuality", "Content Quality"],
      ["webIcons", "Web Icons"],
      ["ssl", "SSL"],
      ["mobileUsability", "Mobile Usability"],
      ["flash", "Flash"],
      ["iframes", "Iframes"],
      ["charset", "Charset"],
      ["loremIpsum", "Lorem Ipsum"],
      ["openGraph", "Open Graph"],
      ["shopifyUrls", "Shopify URLs"],
      ["internationalDomains", "International Domains"],
      ["trailingSlash", "Trailing Slash"],
      ["wwwResolve", "WWW Resolve"],
      ["trustSignals", "Trust Signals"],
      ["tapTargets", "Tap Targets"],
      ["lazyLoadImages", "Lazy Load Images"],
      ["aiVisibility", "AI Visibility"],
    ];

    findingTypes.forEach(([key, label], index) => {
      let record;
      try {
        record = app.findFirstRecordByFilter(
          "audit_finding_types",
          `key = "${key}"`,
        );
      } catch {
        record = new Record(findingTypesCollection);
        record.set("key", key);
        record.set("label", label);
        record.set("sort_order", index + 1);
        app.save(record);
      }
    });

    const findingTypeReportTemplates = {
      robotsTxt: {
        severity: "Urgent",
        template: `We’re noticing more and more traffic, as well as sales coming in from AI Chatbots such as ChatGPT, Perplexity, Gemini, etc - and with that, we need to ensure that your Shopify store is properly optimized, in order to maximize your visibility in AI Chatbots.

Unfortunately, {{domain}} is currently not explicitly whitelisting important AI Chatbots and crawlers, which can have a significant negative impact on your visibility.

By whitelisting AI Chatbots and modifying your robots.txt we’ll be able to unblock AI crawlers, and have your site welcome them. In other words, we’d be inviting AI Chatbots to crawl your site, and feature your products and content in answers to people’s questions.`,
      },
      pageSpeed: {
        severity: "High",
        template: `At the moment your site scores only {{worstScore}} out of 100 on Google’s Page Speed Insight’s test, this is currently negatively impacting both your conversion and organic rankings and we suggest fixing this as soon as possible.

Slow loading pages reduce user engagement and make it harder for Google to reward the site with stronger organic rankings. Mobile score: {{mobileScore}}. Desktop score: {{desktopScore}}.

The current speed metrics should be treated as a high-priority technical SEO opportunity because improving them usually has a direct impact on both user experience and conversion rate.`,
      },
      h1Tags: {
        severity: "High",
        template: `H1 heading tags are among the 3 most important on-page factors, as Google directly looks and crawls them to figure out the context of your page.

If you don’t have a clean H1 setup on your page, Google will simply struggle a bit more to understand the topic you’re trying to rank for and thus you’ll rank lower.

In the case of your website, {{count}} pages have H1 issues, which is a great quick-win opportunity.`,
      },
      metaTitles: {
        severity: "High",
        template: `Meta titles and descriptions are a critical part of SEO, serving as the first impression in search results. Missing, duplicated, or overly long metadata makes it harder to maximize the visibility of your website.

During our review of {{domain}}, we found {{count}} metadata issues across the crawled pages.

Addressing these by creating unique, concise, and search-focused metadata presents an opportunity to enhance click-through rates, improve user experience, and boost SEO effectiveness.`,
      },
      imageAltTags: {
        severity: "High",
        template: `Missing alt tags for images can negatively impact your website's accessibility and SEO. Alt tags provide crucial information to visually impaired users and search engines, enhancing the understanding and context of the images.

Currently, {{count}} {{domain}} images lack descriptions, affecting accessibility, user experience, and search visibility.`,
      },
      shopifyUrls: {
        severity: "High",
        template: `By default Shopify is set up to use collection based product URLs, when clicking to a specific product within a collection.

Let’s say that you have a product called “Blue T-Shirt”, with the following URL structure: domain.com/products/blue-t-shirt. However, if you click on that same product from within a collection, called “Apparel” for example, the product will now have the following URL structure: domain.com/collections/apparel/products/blue-t-shirt.

This is a bad practice, as it creates duplicate URLs of the same product, which negatively affects your Google rankings and organic traffic. We noticed the exact same thing happening on {{domain}}, which represents another quick-win that can be implemented for an additional boost in organic traffic.`,
      },
      internalLinks: {
        severity: "High",
        template: `4xx errors, like 404 pages, occur when a page is inaccessible or a link is broken, leading to a poor user experience and hurting SEO. These errors disrupt the flow of visitors and prevent search engines from properly indexing your site, which can lead to lower rankings.

Fixing the uncovered instances of 4xx errors on your website is crucial. Addressing these issues by redirecting or correcting broken links will enhance user experience and improve search engine crawling, helping to maintain your site's performance and visibility.`,
      },
      openGraph: {
        severity: "Medium",
        template: `OpenGraph tags control how your pages appear when they are shared across social platforms and increasingly help AI and discovery tools understand page context.

Adding the missing OpenGraph tags on {{domain}} is a simple technical improvement that makes shared links more compelling and improves how your pages are interpreted outside traditional search.`,
      },
      webIcons: {
        severity: "Medium",
        template: `Favicons and Apple Touch Icons are small technical trust signals that improve brand presentation in browser tabs, bookmarks, mobile devices, and search surfaces.

Adding the missing icon assets is a straightforward fix that helps {{domain}} look more complete and trustworthy across devices.`,
      },
      charset: {
        severity: "Medium",
        template: `Declaring the page charset helps browsers and crawlers interpret page content correctly. Missing charset declarations can create avoidable rendering and parsing issues.

Adding a proper charset declaration is a simple technical cleanup item for {{domain}}.`,
      },
      aiVisibility: {
        severity: "Urgent",
        template: `Your AI visibility score of {{aiScore}} represents a major opportunity cost. Search behavior is shifting toward AI-powered tools, and brands that are not visible in those answers are missing demand before users even reach Google.

Improving the technical structure, crawlability, content clarity, and AI crawler accessibility of {{domain}} can help the website become easier for AI systems to understand, cite, and recommend.`,
      },
    };

    Object.entries(findingTypeReportTemplates).forEach(
      ([key, reportTemplate]) => {
        const record = app.findFirstRecordByFilter(
          "audit_finding_types",
          `key = "${key}"`,
        );
        record.set("severity", reportTemplate.severity);
        record.set("report_template", reportTemplate.template);
        app.save(record);
      },
    );

    try {
      app.findCollectionByNameOrId("audits");
    } catch {
      app.save(
        new Collection({
          type: "base",
          name: "audits",
          listRule: authenticatedRule,
          viewRule: authenticatedRule,
          createRule: authenticatedRule,
          updateRule: authenticatedRule,
          deleteRule: authenticatedRule,
          fields: [
            {
              name: "website",
              type: "relation",
              required: true,
              maxSelect: 1,
              collectionId: app.findCollectionByNameOrId("websites").id,
              cascadeDelete: true,
            },
            {
              name: "created_by",
              type: "relation",
              required: false,
              maxSelect: 1,
              collectionId: authCollection.id,
              cascadeDelete: true,
            },
            {
              name: "status",
              type: "select",
              required: true,
              maxSelect: 1,
              values: ["queued", "running", "completed", "failed"],
            },
            { name: "completed_at", type: "date", required: false },
            { name: "summary_json", type: "editor", required: false },
            {
              name: "report_status",
              type: "select",
              required: false,
              maxSelect: 1,
              values: ["idle", "queued", "running", "completed", "failed"],
            },
            { name: "report_error", type: "editor", required: false },
            { name: "report_started_at", type: "date", required: false },
            { name: "report_completed_at", type: "date", required: false },
            { name: "report_html", type: "editor", required: false },
            {
              name: "selected_report_finding_types_json",
              type: "editor",
              required: false,
            },
            { name: "ai_visibility_json", type: "editor", required: false },
            { name: "audit_json", type: "editor", required: false },
          ],
          indexes: [
            "CREATE INDEX idx_audits_website ON audits (website)",
            "CREATE INDEX idx_audits_created_by ON audits (created_by)",
            "CREATE INDEX idx_audits_status ON audits (status)",
          ],
        }),
      );
    }

    try {
      app.findCollectionByNameOrId("workflows");
    } catch {
      app.save(
        new Collection({
          type: "base",
          name: "workflows",
          listRule: authenticatedRule,
          viewRule: authenticatedRule,
          createRule: authenticatedRule,
          updateRule: authenticatedRule,
          deleteRule: authenticatedRule,
          fields: [
            {
              name: "audit",
              type: "relation",
              required: true,
              maxSelect: 1,
              collectionId: app.findCollectionByNameOrId("audits").id,
              cascadeDelete: true,
            },
            {
              name: "status",
              type: "select",
              required: true,
              maxSelect: 1,
              values: ["queued", "running", "completed", "failed"],
            },
            { name: "queued_at", type: "date", required: true },
            { name: "started_at", type: "date", required: false },
            { name: "completed_at", type: "date", required: false },
            { name: "error_message", type: "editor", required: false },
            { name: "run_log", type: "editor", required: false },
          ],
          indexes: [
            "CREATE UNIQUE INDEX idx_workflows_audit ON workflows (audit)",
            "CREATE INDEX idx_workflows_status ON workflows (status)",
          ],
        }),
      );
    }

    try {
      app.findCollectionByNameOrId("runs");
    } catch {
      app.save(
        new Collection({
          type: "base",
          name: "runs",
          listRule: authenticatedRule,
          viewRule: authenticatedRule,
          createRule: authenticatedRule,
          updateRule: authenticatedRule,
          deleteRule: authenticatedRule,
          fields: [
            {
              name: "workflow",
              type: "relation",
              required: true,
              maxSelect: 1,
              collectionId: app.findCollectionByNameOrId("workflows").id,
              cascadeDelete: true,
            },
            {
              name: "audit_finding_type",
              type: "relation",
              required: true,
              maxSelect: 1,
              collectionId: app.findCollectionByNameOrId("audit_finding_types")
                .id,
              cascadeDelete: true,
            },
            {
              name: "status",
              type: "select",
              required: true,
              maxSelect: 1,
              values: ["queued", "running", "completed", "failed"],
            },
            { name: "started_at", type: "date", required: true },
            { name: "completed_at", type: "date", required: false },
            { name: "error_message", type: "editor", required: false },
            { name: "run_log", type: "editor", required: false },
            {
              name: "sort_order",
              type: "number",
              required: true,
              onlyInt: true,
              min: 1,
            },
          ],
          indexes: [
            "CREATE INDEX idx_runs_workflow ON runs (workflow)",
            "CREATE INDEX idx_runs_finding_type ON runs (audit_finding_type)",
            "CREATE UNIQUE INDEX idx_runs_workflow_finding_type ON runs (workflow, audit_finding_type)",
          ],
        }),
      );
    }

    try {
      app.findCollectionByNameOrId("audit_findings");
    } catch {
      app.save(
        new Collection({
          type: "base",
          name: "audit_findings",
          listRule: authenticatedRule,
          viewRule: authenticatedRule,
          createRule: authenticatedRule,
          updateRule: authenticatedRule,
          deleteRule: authenticatedRule,
          fields: [
            {
              name: "audit",
              type: "relation",
              required: true,
              maxSelect: 1,
              collectionId: app.findCollectionByNameOrId("audits").id,
              cascadeDelete: true,
            },
            {
              name: "audit_finding_type",
              type: "relation",
              required: true,
              maxSelect: 1,
              collectionId: app.findCollectionByNameOrId("audit_finding_types")
                .id,
              cascadeDelete: true,
            },
            {
              name: "run",
              type: "relation",
              required: false,
              maxSelect: 1,
              collectionId: app.findCollectionByNameOrId("runs").id,
              cascadeDelete: true,
            },
            {
              name: "status",
              type: "select",
              required: true,
              maxSelect: 1,
              values: ["pass", "warn", "fail", "info"],
            },
            { name: "title", type: "text", required: true, max: 255 },
            { name: "detail", type: "editor", required: false },
            { name: "page_url", type: "url", required: false },
            { name: "meta_json", type: "editor", required: false },
          ],
          indexes: [
            "CREATE INDEX idx_audit_findings_audit ON audit_findings (audit)",
            "CREATE INDEX idx_audit_findings_type ON audit_findings (audit_finding_type)",
            "CREATE INDEX idx_audit_findings_run ON audit_findings (run)",
          ],
        }),
      );
    }

    try {
      app.findCollectionByNameOrId("audit_screenshots");
    } catch {
      app.save(
        new Collection({
          type: "base",
          name: "audit_screenshots",
          listRule: authenticatedRule,
          viewRule: authenticatedRule,
          createRule: authenticatedRule,
          updateRule: authenticatedRule,
          deleteRule: authenticatedRule,
          fields: [
            {
              name: "audit",
              type: "relation",
              required: true,
              maxSelect: 1,
              collectionId: app.findCollectionByNameOrId("audits").id,
              cascadeDelete: true,
            },
            {
              name: "audit_finding_type",
              type: "relation",
              required: true,
              maxSelect: 1,
              collectionId: app.findCollectionByNameOrId("audit_finding_types")
                .id,
              cascadeDelete: true,
            },
            {
              name: "run",
              type: "relation",
              required: false,
              maxSelect: 1,
              collectionId: app.findCollectionByNameOrId("runs").id,
              cascadeDelete: true,
            },
            { name: "title", type: "text", required: true, max: 255 },
            { name: "page_url", type: "url", required: false },
            {
              name: "image",
              type: "file",
              required: true,
              maxSelect: 1,
              maxSize: 20971520,
              mimeTypes: ["image/png"],
            },
          ],
          indexes: [
            "CREATE INDEX idx_audit_screenshots_audit ON audit_screenshots (audit)",
            "CREATE INDEX idx_audit_screenshots_type ON audit_screenshots (audit_finding_type)",
            "CREATE UNIQUE INDEX idx_audit_screenshots_audit_type_run ON audit_screenshots (audit, audit_finding_type, run)",
          ],
        }),
      );
    }

    try {
      app.findCollectionByNameOrId("audit_reports");
    } catch {
      app.save(
        new Collection({
          type: "base",
          name: "audit_reports",
          listRule: null,
          viewRule: null,
          createRule: null,
          updateRule: null,
          deleteRule: null,
          fields: [
            {
              name: "target_url",
              type: "url",
              required: true,
              presentable: true,
            },
            { name: "domain", type: "text", required: true, max: 255 },
            { name: "generated_at", type: "date", required: true },
            {
              name: "passed_count",
              type: "number",
              required: false,
              onlyInt: true,
              min: 0,
            },
            {
              name: "warning_count",
              type: "number",
              required: false,
              onlyInt: true,
              min: 0,
            },
            {
              name: "failed_count",
              type: "number",
              required: false,
              onlyInt: true,
              min: 0,
            },
            { name: "audit_json", type: "editor", required: true },
            { name: "report_html", type: "editor", required: true },
          ],
          indexes: [
            "CREATE INDEX idx_audit_reports_domain ON audit_reports (domain)",
            "CREATE INDEX idx_audit_reports_generated_at ON audit_reports (generated_at)",
          ],
        }),
      );
    }

    const appAuthEmail = $os.getenv("APP_AUTH_EMAIL");
    const appAuthPassword = $os.getenv("APP_AUTH_PASSWORD");
    const appAuthName = $os.getenv("APP_AUTH_NAME") || "App User";

    if (appAuthEmail && appAuthPassword) {
      try {
        app.findAuthRecordByEmail(authCollectionName, appAuthEmail);
      } catch {
        const authCollection = app.findCollectionByNameOrId(authCollectionName);
        const authRecord = new Record(authCollection);
        authRecord.set("email", appAuthEmail);
        authRecord.set("password", appAuthPassword);
        authRecord.set("passwordConfirm", appAuthPassword);
        authRecord.set("name", appAuthName);
        authRecord.set("verified", true);
        app.save(authRecord);
      }
    }
  },
  (app) => {
    for (const collectionName of [
      "audit_screenshots",
      "audit_findings",
      "runs",
      "workflows",
      "audit_reports",
      "audits",
      "audit_finding_types",
      "websites",
    ]) {
      try {
        app.delete(app.findCollectionByNameOrId(collectionName));
      } catch {}
    }

    const authCollectionName =
      $os.getenv("POCKETBASE_AUTH_COLLECTION") || "users";
    const appAuthEmail = $os.getenv("APP_AUTH_EMAIL");

    if (appAuthEmail) {
      try {
        app.delete(app.findAuthRecordByEmail(authCollectionName, appAuthEmail));
      } catch {}
    }

    try {
      app.delete(app.findCollectionByNameOrId(authCollectionName));
    } catch {}

    const superuserEmail = $os.getenv("POCKETBASE_SUPERUSER_EMAIL");
    if (superuserEmail) {
      try {
        app.delete(app.findAuthRecordByEmail("_superusers", superuserEmail));
      } catch {}
    }
  },
);
