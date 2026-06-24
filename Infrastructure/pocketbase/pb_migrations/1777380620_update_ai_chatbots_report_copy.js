migrate(
  (app) => {
    let template;
    try {
      template = app.findFirstRecordByFilter(
        "audit_report_templates",
        'key = "ai-chatbots-llms-not-whitelisted"',
      );
    } catch {
      return;
    }

    template.set(
      "template_body",
      `We’re noticing more and more traffic, as well as sales coming in from AI Chatbots such as ChatGPT, Perplexity, Gemini, etc - and with that, we need to ensure that your Shopify store is properly optimized, in order to maximize your visibility in AI Chatbots.

Unfortunately, {{domain}} is currently not whitelisting most AI Chatbots and crawlers, which is limiting your overall AI chatbot visibility.

By whitelisting AI Chatbots and modifying your robots.txt we’ll be able to improve AI crawlability…

In other words, we’d be inviting AI Chatbots to crawl your site, and feature your products and content in answers to people’s questions.`,
    );
    app.save(template);
  },
  () => {},
);
