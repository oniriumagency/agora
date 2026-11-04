"use client";
import { useReunion } from "@/estado/useReunion";
import { useTeselas } from "@/estado/useTeselas";
import { Mosaico } from "./Mosaico";
import { Tesela } from "./Tesela";

/**
 * Zona principal. Si hay algo fijado o alguien presenta, eso va en grande y el resto en una tira
 * lateral (abajo en pantallas estrechas); si no, todos en mosaico.
 */
const MAXIMO_EN_TIRA = 6;

export function Escenario() {
  const teselas = useTeselas();
  const fijado = useReunion((estado) => estado.fijado);
  const destacada =
    (fijado && teselas.find((tesela) => tesela.id === fijado.id && tesela.pantalla === fijado.pantalla)) ||
    teselas.find((tesela) => tesela.pantalla && !tesela.esLocal) ||
    teselas.find((tesela) => tesela.pantalla) ||
    null;

  if (!destacada || teselas.length === 1) return <Mosaico teselas={teselas} />;

  const resto = teselas.filter((tesela) => tesela !== destacada);
  const visibles = resto.slice(0, MAXIMO_EN_TIRA);
  const ocultas = resto.length - visibles.length;

  return (
    <div className="flex h-full w-full flex-col gap-3 lg:flex-row">
      <div className="min-h-0 min-w-0 flex-1">
        <Tesela datos={destacada} tamAvatar={140} />
      </div>
      <div className="desplazable flex h-24 shrink-0 gap-3 overflow-x-auto sm:h-32 lg:h-auto lg:w-60 lg:flex-col lg:overflow-y-auto lg:overflow-x-hidden">
        {visibles.map((datos) => (
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
