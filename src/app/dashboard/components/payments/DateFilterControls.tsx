"use client";

export type PaymentDateMode = "especifica" | "rango";

const modes: { id: PaymentDateMode; label: string }[] = [
  { id: "especifica", label: "Fecha específica" },
  { id: "rango", label: "Rango de fechas" },
];

const inputClass =
  "h-10 rounded-xl border-2 px-3 text-sm font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[color:var(--primary-400)] disabled:opacity-60";

type Props = {
  mode: PaymentDateMode;
  onModeChange: (mode: PaymentDateMode) => void;
  specificDate: string;
  onSpecificDateChange: (value: string) => void;
  rangeFrom: string;
  rangeTo: string;
  onRangeFromChange: (value: string) => void;
  onRangeToChange: (value: string) => void;
  disabled?: boolean;
  /** false = solo día concreto, sin rango; fechas acotadas por min/max (usuario no admin). */
  fullDateAccess?: boolean;
  dateBounds?: { min: string; max: string };
  /** Texto junto al filtro cuando fullDateAccess es false. */
  restrictedHint?: string;
};

export default function DateFilterControls({
  mode,
  onModeChange,
  specificDate,
  onSpecificDateChange,
  rangeFrom,
  rangeTo,
  onRangeFromChange,
  onRangeToChange,
  disabled,
  fullDateAccess = true,
  dateBounds,
  restrictedHint = "Solo hoy y 3 días atrás",
}: Props) {
  const bound =
    !fullDateAccess && dateBounds
      ? { min: dateBounds.min, max: dateBounds.max }
      : undefined;

  const modeList = fullDateAccess ? modes : modes.filter((m) => m.id === "especifica");

  return (
    <div className="flex w-full flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className="text-sm font-semibold shrink-0"
          style={{ color: "var(--primary-800)" }}
        >
          Fecha:
        </span>
        {fullDateAccess ? (
          <div
            className="inline-flex flex-wrap overflow-hidden rounded-xl border"
            style={{
              borderColor: "var(--primary-200)",
              backgroundColor: "var(--primary-50)",
            }}
          >
            {modeList.map((m, idx) => {
              const active = mode === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => onModeChange(m.id)}
                  className="px-3 py-2 text-xs font-semibold transition-colors sm:text-sm sm:px-4"
                  style={{
                    borderLeft:
                      idx === 0
                        ? "none"
                        : "1px solid var(--primary-200)",
                    backgroundColor: active
                      ? "var(--primary-600)"
                      : "transparent",
                    color: active ? "white" : "var(--primary-700)",
                  }}
                >
                  {m.label}
                </button>
              );
            })}
          </div>
        ) : (
          <span
            className="text-xs font-semibold"
            style={{ color: "var(--primary-700)" }}
          >
            {restrictedHint}
          </span>
        )}
      </div>

      {mode === "especifica" ? (
        <label className="flex flex-wrap items-center gap-2">
          <span
            className="text-sm font-semibold"
            style={{ color: "var(--primary-700)" }}
          >
            Día
          </span>
          <input
            type="date"
            value={specificDate}
            min={bound?.min}
            max={bound?.max}
            disabled={disabled}
            onChange={(e) => onSpecificDateChange(e.target.value)}
            className={inputClass}
            style={{
              borderColor: "var(--primary-400)",
              backgroundColor:
                "color-mix(in srgb, var(--primary-600) 12%, var(--background))",
              color: "var(--foreground)",
            }}
          />
        </label>
      ) : null}

      {mode === "rango" && fullDateAccess ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <label className="flex flex-wrap items-center gap-2">
            <span
              className="text-sm font-semibold"
              style={{ color: "var(--primary-700)" }}
            >
              Desde
            </span>
            <input
              type="date"
              value={rangeFrom}
              disabled={disabled}
              onChange={(e) => onRangeFromChange(e.target.value)}
              className={inputClass}
              style={{
                borderColor: "var(--primary-400)",
                backgroundColor:
                  "color-mix(in srgb, var(--primary-600) 12%, var(--background))",
                color: "var(--foreground)",
              }}
            />
          </label>
          <label className="flex flex-wrap items-center gap-2">
            <span
              className="text-sm font-semibold"
              style={{ color: "var(--primary-700)" }}
            >
              Hasta
            </span>
            <input
              type="date"
              value={rangeTo}
              disabled={disabled}
              onChange={(e) => onRangeToChange(e.target.value)}
              className={inputClass}
              style={{
                borderColor: "var(--primary-400)",
                backgroundColor:
                  "color-mix(in srgb, var(--primary-600) 12%, var(--background))",
                color: "var(--foreground)",
              }}
            />
          </label>
        </div>
      ) : null}
    </div>
  );
}
