import { fetchWithAuth, getApiBaseUrl } from "@/lib/api";
import { detailFromBody } from "@/lib/payments";

export type Employee = {
  id: number;
  name: string;
};

export function apiErrorMessage(body: unknown, fallback: string): string {
  return detailFromBody(body) ?? fallback;
}

function parseEmployee(raw: unknown): Employee | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.id !== "number" || typeof o.name !== "string") return null;
  const name = o.name.trim();
  if (!name) return null;
  return { id: o.id, name };
}

/** GET /employees · GET /employees?q= */
export async function getEmployees(
  q?: string
): Promise<
  | { ok: true; data: Employee[] }
  | { ok: false; status: number; body: unknown }
> {
  const sp = new URLSearchParams();
  if (q?.trim()) sp.set("q", q.trim());
  const qs = sp.toString();
  const url = `${getApiBaseUrl()}/employees${qs ? `?${qs}` : ""}`;
  const res = await fetchWithAuth(url, { method: "GET" });
  let body: unknown = {};
  try {
    body = await res.json();
  } catch {
    body = {};
  }
  if (!res.ok) return { ok: false, status: res.status, body };
  const list = Array.isArray(body)
    ? body
    : body &&
        typeof body === "object" &&
        Array.isArray((body as { items?: unknown }).items)
      ? (body as { items: unknown[] }).items
      : null;
  if (!list) {
    return {
      ok: false,
      status: 422,
      body: { detail: "Respuesta de empleados inválida." },
    };
  }
  const data = list
    .map(parseEmployee)
    .filter((x): x is Employee => x != null);
  return { ok: true, data };
}

/** POST /employees { name } */
export async function createEmployee(
  name: string
): Promise<
  | { ok: true; data: Employee }
  | { ok: false; status: number; body: unknown }
> {
  const url = `${getApiBaseUrl()}/employees`;
  const res = await fetchWithAuth(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: name.trim() }),
  });
  let body: unknown = {};
  try {
    body = await res.json();
  } catch {
    body = {};
  }
  if (!res.ok) return { ok: false, status: res.status, body };
  const data = parseEmployee(body);
  if (!data) {
    return {
      ok: false,
      status: 422,
      body: { detail: "Respuesta de empleado inválida." },
    };
  }
  return { ok: true, data };
}

/** PATCH /employees/{id} { name } */
export async function patchEmployee(
  id: number,
  name: string
): Promise<
  | { ok: true; data: Employee }
  | { ok: false; status: number; body: unknown }
> {
  const url = `${getApiBaseUrl()}/employees/${id}`;
  const res = await fetchWithAuth(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: name.trim() }),
  });
  let body: unknown = {};
  try {
    body = await res.json();
  } catch {
    body = {};
  }
  if (!res.ok) return { ok: false, status: res.status, body };
  const data = parseEmployee(body);
  if (!data) {
    return {
      ok: false,
      status: 422,
      body: { detail: "Respuesta de empleado inválida." },
    };
  }
  return { ok: true, data };
}
