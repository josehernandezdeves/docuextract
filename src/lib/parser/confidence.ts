/**
 * Combina la confianza cruda del motor OCR con el porcentaje de campos
 * fiscales clave que el parser logro identificar, para producir un unico
 * indicador de confianza que decide si una factura necesita revision
 * humana.
 *
 * Pesos: 40% OCR (que tan legible fue el documento) + 60% estructura
 * (que tantos campos clave se pudieron mapear). Se prioriza la estructura
 * porque un OCR "confiado" en texto irrelevante no sirve si no se pudieron
 * ubicar los campos fiscales.
 */
export function computeExtractionConfidence(
  ocrConfidence: number,
  fieldsFoundScore: number
): number {
  const weighted = ocrConfidence * 0.4 + fieldsFoundScore * 0.6;
  return Math.round(Math.max(0, Math.min(100, weighted)) * 100) / 100;
}

export function getConfidenceThreshold(): number {
  const raw = process.env.OCR_CONFIDENCE_THRESHOLD;
  const parsed = raw ? parseFloat(raw) : 70;
  return Number.isFinite(parsed) ? parsed : 70;
}
