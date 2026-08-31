import { chromium } from "playwright";

const probe = async () => {
  const browser = await chromium.launch({
    headless: false,
    args: ["--disable-blink-features=AutomationControlled"],
  });

  const page = await browser.newPage({
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    locale: "es-ES",
  });

  await page.goto("https://www.carrefour.es/supermercado/", {
    waitUntil: "networkidle",
    timeout: 120000,
  });
  await page.waitForTimeout(3000);

  const html = await page.content();
  const categoryMatches = [...html.matchAll(/cat(\d{5})\/c/g)].map((match) => `cat${match[1]}`);
  const uniqueCategories = [...new Set(categoryMatches)];

  console.log("Categories found in homepage HTML:", uniqueCategories.length);
  console.log(uniqueCategories.slice(0, 30).join(", "));

  const searchTest = await page.evaluate(async () => {
    const buildUrl = (params: Record<string, string>) => {
      const base =
        "https://www.carrefour.es/search-api/query/v1/search?internal=true&instance=x-carrefour&env=https%3A%2F%2Fwww.carrefour.es&scope=desktop&lang=es&session=empathy&citrusCatalog=food&catalog=food&baseUrlCitrus=https%3A%2F%2Fwww.carrefour.es&enabled=true&store=005290&hasConsent=true&siteKey=wFOzqveg&empathypoc=false";
      const query = new URLSearchParams(params).toString();
      return `${base}&${query}`;
    };

    const response = await fetch(
      buildUrl({ query: "coca cola", start: "0", rows: "24" }),
    );
    const json = await response.json();
    const docs = json?.content?.docs ?? [];
    return {
      status: response.status,
      numFound: json?.content?.numFound ?? json?.numFound,
      docs: docs.length,
      sample: docs[0]?.display_name,
    };
  });

  console.log("\nSearch test:", searchTest);

  await browser.close();
};

probe().catch(console.error);
