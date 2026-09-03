import { createClient } from "@supabase/supabase-js";

/**
 * Cliente administrativo (service_role). SOLO debe usarse en codigo de
 * servidor (Route Handlers / workers), nunca importarse desde un componente
 * de cliente. Se usa para:
 *  - Descargar el archivo original de Storage durante el procesamiento OCR.
 *  - Escribir los resultados normalizados en la tabla `invoices`.
 *
 * Al usar service_role se hace bypass de RLS: cada operacion debe filtrar
 * explicitamente por company_id / invoice_id para no filtrar datos entre
 * empresas.
 */
export function createAdminSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      "Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en las variables de entorno."
    );
  }

  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export const STORAGE_BUCKET =
  process.env.SUPABASE_STORAGE_BUCKET || "invoices";
