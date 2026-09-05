/** Servicio de competencia (sin auth). */

export const COMPETITORS_BASE_URL =
  (typeof process !== "undefined" &&
    typeof process.env.NEXT_PUBLIC_COMPETITORS_URL === "string" &&
    process.env.NEXT_PUBLIC_COMPETITORS_URL.trim()) ||
  "https://buscador-competencia-production.up.railway.app";

/** Timeout largo: el scrape abre 6 sitios. */
export const COMPETITORS_FETCH_TIMEOUT_MS = 240_000;

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

export type CompetitorSearch = {
  q: string;
  q_site: string;
  lab_aliases: {
    ag: string[];
    mk: string[];
  };
  slices: SiteSlice[];
  error?: string;
};

const SITE_ORDER: CompetitorSite[] = [
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

function parseSlice(raw: unknown): SiteSlice | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.site !== "string" || typeof o.label !== "string") return null;
  const products = Array.isArray(o.products)
    ? o.products.map(parseProduct).filter((x): x is CompetitorProduct => x != null)
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

export function parseCompetitorSearch(raw: unknown): CompetitorSearch | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.q !== "string" || typeof o.q_site !== "string") return null;
  const aliases =
    o.lab_aliases && typeof o.lab_aliases === "object"
      ? (o.lab_aliases as Record<string, unknown>)
      : {};
  const ag = Array.isArray(aliases.ag)
    ? aliases.ag.filter((x): x is string => typeof x === "string")
    : [];
  const mk = Array.isArray(aliases.mk)
    ? aliases.mk.filter((x): x is string => typeof x === "string")
    : [];
  const slicesRaw = Array.isArray(o.slices) ? o.slices : [];
  const parsed = slicesRaw
    .map(parseSlice)
    .filter((x): x is SiteSlice => x != null);
  // Orden estable del API
  const bySite = new Map(parsed.map((s) => [s.site, s]));
  const slices: SiteSlice[] = [];
  for (const id of SITE_ORDER) {
    const hit = bySite.get(id);
    if (hit) {
      slices.push(hit);
      bySite.delete(id);
    }
  }
  for (const rest of bySite.values()) slices.push(rest);

  return {
    q: o.q,
    q_site: o.q_site,
    lab_aliases: { ag, mk },
    slices,
    error: typeof o.error === "string" ? o.error : undefined,
  };
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
  aliases: CompetitorSearch["lab_aliases"]
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
    aliases: CompetitorSearch["lab_aliases"];
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

export async function searchCompetitors(
  q: string
): Promise<
  | { ok: true; data: CompetitorSearch }
  | { ok: false; status: number; body: unknown; aborted?: boolean }
> {
  const trimmed = q.trim();
  if (trimmed.length < 2 || trimmed.length > 80) {
    return {
      ok: false,
      status: 400,
      body: { detail: "La búsqueda debe tener entre 2 y 80 caracteres." },
    };
  }

  const url = `${COMPETITORS_BASE_URL}/competitors/search?q=${encodeURIComponent(trimmed)}`;
  try {
    const res = await fetch(url, {
      method: "GET",
      signal: AbortSignal.timeout(COMPETITORS_FETCH_TIMEOUT_MS),
    });
    let body: unknown = {};
    try {
      body = await res.json();
    } catch {
      body = {};
    }
    if (!res.ok) return { ok: false, status: res.status, body };
    const data = parseCompetitorSearch(body);
    if (!data) {
      return {
        ok: false,
        status: 422,
        body: { detail: "Respuesta de competencia inválida." },
      };
    }
    return { ok: true, data };
  } catch (e) {
    const aborted =
      e instanceof DOMException &&
      (e.name === "TimeoutError" || e.name === "AbortError");
    return {
      ok: false,
      status: 0,
      body: {
        detail: aborted
          ? "La búsqueda tardó demasiado (timeout)."
          : "Error de red al consultar competencia.",
      },
      aborted,
    };
  }
}

/** Datos de demo para previsualizar la UI sin esperar el scrape. */
export function mockCompetitorSearch(q: string): CompetitorSearch {
  const mk = (
    name: string,
    lab: string | null,
    price: string,
    pres: string
  ): CompetitorProduct => ({
    name,
    lab,
    price,
    presentation: pres,
    url: "https://example.com",
    image: null,
  });
  return {
    q,
    q_site: q.split(/\s+/)[0] ?? q,
    lab_aliases: {
      ag: ["ag", "lafrancol"],
      mk: ["mk", "tecnoquimicas"],
    },
    slices: [
      {
        site: "la_economia",
        label: "La Economía",
        ok: true,
        error: null,
        note: null,
        count: 3,
        products: [
          mk("Acetaminofén 500 mg x 20 tab", "Genfar", "4500.00", "Caja x 20"),
          mk("Acetaminofén 500 mg AG", "Lafrancol", "5200.00", "1 un"),
          mk("Acetaminofén jarabe 120 ml", "MK", "9800.00", "Frasco 120 ml"),
        ],
      },
      {
        site: "la_rebaja",
        label: "La Rebaja",
        ok: true,
        error: null,
        note: null,
        count: 2,
        products: [
          mk("Acetaminofen 500mg caja 30", "Tecnoquímicas", "6100.00", "Caja x 30"),
          mk("Acetaminofén 500 MG", null, "3900.00", "Blíster"),
        ],
      },
      {
        site: "tu_drogueria",
        label: "Tu Droguería Virtual",
        ok: true,
        error: null,
        note: null,
        count: 1,
        products: [
          mk("Acetaminofén crema no aplica", "Genfar", "12000.00", "tubo x 20 gr"),
        ],
      },
      {
        site: "cruz_verde",
        label: "Cruz Verde",
        ok: false,
        error: "Timeout del sitio",
        note: null,
        count: 0,
        products: [],
      },
      {
        site: "farmatodo",
        label: "Farmatodo",
        ok: true,
        error: null,
        note: "Pocos resultados",
        count: 2,
        products: [
          mk("Acetaminofén 500 mg MK", "MK", "7300.00", "Caja x 24"),
          mk("Acetaminofén 500mg", "Lafrancol", "6800.00", "1 un (un a $6,800)"),
        ],
      },
      {
        site: "farmanorte",
        label: "Farmanorte",
        ok: true,
        error: null,
        note: null,
        count: 1,
        products: [
          mk("Acetaminofen 500 AG", "AG", "4990.00", "Caja x 20"),
        ],
      },
    ],
  };
}
