migrate(
  (app) => {
    const findingTypesCollection = app.findCollectionByNameOrId("audit_finding_types");
    const reportTemplatesCollection = app.findCollectionByNameOrId("audit_report_templates");
    const templates = [
      {
        key: "ai-chatbots-llms-not-whitelisted",
        title: "AI Chatbots/LLMs Not Whitelisted",
        priority: "Urgent",
        matchPattern: "GPTBot|Google-Extended|Anthropic|AI|Blocked|Not Specified",
        body: `We’re noticing more and more traffic, as well as sales coming in from AI Chatbots such as ChatGPT, Perplexity, Gemini, etc - and with that, we need to ensure that your Shopify store is properly optimized, in order to maximize your visibility in AI Chatbots.

Unfortunately, {{domain}} is currently blocking ALL AI Chatbots and crawlers, which is having a significant negative impact on your visibility.

By whitelisting AI Chatbots and modifying your robots.txt we’ll be able to unblock AI crawlers, and have your site welcome them.

In other words, we’d be inviting AI Chatbots to crawl your site, and feature your products and content in answers to people’s questions.`,
      },
      {
        key: "unoptimized-google-index",
        title: "Unoptimized Google index",
        priority: "Urgent",
        matchPattern: "",
        body: `While taking a quick look at the pages you have live in Google, we noticed that you’re indexing many low value/thin content pages, like the ones listed in the screenshot below.

Indexing these pages (with low-quality content) is a bad practice and we highly recommend setting these pages to no-index and removing them from Google.`,
      },
      {
        key: "unoptimized-page-speed",
        title: "Unoptimized page speed",
        priority: "High",
        matchPattern: "",
        body: `At the moment your site scores only {{worstScore}} out of 100 on Google’s Page Speed Insight’s test, this is currently negatively impacting both your conversion and organic rankings and we suggest fixing this as soon as possible.`,
      },
      {
        key: "multiple-h1-tags",
        title: "Multiple H1 tags",
        priority: "High",
        matchPattern: "multiple h1|empty or multiple",
        body: `One of the top SEO practices for on-page SEO is to always have only ONE H1 tag per page after all H1 tags are one of the top points that give Google the context of your page.

At the moment, you have {{count}} pages with multiple H1 tags, which is negatively impacting their rankings and organic traffic.`,
      },
      {
        key: "missing-h1-tags",
        title: "Missing H1 tags",
        priority: "High",
        matchPattern: "missing h1",
        body: `H1 heading tags are among the 3 most important on-page factors, as Google directly looks and crawls them to figure out the context of your page.

If you don’t have an H1 heading tag on your page, Google will simply struggle a bit more to understand the topic you’re trying to rank for and thus you’ll rank lower.

In the case of your website, {{count}} pages seem to be missing H1 heading tags, adding them is a great quick-win opportunity.`,
      },
      {
        key: "missing-product-schema",
        title: "Missing product schema",
        priority: "Urgent",
        matchPattern: "No JSON-LD Found",
        body: `At the moment, one of the biggest growth opportunities for {{domain}} is applying the proper product schema code.

Here’s how properly applied product schema looks in organic search:
Here’s how your product pages (that have dozens of reviews) look currently:

By adding a piece of code and working together with the developers of your product review app, we’ll be able to achieve the same thing for your website.

This usually doubles the click-through rates from organic search, which pushes you up even further in the rankings.`,
      },
      {
        key: "irrelevant-do-follow-external-domains",
        title: "Irrelevant do-follow external domains",
        priority: "Urgent",
        matchPattern: "",
        body: `Another problem that we noticed is that you’re currently linking out to hundreds of irrelevant websites like (Facebook, Pinterest, Instagram) with do-follow external links.

This is a problem because you’re sending your domain power and authority to these other pages mentioned above and with that making your page weaker in terms of its domain and SEO strength.

These links should be changed to “no-follow”.`,
      },
      {
        key: "unoptimized-heading-tags",
        title: "Unoptimized Heading Tags",
        priority: "Medium",
        matchPattern: "heading|h1|h2|h3",
        body: `Setting main navigation items or sections of the site as heading items for SEO can confuse search engines and users. Heading tags (such as H1, H2, etc.) play a crucial role in organizing the hierarchical structure of a webpage's content and also represent a big factor in helping Google understand the keywords you’re trying to rank for.

When main navigation items are mistakenly marked as headings, it may wrongly suggest their significance and relevance to the page's content, potentially negatively affecting search engine rankings and user experience.`,
      },
      {
        key: "meta-titles-too-long-unoptimized",
        title: "Meta Titles Are Too Long & Unoptimized",
        priority: "High",
        matchPattern: "Meta title too long|Missing meta title",
        body: `Meta titles are a critical part of SEO, serving as the first impression in search results. However, meta titles that are too long are a problem, when trying to maximize the visibility of your website.

Ideally, meta titles should be under 60 characters to display fully in search results. During our review of {{domain}}, we found numerous pages exceeding this limit.

Addressing this by shortening and optimizing meta titles presents an opportunity to enhance click-through rates, improve user experience, and boost SEO effectiveness.`,
      },
      {
        key: "unoptimized-shopify-url-structure",
        title: "Unoptimized Shopify URL structure",
        priority: "High",
        matchPattern: "Shopify URL pattern detected",
        body: `By default Shopify is set up to use collection based product URLs, when clicking to a specific product within a collection.

Let’s say that you have a product called “Blue T-Shirt”, with the following URL structure:

* domain.com/products/blue-t-shirt

However, if you click on that same product from within a collection, called “Apparel” for example, the product will now have the following URL structure:

* domain.com/collections/apparel/products/blue-t-shirt

As you can see, Shopify adjusted the product URL based on the collection it’s in.

This is a bad practice, as it creates duplicate URLs of the same product, which negatively affects your Google rankings and organic traffic.

We noticed the exact same thing happening on {{domain}}, which represents another quick-win that can be implemented for an additional boost in organic traffic.`,
      },
      {
        key: "missing-faq-schema",
        title: "Missing FAQ Schema",
        priority: "High",
        matchPattern: "FAQ|No JSON-LD Found",
        body: `{{domain}} is currently missing the FAQ Schema on pages that contain question-and-answer style content. This structured data code tells Google and AI Chatbots exactly what questions your pages answer.

Without it, competitors who have implemented FAQ Schema are more likely to be featured when potential customers ask relevant questions in Google or AI tools like ChatGPT, Gemini, Claude, and others.

By adding FAQ Schema to the right pages, we'll ensure both Google and AI Chatbots can properly read and feature your content, putting your brand in front of customers at the exact moment they're searching.`,
      },
      {
        key: "broken-backlinks",
        title: "Broken backlinks",
        priority: "High",
        matchPattern: "",
        body: `We also found an uncaptured opportunity in terms of links. We found broken backlinks pointing to 404 pages.

In order to re-capture the link power and lift your domain’s authority, we suggest creating 301 redirects and re-capturing these backlinks. By doing that you’ll be getting a direct boost in both your domain authority, as well as your existing rankings.`,
      },
      {
        key: "spammy-domains-pointed-to-domain",
        title: "Spammy domains pointed to {{domain}}",
        priority: "Medium",
        matchPattern: "",
        body: `Backlinks pointing to a site are one of the most crucial things when it comes to SEO. The higher the quality and relevance of your backlinks, the better you’ll rank.

When reviewing your backlinks we noticed lots of spammy domains pointing to your website. We’d suggest disavowing these domains, as soon as possible as they’re having a negative impact on your rankings and the quality of your website.`,
      },
      {
        key: "duplicated-page-titles",
        title: "Duplicated Page Titles",
        priority: "High",
        matchPattern: "Duplicate meta title",
        body: `Duplicate page titles across multiple pages can confuse search engines and dilute your SEO efforts. When multiple pages have the same title, it becomes challenging for search engines to determine the most relevant page to rank, potentially leading to lower visibility and missed opportunities in search results.

We noticed more than {{count}} pages with duplicated titles on the {{domain}}. Addressing this by creating unique, descriptive titles for each page is essential to improving search engine clarity, boosting click-through rates, and enhancing overall site optimization.`,
      },
      {
        key: "duplicated-meta-descriptions",
        title: "Duplicated Meta Descriptions",
        priority: "Medium",
        matchPattern: "Duplicate meta description",
        body: `Having identical meta descriptions on multiple pages can hinder search engine optimization by confusing search engines and users. Repeated meta-descriptions reduce the chances of accurately representing each page's unique content, leading to decreased relevance in search results.

Our audit uncovered more than {{count}} instances of duplicate meta descriptions on the {{domain}}. Crafting distinct and meaningful descriptions tailored to each page's content is essential to improve search visibility and attract more clicks.`,
      },
      {
        key: "4xx-broken-pages",
        title: "4xx Broken Pages",
        priority: "High",
        matchPattern: "4xx|404|broken",
        body: `4xx errors, like 404 pages, occur when a page is inaccessible or a link is broken, leading to a poor user experience and hurting SEO. These errors disrupt the flow of visitors and prevent search engines from properly indexing your site, which can lead to lower rankings.

Fixing the uncovered instances of 4xx errors on your website is crucial. Addressing these issues by redirecting or correcting broken links will enhance user experience and improve search engine crawling, helping to maintain your site's performance and visibility.`,
      },
      {
        key: "missing-organization-schema",
        title: "Missing Organization Schema",
        priority: "Medium",
        matchPattern: "No JSON-LD Found",
        body: `Organization Schema helps search engines understand and accurately represent your company. Although structured data isn’t a direct ranking factor, it facilitates better visibility for relevant search queries.

Implementing Organization Schema enhances your company’s credibility with search engines and users. It enables Google to present your business information as a rich result or knowledge panel, showcasing details like images, links, and additional info. For instance, a Google Knowledge Panel for "Tesla" can make your search appearance more engaging and informative.

This schema improves the attractiveness of your search results and increases the space your business occupies on search engine results pages (SERPs). This additional visibility can provide a competitive edge over others in your industry.`,
      },
      {
        key: "unlinked-blog",
        title: "Unlinked Blog",
        priority: "High",
        matchPattern: "",
        body: `A well-connected blog can drive significant traffic and improve user engagement. If your blog page isn’t linked from the main menu or footer, it’s missing out on potential visitors who might benefit from your content.

For instance, during our review of {{domain}}, we noticed that the blog page is not linked to the menu or footer sections. Adding these links can enhance your blog's visibility, leading to increased traffic and better user engagement. This simple adjustment can help users quickly access your content and improve overall site navigation.`,
      },
      {
        key: "overly-long-meta-descriptions",
        title: "Overly Long Meta Descriptions",
        priority: "Medium",
        matchPattern: "Meta description too long",
        body: `Meta descriptions are vital for SEO, offering a brief peek into a webpage's content. They appear below the page title in search results, influencing user clicks.

It's crucial to limit meta descriptions to 50-155 characters. Exceeding this range may lead to search engines truncating them, affecting visibility and click appeal.

Our {{domain}} audit found {{count}} pages with lengthy meta descriptions. Shortening them enhances click-through rates and improves SEO.`,
      },
      {
        key: "images-with-missing-alt-text",
        title: "Images with Missing Alt text",
        priority: "High",
        matchPattern: "Image missing alt text",
        body: `Missing alt tags for images can negatively impact your website's accessibility and SEO. Alt tags provide crucial information to visually impaired users and search engines, enhancing the understanding and context of the images.

Currently, {{count}} {{domain}} images lack descriptions, affecting accessibility, user experience, and search visibility.`,
      },
    ];

    templates.forEach((template, index) => {
      let findingType;
      try {
        findingType = app.findFirstRecordByFilter(
          "audit_finding_types",
          `key = "${template.key}"`,
        );
      } catch {
        findingType = new Record(findingTypesCollection);
        findingType.set("key", template.key);
      }

      findingType.set("label", template.title);
      findingType.set("sort_order", index + 1);
      app.save(findingType);

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
      record.set("sort_order", index + 1);
      record.set("enabled", true);
      app.save(record);
    });
  },
  (app) => {
    const templateKeys = [
      "ai-chatbots-llms-not-whitelisted",
      "unoptimized-google-index",
      "unoptimized-page-speed",
      "multiple-h1-tags",
      "missing-h1-tags",
      "missing-product-schema",
      "irrelevant-do-follow-external-domains",
      "unoptimized-heading-tags",
      "meta-titles-too-long-unoptimized",
      "unoptimized-shopify-url-structure",
      "missing-faq-schema",
      "broken-backlinks",
      "spammy-domains-pointed-to-domain",
      "duplicated-page-titles",
      "duplicated-meta-descriptions",
      "4xx-broken-pages",
      "missing-organization-schema",
      "unlinked-blog",
      "overly-long-meta-descriptions",
      "images-with-missing-alt-text",
    ];

    templateKeys.forEach((key) => {
      try {
        const record = app.findFirstRecordByFilter(
          "audit_report_templates",
          `key = "${key}"`,
        );
        app.delete(record);
      } catch {}

      try {
        const record = app.findFirstRecordByFilter(
          "audit_finding_types",
          `key = "${key}"`,
        );
        app.delete(record);
      } catch {}
    });
  },
);
