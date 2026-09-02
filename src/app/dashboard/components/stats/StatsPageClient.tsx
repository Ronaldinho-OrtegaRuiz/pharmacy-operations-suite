"use client";

import { useToast } from "@/components/ToastProvider";
import { removeToken } from "@/lib/auth-storage";
import { formatValorCOPTable, parseMoneyFromApi } from "@/lib/money-format";
import { todayYmdInTz } from "@/lib/payment-date-bounds";
import { detailFromBody } from "@/lib/payments";
import {
  getStats,
  type ExtremeDay,
  type ExtremeMonth,
  type StatsResponse,
} from "@/lib/stats";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import StoreBadges, { DROGUERIA_RICKY_ID } from "../payments/StoreBadges";
import StatsInvoicesSection from "./StatsInvoicesSection";
import { PaymentsLineChart, StackedShiftBarChart, ValueBarChart } from "./StatsCharts";

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

type StatsMetric = "qr" | "sales" | "invoices";
type StatsPeriod = "month" | "year";

const selectClass =
  "h-9 min-w-[7.5rem] cursor-pointer rounded-lg border-2 px-2 text-sm font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[color:var(--primary-400)] disabled:cursor-not-allowed disabled:opacity-60";

const selectStyle = {
  borderColor: "var(--primary-400)",
  color: "var(--foreground)",
  backgroundColor: "color-mix(in srgb, var(--primary-600) 14%, var(--background))",
} as const;

function moneyFromApi(raw: string | null | undefined): string {
  if (raw == null || raw === "") return "—";
  return formatValorCOPTable(raw);
}

function moneyNum(n: number): string {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(n);
}

function numFromApi(raw: string): number {
  const n = parseMoneyFromApi(raw);
  return Number.isFinite(n) ? n : 0;
}

function formatShare(raw: string | null): string {
  if (raw == null || raw === "") return "—";
  const n = Number.parseFloat(raw);
  if (!Number.isFinite(n)) return "—";
  const pct = Math.abs(n) <= 1 ? n * 100 : n;
  return `${pct.toLocaleString("es-CO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}%`;
}

function formatPct(raw: string | null | undefined): string {
  if (raw == null || raw === "") return "—";
  const n = Number.parseFloat(raw);
  if (!Number.isFinite(n)) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toLocaleString("es-CO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}%`;
}

function formatYmdDisplay(ymd: string): string {
  const m = ymd.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return ymd;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

function formatExtremeDay(day: ExtremeDay): string {
  if (!day) return "—";
  return `${formatYmdDisplay(day.date)} (${moneyFromApi(day.value)})`;
}

function formatExtremeMonth(ex: ExtremeMonth): string {
  if (!ex) return "—";
  const name = MONTH_NAMES_ES[ex.month - 1] ?? `Mes ${ex.month}`;
  return `${name} (${moneyFromApi(ex.value)})`;
}

function KpiChip({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div
      className="rounded-xl border px-3 py-2 text-sm font-semibold"
      style={{
        borderColor: "var(--primary-200)",
        backgroundColor:
          "color-mix(in srgb, var(--primary-600) 12%, var(--background))",
        color: "var(--foreground)",
      }}
    >
      {label}{" "}
      <span style={{ color: "var(--primary-600)" }}>{value}</span>
    </div>
  );
}

function SegmentToggle<T extends string>({
  label,
  value,
  options,
  disabled,
  onChange,
  ariaLabel,
}: {
  label: string;
  value: T;
  options: { id: T; label: string }[];
  disabled?: boolean;
  onChange: (v: T) => void;
  ariaLabel: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span
        className="shrink-0 text-sm font-semibold"
        style={{ color: "var(--primary-800)" }}
      >
        {label}
      </span>
      <div
        className="inline-flex overflow-hidden rounded-xl border"
        style={{
          borderColor: "var(--primary-200)",
          backgroundColor: "var(--primary-50)",
        }}
        role="group"
        aria-label={ariaLabel}
      >
        {options.map((opt, idx) => {
          const active = value === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              disabled={disabled}
              onClick={() => onChange(opt.id)}
              aria-pressed={active}
              className="px-3 py-2 text-xs font-semibold transition-colors sm:px-4 sm:text-sm disabled:opacity-60"
              style={{
                borderLeft: idx === 0 ? "none" : "1px solid var(--primary-200)",
                backgroundColor: active ? "var(--primary-600)" : "transparent",
                color: active ? "white" : "var(--primary-700)",
              }}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ChartCard({
  title,
  hint,
  kpis,
  children,
}: {
  title: string;
  hint: string;
  kpis: ReactNode;
  children: ReactNode;
}) {
  return (
    <article
      className="w-full rounded-2xl border p-5 shadow-sm"
      style={{
        borderColor: "var(--primary-200)",
        backgroundColor:
          "color-mix(in srgb, var(--primary-600) 8%, var(--background))",
      }}
    >
      <h2 className="text-lg font-bold" style={{ color: "var(--primary-700)" }}>
        {title}
      </h2>
      <div className="mt-3 flex flex-wrap gap-3">{kpis}</div>
      <p className="mt-2 text-xs" style={{ color: "var(--primary-700)" }}>
        {hint}
      </p>
      <div
        className="mt-4 rounded-xl border p-3"
        style={{
          borderColor: "var(--primary-200)",
          backgroundColor:
            "color-mix(in srgb, var(--primary-600) 10%, var(--background))",
        }}
      >
        {children}
      </div>
    </article>
  );
}

export default function StatsPageClient() {
  const router = useRouter();
  const toast = useToast();

  const today = todayYmdInTz();
  const currentYear = Number(today.slice(0, 4));
  const currentMonth = Number(today.slice(5, 7));

  const [metric, setMetric] = useState<StatsMetric>("qr");
  const [period, setPeriod] = useState<StatsPeriod>("month");
  const [month, setMonth] = useState(currentMonth);
  const [year, setYear] = useState(currentYear);
  const [drogueriaId, setDrogueriaId] = useState(DROGUERIA_RICKY_ID);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<StatsResponse | null>(null);

  const yearOptions = useMemo(() => {
    const years: number[] = [];
    for (let y = currentYear; y >= currentYear - 4; y -= 1) years.push(y);
    return years;
  }, [currentYear]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getStats({
        drogueria_id: drogueriaId,
        period,
        year,
        month: period === "month" ? month : undefined,
      });
      if (!res.ok) {
        if (res.status === 401) {
          removeToken();
          toast.show("Sesión expirada. Inicia sesión de nuevo.", "error");
          router.replace("/login");
          return;
        }
        const msg =
          detailFromBody(res.body) ??
          (res.status === 404
            ? "Droguería no encontrada."
            : "No se pudieron cargar las estadísticas.");
        setError(msg);
        setData(null);
        return;
      }
      setData(res.data);
    } catch {
      setError("Error de red al cargar estadísticas.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [drogueriaId, month, period, router, toast, year]);

  useEffect(() => {
    void load();
  }, [load]);

  const periodTitle = useMemo(() => {
    if (!data) return "";
    if (data.period === "month") {
      const name = MONTH_NAMES_ES[data.month - 1] ?? `Mes ${data.month}`;
      return `${name} ${data.year}`;
    }
    return `Año ${data.year}`;
  }, [data]);

  const monthLabelsShort = MONTH_NAMES_ES.map((n) => n.slice(0, 3));

  return (
    <section aria-label="Estadísticas QR, ventas y facturas" className="w-full max-w-5xl pb-8">
      <h1
        className="text-2xl font-bold"
        style={{ color: "var(--primary-800)" }}
      >
        Estadísticas
      </h1>
      <p className="mt-1 text-sm" style={{ color: "var(--primary-700)" }}>
        Pagos QR, ventas de caja y facturas por mes o año.
      </p>

      <div className="mt-6 w-full max-w-4xl">
        <StoreBadges
          drogueriaId={drogueriaId}
          onDrogueriaChange={setDrogueriaId}
        />
      </div>

      <div className="mt-6 flex w-full max-w-4xl flex-col gap-4">
        <SegmentToggle
          label="Datos:"
          ariaLabel="Tipo de estadística"
          value={metric}
          disabled={loading}
          onChange={setMetric}
          options={[
            { id: "qr", label: "Pagos QR" },
            { id: "sales", label: "Ventas" },
            { id: "invoices", label: "Facturas" },
          ]}
        />
        <SegmentToggle
          label="Período:"
          ariaLabel="Período de estadísticas"
          value={period}
          disabled={loading}
          onChange={setPeriod}
          options={[
            { id: "month", label: "Mes" },
            { id: "year", label: "Año" },
          ]}
        />

        <div className="flex flex-wrap items-center gap-3">
          {period === "month" ? (
            <label
              className="inline-flex items-center gap-2 text-sm font-semibold"
              style={{ color: "var(--primary-800)" }}
            >
              Mes
              <select
                value={month}
                disabled={loading}
                onChange={(e) => setMonth(Number(e.target.value))}
                className={selectClass}
                style={selectStyle}
              >
                {MONTH_NAMES_ES.map((name, i) => (
                  <option key={name} value={i + 1}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <label
            className="inline-flex items-center gap-2 text-sm font-semibold"
            style={{ color: "var(--primary-800)" }}
          >
            Año
            <select
              value={year}
              disabled={loading}
              onChange={(e) => setYear(Number(e.target.value))}
              className={selectClass}
              style={selectStyle}
            >
              {yearOptions.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            disabled={loading}
            onClick={() => void load()}
            className="h-9 rounded-xl px-4 text-sm font-semibold text-white disabled:opacity-60"
            style={{ backgroundColor: "var(--primary-600)" }}
          >
            {loading ? "Cargando…" : "Actualizar"}
          </button>
        </div>
      </div>

      {error ? (
        <div
          className="mt-6 rounded-xl border px-4 py-3 text-sm font-medium"
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

      {!error && data ? (
        <div className="mt-8 flex flex-col gap-10">
          {metric === "qr" && data.period === "month" ? (
            <>
              <ChartCard
                title={`${periodTitle} — Pagos QR por día`}
                hint="Pasa el mouse por un punto: cantidad de pagos QR ese día."
                kpis={
                  <>
                    <KpiChip
                      label="Total pagos:"
                      value={data.qr.kpis.payments_count}
                    />
                    <KpiChip
                      label="Total valor:"
                      value={moneyFromApi(data.qr.kpis.total_value)}
                    />
                    <KpiChip
                      label={`Prom. pagos / día (${data.divisor_days}):`}
                      value={data.qr.kpis.avg_payments_per_day}
                    />
                    <KpiChip
                      label="vs período anterior (pagos):"
                      value={formatPct(data.qr.kpis.vs_previous.payments_pct)}
                    />
                    <KpiChip
                      label="Clientes únicos:"
                      value={data.qr.kpis.unique_clients}
                    />
                  </>
                }
              >
                <PaymentsLineChart
                  labels={data.qr.series.map((d) => d.date)}
                  counts={data.qr.series.map((d) => d.count)}
                  axisLabel="Día del mes"
                  formatPoint={(label, count) =>
                    `${formatYmdDisplay(label)}: ${count} pago(s)`
                  }
                />
              </ChartCard>

              <ChartCard
                title={`${periodTitle} — Valor QR por día`}
                hint="Pasa el mouse sobre una barra: total del día."
                kpis={
                  <>
                    <KpiChip
                      label="Día menor:"
                      value={formatExtremeDay(data.qr.kpis.min_day)}
                    />
                    <KpiChip
                      label="Día mayor:"
                      value={formatExtremeDay(data.qr.kpis.max_day)}
                    />
                    <KpiChip
                      label={`Prom. valor / día (${data.divisor_days}):`}
                      value={moneyFromApi(data.qr.kpis.avg_value_per_day)}
                    />
                    <KpiChip
                      label="Prom. / pago:"
                      value={moneyFromApi(data.qr.kpis.avg_value_per_payment)}
                    />
                    <KpiChip
                      label="vs período anterior (valor):"
                      value={formatPct(data.qr.kpis.vs_previous.value_pct)}
                    />
                    <KpiChip
                      label="Días con ventas / vacíos:"
                      value={`${data.qr.kpis.days_with_sales} / ${data.qr.kpis.days_empty}`}
                    />
                  </>
                }
              >
                <ValueBarChart
                  labels={data.qr.series.map((d) => d.date)}
                  values={data.qr.series.map((d) => numFromApi(d.value))}
                  axisLabel="Día del mes"
                  formatPoint={(label, value) =>
                    `${formatYmdDisplay(label)}: ${moneyNum(value)}`
                  }
                />
              </ChartCard>
            </>
          ) : null}

          {metric === "qr" && data.period === "year" ? (
            <>
              <ChartCard
                title={`${periodTitle} — Pagos QR por mes`}
                hint="Pasa el mouse por un punto: cantidad de pagos QR ese mes."
                kpis={
                  <>
                    <KpiChip
                      label="Total pagos:"
                      value={data.qr.kpis.payments_count}
                    />
                    <KpiChip
                      label="Total valor:"
                      value={moneyFromApi(data.qr.kpis.total_value)}
                    />
                    <KpiChip
                      label={`Prom. pagos / mes (${data.divisor_months}):`}
                      value={data.qr.kpis.avg_payments_per_month}
                    />
                    <KpiChip
                      label="vs año anterior (pagos):"
                      value={formatPct(data.qr.kpis.vs_previous.payments_pct)}
                    />
                    <KpiChip
                      label="Clientes únicos:"
                      value={data.qr.kpis.unique_clients}
                    />
                  </>
                }
              >
                <PaymentsLineChart
                  labels={data.qr.series.map(
                    (d) => monthLabelsShort[d.month - 1] ?? String(d.month)
                  )}
                  counts={data.qr.series.map((d) => d.count)}
                  axisLabel="Mes"
                  formatPoint={(label, count) => `${label}: ${count} pago(s)`}
                />
              </ChartCard>

              <ChartCard
                title={`${periodTitle} — Valor QR por mes`}
                hint="Pasa el mouse sobre una barra: total del mes."
                kpis={
                  <>
                    <KpiChip
                      label="Mejor mes:"
                      value={formatExtremeMonth(data.qr.kpis.best_month)}
                    />
                    <KpiChip
                      label="Peor mes:"
                      value={formatExtremeMonth(data.qr.kpis.worst_month)}
                    />
                    <KpiChip
                      label={`Prom. valor / mes (${data.divisor_months}):`}
                      value={moneyFromApi(data.qr.kpis.avg_value_per_month)}
                    />
                    <KpiChip
                      label="Prom. / pago:"
                      value={moneyFromApi(data.qr.kpis.avg_value_per_payment)}
                    />
                    <KpiChip
                      label="vs año anterior (valor):"
                      value={formatPct(data.qr.kpis.vs_previous.value_pct)}
                    />
                  </>
                }
              >
                <ValueBarChart
                  labels={data.qr.series.map(
                    (d) => monthLabelsShort[d.month - 1] ?? String(d.month)
                  )}
                  values={data.qr.series.map((d) => numFromApi(d.value))}
                  axisLabel="Mes"
                  formatPoint={(label, value) => `${label}: ${moneyNum(value)}`}
                />
              </ChartCard>
            </>
          ) : null}

          {metric === "sales" && data.period === "month" ? (
            <ChartCard
              title={`${periodTitle} — Ventas (caja) por día`}
              hint="Cada barra se divide por turnos. Pasa el mouse por un bloque: valor de ese turno y total del día."
              kpis={
                <>
                  <KpiChip
                    label="Total caja:"
                    value={moneyFromApi(data.sales.kpis.total_value)}
                  />
                  <KpiChip
                    label={`Prom. / día (${data.divisor_days}):`}
                    value={moneyFromApi(data.sales.kpis.avg_value_per_day)}
                  />
                  <KpiChip
                    label="Día menor:"
                    value={formatExtremeDay(data.sales.kpis.min_day)}
                  />
                  <KpiChip
                    label="Día mayor:"
                    value={formatExtremeDay(data.sales.kpis.max_day)}
                  />
                  <KpiChip
                    label="Días llenos / vacíos:"
                    value={`${data.sales.kpis.days_filled} / ${data.sales.kpis.days_empty}`}
                  />
                  <KpiChip
                    label="vs período anterior:"
                    value={formatPct(data.sales.kpis.vs_previous.value_pct)}
                  />
                  <KpiChip
                    label="Mejor turno:"
                    value={
                      data.sales.kpis.best_shift
                        ? `T${data.sales.kpis.best_shift.shift_no} (${moneyFromApi(data.sales.kpis.best_shift.value)})`
                        : "—"
                    }
                  />
                  <KpiChip
                    label="Peor turno:"
                    value={
                      data.sales.kpis.worst_shift
                        ? `T${data.sales.kpis.worst_shift.shift_no} (${moneyFromApi(data.sales.kpis.worst_shift.value)})`
                        : "—"
                    }
                  />
                  {data.sales.kpis.by_shift.map((s) => (
                    <KpiChip
                      key={s.shift_no}
                      label={`Turno ${s.shift_no}:`}
                      value={`${moneyFromApi(s.total)}${
                        s.avg != null ? ` · prom. ${moneyFromApi(s.avg)}` : ""
                      }${
                        s.best_day
                          ? ` · mejor ${formatExtremeDay(s.best_day)}`
                          : ""
                      }`}
                    />
                  ))}
                </>
              }
            >
              <StackedShiftBarChart
                shiftCount={data.shift_count}
                formatDayLabel={formatYmdDisplay}
                formatMoney={moneyNum}
                days={data.sales.series.map((d) => ({
                  label: d.date,
                  total: numFromApi(d.total),
                  shifts: Array.from({ length: data.shift_count }, (_, i) => {
                    const shiftNo = i + 1;
                    const sh = d.shifts.find((s) => s.shift_no === shiftNo);
                    return {
                      shift_no: shiftNo,
                      amount:
                        sh?.amount != null ? numFromApi(sh.amount) : null,
                    };
                  }),
                }))}
              />
            </ChartCard>
          ) : null}

          {metric === "sales" && data.period === "year" ? (
            <ChartCard
              title={`${periodTitle} — Ventas (caja) por mes`}
              hint="Las barras muestran el total del mes. El detalle por turno está en las tarjetas."
              kpis={
                <>
                  <KpiChip
                    label="Total caja:"
                    value={moneyFromApi(data.sales.kpis.total_value)}
                  />
                  <KpiChip
                    label={`Prom. / mes (${data.divisor_months}):`}
                    value={moneyFromApi(data.sales.kpis.avg_value_per_month)}
                  />
                  <KpiChip
                    label="Mejor mes:"
                    value={formatExtremeMonth(data.sales.kpis.best_month)}
                  />
                  <KpiChip
                    label="Peor mes:"
                    value={formatExtremeMonth(data.sales.kpis.worst_month)}
                  />
                  <KpiChip
                    label="vs año anterior:"
                    value={formatPct(data.sales.kpis.vs_previous.value_pct)}
                  />
                  <KpiChip
                    label="Mejor turno:"
                    value={
                      data.sales.kpis.best_shift
                        ? `T${data.sales.kpis.best_shift.shift_no} (${moneyFromApi(data.sales.kpis.best_shift.value)})`
                        : "—"
                    }
                  />
                  <KpiChip
                    label="Peor turno:"
                    value={
                      data.sales.kpis.worst_shift
                        ? `T${data.sales.kpis.worst_shift.shift_no} (${moneyFromApi(data.sales.kpis.worst_shift.value)})`
                        : "—"
                    }
                  />
                  {data.sales.kpis.by_shift.map((s) => (
                    <KpiChip
                      key={s.shift_no}
                      label={`Turno ${s.shift_no}:`}
                      value={`${moneyFromApi(s.total)}${
                        s.best_month
                          ? ` · mejor ${formatExtremeMonth(s.best_month)}`
                          : ""
                      }`}
                    />
                  ))}
                </>
              }
            >
              <ValueBarChart
                labels={data.sales.series.map(
                  (d) => monthLabelsShort[d.month - 1] ?? String(d.month)
                )}
                values={data.sales.series.map((d) => numFromApi(d.value))}
                axisLabel="Mes"
                ariaLabel="Gráfica de ventas de caja por mes"
                formatPoint={(label, value) => `${label}: ${moneyNum(value)}`}
              />
            </ChartCard>
          ) : null}

          {metric === "invoices" ? (
            <StatsInvoicesSection periodTitle={periodTitle} data={data} />
          ) : null}

          <article
            className="w-full rounded-2xl border p-5 shadow-sm"
            style={{
              borderColor: "var(--primary-200)",
              backgroundColor:
                "color-mix(in srgb, var(--primary-600) 8%, var(--background))",
            }}
          >
            <h2
              className="text-lg font-bold"
              style={{ color: "var(--primary-700)" }}
            >
              {periodTitle} — QR vs caja
            </h2>
            <div className="mt-3 flex flex-wrap gap-3">
              <KpiChip
                label="Total QR:"
                value={moneyFromApi(data.compare.qr_total)}
              />
              <KpiChip
                label="Total caja:"
                value={moneyFromApi(data.compare.sales_total)}
              />
              <KpiChip
                label="Delta (caja − QR):"
                value={moneyFromApi(data.compare.delta)}
              />
              <KpiChip
                label="Participación QR / caja:"
                value={formatShare(data.compare.qr_share)}
              />
              {data.compare.invoices_issued != null ? (
                <KpiChip
                  label="Facturas emitidas (período):"
                  value={moneyFromApi(data.compare.invoices_issued)}
                />
              ) : null}
              {data.compare.invoices_open_now != null ? (
                <KpiChip
                  label="Por pagar hoy:"
                  value={moneyFromApi(data.compare.invoices_open_now)}
                />
              ) : null}
            </div>
          </article>
        </div>
      ) : null}

      {!error && !data && loading ? (
        <p
          className="mt-8 text-sm font-medium"
          style={{ color: "var(--primary-700)" }}
        >
          Cargando estadísticas…
        </p>
      ) : null}
    </section>
  );
}
