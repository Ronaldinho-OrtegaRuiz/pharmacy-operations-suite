"use client";

import { formatValorCOPTable, parseMoneyFromApi } from "@/lib/money-format";
import type {
  InvoiceAging,
  InvoiceSupplierOpen,
  InvoiceSupplierPeriod,
  MonthStats,
  YearStats,
} from "@/lib/stats";
import type { ReactNode } from "react";
import { ValueBarChart } from "./StatsCharts";

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

function formatExtremeMonth(month: number, value: string): string {
  const name = MONTH_NAMES_ES[month - 1] ?? `Mes ${month}`;
  return `${name} (${moneyFromApi(value)})`;
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

function SectionCard({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
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
      {hint ? (
        <p className="mt-1 text-xs" style={{ color: "var(--primary-700)" }}>
          {hint}
        </p>
      ) : null}
      <div className="mt-4">{children}</div>
    </article>
  );
}

function SupplierTable({
  headers,
  rows,
}: {
  headers: string[];
  rows: ReactNode[][];
}) {
  if (rows.length === 0) {
    return (
      <p className="text-sm font-medium" style={{ color: "var(--primary-700)" }}>
        Sin datos.
      </p>
    );
  }
  return (
    <div className="overflow-x-auto rounded-xl border" style={{ borderColor: "var(--primary-200)" }}>
      <table className="w-full min-w-[32rem] border-collapse text-sm">
        <thead>
          <tr style={{ backgroundColor: "var(--primary-100)", color: "var(--primary-800)" }}>
            {headers.map((h) => (
              <th key={h} className="px-3 py-2 text-left text-xs font-bold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((cells, i) => (
            <tr key={i} style={{ borderTop: "1px solid var(--primary-200)" }}>
              {cells.map((cell, j) => (
                <td
                  key={j}
                  className="px-3 py-2 font-semibold"
                  style={{ color: j === 0 ? "var(--foreground)" : "var(--primary-700)" }}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function periodSupplierRows(items: InvoiceSupplierPeriod[]) {
  return items.map((s) => [
    s.supplier,
    String(s.issued_count),
    moneyFromApi(s.issued_total),
    moneyFromApi(s.paid_total),
    moneyFromApi(s.open_total),
    moneyFromApi(s.overdue_total),
  ]);
}

function openSupplierRows(items: InvoiceSupplierOpen[]) {
  return items.map((s) => [
    s.supplier,
    moneyFromApi(s.open_total),
    moneyFromApi(s.overdue_total),
  ]);
}

function AgingChart({ aging }: { aging: InvoiceAging }) {
  const buckets = [
    { key: "not_due", label: "Al día" },
    { key: "d1_7", label: "0–7 días" },
    { key: "d8_30", label: "8–30 días" },
    { key: "d31_plus", label: "31+ días" },
  ] as const;

  return (
    <ValueBarChart
      labels={buckets.map((b) => b.label)}
      values={buckets.map((b) => numFromApi(aging[b.key].total))}
      axisLabel="Antigüedad"
      ariaLabel="Antigüedad de facturas pendientes"
      formatPoint={(label, value) => {
        const bucket = buckets.find((b) => b.label === label);
        const count = bucket ? aging[bucket.key].count : 0;
        return `${label}: ${count} factura(s) · ${moneyNum(value)}`;
      }}
    />
  );
}

type Props = {
  periodTitle: string;
  data: MonthStats | YearStats;
};

export default function StatsInvoicesSection({ periodTitle, data }: Props) {
  if (!data.invoices) {
    return (
      <p className="text-sm font-medium" style={{ color: "var(--primary-700)" }}>
        Las estadísticas de facturas no están disponibles en esta respuesta.
      </p>
    );
  }

  const inv = data.invoices;
  const snap = inv.snapshot;
  const monthLabelsShort = MONTH_NAMES_ES.map((n) => n.slice(0, 3));

  const isMonth = data.period === "month";

  return (
    <div className="flex flex-col gap-10">
      <SectionCard
        title={`${periodTitle} — Emitido en el período`}
        hint="Facturas cuya fecha de factura cae en el mes o año seleccionado."
      >
        <div className="flex flex-wrap gap-3">
          <KpiChip
            label="Emitidas:"
            value={`${inv.kpis.issued_count} · ${moneyFromApi(inv.kpis.issued_total)}`}
          />
          <KpiChip
            label="Pagadas (de emitidas):"
            value={`${inv.kpis.paid_count} · ${moneyFromApi(inv.kpis.paid_total)}`}
          />
          <KpiChip
            label="Abiertas (de emitidas):"
            value={`${inv.kpis.open_count} · ${moneyFromApi(inv.kpis.open_total)}`}
          />
          <KpiChip
            label="Vencidas (de emitidas):"
            value={`${inv.kpis.overdue_count} · ${moneyFromApi(inv.kpis.overdue_total)}`}
          />
          <KpiChip
            label="Prom. por factura:"
            value={moneyFromApi(inv.kpis.avg_amount)}
          />
          <KpiChip
            label="vs período anterior (cant.):"
            value={formatPct(inv.kpis.vs_previous.count_pct)}
          />
          <KpiChip
            label="vs período anterior (valor):"
            value={formatPct(inv.kpis.vs_previous.value_pct)}
          />
          {!isMonth && "avg_issued_per_month" in inv.kpis ? (
            <KpiChip
              label={`Prom. emitidas / mes (${data.divisor_months}):`}
              value={inv.kpis.avg_issued_per_month}
            />
          ) : null}
          {!isMonth &&
          "best_month" in inv.kpis &&
          inv.kpis.best_month != null ? (
            <KpiChip
              label="Mejor mes:"
              value={formatExtremeMonth(
                inv.kpis.best_month.month,
                inv.kpis.best_month.value
              )}
            />
          ) : null}
          {!isMonth &&
          "worst_month" in inv.kpis &&
          inv.kpis.worst_month != null ? (
            <KpiChip
              label="Peor mes:"
              value={formatExtremeMonth(
                inv.kpis.worst_month.month,
                inv.kpis.worst_month.value
              )}
            />
          ) : null}
        </div>
      </SectionCard>

      <SectionCard
        title="Hoy — Cuentas por pagar"
        hint="Snapshot actual. No cambia al cambiar de mes o año."
      >
        <div className="flex flex-wrap gap-3">
          <KpiChip
            label="Por pagar:"
            value={`${snap.open_now_count} · ${moneyFromApi(snap.open_now_total)}`}
          />
          <KpiChip
            label="Vencido hoy:"
            value={`${snap.overdue_now_count} · ${moneyFromApi(snap.overdue_now_total)}`}
          />
          <KpiChip
            label="Por vencer (7 días):"
            value={`${snap.due_7d_count} · ${moneyFromApi(snap.due_7d_total)}`}
          />
        </div>
      </SectionCard>

      <SectionCard
        title={`${periodTitle} — Facturas emitidas`}
        hint={
          isMonth
            ? "Barras por día del mes (fecha de factura)."
            : "Barras por mes del año (fecha de factura)."
        }
      >
        <div
          className="rounded-xl border p-3"
          style={{
            borderColor: "var(--primary-200)",
            backgroundColor:
              "color-mix(in srgb, var(--primary-600) 10%, var(--background))",
          }}
        >
          {isMonth ? (
            <ValueBarChart
              labels={inv.series.map((d) => (d as { date: string }).date)}
              values={inv.series.map((d) =>
                numFromApi((d as { amount: string }).amount)
              )}
              axisLabel="Día del mes"
              ariaLabel="Facturas emitidas por día"
              formatPoint={(label, value) =>
                `${formatYmdDisplay(label)}: ${moneyNum(value)}`
              }
            />
          ) : (
            <ValueBarChart
              labels={inv.series.map(
                (d) =>
                  monthLabelsShort[(d as { month: number }).month - 1] ??
                  String((d as { month: number }).month)
              )}
              values={inv.series.map((d) =>
                numFromApi((d as { amount: string }).amount)
              )}
              axisLabel="Mes"
              ariaLabel="Facturas emitidas por mes"
              formatPoint={(label, value) => `${label}: ${moneyNum(value)}`}
            />
          )}
        </div>
      </SectionCard>

      <SectionCard title="Proveedores del período">
        <SupplierTable
          headers={[
            "Proveedor",
            "Emitidas",
            "Total emitido",
            "Pagado",
            "Abierto",
            "Vencido",
          ]}
          rows={periodSupplierRows(inv.kpis.by_supplier)}
        />
      </SectionCard>

      <SectionCard title="Deuda abierta por proveedor (hoy)">
        <SupplierTable
          headers={["Proveedor", "Abierto", "Vencido"]}
          rows={openSupplierRows(inv.by_supplier_open)}
        />
      </SectionCard>

      <SectionCard
        title="Antigüedad de pendientes (hoy)"
        hint="Solo facturas pending. Vencida 0–7 días incluye las que vencen hoy."
      >
        <div className="mb-3 flex flex-wrap gap-3">
          <KpiChip
            label="Al día:"
            value={`${inv.aging.not_due.count} · ${moneyFromApi(inv.aging.not_due.total)}`}
          />
          <KpiChip
            label="0–7 días:"
            value={`${inv.aging.d1_7.count} · ${moneyFromApi(inv.aging.d1_7.total)}`}
          />
          <KpiChip
            label="8–30 días:"
            value={`${inv.aging.d8_30.count} · ${moneyFromApi(inv.aging.d8_30.total)}`}
          />
          <KpiChip
            label="31+ días:"
            value={`${inv.aging.d31_plus.count} · ${moneyFromApi(inv.aging.d31_plus.total)}`}
          />
        </div>
        <div
          className="rounded-xl border p-3"
          style={{
            borderColor: "var(--primary-200)",
            backgroundColor:
              "color-mix(in srgb, var(--primary-600) 10%, var(--background))",
          }}
        >
          <AgingChart aging={inv.aging} />
        </div>
      </SectionCard>
    </div>
  );
}
