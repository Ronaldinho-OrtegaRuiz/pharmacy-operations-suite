"use client";

import { postLogout } from "@/lib/api";
import { removeToken } from "@/lib/auth-storage";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function LogoutPage() {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await postLogout();
      } catch {
        // Igual limpiamos local.
      } finally {
        if (!cancelled) {
          removeToken();
          router.replace("/login");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 text-sm text-zinc-600">
      Cerrando sesión…
    </div>
  );
}
