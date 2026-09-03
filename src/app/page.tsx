import Link from "next/link";

const STEPS = [
  {
    title: "1. Sube el documento",
    description:
      "Arrastra una foto o PDF de la factura o ticket. Se almacena de forma segura en tu espacio privado.",
  },
  {
    title: "2. OCR automático",
    description:
      "Tesseract.js reconoce el texto del documento; si el PDF ya tiene texto digital, se usa directamente.",
  },
  {
    title: "3. Extracción fiscal",
    description:
      "Se identifican NIT/RIF/CUIT, fechas, montos e ítems mediante reglas de análisis específicas para LatAm.",
  },
  {
    title: "4. Validación y reporte",
    description:
      "Los documentos con baja confianza se marcan para revisión humana. Exporta todo a CSV para tu contabilidad.",
  },
];

export default function HomePage() {
  return (
    <div className="space-y-12">
      <section className="text-center">
        <p className="text-sm font-medium uppercase tracking-wide text-brand-600">
          Automatización contable
        </p>
        <h1 className="mt-2 text-4xl font-bold tracking-tight text-ink-900">
          Extrae datos fiscales de tus facturas en segundos
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-ink-500">
          DocuExtract convierte fotos, escaneos y PDFs de facturas y tickets en
          datos estructurados listos para contabilidad, con OCR y validación
          humana cuando el documento lo requiere.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Link href="/upload" className="btn-primary">
            Subir mi primera factura
          </Link>
          <Link href="/invoices" className="btn-secondary">
            Ver facturas procesadas
          </Link>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map((step) => (
          <div key={step.title} className="card p-5">
            <h3 className="text-sm font-semibold text-ink-900">{step.title}</h3>
            <p className="mt-2 text-sm text-ink-500">{step.description}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
