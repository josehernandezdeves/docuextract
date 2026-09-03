# DocuExtract

Plataforma B2B para digitalizar, extraer y validar datos fiscales de facturas
y tickets mediante OCR. Sube una imagen o PDF, el sistema reconoce el texto,
extrae los campos fiscales clave (NIT/RIF/CUIT/RFC/RUC, fechas, montos,
ítems) y lo deja listo para tu contabilidad, con un flujo de revisión humana
para los documentos de baja confianza.

## Stack

- **Frontend/Framework:** Next.js 14 (App Router) + TypeScript
- **Estilos:** Tailwind CSS (tema claro, estética legaltech)
- **OCR:** Tesseract.js (imágenes) + capa de texto nativa de PDF (`pdf-parse`)
- **Base de datos / Storage / Auth:** Supabase (Postgres + RLS + Storage + Auth)

## 1. Configurar Supabase

1. Crea un proyecto en [supabase.com](https://supabase.com).
2. En **SQL Editor**, ejecuta el contenido de [`supabase/schema.sql`](./supabase/schema.sql).
   Esto crea:
   - Tablas `companies`, `profiles`, `invoices`, `invoice_items`.
   - Un trigger que crea automáticamente una empresa + perfil al registrarse un usuario.
   - Políticas de **Row Level Security** que aíslan los datos por empresa.
   - El bucket privado de Storage `invoices` con sus políticas de acceso.
3. En **Authentication > Providers**, confirma que **Email** esté habilitado
   (activado por defecto). Puedes desactivar la confirmación por correo en
   desarrollo desde **Authentication > Settings** si quieres probar más rápido.
4. En **Settings > API**, copia:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (¡nunca la expongas al cliente!)

## 2. Variables de entorno

```bash
cp .env.example .env.local
```

Completa `.env.local` con los valores de tu proyecto de Supabase.

## 3. Instalación y desarrollo

```bash
npm install
npm run dev
```

Abre `http://localhost:3000`, crea una cuenta desde `/login` (esto crea tu
empresa automáticamente vía el trigger de Supabase) y sube tu primera
factura desde `/upload`.

## 4. Build de producción

```bash
npm run build
npm run start
```

El proyecto ya fue verificado con `npm run build` (Next.js 14.2, Node 18+) y
compila sin errores de tipos ni de build.

## Arquitectura del pipeline

```
Usuario sube archivo (Dropzone)
        │
        ▼
POST /api/upload
  - Valida tipo/tamaño
  - Sube a Supabase Storage (bucket privado "invoices/<company_id>/<uuid>")
  - Crea fila en `invoices` con status = "pending"
        │
        ▼
POST /api/process
  - status = "processing"
  - Descarga el archivo original desde Storage (cliente service_role)
  - Si es PDF: intenta extraer la capa de texto nativa (pdf-parse)
      · Si el PDF es escaneado (sin texto útil) → status = "needs_review"
        con nota explicativa (ver limitación conocida más abajo)
  - Si es imagen: ejecuta Tesseract.js (spa+eng, PSM 6)
        │
        ▼
lib/parser/extract.ts
  - Regex especializadas para NIT/RIF/CUIT/RFC/RUC
  - Detección de fechas (numéricas y en texto: "21 de mayo de 2024")
  - Montos: total / subtotal / impuesto vía palabras clave contables
  - Heurística de ítems (cantidad + descripción + precio)
        │
        ▼
lib/parser/confidence.ts
  - confianza = 40% OCR + 60% campos clave encontrados
  - Por debajo del umbral (env OCR_CONFIDENCE_THRESHOLD, default 70)
    → status = "needs_review"
  - Por encima → status = "completed"
        │
        ▼
Persistencia en `invoices` + `invoice_items` (Supabase)
        │
        ▼
UI: listado (/invoices) y detalle (/invoices/[id])
  - Documento original + formulario editable
  - Botón "Validar y marcar completada" → auditoría (reviewed_by/reviewed_at)
  - Exportación a CSV (/api/invoices/export)
```

## Limitación conocida y roadmap sugerido

**PDFs escaneados (sin capa de texto):** el pipeline actual no rasteriza
PDFs a imagen para correr OCR sobre ellos, ya que esa conversión típicamente
requiere dependencias nativas (poppler-utils, `canvas`) que complican el
despliegue en muchos entornos serverless. En su lugar, estos documentos se
marcan como `needs_review` con una nota clara para el usuario. Mejora
sugerida para producción a mayor escala:

1. Añadir un worker dedicado (contenedor con `poppler-utils` instalado) que
   convierta la primera página del PDF a PNG con `pdftoppm`.
2. Reutilizar `runOcrOnImage` sobre esa imagen, sin tocar el resto del pipeline.

Otras mejoras futuras razonables:

- Cola de trabajos (BullMQ/Supabase Edge Functions) en vez de invocar el OCR
  de forma síncrona en la misma request de subida, para archivos grandes.
- Aprendizaje de patrones por proveedor recurrente (plantillas por `vendor_tax_id`).
- Exportación directa a formatos contables (XML DIAN, SAT, etc.) por país.

## Estructura del proyecto

```
src/
  app/
    page.tsx                  Landing
    login/                    Auth (email/password vía Supabase)
    upload/                   Pantalla de carga (Dropzone)
    invoices/                 Listado
    invoices/[id]/            Detalle + validación manual
    api/
      upload/route.ts         Sube archivo a Storage + crea registro
      process/route.ts        Pipeline OCR + parsing + persistencia
      invoices/route.ts       Listado (GET)
      invoices/[id]/route.ts  Detalle (GET), edición manual (PATCH), borrado (DELETE)
      invoices/export/route.ts Exportación CSV
  components/                 Dropzone, tabla, detalle, badges, navbar
  lib/
    supabase/                 Clientes browser / server / admin (service_role)
    ocr/                      Tesseract.js + extracción de capa de texto PDF
    parser/                   Regex fiscales, normalización, scoring de confianza
    types.ts                  Tipos de dominio compartidos
supabase/schema.sql           Esquema completo (tablas, RLS, bucket)
```

## Seguridad

- El bucket de Storage es **privado**; los archivos solo se sirven vía URLs
  firmadas de corta duración (10 minutos) generadas en el backend.
- Row Level Security aísla todos los datos por `company_id`; ningún usuario
  puede leer o escribir facturas de otra empresa aunque conozca el ID.
- La `service_role key` solo se usa en Route Handlers de servidor
  (`src/lib/supabase/admin.ts`), nunca se expone al navegador.
