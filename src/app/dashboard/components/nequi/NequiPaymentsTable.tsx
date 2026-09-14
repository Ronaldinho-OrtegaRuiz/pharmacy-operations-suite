"use client";

import React from "react";
import { formatValorCOPTable } from "@/lib/money-format";
import type { Drogueria } from "@/lib/droguerias";
import type { NequiPayment } from "@/lib/nequi-payments";
import { SCROLL_ROW_THRESHOLD } from "@/app/dashboard/components/payments/constants";

type Props = {
  items: NequiPayment[];
  page: number;
  pageSize: number;
  stores: Drogueria[];
  isAdmin: boolean;
  busyId: number | null;
  loading?: boolean;
  onAssign: (payment: NequiPayment, drogueriaId: number | null) => void;
  onDelete: (payment: NequiPayment) => void;
};

/** Solo HH:mm — el día lo marca el filtro de fecha. */
function formatHora(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString("es-CO", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    hourCycle: "h23",
  });
}

export default function NequiPaymentsTable({
  items,
  page,
  pageSize,
  stores,
  isAdmin,
  busyId,
  loading,
  onAssign,
  onDelete,
}: Props) {
  const useBodyScroll = !loading && items.length > SCROLL_ROW_THRESHOLD;
  const colSpan = isAdmin ? 6 : 5;

  const thSticky: React.CSSProperties = useBodyScroll
    ? {
        position: "sticky",
        top: 0,
        zIndex: 2,
        backgroundColor: "var(--primary-100)",
        boxShadow: "0 1px 0 var(--primary-200)",
      }
    : {};

  return (
    <div
      className="w-full overflow-hidden rounded-2xl border"
      style={{
        borderColor: "var(--primary-200)",
        backgroundColor:
          "color-mix(in srgb, var(--primary-600) 6%, var(--background))",
      }}
    >
      <div
        className={
          useBodyScroll
            ? "max-h-[min(28rem,52vh)] overflow-auto overscroll-contain"
            : "overflow-x-auto"
        }
      >
        <table className="w-full border-collapse">
          <thead>
            <tr
              style={{
                backgroundColor: "var(--primary-100)",
                color: "var(--primary-800)",
              }}
            >
              <th
                style={{
                  ...thStyle,
                  ...thSticky,
                  width: "70px",
                  textAlign: "center",
                }}
              >
                #
              </th>
              <th style={{ ...thStyle, ...thSticky }}>CLIENTE</th>
              <th style={{ ...thStyle, ...thSticky }}>VALOR</th>
              <th style={{ ...thStyle, ...thSticky }}>HORA</th>
              <th style={{ ...thStyle, ...thSticky }}>DROGUERÍA</th>
              {isAdmin ? (
                <th
                  style={{
                    ...thStyle,
                    ...thSticky,
                    textAlign: "center",
                    width: "100px",
                  }}
                >
                  ACCIONES
                </th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr
                style={{
                  backgroundColor:
                    "color-mix(in srgb, var(--primary-600) 10%, var(--background))",
                }}
              >
                <td
                  colSpan={colSpan}
                  style={{
                    ...tdStyle,
                    textAlign: "center",
                    color: "var(--primary-700)",
                    fontWeight: 600,
                  }}
                >
                  Cargando pagos…
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr
                style={{
                  backgroundColor:
                    "color-mix(in srgb, var(--primary-600) 10%, var(--background))",
                }}
              >
                <td
                  colSpan={colSpan}
                  style={{
                    ...tdStyle,
                    textAlign: "center",
                    color: "var(--primary-700)",
                    fontWeight: 600,
                  }}
                >
                  No hay pagos Nequi para mostrar.
                </td>
              </tr>
            ) : (
              items.map((r, idx) => {
                const rowNum = (page - 1) * pageSize + idx + 1;
                const zebra =
                  idx % 2 === 0
                    ? "color-mix(in srgb, var(--primary-600) 8%, var(--background))"
                    : "color-mix(in srgb, var(--primary-600) 14%, var(--background))";
                const busy = busyId === r.id;
                return (
                  <tr key={r.id} style={{ backgroundColor: zebra }}>
                    <td
                      style={{
                        ...tdStyle,
                        textAlign: "center",
                        fontWeight: 700,
                        color: "var(--primary-700)",
                      }}
                    >
                      {rowNum}
                    </td>
                    <td
                      style={{
                        ...tdStyle,
                        color: "var(--foreground)",
                        fontWeight: 600,
                      }}
                      title={r.raw_text ?? undefined}
                    >
                      {r.client}
                    </td>
                    <td
                      style={{
                        ...tdStyle,
                        color: "var(--primary-700)",
                        fontWeight: 600,
                      }}
                    >
                      {formatValorCOPTable(r.value)}
                    </td>
                    <td
                      style={{
                        ...tdStyle,
                        color:
                          "color-mix(in srgb, var(--foreground) 82%, var(--primary-500))",
                        fontWeight: 600,
                      }}
                    >
                      {formatHora(r.notified_at)}
                    </td>
                    <td style={{ ...tdStyle }}>
                      <select
                        value={
                          r.drogueria_id == null ? "" : String(r.drogueria_id)
                        }
                        disabled={busy || loading}
                        onChange={(e) => {
                          const v = e.target.value;
                          onAssign(r, v === "" ? null : Number(v));
                        }}
                        className="h-9 w-full min-w-[8.5rem] cursor-pointer rounded-xl border-2 px-2 text-sm font-semibold outline-none disabled:cursor-not-allowed disabled:opacity-60"
                        style={{
                          borderColor: "var(--primary-400)",
                          backgroundColor:
                            "color-mix(in srgb, var(--primary-600) 12%, var(--background))",
                          color: "var(--foreground)",
                        }}
                        aria-label={`Droguería de ${r.client}`}
                      >
                        <option value="">Sin asignar</option>
                        {stores.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    {isAdmin ? (
                      <td
                        style={{
                          ...tdStyle,
                          textAlign: "center",
                        }}
                      >
                        <button
                          type="button"
                          disabled={busy || loading}
                          onClick={() => onDelete(r)}
                          className="h-9 rounded-xl border-2 px-3 text-xs font-semibold disabled:opacity-60"
                          style={{
                            borderColor:
                              "color-mix(in srgb, #f87171 55%, var(--primary-200))",
                            color: "var(--foreground)",
                            backgroundColor:
                              "color-mix(in srgb, #ef4444 12%, var(--background))",
                          }}
                        >
                          Borrar
                        </button>
                      </td>
                    ) : null}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const borderColor = "var(--primary-200)";

const thStyle: React.CSSProperties = {
  borderBottom: `1px solid ${borderColor}`,
  borderRight: `1px solid ${borderColor}`,
  padding: "14px 16px",
  textAlign: "left",
  fontSize: "14px",
  fontWeight: 700,
};

const tdStyle: React.CSSProperties = {
  borderRight: `1px solid ${borderColor}`,
  borderBottom: `1px solid ${borderColor}`,
  padding: "14px 16px",
  fontSize: "14px",
};
