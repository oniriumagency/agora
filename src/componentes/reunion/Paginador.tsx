/** Flechas para pasar de página en el mosaico de reuniones grandes. */
export function Paginador({ pagina, paginas, cambiar }: { pagina: number; paginas: number; cambiar: (pagina: number) => void }) {
  const boton = "pointer-events-auto flex h-11 w-11 items-center justify-center rounded-full bg-sala-superficie/90 text-2xl text-white shadow-lg transition hover:bg-sala-tesela disabled:opacity-0";
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-between px-1">
      <button className={boton} disabled={pagina === 0} onClick={() => cambiar(pagina - 1)} aria-label="Página anterior">
        ‹
      </button>
      <span className="absolute left-1/2 top-1 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-xs text-white">
        {pagina + 1} / {paginas}
      </span>
      <button className={boton} disabled={pagina >= paginas - 1} onClick={() => cambiar(pagina + 1)} aria-label="Página siguiente">
        ›
      </button>
    </div>
  );
}
