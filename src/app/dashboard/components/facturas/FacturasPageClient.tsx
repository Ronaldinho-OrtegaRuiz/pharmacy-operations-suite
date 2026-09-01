"use client";

import { useToast } from "@/components/ToastProvider";
import { removeToken } from "@/lib/auth-storage";
import { formatValorCOPTable } from "@/lib/money-format";
import { todayYmdInTz } from "@/lib/payment-date-bounds";
import {
  apiErrorMessage,
  createInvoices,
  getInvoices,
  getSuppliers,
  patchInvoiceStatus,
  type Invoice,
  type InvoiceStatus,
  type Supplier,
} from "@/lib/invoices";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useState,
  type FormEvent,
} from "react";
import StoreBadges, { DROGUERIA_RICKY_ID } from "../payments/StoreBadges";

const inputClass =
  "h-9 w-full rounded-lg border-2 px-2 text-sm font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[color:var(--primary-400)] disabled:opacity-60";

const inputStyle = {
  borderColor: "var(--primary-400)",
  backgroundColor: "color-mix(in srgb, var(--primary-600) 12%, var(--background))",
  color: "var(--foreground)",
} as const;

const STATUS_FILTERS: { id: "" | InvoiceStatus; label: string }[] = [
  { id: "", label: "Todas" },
  { id: "pending", label: "Pendientes" },
  { id: "overdue", label: "Vencidas" },
  { id: "paid", label: "Pagadas" },
];

function formatYmd(ymd: string): string {
  const m = ymd.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return ymd;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

function statusLabel(status: InvoiceStatus): string {
  if (status === "paid") return "Pagada";
  if (status === "overdue") return "Vencida";
  return "Pendiente";
}

function statusColors(status: InvoiceStatus): {
  bg: string;
  fg: string;
  border: string;
} {
  if (status === "paid") {
    return {
      bg: "color-mix(in srgb, #22c55e 18%, var(--background))",
      fg: "#15803d",
      border: "color-mix(in srgb, #22c55e 40%, var(--primary-200))",
    };
  }
  if (status === "overdue") {
    return {
      bg: "color-mix(in srgb, #ef4444 16%, var(--background))",
      fg: "#b91c1c",
      border: "color-mix(in srgb, #f87171 45%, var(--primary-200))",
    };
  }
  return {
    bg: "color-mix(in srgb, #f59e0b 16%, var(--background))",
    fg: "#b45309",
    border: "color-mix(in srgb, #f59e0b 40%, var(--primary-200))",
  };
}

type DraftForm = {
  supplierMode: "existing" | "new";
  supplier_id: string;
  supplier: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  amount: string;
  status: "pending" | "paid";
};

function emptyDraft(): DraftForm {
  const today = todayYmdInTz();
  return {
    supplierMode: "existing",
    supplier_id: "",
    supplier: "",
    invoice_number: "",
    invoice_date: today,
    due_date: today,
    amount: "",
    status: "pending",
  };
}

export default function FacturasPageClient() {
  const router = useRouter();
  const toast = useToast();

  const [drogueriaId, setDrogueriaId] = useState(DROGUERIA_RICKY_ID);
  const [statusFilter, setStatusFilter] = useState<"" | InvoiceStatus>("");
  const [supplierFilter, setSupplierFilter] = useState<number | "">("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [items, setItems] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<number | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [draft, setDraft] = useState<DraftForm>(emptyDraft);
  const [creating, setCreating] = useState(false);

  const expireAuth = useCallback(() => {
    removeToken();
    toast.show("Sesión expirada. Inicia sesión de nuevo.", "error");
    router.replace("/login");
  }, [router, toast]);

  const loadSuppliers = useCallback(async () => {
    try {
      const res = await getSuppliers();
      if (!res.ok) {
        if (res.status === 401) {
          expireAuth();
          return;
        }
        return;
      }
      setSuppliers(res.data);
    } catch {
      // listado opcional; no bloquea facturas
    }
  }, [expireAuth]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getInvoices({
        drogueria_id: drogueriaId,
        status: statusFilter,
        supplier_id: supplierFilter,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
      });
      if (!res.ok) {
        if (res.status === 401) {
          expireAuth();
          return;
        }
        setError(
          apiErrorMessage(res.body, "No se pudieron cargar las facturas.")
        );
        setItems([]);
        return;
      }
      setItems(res.data);
    } catch {
      setError("Error de red al cargar facturas.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [
    dateFrom,
    dateTo,
    drogueriaId,
    expireAuth,
    statusFilter,
    supplierFilter,
  ]);

  useEffect(() => {
    void loadSuppliers();
  }, [loadSuppliers]);

  useEffect(() => {
    void load();
  }, [load]);

  const markPaid = async (invoice: Invoice) => {
    if (invoice.status === "paid") return;
    setSavingId(invoice.id);
    try {
      const res = await patchInvoiceStatus({ id: invoice.id, status: "paid" });
      if (!res.ok) {
        if (res.status === 401) {
          expireAuth();
          return;
        }
        toast.show(
          apiErrorMessage(res.body, "No se pudo marcar como pagada."),
          "error"
        );
        return;
      }
      setItems((prev) =>
        prev.map((it) => (it.id === res.data.id ? res.data : it))
      );
      toast.show(`Factura ${res.data.invoice_number} marcada como pagada.`, "success");
      void loadSuppliers();
    } catch {
      toast.show("Error de red al actualizar la factura.", "error");
    } finally {
      setSavingId(null);
    }
  };

  const onCreate = async (e: FormEvent) => {
    e.preventDefault();
    const number = draft.invoice_number.trim();
    const amount = draft.amount.trim();
    if (!number || !amount || !draft.invoice_date || !draft.due_date) {
      toast.show("Completa número, fechas y monto.", "error");
      return;
    }
    if (draft.supplierMode === "existing" && !draft.supplier_id) {
      toast.show("Elige un proveedor o crea uno nuevo.", "error");
      return;
    }
    if (draft.supplierMode === "new" && !draft.supplier.trim()) {
      toast.show("Escribe el nombre del proveedor.", "error");
      return;
    }

    setCreating(true);
    try {
      const item =
        draft.supplierMode === "existing"
          ? {
              supplier_id: Number(draft.supplier_id),
              invoice_number: number,
              invoice_date: draft.invoice_date,
              due_date: draft.due_date,
              amount,
              status: draft.status,
            }
          : {
              supplier: draft.supplier.trim(),
              invoice_number: number,
              invoice_date: draft.invoice_date,
              due_date: draft.due_date,
              amount,
              status: draft.status,
            };

      const res = await createInvoices({
        drogueria_id: drogueriaId,
        items: [item],
      });
      if (!res.ok) {
        if (res.status === 401) {
          expireAuth();
          return;
        }
        toast.show(
          apiErrorMessage(res.body, "No se pudo crear la factura."),
          "error"
        );
        return;
      }
      toast.show(
        res.data.length === 1
          ? `Factura ${res.data[0]!.invoice_number} creada.`
          : `${res.data.length} facturas creadas.`,
        "success"
      );
      setDraft(emptyDraft());
      setShowForm(false);
      await loadSuppliers();
      await load();
    } catch {
      toast.show("Error de red al crear la factura.", "error");
    } finally {
      setCreating(false);
    }
  };

  return (
    <section aria-label="Facturas y proveedores" className="w-full max-w-5xl pb-8">
      <h1
        className="text-2xl font-bold"
        style={{ color: "var(--primary-800)" }}
      >
        Facturas
      </h1>
      <p className="mt-1 text-sm" style={{ color: "var(--primary-700)" }}>
        Proveedores compartidos. La factura queda registrada en la droguería
        elegida.
      </p>

      <div className="mt-6 w-full max-w-4xl">
        <StoreBadges
          drogueriaId={drogueriaId}
          onDrogueriaChange={setDrogueriaId}
        />
      </div>

      <div className="mt-6 flex w-full max-w-4xl flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className="text-sm font-semibold shrink-0"
            style={{ color: "var(--primary-800)" }}
          >
            Estado:
          </span>
          <div
            className="inline-flex flex-wrap overflow-hidden rounded-xl border"
            style={{
              borderColor: "var(--primary-200)",
              backgroundColor: "var(--primary-50)",
            }}
            role="group"
            aria-label="Filtrar por estado"
          >
            {STATUS_FILTERS.map((s, idx) => {
              const active = statusFilter === s.id;
              return (
                <button
                  key={s.id || "all"}
                  type="button"
                  disabled={loading}
                  onClick={() => setStatusFilter(s.id)}
                  className="px-3 py-2 text-xs font-semibold transition-colors sm:text-sm disabled:opacity-60"
                  style={{
                    borderLeft:
                      idx === 0 ? "none" : "1px solid var(--primary-200)",
                    backgroundColor: active
                      ? "var(--primary-600)"
                      : "transparent",
                    color: active ? "white" : "var(--primary-700)",
                  }}
                >
                  {s.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <label
            className="flex flex-col gap-1 text-sm font-semibold"
            style={{ color: "var(--primary-800)" }}
          >
            Proveedor
            <select
              value={supplierFilter === "" ? "" : String(supplierFilter)}
              disabled={loading}
              onChange={(e) =>
                setSupplierFilter(
                  e.target.value === "" ? "" : Number(e.target.value)
                )
              }
              className={`${inputClass} min-w-[12rem]`}
              style={inputStyle}
            >
              <option value="">Todos</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <label
            className="flex flex-col gap-1 text-sm font-semibold"
            style={{ color: "var(--primary-800)" }}
          >
            Desde (factura)
            <input
              type="date"
              value={dateFrom}
              disabled={loading}
              onChange={(e) => setDateFrom(e.target.value)}
              className={inputClass}
              style={inputStyle}
            />
          </label>
          <label
            className="flex flex-col gap-1 text-sm font-semibold"
            style={{ color: "var(--primary-800)" }}
          >
            Hasta (factura)
            <input
              type="date"
              value={dateTo}
              disabled={loading}
              onChange={(e) => setDateTo(e.target.value)}
              className={inputClass}
              style={inputStyle}
            />
          </label>
          <button
            type="button"
            disabled={loading}
            onClick={() => void load()}
            className="h-9 rounded-xl px-4 text-sm font-semibold text-white disabled:opacity-60"
            style={{ backgroundColor: "var(--primary-600)" }}
          >
            {loading ? "Cargando…" : "Actualizar"}
          </button>
          <button
            type="button"
            disabled={loading || creating}
            onClick={() => {
              setShowForm((v) => !v);
              if (!showForm) setDraft(emptyDraft());
            }}
            className="h-9 rounded-xl border-2 px-4 text-sm font-semibold disabled:opacity-60"
            style={{
              borderColor: "var(--primary-400)",
              color: "var(--primary-800)",
              backgroundColor:
                "color-mix(in srgb, var(--primary-600) 10%, var(--background))",
            }}
          >
            {showForm ? "Cancelar" : "Nueva factura"}
          </button>
        </div>
      </div>

      {showForm ? (
        <form
          onSubmit={(e) => void onCreate(e)}
          className="mt-6 w-full max-w-4xl rounded-2xl border p-4"
          style={{
            borderColor: "var(--primary-200)",
            backgroundColor:
              "color-mix(in srgb, var(--primary-600) 8%, var(--background))",
          }}
        >
          <h2
            className="text-base font-bold"
            style={{ color: "var(--primary-800)" }}
          >
            Registrar factura
          </h2>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={creating}
                onClick={() =>
                  setDraft((d) => ({ ...d, supplierMode: "existing" }))
                }
                className="rounded-lg px-3 py-1.5 text-xs font-semibold"
                style={{
                  backgroundColor:
                    draft.supplierMode === "existing"
                      ? "var(--primary-600)"
                      : "transparent",
                  color:
                    draft.supplierMode === "existing"
                      ? "white"
                      : "var(--primary-700)",
                  border: "1px solid var(--primary-200)",
                }}
              >
                Proveedor existente
              </button>
              <button
                type="button"
                disabled={creating}
                onClick={() =>
                  setDraft((d) => ({ ...d, supplierMode: "new" }))
                }
                className="rounded-lg px-3 py-1.5 text-xs font-semibold"
                style={{
                  backgroundColor:
                    draft.supplierMode === "new"
                      ? "var(--primary-600)"
                      : "transparent",
                  color:
                    draft.supplierMode === "new"
                      ? "white"
                      : "var(--primary-700)",
                  border: "1px solid var(--primary-200)",
                }}
              >
                Nuevo proveedor
              </button>
            </div>

            {draft.supplierMode === "existing" ? (
              <label
                className="flex flex-col gap-1 text-sm font-semibold sm:col-span-2"
                style={{ color: "var(--primary-800)" }}
              >
                Proveedor
                <select
                  required
                  value={draft.supplier_id}
                  disabled={creating}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, supplier_id: e.target.value }))
                  }
                  className={inputClass}
                  style={inputStyle}
                >
                  <option value="">Selecciona…</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <label
                className="flex flex-col gap-1 text-sm font-semibold sm:col-span-2"
                style={{ color: "var(--primary-800)" }}
              >
                Nombre del proveedor
                <input
                  required
                  value={draft.supplier}
                  disabled={creating}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, supplier: e.target.value }))
                  }
                  className={inputClass}
                  style={inputStyle}
                  placeholder="Distribuidora Norte"
                />
              </label>
            )}

            <label
              className="flex flex-col gap-1 text-sm font-semibold"
              style={{ color: "var(--primary-800)" }}
            >
              Número
              <input
                required
                value={draft.invoice_number}
                disabled={creating}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, invoice_number: e.target.value }))
                }
                className={inputClass}
                style={inputStyle}
                placeholder="FV-100"
              />
            </label>
            <label
              className="flex flex-col gap-1 text-sm font-semibold"
              style={{ color: "var(--primary-800)" }}
            >
              Monto
              <input
                required
                value={draft.amount}
                disabled={creating}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, amount: e.target.value }))
                }
                className={inputClass}
                style={inputStyle}
                placeholder="150000,99"
                inputMode="decimal"
              />
            </label>
            <label
              className="flex flex-col gap-1 text-sm font-semibold"
              style={{ color: "var(--primary-800)" }}
            >
              Fecha factura
              <input
                type="date"
                required
                value={draft.invoice_date}
                disabled={creating}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, invoice_date: e.target.value }))
                }
                className={inputClass}
                style={inputStyle}
              />
            </label>
            <label
              className="flex flex-col gap-1 text-sm font-semibold"
              style={{ color: "var(--primary-800)" }}
            >
              Vence
              <input
                type="date"
                required
                value={draft.due_date}
                disabled={creating}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, due_date: e.target.value }))
                }
                className={inputClass}
                style={inputStyle}
              />
            </label>
            <label
              className="flex flex-col gap-1 text-sm font-semibold"
              style={{ color: "var(--primary-800)" }}
            >
              Estado al crear
              <select
                value={draft.status}
                disabled={creating}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    status: e.target.value as "pending" | "paid",
                  }))
                }
                className={inputClass}
                style={inputStyle}
              >
                <option value="pending">Pendiente</option>
                <option value="paid">Ya pagada</option>
              </select>
            </label>
          </div>
          <div className="mt-4 flex justify-end">
            <button
              type="submit"
              disabled={creating}
              className="h-10 rounded-xl px-5 text-sm font-semibold text-white disabled:opacity-60"
              style={{ backgroundColor: "var(--primary-600)" }}
            >
              {creating ? "Guardando…" : "Guardar factura"}
            </button>
          </div>
        </form>
      ) : null}

      {error ? (
        <div
          className="mt-6 rounded-xl border px-4 py-3 text-sm font-medium"
          style={{
            borderColor: "color-mix(in srgb, #f87171 45%, var(--primary-200))",
            backgroundColor:
              "color-mix(in srgb, #ef4444 14%, var(--background))",
            color: "var(--foreground)",
          }}
        >
          {error}
        </div>
      ) : null}

      {!error ? (
        <div
          className="mt-6 w-full overflow-hidden rounded-2xl border"
          style={{
            borderColor: "var(--primary-200)",
            backgroundColor:
              "color-mix(in srgb, var(--primary-600) 6%, var(--background))",
          }}
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[40rem] border-collapse">
              <thead>
                <tr
                  style={{
                    backgroundColor: "var(--primary-100)",
                    color: "var(--primary-800)",
                  }}
                >
                  {(
                    [
                      "Proveedor",
                      "Número",
                      "Factura",
                      "Vence",
                      "Monto",
                      "Estado",
                      "",
                    ] as const
                  ).map((h) => (
                    <th
                      key={h || "actions"}
                      className="px-3 py-2.5 text-left text-xs font-bold tracking-wide"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading && items.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-3 py-8 text-center text-sm font-medium"
                      style={{ color: "var(--primary-700)" }}
                    >
                      Cargando facturas…
                    </td>
                  </tr>
                ) : null}
                {!loading && items.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-3 py-8 text-center text-sm font-medium"
                      style={{ color: "var(--primary-700)" }}
                    >
                      No hay facturas con estos filtros.
                    </td>
                  </tr>
                ) : null}
                {items.map((inv) => {
                  const colors = statusColors(inv.status);
                  const busy = savingId === inv.id;
                  return (
                    <tr
                      key={inv.id}
                      style={{
                        borderTop: "1px solid var(--primary-200)",
                        opacity: loading ? 0.65 : 1,
                      }}
                    >
                      <td
                        className="px-3 py-2.5 text-sm font-semibold"
                        style={{ color: "var(--foreground)" }}
                      >
                        {inv.supplier}
                      </td>
                      <td
                        className="px-3 py-2.5 text-sm font-semibold tabular-nums"
                        style={{ color: "var(--foreground)" }}
                      >
                        {inv.invoice_number}
                      </td>
                      <td
                        className="px-3 py-2.5 text-sm tabular-nums"
                        style={{ color: "var(--primary-800)" }}
                      >
                        {formatYmd(inv.invoice_date)}
                      </td>
                      <td
                        className="px-3 py-2.5 text-sm tabular-nums"
                        style={{ color: "var(--primary-800)" }}
                      >
                        {formatYmd(inv.due_date)}
                      </td>
                      <td
                        className="px-3 py-2.5 text-sm font-semibold tabular-nums"
                        style={{ color: "var(--primary-600)" }}
                      >
                        {formatValorCOPTable(inv.amount)}
                      </td>
                      <td className="px-3 py-2.5">
                        <span
                          className="inline-flex rounded-lg border px-2 py-0.5 text-xs font-bold"
                          style={{
                            backgroundColor: colors.bg,
                            color: colors.fg,
                            borderColor: colors.border,
                          }}
                        >
                          {statusLabel(inv.status)}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        {inv.status !== "paid" ? (
                          <button
                            type="button"
                            disabled={busy || loading}
                            onClick={() => void markPaid(inv)}
                            className="rounded-lg px-2.5 py-1 text-xs font-semibold text-white disabled:opacity-60"
                            style={{ backgroundColor: "var(--primary-600)" }}
                          >
                            {busy ? "…" : "Marcar pagada"}
                          </button>
                        ) : (
                          <span
                            className="text-xs font-medium"
                            style={{ color: "var(--primary-700)" }}
                          >
                            —
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </section>
  );
}
