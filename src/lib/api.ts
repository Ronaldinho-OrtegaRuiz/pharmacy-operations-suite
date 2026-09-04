import {
  notifyApiRequestEnd,
  notifyApiRequestStart,
} from "@/lib/api-request-loading";
import { getToken } from "@/lib/auth-storage";

const DEFAULT_API =
  "https://sistema-validacion-pagos-qr-production.up.railway.app";

/** Host real del API (Railway). Para WebSocket y para el rewrite en next.config. */
export function getApiUpstreamBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? DEFAULT_API;
}

/**
 * En el navegador: `/api/backend` (Next reenvía al upstream → sin CORS desde localhost).
 * En servidor: URL directa al API.
 */
export function getApiBaseUrl(): string {
  if (typeof window !== "undefined") {
    return "/api/backend";
  }
  return getApiUpstreamBaseUrl();
}

export type LoginSuccess = { token: string };

export type ApiErrorBody = {
  detail?: string | unknown;
};

export class LoginRequestError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body: unknown
  ) {
    super(message);
    this.name = "LoginRequestError";
  }
}

/** POST /login — lanza LoginRequestError si no es 200. */
export async function postLogin(
  username: string,
  password: string
): Promise<LoginSuccess> {
  notifyApiRequestStart();
  try {
    const url = `${getApiBaseUrl()}/login`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    let data: unknown = {};
    try {
      data = await res.json();
    } catch {
      data = {};
    }

    if (!res.ok) {
      throw new LoginRequestError(
        `Login failed: ${res.status}`,
        res.status,
        data
      );
    }

    const token =
      typeof data === "object" &&
      data !== null &&
      "token" in data &&
      typeof (data as { token: unknown }).token === "string"
        ? (data as LoginSuccess).token
        : "";

    if (!token) {
      throw new LoginRequestError(
        "Respuesta sin token",
        res.status,
        data
      );
    }

    return { token };
  } finally {
    notifyApiRequestEnd();
  }
}

/** Mensaje legible según status y cuerpo FastAPI. */
export function loginErrorMessage(status: number, body: unknown): string {
  if (status === 401) return "Credenciales inválidas.";
  if (status === 503) {
    const d = (body as ApiErrorBody)?.detail;
    if (typeof d === "string" && d.trim()) return d;
    return "Falta configuración del servidor (ADMIN_USER / ADMIN_PASSWORD).";
  }
  if (status === 422) {
    return "Formulario incompleto o datos no válidos.";
  }
  if (status >= 500) {
    return "Error del servidor. Intenta más tarde.";
  }
  const d = (body as ApiErrorBody)?.detail;
  if (typeof d === "string" && d.trim()) return d;
  return "No se pudo iniciar sesión. Intenta nuevamente.";
}

/** fetch con Authorization Bearer + toast de carga global (ver ToastProvider). */
export async function fetchWithAuth(
  input: string | URL,
  init: RequestInit = {}
): Promise<Response> {
  const token = getToken();
  const headers = new Headers(init.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  notifyApiRequestStart();
  try {
    return await fetch(input, { ...init, headers });
  } finally {
    notifyApiRequestEnd();
  }
}

/** POST /logout — invalida el token en el servidor. Body vacío. */
export async function postLogout(): Promise<
  { ok: true } | { ok: false; status: number }
> {
  try {
    const url = `${getApiBaseUrl()}/logout`;
    const res = await fetchWithAuth(url, { method: "POST" });
    if (!res.ok) return { ok: false, status: res.status };
    return { ok: true };
  } catch {
    return { ok: false, status: 0 };
  }
}
