import InvoiceDetail from "@/components/InvoiceDetail";

export default function InvoiceDetailPage({
  params,
}: {
  params: { id: string };
}) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink-900">
          Detalle de factura
        </h1>
        <p className="mt-1 text-sm text-ink-500">
          Revisa el documento original junto a los datos extraídos y corrige
          lo necesario antes de exportar.
        </p>
      </div>
      <InvoiceDetail invoiceId={params.id} />
    </div>
  );
}
