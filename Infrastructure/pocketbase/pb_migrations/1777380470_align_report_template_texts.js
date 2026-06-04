migrate(
  (app) => {
    const updates = [
      {
        key: "ai-chatbots-llms-not-whitelisted",
        priority: "Urgent",
        body: `We’re noticing more and more traffic, as well as sales coming in from AI Chatbots such as ChatGPT, Perplexity, Gemini, etc - and with that, we need to ensure that your Shopify store is properly optimized, in order to maximize your visibility in AI Chatbots.

Unfortunately, {{domain}} is currently blocking ALL AI Chatbots and crawlers, which is having a significant negative impact on your visibility.

By whitelisting AI Chatbots and modifying your robots.txt we’ll be able to unblock AI crawlers, and have your site welcome them.

In other words, we’d be inviting AI Chatbots to crawl your site, and feature your products and content in answers to people’s questions.`,
      },
      {
        key: "unoptimized-page-speed",
        priority: "High",
        body: `At the moment your site scores only {{worstScore}} out of 100 on Google’s Page Speed Insight’s test, this is currently negatively impacting both your conversion and organic rankings and we suggest fixing this as soon as possible.`,
      },
      {
        key: "multiple-h1-tags",
        priority: "High",
        body: `One of the top SEO practices for on-page SEO is to always have only ONE H1 tag per page after all H1 tags are one of the top points that give Google the context of your page.

At the moment, you have {{count}} pages with multiple H1 tags, which is negatively impacting their rankings and organic traffic.`,
      },
      {
        key: "missing-h1-tags",
        priority: "High",
        body: `H1 heading tags are among the 3 most important on-page factors, as Google directly looks and crawls them to figure out the context of your page.

If you don’t have an H1 heading tag on your page, Google will simply struggle a bit more to understand the topic you’re trying to rank for and thus you’ll rank lower.

In the case of your website, {{count}} pages seem to be missing H1 heading tags, adding them is a great quick-win opportunity.`,
      },
      {
        key: "missing-product-schema",
        priority: "Urgent",
        body: `At the moment, one of the biggest growth opportunities for {{domain}} is adding proper product schema to the product pages.

Your product pages have customer reviews, but Google is not currently able to read the review data as structured product schema. This means the pages are missing the opportunity to qualify for richer product results in organic search.

By adding the correct product schema and connecting it with your product review app, we can help Google understand the reviews, ratings, prices, and product details more accurately.

This can improve click-through rates from organic search and make your product listings stand out more strongly in the results.`,
      },
      {
        key: "meta-titles-too-long-unoptimized",
        priority: "High",
        body: `Meta titles are a critical part of SEO, serving as the first impression in search results. However, meta titles that are too long are a problem, when trying to maximize the visibility of your website.

Ideally, meta titles should be under 60 characters to display fully in search results. During our review of {{domain}}, we found numerous pages exceeding this limit.

Addressing this by shortening and optimizing meta titles presents an opportunity to enhance click-through rates, improve user experience, and boost SEO effectiveness.`,
      },
      {
        key: "unoptimized-shopify-url-structure",
        priority: "High",
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
        key: "missing-faq-schema",
        priority: "High",
        body: `{{domain}} is currently missing the FAQ Schema on {{count}} pages that contain question-and-answer style content. This structured data code tells Google and AI Chatbots exactly what questions your pages answer.

Without it, competitors who have implemented FAQ Schema are more likely to be featured when potential customers ask relevant questions in Google or AI tools like ChatGPT, Gemini, Claude, and others.

By adding FAQ Schema to the right pages, we'll ensure both Google and AI Chatbots can properly read and feature your content, putting your brand in front of customers at the exact moment they're searching.

The pages that are currently losing the most potential visibility are:`,
      },
      {
        key: "duplicated-page-titles",
        priority: "High",
        body: `Duplicate page titles across multiple pages can confuse search engines and dilute your SEO efforts. When multiple pages have the same title, it becomes challenging for search engines to determine the most relevant page to rank, potentially leading to lower visibility and missed opportunities in search results.

We noticed more than {{count}} pages with duplicated titles on the {{domain}}. Addressing this by creating unique, descriptive titles for each page is essential to improving search engine clarity, boosting click-through rates, and enhancing overall site optimization.`,
      },
      {
        key: "duplicated-meta-descriptions",
        priority: "Medium",
        body: `Having identical meta descriptions on multiple pages can hinder search engine optimization by confusing search engines and users. Repeated meta-descriptions reduce the chances of accurately representing each page's unique content, leading to decreased relevance in search results.

Our audit uncovered more than {{count}} instances of duplicate meta descriptions on the {{domain}}. Crafting distinct and meaningful descriptions tailored to each page's content is essential to improve search visibility and attract more clicks.`,
      },
      {
        key: "missing-organization-schema",
        priority: "Medium",
        body: `Organization Schema helps search engines understand and accurately represent your company. Although structured data isn’t a direct ranking factor, it facilitates better visibility for relevant search queries.

Implementing Organization Schema enhances your company’s credibility with search engines and users. It enables Google to present your business information as a rich result or knowledge panel, showcasing details like images, links, and additional info. For instance, a Google Knowledge Panel for "Tesla" can make your search appearance more engaging and informative.

This schema improves the attractiveness of your search results and increases the space your business occupies on search engine results pages (SERPs). This additional visibility can provide a competitive edge over others in your industry.`,
      },
      {
        key: "overly-long-meta-descriptions",
        priority: "Medium",
        body: `Meta descriptions are vital for SEO, offering a brief peek into a webpage's content. They appear below the page title in search results, influencing user clicks.

It's crucial to limit meta descriptions to 50-155 characters. Exceeding this range may lead to search engines truncating them, affecting visibility and click appeal.

Our {{domain}} audit found {{count}} pages with lengthy meta descriptions. Shortening them enhances click-through rates and improves SEO.`,
      },
      {
        key: "unlinked-blog",
        priority: "High",
        body: `A well-connected blog can drive significant traffic and improve user engagement. If your blog page isn’t linked from the main menu or footer, it’s missing out on potential visitors who might benefit from your content.

For instance, during our review of {{domain}}, we noticed that the blog page is not linked to the menu or footer sections. Adding these links can enhance your blog's visibility, leading to increased traffic and better user engagement. This simple adjustment can help users quickly access your content and improve overall site navigation.`,
      },
      {
        key: "images-with-missing-alt-text",
        priority: "High",
        body: `Missing alt tags for images can negatively impact your website's accessibility and SEO. Alt tags provide crucial information to visually impaired users and search engines, enhancing the understanding and context of the images.

Currently, {{count}} {{domain}} images lack descriptions, affecting accessibility, user experience, and search visibility.`,
      },
    ];

    updates.forEach((update) => {
      let template;
      try {
        template = app.findFirstRecordByFilter(
          "audit_report_templates",
          `key = "${update.key}"`,
        );
      } catch {
        return;
      }

      template.set("priority", update.priority);
      template.set("template_body", update.body);
      app.save(template);
    });
  },
  () => {},
);
