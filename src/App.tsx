import { useMemo, useState } from "react";
import matchedCatalog from "../data/matched-products.json";
import heroLogo from "./assets/logo-hero.png";
import stageBackground from "./assets/stage-background.jpg";
import type { MatchedProduct } from "./types";

type Verdict = {
  minScore: number;
  label: string;
};

const VERDICTS: Verdict[] = [
  { minScore: 95, label: "¡El precio justo!" },
  { minScore: 80, label: "¡Muy cerca!" },
  { minScore: 60, label: "Caliente, caliente" },
  { minScore: 30, label: "Templado" },
  { minScore: 0, label: "Frío, frío" },
];

const formatEuro = (value: number) =>
  value.toLocaleString("es-ES", {
    style: "currency",
    currency: "EUR",
  });

const formatPercent = (value: number) =>
  `${value >= 0 ? "+" : ""}${value.toLocaleString("es-ES", {
    maximumFractionDigits: 0,
  })}%`;

const getRandomProduct = (products: MatchedProduct[]) => {
  const index = Math.floor(Math.random() * products.length);
  return products[index];
};

const getGuessScore = (guess: number, actual: number) => {
  if (actual <= 0) {
    return 0;
  }

  const errorRatio = Math.abs(guess - actual) / actual;
  const score = Math.max(0, 100 - errorRatio * 100);
  return Math.round(score);
};

const getVerdictLabel = (score: number) => {
  const verdict = VERDICTS.find((item) => score >= item.minScore);
  return verdict?.label ?? "";
};

const StageLayer = () => (
  <>
    <img
      src={stageBackground}
      alt=""
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 h-full w-full object-cover object-top"
    />
    <div
      className="pointer-events-none fixed inset-0 z-0 bg-gradient-to-b from-black/10 via-black/15 to-black/50"
      aria-hidden="true"
    />
  </>
);

type ProductImageProps = {
  product: MatchedProduct;
};

const ProductImage = ({ product }: ProductImageProps) => {
  const [hasError, setHasError] = useState(false);

  const handleImageError = () => {
    setHasError(true);
  };

  if (!product.imageUrl || hasError) {
    return (
      <div
        role="img"
        aria-label={`Sin foto de ${product.name}`}
        className="flex h-full w-full flex-col items-center justify-center gap-1 bg-gradient-to-b from-show-cream to-white text-show-burgundy/60"
      >
        <span className="text-4xl" aria-hidden="true">
          🛒
        </span>
        <span className="font-display text-[0.65rem] font-black uppercase tracking-[0.18em]">
          Sin foto
        </span>
      </div>
    );
  }

  return (
    <img
      src={product.imageUrl}
      alt={product.name}
      referrerPolicy="no-referrer"
      onError={handleImageError}
      className="h-full w-full object-contain p-2"
    />
  );
};

type ProductDetailsProps = {
  product: MatchedProduct;
  className: string;
};

const ProductDetails = ({ product, className }: ProductDetailsProps) => (
  <div className={className}>
    <p className="font-display text-sm font-black uppercase tracking-[0.18em] text-show-gold">
      {product.brand}
    </p>
    <h2 className="font-display mt-1 text-2xl leading-tight font-black text-white">
      {product.name}
    </h2>
    <div className="mt-3 flex flex-wrap gap-2">
      <span className="rounded-full bg-black/25 px-3 py-1 text-xs font-bold text-show-cream/80 ring-1 ring-show-gold/30">
        {product.category2003}
      </span>
      {product.sizeTodayFormatted ? (
        <span className="rounded-full bg-black/25 px-3 py-1 text-xs font-bold text-show-cream/80 ring-1 ring-show-gold/30">
          {product.sizeTodayFormatted}
        </span>
      ) : null}
    </div>
  </div>
);

type PriceCardProps = {
  label: string;
  price: number;
  variant: "gold" | "chrome";
};

const PriceCard = ({ label, price, variant }: PriceCardProps) => {
  const variantClassName =
    variant === "gold" ? "panel-gold text-show-burgundy" : "panel-chrome text-neutral-800";

  return (
    <div className={`flex-1 rounded-2xl px-4 py-3 text-center ${variantClassName}`}>
      <p className="font-display text-xs font-black uppercase tracking-[0.18em] opacity-70">
        {label}
      </p>
      <p className="font-display text-2xl font-black tracking-tight md:text-3xl">
        {formatEuro(price)}
      </p>
    </div>
  );
};

type ScoreMeterProps = {
  score: number;
};

const ScoreMeter = ({ score }: ScoreMeterProps) => (
  <div className="mt-5">
    <div className="flex items-baseline justify-between gap-3">
      <p className="font-display text-xl font-black text-chrome-metal">
        {getVerdictLabel(score)}
      </p>
      <p className="font-display text-lg font-black text-show-gold">
        {score}
        <span className="text-sm text-show-cream/60">/100</span>
      </p>
    </div>
    <div
      role="progressbar"
      aria-label="Puntuación de la ronda"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={score}
      className="mt-2 h-3 overflow-hidden rounded-full bg-black/35 ring-1 ring-show-gold/30"
    >
      <div
        className="h-full rounded-full bg-gradient-to-r from-show-orange via-show-gold to-show-cream transition-[width] duration-700 ease-out"
        style={{ width: `${score}%` }}
      />
    </div>
  </div>
);

const App = () => {
  const products = (matchedCatalog.products as MatchedProduct[]).filter(
    (product) =>
      product.matchConfidence >= 0.5 &&
      product.size2003Formatted !== null &&
      product.sizeTodayFormatted !== null &&
      Math.abs(product.sizeDeltaPercent) < 1 &&
      product.priceToday > product.price2003,
  );
  const [currentProduct, setCurrentProduct] = useState<MatchedProduct>(() =>
    getRandomProduct(products),
  );
  const [guess, setGuess] = useState("");
  const [isRevealed, setIsRevealed] = useState(false);
  const [score, setScore] = useState<number | null>(null);
  const [round, setRound] = useState(1);
  const [totalScore, setTotalScore] = useState(0);

  const parsedGuess = useMemo(() => {
    const normalized = guess.replace(",", ".");
    const value = Number.parseFloat(normalized);
    return Number.isFinite(value) ? value : null;
  }, [guess]);

  const handleGuessChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setGuess(event.target.value);
  };

  const handleReveal = () => {
    if (parsedGuess === null) {
      return;
    }

    const nextScore = getGuessScore(parsedGuess, currentProduct.price2003);
    setScore(nextScore);
    setTotalScore((value) => value + nextScore);
    setIsRevealed(true);
  };

  const handleNext = () => {
    setCurrentProduct(getRandomProduct(products));
    setGuess("");
    setIsRevealed(false);
    setScore(null);
    setRound((value) => value + 1);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter") {
      return;
    }

    event.preventDefault();

    if (isRevealed) {
      handleNext();
      return;
    }

    handleReveal();
  };

  if (products.length === 0) {
    return (
      <div className="relative min-h-screen">
        <StageLayer />
        <main className="relative z-10 mx-auto flex min-h-screen max-w-2xl items-center px-4 py-10">
          <div className="panel-show w-full rounded-[2rem] p-8 text-center">
            <img
              src={heroLogo}
              alt="El Precio Justo"
              className="mx-auto mb-4 w-full max-w-[140px] drop-shadow-[0_12px_28px_rgba(0,0,0,0.45)] md:max-w-[150px]"
            />
            <p className="mt-4 text-lg font-semibold text-show-cream/85">
              Todavía no hay productos emparejados. Ejecuta los scripts de datos
              primero.
            </p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen">
      <StageLayer />
      <main className="relative z-10 mx-auto min-h-screen max-w-2xl px-4 py-8">
        <header className="mb-8 text-center">
          <img
            src={heroLogo}
            alt="El Precio Justo"
            className="mx-auto w-full max-w-[140px] drop-shadow-[0_12px_28px_rgba(0,0,0,0.45)] md:max-w-[150px]"
          />
          <h1 className="font-display mt-2 text-3xl font-black uppercase tracking-tight text-gold-metal md:text-4xl">
            ¿Cuánto costaba en 2003?
          </h1>
          <p className="mt-2 text-sm font-bold text-show-cream/80 drop-shadow md:text-base">
            Te damos el precio de hoy en Carrefour. Tú adivinas el de hace
            más de 20 años.
          </p>
        </header>

        <section className="panel-show overflow-hidden rounded-[2rem]">
          <div className="flex items-center justify-between gap-4 border-b-2 border-show-gold/40 bg-black/20 px-6 py-4">
            <p className="font-display text-sm font-black uppercase tracking-[0.22em] text-show-gold">
              Ronda {round}
            </p>
            <p className="font-display rounded-full bg-black/30 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-show-cream ring-1 ring-show-gold/40">
              {totalScore} pts
            </p>
          </div>

          <div key={currentProduct.id} className="animate-pop-in px-6 py-6">
            <ProductDetails product={currentProduct} className="mb-4 text-left md:hidden" />

            <div className="grid grid-cols-[112px_1fr] items-stretch gap-3 md:grid-cols-[140px_1fr] md:items-start md:gap-6">
              <div className="flex min-h-[112px] items-center justify-center overflow-hidden rounded-2xl bg-white ring-4 ring-show-cream/80 shadow-[0_0_24px_rgba(255,210,74,0.45)] md:aspect-square md:min-h-0">
                <ProductImage product={currentProduct} />
              </div>

              <div className="text-left">
                <ProductDetails product={currentProduct} className="hidden md:block" />

                <div className="panel-gold flex h-full flex-col justify-center rounded-2xl px-4 py-3 text-show-burgundy md:hidden">
                  <p className="font-display text-xs font-black uppercase tracking-[0.18em] text-show-burgundy/70">
                    Precio hoy
                  </p>
                  <p className="font-display text-3xl font-black">
                    {formatEuro(currentProduct.priceToday)}
                  </p>
                </div>
              </div>
            </div>

            <div className="panel-gold mt-5 hidden items-center justify-between gap-4 rounded-2xl px-5 py-4 text-show-burgundy md:flex">
              <p className="font-display text-sm font-black uppercase tracking-[0.18em] text-show-burgundy/70">
                Precio hoy
              </p>
              <p className="font-display text-4xl font-black tracking-tight">
                {formatEuro(currentProduct.priceToday)}
              </p>
            </div>
          </div>

          <div className="border-t-2 border-show-gold/40 bg-black/10 px-6 py-6">
            {!isRevealed ? (
              <>
                <label
                  htmlFor="guess"
                  className="font-display block text-left text-sm font-black uppercase tracking-[0.14em] text-show-gold"
                >
                  Tu apuesta (precio en 2003)
                </label>
                <div className="mt-2 flex flex-col gap-3 sm:flex-row">
                  <div className="relative w-full">
                    <input
                      id="guess"
                      type="text"
                      inputMode="decimal"
                      autoComplete="off"
                      autoFocus
                      value={guess}
                      onChange={handleGuessChange}
                      onKeyDown={handleKeyDown}
                      placeholder="Ej: 1,25"
                      aria-label="Precio estimado en 2003 en euros"
                      className="field-show w-full rounded-2xl py-3 pr-10 pl-4 text-lg font-bold"
                    />
                    <span
                      aria-hidden="true"
                      className="font-display pointer-events-none absolute inset-y-0 right-4 flex items-center text-lg font-black text-show-gold"
                    >
                      €
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleReveal}
                    disabled={parsedGuess === null}
                    aria-label="Revelar precio de 2003"
                    className="btn-gold font-display rounded-2xl px-6 py-3 text-base font-black uppercase tracking-[0.12em] transition active:translate-y-0.5"
                  >
                    Revelar
                  </button>
                </div>
                <p className="mt-3 text-left text-xs font-semibold text-show-cream/60">
                  Pulsa Enter para revelar el precio.
                </p>
              </>
            ) : (
              <div className="animate-pop-in text-left">
                <p className="font-display text-sm font-black uppercase tracking-[0.18em] text-show-gold">
                  Resultado
                </p>

                <div className="mt-3 flex items-center gap-3">
                  <PriceCard label="2003" price={currentProduct.price2003} variant="chrome" />
                  <span
                    aria-hidden="true"
                    className="font-display text-2xl font-black text-show-gold"
                  >
                    →
                  </span>
                  <PriceCard label="Hoy" price={currentProduct.priceToday} variant="gold" />
                </div>

                <p className="mt-4 text-center text-lg font-bold text-show-cream">
                  Inflación aparente:{" "}
                  <span className="font-display font-black text-show-gold">
                    {formatPercent(currentProduct.inflationPercent)}
                  </span>
                </p>

                {currentProduct.sizeCaveat ? (
                  <p className="panel-chrome mt-3 rounded-2xl px-4 py-3 text-sm font-bold text-show-burgundy">
                    Ojo con el formato: {currentProduct.sizeCaveat}
                  </p>
                ) : null}

                {score !== null ? <ScoreMeter score={score} /> : null}

                {parsedGuess !== null ? (
                  <p className="mt-2 text-sm font-semibold text-show-cream/75">
                    Tu respuesta: {formatEuro(parsedGuess)} · Diferencia:{" "}
                    {formatEuro(
                      Math.abs(parsedGuess - currentProduct.price2003),
                    )}
                  </p>
                ) : null}

                <button
                  type="button"
                  onClick={handleNext}
                  autoFocus
                  aria-label="Siguiente producto"
                  className="btn-chrome font-display mt-5 w-full rounded-2xl px-5 py-3 text-base font-black uppercase tracking-[0.12em] transition active:translate-y-0.5 sm:w-auto"
                >
                  Siguiente →
                </button>
              </div>
            )}
          </div>
        </section>

        <footer className="mt-8 text-center text-xs font-semibold text-show-cream/60">
          Datos: catálogo Carrefour 2003 (
          <a
            href="https://github.com/JaimeObregon/precios"
            target="_blank"
            rel="noreferrer"
            className="underline decoration-show-gold/50 underline-offset-2 hover:text-show-gold"
          >
            Jaime Obregón
          </a>
          ) vs scrape estático de carrefour.es.
        </footer>
      </main>
    </div>
  );
};

export default App;
