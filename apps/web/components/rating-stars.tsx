"use client";

import { Star } from "lucide-react";
import { clsx } from "clsx";

export function Stars({
  value,
  onChange,
  size = "md",
  label,
}: {
  value: number;
  onChange?: (v: number) => void;
  size?: "sm" | "md" | "lg";
  label?: string;
}) {
  const cls = size === "sm" ? "h-3.5 w-3.5" : size === "lg" ? "h-6 w-6" : "h-4 w-4";
  return (
    <div className="flex items-center gap-0.5" role={onChange ? "radiogroup" : undefined} aria-label={label}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={!onChange}
          onClick={() => onChange?.(n)}
          className={clsx(
            "rounded p-0.5 transition-colors",
            onChange ? "hover:bg-surface cursor-pointer" : "cursor-default",
          )}
          aria-label={`${n} star${n > 1 ? "s" : ""}`}
        >
          <Star
            className={cls}
            fill={n <= value ? "#D97706" : "none"}
            stroke={n <= value ? "#D97706" : "#D4D4D4"}
          />
        </button>
      ))}
    </div>
  );
}

export function RatingSummary({ avg, count }: { avg: number | null | undefined; count?: number }) {
  if (!avg) {
    return <span className="text-sm text-muted">No reviews yet</span>;
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-sm">
      <Stars value={Math.round(avg)} size="sm" />
      <span className="font-semibold tabular-nums">{avg.toFixed(1)}</span>
      {count !== undefined && <span className="text-muted">({count})</span>}
    </span>
  );
}
