/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Static export for Cloudflare Pages.
  // The app is fully client-rendered: store + IA viven en el navegador,
  // así que no necesitamos servidor en producción.
  output: "export",
  images: { unoptimized: true },
  trailingSlash: true,
};

export default nextConfig;
