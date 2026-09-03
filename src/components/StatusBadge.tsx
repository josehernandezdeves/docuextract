import { cn, statusLabel } from "@/lib/utils";
import type { InvoiceStatus } from "@/lib/types";

const STYLES: Record<InvoiceStatus, string> = {
  pending: "bg-ink-100 text-ink-600",
  processing: "bg-brand-100 text-brand-700",
  completed: "bg-emerald-100 text-emerald-700",
  needs_review: "bg-amber-100 text-amber-800",
  failed: "bg-red-100 text-red-700",
};

export default function StatusBadge({ status }: { status: InvoiceStatus }) {
  return (
    <span className={cn("badge", STYLES[status])}>{statusLabel(status)}</span>
  );
}

export function ConfidenceBadge({ value }: { value: number | null }) {
  if (value === null || value === undefined) {
    return <span className="text-xs text-ink-400">—</span>;
  }

  const color =
    value >= 85
      ? "text-emerald-700"
      : value >= 70
      ? "text-brand-700"
      : "text-amber-700";

  return (
    <span className={cn("text-xs font-semibold", color)}>
      {value.toFixed(0)}%
    </span>
  );
}
