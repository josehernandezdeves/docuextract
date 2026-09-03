export type InvoiceStatus =
  | "pending"
  | "processing"
  | "completed"
  | "needs_review"
  | "failed";

export type TaxIdType = "NIT" | "RIF" | "CUIT" | "RFC" | "RUC" | "UNKNOWN";

export interface InvoiceItem {
  id?: string;
  invoice_id?: string;
  position: number;
  description: string;
  quantity: number | null;
  unit_price: number | null;
  total_price: number | null;
}

export interface Invoice {
  id: string;
  company_id: string;
  uploaded_by: string | null;
  file_path: string;
  file_name: string;
  mime_type: string;
  file_size_bytes: number | null;

  status: InvoiceStatus;
  ocr_confidence: number | null;
  extraction_confidence: number | null;
  processing_error: string | null;
  raw_text: string | null;

  vendor_name: string | null;
  vendor_tax_id: string | null;
  tax_id_type: TaxIdType | null;
  invoice_number: string | null;
  issue_date: string | null;
  due_date: string | null;
  currency: string | null;
  subtotal_amount: number | null;
  tax_amount: number | null;
  total_amount: number | null;

  reviewed_by: string | null;
  reviewed_at: string | null;

  created_at: string;
  updated_at: string;
}

export interface InvoiceWithItems extends Invoice {
  invoice_items: InvoiceItem[];
}

/** Resultado crudo de una corrida de OCR, antes de normalizar. */
export interface OcrResult {
  text: string;
  confidence: number; // 0-100
  source: "tesseract" | "pdf-text-layer";
}

/** Resultado de la extraccion/parsing de un texto ya obtenido por OCR. */
export interface ExtractedFields {
  vendorName: string | null;
  vendorTaxId: string | null;
  taxIdType: TaxIdType;
  invoiceNumber: string | null;
  issueDate: string | null; // ISO yyyy-mm-dd
  dueDate: string | null;
  currency: string | null;
  subtotalAmount: number | null;
  taxAmount: number | null;
  totalAmount: number | null;
  items: InvoiceItem[];
  /** cuantos de los campos "clave" (fecha, total, tax id, items) se hallaron */
  fieldsFoundScore: number; // 0-100
}

export const ACCEPTED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
] as const;

export const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024; // 15 MB
