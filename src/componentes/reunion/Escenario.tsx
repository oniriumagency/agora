"use client";
import { useEffect } from "react";
import { suscribir } from "@/estado/sesion";
import { useReunion } from "@/estado/useReunion";
import { useTeselas, type DatosTesela } from "@/estado/useTeselas";
import { Mosaico } from "./Mosaico";
import { Paginador } from "./Paginador";
import { Tesela } from "./Tesela";

/**
 * Zona principal. Si hay algo fijado o alguien presenta, eso va en grande y el resto en una tira;
 * si no, mosaico paginado (tu tesela siempre está). Solo se pide al servidor el vídeo de las
 * personas que se ven, así una reunión de 100 no descarga 99 vídeos.
 */
const MAXIMO_EN_TIRA = 6;
const MAXIMO_POR_PAGINA = 8;

export function Escenario() {
  const teselas = useTeselas();
  const fijado = useReunion((estado) => estado.fijado);
  const maximoVideos = useReunion((estado) => estado.maximoVideos);
  const paginaPedida = useReunion((estado) => estado.pagina);
  const fijar = useReunion((estado) => estado.fijar);
  const enfocado = useReunion((estado) => estado.enfocado);
  const verTodos = useReunion((estado) => estado.verTodos);

  const destacada =
    (fijado && teselas.find((tesela) => tesela.id === fijado.id && tesela.pantalla === fijado.pantalla)) ||
    teselas.find((tesela) => tesela.pantalla && !tesela.esLocal) ||
    teselas.find((tesela) => tesela.pantalla) ||
    null;
  const enModoDestacado = destacada !== null && teselas.length > 1;
  // "Solo esta persona": se tocó una tesela y sigue existiendo.
  const soloUna = enfocado && destacada !== null && fijado !== null && destacada.id === fijado.id && destacada.pantalla === fijado.pantalla;

  const [propia, ...otras] = teselas;
  const porPagina = Math.max(1, Math.min(maximoVideos, MAXIMO_POR_PAGINA));
  const paginas = Math.max(1, Math.ceil(otras.length / porPagina));
  const pagina = Math.min(paginaPedida, paginas - 1);
  const resto = enModoDestacado ? teselas.filter((tesela) => tesela !== destacada) : [];
  const visibles: DatosTesela[] = soloUna
    ? [destacada]
    : enModoDestacado
    ? [destacada, ...resto.slice(0, MAXIMO_EN_TIRA)]
    : [propia, ...otras.slice(pagina * porPagina, (pagina + 1) * porPagina)];

  const camarasVisibles = visibles.filter((tesela) => !tesela.esLocal && !tesela.pantalla).map((tesela) => tesela.id);
  const firma = camarasVisibles.join(",");
  useEffect(() => {
    suscribir(firma ? firma.split(",") : []);
  }, [firma]);

  if (soloUna) {
    return (
      <div className="relative h-full w-full">
        <Tesela datos={destacada} tamAvatar={160} />
        <button
          onClick={verTodos}
          className="absolute left-1/2 top-3 z-10 -translate-x-1/2 rounded-full bg-black/60 px-4 py-2 text-sm font-medium text-white shadow backdrop-blur hover:bg-black/75"
        >
          Ver a todos
        </button>
      </div>
    );
  }

  if (!enModoDestacado) {
    return (
      <div className="relative h-full w-full">
        <Mosaico teselas={visibles} />
        {paginas > 1 && <Paginador pagina={pagina} paginas={paginas} cambiar={(nueva) => fijar({ pagina: nueva })} />}
      </div>
    );
  }

  const ocultas = resto.length - (visibles.length - 1);
  return (
    <div className="flex h-full w-full flex-col gap-3 lg:flex-row">
      <div className="min-h-0 min-w-0 flex-1">
        <Tesela datos={destacada} tamAvatar={140} />
      </div>
      <div className="desplazable flex h-24 shrink-0 gap-3 overflow-x-auto sm:h-32 lg:h-auto lg:w-60 lg:flex-col lg:overflow-y-auto lg:overflow-x-hidden">
        {visibles.slice(1).map((datos) => (
          <div key={datos.clave} className="aspect-video h-full shrink-0 lg:h-auto lg:w-full">
            <Tesela datos={datos} tamAvatar={48} />
          </div>
        ))}
        {ocultas > 0 && (
          <div className="flex aspect-video h-full shrink-0 items-center justify-center rounded-xl bg-sala-superficie text-sm text-sala-tenue lg:h-auto lg:w-full">
            y {ocultas} más
          </div>
        )}
      </div>
    </div>
  );
}
