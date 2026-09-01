import { fetchWithAuth, getApiBaseUrl } from "@/lib/api";
import type { ApiFailure } from "@/lib/droguerias";
import { detailFromBody } from "@/lib/payments";

export type InvoiceStatus = "pending" | "paid" | "overdue";

export type Invoice = {
  id: number;
  drogueria_id: number;
  supplier_id: number;
  supplier: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  amount: string;
  status: InvoiceStatus;
};

export type Supplier = {
  id: number;
  name: string;
};

export type CreateInvoiceItem = {
  supplier_id?: number;
  supplier?: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  amount: string;
  status: "pending" | "paid";
};

export type InvoicesQueryParams = {
  drogueria_id: number;
  status?: InvoiceStatus | "";
  supplier_id?: number | "";
  date_from?: string;
  date_to?: string;
};

function asYmd(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const m = value.trim().match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
}

function asMoney(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) {
    return value.toFixed(2);
  }
  return null;
}

function asStatus(value: unknown): InvoiceStatus | null {
  if (value === "pending" || value === "paid" || value === "overdue") {
    return value;
  }
  return null;
}

export function parseInvoice(raw: unknown): Invoice | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.id !== "number" || typeof o.drogueria_id !== "number") {
    return null;
  }
  if (typeof o.supplier_id !== "number" || typeof o.supplier !== "string") {
    return null;
  }
  if (typeof o.invoice_number !== "string") return null;
  const invoice_date = asYmd(o.invoice_date);
  const due_date = asYmd(o.due_date);
  const amount = asMoney(o.amount);
  const status = asStatus(o.status);
  if (!invoice_date || !due_date || amount == null || !status) return null;
  return {
    id: o.id,
    drogueria_id: o.drogueria_id,
    supplier_id: o.supplier_id,
    supplier: o.supplier,
    invoice_number: o.invoice_number,
    invoice_date,
    due_date,
    amount,
    status,
  };
}

function parseSupplier(raw: unknown): Supplier | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.id !== "number" || typeof o.name !== "string") return null;
  return { id: o.id, name: o.name };
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

function buildInvoicesQuery(params: InvoicesQueryParams): string {
  const sp = new URLSearchParams();
  sp.set("drogueria_id", String(params.drogueria_id));
  if (params.status) sp.set("status", params.status);
  if (params.supplier_id !== undefined && params.supplier_id !== "") {
    sp.set("supplier_id", String(params.supplier_id));
  }
  if (params.date_from) sp.set("date_from", params.date_from);
  if (params.date_to) sp.set("date_to", params.date_to);
  return `?${sp.toString()}`;
}

/** GET /suppliers — catálogo global. */
export async function getSuppliers(): Promise<
  { ok: true; data: Supplier[] } | ApiFailure
> {
  const url = `${getApiBaseUrl()}/suppliers`;
  const res = await fetchWithAuth(url, { method: "GET" });
  let body: unknown = [];
  try {
    body = await res.json();
  } catch {
    body = [];
  }
  if (!res.ok) return { ok: false, status: res.status, body };
  const arr = Array.isArray(body) ? body : [];
  return {
    ok: true,
    data: arr.map(parseSupplier).filter((x): x is Supplier => x != null),
  };
}

/** GET /invoices */
export async function getInvoices(
  params: InvoicesQueryParams
): Promise<{ ok: true; data: Invoice[] } | ApiFailure> {
  const url = `${getApiBaseUrl()}/invoices${buildInvoicesQuery(params)}`;
  const res = await fetchWithAuth(url, { method: "GET" });
  let body: unknown = [];
  try {
    body = await res.json();
  } catch {
    body = [];
  }
  if (!res.ok) return { ok: false, status: res.status, body };
  const arr = Array.isArray(body) ? body : [];
  return {
    ok: true,
    data: arr.map(parseInvoice).filter((x): x is Invoice => x != null),
  };
}

/** POST /invoices — hasta 50 ítems. */
export async function createInvoices(params: {
  drogueria_id: number;
  items: CreateInvoiceItem[];
}): Promise<{ ok: true; data: Invoice[] } | ApiFailure> {
  const url = `${getApiBaseUrl()}/invoices`;
  const res = await fetchWithAuth(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  let body: unknown = [];
  try {
    body = await res.json();
  } catch {
    body = [];
  }
  if (!res.ok) return { ok: false, status: res.status, body };
  const arr = Array.isArray(body) ? body : [];
  return {
    ok: true,
    data: arr.map(parseInvoice).filter((x): x is Invoice => x != null),
  };
}

/** PATCH /invoices/{id} — pending | paid (nunca overdue). */
export async function patchInvoiceStatus(params: {
  id: number;
  status: "pending" | "paid";
}): Promise<{ ok: true; data: Invoice } | ApiFailure> {
  const url = `${getApiBaseUrl()}/invoices/${params.id}`;
  const res = await fetchWithAuth(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: params.status }),
  });
  let body: unknown = {};
  try {
    body = await res.json();
  } catch {
    body = {};
  }
  if (!res.ok) return { ok: false, status: res.status, body };
  const data = parseInvoice(body);
  if (!data) return { ok: false, status: res.status, body };
  return { ok: true, data };
}
