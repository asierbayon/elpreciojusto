import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { parsePrice, parseSizeText } from "./lib/text.ts";

export type Product2003 = {
  id: string;
  category: string;
  brand: string;
  sizeText: string;
  price2003: number;
  size: ReturnType<typeof parseSizeText>;
  searchTerms: string[];
};

const DATA_DIR = join(process.cwd(), "data");
const CSV_PATH = join(DATA_DIR, "carrefour-2003.csv");
const OUTPUT_PATH = join(DATA_DIR, "products-2003.json");

const parseCsvLine = (line: string) => {
  const parts = line.split(";");
  if (parts.length < 4) {
    return null;
  }

  const category = parts[0]?.trim() ?? "";
  const brand = parts[1]?.trim() ?? "";
  const sizeText = parts[2]?.trim() ?? "";
  const priceRaw = parts[3]?.trim() ?? "";

  if (!category || !brand || !sizeText || !priceRaw) {
    return null;
  }

  return {
    category,
    brand,
    sizeText,
    price2003: parsePrice(priceRaw),
  };
};

const buildSearchTerms = (category: string, brand: string) => {
  const terms = new Set<string>();
  terms.add(brand);
  terms.add(`${brand} ${category.split(" ").slice(0, 3).join(" ")}`.trim());

  const shortCategory = category
    .replace(/^Vino tinto D\.O\./, "vino")
    .replace(/^Vino blanco D\.O\./, "vino")
    .split(" ")
    .slice(0, 4)
    .join(" ");

  terms.add(shortCategory);
  return [...terms].filter(Boolean);
};

const transform2003 = () => {
  mkdirSync(DATA_DIR, { recursive: true });

  const csv = readFileSync(CSV_PATH, "utf8");
  const lines = csv.split(/\r?\n/).filter(Boolean);
  const products: Product2003[] = [];

  for (const [index, line] of lines.entries()) {
    const parsed = parseCsvLine(line);
    if (!parsed) {
      continue;
    }

    products.push({
      id: `2003-${index + 1}`,
      category: parsed.category,
      brand: parsed.brand,
      sizeText: parsed.sizeText,
      price2003: parsed.price2003,
      size: parseSizeText(parsed.sizeText),
      searchTerms: buildSearchTerms(parsed.category, parsed.brand),
    });
  }

  writeFileSync(
    OUTPUT_PATH,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        source: "https://raw.githubusercontent.com/JaimeObregon/precios/main/carrefour.csv",
        count: products.length,
        products,
      },
      null,
      2,
    ),
  );

  console.log(`Saved ${products.length} products to ${OUTPUT_PATH}`);
};

transform2003();
