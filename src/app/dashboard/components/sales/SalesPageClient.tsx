"use client";

import { useToast } from "@/components/ToastProvider";
import { getAuthUsername, removeToken } from "@/lib/auth-storage";
import { formatValorCOPTable } from "@/lib/money-format";
import {
  clampYmd,
  nonAdminDateBounds,
  todayYmdInTz,
  ymdBoundsForMonth,
} from "@/lib/payment-date-bounds";
import {
  apiErrorMessage,
  getSalesRange,
  inclusiveDayCount,
  MAX_SALES_RANGE_DAYS,
  sumBackendDayTotals,
  type DaySales,
  type SalesRange,
} from "@/lib/sales";
import { canAccessStats } from "@/lib/stats-access";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import DateFilterControls from "../payments/DateFilterControls";
import StoreBadges, { DROGUERIA_RICKY_ID } from "../payments/StoreBadges";
import DaySalesCard from "./DaySalesCard";
import SalesMonthCalendar from "./SalesMonthCalendar";
import SalesViewToggle, { type SalesAdminView } from "./SalesViewToggle";

const MONTH_NAMES_ES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
] as const;

function monthFromYmd(ymd: string): number {
  const m = Number(ymd.slice(5, 7));
  return m >= 1 && m <= 12 ? m : new Date().getMonth() + 1;
}

function yearFromYmd(ymd: string): number {
  const y = Number(ymd.slice(0, 4));
  return Number.isFinite(y) ? y : new Date().getFullYear();
}

export default function SalesPageClient() {
  const router = useRouter();
  const toast = useToast();

  const [sessionUser, setSessionUser] = useState<string | null | undefined>(
    undefined
  );
  const [drogueriaId, setDrogueriaId] = useState(DROGUERIA_RICKY_ID);
  const [specificDate, setSpecificDate] = useState(() => todayYmdInTz());
  const [selectedMonth, setSelectedMonth] = useState(() =>
    monthFromYmd(todayYmdInTz())
  );

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<SalesRange | null>(null);
  const [adminView, setAdminView] = useState<SalesAdminView>("calendario");

  const isAdmin =
    sessionUser !== undefined && canAccessStats(sessionUser);
  const restrictDates =
    sessionUser !== undefined && !canAccessStats(sessionUser);

  useEffect(() => {
    const user = getAuthUsername();
    if (canAccessStats(user)) {
      setSelectedMonth(monthFromYmd(todayYmdInTz()));
    } else if (user) {
      const { min, max } = nonAdminDateBounds();
      setSpecificDate((s) => clampYmd(s || max, min, max));
    }
    setSessionUser(user);
  }, []);

  const expireAuth = useCallback(() => {
    removeToken();
    toast.show("Sesión expirada. Inicia sesión de nuevo.", "error");
    router.replace("/login");
  }, [router, toast]);

  const load = useCallback(async () => {
    let from = specificDate;
    let to = specificDate;
    if (isAdmin) {
      const year = yearFromYmd(todayYmdInTz());
      const bounds = ymdBoundsForMonth(year, selectedMonth);
      from = bounds.from;
      to = bounds.to;
    }
    if (restrictDates) {
      const bounds = nonAdminDateBounds();
      from = clampYmd(from, bounds.min, bounds.max);
      to = clampYmd(to, bounds.min, bounds.max);
    }
    if (!from || !to) {
      setError("Elige una fecha válida.");
      setData(null);
      setLoading(false);
      return;
    }
    const span = inclusiveDayCount(from, to);
    if (span < 1) {
      setError("El rango de fechas no es válido.");
      setData(null);
      setLoading(false);
      return;
    }
    if (span > MAX_SALES_RANGE_DAYS) {
      setError(
        "El rango no puede superar " + MAX_SALES_RANGE_DAYS + " días."
      );
      setData(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await getSalesRange({
        drogueria_id: drogueriaId,
        date_from: from,
        date_to: to,
      });
      if (!res.ok) {
        if (res.status === 401) {
          expireAuth();
          return;
        }
        setError(
          apiErrorMessage(
            res.body,
            res.status === 404
              ? "Droguería no encontrada."
              : "No se pudieron cargar las ventas."
          )
        );
        setData(null);
        return;
      }
      setData(res.data);
    } catch {
      setError("Error de red al cargar ventas.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [
    drogueriaId,
    expireAuth,
    isAdmin,
    restrictDates,
    selectedMonth,
    specificDate,
  ]);

  useEffect(() => {
    if (sessionUser === undefined) return;
    void load();
  }, [load, sessionUser]);

  const handleDaySaved = (day: DaySales) => {
    setData((prev) => {
      if (!prev) return prev;
      const days = prev.days.map((d) => (d.date === day.date ? day : d));
      return {
        ...prev,
        days,
        range_total: sumBackendDayTotals(days),
      };
    });
  };

  const onShiftError = useCallback(
    (msg: string) => {
      toast.show(msg, "error");
    },
    [toast]
  );

  const rangeLabel = useMemo(() => {
    if (!data) return "";
    if (data.date_from === data.date_to) return data.date_from;
    return data.date_from + " a " + data.date_to;
  }, [data]);

  const shiftWord = data && data.shift_count === 1 ? "turno" : "turnos";

  return (
    <section aria-label="Ventas por turnos" className="w-full max-w-5xl pb-8">
      <h1
        className="text-2xl font-bold"
        style={{ color: "var(--primary-800)" }}
      >
        Ventas
      </h1>
      <p className="mt-1 text-sm" style={{ color: "var(--primary-700)" }}>
        Un eslabón por día. Al salir del campo se guarda ese turno.
      </p>

      <div className="mt-6 w-full max-w-4xl">
        <StoreBadges
          drogueriaId={drogueriaId}
          onDrogueriaChange={setDrogueriaId}
        />
      </div>

      <div className="mt-6 flex w-full max-w-4xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1">
          {sessionUser !== undefined ? (
            isAdmin ? (
              <label
                className="inline-flex items-center gap-2 text-sm font-semibold"
                style={{ color: "var(--primary-800)" }}
              >
                Mes
                <select
                  value={selectedMonth}
                  disabled={loading}
                  onChange={(e) => setSelectedMonth(Number(e.target.value))}
                  className="h-9 min-w-[7.5rem] cursor-pointer rounded-lg border-2 px-2 text-sm font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[color:var(--primary-400)] disabled:cursor-not-allowed disabled:opacity-60"
                  style={{
                    borderColor: "var(--primary-400)",
                    color: "var(--foreground)",
                    backgroundColor:
                      "color-mix(in srgb, var(--primary-600) 14%, var(--background))",
                  }}
                >
                  {MONTH_NAMES_ES.map((name, i) => (
                    <option key={name} value={i + 1}>
                      {name}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <DateFilterControls
                mode="especifica"
                onModeChange={() => {}}
                specificDate={specificDate}
                onSpecificDateChange={(v) => {
                  const { min, max } = nonAdminDateBounds();
                  setSpecificDate(clampYmd(v, min, max));
                }}
                rangeFrom={specificDate}
                rangeTo={specificDate}
                onRangeFromChange={() => {}}
                onRangeToChange={() => {}}
                disabled={loading}
                fullDateAccess={false}
                dateBounds={nonAdminDateBounds()}
              />
            )
          ) : null}
        </div>
        <button
          type="button"
          disabled={loading}
          onClick={() => void load()}
          className="h-10 shrink-0 rounded-xl px-4 text-sm font-semibold text-white disabled:opacity-60"
          style={{ backgroundColor: "var(--primary-600)" }}
        >
          {loading ? "Cargando..." : "Actualizar"}
        </button>
      </div>

      {error ? (
        <div
          className="mt-6 rounded-xl border px-4 py-3 text-sm font-medium"
          style={{
            borderColor: "color-mix(in srgb, #f87171 45%, var(--primary-200))",
            backgroundColor: "color-mix(in srgb, #ef4444 14%, var(--background))",
            color: "var(--foreground)",
          }}
        >
          {error}
        </div>
      ) : null}

      {!error && data ? (
        <div className="mt-6 flex flex-col gap-4">
          {isAdmin ? (
            <SalesViewToggle
              view={adminView}
              onViewChange={setAdminView}
              disabled={loading}
            />
          ) : null}

          <div
            className="rounded-xl border px-4 py-3 text-sm font-semibold"
            style={{
              borderColor: "var(--primary-200)",
              backgroundColor:
                "color-mix(in srgb, var(--primary-600) 12%, var(--background))",
              color: "var(--foreground)",
            }}
          >
            {"Total ("}
            {rangeLabel}
            {"): "}
            <span style={{ color: "var(--primary-600)" }}>
              {formatValorCOPTable(data.range_total)}
            </span>
            <span
              className="ml-2 font-medium"
              style={{ color: "var(--primary-700)" }}
            >
              {" | "}
              {data.shift_count} {shiftWord}
            </span>
          </div>

          {isAdmin && adminView === "calendario" ? (
            <SalesMonthCalendar
              days={data.days}
              dateFrom={data.date_from}
              dateTo={data.date_to}
            />
          ) : null}

          {!isAdmin || adminView === "registro" ? (
            <ol className="flex flex-col gap-4">
              {data.days.map((day) => (
                <li key={day.date}>
                  <DaySalesCard
                    drogueriaId={data.drogueria_id}
                    day={day}
                    disabled={loading}
                    onSaved={handleDaySaved}
                    onAuthExpired={expireAuth}
                    onError={onShiftError}
                  />
                </li>
              ))}
            </ol>
          ) : null}
        </div>
      ) : null}

      {!error && !data && loading ? (
        <p
          className="mt-8 text-sm font-medium"
          style={{ color: "var(--primary-700)" }}
        >
          Cargando ventas...
        </p>
      ) : null}
    </section>
  );
}
