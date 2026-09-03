/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Tesseract.js y pdf-parse usan APIs de Node (fs, worker_threads) por lo que
  // deben permanecer fuera del bundle de servidor externo.
  experimental: {
    serverComponentsExternalPackages: ["tesseract.js", "pdf-parse"],
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
