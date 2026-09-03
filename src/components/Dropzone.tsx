"use client";

import { useCallback, useState } from "react";
import { useDropzone, type FileRejection } from "react-dropzone";
import { useRouter } from "next/navigation";
import { cn, formatBytes } from "@/lib/utils";

interface QueuedFile {
  file: File;
  status: "queued" | "uploading" | "processing" | "done" | "error";
  error?: string;
  invoiceId?: string;
}

const ACCEPT = {
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "image/webp": [".webp"],
  "application/pdf": [".pdf"],
};

export default function Dropzone() {
  const router = useRouter();
  const [queue, setQueue] = useState<QueuedFile[]>([]);

  const onDrop = useCallback(
    (accepted: File[], rejections: FileRejection[]) => {
      const queuedAccepted: QueuedFile[] = accepted.map((file) => ({
        file,
        status: "queued",
      }));
      const queuedRejected: QueuedFile[] = rejections.map((r) => ({
        file: r.file,
        status: "error",
        error:
          r.errors[0]?.code === "file-too-large"
            ? "El archivo supera los 15 MB."
            : "Tipo de archivo no soportado.",
      }));

      setQueue((prev) => [...prev, ...queuedAccepted, ...queuedRejected]);
      queuedAccepted.forEach((qf) => processFile(qf.file));
    },
    []
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPT,
    maxSize: 15 * 1024 * 1024,
    multiple: true,
  });

  function updateQueueItem(file: File, patch: Partial<QueuedFile>) {
    setQueue((prev) =>
      prev.map((item) => (item.file === file ? { ...item, ...patch } : item))
    );
  }

  async function processFile(file: File) {
    try {
      updateQueueItem(file, { status: "uploading" });

      const formData = new FormData();
      formData.append("file", file);

      const uploadRes = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      const uploadJson = await uploadRes.json();

      if (!uploadRes.ok) {
        throw new Error(uploadJson.error || "Error al subir el archivo.");
      }

      const invoiceId = uploadJson.invoice.id as string;
      updateQueueItem(file, { status: "processing", invoiceId });

      const processRes = await fetch("/api/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceId }),
      });
      const processJson = await processRes.json();

      if (!processRes.ok) {
        throw new Error(processJson.error || "Error durante el OCR.");
      }

      updateQueueItem(file, { status: "done" });
    } catch (err: any) {
      updateQueueItem(file, {
        status: "error",
        error: err?.message ?? "Error inesperado.",
      });
    }
  }

  const allDone =
    queue.length > 0 && queue.every((q) => q.status === "done" || q.status === "error");

  return (
    <div className="space-y-4">
      <div
        {...getRootProps()}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-14 text-center transition-colors",
          isDragActive
            ? "border-brand-500 bg-brand-50"
            : "border-ink-200 bg-white hover:border-brand-300 hover:bg-brand-50/40"
        )}
      >
        <input {...getInputProps()} />
        <svg
          className="mb-4 h-10 w-10 text-brand-600"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 8.25L12 3.75m0 0L7.5 8.25M12 3.75v13.5"
          />
        </svg>
        <p className="text-sm font-medium text-ink-800">
          {isDragActive
            ? "Suelta los archivos aquí"
            : "Arrastra tus facturas o tickets aquí"}
        </p>
        <p className="mt-1 text-xs text-ink-400">
          JPG, PNG, WEBP o PDF · máximo 15 MB por archivo
        </p>
        <button type="button" className="btn-secondary mt-4">
          Seleccionar archivos
        </button>
      </div>

      {queue.length > 0 && (
        <div className="card divide-y divide-ink-100">
          {queue.map((item, i) => (
            <div key={i} className="flex items-center justify-between gap-4 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-ink-800">
                  {item.file.name}
                </p>
                <p className="text-xs text-ink-400">
                  {formatBytes(item.file.size)}
                </p>
              </div>
              <QueueStatus item={item} />
            </div>
          ))}
        </div>
      )}

      {allDone && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => router.push("/invoices")}
            className="btn-primary"
          >
            Ver facturas procesadas →
          </button>
        </div>
      )}
    </div>
  );
}

function QueueStatus({ item }: { item: QueuedFile }) {
  if (item.status === "error") {
    return <span className="text-xs font-medium text-red-600">{item.error}</span>;
  }
  if (item.status === "done") {
    return <span className="text-xs font-medium text-emerald-600">Completado ✓</span>;
  }
  const labels: Record<string, string> = {
    queued: "En cola…",
    uploading: "Subiendo…",
    processing: "Ejecutando OCR…",
  };
  return (
    <span className="flex items-center gap-2 text-xs font-medium text-brand-600">
      <span className="h-3 w-3 animate-spin rounded-full border-2 border-brand-300 border-t-brand-600" />
      {labels[item.status]}
    </span>
  );
}
