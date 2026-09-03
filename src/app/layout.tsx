import type { Metadata } from "next";
import "./globals.css";
import Navbar from "@/components/Navbar";

export const metadata: Metadata = {
  title: "DocuExtract — Extracción inteligente de facturas",
  description:
    "Plataforma B2B para digitalizar, extraer y validar datos fiscales de facturas y tickets mediante OCR.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className="min-h-screen bg-ink-50 font-sans text-ink-900 antialiased">
        <Navbar />
        <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
          {children}
        </main>
      </body>
    </html>
  );
}
