import Link from "next/link";
import LogoutButton from "./LogoutButton";

export default function Navbar() {
  return (
    <header className="border-b border-ink-100 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-700 text-sm font-bold text-white">
            DX
          </span>
          <span className="text-lg font-semibold text-ink-900">
            DocuExtract
          </span>
        </Link>

        <nav className="flex items-center gap-6 text-sm font-medium text-ink-600">
          <Link href="/invoices" className="transition-colors hover:text-brand-700">
            Facturas
          </Link>
          <Link
            href="/upload"
            className="rounded-lg bg-brand-700 px-4 py-2 text-white transition-colors hover:bg-brand-800"
          >
            + Subir documento
          </Link>
          <LogoutButton />
        </nav>
      </div>
    </header>
  );
}
