import { fetchWithAuth, getApiBaseUrl } from "@/lib/api";

export const MIN_SHIFT_COUNT = 1;
export const MAX_SHIFT_COUNT = 6;

export type Drogueria = {
  id: number;
  name: string;
  shift_count: number;
};

export type ApiFailure = { ok: false; status: number; body: unknown };

function parseDrogueria(raw: unknown): Drogueria | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.id !== "number" || typeof o.name !== "string") return null;
  const shift =
    typeof o.shift_count === "number" && Number.isFinite(o.shift_count)
      ? o.shift_count
      : null;
  if (shift == null) return null;
  return { id: o.id, name: o.name, shift_count: shift };
}

export async function getDroguerias(): Promise<
  { ok: true; data: Drogueria[] } | ApiFailure
> {
  const url = `${getApiBaseUrl()}/droguerias`;
  const res = await fetchWithAuth(url, { method: "GET" });
  let body: unknown = [];
  try {
    body = await res.json();
  } catch {
    body = [];
  }
  if (!res.ok) return { ok: false, status: res.status, body };
  const arr = Array.isArray(body) ? body : [];
  const data = arr
    .map(parseDrogueria)
    .filter((x): x is Drogueria => x != null);
  return { ok: true, data };
}

export async function patchDrogueriaShiftCount(
  id: number,
  shift_count: number
): Promise<{ ok: true; data: Drogueria } | ApiFailure> {
  const url = `${getApiBaseUrl()}/droguerias/${id}`;
  const res = await fetchWithAuth(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ shift_count }),
  });
  let body: unknown = {};
  try {
    body = await res.json();
  } catch {
    body = {};
  }
  if (!res.ok) return { ok: false, status: res.status, body };
  const data = parseDrogueria(body);
  if (!data) return { ok: false, status: res.status, body };
  return { ok: true, data };
}
