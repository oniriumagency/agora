import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";

// Cinzel: letras de inscripción clásica, solo para la marca y los títulos
const fuenteMarca = localFont({ src: "./fuentes/Cinzel.woff2", weight: "400 700", variable: "--fuente-marca", display: "swap" });

export const metadata: Metadata = {
  title: "Ágora",
  description: "Ágora: la plaza donde se reúne tu equipo. Videollamadas privadas en tu propio servidor, con chat, archivos, mano alzada y pantalla compartida.",
  applicationName: "Ágora",
  manifest: "/manifest.webmanifest",
  appleWebApp: { title: "Ágora", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#0F1B2D" };

export default function RaizLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={fuenteMarca.variable}>
      <body className="bg-gray-50 text-gray-900">{children}</body>
    </html>
  );
}
