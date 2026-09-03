import { createWorker, type Worker } from "tesseract.js";
import type { OcrResult } from "@/lib/types";

let workerPromise: Promise<Worker> | null = null;

/**
 * Reutiliza un unico worker de Tesseract entre invocaciones dentro del mismo
 * proceso de servidor (evita pagar el costo de carga del modelo en cada
 * request). En un entorno serverless con cold-starts frecuentes esto ayuda
 * menos, pero no perjudica: sigue funcionando de forma correcta y segura.
 */
async function getWorker(): Promise<Worker> {
  if (!workerPromise) {
    workerPromise = createWorker("spa+eng", 1, {
      // logger: (m) => console.log(m), // habilitar para depurar progreso
    });
  }
  return workerPromise;
}

/**
 * Preprocesamiento minimo orientado a documentos fiscales: Tesseract.js no
 * expone un pipeline de imagen propio en Node, asi que la configuracion de
 * PSM (Page Segmentation Mode) y la whitelist de caracteres es lo que mas
 * impacto tiene en la tasa de acierto para facturas/tickets con tablas y
 * bloques de texto mixtos.
 */
async function configureForInvoices(worker: Worker) {
  await worker.setParameters({
    tessedit_pageseg_mode: "6" as any, // Bloque uniforme de texto (facturas/tickets)
    preserve_interword_spaces: "1",
  });
}

/**
 * Ejecuta OCR sobre un buffer de imagen (jpg/png/webp).
 */
export async function runOcrOnImage(buffer: Buffer): Promise<OcrResult> {
  const worker = await getWorker();
  await configureForInvoices(worker);

  const { data } = await worker.recognize(buffer);

  return {
    text: data.text ?? "",
    confidence: typeof data.confidence === "number" ? data.confidence : 0,
    source: "tesseract",
  };
}

/**
 * Libera el worker de Tesseract. Util para tests o para cerrar procesos
 * de larga duracion de forma ordenada; no es obligatorio llamarlo en cada
 * request de un entorno serverless.
 */
export async function terminateOcrWorker() {
  if (workerPromise) {
    const worker = await workerPromise;
    await worker.terminate();
    workerPromise = null;
  }
}
