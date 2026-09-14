import { fetchWithAuth, getApiBaseUrl } from "@/lib/api";
import { detailFromBody } from "@/lib/payments";

export type NequiPayment = {
  id: number;
  client: string;
  value: string;
  notified_at: string;
  drogueria_id: number | null;
  notification_key: string;
  raw_text: string | null;
  device_id: string | null;
  assigned_at: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type NequiPaymentListResponse = {
  items: NequiPayment[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
};

export type NequiAssignedFilter = "all" | "true" | "false";

export type NequiPaymentsQuery = {
  page?: number;
  page_size?: number;
  assigned?: NequiAssignedFilter;
  drogueria_id?: number;
  date_from?: string;
  date_to?: string;
};

export type ApiFailure = { ok: false; status: number; body: unknown };

export function apiErrorMessage(body: unknown, fallback: string): string {
  return detailFromBody(body) ?? fallback;
}

function asIso(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  return value.trim();
}

function parseNequiPayment(raw: unknown): NequiPayment | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.id !== "number") return null;
  if (typeof o.client !== "string") return null;
  if (typeof o.value !== "string") return null;
  if (typeof o.notified_at !== "string") return null;
  const drogueria_id =
    o.drogueria_id == null
      ? null
      : typeof o.drogueria_id === "number"
        ? o.drogueria_id
        : null;
  if (o.drogueria_id != null && drogueria_id == null) return null;
  return {
    id: o.id,
    client: o.client,
    value: o.value,
    notified_at: o.notified_at,
    drogueria_id,
    notification_key:
      typeof o.notification_key === "string" ? o.notification_key : "",
    raw_text: typeof o.raw_text === "string" ? o.raw_text : null,
    device_id: typeof o.device_id === "string" ? o.device_id : null,
    assigned_at: asIso(o.assigned_at),
    created_at: asIso(o.created_at),
    updated_at: asIso(o.updated_at),
  };
}

function buildQuery(params: NequiPaymentsQuery): string {
  const sp = new URLSearchParams();
  if (params.page != null) sp.set("page", String(params.page));
  if (params.page_size != null) sp.set("page_size", String(params.page_size));
  if (params.assigned) sp.set("assigned", params.assigned);
  if (params.drogueria_id != null)
    sp.set("drogueria_id", String(params.drogueria_id));
  if (params.date_from) sp.set("date_from", params.date_from);
  if (params.date_to) sp.set("date_to", params.date_to);
  const q = sp.toString();
  return q ? `?${q}` : "";
}

/** GET /nequi-payments */
export async function getNequiPayments(
  params: NequiPaymentsQuery
): Promise<{ ok: true; data: NequiPaymentListResponse } | ApiFailure> {
  const url = `${getApiBaseUrl()}/nequi-payments${buildQuery(params)}`;
  const res = await fetchWithAuth(url, { method: "GET" });
  let body: unknown = {};
  try {
    body = await res.json();
  } catch {
    body = {};
  }
  if (!res.ok) return { ok: false, status: res.status, body };
  const o = body as Record<string, unknown>;
  const rawItems = Array.isArray(o.items) ? o.items : [];
  return {
    ok: true,
    data: {
      items: rawItems
        .map(parseNequiPayment)
        .filter((x): x is NequiPayment => x != null),
      total: typeof o.total === "number" ? o.total : 0,
      page: typeof o.page === "number" ? o.page : 1,
      page_size: typeof o.page_size === "number" ? o.page_size : 20,
      pages: typeof o.pages === "number" ? o.pages : 0,
    },
  };
}

/** PATCH /nequi-payments/{id} — asignar o quitar droguería. */
export async function patchNequiPayment(params: {
  id: number;
  drogueria_id: number | null;
}): Promise<{ ok: true; data: NequiPayment } | ApiFailure> {
  const url = `${getApiBaseUrl()}/nequi-payments/${params.id}`;
  const res = await fetchWithAuth(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ drogueria_id: params.drogueria_id }),
  });
  let body: unknown = {};
  try {
    body = await res.json();
  } catch {
    body = {};
  }
  if (!res.ok) return { ok: false, status: res.status, body };
  const data = parseNequiPayment(body);
  if (!data) {
    return {
      ok: false,
      status: 422,
      body: { detail: "Respuesta de pago Nequi inválida." },
    };
  }
  return { ok: true, data };
}

/** DELETE /nequi-payments/{id} — solo admin en UI. */
export async function deleteNequiPayment(
  id: number
): Promise<{ ok: true; id: number } | ApiFailure> {
  const url = `${getApiBaseUrl()}/nequi-payments/${id}`;
  const res = await fetchWithAuth(url, { method: "DELETE" });
  let body: unknown = {};
  try {
    body = await res.json();
  } catch {
    body = {};
  }
  if (!res.ok) return { ok: false, status: res.status, body };
  const o = body as Record<string, unknown>;
  const deletedId = typeof o.id === "number" ? o.id : id;
  return { ok: true, id: deletedId };
}
