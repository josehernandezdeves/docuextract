import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function GET(req: NextRequest) {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const { data: invoices, error } = await supabase
    .from("invoices")
    .select("*")
    .order("issue_date", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const headers = [
    "numero_factura",
    "proveedor",
    "identificacion_fiscal",
    "tipo_identificacion",
    "fecha_emision",
    "fecha_vencimiento",
    "moneda",
    "subtotal",
    "impuesto",
    "total",
    "estado",
    "confianza_extraccion",
  ];

  const rows = (invoices ?? []).map((inv) =>
    [
      inv.invoice_number,
      inv.vendor_name,
      inv.vendor_tax_id,
      inv.tax_id_type,
      inv.issue_date,
      inv.due_date,
      inv.currency,
      inv.subtotal_amount,
      inv.tax_amount,
      inv.total_amount,
      inv.status,
      inv.extraction_confidence,
    ]
      .map(csvEscape)
      .join(",")
  );

  const csv = [headers.join(","), ...rows].join("\n");

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="docuextract-facturas-${new Date()
        .toISOString()
        .slice(0, 10)}.csv"`,
    },
  });
}
