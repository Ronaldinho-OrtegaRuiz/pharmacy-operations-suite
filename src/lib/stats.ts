import { fetchWithAuth, getApiBaseUrl } from "@/lib/api";

export type ExtremeDay = { date: string; value: string } | null;
export type ExtremeMonth = { month: number; value: string } | null;

export type VsPrevious = {
  payments_pct?: string | null;
  value_pct?: string | null;
};

export type InvoiceVsPrevious = {
  count_pct?: string | null;
  value_pct?: string | null;
};

export type AgingBucket = {
  count: number;
  total: string;
};

export type InvoiceAging = {
  not_due: AgingBucket;
  d1_7: AgingBucket;
  d8_30: AgingBucket;
  d31_plus: AgingBucket;
};

export type InvoiceSnapshot = {
  open_now_count: number;
  open_now_total: string;
  overdue_now_count: number;
  overdue_now_total: string;
  due_7d_count: number;
  due_7d_total: string;
};

export type InvoiceSupplierPeriod = {
  supplier_id: number;
  supplier: string;
  issued_count: number;
  issued_total: string;
  paid_total: string;
  open_total: string;
  overdue_total: string;
};

export type InvoiceSupplierOpen = {
  supplier_id: number;
  supplier: string;
  open_total: string;
  overdue_total: string;
};

export type MonthInvoices = {
  kpis: {
    issued_count: number;
    issued_total: string;
    avg_amount: string | null;
    paid_count: number;
    paid_total: string;
    open_count: number;
    open_total: string;
    overdue_count: number;
    overdue_total: string;
    vs_previous: InvoiceVsPrevious;
    by_supplier: InvoiceSupplierPeriod[];
  };
  series: { date: string; count: number; amount: string }[];
  snapshot: InvoiceSnapshot;
  aging: InvoiceAging;
  by_supplier_open: InvoiceSupplierOpen[];
};

export type YearInvoices = {
  kpis: {
    issued_count: number;
    issued_total: string;
    avg_amount: string | null;
    avg_issued_per_month: string;
    paid_count: number;
    paid_total: string;
    open_count: number;
    open_total: string;
    overdue_count: number;
    overdue_total: string;
    best_month: ExtremeMonth;
    worst_month: ExtremeMonth;
    vs_previous: InvoiceVsPrevious;
    by_supplier: InvoiceSupplierPeriod[];
  };
  series: { month: number; count: number; amount: string }[];
  snapshot: InvoiceSnapshot;
  aging: InvoiceAging;
  by_supplier_open: InvoiceSupplierOpen[];
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
  invoices_issued?: string;
  invoices_open_now?: string;
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
  invoices?: MonthInvoices;
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
  invoices?: YearInvoices;
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

function parseInvoiceVsPrevious(raw: unknown): InvoiceVsPrevious {
  if (!raw || typeof raw !== "object") return {};
  const o = raw as Record<string, unknown>;
  return {
    count_pct: "count_pct" in o ? asPct(o.count_pct) : undefined,
    value_pct: "value_pct" in o ? asPct(o.value_pct) : undefined,
  };
}

function parseAgingBucket(raw: unknown): AgingBucket {
  if (!raw || typeof raw !== "object") {
    return { count: 0, total: "0.00" };
  }
  const o = raw as Record<string, unknown>;
  const total = asMoneyString(o.total) ?? "0.00";
  return {
    count: typeof o.count === "number" ? o.count : 0,
    total,
  };
}

function parseInvoiceAging(raw: unknown): InvoiceAging {
  if (!raw || typeof raw !== "object") {
    const empty = { count: 0, total: "0.00" };
    return {
      not_due: empty,
      d1_7: empty,
      d8_30: empty,
      d31_plus: empty,
    };
  }
  const o = raw as Record<string, unknown>;
  return {
    not_due: parseAgingBucket(o.not_due),
    d1_7: parseAgingBucket(o.d1_7),
    d8_30: parseAgingBucket(o.d8_30),
    d31_plus: parseAgingBucket(o.d31_plus),
  };
}

function parseInvoiceSnapshot(raw: unknown): InvoiceSnapshot | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const open_now_total = asMoneyString(o.open_now_total);
  const overdue_now_total = asMoneyString(o.overdue_now_total);
  const due_7d_total = asMoneyString(o.due_7d_total);
  if (open_now_total == null || overdue_now_total == null || due_7d_total == null) {
    return null;
  }
  return {
    open_now_count:
      typeof o.open_now_count === "number" ? o.open_now_count : 0,
    open_now_total,
    overdue_now_count:
      typeof o.overdue_now_count === "number" ? o.overdue_now_count : 0,
    overdue_now_total,
    due_7d_count: typeof o.due_7d_count === "number" ? o.due_7d_count : 0,
    due_7d_total,
  };
}

function parseInvoiceSupplierPeriod(raw: unknown): InvoiceSupplierPeriod | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.supplier_id !== "number" || typeof o.supplier !== "string") {
    return null;
  }
  if (typeof o.issued_count !== "number") return null;
  const issued_total = asMoneyString(o.issued_total);
  const paid_total = asMoneyString(o.paid_total);
  const open_total = asMoneyString(o.open_total);
  const overdue_total = asMoneyString(o.overdue_total);
  if (
    issued_total == null ||
    paid_total == null ||
    open_total == null ||
    overdue_total == null
  ) {
    return null;
  }
  return {
    supplier_id: o.supplier_id,
    supplier: o.supplier,
    issued_count: o.issued_count,
    issued_total,
    paid_total,
    open_total,
    overdue_total,
  };
}

function parseInvoiceSupplierOpen(raw: unknown): InvoiceSupplierOpen | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.supplier_id !== "number" || typeof o.supplier !== "string") {
    return null;
  }
  const open_total = asMoneyString(o.open_total);
  const overdue_total = asMoneyString(o.overdue_total);
  if (open_total == null || overdue_total == null) return null;
  return {
    supplier_id: o.supplier_id,
    supplier: o.supplier,
    open_total,
    overdue_total,
  };
}

function parseMonthInvoices(raw: unknown): MonthInvoices | null {
  if (!raw || typeof raw !== "object") return null;
  const inv = raw as Record<string, unknown>;
  if (!inv.kpis || typeof inv.kpis !== "object") return null;
  if (!Array.isArray(inv.series)) return null;

  const k = inv.kpis as Record<string, unknown>;
  const issued_total = asMoneyString(k.issued_total);
  const paid_total = asMoneyString(k.paid_total);
  const open_total = asMoneyString(k.open_total);
  const overdue_total = asMoneyString(k.overdue_total);
  if (
    typeof k.issued_count !== "number" ||
    issued_total == null ||
    typeof k.paid_count !== "number" ||
    paid_total == null ||
    typeof k.open_count !== "number" ||
    open_total == null ||
    typeof k.overdue_count !== "number" ||
    overdue_total == null
  ) {
    return null;
  }

  const series = inv.series
    .map((row) => {
      if (!row || typeof row !== "object") return null;
      const o = row as Record<string, unknown>;
      const amount = asMoneyString(o.amount);
      if (
        typeof o.date !== "string" ||
        typeof o.count !== "number" ||
        amount == null
      ) {
        return null;
      }
      return { date: o.date, count: o.count, amount };
    })
    .filter(
      (x): x is { date: string; count: number; amount: string } => x != null
    );

  const snapshot = parseInvoiceSnapshot(inv.snapshot);
  if (!snapshot) return null;

  const by_supplier = Array.isArray(k.by_supplier)
    ? k.by_supplier
        .map(parseInvoiceSupplierPeriod)
        .filter((x): x is InvoiceSupplierPeriod => x != null)
    : [];

  const by_supplier_open = Array.isArray(inv.by_supplier_open)
    ? inv.by_supplier_open
        .map(parseInvoiceSupplierOpen)
        .filter((x): x is InvoiceSupplierOpen => x != null)
    : [];

  return {
    kpis: {
      issued_count: k.issued_count,
      issued_total,
      avg_amount:
        k.avg_amount == null ? null : asMoneyString(k.avg_amount),
      paid_count: k.paid_count,
      paid_total,
      open_count: k.open_count,
      open_total,
      overdue_count: k.overdue_count,
      overdue_total,
      vs_previous: parseInvoiceVsPrevious(k.vs_previous),
      by_supplier,
    },
    series,
    snapshot,
    aging: parseInvoiceAging(inv.aging),
    by_supplier_open,
  };
}

function parseYearInvoices(raw: unknown): YearInvoices | null {
  if (!raw || typeof raw !== "object") return null;
  const inv = raw as Record<string, unknown>;
  if (!inv.kpis || typeof inv.kpis !== "object") return null;
  if (!Array.isArray(inv.series)) return null;

  const k = inv.kpis as Record<string, unknown>;
  const issued_total = asMoneyString(k.issued_total);
  const paid_total = asMoneyString(k.paid_total);
  const open_total = asMoneyString(k.open_total);
  const overdue_total = asMoneyString(k.overdue_total);
  const avg_issued_per_month = asPct(k.avg_issued_per_month);
  if (
    typeof k.issued_count !== "number" ||
    issued_total == null ||
    typeof k.paid_count !== "number" ||
    paid_total == null ||
    typeof k.open_count !== "number" ||
    open_total == null ||
    typeof k.overdue_count !== "number" ||
    overdue_total == null ||
    avg_issued_per_month == null
  ) {
    return null;
  }

  const series = inv.series
    .map((row) => {
      if (!row || typeof row !== "object") return null;
      const o = row as Record<string, unknown>;
      const amount = asMoneyString(o.amount);
      if (
        typeof o.month !== "number" ||
        typeof o.count !== "number" ||
        amount == null
      ) {
        return null;
      }
      return { month: o.month, count: o.count, amount };
    })
    .filter(
      (x): x is { month: number; count: number; amount: string } => x != null
    );

  const snapshot = parseInvoiceSnapshot(inv.snapshot);
  if (!snapshot) return null;

  const by_supplier = Array.isArray(k.by_supplier)
    ? k.by_supplier
        .map(parseInvoiceSupplierPeriod)
        .filter((x): x is InvoiceSupplierPeriod => x != null)
    : [];

  const by_supplier_open = Array.isArray(inv.by_supplier_open)
    ? inv.by_supplier_open
        .map(parseInvoiceSupplierOpen)
        .filter((x): x is InvoiceSupplierOpen => x != null)
    : [];

  return {
    kpis: {
      issued_count: k.issued_count,
      issued_total,
      avg_amount:
        k.avg_amount == null ? null : asMoneyString(k.avg_amount),
      avg_issued_per_month,
      paid_count: k.paid_count,
      paid_total,
      open_count: k.open_count,
      open_total,
      overdue_count: k.overdue_count,
      overdue_total,
      best_month: parseExtremeMonth(k.best_month),
      worst_month: parseExtremeMonth(k.worst_month),
      vs_previous: parseInvoiceVsPrevious(k.vs_previous),
      by_supplier,
    },
    series,
    snapshot,
    aging: parseInvoiceAging(inv.aging),
    by_supplier_open,
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
  const invoices_issued = asMoneyString(o.invoices_issued) ?? undefined;
  const invoices_open_now = asMoneyString(o.invoices_open_now) ?? undefined;
  return {
    qr_total,
    sales_total,
    delta,
    qr_share,
    invoices_issued,
    invoices_open_now,
  };
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

  const invoices = parseMonthInvoices(raw.invoices) ?? undefined;

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
    invoices,
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

  const invoices = parseYearInvoices(raw.invoices) ?? undefined;

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
    invoices,
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
