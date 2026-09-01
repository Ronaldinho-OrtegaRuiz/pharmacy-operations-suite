import { fetchWithAuth, getApiBaseUrl } from "@/lib/api";

export type ExtremeDay = { date: string; value: string } | null;
export type ExtremeMonth = { month: number; value: string } | null;

export type VsPrevious = {
  payments_pct?: string | null;
  value_pct?: string | null;
};

export type ShiftKpi = {
  shift_no: number;
  total: string;
  avg: string | null;
  filled_days: number;
};

export type StatsCompare = {
  qr_total: string;
  sales_total: string;
  delta: string;
  qr_share: string | null;
};

export type MonthStats = {
  period: "month";
  year: number;
  month: number;
  drogueria_id: number;
  shift_count: number;
  divisor_days: number;
  qr: {
    kpis: {
      payments_count: number;
      total_value: string;
      avg_payments_per_day: string;
      avg_value_per_day: string;
      avg_value_per_payment: string | null;
      min_day: ExtremeDay;
      max_day: ExtremeDay;
      days_with_sales: number;
      days_empty: number;
      unique_clients: number;
      vs_previous: VsPrevious;
    };
    series: { date: string; count: number; value: string }[];
  };
  sales: {
    kpis: {
      total_value: string;
      avg_value_per_day: string;
      min_day: ExtremeDay;
      max_day: ExtremeDay;
      days_filled: number;
      days_empty: number;
      by_shift: ShiftKpi[];
      vs_previous: VsPrevious;
    };
    series: {
      date: string;
      total: string;
      shifts: { shift_no: number; amount: string | null }[];
    }[];
  };
  compare: StatsCompare;
};

export type YearStats = {
  period: "year";
  year: number;
  drogueria_id: number;
  shift_count: number;
  divisor_months: number;
  qr: {
    kpis: {
      payments_count: number;
      total_value: string;
      avg_payments_per_month: string;
      avg_value_per_month: string;
      avg_value_per_payment: string | null;
      best_month: ExtremeMonth;
      worst_month: ExtremeMonth;
      unique_clients: number;
      vs_previous: VsPrevious;
    };
    series: { month: number; count: number; value: string }[];
  };
  sales: {
    kpis: {
      total_value: string;
      avg_value_per_month: string;
      best_month: ExtremeMonth;
      worst_month: ExtremeMonth;
      by_shift: ShiftKpi[];
      vs_previous: VsPrevious;
    };
    series: { month: number; value: string }[];
  };
  compare: StatsCompare;
};

export type StatsResponse = MonthStats | YearStats;

export type StatsQueryParams = {
  drogueria_id: number;
  period: "month" | "year";
  year?: number;
  month?: number;
};

function buildStatsQuery(params: StatsQueryParams): string {
  const sp = new URLSearchParams();
  sp.set("drogueria_id", String(params.drogueria_id));
  sp.set("period", params.period);
  if (params.year != null) sp.set("year", String(params.year));
  if (params.period === "month" && params.month != null) {
    sp.set("month", String(params.month));
  }
  return `?${sp.toString()}`;
}

function asMoneyString(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) {
    return value.toFixed(2);
  }
  return null;
}

function asPct(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) {
    return value.toFixed(2);
  }
  return null;
}

function parseExtremeDay(raw: unknown): ExtremeDay {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.date !== "string") return null;
  const value = asMoneyString(o.value);
  if (value == null) return null;
  return { date: o.date, value };
}

function parseExtremeMonth(raw: unknown): ExtremeMonth {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.month !== "number") return null;
  const value = asMoneyString(o.value);
  if (value == null) return null;
  return { month: o.month, value };
}

function parseVsPrevious(raw: unknown): VsPrevious {
  if (!raw || typeof raw !== "object") return {};
  const o = raw as Record<string, unknown>;
  return {
    payments_pct:
      "payments_pct" in o ? asPct(o.payments_pct) : undefined,
    value_pct: "value_pct" in o ? asPct(o.value_pct) : undefined,
  };
}

function parseShiftKpi(raw: unknown): ShiftKpi | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.shift_no !== "number") return null;
  const total = asMoneyString(o.total);
  if (total == null) return null;
  const avg =
    o.avg == null ? null : asMoneyString(o.avg);
  if (o.avg != null && avg == null) return null;
  return {
    shift_no: o.shift_no,
    total,
    avg,
    filled_days: typeof o.filled_days === "number" ? o.filled_days : 0,
  };
}

function parseCompare(raw: unknown): StatsCompare | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const qr_total = asMoneyString(o.qr_total);
  const sales_total = asMoneyString(o.sales_total);
  const delta = asMoneyString(o.delta);
  if (qr_total == null || sales_total == null || delta == null) return null;
  const qr_share =
    o.qr_share == null ? null : asPct(o.qr_share) ?? asMoneyString(o.qr_share);
  return { qr_total, sales_total, delta, qr_share };
}

function parseMonthStats(raw: Record<string, unknown>): MonthStats | null {
  if (raw.period !== "month") return null;
  if (typeof raw.year !== "number" || typeof raw.month !== "number") return null;
  if (typeof raw.drogueria_id !== "number") return null;
  if (typeof raw.shift_count !== "number") return null;
  if (typeof raw.divisor_days !== "number") return null;
  if (!raw.qr || typeof raw.qr !== "object") return null;
  if (!raw.sales || typeof raw.sales !== "object") return null;

  const qr = raw.qr as Record<string, unknown>;
  const sales = raw.sales as Record<string, unknown>;
  if (!qr.kpis || typeof qr.kpis !== "object") return null;
  if (!sales.kpis || typeof sales.kpis !== "object") return null;
  if (!Array.isArray(qr.series) || !Array.isArray(sales.series)) return null;

  const qk = qr.kpis as Record<string, unknown>;
  const sk = sales.kpis as Record<string, unknown>;
  const total_value = asMoneyString(qk.total_value);
  const avg_payments_per_day = asPct(qk.avg_payments_per_day);
  const avg_value_per_day = asMoneyString(qk.avg_value_per_day);
  if (
    typeof qk.payments_count !== "number" ||
    total_value == null ||
    avg_payments_per_day == null ||
    avg_value_per_day == null
  ) {
    return null;
  }

  const qrSeries = qr.series
    .map((row) => {
      if (!row || typeof row !== "object") return null;
      const o = row as Record<string, unknown>;
      const value = asMoneyString(o.value);
      if (typeof o.date !== "string" || typeof o.count !== "number" || value == null) {
        return null;
      }
      return { date: o.date, count: o.count, value };
    })
    .filter((x): x is { date: string; count: number; value: string } => x != null);

  const salesTotal = asMoneyString(sk.total_value);
  const salesAvg = asMoneyString(sk.avg_value_per_day);
  if (salesTotal == null || salesAvg == null) return null;

  const salesSeries = sales.series
    .map((row) => {
      if (!row || typeof row !== "object") return null;
      const o = row as Record<string, unknown>;
      const total = asMoneyString(o.total);
      if (typeof o.date !== "string" || total == null || !Array.isArray(o.shifts)) {
        return null;
      }
      const shifts = o.shifts
        .map((s) => {
          if (!s || typeof s !== "object") return null;
          const sh = s as Record<string, unknown>;
          if (typeof sh.shift_no !== "number") return null;
          const amount =
            sh.amount == null ? null : asMoneyString(sh.amount);
          if (sh.amount != null && amount == null) return null;
          return { shift_no: sh.shift_no, amount };
        })
        .filter(
          (x): x is { shift_no: number; amount: string | null } => x != null
        );
      return { date: o.date, total, shifts };
    })
    .filter(
      (
        x
      ): x is {
        date: string;
        total: string;
        shifts: { shift_no: number; amount: string | null }[];
      } => x != null
    );

  const by_shift = Array.isArray(sk.by_shift)
    ? sk.by_shift
        .map(parseShiftKpi)
        .filter((x): x is ShiftKpi => x != null)
    : [];

  const compare = parseCompare(raw.compare);
  if (!compare) return null;

  return {
    period: "month",
    year: raw.year,
    month: raw.month,
    drogueria_id: raw.drogueria_id,
    shift_count: raw.shift_count,
    divisor_days: raw.divisor_days,
    qr: {
      kpis: {
        payments_count: qk.payments_count,
        total_value,
        avg_payments_per_day,
        avg_value_per_day,
        avg_value_per_payment:
          qk.avg_value_per_payment == null
            ? null
            : asMoneyString(qk.avg_value_per_payment),
        min_day: parseExtremeDay(qk.min_day),
        max_day: parseExtremeDay(qk.max_day),
        days_with_sales:
          typeof qk.days_with_sales === "number" ? qk.days_with_sales : 0,
        days_empty: typeof qk.days_empty === "number" ? qk.days_empty : 0,
        unique_clients:
          typeof qk.unique_clients === "number" ? qk.unique_clients : 0,
        vs_previous: parseVsPrevious(qk.vs_previous),
      },
      series: qrSeries,
    },
    sales: {
      kpis: {
        total_value: salesTotal,
        avg_value_per_day: salesAvg,
        min_day: parseExtremeDay(sk.min_day),
        max_day: parseExtremeDay(sk.max_day),
        days_filled: typeof sk.days_filled === "number" ? sk.days_filled : 0,
        days_empty: typeof sk.days_empty === "number" ? sk.days_empty : 0,
        by_shift,
        vs_previous: parseVsPrevious(sk.vs_previous),
      },
      series: salesSeries,
    },
    compare,
  };
}

function parseYearStats(raw: Record<string, unknown>): YearStats | null {
  if (raw.period !== "year") return null;
  if (typeof raw.year !== "number" || typeof raw.drogueria_id !== "number") {
    return null;
  }
  if (typeof raw.shift_count !== "number") return null;
  if (typeof raw.divisor_months !== "number") return null;
  if (!raw.qr || typeof raw.qr !== "object") return null;
  if (!raw.sales || typeof raw.sales !== "object") return null;

  const qr = raw.qr as Record<string, unknown>;
  const sales = raw.sales as Record<string, unknown>;
  if (!qr.kpis || typeof qr.kpis !== "object") return null;
  if (!sales.kpis || typeof sales.kpis !== "object") return null;
  if (!Array.isArray(qr.series) || !Array.isArray(sales.series)) return null;

  const qk = qr.kpis as Record<string, unknown>;
  const sk = sales.kpis as Record<string, unknown>;
  const total_value = asMoneyString(qk.total_value);
  const avg_payments_per_month = asPct(qk.avg_payments_per_month);
  const avg_value_per_month = asMoneyString(qk.avg_value_per_month);
  if (
    typeof qk.payments_count !== "number" ||
    total_value == null ||
    avg_payments_per_month == null ||
    avg_value_per_month == null
  ) {
    return null;
  }

  const qrSeries = qr.series
    .map((row) => {
      if (!row || typeof row !== "object") return null;
      const o = row as Record<string, unknown>;
      const value = asMoneyString(o.value);
      if (
        typeof o.month !== "number" ||
        typeof o.count !== "number" ||
        value == null
      ) {
        return null;
      }
      return { month: o.month, count: o.count, value };
    })
    .filter(
      (x): x is { month: number; count: number; value: string } => x != null
    );

  const salesTotal = asMoneyString(sk.total_value);
  const salesAvg = asMoneyString(sk.avg_value_per_month);
  if (salesTotal == null || salesAvg == null) return null;

  const salesSeries = sales.series
    .map((row) => {
      if (!row || typeof row !== "object") return null;
      const o = row as Record<string, unknown>;
      const value = asMoneyString(o.value);
      if (typeof o.month !== "number" || value == null) return null;
      return { month: o.month, value };
    })
    .filter((x): x is { month: number; value: string } => x != null);

  const by_shift = Array.isArray(sk.by_shift)
    ? sk.by_shift
        .map(parseShiftKpi)
        .filter((x): x is ShiftKpi => x != null)
    : [];

  const compare = parseCompare(raw.compare);
  if (!compare) return null;

  return {
    period: "year",
    year: raw.year,
    drogueria_id: raw.drogueria_id,
    shift_count: raw.shift_count,
    divisor_months: raw.divisor_months,
    qr: {
      kpis: {
        payments_count: qk.payments_count,
        total_value,
        avg_payments_per_month,
        avg_value_per_month,
        avg_value_per_payment:
          qk.avg_value_per_payment == null
            ? null
            : asMoneyString(qk.avg_value_per_payment),
        best_month: parseExtremeMonth(qk.best_month),
        worst_month: parseExtremeMonth(qk.worst_month),
        unique_clients:
          typeof qk.unique_clients === "number" ? qk.unique_clients : 0,
        vs_previous: parseVsPrevious(qk.vs_previous),
      },
      series: qrSeries,
    },
    sales: {
      kpis: {
        total_value: salesTotal,
        avg_value_per_month: salesAvg,
        best_month: parseExtremeMonth(sk.best_month),
        worst_month: parseExtremeMonth(sk.worst_month),
        by_shift,
        vs_previous: parseVsPrevious(sk.vs_previous),
      },
      series: salesSeries,
    },
    compare,
  };
}

export function parseStatsResponse(body: unknown): StatsResponse | null {
  if (!body || typeof body !== "object") return null;
  const raw = body as Record<string, unknown>;
  if (raw.period === "month") return parseMonthStats(raw);
  if (raw.period === "year") return parseYearStats(raw);
  return null;
}

/** GET /stats — QR + ventas (mes o año). */
export async function getStats(
  params: StatsQueryParams
): Promise<
  | { ok: true; data: StatsResponse }
  | { ok: false; status: number; body: unknown }
> {
  const url = `${getApiBaseUrl()}/stats${buildStatsQuery(params)}`;
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
  const data = parseStatsResponse(body);
  if (!data) {
    return {
      ok: false,
      status: 422,
      body: { detail: "Respuesta de estadísticas inválida." },
    };
  }
  return { ok: true, data };
}
