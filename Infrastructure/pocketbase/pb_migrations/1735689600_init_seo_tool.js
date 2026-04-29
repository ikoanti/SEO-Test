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
      ["pageSpeed", "Unoptimized page speed"],
      ["openPageRank", "Open PageRank"],
      ["missing-h1-tags", "Missing H1 tags"],
      ["multiple-h1-tags", "Multiple H1 tags"],
      ["missing-product-schema", "Missing product schema"],
      ["missing-faq-schema", "Missing FAQ Schema"],
      ["missing-organization-schema", "Missing Organization Schema"],
      ["unlinked-blog", "Unlinked Blog"],
      ["metaTitles", "Meta Titles"],
      ["imageAltTags", "Image Alt Tags"],
      ["canonicalUrls", "Canonical URLs"],
      ["internalLinks", "Internal Links"],
      ["sitemap", "Sitemap"],
      ["robotsTxt", "AI Chatbots/LLMs Not Whitelisted"],
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

    try {
      app.findCollectionByNameOrId("audit_report_templates");
    } catch {
      app.save(
        new Collection({
          type: "base",
          name: "audit_report_templates",
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
              max: 140,
              presentable: true,
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
            { name: "title", type: "text", required: true, max: 255 },
            {
              name: "priority",
              type: "select",
              required: true,
              maxSelect: 1,
              values: ["Urgent", "High", "Medium"],
            },
            { name: "match_pattern", type: "text", required: false, max: 255 },
            { name: "template_body", type: "editor", required: true },
            {
              name: "sort_order",
              type: "number",
              required: true,
              onlyInt: true,
              min: 1,
            },
            { name: "enabled", type: "bool", required: false },
          ],
          indexes: [
            "CREATE UNIQUE INDEX idx_audit_report_templates_key ON audit_report_templates (key)",
            "CREATE INDEX idx_audit_report_templates_type ON audit_report_templates (audit_finding_type)",
            "CREATE INDEX idx_audit_report_templates_sort ON audit_report_templates (sort_order)",
          ],
        }),
      );
    }

    const reportTemplatesCollection = app.findCollectionByNameOrId(
      "audit_report_templates",
    );
    const reportTemplates = [
      {
        key: "ai-chatbots-llms-not-whitelisted",
        findingTypeKey: "robotsTxt",
        title: "AI Chatbots/LLMs Not Whitelisted",
        priority: "Urgent",
        matchPattern:
          "GPTBot|Google-Extended|Anthropic|AI|Blocked|Not Specified",
        body: `We’re noticing more and more traffic, as well as sales coming in from AI Chatbots such as ChatGPT, Perplexity, Gemini, etc - and with that, we need to ensure that your Shopify store is properly optimized, in order to maximize your visibility in AI Chatbots.

Unfortunately, {{domain}} is currently blocking ALL AI Chatbots and crawlers, which is having a significant negative impact on your visibility.

By whitelisting AI Chatbots and modifying your robots.txt we’ll be able to unblock AI crawlers, and have your site welcome them.

In other words, we’d be inviting AI Chatbots to crawl your site, and feature your products and content in answers to people’s questions.`,
      },
      {
        key: "unoptimized-page-speed",
        findingTypeKey: "pageSpeed",
        title: "Unoptimized page speed",
        priority: "High",
        matchPattern: "",
        body: `At the moment your site scores only {{worstScore}} out of 100 on Google’s Page Speed Insight’s test, this is currently negatively impacting both your conversion and organic rankings and we suggest fixing this as soon as possible.`,
      },
      {
        key: "multiple-h1-tags",
        findingTypeKey: "multiple-h1-tags",
        title: "Multiple H1 tags",
        priority: "High",
        matchPattern: "multiple h1|empty or multiple",
        body: `One of the top SEO practices for on-page SEO is to always have only ONE H1 tag per page after all H1 tags are one of the top points that give Google the context of your page.

At the moment, you have {{count}} pages with multiple H1 tags, which is negatively impacting their rankings and organic traffic.`,
      },
      {
        key: "missing-h1-tags",
        findingTypeKey: "missing-h1-tags",
        title: "Missing H1 tags",
        priority: "High",
        matchPattern: "missing h1",
        body: `H1 heading tags are among the 3 most important on-page factors, as Google directly looks and crawls them to figure out the context of your page.

If you don’t have an H1 heading tag on your page, Google will simply struggle a bit more to understand the topic you’re trying to rank for and thus you’ll rank lower.

In the case of your website, {{count}} pages seem to be missing H1 heading tags, adding them is a great quick-win opportunity.`,
      },
      {
        key: "missing-product-schema",
        findingTypeKey: "missing-product-schema",
        title: "Missing product schema",
        priority: "Urgent",
        matchPattern: "Missing product schema",
        body: `At the moment, one of the biggest growth opportunities for {{domain}} is applying the proper product schema code.

Here’s how properly applied product schema looks in organic search:

Here’s how your product pages (that have dozens of reviews) look currently:

By adding a piece of code and working together with the developers of your product review app, we’ll be able to achieve the same thing for your website.

This usually doubles the click-through rates from organic search, which pushes you up even further in the rankings.`,
      },
      {
        key: "missing-faq-schema",
        findingTypeKey: "missing-faq-schema",
        title: "Missing FAQ Schema",
        priority: "High",
        matchPattern: "Missing FAQ Schema",
        body: `{{domain}} is currently missing the FAQ Schema on {{count}} pages that contain question-and-answer style content. This structured data code tells Google and AI Chatbots exactly what questions your pages answer.

Without it, competitors who have implemented FAQ Schema are more likely to be featured when potential customers ask relevant questions in Google or AI tools like ChatGPT, Gemini, Claude, and others.

By adding FAQ Schema to the right pages, we'll ensure both Google and AI Chatbots can properly read and feature your content, putting your brand in front of customers at the exact moment they're searching.

The pages that are currently losing the most potential visibility are:`,
      },
      {
        key: "meta-titles-too-long-unoptimized",
        findingTypeKey: "metaTitles",
        title: "Meta Titles Are Too Long & Unoptimized",
        priority: "High",
        matchPattern: "Meta title too long|Missing meta title",
        body: `Meta titles are a critical part of SEO, serving as the first impression in search results. However, meta titles that are too long are a problem, when trying to maximize the visibility of your website.

Ideally, meta titles should be under 60 characters to display fully in search results. During our review of {{domain}}, we found numerous pages exceeding this limit.

Addressing this by shortening and optimizing meta titles presents an opportunity to enhance click-through rates, improve user experience, and boost SEO effectiveness.`,
      },
      {
        key: "unoptimized-shopify-url-structure",
        findingTypeKey: "shopifyUrls",
        title: "Unoptimized Shopify URL structure",
        priority: "High",
        matchPattern: "Shopify URL pattern detected",
        body: `By default Shopify is set up to use collection based product URLs, when clicking to a specific product within a collection.

Let’s say that you have a product called “Blue T-Shirt”, with the following URL structure:

domain.com/products/blue-t-shirt

However, if you click on that same product from within a collection, called “Apparel” for example, the product will now have the following URL structure:

domain.com/collections/apparel/products/blue-t-shirt

As you can see, Shopify adjusted the product URL based on the collection it’s in.

This is a bad practice, as it creates duplicate URLs of the same product, which negatively affects your Google rankings and organic traffic.

We noticed the exact same thing happening on {{domain}}, which represents another quick-win that can be implemented for an additional boost in organic traffic.`,
      },
      {
        key: "duplicated-page-titles",
        findingTypeKey: "metaTitles",
        title: "Duplicated Page Titles",
        priority: "High",
        matchPattern: "Duplicate meta title",
        body: `Duplicate page titles across multiple pages can confuse search engines and dilute your SEO efforts. When multiple pages have the same title, it becomes challenging for search engines to determine the most relevant page to rank, potentially leading to lower visibility and missed opportunities in search results.

We noticed more than {{count}} pages with duplicated titles on the {{domain}}. Addressing this by creating unique, descriptive titles for each page is essential to improving search engine clarity, boosting click-through rates, and enhancing overall site optimization.`,
      },
      {
        key: "duplicated-meta-descriptions",
        findingTypeKey: "metaTitles",
        title: "Duplicated Meta Descriptions",
        priority: "Medium",
        matchPattern: "Duplicate meta description",
        body: `Having identical meta descriptions on multiple pages can hinder search engine optimization by confusing search engines and users. Repeated meta-descriptions reduce the chances of accurately representing each page's unique content, leading to decreased relevance in search results.

Our audit uncovered more than {{count}} instances of duplicate meta descriptions on the {{domain}}. Crafting distinct and meaningful descriptions tailored to each page's content is essential to improve search visibility and attract more clicks.`,
      },
      {
        key: "missing-organization-schema",
        findingTypeKey: "missing-organization-schema",
        title: "Missing Organization Schema",
        priority: "Medium",
        matchPattern: "Missing Organization Schema",
        body: `Organization Schema helps search engines understand and accurately represent your company. Although structured data isn’t a direct ranking factor, it facilitates better visibility for relevant search queries.

Implementing Organization Schema enhances your company’s credibility with search engines and users. It enables Google to present your business information as a rich result or knowledge panel, showcasing details like images, links, and additional info. For instance, a Google Knowledge Panel for "Tesla" can make your search appearance more engaging and informative.

This schema improves the attractiveness of your search results and increases the space your business occupies on search engine results pages (SERPs). This additional visibility can provide a competitive edge over others in your industry.`,
      },
      {
        key: "overly-long-meta-descriptions",
        findingTypeKey: "metaTitles",
        title: "Overly Long Meta Descriptions",
        priority: "Medium",
        matchPattern: "Meta description too long",
        body: `Meta descriptions are vital for SEO, offering a brief peek into a webpage's content. They appear below the page title in search results, influencing user clicks.

It's crucial to limit meta descriptions to 50-155 characters. Exceeding this range may lead to search engines truncating them, affecting visibility and click appeal.

Our {{domain}} audit found {{count}} pages with lengthy meta descriptions. Shortening them enhances click-through rates and improves SEO.`,
      },
      {
        key: "unlinked-blog",
        findingTypeKey: "unlinked-blog",
        title: "Unlinked Blog",
        priority: "High",
        matchPattern: "Unlinked Blog",
        body: `A well-connected blog can drive significant traffic and improve user engagement. If your blog page isn’t linked from the main menu or footer, it’s missing out on potential visitors who might benefit from your content.

For instance, during our review of {{domain}}, we noticed that the blog page is not linked to the menu or footer sections. Adding these links can enhance your blog's visibility, leading to increased traffic and better user engagement. This simple adjustment can help users quickly access your content and improve overall site navigation.`,
      },
      {
        key: "images-with-missing-alt-text",
        findingTypeKey: "imageAltTags",
        title: "Images with Missing Alt text",
        priority: "High",
        matchPattern: "Image missing alt text",
        body: `Missing alt tags for images can negatively impact your website's accessibility and SEO. Alt tags provide crucial information to visually impaired users and search engines, enhancing the understanding and context of the images.

Currently, {{count}} {{domain}} images lack descriptions, affecting accessibility, user experience, and search visibility.`,
      },
    ];

    reportTemplates.forEach((template, index) => {
      let record;
      try {
        record = app.findFirstRecordByFilter(
          "audit_report_templates",
          `key = "${template.key}"`,
        );
      } catch {
        record = new Record(reportTemplatesCollection);
        record.set("key", template.key);
      }

      const findingType = app.findFirstRecordByFilter(
        "audit_finding_types",
        `key = "${template.findingTypeKey}"`,
      );
      record.set("audit_finding_type", findingType.id);
      record.set("title", template.title);
      record.set("priority", template.priority);
      record.set("match_pattern", template.matchPattern);
      record.set("template_body", template.body);
      record.set("sort_order", index + 1);
      record.set("enabled", true);
      app.save(record);
    });

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
            { name: "created_at", type: "date", required: false },
            { name: "updated_at", type: "date", required: false },
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
            {
              name: "report_docx",
              type: "file",
              required: false,
              maxSelect: 1,
              maxSize: 20971520,
              mimeTypes: [
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
              ],
            },
            {
              name: "selected_report_template_keys_json",
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
            {
              name: "report_template_key",
              type: "text",
              required: false,
              max: 140,
            },
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
            "CREATE INDEX idx_audit_screenshots_report_template_key ON audit_screenshots (report_template_key)",
            "CREATE UNIQUE INDEX idx_audit_screenshots_audit_type_run_template ON audit_screenshots (audit, audit_finding_type, run, report_template_key)",
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
      "audit_report_templates",
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
