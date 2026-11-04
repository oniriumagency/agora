"use client";
import { useEffect, useRef } from "react";

/** Elemento <video> enlazado a un MediaStream. Siempre mudo: el audio remoto suena aparte. */
export function Video({ flujo, espejo = false, ajuste = "cover", className = "" }: { flujo: MediaStream; espejo?: boolean; ajuste?: "cover" | "contain"; className?: string }) {
  const referencia = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = referencia.current;
    if (!video) return;
    if (video.srcObject !== flujo) video.srcObject = flujo;
    void video.play().catch(() => undefined);
  }, [flujo]);

  return (
    <video
      ref={referencia}
      autoPlay
      playsInline
      muted
      className={`h-full w-full ${ajuste === "cover" ? "object-cover" : "object-contain"} ${espejo ? "-scale-x-100" : ""} ${className}`}
    />
  );
}
