import type { Metadata, Viewport } from "next";
import "./globals.css";
import { RegistrarSW } from "@/components/RegistrarSW";
import { RumboProvider } from "@/lib/store";

export const metadata: Metadata = {
  metadataBase: new URL("https://usarumbo.com"),
  manifest: "/manifest.webmanifest",
  applicationName: "Rumbo",
  // Al instalarla en el iPhone: nombre bajo el icono y modo "app" a pantalla completa.
  appleWebApp: { capable: true, title: "Rumbo", statusBarStyle: "default" },
  formatDetection: { telephone: false },
  icons: {
    icon: [
      { url: "/icons/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  title: "Rumbo · Foco real hacia tus objetivos",
  description:
    "Rumbo es la app que ordena tus tareas según lo que más te acerca a tus objetivos personales, profesionales y financieros.",
  openGraph: {
    type: "website",
    locale: "es_ES",
    url: "/",
    siteName: "Rumbo",
    title: "Rumbo · Menos ruido, más rumbo",
    description:
      "Apunta lo que ganas y lo que gastas, y ve cuánto dinero tienes de verdad. Fácil, claro y solo para ti.",
    images: [
      {
        url: "/og.jpg",
        width: 1200,
        height: 630,
        alt: "Rumbo — Menos ruido, más rumbo",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Rumbo · Menos ruido, más rumbo",
    description:
      "Apunta lo que ganas y lo que gastas, y ve cuánto dinero tienes de verdad. Fácil, claro y solo para ti.",
    images: ["/og.jpg"],
  },
};

export const viewport: Viewport = {
  themeColor: "#FAFAF7",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className="min-h-screen font-sans">
        <RumboProvider>{children}</RumboProvider>
        <RegistrarSW />
      </body>
    </html>
  );
}
