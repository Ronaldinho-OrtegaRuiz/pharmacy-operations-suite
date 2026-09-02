"use client";

import { getSuppliers, type Supplier } from "@/lib/invoices";
import { useCallback, useEffect, useId, useRef, useState } from "react";

const inputClass =
  "h-9 w-full rounded-lg border-2 px-2 text-sm font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[color:var(--primary-400)] disabled:opacity-60";

const inputStyle = {
  borderColor: "var(--primary-400)",
  backgroundColor: "color-mix(in srgb, var(--primary-600) 12%, var(--background))",
  color: "var(--foreground)",
} as const;

type Props = {
  label?: string;
  valueId: number | "";
  valueLabel: string;
  onSelect: (supplier: Supplier | null) => void;
  /** Si true, al escribir un nombre que no existe se deja como texto libre (crear). */
  allowCreate?: boolean;
  onFreeText?: (name: string) => void;
  disabled?: boolean;
  placeholder?: string;
  clearable?: boolean;
  className?: string;
  onAuthExpired?: () => void;
};

const LIST_LIMIT = 10;

export default function SupplierTypeahead({
  label = "Proveedor",
  valueId,
  valueLabel,
  onSelect,
  allowCreate = false,
  onFreeText,
  disabled,
  placeholder = "Buscar proveedor…",
  clearable = true,
  className = "",
  onAuthExpired,
}: Props) {
  const listId = useId();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState(valueLabel);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [options, setOptions] = useState<Supplier[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setQuery(valueLabel);
  }, [valueLabel]);

  const search = useCallback(
    async (q: string) => {
      setLoading(true);
      try {
        const res = await getSuppliers({ q: q.trim() || undefined });
        if (!res.ok) {
          if (res.status === 401) onAuthExpired?.();
          setOptions([]);
          return;
        }
        setOptions(res.data.slice(0, LIST_LIMIT));
      } catch {
        setOptions([]);
      } finally {
        setLoading(false);
      }
    },
    [onAuthExpired]
  );

  useEffect(() => {
    if (!open) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void search(query);
    }, 220);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [open, query, search]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const pick = (s: Supplier) => {
    setQuery(s.name);
    onSelect(s);
    setOpen(false);
  };

  const clear = () => {
    setQuery("");
    onSelect(null);
    onFreeText?.("");
    setOpen(false);
  };

  return (
    <div ref={wrapRef} className={`relative flex flex-col gap-1 ${className}`}>
      {label ? (
        <span
          className="text-sm font-semibold"
          style={{ color: "var(--primary-800)" }}
        >
          {label}
        </span>
      ) : null}
      <div className="relative">
        <input
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          disabled={disabled}
          value={query}
          placeholder={placeholder}
          className={inputClass}
          style={inputStyle}
          onFocus={() => {
            setOpen(true);
            void search(query);
          }}
          onChange={(e) => {
            const v = e.target.value;
            setQuery(v);
            setOpen(true);
            if (valueId !== "") onSelect(null);
            if (allowCreate) onFreeText?.(v);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") setOpen(false);
            if (e.key === "Enter" && allowCreate && query.trim()) {
              e.preventDefault();
              onFreeText?.(query.trim());
              setOpen(false);
            }
          }}
        />
        {clearable && (query || valueId !== "") ? (
          <button
            type="button"
            disabled={disabled}
            aria-label="Limpiar proveedor"
            onClick={clear}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-bold disabled:opacity-60"
            style={{ color: "var(--primary-700)" }}
          >
            ✕
          </button>
        ) : null}
      </div>

      {open ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute left-0 right-0 top-full z-30 mt-1 max-h-60 overflow-y-auto rounded-xl border shadow-lg"
          style={{
            borderColor: "var(--primary-200)",
            backgroundColor: "var(--background)",
          }}
        >
          {loading ? (
            <li
              className="px-3 py-2 text-sm font-medium"
              style={{ color: "var(--primary-700)" }}
            >
              Buscando…
            </li>
          ) : null}
          {!loading && options.length === 0 ? (
            <li
              className="px-3 py-2 text-sm font-medium"
              style={{ color: "var(--primary-700)" }}
            >
              {allowCreate && query.trim()
                ? `Usar “${query.trim()}” como nuevo`
                : "Sin resultados"}
            </li>
          ) : null}
          {options.map((s) => (
            <li key={s.id} role="option" aria-selected={valueId === s.id}>
              <button
                type="button"
                className="w-full px-3 py-2 text-left text-sm font-semibold transition-colors"
                style={{
                  color: "var(--foreground)",
                  backgroundColor:
                    valueId === s.id
                      ? "color-mix(in srgb, var(--primary-600) 18%, var(--background))"
                      : "transparent",
                }}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(s)}
              >
                {s.name}
              </button>
            </li>
          ))}
          {allowCreate &&
          query.trim() &&
          !options.some(
            (s) => s.name.toLowerCase() === query.trim().toLowerCase()
          ) ? (
            <li role="option">
              <button
                type="button"
                className="w-full border-t px-3 py-2 text-left text-sm font-semibold"
                style={{
                  borderColor: "var(--primary-200)",
                  color: "var(--primary-600)",
                }}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onSelect(null);
                  onFreeText?.(query.trim());
                  setOpen(false);
                }}
              >
                Crear “{query.trim()}”
              </button>
            </li>
          ) : null}
        </ul>
      ) : null}
    </div>
  );
}
