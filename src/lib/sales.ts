import { fetchWithAuth, getApiBaseUrl } from "@/lib/api";
import type { ApiFailure } from "@/lib/droguerias";
import { parseMoneyFromApi } from "@/lib/money-format";
import { detailFromBody } from "@/lib/payments";

export const MAX_SALES_RANGE_DAYS = 92;

export type ShiftItem = {
  shift_no: number;
  amount: string | null;
};

export type DaySales = {
  date: string; // YYYY-MM-DD
  shifts: ShiftItem[];
  total: string;
};

export type SalesRange = {
  drogueria_id: number;
  shift_count: number;
  date_from: string;
  date_to: string;
  range_total: string;
  days: DaySales[];
};

function asYmd(value: unknown): string | null {
  if (typeof value === "string") {
    const m = value.trim().match(/^(\d{4}-\d{2}-\d{2})/);
    return m ? m[1] : null;
  }
  return null;
}

function parseShift(raw: unknown): ShiftItem | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.shift_no !== "number") return null;
  const amount =
    o.amount == null
      ? null
      : typeof o.amount === "string"
        ? o.amount
        : typeof o.amount === "number"
          ? String(o.amount)
          : null;
  if (o.amount != null && amount == null) return null;
  return { shift_no: o.shift_no, amount };
}

export function parseDaySales(raw: unknown): DaySales | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const date = asYmd(o.date);
  if (!date || typeof o.total !== "string" || !Array.isArray(o.shifts))
    return null;
  const shifts = o.shifts
    .map(parseShift)
    .filter((x): x is ShiftItem => x != null)
    .sort((a, b) => a.shift_no - b.shift_no);
  return { date, shifts, total: o.total };
}

function parseSalesRange(raw: unknown): SalesRange | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const date_from = asYmd(o.date_from);
  const date_to = asYmd(o.date_to);
  if (
    typeof o.drogueria_id !== "number" ||
    typeof o.shift_count !== "number" ||
    !date_from ||
    !date_to ||
    typeof o.range_total !== "string" ||
    !Array.isArray(o.days)
  ) {
    return null;
  }
  const days = o.days
    .map(parseDaySales)
    .filter((x): x is DaySales => x != null);
  return {
    drogueria_id: o.drogueria_id,
    shift_count: o.shift_count,
    date_from,
    date_to,
    range_total: o.range_total,
    days,
  };
}

export function inclusiveDayCount(dateFrom: string, dateTo: string): number {
  const a = Date.parse(`${dateFrom}T00:00:00Z`);
  const b = Date.parse(`${dateTo}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
  return Math.round((b - a) / 86_400_000) + 1;
}

/** Suma los `total` de cada día (valores que ya calculó el backend). */
export function sumBackendDayTotals(days: DaySales[]): string {
  let n = 0;
  for (const d of days) {
    const v = parseMoneyFromApi(d.total);
    if (Number.isFinite(v)) n += v;
  }
  return n.toFixed(2);
}

export function amountToApiString(n: number): string {
  return n.toFixed(2);
}

export function apiErrorMessage(body: unknown, fallback: string): string {
  const d = detailFromBody(body);
  if (d) return d;
  if (body && typeof body === "object" && "detail" in body) {
    const det = (body as { detail: unknown }).detail;
    if (Array.isArray(det) && det.length > 0) {
      const first = det[0] as { msg?: unknown };
      if (typeof first?.msg === "string") return first.msg;
    }
  }
  return fallback;
}

export async function getSalesRange(params: {
  drogueria_id: number;
  date_from: string;
  date_to: string;
}): Promise<{ ok: true; data: SalesRange } | ApiFailure> {
  const sp = new URLSearchParams();
  sp.set("drogueria_id", String(params.drogueria_id));
  sp.set("date_from", params.date_from);
  sp.set("date_to", params.date_to);
  const url = `${getApiBaseUrl()}/sales?${sp.toString()}`;
  const res = await fetchWithAuth(url, { method: "GET" });
  let body: unknown = {};
  try {
    body = await res.json();
  } catch {
    body = {};
  }
  if (!res.ok) return { ok: false, status: res.status, body };
  const data = parseSalesRange(body);
  if (!data) return { ok: false, status: res.status, body };
  return { ok: true, data };
}

export async function putShiftSale(params: {
  drogueria_id: number;
  sale_date: string;
  shift_no: number;
  amount: string;
}): Promise<{ ok: true; data: DaySales } | ApiFailure> {
  const url = `${getApiBaseUrl()}/sales/${params.drogueria_id}/${params.sale_date}/${params.shift_no}`;
  const res = await fetchWithAuth(url, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ amount: params.amount }),
  });
  let body: unknown = {};
  try {
    body = await res.json();
  } catch {
    body = {};
  }
  if (!res.ok) return { ok: false, status: res.status, body };
  const data = parseDaySales(body);
  if (!data) return { ok: false, status: res.status, body };
  return { ok: true, data };
}
