/** Servicio de competencia (sin auth) — búsqueda por SSE. */

export const COMPETITORS_BASE_URL =
  (typeof process !== "undefined" &&
    typeof process.env.NEXT_PUBLIC_COMPETITORS_URL === "string" &&
    process.env.NEXT_PUBLIC_COMPETITORS_URL.trim()) ||
  "https://buscador-competencia-production.up.railway.app";

/** Timeout cliente: búsqueda + cola. */
export const COMPETITORS_STREAM_TIMEOUT_MS = 240_000;

export type CompetitorSite =
  | "la_economia"
  | "la_rebaja"
  | "tu_drogueria"
  | "cruz_verde"
  | "farmatodo"
  | "farmanorte";

export type CompetitorProduct = {
  name: string;
  lab: string | null;
  price: string | null;
  presentation: string | null;
  url: string | null;
  image: string | null;
};

export type SiteSlice = {
  site: CompetitorSite | string;
  label: string;
  ok: boolean;
  error: string | null;
  note: string | null;
  count: number;
  products: CompetitorProduct[];
};

export type LabAliases = {
  ag: string[];
  mk: string[];
};

export type CompetitorStreamMeta = {
  q: string;
  q_site: string;
  lab_aliases: LabAliases;
  sites: string[];
  priority: string[];
  error?: string;
};

export const SITE_ORDER: CompetitorSite[] = [
  "la_economia",
  "la_rebaja",
  "tu_drogueria",
  "cruz_verde",
  "farmatodo",
  "farmanorte",
];

function asMoney(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) {
    return value.toFixed(2);
  }
  return null;
}

function parseProduct(raw: unknown): CompetitorProduct | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.name !== "string" || !o.name.trim()) return null;
  return {
    name: o.name.trim(),
    lab: typeof o.lab === "string" ? o.lab : null,
    price: asMoney(o.price),
    presentation: typeof o.presentation === "string" ? o.presentation : null,
    url: typeof o.url === "string" ? o.url : null,
    image: typeof o.image === "string" ? o.image : null,
  };
}

export function parseSiteSlice(raw: unknown): SiteSlice | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.site !== "string" || typeof o.label !== "string") return null;
  const products = Array.isArray(o.products)
    ? o.products
        .map(parseProduct)
        .filter((x): x is CompetitorProduct => x != null)
    : [];
  return {
    site: o.site,
    label: o.label,
    ok: Boolean(o.ok),
    error: typeof o.error === "string" ? o.error : null,
    note: typeof o.note === "string" ? o.note : null,
    count: typeof o.count === "number" ? o.count : products.length,
    products,
  };
}

function parseLabAliases(raw: unknown): LabAliases {
  if (!raw || typeof raw !== "object") return { ag: [], mk: [] };
  const o = raw as Record<string, unknown>;
  return {
    ag: Array.isArray(o.ag)
      ? o.ag.filter((x): x is string => typeof x === "string")
      : [],
    mk: Array.isArray(o.mk)
      ? o.mk.filter((x): x is string => typeof x === "string")
      : [],
  };
}

export function parseStreamMeta(raw: unknown): CompetitorStreamMeta | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.q !== "string" || typeof o.q_site !== "string") return null;
  return {
    q: o.q,
    q_site: o.q_site,
    lab_aliases: parseLabAliases(o.lab_aliases),
    sites: Array.isArray(o.sites)
      ? o.sites.filter((x): x is string => typeof x === "string")
      : [],
    priority: Array.isArray(o.priority)
      ? o.priority.filter((x): x is string => typeof x === "string")
      : [],
    error: typeof o.error === "string" ? o.error : undefined,
  };
}

/** Orden fijo Economía → … → Farmanorte; el resto al final. */
export function orderSlices(slices: SiteSlice[]): SiteSlice[] {
  const bySite = new Map(slices.map((s) => [s.site, s]));
  const out: SiteSlice[] = [];
  for (const id of SITE_ORDER) {
    const hit = bySite.get(id);
    if (hit) {
      out.push(hit);
      bySite.delete(id);
    }
  }
  for (const rest of bySite.values()) out.push(rest);
  return out;
}

export function normalizeForMatch(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/** Expande AG/MK con alias del API; resto se busca literal. */
export function expandLabTokens(
  rawLab: string,
  aliases: LabAliases
): string[] {
  const t = normalizeForMatch(rawLab);
  if (!t) return [];
  if (t === "ag" || aliases.ag.some((a) => normalizeForMatch(a) === t)) {
    return aliases.ag.length
      ? aliases.ag.map(normalizeForMatch)
      : ["ag", "lafrancol"];
  }
  if (t === "mk" || aliases.mk.some((a) => normalizeForMatch(a) === t)) {
    return aliases.mk.length
      ? aliases.mk.map(normalizeForMatch)
      : ["mk", "tecnoquimicas"];
  }
  return [t];
}

export function productMatchesClientFilter(
  product: CompetitorProduct,
  opts: {
    dose?: string;
    lab?: string;
    aliases: LabAliases;
  }
): boolean {
  const hay = normalizeForMatch(
    `${product.name} ${product.lab ?? ""} ${product.presentation ?? ""}`
  );
  const dose = opts.dose?.trim();
  if (dose) {
    const d = normalizeForMatch(dose);
    if (d && !hay.includes(d)) return false;
  }
  const lab = opts.lab?.trim();
  if (lab) {
    const tokens = expandLabTokens(lab, opts.aliases);
    if (tokens.length && !tokens.some((tok) => hay.includes(tok))) {
      return false;
    }
  }
  return true;
}

export type CompetitorStreamHandlers = {
  onQueued?: (p: { ahead: number; message: string }) => void;
  onStarted?: (p: { message: string }) => void;
  onMeta?: (p: CompetitorStreamMeta) => void;
  onSlice?: (s: SiteSlice) => void;
  onDone?: () => void;
  onError?: (message: string) => void;
};

function parseEventData(raw: string): unknown {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

/**
 * Abre un EventSource a GET /competitors/search/stream.
 * Devuelve cleanup (cerrar). No abrir dos a la vez en la misma sesión.
 */
export function openCompetitorSearchStream(
  q: string,
  handlers: CompetitorStreamHandlers,
  opts?: { sites?: string[]; timeoutMs?: number }
): () => void {
  const trimmed = q.trim();
  if (trimmed.length < 2 || trimmed.length > 80) {
    handlers.onError?.("La búsqueda debe tener entre 2 y 80 caracteres.");
    return () => {};
  }

  const sp = new URLSearchParams();
  sp.set("q", trimmed);
  if (opts?.sites?.length) sp.set("sites", opts.sites.join(","));

  const url = `${COMPETITORS_BASE_URL}/competitors/search/stream?${sp.toString()}`;
  const es = new EventSource(url);
  let finished = false;
  const timeoutMs = opts?.timeoutMs ?? COMPETITORS_STREAM_TIMEOUT_MS;

  const finish = () => {
    if (finished) return;
    finished = true;
    window.clearTimeout(timer);
    es.close();
  };

  const timer = window.setTimeout(() => {
    finish();
    handlers.onError?.(
      "La búsqueda tardó demasiado (timeout). Intenta de nuevo."
    );
  }, timeoutMs);

  es.addEventListener("queued", (ev) => {
    const data = parseEventData((ev as MessageEvent).data);
    if (!data || typeof data !== "object") return;
    const o = data as Record<string, unknown>;
    handlers.onQueued?.({
      ahead: typeof o.ahead === "number" ? o.ahead : 0,
      message:
        typeof o.message === "string"
          ? o.message
          : "Hay gente buscando…",
    });
  });

  es.addEventListener("started", (ev) => {
    const data = parseEventData((ev as MessageEvent).data);
    if (!data || typeof data !== "object") return;
    const o = data as Record<string, unknown>;
    handlers.onStarted?.({
      message:
        typeof o.message === "string" ? o.message : "Cargando…",
    });
  });

  es.addEventListener("meta", (ev) => {
    const data = parseEventData((ev as MessageEvent).data);
    const meta = parseStreamMeta(data);
    if (!meta) return;
    handlers.onMeta?.(meta);
  });

  es.addEventListener("slice", (ev) => {
    const data = parseEventData((ev as MessageEvent).data);
    const slice = parseSiteSlice(data);
    if (slice) handlers.onSlice?.(slice);
  });

  es.addEventListener("done", () => {
    finish();
    handlers.onDone?.();
  });

  es.onerror = () => {
    if (finished) return;
    finish();
    handlers.onError?.(
      "Se cortó la conexión con el buscador. Intenta de nuevo."
    );
  };

  return () => {
    finish();
  };
}
