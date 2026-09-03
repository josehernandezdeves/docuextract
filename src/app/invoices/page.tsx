import InvoiceTable from "@/components/InvoiceTable";

export default function InvoicesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink-900">Facturas</h1>
        <p className="mt-1 text-sm text-ink-500">
          Listado de todos los documentos procesados por tu empresa.
        </p>
      </div>
      <InvoiceTable />
    </div>
  );
}
