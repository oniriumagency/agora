"use client";
import Link from "next/link";
import { PaginaReunion } from "@/componentes/PaginaReunion";
import { interpretarCodigo } from "@/utilidades/codigoSala";

export default function PaginaSala({ params }: { params: { sala: string } }) {
  const codigo = interpretarCodigo(decodeURIComponent(params.sala));
  if (!codigo) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
        <h1 className="text-2xl">Ese enlace de reunión no es válido</h1>
        <Link href="/" className="rounded-md bg-acento-fuerte px-4 py-2 font-medium text-white">
          Volver al inicio
        </Link>
      </div>
    );
  }
  return <PaginaReunion codigo={codigo} />;
}
