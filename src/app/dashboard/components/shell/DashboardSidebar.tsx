"use client";

import { postLogout } from "@/lib/api";
import { getAuthUsername, removeToken } from "@/lib/auth-storage";
import { canAccessStats } from "@/lib/stats-access";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import SidebarAppearanceControls from "./SidebarAppearanceControls";

function NavIconBox({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex h-[22px] w-[22px] shrink-0 items-center justify-center overflow-visible">
      {children}
    </span>
  );
}

function IconQr() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <rect x="2.8" y="2.8" width="7.4" height="7.4" rx="1.4" fill="currentColor" />
      <rect x="13.8" y="2.8" width="7.4" height="7.4" rx="1.4" fill="currentColor" />
      <rect x="2.8" y="13.8" width="7.4" height="7.4" rx="1.4" fill="currentColor" />
    </svg>
  );
}

function IconStats() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M2.8 20.7h18.4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <rect x="4" y="11.1" width="4.4" height="7.8" rx="1" fill="currentColor" />
      <rect x="9.8" y="3.3" width="4.4" height="15.6" rx="1" fill="currentColor" />
      <rect x="15.6" y="7.1" width="4.4" height="11.8" rx="1" fill="currentColor" />
    </svg>
  );
}

function IconPeso() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9.35" stroke="currentColor" strokeWidth="2" />
      <g transform="translate(12 12) scale(1.12) translate(-12 -12)">
        <path
          d="M14.85 8.85c-.4-1.05-1.5-1.7-2.85-1.7-1.7 0-2.95.95-2.95 2.25 0 3.05 5.8 1.25 5.8 4.3 0 1.35-1.35 2.3-2.95 2.3-1.4 0-2.5-.65-2.9-1.65"
          stroke="currentColor"
          strokeWidth="1.85"
          strokeLinecap="round"
        />
        <path
          d="M12 6.55v1.35M12 16.1v1.35"
          stroke="currentColor"
          strokeWidth="1.85"
          strokeLinecap="round"
        />
      </g>
    </svg>
  );
}

function IconSettings() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path d="M19.14 12.94c.04-.31.06-.63.06-.94s-.02-.63-.06-.94l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.61-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54A.5.5 0 0 0 13.9 2h-3.8a.5.5 0 0 0-.5.42l-.36 2.54c-.59.24-1.13.56-1.62.94l-2.39-.96a.5.5 0 0 0-.61.22L2.8 8.48a.5.5 0 0 0 .12.64l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94L2.92 14.1a.5.5 0 0 0-.12.64l1.92 3.32c.14.24.43.34.61.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.26.42.5.42h3.8c.24 0 .45-.18.5-.42l.36-2.54c.59-.24 1.12-.56 1.62-.94l2.39.96c.18.12.47.02.61-.22l1.92-3.32a.5.5 0 0 0-.12-.64l-2.03-1.58zM12 15.6A3.6 3.6 0 1 1 12 8.4a3.6 3.6 0 0 1 0 7.2z" />
    </svg>
  );
}

function IconInvoice() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M7 3.75h7.5L19 8.25v12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1v-15a1 1 0 0 1 1-1Z"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinejoin="round"
      />
      <path
        d="M14.5 3.75V8.5H19"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinejoin="round"
      />
      <path
        d="M9 12h6M9 15.5h6M9 8.5h2.5"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconSchedule() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <rect
        x="3.25"
        y="4.5"
        width="17.5"
        height="15.25"
        rx="2.2"
        stroke="currentColor"
        strokeWidth="1.9"
      />
      <path
        d="M3.25 9.25h17.5M8 2.75v3.5M16 2.75v3.5"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
      <path
        d="M7.5 13h2.5M11.5 13h2.5M15.5 13h2M7.5 16.25h2.5M11.5 16.25h2.5"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
    </svg>
  );
}

type NavItem = {
  href: string;
  label: string;
  icon: React.ReactNode;
};

export default function DashboardSidebar({
  onRequestClose,
}: {
  onRequestClose?: () => void;
}) {
  const pathname = usePathname();
  /** `undefined` = aún no leímos localStorage (misma UI en 1er render → sin mismatch de hidratación). */
  const [username, setUsername] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    setUsername(getAuthUsername());
  }, []);

  const items: NavItem[] = useMemo(() => {
    const all: NavItem[] = [
      { href: "/dashboard", label: "Pagos QR", icon: <IconQr /> },
      { href: "/dashboard/sales", label: "Ventas", icon: <IconPeso /> },
      { href: "/dashboard/horario", label: "Horario", icon: <IconSchedule /> },
      { href: "/dashboard/facturas", label: "Facturas", icon: <IconInvoice /> },
      { href: "/dashboard/stats", label: "Estadísticas", icon: <IconStats /> },
      {
        href: "/dashboard/settings",
        label: "Configuración",
        icon: <IconSettings />,
      },
    ];
    if (username === undefined) return all;
    if (!canAccessStats(username)) {
      return all.filter(
        (it) => it.href !== "/dashboard/stats" && it.href !== "/dashboard/settings"
      );
    }
    return all;
  }, [username]);

  const isSelected = (href: string) => {
    if (href === "/dashboard") return pathname === "/" || pathname === href;
    return pathname === href;
  };

  return (
    <aside
      className="flex h-full w-64 flex-col px-4 py-6"
      style={{
        backgroundColor:
          "color-mix(in srgb, var(--primary-200) 35%, var(--background))",
        fontFamily: "var(--font-sidebar-body)",
      }}
    >
      <div className="mb-6 flex items-start justify-between">
        <div className="px-2">
          <div
            className="leading-none tracking-wider"
            style={{
              fontFamily: "var(--font-sidebar-title)",
              fontWeight: 700,
              color: "var(--primary-700)",
              fontSize: "28px",
            }}
          >
            <div>DROGUERIAS</div>
            <div className="-mt-2">ORTEGA</div>
          </div>
        </div>

        {onRequestClose ? (
          <button
            type="button"
            onClick={onRequestClose}
            aria-label="Cerrar sidebar"
            className="lg:hidden flex h-10 w-10 items-center justify-center rounded-lg p-0 transition-colors"
            style={{ color: "var(--primary-700)" }}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <path
                d="M6 6L18 18"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
              <path
                d="M18 6L6 18"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        ) : null}
      </div>

      <div className="mt-4 flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
        {items.map((it) => {
          const selected = isSelected(it.href);
          return (
            <Link
              key={it.href}
              href={it.href}
              onClick={() => onRequestClose?.()}
              className="flex items-center gap-3 rounded-xl px-3 py-3 transition-colors"
              style={{
                backgroundColor: selected ? "var(--primary-600)" : "transparent",
                color: selected ? "white" : "var(--primary-700)",
              }}
            >
              <NavIconBox>
                <span style={{ color: selected ? "white" : "var(--primary-700)" }}>
                  {it.icon}
                </span>
              </NavIconBox>
              <span className="text-sm font-medium">{it.label}</span>
            </Link>
          );
        })}
      </div>

      <SidebarLogoutButton />
      <SidebarAppearanceControls />
    </aside>
  );
}

function IconLogout() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6A2.25 2.25 0 0 0 5.25 5.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12 12h8.25M18 8.25 21.75 12 18 15.75"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SidebarLogoutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const onLogout = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await postLogout();
    } catch {
      // Igual limpiamos local aunque falle la red.
    } finally {
      removeToken();
      router.replace("/login");
    }
  };

  return (
    <button
      type="button"
      onClick={() => void onLogout()}
      disabled={busy}
      className="mb-3 flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors disabled:opacity-60"
      style={{ color: "var(--primary-700)" }}
      onMouseEnter={(e) => {
        if (busy) return;
        e.currentTarget.style.backgroundColor =
          "color-mix(in srgb, var(--primary-600) 14%, transparent)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = "transparent";
      }}
    >
      <NavIconBox>
        <span style={{ color: "var(--primary-700)" }}>
          <IconLogout />
        </span>
      </NavIconBox>
      <span className="text-sm font-medium">
        {busy ? "Cerrando…" : "Cerrar sesión"}
      </span>
    </button>
  );
}
