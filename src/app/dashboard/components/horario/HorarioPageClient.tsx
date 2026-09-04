"use client";

import { useToast } from "@/components/ToastProvider";
import { getAuthUsername, removeToken } from "@/lib/auth-storage";
import {
  DROGUERIA_RICKY_ID,
  DROGUERIA_YESSI_ID,
} from "@/lib/drogueria-preference";
import {
  apiErrorMessage as empError,
  createEmployee,
  getEmployees,
  patchEmployee,
  type Employee,
} from "@/lib/employees";
import {
  addCalendarDaysToYmd,
  todayYmdInTz,
} from "@/lib/payment-date-bounds";
import {
  apiErrorMessage as schError,
  getSchedule,
  putScheduleBulk,
  type ScheduleBulkItem,
  type ScheduleRange,
} from "@/lib/schedule";
import { canAccessStats } from "@/lib/stats-access";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import ScheduleStoreTable from "./ScheduleStoreTable";

const DAYS_BACK = 3;
const DAYS_FORWARD = 10;
const BULK_MAX = 100;

type PendingCell = {
  drogueria_id: number;
  work_date: string;
  shift_no: number;
  employee_id: number | null;
};

function pendingKey(p: PendingCell): string {
  return `${p.drogueria_id}:${p.work_date}:${p.shift_no}`;
}

function formatRangeLabel(from: string, to: string): string {
  const fmt = (ymd: string) => {
    const m = ymd.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return ymd;
    return `${m[3]}/${m[2]}`;
  };
  return `${fmt(from)} – ${fmt(to)}`;
}

function patchLocalCell(
  prev: ScheduleRange | null,
  workDate: string,
  shiftNo: number,
  employee_id: number | null,
  employee: string | null
): ScheduleRange | null {
  if (!prev) return prev;
  const days = prev.days.map((d) => {
    if (d.date !== workDate) return d;
    const shifts = d.shifts.map((s) =>
      s.shift_no === shiftNo ? { ...s, employee_id, employee } : s
    );
    if (!shifts.some((s) => s.shift_no === shiftNo)) {
      shifts.push({
        shift_no: shiftNo,
        employee_id,
        employee,
        label: null,
        sales_shifts: [],
      });
      shifts.sort((a, b) => a.shift_no - b.shift_no);
    }
    return { ...d, shifts };
  });
  return { ...prev, days };
}

export default function HorarioPageClient() {
  const router = useRouter();
  const toast = useToast();
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const [sessionUser, setSessionUser] = useState<string | null | undefined>(
    undefined
  );
  const [anchorYmd, setAnchorYmd] = useState(() => todayYmdInTz());
  const [ricky, setRicky] = useState<ScheduleRange | null>(null);
  const [yessi, setYessi] = useState<ScheduleRange | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [pending, setPending] = useState<Map<string, PendingCell>>(
    () => new Map()
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  const isAdmin =
    sessionUser !== undefined && canAccessStats(sessionUser);

  const dateFrom = useMemo(
    () => addCalendarDaysToYmd(anchorYmd, -DAYS_BACK),
    [anchorYmd]
  );
  const dateTo = useMemo(
    () => addCalendarDaysToYmd(anchorYmd, DAYS_FORWARD),
    [anchorYmd]
  );
  const today = todayYmdInTz();
  const dirty = pending.size > 0;
  const dirtyKeys = useMemo(() => new Set(pending.keys()), [pending]);

  useEffect(() => {
    setSessionUser(getAuthUsername());
  }, []);

  const expireAuth = useCallback(() => {
    removeToken();
    toast.show("Sesión expirada. Inicia sesión de nuevo.", "error");
    router.replace("/login");
  }, [router, toast]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [rRes, yRes, eRes] = await Promise.all([
        getSchedule({
          drogueria_id: DROGUERIA_RICKY_ID,
          date_from: dateFrom,
          date_to: dateTo,
        }),
        getSchedule({
          drogueria_id: DROGUERIA_YESSI_ID,
          date_from: dateFrom,
          date_to: dateTo,
        }),
        isAdmin
          ? getEmployees()
          : Promise.resolve({ ok: true as const, data: [] as Employee[] }),
      ]);

      if (!rRes.ok) {
        if (rRes.status === 401) {
          expireAuth();
          return;
        }
        setError(schError(rRes.body, "No se pudo cargar el horario de Ricky."));
        setRicky(null);
        setYessi(null);
        return;
      }
      if (!yRes.ok) {
        if (yRes.status === 401) {
          expireAuth();
          return;
        }
        setError(schError(yRes.body, "No se pudo cargar el horario de Yessi."));
        setRicky(rRes.data);
        setYessi(null);
        return;
      }
      setRicky(rRes.data);
      setYessi(yRes.data);
      setPending(new Map());

      if (isAdmin) {
        if (!eRes.ok) {
          if (eRes.status === 401) {
            expireAuth();
            return;
          }
          toast.show(
            empError(eRes.body, "No se pudieron cargar los empleados."),
            "error"
          );
        } else {
          setEmployees(eRes.data);
        }
      }
    } catch {
      setError("Error de red al cargar el horario.");
      setRicky(null);
      setYessi(null);
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, expireAuth, isAdmin, toast]);

  useEffect(() => {
    if (sessionUser === undefined) return;
    void load();
  }, [load, sessionUser]);

  useEffect(() => {
    if (loading) return;
    const root = scrollRef.current;
    if (!root) return;
    const el = root.querySelector(
      `[data-schedule-day="${CSS.escape(today)}"]`
    ) as HTMLElement | null;
    if (!el) return;
    const parent = el.closest(".overflow-x-auto") as HTMLElement | null;
    if (!parent) return;
    const left =
      el.offsetLeft - parent.clientWidth / 2 + el.clientWidth / 2;
    parent.scrollTo({ left: Math.max(0, left), behavior: "smooth" });
  }, [loading, today, ricky, yessi]);

  const queueChange = (
    drogueriaId: number,
    workDate: string,
    shiftNo: number,
    employeeId: number | null,
    employeeName: string | null
  ) => {
    const item: PendingCell = {
      drogueria_id: drogueriaId,
      work_date: workDate,
      shift_no: shiftNo,
      employee_id: employeeId,
    };
    setPending((prev) => {
      const next = new Map(prev);
      next.set(pendingKey(item), item);
      return next;
    });
    if (drogueriaId === DROGUERIA_RICKY_ID) {
      setRicky((prev) =>
        patchLocalCell(prev, workDate, shiftNo, employeeId, employeeName)
      );
    } else {
      setYessi((prev) =>
        patchLocalCell(prev, workDate, shiftNo, employeeId, employeeName)
      );
    }
  };

  const onAssign = (
    drogueriaId: number,
    workDate: string,
    shiftNo: number,
    employeeId: number
  ) => {
    const emp = employees.find((e) => e.id === employeeId);
    if (!emp) {
      toast.show("Empleado no encontrado.", "error");
      return;
    }
    queueChange(drogueriaId, workDate, shiftNo, employeeId, emp.name);
  };

  const onClear = (
    drogueriaId: number,
    workDate: string,
    shiftNo: number
  ) => {
    queueChange(drogueriaId, workDate, shiftNo, null, null);
  };

  const onSave = async () => {
    if (pending.size === 0) {
      toast.show("No hay cambios por guardar.", "error");
      return;
    }
    if (pending.size > BULK_MAX * 2) {
      toast.show(
        `Demasiados cambios (máx. ${BULK_MAX} por droguería).`,
        "error"
      );
      return;
    }

    const byStore = new Map<number, ScheduleBulkItem[]>();
    for (const item of pending.values()) {
      const list = byStore.get(item.drogueria_id) ?? [];
      list.push({
        work_date: item.work_date,
        shift_no: item.shift_no,
        employee_id: item.employee_id,
      });
      byStore.set(item.drogueria_id, list);
    }

    for (const [, items] of byStore) {
      if (items.length > BULK_MAX) {
        toast.show(
          `Máximo ${BULK_MAX} cambios por droguería en un guardado.`,
          "error"
        );
        return;
      }
    }

    setSaving(true);
    try {
      for (const [drogueriaId, items] of byStore) {
        const res = await putScheduleBulk({
          drogueria_id: drogueriaId,
          items,
        });
        if (!res.ok) {
          if (res.status === 401) {
            expireAuth();
            return;
          }
          toast.show(
            schError(res.body, "No se pudo guardar el horario."),
            "error"
          );
          return;
        }
      }
      setPending(new Map());
      toast.show("Horario guardado.", "success");
      await load();
    } catch {
      toast.show("Error de red al guardar el horario.", "error");
    } finally {
      setSaving(false);
    }
  };

  const confirmDiscardIfDirty = (): boolean => {
    if (!dirty) return true;
    return window.confirm(
      "Hay cambios sin guardar. ¿Descartarlos y continuar?"
    );
  };

  const onCreate = async (e: FormEvent) => {
    e.preventDefault();
    const name = newName.trim();
    if (!name) {
      toast.show("Escribe el nombre del empleado.", "error");
      return;
    }
    setCreating(true);
    try {
      const res = await createEmployee(name);
      if (!res.ok) {
        if (res.status === 401) {
          expireAuth();
          return;
        }
        toast.show(empError(res.body, "No se pudo crear el empleado."), "error");
        return;
      }
      setEmployees((prev) =>
        [...prev, res.data].sort((a, b) =>
          a.name.localeCompare(b.name, "es", { sensitivity: "base" })
        )
      );
      setNewName("");
      toast.show(`Empleado ${res.data.name} creado.`, "success");
    } catch {
      toast.show("Error de red al crear el empleado.", "error");
    } finally {
      setCreating(false);
    }
  };

  const onRename = async (emp: Employee) => {
    const next = window.prompt("Nuevo nombre", emp.name);
    if (next == null) return;
    const name = next.trim();
    if (!name || name === emp.name) return;
    try {
      const res = await patchEmployee(emp.id, name);
      if (!res.ok) {
        if (res.status === 401) {
          expireAuth();
          return;
        }
        toast.show(
          empError(res.body, "No se pudo renombrar el empleado."),
          "error"
        );
        return;
      }
      setEmployees((prev) =>
        prev
          .map((x) => (x.id === res.data.id ? res.data : x))
          .sort((a, b) =>
            a.name.localeCompare(b.name, "es", { sensitivity: "base" })
          )
      );
      // Actualiza nombres visibles en celdas locales
      const renameIn = (prev: ScheduleRange | null): ScheduleRange | null => {
        if (!prev) return prev;
        return {
          ...prev,
          days: prev.days.map((d) => ({
            ...d,
            shifts: d.shifts.map((s) =>
              s.employee_id === res.data.id
                ? { ...s, employee: res.data.name }
                : s
            ),
          })),
        };
      };
      setRicky(renameIn);
      setYessi(renameIn);
      toast.show(`Renombrado a ${res.data.name}.`, "success");
    } catch {
      toast.show("Error de red al renombrar.", "error");
    }
  };

  return (
    <section aria-label="Horario de turnos" className="w-full max-w-6xl pb-8">
      <h1
        className="text-2xl font-bold"
        style={{ color: "var(--primary-800)" }}
      >
        Horario
      </h1>
      <p className="mt-1 text-sm" style={{ color: "var(--primary-700)" }}>
        Ricky arriba y Yessi abajo. Hoy queda al centro del rango.
        {isAdmin
          ? " Arrastra empleados y pulsa Guardar cuando termines."
          : " Solo lectura."}
      </p>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={loading || saving}
          onClick={() => {
            if (!confirmDiscardIfDirty()) return;
            setAnchorYmd((d) =>
              addCalendarDaysToYmd(d, -(DAYS_BACK + DAYS_FORWARD + 1))
            );
          }}
          className="h-9 rounded-xl border-2 px-3 text-sm font-semibold disabled:opacity-60"
          style={{
            borderColor: "var(--primary-400)",
            color: "var(--primary-800)",
            backgroundColor:
              "color-mix(in srgb, var(--primary-600) 10%, var(--background))",
          }}
        >
          ← Anterior
        </button>
        <button
          type="button"
          disabled={loading || saving}
          onClick={() => {
            if (!confirmDiscardIfDirty()) return;
            setAnchorYmd(todayYmdInTz());
          }}
          className="h-9 rounded-xl px-3 text-sm font-semibold text-white disabled:opacity-60"
          style={{ backgroundColor: "var(--primary-600)" }}
        >
          Hoy
        </button>
        <button
          type="button"
          disabled={loading || saving}
          onClick={() => {
            if (!confirmDiscardIfDirty()) return;
            setAnchorYmd((d) =>
              addCalendarDaysToYmd(d, DAYS_BACK + DAYS_FORWARD + 1)
            );
          }}
          className="h-9 rounded-xl border-2 px-3 text-sm font-semibold disabled:opacity-60"
          style={{
            borderColor: "var(--primary-400)",
            color: "var(--primary-800)",
            backgroundColor:
              "color-mix(in srgb, var(--primary-600) 10%, var(--background))",
          }}
        >
          Siguiente →
        </button>
        <span
          className="text-sm font-semibold"
          style={{ color: "var(--primary-700)" }}
        >
          {formatRangeLabel(dateFrom, dateTo)}
        </span>
        <button
          type="button"
          disabled={loading || saving}
          onClick={() => {
            if (!confirmDiscardIfDirty()) return;
            void load();
          }}
          className="h-9 rounded-xl border-2 px-3 text-sm font-semibold disabled:opacity-60"
          style={{
            borderColor: "var(--primary-400)",
            color: "var(--primary-800)",
            backgroundColor:
              "color-mix(in srgb, var(--primary-600) 10%, var(--background))",
          }}
        >
          {loading ? "Cargando…" : "Actualizar"}
        </button>
        {isAdmin ? (
          <button
            type="button"
            disabled={loading || saving || !dirty}
            onClick={() => void onSave()}
            className="h-9 rounded-xl px-4 text-sm font-semibold text-white disabled:opacity-60"
            style={{ backgroundColor: "var(--primary-600)" }}
          >
            {saving
              ? "Guardando…"
              : dirty
                ? `Guardar (${pending.size})`
                : "Guardar"}
          </button>
        ) : null}
      </div>

      {isAdmin ? (
        <div
          className="mt-5 rounded-2xl border p-4"
          style={{
            borderColor: "var(--primary-200)",
            backgroundColor:
              "color-mix(in srgb, var(--primary-600) 8%, var(--background))",
          }}
        >
          <div className="flex flex-wrap items-end gap-3">
            <form
              onSubmit={(e) => void onCreate(e)}
              className="flex min-w-[14rem] flex-1 flex-wrap items-end gap-2"
            >
              <label
                className="flex min-w-[12rem] flex-1 flex-col gap-1 text-sm font-semibold"
                style={{ color: "var(--primary-800)" }}
              >
                Nuevo empleado
                <input
                  value={newName}
                  disabled={creating || loading || saving}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Nombre"
                  className="h-9 rounded-lg border-2 px-2 text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--primary-400)] disabled:opacity-60"
                  style={{
                    borderColor: "var(--primary-400)",
                    backgroundColor:
                      "color-mix(in srgb, var(--primary-600) 12%, var(--background))",
                    color: "var(--foreground)",
                  }}
                />
              </label>
              <button
                type="submit"
                disabled={creating || loading || saving}
                className="h-9 rounded-xl px-4 text-sm font-semibold text-white disabled:opacity-60"
                style={{ backgroundColor: "var(--primary-600)" }}
              >
                {creating ? "Creando…" : "Crear"}
              </button>
            </form>
          </div>
          <p
            className="mt-3 text-xs font-medium"
            style={{ color: "var(--primary-700)" }}
          >
            Arrastra a una celda (los cambios quedan pendientes). Doble clic para
            renombrar. Luego pulsa Guardar.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {employees.length === 0 ? (
              <span
                className="text-sm font-medium"
                style={{ color: "var(--primary-700)" }}
              >
                No hay empleados aún.
              </span>
            ) : (
              employees.map((emp) => (
                <button
                  key={emp.id}
                  type="button"
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData(
                      "application/x-employee-id",
                      String(emp.id)
                    );
                    e.dataTransfer.setData("text/plain", String(emp.id));
                    e.dataTransfer.effectAllowed = "copy";
                  }}
                  onDoubleClick={() => void onRename(emp)}
                  className="cursor-grab rounded-xl border-2 px-3 py-2 text-sm font-semibold active:cursor-grabbing"
                  style={{
                    borderColor: "var(--primary-400)",
                    backgroundColor: "var(--background)",
                    color: "var(--primary-800)",
                    boxShadow:
                      "0 2px 8px color-mix(in srgb, var(--foreground) 10%, transparent)",
                  }}
                >
                  {emp.name}
                </button>
              ))
            )}
          </div>
        </div>
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

      <div ref={scrollRef} className="mt-6 flex flex-col gap-5">
        <ScheduleStoreTable
          title="Drogueria Ricky"
          schedule={ricky}
          todayYmd={today}
          editable={isAdmin}
          dirtyKeys={dirtyKeys}
          onAssign={(date, shift, empId) =>
            onAssign(DROGUERIA_RICKY_ID, date, shift, empId)
          }
          onClear={(date, shift) =>
            onClear(DROGUERIA_RICKY_ID, date, shift)
          }
        />
        <ScheduleStoreTable
          title="Drogueria Yessi 24H"
          schedule={yessi}
          todayYmd={today}
          editable={isAdmin}
          dirtyKeys={dirtyKeys}
          onAssign={(date, shift, empId) =>
            onAssign(DROGUERIA_YESSI_ID, date, shift, empId)
          }
          onClear={(date, shift) =>
            onClear(DROGUERIA_YESSI_ID, date, shift)
          }
        />
      </div>
    </section>
  );
}
