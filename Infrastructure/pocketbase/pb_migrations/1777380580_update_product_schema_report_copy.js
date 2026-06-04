migrate(
  (app) => {
    const body = `At the moment, one of the biggest growth opportunities for {{domain}} is adding proper product schema to the product pages.

Your product pages have customer reviews, but Google is not currently able to read the review data as structured product schema. This means the pages are missing the opportunity to qualify for richer product results in organic search.

By adding the correct product schema and connecting it with your product review app, we can help Google understand the reviews, ratings, prices, and product details more accurately.

This can improve click-through rates from organic search and make your product listings stand out more strongly in the results.`;

    const template = app.findFirstRecordByFilter(
      "audit_report_templates",
      'key = "missing-product-schema"',
    );
    template.set("template_body", body);
    app.save(template);
  },
  (app) => {
    const body = `At the moment, one of the biggest growth opportunities for {{domain}} is applying the proper product schema code.

Here’s how properly applied product schema looks in organic search:

Here’s how your product pages (that have dozens of reviews) look currently:

By adding a piece of code and working together with the developers of your product review app, we’ll be able to achieve the same thing for your website.

This usually doubles the click-through rates from organic search, which pushes you up even further in the rankings.`;

    const template = app.findFirstRecordByFilter(
      "audit_report_templates",
      'key = "missing-product-schema"',
    );
    template.set("template_body", body);
    app.save(template);
  },
);
