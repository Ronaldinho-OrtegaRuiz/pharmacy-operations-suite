"use client";

import { useToast } from "@/components/ToastProvider";
import { getAuthUsername, getToken, removeToken } from "@/lib/auth-storage";
import {
  clampPaymentsDateQueryPart,
  clampYmd,
  nonAdminDateBounds,
} from "@/lib/payment-date-bounds";
import { canAccessStats } from "@/lib/stats-access";
import {
  detailFromBody,
  getPayments,
  getPaymentsWebSocketUrl,
  type PaymentItem,
  type PaymentsQueryParams,
} from "@/lib/payments";
import {
  playQrPaymentSound,
  unlockQrPaymentSound,
} from "@/lib/qr-payment-sound";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ClientsTable from "./ClientsTable";
import { DEFAULT_PAGE_SIZE } from "./constants";
import DateFilterControls, {
  type PaymentDateMode,
} from "./DateFilterControls";
import PaymentsPaginationView from "./PaymentsPaginationView";
import StoreBadges from "./StoreBadges";
import { useSelectedDrogueria } from "@/lib/use-selected-drogueria";

function todayOnDateLocal(): string {
  const n = new Date();
  const p = (x: number) => String(x).padStart(2, "0");
  return `${n.getFullYear()}-${p(n.getMonth() + 1)}-${p(n.getDate())}`;
}

function errorMessage(body: unknown, fallback: string): string {
  const d = detailFromBody(body);
  if (d) return d;
  if (body && typeof body === "object" && "message" in body) {
    const m = (body as { message?: unknown }).message;
    if (typeof m === "string" && m.trim()) return m;
  }
  return fallback;
}

function buildDateQuery(
  mode: PaymentDateMode,
  today: string,
  specificDate: string,
  rangeFrom: string,
  rangeTo: string
): Pick<PaymentsQueryParams, "on_date" | "date_from" | "date_to"> {
  if (mode === "especifica") {
    return { on_date: specificDate || today };
  }
  let from = rangeFrom;
  let to = rangeTo;
  if (from && to && from > to) {
    [from, to] = [to, from];
  }
  if (from && to) {
    return { date_from: from, date_to: to };
  }
  // Rango incompleto: mismo día (evita pedir todo el histórico sin filtro)
  return { on_date: today };
}

export default function DashboardPaymentsSection() {
  const router = useRouter();
  const toast = useToast();

  const [drogueriaId, setDrogueriaId] = useSelectedDrogueria();
  const [sessionUser, setSessionUser] = useState<string | null | undefined>(
    undefined
  );
  const [dateMode, setDateMode] = useState<PaymentDateMode>("especifica");
  const [specificDate, setSpecificDate] = useState(() => todayOnDateLocal());
  const [rangeFrom, setRangeFrom] = useState(() => todayOnDateLocal());
  const [rangeTo, setRangeTo] = useState(() => todayOnDateLocal());

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [sort, setSort] = useState<"asc" | "desc">("desc");

  const [items, setItems] = useState<PaymentItem[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);

  const loadRef = useRef<() => Promise<void>>(undefined);

  const restrictPaymentDates =
    sessionUser !== undefined && !canAccessStats(sessionUser);

  useEffect(() => {
    setSessionUser(getAuthUsername());
  }, []);

  useEffect(() => {
    if (sessionUser === undefined) return;
    if (canAccessStats(sessionUser)) return;
    const { min, max } = nonAdminDateBounds();
    setDateMode((m) => (m === "rango" ? "especifica" : m));
    setSpecificDate((s) => clampYmd(s || max, min, max));
    setRangeFrom((r) => clampYmd(r || max, min, max));
    setRangeTo((r) => clampYmd(r || max, min, max));
  }, [sessionUser]);

  const totalLabel = useMemo(() => {
    const today = todayOnDateLocal();
    if (dateMode === "especifica") return `Total (${specificDate || today})`;
    if (rangeFrom && rangeTo) {
      return `Total (${rangeFrom} → ${rangeTo})`;
    }
    return "Total en el rango";
  }, [dateMode, specificDate, rangeFrom, rangeTo]);

  const loadPayments = useCallback(async () => {
    setLoading(true);
    try {
      const today = todayOnDateLocal();
      let datePart = buildDateQuery(
        dateMode,
        today,
        specificDate,
        rangeFrom,
        rangeTo
      );
      if (restrictPaymentDates) {
        datePart = clampPaymentsDateQueryPart(
          datePart,
          nonAdminDateBounds()
        ) as typeof datePart;
      }

      const result = await getPayments({
        page,
        page_size: pageSize,
        sort,
        drogueria_id: drogueriaId,
        ...datePart,
      });

      if (!result.ok) {
        if (result.status === 401) {
          removeToken();
          toast.show("Sesión expirada. Inicia sesión de nuevo.", "error");
          router.replace("/login");
          return;
        }
        const msg = errorMessage(
          result.body,
          result.status === 503
            ? "Servicio no disponible (p. ej. falta DATABASE_URL)."
            : "No se pudieron cargar los pagos."
        );
        toast.show(msg, "error");
        setItems([]);
        setTotal(0);
        setPages(1);
        return;
      }

      const { items: list, total: t, pages: pg } = result.data;
      setItems(list);
      setTotal(t);
      const effectivePages =
        t === 0 ? 1 : Math.max(1, pg);
      setPages(effectivePages);
      if (page > effectivePages) {
        setPage(effectivePages);
      }
    } catch {
      // fetch() rechaza ante red/offline; no borramos la tabla por si ya había datos cargados.
      toast.show(
        "No se pudo actualizar la lista. Revisa la conexión o vuelve a intentar.",
        "error"
      );
    } finally {
      setLoading(false);
    }
  }, [
    page,
    pageSize,
    sort,
    dateMode,
    specificDate,
    rangeFrom,
    rangeTo,
    drogueriaId,
    restrictPaymentDates,
    router,
    toast,
  ]);

  loadRef.current = loadPayments;

  useEffect(() => {
    void loadPayments();
  }, [loadPayments]);

  useEffect(() => {
    const onGesture = () => unlockQrPaymentSound();
    window.addEventListener("pointerdown", onGesture, { passive: true });
    window.addEventListener("keydown", onGesture);
    return () => {
      window.removeEventListener("pointerdown", onGesture);
      window.removeEventListener("keydown", onGesture);
    };
  }, []);

  useEffect(() => {
    const token = getToken();
    if (!token) return;

    let ws: WebSocket;
    try {
      ws = new WebSocket(getPaymentsWebSocketUrl(token));
    } catch {
      return;
    }

    ws.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data as string) as { type?: string };
        if (data?.type === "new_payment") {
          playQrPaymentSound();
          void loadRef.current?.();
        }
      } catch {
        // ignorar frames no JSON
      }
    };

    return () => {
      ws.close();
    };
  }, []);

  const handleDateModeChange = (mode: PaymentDateMode) => {
    setDateMode(mode);
    setPage(1);
    const t = todayOnDateLocal();
    if (mode === "especifica") {
      setSpecificDate(t);
    }
    if (mode === "rango") {
      setRangeFrom(t);
      setRangeTo(t);
    }
  };

  const handleDrogueriaChange = (id: number) => {
    setDrogueriaId(id);
    setPage(1);
  };

  const handlePageSizeChange = (n: number) => {
    setPageSize(n);
    setPage(1);
  };

  const handleSortChange = (next: "asc" | "desc") => {
    setSort(next);
    setPage(1);
  };

  /** Vuelve a pedir GET /payments (el servidor ya puede haber insertado vía monitor; el WS avisa de nuevos). */
  const handleRefreshPayments = () => {
    void loadRef.current?.();
  };

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col items-center justify-start px-2 pb-10 pt-4 sm:pt-6">
      {/* Badges arriba fijos: sin justify-center para que no “salten” con la altura del contenido */}
      <div className="w-full max-w-4xl shrink-0">
        <StoreBadges
          drogueriaId={drogueriaId}
          onDrogueriaChange={handleDrogueriaChange}
        />
      </div>

      {/* Más aire bajo badges: fecha/tablas más abajo */}
      <div className="h-8 w-full sm:h-12" aria-hidden />

      <div className="flex w-full max-w-4xl flex-col gap-2 sm:gap-3">
        {/* Altura mínima fija: modo fecha específica vs rango no mueve el bloque de abajo */}
        <div className="flex min-h-[11.5rem] w-full flex-col gap-4 sm:min-h-[7.5rem] sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-h-[6.5rem] min-w-0 flex-1 flex-col justify-start sm:min-h-[5.5rem]">
            <DateFilterControls
              mode={dateMode}
              onModeChange={handleDateModeChange}
              specificDate={specificDate}
              onSpecificDateChange={(v) => {
                if (restrictPaymentDates) {
                  const { min, max } = nonAdminDateBounds();
                  setSpecificDate(clampYmd(v, min, max));
                } else {
                  setSpecificDate(v);
                }
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
              fullDateAccess={!restrictPaymentDates}
              dateBounds={
                restrictPaymentDates ? nonAdminDateBounds() : undefined
              }
            />
          </div>

          <button
            type="button"
            aria-label="Actualizar lista de pagos"
            disabled={loading}
            onClick={handleRefreshPayments}
            className="flex h-10 shrink-0 items-center justify-center self-start rounded-xl px-3 disabled:cursor-not-allowed disabled:opacity-60"
            style={{ backgroundColor: "var(--primary-600)", color: "white" }}
            title="Volver a cargar los pagos (GET /payments)"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              focusable="false"
              viewBox="0 0 12 12"
              aria-hidden="true"
            >
              <path
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                d="M10 4c-.8-1.1-2-2.5-4.1-2.5-2.5 0-4.4 2-4.4 4.5s2 4.5 4.4 4.5c1.3 0 2.5-.6 3.3-1.5m1.3-7.5V4c0 .3-.2.5-.5.5H7.5"
              />
            </svg>
          </button>
        </div>

        <ClientsTable
          items={items}
          page={page}
          pageSize={pageSize}
          sort={sort}
          onSortChange={handleSortChange}
          loading={loading}
        />
        <PaymentsPaginationView
          total={total}
          page={Math.min(page, pages)}
          pages={pages}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={handlePageSizeChange}
          loading={loading}
          totalLabel={totalLabel}
        />
      </div>
    </div>
  );
}
