"use client";

import { useId, useState } from "react";
import { createPortal } from "react-dom";

const W = 720;
const H = 260;
const PAD_L = 36;
const PAD_R = 12;
const PAD_T = 16;
const PAD_B = 28;

type TipViewport = {
  clientX: number;
  clientY: number;
  label: string;
};

/** Tooltip en viewport: no lo recorta el overflow del gráfico; arriba del cursor o abajo si no cabe. */
function ChartTooltipPortal({ tip }: { tip: TipViewport | null }) {
  if (!tip) return null;
  const pad = 10;
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;
  const showBelow = tip.clientY < 104;
  const showAboveForced = tip.clientY > vh - 72;
  const transform = showAboveForced
    ? `translate(-50%, calc(-100% - ${pad}px))`
    : showBelow
      ? `translate(-50%, ${pad}px)`
      : `translate(-50%, calc(-100% - ${pad}px))`;

  const node = (
    <div
      className="pointer-events-none max-w-[min(90vw,280px)] rounded-lg border px-2 py-1 text-xs font-semibold shadow-lg"
      style={{
        position: "fixed",
        left: tip.clientX,
        top: tip.clientY,
        zIndex: 500,
        borderColor: "var(--primary-200)",
        backgroundColor: "var(--background)",
        color: "var(--foreground)",
        transform,
        boxShadow:
          "0 8px 24px color-mix(in srgb, var(--foreground) 12%, transparent)",
      }}
    >
      {tip.label}
    </div>
  );

  return createPortal(node, document.body);
}

type LineProps = {
  labels: string[];
  counts: number[];
  formatPoint: (label: string, count: number) => string;
  axisLabel?: string;
  ariaLabel?: string;
};

export function PaymentsLineChart({
  labels,
  counts,
  formatPoint,
  axisLabel = "Período",
  ariaLabel = "Gráfica de cantidad por período",
}: LineProps) {
  const gid = useId();
  const [tip, setTip] = useState<TipViewport | null>(null);

  const n = labels.length;
  const maxC = Math.max(1, ...counts);
  const innerW = W - PAD_L - PAD_R;
  const innerH = H - PAD_T - PAD_B;

  const xAt = (i: number) =>
    n <= 1 ? PAD_L + innerW / 2 : PAD_L + (innerW * i) / (n - 1);
  const yAt = (c: number) => PAD_T + innerH - (innerH * c) / maxC;

  const points = counts.map((c, i) => ({
    x: xAt(i),
    y: yAt(c),
    c,
    label: labels[i] ?? String(i + 1),
  }));

  let pathD = "";
  if (points.length === 1) {
    const p = points[0]!;
    const seg = Math.min(48, innerW / 3);
    pathD = `M ${p.x - seg} ${p.y} L ${p.x + seg} ${p.y}`;
  } else {
    pathD = points
      .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`)
      .join(" ");
  }

  return (
    <div className="relative w-full min-w-0">
      <ChartTooltipPortal tip={tip} />
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full max-w-full"
        role="img"
        aria-label={ariaLabel}
      >
        <defs>
          <linearGradient id={`${gid}-lineFill`} x1="0" y1="0" x2="0" y2="1">
            <stop
              offset="0%"
              stopColor="var(--primary-500)"
              stopOpacity="0.25"
            />
            <stop
              offset="100%"
              stopColor="var(--primary-500)"
              stopOpacity="0.02"
            />
          </linearGradient>
        </defs>
        {[0, 0.25, 0.5, 0.75, 1].map((t) => {
          const y = PAD_T + innerH * (1 - t);
          return (
            <line
              key={t}
              x1={PAD_L}
              y1={y}
              x2={PAD_L + innerW}
              y2={y}
              stroke="var(--primary-200)"
              strokeOpacity={0.85}
              strokeWidth={1}
            />
          );
        })}
        {points.length > 1 ? (
          <path
            d={`${pathD} L ${points[points.length - 1]!.x} ${PAD_T + innerH} L ${points[0]!.x} ${PAD_T + innerH} Z`}
            fill={`url(#${gid}-lineFill)`}
            stroke="none"
          />
        ) : points.length === 1 ? (
          <path
            d={`${pathD} L ${points[0]!.x + Math.min(40, innerW / 4)} ${PAD_T + innerH} L ${points[0]!.x - Math.min(40, innerW / 4)} ${PAD_T + innerH} Z`}
            fill={`url(#${gid}-lineFill)`}
            stroke="none"
          />
        ) : null}
        <path
          d={pathD}
          fill="none"
          stroke="var(--primary-600)"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {points.map((p) => (
          <circle
            key={p.label}
            cx={p.x}
            cy={p.y}
            r={p.c > 0 ? 5 : 3}
            fill={p.c > 0 ? "var(--primary-600)" : "var(--primary-200)"}
            stroke="var(--background)"
            strokeWidth={1.5}
            className="cursor-pointer"
            onMouseEnter={(e) =>
              setTip({
                clientX: e.clientX,
                clientY: e.clientY,
                label: formatPoint(p.label, p.c),
              })
            }
            onMouseMove={(e) =>
              setTip({
                clientX: e.clientX,
                clientY: e.clientY,
                label: formatPoint(p.label, p.c),
              })
            }
            onMouseLeave={() => setTip(null)}
          />
        ))}
        <text
          x={PAD_L}
          y={H - 6}
          fontSize={11}
          fill="var(--foreground)"
          fillOpacity={0.85}
          fontWeight={600}
        >
          {axisLabel}
        </text>
      </svg>
    </div>
  );
}

type BarProps = {
  labels: string[];
  values: number[];
  formatPoint: (label: string, value: number) => string;
  axisLabel?: string;
  ariaLabel?: string;
};

export function ValueBarChart({
  labels,
  values,
  formatPoint,
  axisLabel = "Período",
  ariaLabel = "Gráfica de valor por período",
}: BarProps) {
  const [tip, setTip] = useState<TipViewport | null>(null);

  const n = labels.length;
  const maxS = Math.max(1, ...values);
  const innerW = W - PAD_L - PAD_R;
  const innerH = H - PAD_T - PAD_B;
  const gap = 1;
  const barW = n > 0 ? Math.max(2, (innerW - gap * (n - 1)) / n) : 0;

  return (
    <div className="relative w-full min-w-0">
      <ChartTooltipPortal tip={tip} />
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full max-w-full"
        role="img"
        aria-label={ariaLabel}
      >
        {[0, 0.25, 0.5, 0.75, 1].map((t) => {
          const y = PAD_T + innerH * (1 - t);
          return (
            <line
              key={t}
              x1={PAD_L}
              y1={y}
              x2={PAD_L + innerW}
              y2={y}
              stroke="var(--primary-200)"
              strokeOpacity={0.85}
              strokeWidth={1}
            />
          );
        })}
        {values.map((sum, i) => {
          const h = (innerH * sum) / maxS;
          const x = PAD_L + i * (barW + gap);
          const y = PAD_T + innerH - h;
          const label = labels[i] ?? String(i + 1);
          return (
            <rect
              key={label}
              x={x}
              y={y}
              width={barW}
              height={Math.max(h, sum > 0 ? 2 : 0)}
              rx={2}
              fill={sum > 0 ? "var(--primary-500)" : "var(--primary-100)"}
              className="cursor-pointer"
              onMouseEnter={(e) =>
                setTip({
                  clientX: e.clientX,
                  clientY: e.clientY,
                  label: formatPoint(label, sum),
                })
              }
              onMouseMove={(e) =>
                setTip({
                  clientX: e.clientX,
                  clientY: e.clientY,
                  label: formatPoint(label, sum),
                })
              }
              onMouseLeave={() => setTip(null)}
            />
          );
        })}
        <text
          x={PAD_L}
          y={H - 6}
          fontSize={11}
          fill="var(--foreground)"
          fillOpacity={0.85}
          fontWeight={600}
        >
          {axisLabel}
        </text>
      </svg>
    </div>
  );
}
