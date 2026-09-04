/** IDs alineados con el backend: Ricky = 1, Yessi = 2 */
export const DROGUERIA_RICKY_ID = 1;
export const DROGUERIA_YESSI_ID = 2;

/** Droguería elegida en el dashboard (persiste al cambiar de sección). */
export const SELECTED_DROGUERIA_KEY = "selected_drogueria_id";

export function isValidDrogueriaId(id: number): boolean {
  return id === DROGUERIA_RICKY_ID || id === DROGUERIA_YESSI_ID;
}

export function readSelectedDrogueriaId(
  fallback: number = DROGUERIA_RICKY_ID
): number {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(SELECTED_DROGUERIA_KEY);
    if (!raw) return fallback;
    const n = Number(raw);
    return isValidDrogueriaId(n) ? n : fallback;
  } catch {
    return fallback;
  }
}

export function writeSelectedDrogueriaId(id: number): void {
  if (typeof window === "undefined") return;
  if (!isValidDrogueriaId(id)) return;
  try {
    window.localStorage.setItem(SELECTED_DROGUERIA_KEY, String(id));
  } catch {
    // ignore
  }
}
