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

export type MatchedCatalog = {
  generatedAt: string;
  count: number;
  products: MatchedProduct[];
};
