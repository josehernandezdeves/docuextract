import type { OcrResult } from "@/lib/types";

/**
 * Umbral por debajo del cual consideramos que un PDF no tiene una capa de
 * texto util (es decir, es un PDF escaneado / imagen embebida).
 */
const MIN_TEXT_LENGTH_FOR_DIGITAL_PDF = 40;

/**
 * Extrae la capa de texto embebida de un PDF "digital" (generado por un
 * sistema de facturacion, no escaneado). Esta via es mucho mas rapida y
 * precisa que el OCR cuando el PDF la incluye.
 *
 * Nota de arquitectura / limitacion conocida: si el PDF es una imagen
 * escaneada sin capa de texto, esta funcion devolvera muy poco o ningun
 * texto. En ese caso el pipeline marca la factura como `needs_review` en
 * lugar de intentar rasterizar el PDF a imagen para correr Tesseract,
 * porque esa conversion requiere dependencias nativas (poppler/canvas) que
 * complican el despliegue. Ver README > "Roadmap" para la mejora sugerida
 * (worker dedicado con poppler-utils).
 */
export async function extractPdfTextLayer(buffer: Buffer): Promise<OcrResult> {
  // Import perezoso: pdf-parse toca el filesystem en su modulo de test al
  // cargarse, asi que se importa solo cuando realmente se necesita.
  const pdfParse = (await import("pdf-parse")).default;

  const result = await pdfParse(buffer);
  const text = (result.text || "").trim();

  const hasUsableTextLayer = text.length >= MIN_TEXT_LENGTH_FOR_DIGITAL_PDF;

  return {
    text,
    // Los PDFs digitales no tienen "confianza" de OCR real; si hay texto
    // util asumimos maxima confianza porque no hubo reconocimiento de
    // caracteres involucrado. Si no hay texto, confianza 0 para forzar
    // revision humana.
    confidence: hasUsableTextLayer ? 98 : 0,
    source: "pdf-text-layer",
  };
}

export function isScannedPdf(result: OcrResult): boolean {
  return result.source === "pdf-text-layer" && result.text.length < MIN_TEXT_LENGTH_FOR_DIGITAL_PDF;
}
