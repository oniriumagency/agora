/** Tres barras azules que se mueven mientras alguien habla (estáticas si está en silencio). */
export function OndasVoz({ activo }: { activo: boolean }) {
  return (
    <span className={`flex h-7 w-7 items-center justify-center gap-[3px] rounded-full ${activo ? "bg-acento-fuerte" : "bg-black/40"}`} aria-hidden="true">
      {[0, 1, 2].map((indice) => (
        <span
          key={indice}
          className={`w-[3px] rounded-full bg-white ${activo ? "animate-pulse" : ""}`}
          style={{ height: activo ? [8, 14, 8][indice] : 4, animationDelay: `${indice * 120}ms`, transition: "height 120ms" }}
        />
      ))}
    </span>
  );
}
