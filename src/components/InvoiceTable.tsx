"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Invoice, InvoiceStatus } from "@/lib/types";
import { formatCurrency, formatDate } from "@/lib/utils";
import StatusBadge, { ConfidenceBadge } from "./StatusBadge";

const FILTERS: { label: string; value: InvoiceStatus | "all" }[] = [
  { label: "Todas", value: "all" },
  { label: "Requieren revisión", value: "needs_review" },
  { label: "Completadas", value: "completed" },
  { label: "Procesando", value: "processing" },
  { label: "Error", value: "failed" },
];

export default function InvoiceTable() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [filter, setFilter] = useState<InvoiceStatus | "all">("all");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const qs = filter !== "all" ? `?status=${filter}` : "";
    const res = await fetch(`/api/invoices${qs}`);
    const json = await res.json();
    setInvoices(json.invoices ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // Poll ligero mientras haya documentos en proceso, para reflejar el
    // resultado del OCR sin recargar manualmente.
    const interval = setInterval(load, 4000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={
                filter === f.value
                  ? "rounded-full bg-brand-700 px-3 py-1.5 text-xs font-medium text-white"
                  : "rounded-full border border-ink-200 bg-white px-3 py-1.5 text-xs font-medium text-ink-600 hover:bg-ink-50"
              }
            >
              {f.label}
            </button>
          ))}
        </div>
        <a href="/api/invoices/export" className="btn-secondary text-xs">
          Exportar CSV
        </a>
      </div>

      <div className="card overflow-hidden">
        <table className="min-w-full divide-y divide-ink-100 text-sm">
          <thead className="bg-ink-50 text-left text-xs font-medium uppercase tracking-wide text-ink-500">
            <tr>
              <th className="px-4 py-3">Proveedor</th>
              <th className="px-4 py-3">Identificación fiscal</th>
              <th className="px-4 py-3"># Factura</th>
              <th className="px-4 py-3">Fecha emisión</th>
              <th className="px-4 py-3 text-right">Total</th>
              <th className="px-4 py-3">Confianza</th>
              <th className="px-4 py-3">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {loading && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-ink-400">
                  Cargando facturas…
                </td>
              </tr>
            )}
            {!loading && invoices.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-ink-400">
                  Aún no hay facturas.{" "}
                  <Link href="/upload" className="text-brand-700 underline">
                    Sube tu primer documento
                  </Link>
                  .
                </td>
              </tr>
            )}
            {invoices.map((inv) => (
              <tr key={inv.id} className="transition-colors hover:bg-ink-50/60">
                <td className="px-4 py-3">
                  <Link
                    href={`/invoices/${inv.id}`}
                    className="font-medium text-ink-900 hover:text-brand-700"
                  >
                    {inv.vendor_name || inv.file_name}
                  </Link>
                </td>
                <td className="px-4 py-3 text-ink-600">
                  {inv.vendor_tax_id
                    ? `${inv.tax_id_type}: ${inv.vendor_tax_id}`
                    : "—"}
                </td>
                <td className="px-4 py-3 text-ink-600">
                  {inv.invoice_number || "—"}
                </td>
                <td className="px-4 py-3 text-ink-600">
                  {formatDate(inv.issue_date)}
                </td>
                <td className="px-4 py-3 text-right font-medium text-ink-900">
                  {formatCurrency(inv.total_amount, inv.currency)}
                </td>
                <td className="px-4 py-3">
                  <ConfidenceBadge value={inv.extraction_confidence} />
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={inv.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
