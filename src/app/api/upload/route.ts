import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient, STORAGE_BUCKET } from "@/lib/supabase/admin";
import { ACCEPTED_MIME_TYPES, MAX_FILE_SIZE_BYTES } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const supabase = createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "No autenticado." }, { status: 401 });
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("company_id")
      .eq("id", user.id)
      .single();

    if (profileError || !profile?.company_id) {
      return NextResponse.json(
        { error: "No se encontró la empresa asociada al usuario." },
        { status: 400 }
      );
    }

    const formData = await req.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: "No se recibió ningún archivo." },
        { status: 400 }
      );
    }

    if (!ACCEPTED_MIME_TYPES.includes(file.type as any)) {
      return NextResponse.json(
        {
          error:
            "Tipo de archivo no soportado. Solo se aceptan JPG, PNG, WEBP y PDF.",
        },
        { status: 415 }
      );
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        { error: "El archivo excede el tamaño máximo permitido (15 MB)." },
        { status: 413 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const extension = file.name.split(".").pop() || "bin";
    const objectPath = `${profile.company_id}/${uuidv4()}.${extension}`;

    // Se usa el cliente admin para la subida porque el bucket es privado y
    // asi garantizamos consistencia del prefijo de carpeta = company_id,
    // que es lo que valida la policy de Storage.
    const admin = createAdminSupabaseClient();

    const { error: uploadError } = await admin.storage
      .from(STORAGE_BUCKET)
      .upload(objectPath, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      return NextResponse.json(
        { error: `Error al subir el archivo: ${uploadError.message}` },
        { status: 500 }
      );
    }

    const { data: invoice, error: insertError } = await admin
      .from("invoices")
      .insert({
        company_id: profile.company_id,
        uploaded_by: user.id,
        file_path: objectPath,
        file_name: file.name,
        mime_type: file.type,
        file_size_bytes: file.size,
        status: "pending",
      })
      .select()
      .single();

    if (insertError) {
      // Best-effort: si falla el insert, limpiar el archivo huerfano.
      await admin.storage.from(STORAGE_BUCKET).remove([objectPath]);
      return NextResponse.json(
        { error: `Error al registrar la factura: ${insertError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ invoice }, { status: 201 });
  } catch (err) {
    console.error("[/api/upload]", err);
    return NextResponse.json(
      { error: "Error inesperado durante la subida." },
      { status: 500 }
    );
  }
}
