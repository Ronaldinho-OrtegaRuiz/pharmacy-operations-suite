"use client";

import { useToast } from "@/components/ToastProvider";
import {
  mockCompetitorSearch,
  productMatchesClientFilter,
  searchCompetitors,
  type CompetitorSearch,
} from "@/lib/competitors";
import { useMemo, useState, type FormEvent } from "react";
import SiteCarousel from "./SiteCarousel";

const inputClass =
  "h-10 w-full rounded-lg border-2 px-3 text-sm font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[color:var(--primary-400)] disabled:opacity-60";

const inputStyle = {
  borderColor: "var(--primary-400)",
  backgroundColor:
    "color-mix(in srgb, var(--primary-600) 12%, var(--background))",
  color: "var(--foreground)",
} as const;

export default function PreciosPageClient() {
  const toast = useToast();
  const [q, setQ] = useState("");
  const [doseFilter, setDoseFilter] = useState("");
  const [labFilter, setLabFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [result, setResult] = useState<CompetitorSearch | null>(null);
  const [error, setError] = useState<string | null>(null);

  const filteredSlices = useMemo(() => {
    if (!result) return [];
    return result.slices.map((slice) => ({
      slice,
      products: slice.products.filter((p) =>
        productMatchesClientFilter(p, {
          dose: doseFilter,
          lab: labFilter,
          aliases: result.lab_aliases,
        })
      ),
    }));
  }, [result, doseFilter, labFilter]);

  const runSearch = async (raw: string) => {
    const query = raw.trim();
    if (query.length < 2 || query.length > 80) {
      toast.show("Escribe entre 2 y 80 caracteres.", "error");
      return;
    }
    setLoading(true);
    setError(null);
    setElapsedSec(0);
    const started = Date.now();
    const tick = window.setInterval(() => {
      setElapsedSec(Math.floor((Date.now() - started) / 1000));
    }, 1000);
    try {
      const res = await searchCompetitors(query);
      if (!res.ok) {
        const detail =
          res.body &&
          typeof res.body === "object" &&
          "detail" in res.body &&
          typeof (res.body as { detail?: unknown }).detail === "string"
            ? (res.body as { detail: string }).detail
            : "No se pudo completar la búsqueda.";
        setError(detail);
        setResult(null);
        toast.show(detail, "error");
        return;
      }
      if (res.data.error) {
        setError(res.data.error);
        setResult(res.data);
        toast.show(res.data.error, "error");
        return;
      }
      setResult(res.data);
      toast.show(`Listo: “${res.data.q_site}” en los sitios.`, "success");
    } finally {
      window.clearInterval(tick);
      setLoading(false);
    }
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void runSearch(q);
  };

  const onDemo = () => {
    const demoQ = q.trim() || "acetaminofen 500mg AG";
    setQ(demoQ);
    setError(null);
    setResult(mockCompetitorSearch(demoQ));
    toast.show("Demo local (sin llamar al scrape).", "success");
  };

  return (
    <section aria-label="Referencia de precios competencia" className="w-full max-w-6xl pb-8">
      <h1
        className="text-2xl font-bold"
        style={{ color: "var(--primary-800)" }}
      >
        Ref. Precios
      </h1>
      <p className="mt-1 text-sm" style={{ color: "var(--primary-700)" }}>
        Compara precios en 6 droguerías. La búsqueda puede tardar 1–3 minutos;
        no cierres la pestaña.
      </p>

      <form
        onSubmit={onSubmit}
        className="mt-6 flex w-full max-w-3xl flex-col gap-3 sm:flex-row sm:items-end"
      >
        <label
          className="flex min-w-0 flex-1 flex-col gap-1 text-sm font-semibold"
          style={{ color: "var(--primary-800)" }}
        >
          Buscar producto
          <input
            value={q}
            disabled={loading}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Ej. acetaminofen 500mg AG"
            className={inputClass}
            style={inputStyle}
            maxLength={80}
            autoComplete="off"
          />
        </label>
        <button
          type="submit"
          disabled={loading}
          className="h-10 shrink-0 rounded-xl px-5 text-sm font-semibold text-white disabled:opacity-60"
          style={{ backgroundColor: "var(--primary-600)" }}
        >
          {loading ? `Buscando… ${elapsedSec}s` : "Buscar"}
        </button>
        <button
          type="button"
          disabled={loading}
          onClick={onDemo}
          className="h-10 shrink-0 rounded-xl border-2 px-4 text-sm font-semibold disabled:opacity-60"
          style={{
            borderColor: "var(--primary-400)",
            color: "var(--primary-800)",
            backgroundColor:
              "color-mix(in srgb, var(--primary-600) 10%, var(--background))",
          }}
        >
          Ver demo
        </button>
      </form>

      {loading ? (
        <div
          className="mt-4 rounded-xl border px-4 py-3 text-sm font-medium"
          style={{
            borderColor: "var(--primary-200)",
            backgroundColor:
              "color-mix(in srgb, var(--primary-600) 12%, var(--background))",
            color: "var(--primary-800)",
          }}
        >
          Consultando 6 sitios (de a 2). Búsquedas chicas ~1–1.5 min; con muchos
          resultados ~2–3 min. Llevas {elapsedSec}s…
        </div>
      ) : null}

      {result ? (
        <div className="mt-5 flex w-full max-w-3xl flex-col gap-3 sm:flex-row">
          <label
            className="flex min-w-0 flex-1 flex-col gap-1 text-sm font-semibold"
            style={{ color: "var(--primary-800)" }}
          >
            Filtro dosis (cliente)
            <input
              value={doseFilter}
              onChange={(e) => setDoseFilter(e.target.value)}
              placeholder="Ej. 500"
              className={inputClass}
              style={inputStyle}
            />
          </label>
          <label
            className="flex min-w-0 flex-1 flex-col gap-1 text-sm font-semibold"
            style={{ color: "var(--primary-800)" }}
          >
            Filtro lab (AG / MK / nombre)
            <input
              value={labFilter}
              onChange={(e) => setLabFilter(e.target.value)}
              placeholder="Ej. AG"
              className={inputClass}
              style={inputStyle}
            />
          </label>
        </div>
      ) : null}

      {result ? (
        <p className="mt-3 text-xs font-medium" style={{ color: "var(--primary-700)" }}>
          Consulta: “{result.q}” · en sitios: “{result.q_site}”
          {labFilter.trim().toLowerCase() === "ag"
            ? " · AG incluye Lafrancol"
            : ""}
          {labFilter.trim().toLowerCase() === "mk"
            ? " · MK incluye Tecnoquímicas"
            : ""}
        </p>
      ) : null}

      {error ? (
        <div
          className="mt-4 rounded-xl border px-4 py-3 text-sm font-medium"
          style={{
            borderColor: "color-mix(in srgb, #f87171 45%, var(--primary-200))",
            backgroundColor:
              "color-mix(in srgb, #ef4444 14%, var(--background))",
            color: "var(--foreground)",
          }}
        >
          {error}
        </div>
      ) : null}

      {filteredSlices.length > 0 ? (
        <div className="mt-6 flex flex-col gap-5">
          {filteredSlices.map(({ slice, products }) => (
            <SiteCarousel key={slice.site} slice={slice} products={products} />
          ))}
        </div>
      ) : null}
    </section>
  );
}
