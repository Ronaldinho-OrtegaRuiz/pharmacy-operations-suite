"use client";

import { formatValorCOPTable, parseMoneyFromApi } from "@/lib/money-format";
import type { ExtremeDay, ExtremeMonth, NequiStatsResponse } from "@/lib/stats";
import type { ReactNode } from "react";
import { PaymentsLineChart, ValueBarChart } from "./StatsCharts";

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

function formatExtremeDay(ex: ExtremeDay): string {
  if (!ex) return "—";
  return `${formatYmdDisplay(ex.date)} · ${moneyFromApi(ex.value)}`;
}

function formatExtremeMonth(ex: ExtremeMonth): string {
  if (!ex) return "—";
  const name = MONTH_NAMES_ES[ex.month - 1] ?? `Mes ${ex.month}`;
  return `${name} · ${moneyFromApi(ex.value)}`;
}

function KpiChip({ label, value }: { label: string; value: ReactNode }) {
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
          "color-mix(in srgb, var(--primary-600) 6%, var(--background))",
      }}
    >
      <h2
        className="text-lg font-bold"
        style={{ color: "var(--primary-800)" }}
      >
        {title}
      </h2>
      <p className="mt-1 text-xs font-medium" style={{ color: "var(--primary-700)" }}>
        {hint}
      </p>
      <div className="mt-4 flex flex-wrap gap-2">{kpis}</div>
      <div className="mt-5 w-full overflow-x-auto">{children}</div>
    </article>
  );
}

type Props = {
  periodTitle: string;
  data: NequiStatsResponse;
};

export default function StatsNequiSection({ periodTitle, data }: Props) {
  const monthLabelsShort = MONTH_NAMES_ES.map((n) => n.slice(0, 3));

  if (data.period === "month") {
    return (
      <>
        <ChartCard
          title={`${periodTitle} — Pagos Nequi por día`}
          hint="Solo pagos ya asignados a esta droguería. Mouse: cantidad ese día."
          kpis={
            <>
              <KpiChip label="Total pagos:" value={data.kpis.payments_count} />
              <KpiChip
                label="Total valor:"
                value={moneyFromApi(data.kpis.total_value)}
              />
              <KpiChip
                label={`Prom. pagos / día (${data.divisor_days}):`}
                value={data.kpis.avg_payments_per_day}
              />
              <KpiChip
                label="vs período anterior (pagos):"
                value={formatPct(data.kpis.vs_previous.payments_pct)}
              />
              <KpiChip
                label="Clientes únicos:"
                value={data.kpis.unique_clients}
              />
            </>
          }
        >
          <PaymentsLineChart
            labels={data.series.map((d) => d.date)}
            counts={data.series.map((d) => d.count)}
            axisLabel="Día del mes"
            formatPoint={(label, count) =>
              `${formatYmdDisplay(label)}: ${count} pago(s)`
            }
          />
        </ChartCard>

        <ChartCard
          title={`${periodTitle} — Valor Nequi por día`}
          hint="Mouse sobre una barra: total del día."
          kpis={
            <>
              <KpiChip
                label="Día menor:"
                value={formatExtremeDay(data.kpis.min_day)}
              />
              <KpiChip
                label="Día mayor:"
                value={formatExtremeDay(data.kpis.max_day)}
              />
              <KpiChip
                label={`Prom. valor / día (${data.divisor_days}):`}
                value={moneyFromApi(data.kpis.avg_value_per_day)}
              />
              <KpiChip
                label="Prom. / pago:"
                value={moneyFromApi(data.kpis.avg_value_per_payment)}
              />
              <KpiChip
                label="vs período anterior (valor):"
                value={formatPct(data.kpis.vs_previous.value_pct)}
              />
              <KpiChip
                label="Días con ventas / vacíos:"
                value={`${data.kpis.days_with_sales} / ${data.kpis.days_empty}`}
              />
            </>
          }
        >
          <ValueBarChart
            labels={data.series.map((d) => d.date)}
            values={data.series.map((d) => numFromApi(d.value))}
            axisLabel="Día del mes"
            formatPoint={(label, value) =>
              `${formatYmdDisplay(label)}: ${moneyNum(value)}`
            }
          />
        </ChartCard>
      </>
    );
  }

  return (
    <>
      <ChartCard
        title={`${periodTitle} — Pagos Nequi por mes`}
        hint="Solo pagos ya asignados. Mouse: cantidad ese mes."
        kpis={
          <>
            <KpiChip label="Total pagos:" value={data.kpis.payments_count} />
            <KpiChip
              label="Total valor:"
              value={moneyFromApi(data.kpis.total_value)}
            />
            <KpiChip
              label={`Prom. pagos / mes (${data.divisor_months}):`}
              value={data.kpis.avg_payments_per_month}
            />
            <KpiChip
              label="vs año anterior (pagos):"
              value={formatPct(data.kpis.vs_previous.payments_pct)}
            />
            <KpiChip
              label="Clientes únicos:"
              value={data.kpis.unique_clients}
            />
          </>
        }
      >
        <PaymentsLineChart
          labels={data.series.map(
            (d) => monthLabelsShort[d.month - 1] ?? String(d.month)
          )}
          counts={data.series.map((d) => d.count)}
          axisLabel="Mes"
          formatPoint={(label, count) => `${label}: ${count} pago(s)`}
        />
      </ChartCard>

      <ChartCard
        title={`${periodTitle} — Valor Nequi por mes`}
        hint="Mouse sobre una barra: total del mes."
        kpis={
          <>
            <KpiChip
              label="Mejor mes:"
              value={formatExtremeMonth(data.kpis.best_month)}
            />
            <KpiChip
              label="Peor mes:"
              value={formatExtremeMonth(data.kpis.worst_month)}
            />
            <KpiChip
              label={`Prom. valor / mes (${data.divisor_months}):`}
              value={moneyFromApi(data.kpis.avg_value_per_month)}
            />
            <KpiChip
              label="Prom. / pago:"
              value={moneyFromApi(data.kpis.avg_value_per_payment)}
            />
            <KpiChip
              label="vs año anterior (valor):"
              value={formatPct(data.kpis.vs_previous.value_pct)}
            />
          </>
        }
      >
        <ValueBarChart
          labels={data.series.map(
            (d) => monthLabelsShort[d.month - 1] ?? String(d.month)
          )}
          values={data.series.map((d) => numFromApi(d.value))}
          axisLabel="Mes"
          formatPoint={(label, value) => `${label}: ${moneyNum(value)}`}
        />
      </ChartCard>
    </>
  );
}
