"use client";

import { useToast } from "@/components/ToastProvider";
import DateFilterControls, {
  type PaymentDateMode,
} from "@/app/dashboard/components/payments/DateFilterControls";
import PaymentsPaginationView from "@/app/dashboard/components/payments/PaymentsPaginationView";
import { getAuthUsername, removeToken } from "@/lib/auth-storage";
import { getDroguerias, type Drogueria } from "@/lib/droguerias";
import { formatValorCOPTable } from "@/lib/money-format";
import {
  apiErrorMessage,
  deleteNequiPayment,
  getNequiPayments,
  patchNequiPayment,
  type NequiAssignedFilter,
  type NequiPayment,
} from "@/lib/nequi-payments";
import {
  addCalendarDaysToYmd,
  clampYmd,
  todayYmdInTz,
} from "@/lib/payment-date-bounds";
import { canAccessStats } from "@/lib/stats-access";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import NequiPaymentsTable from "./NequiPaymentsTable";

const DEFAULT_PAGE_SIZE = 20;
/** No admin: hoy + 2 días atrás. */
const NEQUI_NON_ADMIN_DAYS_BACK = 2;

function nequiNonAdminBounds(): { min: string; max: string } {
  const max = todayYmdInTz();
  return {
    min: addCalendarDaysToYmd(max, -NEQUI_NON_ADMIN_DAYS_BACK),
    max,
  };
}

function chipStyle(active: boolean): CSSProperties {
  return {
    borderColor: active ? "var(--primary-600)" : "var(--primary-400)",
    backgroundColor: active
      ? "var(--primary-600)"
      : "color-mix(in srgb, var(--primary-600) 10%, var(--background))",
    color: active ? "white" : "var(--primary-800)",
  };
}

export default function NequiPageClient() {
  const router = useRouter();
  const toast = useToast();

  const [sessionUser, setSessionUser] = useState<string | null | undefined>(
    undefined
  );
  const [stores, setStores] = useState<Drogueria[]>([]);
  const [items, setItems] = useState<NequiPayment[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [assigned, setAssigned] = useState<NequiAssignedFilter>("all");
  const [dateMode, setDateMode] = useState<PaymentDateMode>("especifica");
  const [specificDate, setSpecificDate] = useState(() => todayYmdInTz());
  const [rangeFrom, setRangeFrom] = useState(() => todayYmdInTz());
  const [rangeTo, setRangeTo] = useState(() => todayYmdInTz());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const isAdmin =
    sessionUser !== undefined && canAccessStats(sessionUser);
  const restrictDates =
    sessionUser !== undefined && !canAccessStats(sessionUser);

  const dateBounds = useMemo(
    () => (restrictDates ? nequiNonAdminBounds() : undefined),
    [restrictDates]
  );

  useEffect(() => {
    setSessionUser(getAuthUsername());
  }, []);

  useEffect(() => {
    if (sessionUser === undefined) return;
    if (canAccessStats(sessionUser)) return;
    const { min, max } = nequiNonAdminBounds();
    setDateMode("especifica");
    setSpecificDate((s) => clampYmd(s || max, min, max));
    setRangeFrom((r) => clampYmd(r || max, min, max));
    setRangeTo((r) => clampYmd(r || max, min, max));
  }, [sessionUser]);

  const expireAuth = useCallback(() => {
    removeToken();
    toast.show("Sesión expirada. Inicia sesión de nuevo.", "error");
    router.replace("/login");
  }, [router, toast]);

  const loadStores = useCallback(async () => {
    try {
      const res = await getDroguerias();
      if (!res.ok) {
        if (res.status === 401) {
          expireAuth();
          return;
        }
        toast.show("No se pudieron cargar las droguerías.", "error");
        return;
      }
      setStores(res.data);
    } catch {
      toast.show("Error de red al cargar droguerías.", "error");
    }
  }, [expireAuth, toast]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const today = todayYmdInTz();
      let from: string;
      let to: string;
      if (dateMode === "especifica" || restrictDates) {
        const day = specificDate || today;
        from = day;
        to = day;
      } else {
        from = rangeFrom || today;
        to = rangeTo || today;
        if (from > to) {
          const tmp = from;
          from = to;
          to = tmp;
        }
      }
      if (restrictDates) {
        const { min, max } = nequiNonAdminBounds();
        from = clampYmd(from, min, max);
        to = clampYmd(to, min, max);
      }

      const res = await getNequiPayments({
        page,
        page_size: pageSize,
        assigned,
        date_from: from,
        date_to: to,
      });
      if (!res.ok) {
        if (res.status === 401) {
          expireAuth();
          return;
        }
        setError(
          apiErrorMessage(res.body, "No se pudieron cargar los pagos Nequi.")
        );
        setItems([]);
        setTotal(0);
        setPages(1);
        return;
      }
      setItems(res.data.items);
      setTotal(res.data.total);
      const effectivePages =
        res.data.total === 0 ? 1 : Math.max(1, res.data.pages);
      setPages(effectivePages);
      if (page > effectivePages) setPage(effectivePages);
    } catch {
      setError("Error de red al cargar pagos Nequi.");
      setItems([]);
      setTotal(0);
      setPages(1);
    } finally {
      setLoading(false);
    }
  }, [
    assigned,
    dateMode,
    expireAuth,
    page,
    pageSize,
    rangeFrom,
    rangeTo,
    restrictDates,
    specificDate,
  ]);

  useEffect(() => {
    if (sessionUser === undefined) return;
    void loadStores();
  }, [loadStores, sessionUser]);

  useEffect(() => {
    if (sessionUser === undefined) return;
    void load();
  }, [load, sessionUser]);

  const storeName = (id: number | null) => {
    if (id == null) return "Sin asignar";
    return stores.find((s) => s.id === id)?.name ?? `Droguería ${id}`;
  };

  const totalLabel = useMemo(() => {
    if (dateMode === "especifica" || restrictDates) {
      return `Total (${specificDate || todayYmdInTz()})`;
    }
    if (rangeFrom && rangeTo) return `Total (${rangeFrom} → ${rangeTo})`;
    return "Total Nequi";
  }, [dateMode, rangeFrom, rangeTo, restrictDates, specificDate]);

  const onAssign = async (payment: NequiPayment, nextId: number | null) => {
    if (payment.drogueria_id === nextId) return;
    setBusyId(payment.id);
    try {
      const res = await patchNequiPayment({
        id: payment.id,
        drogueria_id: nextId,
      });
      if (!res.ok) {
        if (res.status === 401) {
          expireAuth();
          return;
        }
        toast.show(
          apiErrorMessage(res.body, "No se pudo asignar la droguería."),
          "error"
        );
        return;
      }
      setItems((prev) =>
        prev.map((it) => (it.id === res.data.id ? res.data : it))
      );
      toast.show(
        nextId == null
          ? "Asignación quitada."
          : `Asignado a ${storeName(nextId)}.`,
        "success"
      );
      if (assigned === "false" && nextId != null) void load();
      else if (assigned === "true" && nextId == null) void load();
    } catch {
      toast.show("Error de red al asignar.", "error");
    } finally {
      setBusyId(null);
    }
  };

  const onDelete = async (payment: NequiPayment) => {
    if (!isAdmin) return;
    const ok = window.confirm(
      `¿Borrar el pago de ${payment.client} (${formatValorCOPTable(payment.value)})?`
    );
    if (!ok) return;
    setBusyId(payment.id);
    try {
      const res = await deleteNequiPayment(payment.id);
      if (!res.ok) {
        if (res.status === 401) {
          expireAuth();
          return;
        }
        toast.show(
          apiErrorMessage(res.body, "No se pudo borrar el pago."),
          "error"
        );
        return;
      }
      toast.show("Pago Nequi borrado.", "success");
      void load();
    } catch {
      toast.show("Error de red al borrar.", "error");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section aria-label="Pagos Nequi" className="w-full max-w-5xl pb-8">
      <h1
        className="text-2xl font-bold"
        style={{ color: "var(--primary-800)" }}
      >
        Pagos Nequi
      </h1>
      <p className="mt-1 text-sm" style={{ color: "var(--primary-700)" }}>
        Lista unificada. Asigná la droguería a cada transferencia.
        {isAdmin ? " Como admin podés borrar pagos personales." : ""}
      </p>

      <div className="mt-5 flex w-full flex-col gap-4">
        <div className="flex w-full flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <DateFilterControls
            mode={restrictDates ? "especifica" : dateMode}
            onModeChange={(m) => {
              setDateMode(m);
              setPage(1);
            }}
            specificDate={specificDate}
            onSpecificDateChange={(v) => {
              setSpecificDate(v);
              setPage(1);
            }}
            rangeFrom={rangeFrom}
            rangeTo={rangeTo}
            onRangeFromChange={(v) => {
              setRangeFrom(v);
              setPage(1);
            }}
            onRangeToChange={(v) => {
              setRangeTo(v);
              setPage(1);
            }}
            disabled={loading}
            fullDateAccess={!restrictDates}
            dateBounds={dateBounds}
            restrictedHint="Solo hoy y 2 días atrás"
          />
          <button
            type="button"
            disabled={loading}
            onClick={() => void load()}
            className="h-10 shrink-0 rounded-xl px-4 text-sm font-semibold text-white disabled:opacity-60"
            style={{ backgroundColor: "var(--primary-600)" }}
          >
            {loading ? "Cargando…" : "Actualizar"}
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span
            className="text-sm font-semibold"
            style={{ color: "var(--primary-800)" }}
          >
            Asignación:
          </span>
          {(
            [
              ["all", "Todos"],
              ["false", "Sin asignar"],
              ["true", "Asignados"],
            ] as const
          ).map(([value, label]) => {
            const active = assigned === value;
            return (
              <button
                key={value}
                type="button"
                disabled={loading}
                onClick={() => {
                  setAssigned(value);
                  setPage(1);
                }}
                className="h-9 rounded-xl border-2 px-3 text-sm font-semibold disabled:opacity-60"
                style={chipStyle(active)}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {error ? (
        <div
          className="mt-5 rounded-xl border px-4 py-3 text-sm font-medium"
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

      <div className="mt-5">
        <NequiPaymentsTable
          items={items}
          page={page}
          pageSize={pageSize}
          stores={stores}
          isAdmin={isAdmin}
          busyId={busyId}
          loading={loading}
          onAssign={(p, id) => void onAssign(p, id)}
          onDelete={(p) => void onDelete(p)}
        />
      </div>

      <div className="mt-5">
        <PaymentsPaginationView
          total={total}
          page={page}
          pages={pages}
          pageSize={pageSize}
          loading={loading}
          totalLabel={totalLabel}
          onPageChange={setPage}
          onPageSizeChange={(n) => {
            setPageSize(n);
            setPage(1);
          }}
        />
      </div>
    </section>
  );
}
