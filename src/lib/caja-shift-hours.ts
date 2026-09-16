import {
  DROGUERIA_RICKY_ID,
  DROGUERIA_YESSI_ID,
} from "@/lib/drogueria-preference";

/** Horarios de turnos de caja (no columnas de Horario). */
export const CAJA_SHIFT_HOURS: Record<
  number,
  { shift_no: number; label: string }[]
> = {
  [DROGUERIA_RICKY_ID]: [
    { shift_no: 1, label: "6:30 a. m. – 2:00 p. m." },
    { shift_no: 2, label: "2:00 p. m. – 10:00 p. m." },
  ],
  [DROGUERIA_YESSI_ID]: [
    { shift_no: 1, label: "12:00 a. m. – 6:30 a. m." },
    { shift_no: 2, label: "6:30 a. m. – 2:00 p. m." },
    { shift_no: 3, label: "2:00 p. m. – 10:00 p. m." },
    { shift_no: 4, label: "10:00 p. m. – 12:00 a. m." },
  ],
};

export function cajaShiftHoursFor(
  drogueriaId: number
): { shift_no: number; label: string }[] {
  return CAJA_SHIFT_HOURS[drogueriaId] ?? [];
}

export function cajaShiftHourLabel(
  drogueriaId: number,
  shiftNo: number
): string | null {
  return (
    cajaShiftHoursFor(drogueriaId).find((s) => s.shift_no === shiftNo)
      ?.label ?? null
  );
}
