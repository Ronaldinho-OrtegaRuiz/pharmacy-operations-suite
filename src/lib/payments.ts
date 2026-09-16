import {
  fetchWithAuth,
  getApiBaseUrl,
  getApiUpstreamBaseUrl,
} from "@/lib/api";

/** Coincide con PaymentListResponse del backend. */
export type PaymentItem = {
  id: number;
  drogueria_id: number;
  message_id: string;
  client: string;
  value: string;
  date: string;
};

export type PaymentListResponse = {
  items: PaymentItem[];
  total: number;
  /** Suma monetaria de todos los pagos del filtro (no solo la página). */
  value_total: string;
  page: number;
  page_size: number;
  pages: number;
};

export type PaymentsQueryParams = {
  page?: number;
  page_size?: number;
  sort?: "asc" | "desc";
  on_date?: string;
  date_from?: string;
  date_to?: string;
  value_min?: string;
  value_max?: string;
  drogueria_id?: number;
};

export type PollNowResponse = {
  ok: boolean;
  bootstrapped?: boolean;
  message?: string;
  new_count?: number;
  new_payments?: unknown[];
  last_uid?: number;
};

function buildQuery(params: PaymentsQueryParams): string {
  const sp = new URLSearchParams();
  if (params.page != null) sp.set("page", String(params.page));
  if (params.page_size != null) sp.set("page_size", String(params.page_size));
  if (params.sort) sp.set("sort", params.sort);
  if (params.on_date) sp.set("on_date", params.on_date);
  if (params.date_from) sp.set("date_from", params.date_from);
  if (params.date_to) sp.set("date_to", params.date_to);
  if (params.value_min != null && params.value_min !== "")
    sp.set("value_min", params.value_min);
  if (params.value_max != null && params.value_max !== "")
    sp.set("value_max", params.value_max);
  if (params.drogueria_id != null)
    sp.set("drogueria_id", String(params.drogueria_id));
  const q = sp.toString();
  return q ? `?${q}` : "";
}

export async function getPayments(
  params: PaymentsQueryParams
): Promise<{ ok: true; data: PaymentListResponse } | { ok: false; status: number; body: unknown }> {
  const url = `${getApiBaseUrl()}/payments${buildQuery(params)}`;
  const res = await fetchWithAuth(url, { method: "GET" });
  let body: unknown = {};
  try {
    body = await res.json();
  } catch {
    body = {};
  }
  if (!res.ok) {
    return { ok: false, status: res.status, body };
  }
  const data = body as PaymentListResponse;
  return {
    ok: true,
    data: {
      items: Array.isArray(data.items) ? data.items : [],
      total: typeof data.total === "number" ? data.total : 0,
      value_total:
        typeof data.value_total === "string" && data.value_total.trim()
          ? data.value_total.trim()
          : "0.00",
      page: typeof data.page === "number" ? data.page : 1,
      page_size: typeof data.page_size === "number" ? data.page_size : 10,
      pages: typeof data.pages === "number" ? data.pages : 0,
    },
  };
}

export async function postPollNow(): Promise<
  | { ok: true; data: PollNowResponse }
  | { ok: false; status: number; body: unknown }
> {
  const url = `${getApiBaseUrl()}/payments/poll-now`;
  const res = await fetchWithAuth(url, { method: "POST" });
  let body: unknown = {};
  try {
    body = await res.json();
  } catch {
    body = {};
  }
  if (!res.ok) {
    return { ok: false, status: res.status, body };
  }
  return { ok: true, data: body as PollNowResponse };
}

/** WebSocket: el navegador no manda cabeceras custom fácil; usamos ?token= */
export function getPaymentsWebSocketUrl(token: string): string {
  const base = getApiUpstreamBaseUrl();
  let hostPath: string;
  try {
    const u = new URL(base);
    const wsProto = u.protocol === "https:" ? "wss:" : "ws:";
    hostPath = `${wsProto}//${u.host}/ws/payments`;
  } catch {
    const wsProto = base.startsWith("https") ? "wss:" : "ws:";
    const rest = base.replace(/^https?:\/\//, "");
    hostPath = `${wsProto}//${rest.split("/")[0]}/ws/payments`;
  }
  return `${hostPath}?token=${encodeURIComponent(token)}`;
}

export function detailFromBody(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const d = (body as { detail?: unknown }).detail;
  if (typeof d === "string") return d;
  return null;
}

/** Fila de GET /payments/by-month (solo date + value, strings). */
export type PaymentByMonthRow = {
  date: string;
  value: string;
};

export type PaymentsByMonthParams = {
  month: number;
  /** Si no se envía, el backend usa el año actual en PAYMENTS_TZ. */
  year?: number;
  drogueria_id?: number;
};

function buildByMonthQuery(params: PaymentsByMonthParams): string {
  const sp = new URLSearchParams();
  sp.set("month", String(params.month));
  if (params.year != null) sp.set("year", String(params.year));
  if (params.drogueria_id != null)
    sp.set("drogueria_id", String(params.drogueria_id));
  return `?${sp.toString()}`;
}

/** GET /payments/by-month — mismo patrón que getPayments (fetchWithAuth + URL base). */
export async function getPaymentsByMonth(
  params: PaymentsByMonthParams
): Promise<
  | { ok: true; data: PaymentByMonthRow[] }
  | { ok: false; status: number; body: unknown }
> {
  const url = `${getApiBaseUrl()}/payments/by-month${buildByMonthQuery(params)}`;
  const res = await fetchWithAuth(url, { method: "GET" });
  let body: unknown = [];
  try {
    body = await res.json();
  } catch {
    body = [];
  }
  if (!res.ok) {
    return { ok: false, status: res.status, body };
  }
  const arr = Array.isArray(body) ? body : [];
  const data: PaymentByMonthRow[] = arr
    .filter(
      (row): row is PaymentByMonthRow =>
        row != null &&
        typeof row === "object" &&
        "date" in row &&
        "value" in row &&
        typeof (row as PaymentByMonthRow).date === "string" &&
        typeof (row as PaymentByMonthRow).value === "string"
    )
    .map((row) => ({
      date: (row as PaymentByMonthRow).date,
      value: (row as PaymentByMonthRow).value,
    }));
  return { ok: true, data };
}
