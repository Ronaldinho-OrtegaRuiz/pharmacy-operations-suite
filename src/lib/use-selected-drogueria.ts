"use client";

import {
  DROGUERIA_RICKY_ID,
  readSelectedDrogueriaId,
  writeSelectedDrogueriaId,
} from "@/lib/drogueria-preference";
import { useCallback, useState } from "react";

/** Droguería compartida entre Pagos / Ventas / Facturas / Stats. */
export function useSelectedDrogueria() {
  const [drogueriaId, setState] = useState(() =>
    readSelectedDrogueriaId(DROGUERIA_RICKY_ID)
  );

  const setDrogueriaId = useCallback((id: number) => {
    setState(id);
    writeSelectedDrogueriaId(id);
  }, []);

  return [drogueriaId, setDrogueriaId] as const;
}
