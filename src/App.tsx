import { useMemo, useState } from "react";
import matchedCatalog from "../data/matched-products.json";
import heroLogo from "./assets/logo-hero.png";
import stageBackground from "./assets/stage-background.jpg";
import type { MatchedProduct } from "./types";

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

const StageLayer = () => (
  <>
    <img
      src={stageBackground}
      alt=""
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 h-full w-full object-cover object-top"
    />
    <div
      className="pointer-events-none fixed inset-0 z-0 bg-black/15"
      aria-hidden="true"
    />
  </>
);

const getGuessScore = (guess: number, actual: number) => {
  if (actual <= 0) {
    return 0;
  }

  const errorRatio = Math.abs(guess - actual) / actual;
  const score = Math.max(0, 100 - errorRatio * 100);
  return Math.round(score);
};

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
        </header>

        <section className="panel-show overflow-hidden rounded-[2rem]">
          <div className="border-b-2 border-show-gold/40 bg-black/20 px-6 py-4 text-left">
            <p className="font-display text-sm font-black uppercase tracking-[0.22em] text-show-gold">
              Ronda {round}
            </p>
          </div>

          <div className="px-6 py-6">
            <div className="mb-4 text-left md:hidden">
              <p className="font-display text-sm font-black uppercase tracking-[0.18em] text-show-gold">
                {currentProduct.brand}
              </p>
              <h2 className="font-display mt-1 text-2xl font-black text-white">
                {currentProduct.name}
              </h2>
              <p className="mt-2 text-sm font-semibold text-show-cream/70">
                {currentProduct.category2003}
              </p>
            </div>

            <div className="grid grid-cols-[112px_1fr] items-stretch gap-3 md:grid-cols-[140px_1fr] md:items-start md:gap-6">
              <div className="flex min-h-[112px] items-center justify-center overflow-hidden rounded-2xl bg-white shadow-[0_0_20px_rgba(255,210,74,0.35)] md:aspect-square md:min-h-0">
                {currentProduct.imageUrl ? (
                  <img
                    src={currentProduct.imageUrl}
                    alt={currentProduct.name}
                    className="h-full w-full object-contain"
                  />
                ) : (
                  <span className="px-3 text-center text-sm font-semibold text-show-burgundy/70">
                    Sin foto
                  </span>
                )}
              </div>

              <div className="text-left">
                <div className="hidden md:block">
                  <p className="font-display text-sm font-black uppercase tracking-[0.18em] text-show-gold">
                    {currentProduct.brand}
                  </p>
                  <h2 className="font-display mt-1 text-2xl font-black text-white">
                    {currentProduct.name}
                  </h2>
                  <p className="mt-2 text-sm font-semibold text-show-cream/70">
                    {currentProduct.category2003}
                  </p>
                </div>

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

          <div className="border-t-2 border-show-gold/40 px-6 py-6">
            {!isRevealed ? (
              <>
                <label
                  htmlFor="guess"
                  className="font-display block text-left text-sm font-black uppercase tracking-[0.14em] text-show-gold"
                >
                  Tu apuesta (precio en 2003)
                </label>
                <div className="mt-2 flex flex-col gap-3 sm:flex-row">
                  <input
                    id="guess"
                    type="text"
                    inputMode="decimal"
                    value={guess}
                    onChange={handleGuessChange}
                    onKeyDown={handleKeyDown}
                    placeholder="Ej: 1,25"
                    aria-label="Precio estimado en 2003 en euros"
                    className="field-show w-full rounded-2xl px-4 py-3 text-lg font-bold"
                  />
                  <button
                    type="button"
                    onClick={handleReveal}
                    disabled={parsedGuess === null}
                    aria-label="Revelar precio de 2003"
                    className="btn-gold font-display rounded-2xl px-5 py-3 text-base font-black uppercase tracking-[0.12em]"
                  >
                    Revelar
                  </button>
                </div>
              </>
            ) : (
              <div className="text-left">
                <p className="font-display text-sm font-black uppercase tracking-[0.18em] text-show-gold">
                  Resultado
                </p>
                <p className="font-display mt-2 text-3xl font-black text-gold-metal">
                  En 2003 costaba {formatEuro(currentProduct.price2003)}
                </p>
                <p className="mt-2 text-lg font-bold text-show-cream">
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
                {score !== null ? (
                  <p className="font-display mt-4 text-xl font-black text-chrome-metal">
                    Tu puntuación en esta ronda: {score}/100
                  </p>
                ) : null}
                {parsedGuess !== null ? (
                  <p className="mt-1 text-sm font-semibold text-show-cream/75">
                    Tu respuesta: {formatEuro(parsedGuess)} · Diferencia:{" "}
                    {formatEuro(
                      Math.abs(parsedGuess - currentProduct.price2003),
                    )}
                  </p>
                ) : null}
                <button
                  type="button"
                  onClick={handleNext}
                  aria-label="Siguiente producto"
                  className="btn-chrome font-display mt-5 w-full rounded-2xl px-5 py-3 text-base font-black uppercase tracking-[0.12em] sm:w-auto"
                >
                  Siguiente
                </button>
              </div>
            )}
          </div>
        </section>

        <footer className="mt-8 text-center text-xs font-semibold text-show-cream/55">
          Datos: catálogo Carrefour 2003 (Jaime Obregón) vs scrape estático de
          carrefour.es.
        </footer>
      </main>
    </div>
  );
};

export default App;
