import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  buildSizeCaveat,
  formatPercent,
  formatSize,
  jaccardSimilarity,
  normalizeBrand,
  sizeDifferenceRatio,
  tokenize,
} from "./lib/text.ts";
import type { Product2003 } from "./transform-2003.ts";

type CurrentProduct = {
  productId: string;
  name: string;
  brand: string;
  price: number;
  sizeText: string;
  size: Product2003["size"];
  imageUrl: string | null;
  url: string;
};

export type MatchedProduct = {
  id: string;
  name: string;
  brand: string;
  category2003: string;
  price2003: number;
  priceToday: number;
  size2003Text: string;
  sizeTodayText: string;
  size2003Formatted: string | null;
  sizeTodayFormatted: string | null;
  sizeDeltaPercent: number;
  priceDeltaPercent: number;
  inflationPercent: number;
  sizeCaveat: string | null;
  matchConfidence: number;
  imageUrl: string | null;
  productUrl: string;
  currentProductId: string;
};

const DATA_DIR = join(process.cwd(), "data");
const OUTPUT_PATH = join(DATA_DIR, "matched-products.json");

const loadJson = <T>(path: string) => JSON.parse(readFileSync(path, "utf8")) as T;

const brandMatches = (brand2003: string, brandCurrent: string) => {
  const left = normalizeBrand(brand2003);
  const right = normalizeBrand(brandCurrent);

  if (!left || !right) {
    return false;
  }

  if (left === right) {
    return true;
  }

  return left.includes(right) || right.includes(left);
};

const computeNameScore = (product2003: Product2003, current: CurrentProduct) => {
  const sourceTokens = tokenize(`${product2003.category} ${product2003.brand}`);
  const targetTokens = tokenize(current.name);
  return jaccardSimilarity(sourceTokens, targetTokens);
};

const pickClosestSize = (
  product2003: Product2003,
  candidates: Array<{ product: CurrentProduct; score: number }>,
) => {
  if (!product2003.size) {
    return candidates.sort((left, right) => right.score - left.score)[0] ?? null;
  }

  const scored = candidates
    .map((candidate) => {
      const sizeDiff = candidate.product.size
        ? sizeDifferenceRatio(product2003.size!, candidate.product.size)
        : Number.POSITIVE_INFINITY;

      return {
        ...candidate,
        sizeDiff,
      };
    })
    .filter((candidate) => Number.isFinite(candidate.sizeDiff));

  if (scored.length === 0) {
    return candidates.sort((left, right) => right.score - left.score)[0] ?? null;
  }

  scored.sort((left, right) => {
    if (left.sizeDiff !== right.sizeDiff) {
      return left.sizeDiff - right.sizeDiff;
    }

    const leftAmount = left.product.size?.amount ?? 0;
    const rightAmount = right.product.size?.amount ?? 0;

    if (leftAmount !== rightAmount) {
      return leftAmount - rightAmount;
    }

    return right.score - left.score;
  });

  return scored[0] ?? null;
};

const matchProducts = () => {
  const products2003 = loadJson<{ products: Product2003[] }>(
    join(DATA_DIR, "products-2003.json"),
  ).products;

  const productsCurrent = loadJson<{ products: CurrentProduct[] }>(
    join(DATA_DIR, "products-current.json"),
  ).products;

  const matches: MatchedProduct[] = [];

  for (const product2003 of products2003) {
    const brandCandidates = productsCurrent.filter((current) =>
      brandMatches(product2003.brand, current.brand),
    );

    const candidates = (brandCandidates.length > 0 ? brandCandidates : productsCurrent)
      .map((current) => ({
        product: current,
        score: computeNameScore(product2003, current),
      }))
      .filter((candidate) => candidate.score >= 0.08)
      .slice(0, 40);

    if (candidates.length === 0) {
      continue;
    }

    const best = pickClosestSize(product2003, candidates);
    if (!best) {
      continue;
    }

    const current = best.product;
    const sizeDeltaPercent =
      product2003.size && current.size
        ? ((current.size.amount - product2003.size.amount) / product2003.size.amount) * 100
        : 0;

    const normalizedOldPrice =
      product2003.size && current.size
        ? product2003.price2003 * (current.size.amount / product2003.size.amount)
        : product2003.price2003;

    const priceDeltaPercent =
      normalizedOldPrice > 0
        ? ((current.price - normalizedOldPrice) / normalizedOldPrice) * 100
        : 0;

    const inflationPercent =
      product2003.price2003 > 0
        ? ((current.price - product2003.price2003) / product2003.price2003) * 100
        : 0;

    const confidence = Math.min(
      0.98,
      best.score * 0.65 +
        (brandMatches(product2003.brand, current.brand) ? 0.25 : 0) +
        (Math.abs(sizeDeltaPercent) < 10 ? 0.1 : 0),
    );

    if (confidence < 0.25) {
      continue;
    }

    matches.push({
      id: product2003.id,
      name: current.name,
      brand: product2003.brand,
      category2003: product2003.category,
      price2003: product2003.price2003,
      priceToday: current.price,
      size2003Text: product2003.sizeText,
      sizeTodayText: current.sizeText,
      size2003Formatted: product2003.size ? formatSize(product2003.size) : null,
      sizeTodayFormatted: current.size ? formatSize(current.size) : null,
      sizeDeltaPercent,
      priceDeltaPercent,
      inflationPercent,
      sizeCaveat: buildSizeCaveat(sizeDeltaPercent, priceDeltaPercent),
      matchConfidence: Number(confidence.toFixed(2)),
      imageUrl: current.imageUrl,
      productUrl: current.url,
      currentProductId: current.productId,
    });
  }

  const sortedMatches = matches.sort(
    (left, right) => right.matchConfidence - left.matchConfidence,
  );

  writeFileSync(
    OUTPUT_PATH,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        count: sortedMatches.length,
        notes: {
          sizeRule:
            "Si hay empate en la diferencia de tamaño, se elige el formato más pequeño.",
          priceComparison:
            "priceDeltaPercent compara precios normalizados al tamaño actual.",
          caveatExample: buildSizeCaveat(-20, 50),
        },
        products: sortedMatches,
      },
      null,
      2,
    ),
  );

  console.log(`Matched ${sortedMatches.length} products`);
  console.log(`Example caveat: ${buildSizeCaveat(-20, 50)}`);
  console.log(`Example inflation: ${formatPercent(sortedMatches[0]?.inflationPercent ?? 0)}`);
};

matchProducts();
