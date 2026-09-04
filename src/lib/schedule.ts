import { fetchWithAuth, getApiBaseUrl } from "@/lib/api";
import { detailFromBody } from "@/lib/payments";

/** Celda de columna de horario (no confundir con turnos de caja). */
export type ScheduleShiftCell = {
  shift_no: number;
  employee_id: number | null;
  employee: string | null;
  /** Ej. "día", "noche". */
  label: string | null;
  /** Turnos de caja que cubre esta columna (Yessi T3 → [4, 1]). */
  sales_shifts: number[];
};

export type ScheduleDay = {
  date: string;
  shifts: ScheduleShiftCell[];
};

export type ScheduleRange = {
  drogueria_id: number;
  /** Columnas del horario (Ricky 2, Yessi 3). No es shift_count de caja. */
  schedule_count: number;
  days: ScheduleDay[];
};

export type ScheduleBulkItem = {
  work_date: string;
  /** Columna de horario (Yessi 1–3, Ricky 1–2). */
  shift_no: number;
  employee_id: number | null;
};

export function apiErrorMessage(body: unknown, fallback: string): string {
  return detailFromBody(body) ?? fallback;
}

function asYmd(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const m = value.trim().match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
}

function parseShiftCell(raw: unknown): ScheduleShiftCell | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.shift_no !== "number") return null;
  const employee_id =
    o.employee_id == null
      ? null
      : typeof o.employee_id === "number"
        ? o.employee_id
        : null;
  if (o.employee_id != null && employee_id == null) return null;
  const employee =
    o.employee == null
      ? null
      : typeof o.employee === "string"
        ? o.employee
        : null;
  if (o.employee != null && employee == null) return null;
  const label =
    o.label == null
      ? null
      : typeof o.label === "string"
        ? o.label
        : null;
  if (o.label != null && label == null) return null;
  const sales_shifts = Array.isArray(o.sales_shifts)
    ? o.sales_shifts.filter((n): n is number => typeof n === "number")
    : [];
  return {
    shift_no: o.shift_no,
    employee_id,
    employee,
    label,
    sales_shifts,
  };
}

function parseScheduleDay(raw: unknown): ScheduleDay | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const date = asYmd(o.date);
  if (!date || !Array.isArray(o.shifts)) return null;
  const shifts = o.shifts
    .map(parseShiftCell)
    .filter((x): x is ScheduleShiftCell => x != null)
    .sort((a, b) => a.shift_no - b.shift_no);
  return { date, shifts };
}

export function parseScheduleRange(raw: unknown): ScheduleRange | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.drogueria_id !== "number") return null;
  if (!Array.isArray(o.days)) return null;
  const days = o.days
    .map(parseScheduleDay)
    .filter((x): x is ScheduleDay => x != null)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  let schedule_count: number | null =
    typeof o.schedule_count === "number" && Number.isFinite(o.schedule_count)
      ? o.schedule_count
      : null;
  // Compat breve: si el API aún manda shift_count en /schedule, no usarlo
  // como columnas salvo que no venga schedule_count y podamos inferir.
  if (schedule_count == null && days[0]?.shifts.length) {
    schedule_count = days[0].shifts.length;
  }
  if (schedule_count == null) return null;

  return {
    drogueria_id: o.drogueria_id,
    schedule_count,
    days,
  };
}

/** Respuesta de PUT/DELETE de una celda: día completo. */
export function parseScheduleDayResponse(raw: unknown): ScheduleDay | null {
  return parseScheduleDay(raw);
}

/** GET /schedule?drogueria_id=&date_from=&date_to= */
export async function getSchedule(params: {
  drogueria_id: number;
  date_from: string;
  date_to: string;
}): Promise<
  | { ok: true; data: ScheduleRange }
  | { ok: false; status: number; body: unknown }
> {
  const sp = new URLSearchParams();
  sp.set("drogueria_id", String(params.drogueria_id));
  sp.set("date_from", params.date_from);
  sp.set("date_to", params.date_to);
  const url = `${getApiBaseUrl()}/schedule?${sp.toString()}`;
  const res = await fetchWithAuth(url, { method: "GET" });
  let body: unknown = {};
  try {
    body = await res.json();
  } catch {
    body = {};
  }
  if (!res.ok) return { ok: false, status: res.status, body };
  const data = parseScheduleRange(body);
  if (!data) {
    return {
      ok: false,
      status: 422,
      body: { detail: "Respuesta de horario inválida." },
    };
  }
  return { ok: true, data };
}

/** PUT /schedule/{drogueria_id}/{fecha}/{shift_no} { employee_id } */
export async function putScheduleCell(params: {
  drogueria_id: number;
  work_date: string;
  shift_no: number;
  employee_id: number;
}): Promise<
  | { ok: true; data: ScheduleDay }
  | { ok: false; status: number; body: unknown }
> {
  const url = `${getApiBaseUrl()}/schedule/${params.drogueria_id}/${params.work_date}/${params.shift_no}`;
  const res = await fetchWithAuth(url, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ employee_id: params.employee_id }),
  });
  let body: unknown = {};
  try {
    body = await res.json();
  } catch {
    body = {};
  }
  if (!res.ok) return { ok: false, status: res.status, body };
  const data = parseScheduleDayResponse(body);
  if (!data) {
    return {
      ok: false,
      status: 422,
      body: { detail: "Respuesta de celda inválida." },
    };
  }
  return { ok: true, data };
}

/** DELETE /schedule/{drogueria_id}/{fecha}/{shift_no} */
export async function deleteScheduleCell(params: {
  drogueria_id: number;
  work_date: string;
  shift_no: number;
}): Promise<
  | { ok: true; data: ScheduleDay }
  | { ok: false; status: number; body: unknown }
> {
  const url = `${getApiBaseUrl()}/schedule/${params.drogueria_id}/${params.work_date}/${params.shift_no}`;
  const res = await fetchWithAuth(url, { method: "DELETE" });
  let body: unknown = {};
  try {
    body = await res.json();
  } catch {
    body = {};
  }
  if (!res.ok) return { ok: false, status: res.status, body };
  const data = parseScheduleDayResponse(body);
  if (!data) {
    return {
      ok: false,
      status: 422,
      body: { detail: "Respuesta de celda inválida." },
    };
  }
  return { ok: true, data };
}

/** PUT /schedule — varios ítems. */
export async function putScheduleBulk(params: {
  drogueria_id: number;
  items: ScheduleBulkItem[];
}): Promise<
  | { ok: true; data: unknown }
  | { ok: false; status: number; body: unknown }
> {
  const url = `${getApiBaseUrl()}/schedule`;
  const res = await fetchWithAuth(url, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      drogueria_id: params.drogueria_id,
      items: params.items,
    }),
  });
  let body: unknown = {};
  try {
    body = await res.json();
  } catch {
    body = {};
  }
  if (!res.ok) return { ok: false, status: res.status, body };
  return { ok: true, data: body };
}
