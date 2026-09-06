"use client";

import { useToast } from "@/components/ToastProvider";
import {
  openCompetitorSearchStream,
  orderSlices,
  productMatchesClientFilter,
  type CompetitorStreamMeta,
  type LabAliases,
  type SiteSlice,
} from "@/lib/competitors";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import SiteCarousel from "./SiteCarousel";

const inputClass =
  "h-10 w-full rounded-lg border-2 px-3 text-sm font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[color:var(--primary-400)] disabled:opacity-60";

const inputStyle = {
  borderColor: "var(--primary-400)",
  backgroundColor:
    "color-mix(in srgb, var(--primary-600) 12%, var(--background))",
  color: "var(--foreground)",
} as const;

const EMPTY_ALIASES: LabAliases = { ag: [], mk: [] };

export default function PreciosPageClient() {
  const toast = useToast();
  const [q, setQ] = useState("");
  const [doseFilter, setDoseFilter] = useState("");
  const [labFilter, setLabFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [meta, setMeta] = useState<CompetitorStreamMeta | null>(null);
  const [slices, setSlices] = useState<SiteSlice[]>([]);
  const [error, setError] = useState<string | null>(null);

  const stopRef = useRef<(() => void) | null>(null);
  const tickRef = useRef<number | null>(null);

  const stopStream = () => {
    stopRef.current?.();
    stopRef.current = null;
    if (tickRef.current != null) {
      window.clearInterval(tickRef.current);
      tickRef.current = null;
    }
  };

  useEffect(() => {
    return () => stopStream();
  }, []);

  const labAliases = meta?.lab_aliases ?? EMPTY_ALIASES;

  const filteredSlices = useMemo(() => {
    const ordered = orderSlices(slices);
    return ordered.map((slice) => ({
      slice,
      products: slice.products.filter((p) =>
        productMatchesClientFilter(p, {
          dose: doseFilter,
          lab: labFilter,
          aliases: labAliases,
        })
      ),
    }));
  }, [slices, doseFilter, labFilter, labAliases]);

  const runSearch = (raw: string) => {
    const query = raw.trim();
    if (query.length < 2 || query.length > 80) {
      toast.show("Escribe entre 2 y 80 caracteres.", "error");
      return;
    }

    // Una sola conexión SSE por sesión.
    stopStream();

    setLoading(true);
    setError(null);
    setStatusMsg("Conectando…");
    setMeta(null);
    setSlices([]);
    setElapsedSec(0);

    const startedAt = Date.now();
    tickRef.current = window.setInterval(() => {
      setElapsedSec(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);

    stopRef.current = openCompetitorSearchStream(query, {
      onQueued: ({ message }) => setStatusMsg(message),
      onStarted: ({ message }) => setStatusMsg(message),
      onMeta: (m) => {
        setMeta(m);
        if (m.error) {
          setError(m.error);
          toast.show(m.error, "error");
        }
      },
      onSlice: (slice) => {
        setSlices((prev) => {
          const next = prev.filter((s) => s.site !== slice.site);
          next.push(slice);
          return orderSlices(next);
        });
      },
      onDone: () => {
        stopStream();
        setLoading(false);
        setStatusMsg(null);
        toast.show("Búsqueda lista.", "success");
      },
      onError: (message) => {
        stopStream();
        setLoading(false);
        setStatusMsg(null);
        setError(message);
        toast.show(message, "error");
      },
    });
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    runSearch(q);
  };

  const showFilters = meta != null || slices.length > 0;

  return (
    <section
      aria-label="Referencia de precios competencia"
      className="w-full max-w-6xl pb-8"
    >
      <h1
        className="text-2xl font-bold"
        style={{ color: "var(--primary-800)" }}
      >
        Ref. Precios
      </h1>
      <p className="mt-1 text-sm" style={{ color: "var(--primary-700)" }}>
        Compara precios en 6 droguerías. Los resultados van apareciendo por
        sitio; no cierres la pestaña mientras busca.
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
      </form>

      {loading && statusMsg ? (
        <div
          className="mt-4 rounded-xl border px-4 py-3 text-sm font-medium"
          style={{
            borderColor: "var(--primary-200)",
            backgroundColor:
              "color-mix(in srgb, var(--primary-600) 12%, var(--background))",
            color: "var(--primary-800)",
          }}
          role="status"
          aria-live="polite"
        >
          {statusMsg}
          <span className="opacity-70"> · {elapsedSec}s</span>
        </div>
      ) : null}

      {showFilters ? (
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

      {meta ? (
        <p
          className="mt-3 text-xs font-medium"
          style={{ color: "var(--primary-700)" }}
        >
          Consulta: “{meta.q}” · en sitios: “{meta.q_site}”
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
