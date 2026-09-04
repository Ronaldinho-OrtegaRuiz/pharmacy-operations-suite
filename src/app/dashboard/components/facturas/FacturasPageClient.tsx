"use client";

import { useToast } from "@/components/ToastProvider";
import { removeToken } from "@/lib/auth-storage";
import { formatValorCOPTable } from "@/lib/money-format";
import {
  todayYmdInTz,
  ymdBoundsForMonth,
} from "@/lib/payment-date-bounds";
import {
  apiErrorMessage,
  createInvoices,
  getInvoices,
  patchInvoice,
  type Invoice,
  type InvoiceStatus,
} from "@/lib/invoices";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { createPortal } from "react-dom";
import StoreBadges from "../payments/StoreBadges";
import { useSelectedDrogueria } from "@/lib/use-selected-drogueria";
import SupplierTypeahead from "./SupplierTypeahead";

const MONTH_NAMES_ES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
] as const;

function monthFromYmd(ymd: string): number {
  const m = Number(ymd.slice(5, 7));
  return m >= 1 && m <= 12 ? m : new Date().getMonth() + 1;
}

function yearFromYmd(ymd: string): number {
  const y = Number(ymd.slice(0, 4));
  return Number.isFinite(y) ? y : new Date().getFullYear();
}

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

/** Estado editable: overdue se trata como pending al editar. */
function editableStatus(status: InvoiceStatus): "pending" | "paid" {
  return status === "paid" ? "paid" : "pending";
}

type DraftForm = {
  supplier_id: number | "";
  supplier_label: string;
  supplier_new: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  amount: string;
  status: "pending" | "paid";
};

function emptyDraft(): DraftForm {
  const today = todayYmdInTz();
  return {
    supplier_id: "",
    supplier_label: "",
    supplier_new: "",
    invoice_number: "",
    invoice_date: today,
    due_date: today,
    amount: "",
    status: "pending",
  };
}

type EditDraft = {
  amount: string;
  status: "pending" | "paid";
  supplier_id: number | "";
  supplier_label: string;
  supplier_new: string;
};

export default function FacturasPageClient() {
  const router = useRouter();
  const toast = useToast();

  const [drogueriaId, setDrogueriaId] = useSelectedDrogueria();
  const [statusFilter, setStatusFilter] = useState<"" | InvoiceStatus>("");
  const [supplierFilter, setSupplierFilter] = useState<number | "">("");
  const [supplierFilterLabel, setSupplierFilterLabel] = useState("");
  const [selectedMonth, setSelectedMonth] = useState(() =>
    monthFromYmd(todayYmdInTz())
  );

  const [items, setItems] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<number | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [draft, setDraft] = useState<DraftForm>(emptyDraft);
  const [creating, setCreating] = useState(false);

  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [editDraft, setEditDraft] = useState<EditDraft | null>(null);
  const [editMounted, setEditMounted] = useState(false);
  const [editVisible, setEditVisible] = useState(false);
  const editCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const expireAuth = useCallback(() => {
    removeToken();
    toast.show("Sesión expirada. Inicia sesión de nuevo.", "error");
    router.replace("/login");
  }, [router, toast]);

  const load = useCallback(async () => {
    const year = yearFromYmd(todayYmdInTz());
    const { from, to } = ymdBoundsForMonth(year, selectedMonth);
    setLoading(true);
    setError(null);
    try {
      const res = await getInvoices({
        drogueria_id: drogueriaId,
        status: statusFilter,
        supplier_id: supplierFilter,
        date_from: from,
        date_to: to,
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
    drogueriaId,
    expireAuth,
    selectedMonth,
    statusFilter,
    supplierFilter,
  ]);

  useEffect(() => {
    void load();
  }, [load]);

  const startEdit = (inv: Invoice) => {
    if (editCloseTimer.current) {
      clearTimeout(editCloseTimer.current);
      editCloseTimer.current = null;
    }
    setEditingInvoice(inv);
    setEditDraft({
      amount: inv.amount,
      status: editableStatus(inv.status),
      supplier_id: inv.supplier_id,
      supplier_label: inv.supplier,
      supplier_new: "",
    });
    setEditMounted(true);
    setEditVisible(false);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setEditVisible(true));
    });
  };

  const closeEdit = useCallback(() => {
    if (savingId != null) return;
    setEditVisible(false);
    if (editCloseTimer.current) clearTimeout(editCloseTimer.current);
    editCloseTimer.current = setTimeout(() => {
      setEditingInvoice(null);
      setEditDraft(null);
      setEditMounted(false);
      editCloseTimer.current = null;
    }, 220);
  }, [savingId]);

  const saveEdit = async () => {
    if (!editDraft || !editingInvoice) return;
    const inv = editingInvoice;
    const amount = editDraft.amount.trim();
    if (!amount) {
      toast.show("El monto no puede quedar vacío.", "error");
      return;
    }
    const payload: {
      id: number;
      status?: "pending" | "paid";
      amount?: string;
      supplier_id?: number;
      supplier?: string;
    } = { id: inv.id };
    if (amount !== inv.amount) payload.amount = amount;
    const nextStatus = editDraft.status;
    const prevEditable = editableStatus(inv.status);
    if (nextStatus !== prevEditable) payload.status = nextStatus;

    const newName =
      editDraft.supplier_new.trim() || editDraft.supplier_label.trim();
    if (editDraft.supplier_id !== "" && editDraft.supplier_id !== inv.supplier_id) {
      payload.supplier_id = Number(editDraft.supplier_id);
    } else if (
      editDraft.supplier_id === "" &&
      newName &&
      newName.toLowerCase() !== inv.supplier.toLowerCase()
    ) {
      payload.supplier = newName;
    }

    if (
      payload.amount == null &&
      payload.status == null &&
      payload.supplier_id == null &&
      payload.supplier == null
    ) {
      closeEdit();
      return;
    }

    setSavingId(inv.id);
    try {
      const res = await patchInvoice(payload);
      if (!res.ok) {
        setSavingId(null);
        if (res.status === 401) {
          expireAuth();
          return;
        }
        toast.show(
          apiErrorMessage(res.body, "No se pudo actualizar la factura."),
          "error"
        );
        return;
      }
      setItems((prev) =>
        prev.map((it) => (it.id === res.data.id ? res.data : it))
      );
      toast.show(`Factura ${res.data.invoice_number} actualizada.`, "success");
      setSavingId(null);
      setEditVisible(false);
      if (editCloseTimer.current) clearTimeout(editCloseTimer.current);
      editCloseTimer.current = setTimeout(() => {
        setEditingInvoice(null);
        setEditDraft(null);
        setEditMounted(false);
        editCloseTimer.current = null;
      }, 220);
    } catch {
      toast.show("Error de red al actualizar la factura.", "error");
      setSavingId(null);
    }
  };

  useEffect(() => {
    if (!editMounted) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeEdit();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editMounted, closeEdit]);

  useEffect(() => {
    return () => {
      if (editCloseTimer.current) clearTimeout(editCloseTimer.current);
    };
  }, []);

  const onCreate = async (e: FormEvent) => {
    e.preventDefault();
    const number = draft.invoice_number.trim();
    const amount = draft.amount.trim();
    if (!number || !amount || !draft.invoice_date || !draft.due_date) {
      toast.show("Completa número, fechas y monto.", "error");
      return;
    }
    const hasExisting = draft.supplier_id !== "";
    const newName = draft.supplier_new.trim() || draft.supplier_label.trim();
    if (!hasExisting && !newName) {
      toast.show("Elige o escribe un proveedor.", "error");
      return;
    }

    setCreating(true);
    try {
      const item = hasExisting
        ? {
            supplier_id: Number(draft.supplier_id),
            invoice_number: number,
            invoice_date: draft.invoice_date,
            due_date: draft.due_date,
            amount,
            status: draft.status,
          }
        : {
            supplier: newName,
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
          <SupplierTypeahead
            className="min-w-[14rem] flex-1 sm:max-w-xs"
            valueId={supplierFilter}
            valueLabel={supplierFilterLabel}
            disabled={loading}
            placeholder="Filtrar proveedor…"
            onAuthExpired={expireAuth}
            onSelect={(s) => {
              if (!s) {
                setSupplierFilter("");
                setSupplierFilterLabel("");
                return;
              }
              setSupplierFilter(s.id);
              setSupplierFilterLabel(s.name);
            }}
          />
          <label
            className="inline-flex items-center gap-2 text-sm font-semibold"
            style={{ color: "var(--primary-800)" }}
          >
            Mes
            <select
              value={selectedMonth}
              disabled={loading}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              className="h-9 min-w-[7.5rem] cursor-pointer rounded-lg border-2 px-2 text-sm font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[color:var(--primary-400)] disabled:cursor-not-allowed disabled:opacity-60"
              style={{
                borderColor: "var(--primary-400)",
                color: "var(--foreground)",
                backgroundColor:
                  "color-mix(in srgb, var(--primary-600) 14%, var(--background))",
              }}
            >
              {MONTH_NAMES_ES.map((name, i) => (
                <option key={name} value={i + 1}>
                  {name}
                </option>
              ))}
            </select>
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
            <SupplierTypeahead
              className="sm:col-span-2"
              valueId={draft.supplier_id}
              valueLabel={draft.supplier_label || draft.supplier_new}
              disabled={creating}
              allowCreate
              placeholder="Buscar o escribir proveedor…"
              onAuthExpired={expireAuth}
              onSelect={(s) => {
                if (!s) {
                  setDraft((d) => ({
                    ...d,
                    supplier_id: "",
                    supplier_label: "",
                  }));
                  return;
                }
                setDraft((d) => ({
                  ...d,
                  supplier_id: s.id,
                  supplier_label: s.name,
                  supplier_new: "",
                }));
              }}
              onFreeText={(name) =>
                setDraft((d) => ({
                  ...d,
                  supplier_id: "",
                  supplier_label: name,
                  supplier_new: name,
                }))
              }
            />

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
            <table className="w-full min-w-[44rem] border-collapse">
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
                        <button
                          type="button"
                          disabled={busy || loading || editingInvoice != null}
                          onClick={() => startEdit(inv)}
                          className="rounded-lg px-2.5 py-1 text-xs font-semibold text-white disabled:opacity-60"
                          style={{ backgroundColor: "var(--primary-600)" }}
                        >
                          Editar
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {editMounted && editingInvoice && editDraft
        ? createPortal(
            <div
              className="fixed inset-0 z-[400] flex items-center justify-center p-4"
              role="presentation"
            >
              <div
                className="absolute inset-0 transition-opacity duration-200 ease-out"
                style={{
                  backgroundColor:
                    "color-mix(in srgb, var(--foreground) 28%, transparent)",
                  opacity: editVisible ? 1 : 0,
                }}
                aria-hidden
                onMouseDown={() => closeEdit()}
              />
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="edit-invoice-title"
                className="relative z-10 w-full max-w-md rounded-2xl border p-5 transition-[opacity,transform] duration-200 ease-out"
                style={{
                  borderColor: "var(--primary-200)",
                  backgroundColor: "var(--background)",
                  boxShadow: "none",
                  opacity: editVisible ? 1 : 0,
                  transform: editVisible
                    ? "translateY(0) scale(1)"
                    : "translateY(10px) scale(0.96)",
                }}
              >
                <h2
                  id="edit-invoice-title"
                  className="text-lg font-bold"
                  style={{ color: "var(--primary-800)" }}
                >
                  Editar factura {editingInvoice.invoice_number}
                </h2>
                <p
                  className="mt-1 text-xs"
                  style={{ color: "var(--primary-700)" }}
                >
                  Cambia proveedor, monto o estado (pendiente / pagada).
                </p>

                <div className="mt-4 flex flex-col gap-3">
                  <SupplierTypeahead
                    valueId={editDraft.supplier_id}
                    valueLabel={
                      editDraft.supplier_label || editDraft.supplier_new
                    }
                    disabled={savingId === editingInvoice.id}
                    allowCreate
                    placeholder="Buscar proveedor…"
                    onAuthExpired={expireAuth}
                    onSelect={(s) => {
                      if (!s) {
                        setEditDraft((d) =>
                          d
                            ? { ...d, supplier_id: "", supplier_label: "" }
                            : d
                        );
                        return;
                      }
                      setEditDraft((d) =>
                        d
                          ? {
                              ...d,
                              supplier_id: s.id,
                              supplier_label: s.name,
                              supplier_new: "",
                            }
                          : d
                      );
                    }}
                    onFreeText={(name) =>
                      setEditDraft((d) =>
                        d
                          ? {
                              ...d,
                              supplier_id: "",
                              supplier_label: name,
                              supplier_new: name,
                            }
                          : d
                      )
                    }
                  />
                  <label
                    className="flex flex-col gap-1 text-sm font-semibold"
                    style={{ color: "var(--primary-800)" }}
                  >
                    Monto
                    <input
                      value={editDraft.amount}
                      disabled={savingId === editingInvoice.id}
                      onChange={(e) =>
                        setEditDraft((d) =>
                          d ? { ...d, amount: e.target.value } : d
                        )
                      }
                      className={inputClass}
                      style={inputStyle}
                      inputMode="decimal"
                    />
                  </label>
                  <label
                    className="flex flex-col gap-1 text-sm font-semibold"
                    style={{ color: "var(--primary-800)" }}
                  >
                    Estado
                    <select
                      value={editDraft.status}
                      disabled={savingId === editingInvoice.id}
                      onChange={(e) =>
                        setEditDraft((d) =>
                          d
                            ? {
                                ...d,
                                status: e.target.value as "pending" | "paid",
                              }
                            : d
                        )
                      }
                      className={inputClass}
                      style={inputStyle}
                    >
                      <option value="pending">Pendiente</option>
                      <option value="paid">Pagada</option>
                    </select>
                  </label>
                </div>

                <div className="mt-5 flex justify-end gap-2">
                  <button
                    type="button"
                    disabled={savingId === editingInvoice.id}
                    onClick={closeEdit}
                    className="h-10 rounded-xl border-2 px-4 text-sm font-semibold disabled:opacity-60"
                    style={{
                      borderColor: "var(--primary-400)",
                      color: "var(--primary-800)",
                      backgroundColor: "transparent",
                    }}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    disabled={savingId === editingInvoice.id}
                    onClick={() => void saveEdit()}
                    className="h-10 rounded-xl px-4 text-sm font-semibold text-white disabled:opacity-60"
                    style={{ backgroundColor: "var(--primary-600)" }}
                  >
                    {savingId === editingInvoice.id ? "Guardando…" : "Guardar"}
                  </button>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </section>
  );
}
