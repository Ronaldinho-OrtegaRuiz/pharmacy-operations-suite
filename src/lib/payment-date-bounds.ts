/**
 * Límites de fecha para usuarios no admin (alineado con PAYMENTS_TZ del API).
 */

export const PAYMENTS_DATE_TIMEZONE =
  (typeof process !== "undefined" &&
    typeof process.env.NEXT_PUBLIC_PAYMENTS_TZ === "string" &&
    process.env.NEXT_PUBLIC_PAYMENTS_TZ.trim()) ||
  "America/Bogota";

/** Hoy + este número de días hacia atrás (inclusive). 3 → 4 días en total. */
export const NON_ADMIN_MAX_DAYS_BACK = 3;

/** Primer día del mes civil de un YYYY-MM-DD (sin cambiar de zona). */
export function firstYmdOfMonth(ymd: string): string {
  const m = ymd.trim().match(/^(\d{4}-\d{2})-\d{2}$/);
  return m ? `${m[1]}-01` : ymd;
}

/** Último día del mes civil de un YYYY-MM-DD (sin cambiar de zona). */
export function lastYmdOfMonth(ymd: string): string {
  const m = ymd.trim().match(/^(\d{4})-(\d{2})/);
  if (!m) return ymd;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  if (!Number.isFinite(y) || !Number.isFinite(mo) || mo < 1 || mo > 12) {
    return ymd;
  }
  const last = new Date(Date.UTC(y, mo, 0)).getUTCDate();
  return `${m[1]}-${m[2]}-${String(last).padStart(2, "0")}`;
}

/** Primer y último día del mes (year + month 1–12). */
export function ymdBoundsForMonth(
  year: number,
  month: number
): { from: string; to: string } {
  const mm = String(month).padStart(2, "0");
  const from = `${year}-${mm}-01`;
  return { from, to: lastYmdOfMonth(from) };
}

/** YYYY-MM-DD del instante en la zona. */
export function todayYmdInTz(timeZone: string = PAYMENTS_DATE_TIMEZONE): string {
  const d = new Date();
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(d);
    const y = parts.find((p) => p.type === "year")?.value;
    const m = parts.find((p) => p.type === "month")?.value;
    const day = parts.find((p) => p.type === "day")?.value;
    if (y && m && day) return `${y}-${m}-${day}`;
  } catch {
    // fall through
  }
  const p = (x: number) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Suma días calendario a YYYY-MM-DD (civil). */
export function addCalendarDaysToYmd(ymd: string, deltaDays: number): string {
  const [y, mo, d] = ymd.split("-").map((x) => parseInt(x, 10));
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d))
    return ymd;
  const x = new Date(Date.UTC(y, mo - 1, d + deltaDays));
  const yy = x.getUTCFullYear();
  const mm = String(x.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(x.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

export function clampYmd(ymd: string, minYmd: string, maxYmd: string): string {
  if (ymd < minYmd) return minYmd;
  if (ymd > maxYmd) return maxYmd;
  return ymd;
}

export function nonAdminDateBounds(): { min: string; max: string } {
  const max = todayYmdInTz();
  const min = addCalendarDaysToYmd(max, -NON_ADMIN_MAX_DAYS_BACK);
  return { min, max };
}

type DateQuerySlice = {
  on_date?: string;
  date_from?: string;
  date_to?: string;
};

/** Asegura que la petición no salga de la ventana permitida (usuarios no admin). */
export function clampPaymentsDateQueryPart(
  q: DateQuerySlice,
  bounds: { min: string; max: string }
): DateQuerySlice {
  const { min, max } = bounds;
  if (q.on_date) {
    return { on_date: clampYmd(q.on_date, min, max) };
  }
  if (q.date_from != null && q.date_to != null) {
    let from = clampYmd(q.date_from, min, max);
    let to = clampYmd(q.date_to, min, max);
    if (from > to) [from, to] = [to, from];
    return { date_from: from, date_to: to };
  }
  return { on_date: clampYmd(max, min, max) };
}
