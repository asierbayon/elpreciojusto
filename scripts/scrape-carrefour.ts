import { chromium, type Browser, type Page } from "playwright";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parseSizeFromProductName } from "./lib/text.ts";

const DATA_DIR = join(process.cwd(), "data");
const RAW_DIR = join(DATA_DIR, "raw");
const OUTPUT_PATH = join(DATA_DIR, "products-current.json");
const META_PATH = join(DATA_DIR, "scrape-meta.json");

const SEARCH_BASE =
  "https://www.carrefour.es/search-api/query/v1/search?internal=true&instance=x-carrefour&env=https%3A%2F%2Fwww.carrefour.es&scope=desktop&lang=es&session=empathy&citrusCatalog=food&catalog=food&baseUrlCitrus=https%3A%2F%2Fwww.carrefour.es&enabled=true&store=005290&hasConsent=true&siteKey=wFOzqveg&empathypoc=false";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export type CurrentProduct = {
  productId: string;
  name: string;
  brand: string;
  price: number;
  sizeText: string;
  size: ReturnType<typeof parseSizeFromProductName>;
  imageUrl: string | null;
  url: string;
  ean13: string | null;
  source: "search" | "category";
  query?: string;
  categoryUrl?: string;
};

type SearchDoc = {
  product_id?: string;
  display_name?: string;
  brand?: string;
  active_price?: number;
  list_price?: number;
  image_path?: string;
  url?: string;
  ean13?: string;
  average_weight?: number;
  measure_unit?: string;
};

const mapDocToProduct = (
  doc: SearchDoc,
  source: CurrentProduct["source"],
  meta: { query?: string; categoryUrl?: string },
): CurrentProduct | null => {
  if (!doc.product_id || !doc.display_name) {
    return null;
  }

  const price = doc.active_price ?? doc.list_price ?? 0;
  const sizeFromName = parseSizeFromProductName(doc.display_name);
  const size =
    sizeFromName ??
    (doc.average_weight && doc.measure_unit
      ? parseSizeFromProductName(
          `${doc.average_weight / 1000} ${doc.measure_unit}`,
        )
      : null);

  return {
    productId: doc.product_id,
    name: doc.display_name,
    brand: doc.brand ?? "",
    price,
    sizeText: size?.label ?? doc.display_name,
    size,
    imageUrl: doc.image_path ?? null,
    url: doc.url ? `https://www.carrefour.es${doc.url}` : "",
    ean13: doc.ean13 ?? null,
    source,
    query: meta.query,
    categoryUrl: meta.categoryUrl,
  };
};

const createBrowser = async () => {
  const browser = await chromium.launch({
    headless: false,
    args: ["--disable-blink-features=AutomationControlled"],
  });

  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    locale: "es-ES",
    viewport: { width: 1280, height: 800 },
  });

  const page = await context.newPage();
  return { browser, page };
};

const bootstrapSession = async (page: Page) => {
  await page.goto("https://www.carrefour.es/supermercado/", {
    waitUntil: "networkidle",
    timeout: 120000,
  });
  await sleep(2500);
};

const fetchSearchPage = async (
  page: Page,
  query: string,
  start: number,
  rows: number,
) => {
  return page.evaluate(
    async ({ searchBase, queryValue, startValue, rowsValue }) => {
      const params = new URLSearchParams({
        query: queryValue,
        start: String(startValue),
        rows: String(rowsValue),
      });
      const response = await fetch(`${searchBase}&${params.toString()}`);
      const text = await response.text();
      return {
        status: response.status,
        body: text,
      };
    },
    {
      searchBase: SEARCH_BASE,
      queryValue: query,
      startValue: start,
      rowsValue: rows,
    },
  );
};

const scrapeSearchQuery = async (
  page: Page,
  query: string,
  maxPages: number,
  rawSamples: Record<string, unknown>,
) => {
  const products = new Map<string, CurrentProduct>();
  const rows = 24;

  for (let pageIndex = 0; pageIndex < maxPages; pageIndex += 1) {
    const start = pageIndex * rows;
    const result = await fetchSearchPage(page, query, start, rows);
    rawSamples[`search:${query}:${start}`] = {
      status: result.status,
      body: result.body.slice(0, 5000),
    };

    if (result.status !== 200) {
      break;
    }

    let parsed: { content?: { docs?: SearchDoc[]; numFound?: number } };
    try {
      parsed = JSON.parse(result.body);
    } catch {
      break;
    }

    const docs = parsed.content?.docs ?? [];
    if (docs.length === 0) {
      break;
    }

    for (const doc of docs) {
      const product = mapDocToProduct(doc, "search", { query });
      if (product) {
        products.set(product.productId, product);
      }
    }

    const numFound = parsed.content?.numFound ?? docs.length;
    if (start + rows >= numFound) {
      break;
    }

    await sleep(450);
  }

  return products;
};

const extractImpressions = async (page: Page, categoryUrl: string) => {
  return page.evaluate((url) => {
    const impressions = (window as unknown as { impressions?: Array<Record<string, unknown>> })
      .impressions;

    if (!Array.isArray(impressions)) {
      return [];
    }

    return impressions.map((item) => ({
      ...item,
      categoryUrl: url,
    }));
  }, categoryUrl);
};

const mapImpressionToProduct = (
  item: Record<string, unknown>,
  categoryUrl: string,
): CurrentProduct | null => {
  const productId = String(item.item_id ?? item.product_id ?? "");
  const rawName = String(item.item_name ?? item.name ?? "");
  const name = rawName.includes("-")
    ? rawName.replace(/-/g, " ")
    : rawName;
  const brand = String(item.item_brand ?? item.brand ?? "");
  const price = Number(item.price ?? item.active_price ?? 0);

  if (!productId || !name || !price) {
    return null;
  }

  const size = parseSizeFromProductName(name);

  return {
    productId,
    name,
    brand,
    price,
    sizeText: size?.label ?? name,
    size,
    imageUrl: typeof item.image === "string" ? item.image : null,
    url: typeof item.url === "string" ? item.url : categoryUrl,
    ean13: typeof item.item_ean === "string" ? item.item_ean : null,
    source: "category",
    categoryUrl,
  };
};

const collectCategoryUrls = async (page: Page) => {
  const html = await page.content();
  const matches = [...html.matchAll(/\/supermercado[^"'\\s]*\/cat(\d{5})\/c/g)];
  const urls = new Set<string>();

  for (const match of matches) {
    urls.add(`https://www.carrefour.es${match[0]}`);
  }

  return [...urls];
};

const crawlCategories = async (
  page: Page,
  seedUrls: string[],
  maxCategories: number,
) => {
  const products = new Map<string, CurrentProduct>();
  const visited = new Set<string>();
  const queue = [...seedUrls];

  while (queue.length > 0 && visited.size < maxCategories) {
    const categoryUrl = queue.shift();
    if (!categoryUrl || visited.has(categoryUrl)) {
      continue;
    }

    visited.add(categoryUrl);
    console.log(`Category ${visited.size}/${maxCategories}: ${categoryUrl}`);

    await page.goto(categoryUrl, {
      waitUntil: "networkidle",
      timeout: 120000,
    });
    await sleep(1800);

    const impressions = await extractImpressions(page, categoryUrl);
    for (const impression of impressions) {
      const product = mapImpressionToProduct(impression, categoryUrl);
      if (product) {
        products.set(product.productId, product);
      }
    }

    const nested = await collectCategoryUrls(page);
    for (const url of nested) {
      if (!visited.has(url) && !queue.includes(url)) {
        queue.push(url);
      }
    }

    await sleep(500);
  }

  return products;
};

const getTopSearchQueries = () => {
  const sourcePath = join(DATA_DIR, "products-2003.json");
  const payload = JSON.parse(readFileSync(sourcePath, "utf8")) as {
    products: Array<{ brand: string; category: string; searchTerms: string[] }>;
  };

  const brandCounts = new Map<string, number>();
  const categoryCounts = new Map<string, number>();

  for (const product of payload.products) {
    brandCounts.set(product.brand, (brandCounts.get(product.brand) ?? 0) + 1);
    categoryCounts.set(
      product.category,
      (categoryCounts.get(product.category) ?? 0) + 1,
    );
  }

  const topBrands = [...brandCounts.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 120)
    .map(([brand]) => brand);

  const topCategories = [...categoryCounts.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 80)
    .map(([category]) =>
      category
        .replace(/^Vino tinto D\.O\./, "vino tinto")
        .replace(/^Vino blanco D\.O\./, "vino blanco")
        .split(" ")
        .slice(0, 3)
        .join(" "),
    );

  return [...new Set([...topBrands, ...topCategories])];
};

const scrapeCarrefour = async () => {
  mkdirSync(RAW_DIR, { recursive: true });

  const { browser, page } = await createBrowser();
  const allProducts = new Map<string, CurrentProduct>();
  const rawSamples: Record<string, unknown> = {};

  try {
    await bootstrapSession(page);

    const seedCategories = await collectCategoryUrls(page);
    console.log(`Found ${seedCategories.length} seed categories`);

    const categoryProducts = await crawlCategories(page, seedCategories, 80);
    for (const [id, product] of categoryProducts) {
      allProducts.set(id, product);
    }

    const queries = getTopSearchQueries();
    console.log(`Searching ${queries.length} queries...`);

    for (const [index, query] of queries.entries()) {
      console.log(`Search ${index + 1}/${queries.length}: ${query}`);
      const found = await scrapeSearchQuery(page, query, 3, rawSamples);
      for (const [id, product] of found) {
        allProducts.set(id, product);
      }
      await sleep(600);
    }
  } finally {
    await browser.close();
  }

  const products = [...allProducts.values()].sort((left, right) =>
    left.name.localeCompare(right.name, "es"),
  );

  writeFileSync(
    OUTPUT_PATH,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        source: "https://www.carrefour.es/search-api/query/v1/search",
        store: "005290",
        count: products.length,
        products,
      },
      null,
      2,
    ),
  );

  writeFileSync(join(RAW_DIR, "search-samples.json"), JSON.stringify(rawSamples, null, 2));
  writeFileSync(
    META_PATH,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        productCount: products.length,
        searchQueries: getTopSearchQueries().length,
      },
      null,
      2,
    ),
  );

  console.log(`Saved ${products.length} current products to ${OUTPUT_PATH}`);
};

scrapeCarrefour().catch((error) => {
  console.error(error);
  process.exit(1);
});
