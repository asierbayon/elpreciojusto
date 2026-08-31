import { chromium, type Response } from "playwright";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

const DATA_DIR = join(process.cwd(), "data");

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

  return { browser, context };
};

const isInterestingResponse = (response: Response) => {
  const url = response.url();
  if (!url.includes("carrefour.es")) {
    return false;
  }

  if (
    url.includes("cloud-api") ||
    url.includes("search-api") ||
    url.includes("/products") ||
    url.includes("/catalog") ||
    url.includes("/navigation")
  ) {
    return true;
  }

  return false;
};

const probe = async () => {
  const { browser, context } = await createBrowser();
  const page = await context.newPage();
  const samples: Record<string, unknown> = {};

  page.on("response", async (response) => {
    if (!isInterestingResponse(response) || response.status() !== 200) {
      return;
    }

    const url = response.url();
    const contentType = response.headers()["content-type"] ?? "";

    if (!contentType.includes("json")) {
      return;
    }

    if (samples[url]) {
      return;
    }

    try {
      const json = await response.json();
      samples[url] = json;
      console.log("Saved sample:", url);
    } catch {
      // ignore parse errors
    }
  });

  await page.goto("https://www.carrefour.es/supermercado/", {
    waitUntil: "networkidle",
    timeout: 120000,
  });

  await page.waitForTimeout(3000);

  const categoryUrls = [
    "https://www.carrefour.es/supermercado/lacteos-huevos/leche/cat20003/c",
    "https://www.carrefour.es/supermercado/bebidas/cervezas/cat20013/c",
    "https://www.carrefour.es/supermercado/panaderia-y-pasteleria/pan/cat20021/c",
  ];

  for (const categoryUrl of categoryUrls) {
    console.log("Visiting", categoryUrl);
    await page.goto(categoryUrl, {
      waitUntil: "networkidle",
      timeout: 120000,
    });
    await page.waitForTimeout(4000);
  }

  await page.goto("https://www.carrefour.es/supermercado/?query=leche", {
    waitUntil: "networkidle",
    timeout: 120000,
  });
  await page.waitForTimeout(4000);

  writeFileSync(
    join(DATA_DIR, "api-samples-raw.json"),
    JSON.stringify(samples, null, 2),
  );

  console.log("Sample endpoints:", Object.keys(samples).length);
  for (const url of Object.keys(samples)) {
    console.log(url);
  }

  await browser.close();
};

probe().catch((error) => {
  console.error(error);
  process.exit(1);
});
