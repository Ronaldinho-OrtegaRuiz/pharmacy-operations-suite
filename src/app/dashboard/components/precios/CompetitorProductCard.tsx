"use client";

import { formatValorCOPTable } from "@/lib/money-format";
import type { CompetitorProduct } from "@/lib/competitors";

type Props = {
  product: CompetitorProduct;
};

export default function CompetitorProductCard({ product }: Props) {
  const priceLabel =
    product.price != null ? formatValorCOPTable(product.price) : "Sin precio";

  const imageBlock = (
    <div
      className="flex h-28 w-full items-center justify-center overflow-hidden rounded-xl"
      style={{
        backgroundColor:
          "color-mix(in srgb, var(--primary-200) 40%, var(--background))",
      }}
    >
      {product.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={product.image}
          alt=""
          className="h-full w-full object-contain p-2"
          loading="lazy"
          referrerPolicy="no-referrer"
        />
      ) : (
        <span
          className="text-xs font-semibold"
          style={{ color: "var(--primary-600)" }}
        >
          Sin imagen
        </span>
      )}
    </div>
  );

  return (
    <div
      className="flex h-full w-[11.5rem] shrink-0 flex-col rounded-2xl border p-3 text-left sm:w-[13rem]"
      style={{
        borderColor: "var(--primary-200)",
        backgroundColor:
          "color-mix(in srgb, var(--primary-600) 8%, var(--background))",
      }}
    >
      {product.url ? (
        <a
          href={product.url}
          target="_blank"
          rel="noopener noreferrer"
          className="block rounded-xl outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-[color:var(--primary-400)]"
          title="Abrir en la página de la droguería"
          aria-label={`Ver ${product.name} en la página de la droguería`}
        >
          {imageBlock}
        </a>
      ) : (
        imageBlock
      )}
      <h3
        className="mt-3 line-clamp-3 text-sm font-bold leading-snug"
        style={{ color: "var(--primary-800)" }}
      >
        {product.name}
      </h3>
      {product.lab ? (
        <p
          className="mt-1 text-xs font-semibold"
          style={{ color: "var(--primary-700)" }}
        >
          {product.lab}
        </p>
      ) : null}
      <p
        className="mt-2 text-base font-bold tabular-nums"
        style={{ color: "var(--primary-600)" }}
      >
        {priceLabel}
      </p>
      {product.presentation ? (
        <p
          className="mt-1 line-clamp-2 text-[11px] font-medium leading-snug"
          style={{ color: "var(--primary-700)" }}
        >
          {product.presentation}
        </p>
      ) : null}
    </div>
  );
}
