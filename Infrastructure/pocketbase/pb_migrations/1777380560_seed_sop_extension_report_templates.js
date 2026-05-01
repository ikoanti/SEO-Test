migrate(
  (app) => {
    const reportTemplateCollection = app.findCollectionByNameOrId(
      "audit_report_templates",
    );
    try {
      const priorityField = reportTemplateCollection.fields.getByName("priority");
      priorityField.values = [
        ...new Set([...(priorityField.values || []), "Low"]),
      ];
      app.save(reportTemplateCollection);
    } catch {}

    const reportTemplatesCollection = app.findCollectionByNameOrId(
      "audit_report_templates",
    );
    const templates = [
      {
        key: "sitemap-not-found-or-corrupt",
        findingTypeKey: "sitemap",
        title: "Sitemap Not Found or Corrupt",
        priority: "High",
        matchPattern: "No Sitemap Found|Sitemap.*corrupt|unavailable",
        body: `An XML sitemap helps search engines discover and crawl the most important pages on your website. It acts as a roadmap, showing Google which URLs to index and how your site is structured.

At the moment, the sitemap is either missing, inaccessible, or corrupted. This can make it harder for Google to find important pages, especially new products, categories, blog posts, and service pages.

Fixing the sitemap and submitting it through Google Search Console is an important quick-win opportunity. It can improve crawl efficiency, help search engines discover pages faster, and support better indexation across the website.`,
      },
      {
        key: "canonicals",
        findingTypeKey: "canonicalUrls",
        title: "Canonical URLs: Paginated Pages Are Not Canonicalized",
        priority: "Medium",
        matchPattern: "Canonical URL missing|not canonicalized",
        body: `Canonical tags help search engines understand which version of a page should be treated as the main one. This is especially important for paginated pages, where similar content can appear across multiple URLs.

At the moment, paginated pages are not properly canonicalized. This can create duplicate or near-duplicate page signals and may confuse Google about which URLs to prioritize in search results.

Fixing canonical tags on paginated pages can help consolidate SEO value, reduce indexation issues, and make the website structure clearer for search engines.`,
      },
      {
        key: "internal-links",
        findingTypeKey: "internalLinks",
        title: "Internal Links: Important Pages Do Not Have Internal Links",
        priority: "High",
        matchPattern: "No crawlable internal links found|Internal links.*missing|Important pages.*internal links",
        body: `Internal links help users and search engines discover important pages on the website. They also pass authority from stronger pages to pages that need better visibility.

At the moment, some important pages lack sufficient internal links. As a result, Google may treat these pages as less important, even if they target valuable keywords or contain important products, services, or content.

Adding relevant internal links from menus, category pages, blog posts, and other strong pages can improve crawlability, rankings, and user navigation.`,
      },
      {
        key: "content-quality",
        findingTypeKey: "contentQuality",
        title: "Content Quality: Thin Content Pages",
        priority: "High",
        matchPattern: "Thin content detected",
        body: `Thin content pages usually contain too little useful information for users and search engines. These pages often struggle to rank because they do not fully address user intent or provide sufficient context on the topic.

At the moment, some pages on the website have limited content. This can negatively affect their ability to rank for target keywords and may reduce the site's overall quality signals.

Expanding these pages with helpful, unique, and relevant content can improve keyword relevance, user engagement, and organic visibility.`,
      },
      {
        key: "web-icons-missing",
        findingTypeKey: "webIcons",
        title: "Web Icons: Apple Touch Icon and/or Favicon Missing",
        priority: "Low",
        matchPattern: "Favicon Missing|Apple Touch Icon Missing",
        body: `Favicons and Apple Touch Icons help improve brand recognition across browsers, bookmarks, mobile devices, and search results. While this is not a major ranking factor, it affects trust, usability, and the website's professional appearance.

At the moment, the website is missing a favicon and/or Apple Touch Icon. This can make the site look less polished when users save it, open it in browser tabs, or view it on mobile devices.

Adding appropriate web icons is a simple technical improvement that supports branding, builds trust, and enhances user experience.`,
      },
      {
        key: "ssl-missing",
        findingTypeKey: "ssl",
        title: "SSL Missing",
        priority: "Urgent",
        matchPattern: "HTTPS Not Enabled|SSL.*Missing|SSL.*improperly configured",
        body: `SSL certificates protect user data and allow the website to load securely through HTTPS. Google expects modern websites to use HTTPS, especially if they collect contact details, payment information, login credentials, or other sensitive information.

At the moment, SSL is either missing or improperly configured. This can trigger browser security warnings, erode user trust, and harm conversions and SEO performance.

Installing and properly configuring SSL should be treated as an urgent fix. A secure website helps protect users, improves trust, and supports stronger organic performance.`,
      },
      {
        key: "viewport-meta-tag-not-set",
        findingTypeKey: "viewportMetaTag",
        title: "Viewport Meta Tag Not Set",
        priority: "High",
        matchPattern: "Viewport Meta Tag Missing|Viewport Meta Tag Not Set",
        body: `The viewport meta tag tells browsers how to display a page on mobile devices. Without it, pages may not scale correctly on smartphones and tablets.

At the moment, the viewport meta tag is missing or not properly set. This can cause poor mobile usability, layout issues, hard-to-read text, and elements that do not fit the screen.

Since Google primarily uses mobile-first indexing, fixing the viewport meta tag is important for both SEO and user experience.`,
      },
      {
        key: "flash-is-used",
        findingTypeKey: "flash",
        title: "Flash Is Used",
        priority: "High",
        matchPattern: "Legacy Flash-like embeds found|Flash Is Used",
        body: `Flash is outdated technology and is no longer supported by modern browsers. Search engines and users may not be able to properly access or interact with Flash-based content.

At the moment, the website still uses Flash elements. This can create usability problems, security risks, and crawlability issues.

Replacing Flash with modern HTML5, CSS, and JavaScript solutions will improve compatibility, accessibility, and overall technical SEO health.`,
      },
      {
        key: "character-encoding-not-utf-8",
        findingTypeKey: "charset",
        title: "Character Encoding: Meta Charset Is Not UTF-8",
        priority: "Medium",
        matchPattern: "Character Encoding Missing|Character Encoding.*not.*UTF-8|Meta Charset Is Not UTF-8",
        body: `Character encoding tells browsers how to display text correctly. UTF-8 is the modern standard and supports most languages, symbols, and special characters.

At the moment, the website does not use UTF-8 as the declared character set. This can cause text display issues, broken characters, and inconsistent rendering across browsers and devices.

Setting the meta charset to UTF-8 helps ensure that all text displays correctly and improves technical consistency across the website.`,
      },
      {
        key: "lorem-ipsum-placeholders-found",
        findingTypeKey: "loremIpsum",
        title: "Lorem Ipsum Placeholders Found",
        priority: "Medium",
        matchPattern: "Lorem Ipsum Detected",
        body: `Lorem Ipsum text is placeholder content that should be removed before a page goes live. If search engines crawl pages containing placeholder text, it can make the site look unfinished and low quality.

At the moment, Lorem Ipsum or similar placeholder content was found on the website. This can hurt user trust and weaken the perceived quality of the affected pages.

Replacing placeholder text with real, useful, and optimized content can improve trust, relevance, and overall SEO performance.`,
      },
      {
        key: "open-graph",
        findingTypeKey: "openGraph",
        title: "Open Graph Tags Are Missing or Incomplete",
        priority: "Medium",
        matchPattern: "og:title Missing|og:description Missing|og:image Missing|og:url Missing|Open Graph.*Missing",
        body: `Open Graph tags control how pages appear when shared on platforms like Facebook, LinkedIn, Messenger, and other social channels. They define the title, description, image, and URL preview.

At the moment, Open Graph tags are missing or incomplete. This means shared pages may appear with poor previews, missing images, weak descriptions, or incorrect titles.

Adding complete Open Graph tags can improve social sharing, click-through rates, and brand presentation across external platforms.`,
      },
      {
        key: "contact-and-trust-signals-missing",
        findingTypeKey: "trustSignals",
        title: "Contact and Trust Signals Are Missing",
        priority: "High",
        matchPattern: "missing",
        body: `Trust pages are important for both users and search engines. Pages like Contact, About, Privacy Policy, Terms, Returns and Refunds, and Shipping Policy help users understand who is behind the website and what they can expect before making a purchase or submitting information.

At the moment, one or more important trust pages are missing, incomplete, or difficult to find. This can reduce user confidence and may negatively affect conversions, especially for e-commerce and service websites.

Creating and internally linking these trust pages can improve credibility, user experience, and E-E-A-T signals.`,
      },
      {
        key: "lazy-loading",
        findingTypeKey: "lazyLoadImages",
        title: "Lazy Loading Images Technology Is Not Used",
        priority: "Medium",
        matchPattern: "Image missing loading=\"lazy\"|Lazy Loading Images Technology Is Not Used",
        body: `Lazy loading helps improve page speed by loading images only when users need to see them. This is especially important for image-heavy websites, product pages, collections, galleries, and blog posts.

At the moment, lazy loading is not being used properly. As a result, too many images may load at once, slowing down the website and creating a worse user experience.

Implementing lazy loading can improve load times, reduce unnecessary resource usage, and improve Core Web Vitals performance.`,
      },
    ];

    templates.forEach((template, index) => {
      let findingType;
      try {
        findingType = app.findFirstRecordByFilter(
          "audit_finding_types",
          `key = "${template.findingTypeKey}"`,
        );
      } catch {
        return;
      }

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

      record.set("audit_finding_type", findingType.id);
      record.set("title", template.title);
      record.set("priority", template.priority);
      record.set("match_pattern", template.matchPattern);
      record.set("template_body", template.body);
      record.set("sort_order", 100 + index);
      record.set("enabled", true);
      app.save(record);
    });
  },
  (app) => {
    const keys = [
      "sitemap-not-found-or-corrupt",
      "canonicals",
      "internal-links",
      "content-quality",
      "web-icons-missing",
      "ssl-missing",
      "viewport-meta-tag-not-set",
      "flash-is-used",
      "character-encoding-not-utf-8",
      "lorem-ipsum-placeholders-found",
      "open-graph",
      "contact-and-trust-signals-missing",
      "lazy-loading",
    ];

    keys.forEach((key) => {
      try {
        const record = app.findFirstRecordByFilter(
          "audit_report_templates",
          `key = "${key}"`,
        );
        app.delete(record);
      } catch {
        // Template did not exist.
      }
    });
  },
);
