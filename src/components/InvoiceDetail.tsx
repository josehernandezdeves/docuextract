"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { InvoiceWithItems } from "@/lib/types";
import { formatCurrency, formatDate } from "@/lib/utils";
import StatusBadge, { ConfidenceBadge } from "./StatusBadge";

interface FormState {
  vendor_name: string;
  vendor_tax_id: string;
  tax_id_type: string;
  invoice_number: string;
  issue_date: string;
  due_date: string;
  currency: string;
  subtotal_amount: string;
  tax_amount: string;
  total_amount: string;
}

function toFormState(invoice: InvoiceWithItems): FormState {
  return {
    vendor_name: invoice.vendor_name ?? "",
    vendor_tax_id: invoice.vendor_tax_id ?? "",
    tax_id_type: invoice.tax_id_type ?? "UNKNOWN",
    invoice_number: invoice.invoice_number ?? "",
    issue_date: invoice.issue_date ?? "",
    due_date: invoice.due_date ?? "",
    currency: invoice.currency ?? "COP",
    subtotal_amount: invoice.subtotal_amount?.toString() ?? "",
    tax_amount: invoice.tax_amount?.toString() ?? "",
    total_amount: invoice.total_amount?.toString() ?? "",
  };
}

export default function InvoiceDetail({ invoiceId }: { invoiceId: string }) {
  const router = useRouter();
  const [invoice, setInvoice] = useState<InvoiceWithItems | null>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const res = await fetch(`/api/invoices/${invoiceId}`);
      const json = await res.json();
      if (res.ok) {
        setInvoice(json.invoice);
        setFileUrl(json.fileUrl);
        setForm(toFormState(json.invoice));
      }
    })();
  }, [invoiceId]);

  async function handleSave(markReviewed: boolean) {
    if (!form) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/invoices/${invoiceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          subtotal_amount: form.subtotal_amount ? Number(form.subtotal_amount) : null,
          tax_amount: form.tax_amount ? Number(form.tax_amount) : null,
          total_amount: form.total_amount ? Number(form.total_amount) : null,
          markReviewed,
        }),
      });
      const json = await res.json();
      if (res.ok) {
        setInvoice((prev) => (prev ? { ...prev, ...json.invoice } : prev));
        if (markReviewed) router.push("/invoices");
      }
    } finally {
      setSaving(false);
    }
  }

  if (!invoice || !form) {
    return <p className="text-sm text-ink-400">Cargando factura…</p>;
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {/* Documento original */}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-ink-100 px-4 py-3">
          <h2 className="text-sm font-semibold text-ink-800">Documento original</h2>
          <StatusBadge status={invoice.status} />
        </div>
        <div className="flex max-h-[70vh] items-center justify-center overflow-auto bg-ink-50 p-4">
          {fileUrl && invoice.mime_type.startsWith("image/") ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={fileUrl} alt={invoice.file_name} className="max-w-full rounded-lg shadow-sm" />
          ) : fileUrl ? (
            <iframe src={fileUrl} className="h-[65vh] w-full rounded-lg" title="PDF" />
          ) : (
            <p className="text-sm text-ink-400">No se pudo cargar el archivo.</p>
          )}
        </div>
      </div>

      {/* Datos extraidos / edicion manual */}
      <div className="card p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink-800">
            Datos extraídos
          </h2>
          <div className="flex items-center gap-2 text-xs text-ink-500">
            Confianza: <ConfidenceBadge value={invoice.extraction_confidence} />
          </div>
        </div>

        {invoice.processing_error && (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            {invoice.processing_error}
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <Field label="Proveedor / Emisor" span={2}>
            <input
              className="input"
              value={form.vendor_name}
              onChange={(e) => setForm({ ...form, vendor_name: e.target.value })}
            />
          </Field>

          <Field label="Tipo ID fiscal">
            <select
              className="input"
              value={form.tax_id_type}
              onChange={(e) => setForm({ ...form, tax_id_type: e.target.value })}
            >
              {["NIT", "RIF", "CUIT", "RFC", "RUC", "UNKNOWN"].map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Número de identificación">
            <input
              className="input"
              value={form.vendor_tax_id}
              onChange={(e) => setForm({ ...form, vendor_tax_id: e.target.value })}
            />
          </Field>

          <Field label="Número de factura">
            <input
              className="input"
              value={form.invoice_number}
              onChange={(e) => setForm({ ...form, invoice_number: e.target.value })}
            />
          </Field>

          <Field label="Moneda">
            <input
              className="input"
              value={form.currency}
              onChange={(e) => setForm({ ...form, currency: e.target.value })}
            />
          </Field>

          <Field label="Fecha de emisión">
            <input
              type="date"
              className="input"
              value={form.issue_date}
              onChange={(e) => setForm({ ...form, issue_date: e.target.value })}
            />
          </Field>

          <Field label="Fecha de vencimiento">
            <input
              type="date"
              className="input"
              value={form.due_date}
              onChange={(e) => setForm({ ...form, due_date: e.target.value })}
            />
          </Field>

          <Field label="Subtotal">
            <input
              type="number"
              step="0.01"
              className="input"
              value={form.subtotal_amount}
              onChange={(e) => setForm({ ...form, subtotal_amount: e.target.value })}
            />
          </Field>

          <Field label="Impuesto">
            <input
              type="number"
              step="0.01"
              className="input"
              value={form.tax_amount}
              onChange={(e) => setForm({ ...form, tax_amount: e.target.value })}
            />
          </Field>

          <Field label="Total" span={2}>
            <input
              type="number"
              step="0.01"
              className="input font-semibold"
              value={form.total_amount}
              onChange={(e) => setForm({ ...form, total_amount: e.target.value })}
            />
          </Field>
        </div>

        {invoice.invoice_items?.length > 0 && (
          <div className="mt-5">
            <h3 className="label">Conceptos detectados</h3>
            <div className="overflow-hidden rounded-lg border border-ink-100">
              <table className="min-w-full text-xs">
                <thead className="bg-ink-50 text-ink-500">
                  <tr>
                    <th className="px-3 py-2 text-left">Descripción</th>
                    <th className="px-3 py-2 text-right">Cant.</th>
                    <th className="px-3 py-2 text-right">Precio</th>
                    <th className="px-3 py-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100">
                  {invoice.invoice_items.map((item) => (
                    <tr key={item.id}>
                      <td className="px-3 py-2">{item.description}</td>
                      <td className="px-3 py-2 text-right">{item.quantity}</td>
                      <td className="px-3 py-2 text-right">
                        {formatCurrency(item.unit_price, invoice.currency)}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {formatCurrency(item.total_price, invoice.currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="mt-6 flex items-center justify-between border-t border-ink-100 pt-4">
          <span className="text-xs text-ink-400">
            Subido {formatDate(invoice.created_at)}
          </span>
          <div className="flex gap-2">
            <button
              className="btn-secondary"
              disabled={saving}
              onClick={() => handleSave(false)}
            >
              Guardar cambios
            </button>
            <button
              className="btn-primary"
              disabled={saving}
              onClick={() => handleSave(true)}
            >
              Validar y marcar completada
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
  span = 1,
}: {
  label: string;
  children: React.ReactNode;
  span?: 1 | 2;
}) {
  return (
    <div className={span === 2 ? "col-span-2" : "col-span-1"}>
      <label className="label">{label}</label>
      {children}
    </div>
  );
}
