"use client";

export type SalesAdminView = "calendario" | "registro";

const views: { id: SalesAdminView; label: string }[] = [
  { id: "calendario", label: "Calendario" },
  { id: "registro", label: "Registrar días" },
];

type Props = {
  view: SalesAdminView;
  onViewChange: (view: SalesAdminView) => void;
  disabled?: boolean;
};

export default function SalesViewToggle({
  view,
  onViewChange,
  disabled,
}: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span
        className="text-sm font-semibold shrink-0"
        style={{ color: "var(--primary-800)" }}
      >
        Vista:
      </span>
      <div
        className="inline-flex overflow-hidden rounded-xl border"
        style={{
          borderColor: "var(--primary-200)",
          backgroundColor: "var(--primary-50)",
        }}
        role="group"
        aria-label="Vista de ventas"
      >
        {views.map((v, idx) => {
          const active = view === v.id;
          return (
            <button
              key={v.id}
              type="button"
              disabled={disabled}
              onClick={() => onViewChange(v.id)}
              aria-pressed={active}
              className="px-3 py-2 text-xs font-semibold transition-colors sm:text-sm sm:px-4 disabled:opacity-60"
              style={{
                borderLeft: idx === 0 ? "none" : "1px solid var(--primary-200)",
                backgroundColor: active
                  ? "var(--primary-600)"
                  : "transparent",
                color: active ? "white" : "var(--primary-700)",
              }}
            >
              {v.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
