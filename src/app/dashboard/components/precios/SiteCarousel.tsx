"use client";

import type { CompetitorProduct, SiteSlice } from "@/lib/competitors";
import { useRef } from "react";
import CompetitorProductCard from "./CompetitorProductCard";

type Props = {
  slice: SiteSlice;
  products: CompetitorProduct[];
};

function displaySiteLabel(slice: SiteSlice): string {
  if (slice.site === "tu_drogueria") {
    return "Tu Droguería Virtual (Droguería Inglesa)";
  }
  const base = slice.label.trim();
  if (/tu\s*droguer[ií]a/i.test(base) && !/inglesa/i.test(base)) {
    return `${base} (Droguería Inglesa)`;
  }
  return slice.label;
}

export default function SiteCarousel({ slice, products }: Props) {
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const title = displaySiteLabel(slice);
  const hasProducts = products.length > 0;

  const scrollBy = (dir: -1 | 1) => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollBy({
      left: dir * Math.min(320, el.clientWidth * 0.8),
      behavior: "smooth",
    });
  };

  return (
    <section
      className="w-full rounded-2xl border"
      style={{
        borderColor: "var(--primary-200)",
        backgroundColor:
          "color-mix(in srgb, var(--primary-600) 6%, var(--background))",
      }}
    >
      <div
        className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3"
        style={{ borderColor: "var(--primary-200)" }}
      >
        <div className="min-w-0">
          <h2
            className="text-base font-bold"
            style={{ color: "var(--primary-800)" }}
          >
            {title}
          </h2>
          <p
            className="text-xs font-medium"
            style={{ color: "var(--primary-700)" }}
          >
            {hasProducts
              ? `${products.length} producto${products.length === 1 ? "" : "s"}`
              : "No encontró resultados"}
          </p>
        </div>
        {hasProducts ? (
          <div className="flex gap-2">
            <button
              type="button"
              aria-label={`Anterior ${title}`}
              onClick={() => scrollBy(-1)}
              className="flex h-9 w-9 items-center justify-center rounded-xl border-2 text-sm font-bold"
              style={{
                borderColor: "var(--primary-400)",
                color: "var(--primary-800)",
                backgroundColor:
                  "color-mix(in srgb, var(--primary-600) 10%, var(--background))",
              }}
            >
              ‹
            </button>
            <button
              type="button"
              aria-label={`Siguiente ${title}`}
              onClick={() => scrollBy(1)}
              className="flex h-9 w-9 items-center justify-center rounded-xl border-2 text-sm font-bold"
              style={{
                borderColor: "var(--primary-400)",
                color: "var(--primary-800)",
                backgroundColor:
                  "color-mix(in srgb, var(--primary-600) 10%, var(--background))",
              }}
            >
              ›
            </button>
          </div>
        ) : null}
      </div>

      {!hasProducts ? (
        <p
          className="px-4 py-6 text-sm font-medium"
          style={{ color: "var(--primary-700)" }}
        >
          No encontró resultados
        </p>
      ) : (
        <div
          ref={scrollerRef}
          className="flex gap-3 overflow-x-auto overscroll-x-contain px-4 py-4 scroll-smooth"
          style={{ scrollbarGutter: "stable" }}
        >
          {products.map((p, i) => (
            <CompetitorProductCard
              key={`${slice.site}-${i}-${p.name}`}
              product={p}
            />
          ))}
        </div>
      )}
    </section>
  );
}
