"use client";

import { formatValorCOPTable, parseMoneyFromApi } from "@/lib/money-format";
import { cajaShiftHourLabel } from "@/lib/caja-shift-hours";
import {
  amountToApiString,
  apiErrorMessage,
  putShiftSale,
  type DaySales,
} from "@/lib/sales";
import { useEffect, useState } from "react";

const inputClass =
  "h-10 w-full min-w-0 rounded-xl border-2 px-3 text-sm font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[color:var(--primary-400)] disabled:opacity-60";

/** Solo dígitos; sin puntos, comas ni otros caracteres. */
function sanitizeAmountInput(raw: string): string {
  return raw.replace(/\D/g, "");
}

function displayAmount(amount: string | null): string {
  if (amount == null || amount.trim() === "") return "";
  const n = parseMoneyFromApi(amount);
  if (!Number.isFinite(n)) return "";
  // Sin separadores de miles: el usuario escribe 150000, no 150.000
  if (Number.isInteger(n)) return String(n);
  return String(n);
}

function formatDayHeading(ymd: string): string {
  const [y, m, d] = ymd.split("-").map((x) => Number.parseInt(x, 10));
  if (!y || !m || !d) return ymd;
  const dt = new Date(Date.UTC(y, m - 1, d));
  const weekday = new Intl.DateTimeFormat("es-CO", {
    weekday: "long",
    timeZone: "UTC",
  }).format(dt);
  const cap = weekday.charAt(0).toUpperCase() + weekday.slice(1);
  return `${cap} ${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y}`;
}

type Props = {
  drogueriaId: number;
  day: DaySales;
  disabled?: boolean;
  onSaved: (day: DaySales) => void;
  onAuthExpired: () => void;
  onError: (message: string) => void;
};

export default function DaySalesCard({
  drogueriaId,
  day,
  disabled,
  onSaved,
  onAuthExpired,
  onError,
}: Props) {
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [savingShift, setSavingShift] = useState<number | null>(null);

  useEffect(() => {
    const next: Record<number, string> = {};
    for (const s of day.shifts) {
      next[s.shift_no] = displayAmount(s.amount);
    }
    setDrafts(next);
  }, [day]);

  const saveShift = async (shiftNo: number) => {
    const saved = day.shifts.find((s) => s.shift_no === shiftNo);
    const typed = (drafts[shiftNo] ?? "").trim();
    if (!typed) {
      setDrafts((prev) => ({
        ...prev,
        [shiftNo]: displayAmount(saved?.amount ?? null),
      }));
      return;
    }
    const n = parseMoneyFromApi(typed.replace(/\$/g, ""));
    if (!Number.isFinite(n) || n < 0) {
      onError("El valor del turno debe ser un número mayor o igual a 0.");
      setDrafts((prev) => ({
        ...prev,
        [shiftNo]: displayAmount(saved?.amount ?? null),
      }));
      return;
    }
    const nextAmount = amountToApiString(n);
    const prevAmount = saved?.amount;
    if (prevAmount != null && parseMoneyFromApi(prevAmount) === n) {
      setDrafts((prev) => ({ ...prev, [shiftNo]: displayAmount(prevAmount) }));
      return;
    }

    setSavingShift(shiftNo);
    try {
      const res = await putShiftSale({
        drogueria_id: drogueriaId,
        sale_date: day.date,
        shift_no: shiftNo,
        amount: nextAmount,
      });
      if (!res.ok) {
        if (res.status === 401) {
          onAuthExpired();
          return;
        }
        onError(
          apiErrorMessage(res.body, "No se pudo guardar el turno.")
        );
        return;
      }
      onSaved(res.data);
    } catch {
      onError("Error de red al guardar el turno.");
    } finally {
      setSavingShift(null);
    }
  };

  return (
    <article
      className="relative rounded-2xl border p-4 shadow-sm"
      style={{
        borderColor: "var(--primary-200)",
        backgroundColor:
          "color-mix(in srgb, var(--primary-600) 8%, var(--background))",
      }}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2
          className="text-base font-bold"
          style={{ color: "var(--primary-700)" }}
        >
          {formatDayHeading(day.date)}
        </h2>
        <p
          className="text-sm font-semibold"
          style={{ color: "var(--foreground)" }}
        >
          Total día:{" "}
          <span style={{ color: "var(--primary-600)" }}>
            {formatValorCOPTable(day.total)}
          </span>
        </p>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {day.shifts.map((s) => {
          const busy = savingShift === s.shift_no || disabled;
          const hours = cajaShiftHourLabel(drogueriaId, s.shift_no);
          return (
            <label
              key={s.shift_no}
              className="flex flex-col gap-1 text-sm font-semibold"
              style={{ color: "var(--primary-800)" }}
            >
              <span>
                Turno {s.shift_no}
                {hours ? (
                  <span
                    className="ml-1 text-xs font-medium opacity-80"
                    style={{ color: "var(--primary-700)" }}
                  >
                    · {hours}
                  </span>
                ) : null}
              </span>
              <input
                type="text"
                inputMode="numeric"
                placeholder="Ej. 150000"
                value={drafts[s.shift_no] ?? ""}
                disabled={busy}
                onChange={(e) =>
                  setDrafts((prev) => ({
                    ...prev,
                    [s.shift_no]: sanitizeAmountInput(e.target.value),
                  }))
                }
                onBlur={() => void saveShift(s.shift_no)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    (e.target as HTMLInputElement).blur();
                  }
                }}
                className={inputClass}
                style={{
                  borderColor: "var(--primary-400)",
                  backgroundColor:
                    "color-mix(in srgb, var(--primary-600) 12%, var(--background))",
                  color: "var(--foreground)",
                }}
                aria-label={`Turno ${s.shift_no} del ${day.date}`}
              />
            </label>
          );
        })}
      </div>
    </article>
  );
}
