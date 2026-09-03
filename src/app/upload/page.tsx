import Dropzone from "@/components/Dropzone";

export default function UploadPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink-900">
          Subir facturas o tickets
        </h1>
        <p className="mt-1 text-sm text-ink-500">
          Puedes subir varios documentos a la vez. Cada uno se procesa con OCR
          automáticamente al terminar la carga.
        </p>
      </div>
      <Dropzone />
    </div>
  );
}
