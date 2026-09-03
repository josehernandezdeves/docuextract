import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient, STORAGE_BUCKET } from "@/lib/supabase/admin";
import { runOcrOnImage } from "@/lib/ocr/tesseract";
import { extractPdfTextLayer, isScannedPdf } from "@/lib/ocr/pdf";
import { extractInvoiceFields } from "@/lib/parser/extract";
import {
  computeExtractionConfidence,
  getConfidenceThreshold,
} from "@/lib/parser/confidence";
import type { OcrResult } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  let admin: ReturnType<typeof createAdminSupabaseClient> | null = null;
  let invoiceId: string | null = null;

  try {
    const supabase = createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "No autenticado." }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    invoiceId = body?.invoiceId ?? null;

    if (!invoiceId) {
      return NextResponse.json(
        { error: "Falta invoiceId en el cuerpo de la petición." },
        { status: 400 }
      );
    }

    admin = createAdminSupabaseClient();

    // Se relee la factura con el cliente admin para tener acceso garantizado
    // al archivo en Storage, pero primero se verifica pertenencia del usuario
    // a la misma company_id via el cliente con RLS.
    const { data: ownedInvoice, error: ownershipError } = await supabase
      .from("invoices")
      .select("id, status, file_path, mime_type")
      .eq("id", invoiceId)
      .single();

    if (ownershipError || !ownedInvoice) {
      return NextResponse.json(
        { error: "Factura no encontrada o sin permisos." },
        { status: 404 }
      );
    }

    await admin
      .from("invoices")
      .update({ status: "processing", processing_error: null })
      .eq("id", invoiceId);

    const { data: fileData, error: downloadError } = await admin.storage
      .from(STORAGE_BUCKET)
      .download(ownedInvoice.file_path);

    if (downloadError || !fileData) {
      throw new Error(
        `No se pudo descargar el archivo original: ${downloadError?.message}`
      );
    }

    const buffer = Buffer.from(await fileData.arrayBuffer());

    let ocrResult: OcrResult;
    if (ownedInvoice.mime_type === "application/pdf") {
      ocrResult = await extractPdfTextLayer(buffer);
      if (isScannedPdf(ocrResult)) {
        // Limitacion documentada: no rasterizamos PDFs escaneados a imagen
        // en este pipeline (ver README > Roadmap). Se marca para revision
        // humana en vez de fallar silenciosamente.
        await admin
          .from("invoices")
          .update({
            status: "needs_review",
            ocr_confidence: 0,
            extraction_confidence: 0,
            raw_text: ocrResult.text,
            processing_error:
              "PDF escaneado sin capa de texto: no se pudo extraer contenido automáticamente. Sube una foto/imagen del documento para permitir OCR, o completa los campos manualmente.",
          })
          .eq("id", invoiceId);

        return NextResponse.json({
          status: "needs_review",
          reason: "scanned_pdf_without_text_layer",
        });
      }
    } else {
      ocrResult = await runOcrOnImage(buffer);
    }

    const fields = extractInvoiceFields(ocrResult.text);
    const extractionConfidence = computeExtractionConfidence(
      ocrResult.confidence,
      fields.fieldsFoundScore
    );
    const threshold = getConfidenceThreshold();
    const finalStatus =
      extractionConfidence >= threshold ? "completed" : "needs_review";

    const { error: updateError } = await admin
      .from("invoices")
      .update({
        status: finalStatus,
        ocr_confidence: ocrResult.confidence,
        extraction_confidence: extractionConfidence,
        raw_text: ocrResult.text,
        vendor_name: fields.vendorName,
        vendor_tax_id: fields.vendorTaxId,
        tax_id_type: fields.taxIdType,
        invoice_number: fields.invoiceNumber,
        issue_date: fields.issueDate,
        due_date: fields.dueDate,
        currency: fields.currency,
        subtotal_amount: fields.subtotalAmount,
        tax_amount: fields.taxAmount,
        total_amount: fields.totalAmount,
      })
      .eq("id", invoiceId);

    if (updateError) throw new Error(updateError.message);

    if (fields.items.length > 0) {
      await admin.from("invoice_items").delete().eq("invoice_id", invoiceId);
      await admin.from("invoice_items").insert(
        fields.items.map((item) => ({
          invoice_id: invoiceId,
          position: item.position,
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          total_price: item.total_price,
        }))
      );
    }

    return NextResponse.json({
      status: finalStatus,
      extraction_confidence: extractionConfidence,
    });
  } catch (err: any) {
    console.error("[/api/process]", err);
    if (admin && invoiceId) {
      await admin
        .from("invoices")
        .update({
          status: "failed",
          processing_error: err?.message ?? "Error desconocido durante el procesamiento.",
        })
        .eq("id", invoiceId);
    }
    return NextResponse.json(
      { error: "Error durante el procesamiento OCR." },
      { status: 500 }
    );
  }
}
