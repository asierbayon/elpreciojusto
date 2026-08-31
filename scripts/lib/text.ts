export type ParsedSize = {
  amount: number;
  unit: "ml" | "g" | "unit";
  label: string;
};

const UNIT_ALIASES: Record<string, ParsedSize["unit"]> = {
  l: "ml",
  lt: "ml",
  litro: "ml",
  litros: "ml",
  ml: "ml",
  cl: "ml",
  g: "g",
  gr: "g",
  grs: "g",
  kg: "g",
  ud: "unit",
  uds: "unit",
  unidad: "unit",
  unidades: "unit",
};

const normalizeText = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export const normalizeBrand = (value: string) => normalizeText(value);

export const tokenize = (value: string) =>
  normalizeText(value)
    .split(" ")
    .filter((token) => token.length > 2);

export const parsePrice = (value: string | number) => {
  if (typeof value === "number") {
    return value;
  }

  const cleaned = value.replace(/[^\d,.-]/g, "").replace(",", ".");
  const parsed = Number.parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
};

const toBaseAmount = (amount: number, unit: ParsedSize["unit"]) => {
  if (unit === "ml") {
    return amount;
  }

  if (unit === "g") {
    return amount;
  }

  return amount;
};

export const parseSizeText = (value: string): ParsedSize | null => {
  const text = normalizeText(value);

  const packMatch = text.match(
    /(\d+(?:[.,]\d+)?)\s*(?:x|\*)\s*(\d+(?:[.,]\d+)?)\s*(kg|g|gr|grs|l|lt|ml|cl|ud|uds|unidad|unidades)/,
  );

  if (packMatch) {
    const count = Number.parseFloat(packMatch[1].replace(",", "."));
    const amount = Number.parseFloat(packMatch[2].replace(",", "."));
    const rawUnit = packMatch[3];
    const unit = UNIT_ALIASES[rawUnit] ?? "unit";
    const normalizedAmount =
      rawUnit === "kg"
        ? count * amount * 1000
        : rawUnit === "l" || rawUnit === "lt"
          ? count * amount * 1000
          : rawUnit === "cl"
            ? count * amount * 10
            : unit === "unit"
              ? count
              : count * amount;

    return {
      amount: normalizedAmount,
      unit,
      label: value.trim(),
    };
  }

  const multiUnitMatch = text.match(
    /(\d+(?:[.,]\d+)?)\s*(?:unidades?|uds?)\s*(?:de\s*)?(\d+(?:[.,]\d+)?)\s*(kg|g|gr|grs|l|lt|ml|cl)/,
  );

  if (multiUnitMatch) {
    const count = Number.parseFloat(multiUnitMatch[1].replace(",", "."));
    const amount = Number.parseFloat(multiUnitMatch[2].replace(",", "."));
    const rawUnit = multiUnitMatch[3];
    const unit = UNIT_ALIASES[rawUnit] ?? "g";
    const singleAmount =
      rawUnit === "kg"
        ? amount * 1000
        : rawUnit === "l" || rawUnit === "lt"
          ? amount * 1000
          : rawUnit === "cl"
            ? amount * 10
            : amount;

    return {
      amount: count * singleAmount,
      unit,
      label: value.trim(),
    };
  }

  const simpleMatch = text.match(
    /(\d+(?:[.,]\d+)?)\s*(kg|g|gr|grs|l|lt|ml|cl|ud|uds|unidad|unidades)/,
  );

  if (!simpleMatch) {
    const unitOnlyMatch = text.match(/^(?:botella|bandeja|lata|brik|pack|estuche)\s*(?:de\s*)?(\d+(?:[.,]\d+)?)\s*(kg|g|gr|grs|l|lt|ml|cl)/);
    if (unitOnlyMatch) {
      const amount = Number.parseFloat(unitOnlyMatch[1].replace(",", "."));
      const rawUnit = unitOnlyMatch[2];
      const unit = UNIT_ALIASES[rawUnit] ?? "g";
      const normalizedAmount =
        rawUnit === "kg"
          ? amount * 1000
          : rawUnit === "l" || rawUnit === "lt"
            ? amount * 1000
            : rawUnit === "cl"
              ? amount * 10
              : amount;

      return {
        amount: normalizedAmount,
        unit,
        label: value.trim(),
      };
    }

    return null;
  }

  const amount = Number.parseFloat(simpleMatch[1].replace(",", "."));
  const rawUnit = simpleMatch[2];
  const unit = UNIT_ALIASES[rawUnit] ?? "unit";
  const normalizedAmount =
    rawUnit === "kg"
      ? amount * 1000
      : rawUnit === "l" || rawUnit === "lt"
        ? amount * 1000
        : rawUnit === "cl"
          ? amount * 10
          : amount;

  return {
    amount: normalizedAmount,
    unit,
    label: value.trim(),
  };
};

export const parseSizeFromProductName = (value: string): ParsedSize | null => {
  const normalized = value.replace(",", ".");
  return parseSizeText(normalized);
};

export const sizesAreCompatible = (left: ParsedSize, right: ParsedSize) => {
  if (left.unit === right.unit) {
    return true;
  }

  if (left.unit === "unit" || right.unit === "unit") {
    return false;
  }

  return true;
};

export const sizeDifferenceRatio = (target: ParsedSize, candidate: ParsedSize) => {
  if (!sizesAreCompatible(target, candidate)) {
    return Number.POSITIVE_INFINITY;
  }

  if (target.amount === 0 || candidate.amount === 0) {
    return Number.POSITIVE_INFINITY;
  }

  return Math.abs(candidate.amount - target.amount) / target.amount;
};

export const formatSize = (size: ParsedSize) => {
  if (size.unit === "ml") {
    if (size.amount >= 1000) {
      const liters = size.amount / 1000;
      return `${liters.toLocaleString("es-ES", { maximumFractionDigits: 2 })} l`;
    }

    return `${size.amount.toLocaleString("es-ES", { maximumFractionDigits: 0 })} ml`;
  }

  if (size.unit === "g") {
    if (size.amount >= 1000) {
      const kilos = size.amount / 1000;
      return `${kilos.toLocaleString("es-ES", { maximumFractionDigits: 2 })} kg`;
    }

    return `${size.amount.toLocaleString("es-ES", { maximumFractionDigits: 0 })} g`;
  }

  return `${size.amount.toLocaleString("es-ES", { maximumFractionDigits: 0 })} ud`;
};

export const formatPercent = (value: number) =>
  `${value >= 0 ? "+" : ""}${value.toLocaleString("es-ES", {
    maximumFractionDigits: 0,
  })}%`;

export const buildSizeCaveat = (
  sizeDeltaPercent: number,
  priceDeltaPercent: number,
) => {
  if (Math.abs(sizeDeltaPercent) < 1) {
    return null;
  }

  const quantityText =
    sizeDeltaPercent > 0
      ? `${formatPercent(sizeDeltaPercent)} más cantidad`
      : `${Math.abs(sizeDeltaPercent).toLocaleString("es-ES", {
          maximumFractionDigits: 0,
        })}% menos cantidad`;

  const priceText =
    priceDeltaPercent > 0
      ? `${formatPercent(priceDeltaPercent)} más caro`
      : `${Math.abs(priceDeltaPercent).toLocaleString("es-ES", {
          maximumFractionDigits: 0,
        })}% más barato`;

  return `${quantityText}, ${priceText} (ajustado por tamaño)`;
};

export const jaccardSimilarity = (left: string[], right: string[]) => {
  const leftSet = new Set(left);
  const rightSet = new Set(right);
  const intersection = [...leftSet].filter((token) => rightSet.has(token));
  const union = new Set([...leftSet, ...rightSet]);
  return union.size === 0 ? 0 : intersection.length / union.size;
};

export const toComparableAmount = (size: ParsedSize) => toBaseAmount(size.amount, size.unit);
