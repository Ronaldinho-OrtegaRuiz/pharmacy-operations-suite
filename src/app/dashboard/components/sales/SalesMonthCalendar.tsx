"use client";

import { formatValorCOPTable } from "@/lib/money-format";
import { todayYmdInTz } from "@/lib/payment-date-bounds";
import type { DaySales } from "@/lib/sales";

const WEEKDAY_LABELS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function toYmd(year: number, month1: number, day: number): string {
  return `${year}-${pad2(month1)}-${pad2(day)}`;
}

function parseYmd(ymd: string): { y: number; m: number; d: number } | null {
  const m = ymd.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  return { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) };
}

/** 0 = lunes … 6 = domingo (civil UTC, sin desfase de zona). */
function mondayIndex(year: number, month1: number, day: number): number {
  const sun0 = new Date(Date.UTC(year, month1 - 1, day)).getUTCDay();
  return (sun0 + 6) % 7;
}

function daysInMonth(year: number, month1: number): number {
  return new Date(Date.UTC(year, month1, 0)).getUTCDate();
}

function monthTitle(year: number, month1: number): string {
  const dt = new Date(Date.UTC(year, month1 - 1, 1));
  const raw = new Intl.DateTimeFormat("es-CO", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(dt);
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

function monthsInRange(
  dateFrom: string,
  dateTo: string
): { y: number; m: number }[] {
  const a = parseYmd(dateFrom);
  const b = parseYmd(dateTo);
  if (!a || !b) return [];
  const out: { y: number; m: number }[] = [];
  let y = a.y;
  let m = a.m;
  while (y < b.y || (y === b.y && m <= b.m)) {
    out.push({ y, m });
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return out;
}

type Cell = {
  ymd: string | null;
  inMonth: boolean;
  inRange: boolean;
  total: string | null;
};

function monthWeeks(
  year: number,
  month1: number,
  dateFrom: string,
  dateTo: string,
  totals: Map<string, string>
): Cell[][] {
  const lead = mondayIndex(year, month1, 1);
  const last = daysInMonth(year, month1);
  const cells: Cell[] = [];

  for (let i = 0; i < lead; i++) {
    cells.push({ ymd: null, inMonth: false, inRange: false, total: null });
  }
  for (let d = 1; d <= last; d++) {
    const ymd = toYmd(year, month1, d);
    const inRange = ymd >= dateFrom && ymd <= dateTo;
    cells.push({
      ymd,
      inMonth: true,
      inRange,
      total: inRange ? (totals.get(ymd) ?? null) : null,
    });
  }
  while (cells.length % 7 !== 0) {
    cells.push({ ymd: null, inMonth: false, inRange: false, total: null });
  }

  const weeks: Cell[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }
  return weeks;
}

type Props = {
  days: DaySales[];
  dateFrom: string;
  dateTo: string;
};

export default function SalesMonthCalendar({ days, dateFrom, dateTo }: Props) {
  const totals = new Map(days.map((d) => [d.date, d.total]));
  const months = monthsInRange(dateFrom, dateTo);
  const today = todayYmdInTz();

  return (
    <div className="flex flex-col gap-4">
      {months.map(({ y, m }) => {
        const weeks = monthWeeks(y, m, dateFrom, dateTo, totals);
        const title = monthTitle(y, m);
        return (
          <div
            key={`${y}-${m}`}
            className="overflow-hidden rounded-xl border"
            style={{
              borderColor: "var(--primary-200)",
              backgroundColor:
                "color-mix(in srgb, var(--primary-600) 8%, var(--background))",
            }}
          >
            <h3
              className="px-4 py-3 text-base font-bold"
              style={{ color: "var(--primary-800)" }}
            >
              {title}
            </h3>
            <div className="overflow-x-auto px-2 pb-3 sm:px-3">
              <table className="w-full min-w-[32rem] table-fixed border-collapse">
                <caption className="sr-only">{`Calendario de ventas ${title}`}</caption>
                <thead>
                  <tr>
                    {WEEKDAY_LABELS.map((label) => (
                      <th
                        key={label}
                        scope="col"
                        className="px-1 py-2 text-center text-xs font-semibold"
                        style={{ color: "var(--primary-700)" }}
                      >
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {weeks.map((week, wi) => (
                    <tr key={wi}>
                      {week.map((cell, di) => {
                        const dayNum = cell.ymd
                          ? Number(cell.ymd.slice(8, 10))
                          : null;
                        const isToday = cell.ymd === today;
                        const disabled = !cell.inMonth || !cell.inRange;
                        return (
                          <td key={di} className="p-1 align-top">
                            <div
                              className="flex min-h-[4.5rem] flex-col rounded-lg px-1.5 py-1.5"
                              style={{
                                backgroundColor: cell.inRange
                                  ? "color-mix(in srgb, var(--primary-600) 12%, var(--background))"
                                  : cell.inMonth
                                    ? "color-mix(in srgb, var(--primary-200) 22%, var(--background))"
                                    : "transparent",
                                opacity: disabled ? 0.42 : 1,
                                outline: isToday && cell.inRange
                                  ? "2px solid var(--primary-600)"
                                  : "none",
                                outlineOffset: isToday ? "-1px" : undefined,
                              }}
                            >
                              {dayNum != null ? (
                                <>
                                  <span
                                    className="text-xs font-bold"
                                    style={{
                                      color: cell.inRange
                                        ? "var(--primary-800)"
                                        : "var(--primary-700)",
                                    }}
                                  >
                                    {dayNum}
                                  </span>
                                  {cell.inRange ? (
                                    <span
                                      className="mt-1 text-[11px] font-semibold leading-tight tabular-nums sm:text-xs"
                                      style={{ color: "var(--primary-600)" }}
                                    >
                                      {cell.total != null
                                        ? formatValorCOPTable(cell.total)
                                        : "—"}
                                    </span>
                                  ) : null}
                                </>
                              ) : (
                                <span className="sr-only">Fuera del mes</span>
                              )}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}
