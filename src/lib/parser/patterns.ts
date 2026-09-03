import type { TaxIdType } from "@/lib/types";

/**
 * Identificadores fiscales por region. El orden importa: se evalua de
 * arriba hacia abajo y se usa el primer match, priorizando los formatos
 * mas especificos (con letras/guiones distintivos) antes que el generico.
 */
export const TAX_ID_PATTERNS: { type: TaxIdType; regex: RegExp }[] = [
  // Argentina: CUIT/CUIL - 11 digitos, formato XX-XXXXXXXX-X
  {
    type: "CUIT",
    regex: /\b(?:CUIT|CUIL)\s*[:\-]?\s*(\d{2}-?\d{8}-?\d{1})\b/i,
  },
  // Venezuela: RIF - letra + 8/9 digitos, formato J-12345678-9
  {
    type: "RIF",
    regex: /\bR\.?I\.?F\.?\s*[:\-]?\s*([VEJPGvejpg]-?\d{7,9}-?\d?)\b/i,
  },
  // Mexico: RFC - 12/13 caracteres alfanumericos
  {
    type: "RFC",
    regex: /\bR\.?F\.?C\.?\s*[:\-]?\s*([A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3})\b/i,
  },
  // Peru / Ecuador: RUC - 11 o 13 digitos
  {
    type: "RUC",
    regex: /\bR\.?U\.?C\.?\s*[:\-.]?\s*(\d{11}|\d{13})\b/i,
  },
  // Colombia: NIT - digitos con posible digito de verificacion
  {
    type: "NIT",
    regex: /\bN\.?I\.?T\.?\s*[:\-.]?\s*(\d{5,15}(?:-\d)?)\b/i,
  },
];

/** Formatos de fecha soportados, en orden de prioridad de deteccion. */
export const DATE_PATTERNS: RegExp[] = [
  // 2024-05-21 / 2024/05/21
  /\b(20\d{2})[\/\-](\d{1,2})[\/\-](\d{1,2})\b/,
  // 21/05/2024 / 21-05-2024 (dd/mm/yyyy, formato dominante en LatAm)
  /\b(\d{1,2})[\/\-](\d{1,2})[\/\-](20\d{2})\b/,
  // 21 de mayo de 2024 / 21 de mayo del 2024
  /\b(\d{1,2})\s+de\s+([a-záéíóúñ]+)\s+de[l]?\s+(20\d{2})\b/i,
];

export const SPANISH_MONTHS: Record<string, string> = {
  enero: "01",
  febrero: "02",
  marzo: "03",
  abril: "04",
  mayo: "05",
  junio: "06",
  julio: "07",
  agosto: "08",
  septiembre: "09",
  setiembre: "09",
  octubre: "10",
  noviembre: "11",
  diciembre: "12",
};

/** Palabras clave que preceden el monto total de la factura. */
export const TOTAL_KEYWORDS = [
  "total a pagar",
  "monto total",
  "importe total",
  "total factura",
  "gran total",
  "total general",
  "total",
];

export const SUBTOTAL_KEYWORDS = [
  "subtotal",
  "sub-total",
  "base imponible",
  "base gravable",
];

export const TAX_KEYWORDS = [
  "iva",
  "i.v.a",
  "impuesto al valor agregado",
  "impuesto",
  "itbis",
  "igv",
];

export const INVOICE_NUMBER_KEYWORDS = [
  "factura n",
  "factura no",
  "factura nro",
  "n° factura",
  "no. factura",
  "numero de factura",
  "invoice #",
  "invoice no",
  "folio",
];

export const CURRENCY_SYMBOLS: { regex: RegExp; code: string }[] = [
  { regex: /US\$|USD/i, code: "USD" },
  { regex: /€|EUR/i, code: "EUR" },
  { regex: /COP|COL\$/i, code: "COP" },
  { regex: /MXN|MEX\$/i, code: "MXN" },
  { regex: /ARS/i, code: "ARS" },
  { regex: /PEN|S\/\./i, code: "PEN" },
];

/**
 * Convierte un numero con formato latinoamericano ("1.234.567,89" o
 * "1,234,567.89" o "1234567.89") a un `number` de JavaScript.
 */
export function parseLocaleNumber(raw: string): number | null {
  let s = raw.trim().replace(/[^\d.,\-]/g, "");
  if (!s) return null;

  const hasComma = s.includes(",");
  const hasDot = s.includes(".");

  if (hasComma && hasDot) {
    // El ultimo separador es el decimal; el otro es de miles.
    const lastComma = s.lastIndexOf(",");
    const lastDot = s.lastIndexOf(".");
    if (lastComma > lastDot) {
      s = s.replace(/\./g, "").replace(",", ".");
    } else {
      s = s.replace(/,/g, "");
    }
  } else if (hasComma && !hasDot) {
    // Solo coma: puede ser decimal (1234,56) o miles (1.234 escrito 1,234)
    const parts = s.split(",");
    if (parts[parts.length - 1].length === 2) {
      s = s.replace(/,/g, (m, i) => (i === s.lastIndexOf(",") ? "." : ""));
      s = parts.slice(0, -1).join("") + "." + parts[parts.length - 1];
    } else {
      s = s.replace(/,/g, "");
    }
  }
  // Si solo hay puntos, se asume que ya es formato estandar (miles o decimal)
  // y no se toca salvo que haya multiples puntos (entonces son miles).
  if (hasDot && !hasComma) {
    const dotCount = (s.match(/\./g) || []).length;
    if (dotCount > 1) {
      const lastDot = s.lastIndexOf(".");
      s = s.slice(0, lastDot).replace(/\./g, "") + s.slice(lastDot);
    }
  }

  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}
