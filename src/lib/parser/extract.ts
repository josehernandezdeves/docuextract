import type { ExtractedFields, InvoiceItem, TaxIdType } from "@/lib/types";
import {
  CURRENCY_SYMBOLS,
  DATE_PATTERNS,
  INVOICE_NUMBER_KEYWORDS,
  parseLocaleNumber,
  SPANISH_MONTHS,
  SUBTOTAL_KEYWORDS,
  TAX_ID_PATTERNS,
  TAX_KEYWORDS,
  TOTAL_KEYWORDS,
} from "./patterns";

function normalizeText(raw: string): string {
  return raw
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function findTaxId(text: string): { value: string | null; type: TaxIdType } {
  for (const { type, regex } of TAX_ID_PATTERNS) {
    const match = text.match(regex);
    if (match?.[1]) {
      return { value: match[1].toUpperCase().replace(/\s+/g, ""), type };
    }
  }
  return { value: null, type: "UNKNOWN" };
}

function toIsoDate(day: string, month: string, year: string): string | null {
  const d = day.padStart(2, "0");
  const m = month.padStart(2, "0");
  const y = year.length === 2 ? `20${year}` : year;
  const iso = `${y}-${m}-${d}`;
  const asDate = new Date(iso);
  return Number.isNaN(asDate.getTime()) ? null : iso;
}

function findFirstDate(text: string): string | null {
  // 1) yyyy-mm-dd / yyyy/mm/dd
  let m = text.match(DATE_PATTERNS[0]);
  if (m) return toIsoDate(m[3], m[2], m[1]);

  // 2) dd/mm/yyyy
  m = text.match(DATE_PATTERNS[1]);
  if (m) return toIsoDate(m[1], m[2], m[3]);

  // 3) "21 de mayo de 2024"
  m = text.match(DATE_PATTERNS[2]);
  if (m) {
    const monthNum = SPANISH_MONTHS[m[2].toLowerCase()];
    if (monthNum) return toIsoDate(m[1], monthNum, m[3]);
  }

  return null;
}

/**
 * Busca todas las fechas del documento y devuelve la mas probable como
 * fecha de emision (heuristica: la primera fecha que aparece cerca de
 * palabras como "fecha" o "emision"; si no, la primera fecha del texto) y,
 * si existe una segunda fecha distinta cerca de "vencimiento", la usa como
 * fecha de vencimiento.
 */
function findIssueAndDueDates(text: string): {
  issueDate: string | null;
  dueDate: string | null;
} {
  const lines = text.split("\n");
  let issueDate: string | null = null;
  let dueDate: string | null = null;

  for (const line of lines) {
    const lower = line.toLowerCase();
    const date = findFirstDate(line);
    if (!date) continue;

    if (!issueDate && /(fecha\s*(de)?\s*emisi[oó]n|fecha\s*factura|fecha\s*:)/i.test(lower)) {
      issueDate = date;
      continue;
    }
    if (!dueDate && /(vencimiento|vence|fecha\s*(de)?\s*pago)/i.test(lower)) {
      dueDate = date;
      continue;
    }
  }

  // Fallback: si no se encontro por keyword, usar la primera fecha del documento completo.
  if (!issueDate) {
    issueDate = findFirstDate(text);
  }

  return { issueDate, dueDate };
}

function findAmountAfterKeywords(
  text: string,
  keywords: string[]
): number | null {
  const lines = text.split("\n");
  const amountRegex = /([\d][\d.,]*\d|\d)/g;

  for (const keyword of keywords) {
    for (const line of lines) {
      const lower = line.toLowerCase();
      const idx = lower.indexOf(keyword);
      if (idx === -1) continue;

      // Busca numeros en la misma linea, despues del keyword primero.
      const after = line.slice(idx + keyword.length);
      const candidates = [...after.matchAll(amountRegex)].map((m) => m[0]);
      if (candidates.length > 0) {
        const parsed = parseLocaleNumber(candidates[candidates.length - 1]);
        if (parsed !== null) return parsed;
      }

      // Si no hay numero despues, intenta en toda la linea.
      const wholeLineCandidates = [...line.matchAll(amountRegex)].map(
        (m) => m[0]
      );
      if (wholeLineCandidates.length > 0) {
        const parsed = parseLocaleNumber(
          wholeLineCandidates[wholeLineCandidates.length - 1]
        );
        if (parsed !== null) return parsed;
      }
    }
  }
  return null;
}

function findInvoiceNumber(text: string): string | null {
  const lines = text.split("\n");
  for (const keyword of INVOICE_NUMBER_KEYWORDS) {
    for (const line of lines) {
      const lower = line.toLowerCase();
      const idx = lower.indexOf(keyword);
      if (idx === -1) continue;
      const after = line.slice(idx + keyword.length);
      const match = after.match(/[:.\-#°ºo]?\s*([A-Z0-9\-]{3,20})/i);
      if (match?.[1]) return match[1].toUpperCase();
    }
  }
  return null;
}

function findCurrency(text: string): string | null {
  for (const { regex, code } of CURRENCY_SYMBOLS) {
    if (regex.test(text)) return code;
  }
  return null;
}

function findVendorName(text: string): string | null {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  // Heuristica: el nombre del emisor suele estar en las primeras lineas,
  // antes de la primera mencion de un identificador fiscal, y no es una
  // linea que parezca una fecha, un monto o la palabra "factura".
  for (const line of lines.slice(0, 8)) {
    const lower = line.toLowerCase();
    if (
      lower.length < 3 ||
      /factura|invoice|ticket|fecha|nit|rif|cuit|rfc|ruc|total|subtotal/.test(
        lower
      ) ||
      /^\d+$/.test(line) ||
      findFirstDate(line)
    ) {
      continue;
    }
    return line;
  }
  return null;
}

/**
 * Extrae items de tipo "cantidad  descripcion  precio" a partir de lineas
 * que contienen al menos dos numeros (cantidad/precio) y texto intermedio.
 * Es una heuristica deliberadamente conservadora: prioriza no inventar
 * items dudosos por sobre capturar el 100% de las lineas de una tabla con
 * formato irregular (comun en OCR de tickets).
 */
function findLineItems(text: string): InvoiceItem[] {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const items: InvoiceItem[] = [];

  const itemLineRegex =
    /^(\d+(?:[.,]\d+)?)\s+(.{3,60}?)\s+([\d][\d.,]*\d)\s*$/;

  let position = 0;
  for (const line of lines) {
    const lower = line.toLowerCase();
    if (
      TOTAL_KEYWORDS.some((k) => lower.includes(k)) ||
      SUBTOTAL_KEYWORDS.some((k) => lower.includes(k)) ||
      TAX_KEYWORDS.some((k) => lower.includes(k))
    ) {
      continue;
    }

    const match = line.match(itemLineRegex);
    if (!match) continue;

    const quantity = parseLocaleNumber(match[1]) ?? 1;
    const description = match[2].trim();
    const totalPrice = parseLocaleNumber(match[3]);
    if (totalPrice === null || !description) continue;

    items.push({
      position: position++,
      description,
      quantity,
      unit_price:
        quantity > 0 && totalPrice !== null
          ? Math.round((totalPrice / quantity) * 100) / 100
          : totalPrice,
      total_price: totalPrice,
    });

    if (items.length >= 30) break; // limite defensivo
  }

  return items;
}

/**
 * Punto de entrada principal: recibe el texto crudo (de Tesseract o de la
 * capa de texto de un PDF) y devuelve los campos fiscales normalizados,
 * junto con un score de cuantos campos clave se lograron identificar.
 */
export function extractInvoiceFields(rawText: string): ExtractedFields {
  const text = normalizeText(rawText);

  const { value: vendorTaxId, type: taxIdType } = findTaxId(text);
  const { issueDate, dueDate } = findIssueAndDueDates(text);
  const totalAmount = findAmountAfterKeywords(text, TOTAL_KEYWORDS);
  const subtotalAmount = findAmountAfterKeywords(text, SUBTOTAL_KEYWORDS);
  const taxAmount = findAmountAfterKeywords(text, TAX_KEYWORDS);
  const invoiceNumber = findInvoiceNumber(text);
  const currency = findCurrency(text);
  const vendorName = findVendorName(text);
  const items = findLineItems(text);

  const keyFields = [
    vendorTaxId,
    issueDate,
    totalAmount,
    invoiceNumber,
  ];
  const foundCount = keyFields.filter(
    (f) => f !== null && f !== undefined
  ).length;
  const fieldsFoundScore = Math.round((foundCount / keyFields.length) * 100);

  return {
    vendorName,
    vendorTaxId,
    taxIdType,
    invoiceNumber,
    issueDate,
    dueDate,
    currency,
    subtotalAmount,
    taxAmount,
    totalAmount,
    items,
    fieldsFoundScore,
  };
}
