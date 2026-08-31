"use client";

import { useToast } from "@/components/ToastProvider";
import { removeToken } from "@/lib/auth-storage";
import {
  getDroguerias,
  MAX_SHIFT_COUNT,
  MIN_SHIFT_COUNT,
  patchDrogueriaShiftCount,
  type Drogueria,
} from "@/lib/droguerias";
import { apiErrorMessage } from "@/lib/sales";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

export default function SettingsPageClient() {
  const router = useRouter();
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<Drogueria[]>([]);

  const expireAuth = useCallback(() => {
    removeToken();
    toast.show("Sesión expirada. Inicia sesión de nuevo.", "error");
    router.replace("/login");
  }, [router, toast]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getDroguerias();
      if (!res.ok) {
        if (res.status === 401) {
          expireAuth();
          return;
        }
        setError(
          apiErrorMessage(res.body, "No se pudieron cargar las droguerías.")
        );
        setItems([]);
        return;
      }
      setItems(res.data);
    } catch {
      setError("Error de red al cargar droguerías.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [expireAuth]);

  useEffect(() => {
    void load();
  }, [load]);

  const onShiftCountChange = async (id: number, shift_count: number) => {
    const prev = items.find((d) => d.id === id);
    if (!prev || prev.shift_count === shift_count) return;
    setSavingId(id);
    try {
      const res = await patchDrogueriaShiftCount(id, shift_count);
      if (!res.ok) {
        if (res.status === 401) {
          expireAuth();
          return;
        }
        toast.show(
          apiErrorMessage(res.body, "No se pudo actualizar los turnos."),
          "error"
        );
        return;
      }
      setItems((list) =>
        list.map((d) => (d.id === res.data.id ? res.data : d))
      );
      toast.show(
        `${res.data.name}: ${res.data.shift_count} ${
          res.data.shift_count === 1 ? "turno" : "turnos"
        }.`,
        "success"
      );
    } catch {
      toast.show("Error de red al guardar los turnos.", "error");
    } finally {
      setSavingId(null);
    }
  };

  return (
    <section aria-label="Configuración" className="w-full max-w-5xl pb-8">
      <h1
        className="text-2xl font-bold"
        style={{ color: "var(--primary-800)" }}
      >
        Configuración
      </h1>
      <p className="mt-1 text-sm" style={{ color: "var(--primary-700)" }}>
        Número de turnos por droguería (1 a {MAX_SHIFT_COUNT}). Eso define
        cuántas cajas aparecen en Ventas.
      </p>

      {error ? (
        <div
          className="mt-6 rounded-xl border px-4 py-3 text-sm font-medium"
          style={{
            borderColor: "color-mix(in srgb, #f87171 45%, var(--primary-200))",
            backgroundColor: "color-mix(in srgb, #ef4444 14%, var(--background))",
            color: "var(--foreground)",
          }}
        >
          {error}
        </div>
      ) : null}

      {loading ? (
        <p
          className="mt-8 text-sm font-medium"
          style={{ color: "var(--primary-700)" }}
        >
          Cargando droguerías…
        </p>
      ) : (
        <ul className="mt-6 flex flex-col gap-4">
          {items.map((d) => (
            <li
              key={d.id}
              className="flex flex-col gap-3 rounded-2xl border p-4 sm:flex-row sm:items-center sm:justify-between"
              style={{
                borderColor: "var(--primary-200)",
                backgroundColor:
                  "color-mix(in srgb, var(--primary-600) 8%, var(--background))",
              }}
            >
              <div>
                <p
                  className="text-base font-bold"
                  style={{ color: "var(--primary-800)" }}
                >
                  {d.name}
                </p>
              </div>
              <label
                className="flex flex-col gap-1 text-sm font-semibold"
                style={{ color: "var(--primary-800)" }}
              >
                Turnos
                <select
                  value={d.shift_count}
                  disabled={savingId === d.id}
                  onChange={(e) =>
                    void onShiftCountChange(d.id, Number(e.target.value))
                  }
                  className="min-w-[8rem] cursor-pointer rounded-xl border-2 px-3 py-2 font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[color:var(--primary-400)] disabled:cursor-not-allowed disabled:opacity-60"
                  style={{
                    borderColor: "var(--primary-400)",
                    color: "var(--foreground)",
                    backgroundColor:
                      "color-mix(in srgb, var(--primary-600) 14%, var(--background))",
                  }}
                  aria-label={`Turnos de ${d.name}`}
                >
                  {Array.from(
                    { length: MAX_SHIFT_COUNT - MIN_SHIFT_COUNT + 1 },
                    (_, i) => MIN_SHIFT_COUNT + i
                  ).map((n) => (
                    <option key={n} value={n}>
                      {n} {n === 1 ? "turno" : "turnos"}
                    </option>
                  ))}
                </select>
              </label>
            </li>
          ))}
        </ul>
      )}

      {!loading && !error && items.length === 0 ? (
        <p
          className="mt-6 text-sm font-medium"
          style={{ color: "var(--primary-700)" }}
        >
          No hay droguerías registradas.
        </p>
      ) : null}
    </section>
  );
}
