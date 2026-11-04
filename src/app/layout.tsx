import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Kubox Meet",
  description: "Videollamadas privadas directas entre navegadores: vídeo, chat, mano alzada y pantalla compartida.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#202124" };

export default function RaizLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="bg-white text-gray-900">{children}</body>
    </html>
  );
}
