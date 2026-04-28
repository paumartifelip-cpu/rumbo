import type { Metadata, Viewport } from "next";
import "./globals.css";
import { RumboProvider } from "@/lib/store";

export const metadata: Metadata = {
  title: "Rumbo · Foco real hacia tus objetivos",
  description:
    "Rumbo es la app que ordena tus tareas según lo que más te acerca a tus objetivos personales, profesionales y financieros.",
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
      </body>
    </html>
  );
}
