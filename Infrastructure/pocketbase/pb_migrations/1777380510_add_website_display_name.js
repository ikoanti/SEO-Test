migrate(
  (app) => {
    const collection = app.findCollectionByNameOrId("websites");
    let hasDisplayName = true;

    try {
      collection.fields.getByName("display_name");
    } catch {
      hasDisplayName = false;
    }

    if (!hasDisplayName) {
      collection.fields.add(
        new TextField({
          name: "display_name",
          required: false,
          max: 255,
          presentable: true,
        }),
      );
      app.save(collection);
    }

    const websites = app.findRecordsByFilter("websites", "", "", 0, 0);
    for (const website of websites) {
      const rawUrl = String(website.get("url") || "");
      const rawDomain = String(website.get("domain") || "");
      const domain = stripWww(rawDomain || hostnameFromUrl(rawUrl));
      const displayName = String(website.get("display_name") || "").trim();

      if (domain && domain !== rawDomain) {
        website.set("domain", domain);
      }
      if (!displayName && domain) {
        website.set("display_name", suggestedDisplayName(domain));
      }
      app.save(website);
    }
  },
  (app) => {
    const collection = app.findCollectionByNameOrId("websites");
    try {
      collection.fields.removeByName("display_name");
    } catch {}
    app.save(collection);
  },
);

function hostnameFromUrl(value) {
  try {
    return new URL(value).hostname;
  } catch {
    return "";
  }
}

function stripWww(value) {
  return String(value || "")
    .trim()
    .replace(/^www\./i, "")
    .toLowerCase();
}

function suggestedDisplayName(domain) {
  const parts = String(domain || "").split(".");
  const name = parts.shift() || "";
  const suffix = parts.join(".");
  const display = name
    .split(/[-_]+/)
    .filter(Boolean)
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join("");

  return suffix ? `${display || name}.${suffix}` : display || domain;
}
