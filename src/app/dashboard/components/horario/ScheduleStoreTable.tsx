"use client";

import type { ScheduleDay, ScheduleRange } from "@/lib/schedule";

const WEEKDAY_SHORT = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"] as const;

function weekdayLabel(ymd: string): string {
  const [y, m, d] = ymd.split("-").map((x) => Number(x));
  if (!y || !m || !d) return ymd;
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return WEEKDAY_SHORT[wd] ?? "";
}

function dayNum(ymd: string): string {
  return ymd.slice(8, 10);
}

type Props = {
  title: string;
  schedule: ScheduleRange | null;
  todayYmd: string;
  editable: boolean;
  dirtyKeys: Set<string>;
  onAssign: (workDate: string, shiftNo: number, employeeId: number) => void;
  onClear: (workDate: string, shiftNo: number) => void;
};

function cellKey(drogueriaId: number, date: string, shiftNo: number): string {
  return `${drogueriaId}:${date}:${shiftNo}`;
}

export default function ScheduleStoreTable({
  title,
  schedule,
  todayYmd,
  editable,
  dirtyKeys,
  onAssign,
  onClear,
}: Props) {
  const days = schedule?.days ?? [];
  const scheduleCount = schedule?.schedule_count ?? 0;
  const drogueriaId = schedule?.drogueria_id ?? 0;

  const dayMap = new Map<string, ScheduleDay>(
    days.map((d) => [d.date, d])
  );

  /** Labels por columna (del primer día que las traiga). */
  const columnMeta = Array.from({ length: scheduleCount }, (_, i) => {
    const shiftNo = i + 1;
    for (const d of days) {
      const cell = d.shifts.find((s) => s.shift_no === shiftNo);
      if (cell) {
        return {
          shiftNo,
          label: cell.label,
          sales_shifts: cell.sales_shifts,
        };
      }
    }
    return { shiftNo, label: null as string | null, sales_shifts: [] as number[] };
  });

  return (
    <section
      className="w-full overflow-hidden rounded-2xl border"
      style={{
        borderColor: "var(--primary-200)",
        backgroundColor:
          "color-mix(in srgb, var(--primary-600) 6%, var(--background))",
      }}
    >
      <h2
        className="px-4 py-3 text-base font-bold"
        style={{
          color: "var(--primary-800)",
          backgroundColor:
            "color-mix(in srgb, var(--primary-600) 18%, var(--background))",
          borderBottom: "1px solid var(--primary-200)",
        }}
      >
        {title}
      </h2>

      {!schedule || days.length === 0 || scheduleCount < 1 ? (
        <p
          className="px-4 py-6 text-sm font-medium"
          style={{ color: "var(--primary-700)" }}
        >
          Sin días en este rango.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[36rem] border-collapse">
            <thead>
              <tr>
                <th
                  className="sticky left-0 z-10 px-3 py-2 text-left text-xs font-bold"
                  style={{
                    color: "var(--primary-800)",
                    backgroundColor: "var(--primary-100)",
                    borderBottom: "1px solid var(--primary-200)",
                    borderRight: "1px solid var(--primary-200)",
                  }}
                >
                  Turno
                </th>
                {days.map((d) => {
                  const isToday = d.date === todayYmd;
                  return (
                    <th
                      key={d.date}
                      data-schedule-day={d.date}
                      className="px-2 py-2 text-center text-xs font-bold"
                      style={{
                        color: "var(--primary-800)",
                        backgroundColor: isToday
                          ? "color-mix(in srgb, var(--primary-600) 22%, var(--primary-100))"
                          : "var(--primary-100)",
                        borderBottom: "1px solid var(--primary-200)",
                        borderLeft: "1px solid var(--primary-200)",
                        outline: isToday
                          ? "2px solid var(--primary-600)"
                          : undefined,
                        outlineOffset: isToday ? "-2px" : undefined,
                      }}
                    >
                      <div>{weekdayLabel(d.date)}</div>
                      <div className="text-[11px] font-semibold opacity-80">
                        {dayNum(d.date)}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {columnMeta.map(({ shiftNo, label, sales_shifts }) => (
                  <tr key={shiftNo}>
                    <th
                      scope="row"
                      className="sticky left-0 z-10 px-3 py-2 text-left text-sm font-bold"
                      style={{
                        color: "var(--primary-800)",
                        backgroundColor:
                          "color-mix(in srgb, var(--primary-600) 10%, var(--background))",
                        borderTop: "1px solid var(--primary-200)",
                        borderRight: "1px solid var(--primary-200)",
                      }}
                    >
                      <div>T{shiftNo}</div>
                      {label ? (
                        <div
                          className="text-[10px] font-semibold capitalize opacity-75"
                          style={{ color: "var(--primary-700)" }}
                        >
                          {label}
                        </div>
                      ) : null}
                      {sales_shifts.length > 0 ? (
                        <div
                          className="text-[10px] font-medium opacity-60"
                          style={{ color: "var(--primary-700)" }}
                          title="Turnos de caja cubiertos"
                        >
                          caja{" "}
                          {sales_shifts.map((n) => `T${n}`).join("+")}
                        </div>
                      ) : null}
                    </th>
                    {days.map((d) => {
                      const day = dayMap.get(d.date);
                      const cell = day?.shifts.find(
                        (s) => s.shift_no === shiftNo
                      );
                      const key = cellKey(drogueriaId, d.date, shiftNo);
                      const dirty = dirtyKeys.has(key);
                      const filled =
                        cell?.employee_id != null && cell.employee != null;
                      return (
                        <td
                          key={d.date}
                          className="p-1 align-middle"
                          style={{
                            borderTop: "1px solid var(--primary-200)",
                            borderLeft: "1px solid var(--primary-200)",
                            backgroundColor:
                              d.date === todayYmd
                                ? "color-mix(in srgb, var(--primary-600) 8%, var(--background))"
                                : undefined,
                          }}
                          onDragOver={
                            editable
                              ? (e) => {
                                  e.preventDefault();
                                  e.dataTransfer.dropEffect = "copy";
                                }
                              : undefined
                          }
                          onDrop={
                            editable
                              ? (e) => {
                                  e.preventDefault();
                                  const raw =
                                    e.dataTransfer.getData(
                                      "application/x-employee-id"
                                    ) || e.dataTransfer.getData("text/plain");
                                  const id = Number(raw);
                                  if (!Number.isFinite(id) || id < 1) return;
                                  onAssign(d.date, shiftNo, id);
                                }
                              : undefined
                          }
                        >
                          <div
                            className="relative flex min-h-[2.75rem] items-center justify-center rounded-lg px-1.5 py-1 text-center text-xs font-semibold transition-colors"
                            style={{
                              backgroundColor: filled
                                ? "color-mix(in srgb, var(--primary-600) 16%, var(--background))"
                                : "color-mix(in srgb, var(--primary-200) 35%, var(--background))",
                              color: filled
                                ? "var(--primary-800)"
                                : "var(--primary-600)",
                              outline: dirty
                                ? "2px solid var(--primary-500)"
                                : editable
                                  ? "1px dashed color-mix(in srgb, var(--primary-400) 55%, transparent)"
                                  : "none",
                            }}
                          >
                            {filled
                              ? cell.employee
                              : editable
                                ? "Soltar"
                                : "—"}
                            {editable && filled ? (
                              <button
                                type="button"
                                aria-label={`Quitar ${cell.employee} de T${shiftNo}`}
                                onClick={() => onClear(d.date, shiftNo)}
                                className="absolute right-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded-md text-[11px] font-bold leading-none"
                                style={{
                                  color: "var(--primary-700)",
                                  backgroundColor:
                                    "color-mix(in srgb, var(--background) 70%, transparent)",
                                }}
                              >
                                ×
                              </button>
                            ) : null}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
