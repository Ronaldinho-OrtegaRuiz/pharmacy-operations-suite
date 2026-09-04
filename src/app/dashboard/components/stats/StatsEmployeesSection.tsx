"use client";

import { formatValorCOPTable } from "@/lib/money-format";
import type {
  EmployeeDayExtreme,
  EmployeeExtreme,
  EmployeeMonthExtreme,
  ExtremeDay,
  ExtremeMonth,
  StatsResponse,
} from "@/lib/stats";
import type { ReactNode } from "react";

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

function moneyFromApi(raw: string): string {
  return formatValorCOPTable(raw);
}

function formatYmdShort(ymd: string): string {
  const m = ymd.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return ymd;
  return `${m[3]}/${m[2]}`;
}

function formatExtremeDay(day: ExtremeDay): string {
  if (!day) return "—";
  return `${formatYmdShort(day.date)} (${moneyFromApi(day.value)})`;
}

function formatExtremeMonth(ex: ExtremeMonth): string {
  if (!ex) return "—";
  const name = MONTH_NAMES_ES[ex.month - 1] ?? `Mes ${ex.month}`;
  return `${name} (${moneyFromApi(ex.value)})`;
}

function formatEmpExtreme(ex: EmployeeExtreme): string {
  if (!ex) return "—";
  return `${ex.employee} · ${moneyFromApi(ex.value)}`;
}

function formatEmpDayExtreme(ex: EmployeeDayExtreme): string {
  if (!ex) return "—";
  return `${ex.employee} · ${formatYmdShort(ex.date)} · ${moneyFromApi(ex.value)}`;
}

function formatEmpMonthExtreme(ex: EmployeeMonthExtreme): string {
  if (!ex) return "—";
  const name = MONTH_NAMES_ES[ex.month - 1] ?? `Mes ${ex.month}`;
  return `${ex.employee} · ${name} · ${moneyFromApi(ex.value)}`;
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

type Props = {
  periodTitle: string;
  data: StatsResponse;
};

export default function StatsEmployeesSection({ periodTitle, data }: Props) {
  const emp = data.employees;
  if (!emp) {
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
          {periodTitle} — Empleados
        </h2>
        <p className="mt-2 text-sm" style={{ color: "var(--primary-700)" }}>
          Sin datos de empleados en este período (o sin horario asignado).
        </p>
      </article>
    );
  }

  const k = emp.kpis;
  const isMonth = data.period === "month";

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
        {periodTitle} — Empleados
      </h2>
      <p className="mt-1 text-xs" style={{ color: "var(--primary-700)" }}>
        Ventas de caja atribuidas por horario (droguería + fecha + turno).
      </p>
      <div className="mt-3 flex flex-wrap gap-3">
        <KpiChip label="Turnos asignados:" value={k.assigned_shifts} />
        <KpiChip label="Con venta:" value={k.covered_shifts} />
        <KpiChip label="Total atribuido:" value={moneyFromApi(k.total_value)} />
        <KpiChip
          label="Mejor empleado:"
          value={formatEmpExtreme(k.best_employee)}
        />
        <KpiChip
          label="Peor empleado:"
          value={formatEmpExtreme(k.worst_employee)}
        />
        {isMonth && data.employees ? (
          <>
            <KpiChip
              label="Mejor jornada:"
              value={formatEmpDayExtreme(data.employees.kpis.best_employee_day)}
            />
            <KpiChip
              label="Peor jornada:"
              value={formatEmpDayExtreme(data.employees.kpis.worst_employee_day)}
            />
          </>
        ) : null}
        {!isMonth && data.employees ? (
          <>
            <KpiChip
              label="Mejor jornada (mes):"
              value={formatEmpMonthExtreme(
                data.employees.kpis.best_employee_month
              )}
            />
            <KpiChip
              label="Peor jornada (mes):"
              value={formatEmpMonthExtreme(
                data.employees.kpis.worst_employee_month
              )}
            />
          </>
        ) : null}
        {k.by_employee.map((e) => (
          <KpiChip
            key={e.employee_id}
            label={`${e.employee}:`}
            value={`${moneyFromApi(e.total)}${
              e.avg != null ? ` · prom. ${moneyFromApi(e.avg)}` : ""
            }${
              isMonth
                ? `${
                    e.best_day ? ` · mejor ${formatExtremeDay(e.best_day)}` : ""
                  }${
                    e.worst_day
                      ? ` · peor ${formatExtremeDay(e.worst_day)}`
                      : ""
                  }`
                : `${
                    e.best_month
                      ? ` · mejor ${formatExtremeMonth(e.best_month)}`
                      : ""
                  }${
                    e.worst_month
                      ? ` · peor ${formatExtremeMonth(e.worst_month)}`
                      : ""
                  }`
            } · ${e.covered_shifts}/${e.assigned_shifts} turnos`}
          />
        ))}
      </div>
    </article>
  );
}
