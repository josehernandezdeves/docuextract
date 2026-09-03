import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient, STORAGE_BUCKET } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const EDITABLE_FIELDS = [
  "vendor_name",
  "vendor_tax_id",
  "tax_id_type",
  "invoice_number",
  "issue_date",
  "due_date",
  "currency",
  "subtotal_amount",
  "tax_amount",
  "total_amount",
] as const;

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const { data: invoice, error } = await supabase
    .from("invoices")
    .select("*, invoice_items(*)")
    .eq("id", params.id)
    .single();

  if (error || !invoice) {
    return NextResponse.json({ error: "Factura no encontrada." }, { status: 404 });
  }

  const admin = createAdminSupabaseClient();
  const { data: signedUrl } = await admin.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(invoice.file_path, 60 * 10);

  return NextResponse.json({
    invoice,
    fileUrl: signedUrl?.signedUrl ?? null,
  });
}

/**
 * Permite la validacion/correccion manual de una factura marcada como
 * `needs_review` (o cualquier otra), y la marca como `completed` una vez
 * que un humano confirma los datos.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const update: Record<string, unknown> = {};

  for (const field of EDITABLE_FIELDS) {
    if (field in body) update[field] = body[field];
  }

  if (body.markReviewed) {
    update.status = "completed";
    update.reviewed_by = user.id;
    update.reviewed_at = new Date().toISOString();
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json(
      { error: "No se enviaron campos válidos para actualizar." },
      { status: 400 }
    );
  }

  // Pasa por el cliente con RLS: solo se puede editar una factura de la
  // propia empresa.
  const { data, error } = await supabase
    .from("invoices")
    .update(update)
    .eq("id", params.id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ invoice: data });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const { data: invoice, error: fetchError } = await supabase
    .from("invoices")
    .select("file_path")
    .eq("id", params.id)
    .single();

  if (fetchError || !invoice) {
    return NextResponse.json({ error: "Factura no encontrada." }, { status: 404 });
  }

  const { error: deleteError } = await supabase
    .from("invoices")
    .delete()
    .eq("id", params.id);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  const admin = createAdminSupabaseClient();
  await admin.storage.from(STORAGE_BUCKET).remove([invoice.file_path]);

  return NextResponse.json({ ok: true });
}
