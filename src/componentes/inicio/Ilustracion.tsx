import { Avatar } from "../comunes/Avatar";
import { IconoMano, IconoMicroOff } from "../comunes/Iconos";

/** Composición decorativa de la portada: un mosaico de reunión simplificado. */
const PERSONAS = ["Lucía", "Mateo", "Sofía", "Diego"];

export function Ilustracion() {
  return (
    <div aria-hidden="true" className="w-full max-w-md flex-1">
      <div className="rounded-3xl bg-sala-fondo p-3 shadow-2xl">
        <div className="grid grid-cols-2 gap-2">
          {PERSONAS.map((nombre, indice) => (
            <div key={nombre} className={`relative flex aspect-video items-center justify-center rounded-xl bg-sala-tesela ${indice === 0 ? "ring-[3px] ring-acento" : ""}`}>
              <Avatar nombre={nombre} tam={52} />
              <span className="absolute bottom-1.5 left-2 text-xs text-white">{nombre}</span>
              {indice === 1 && <IconoMicroOff tam={16} className="absolute right-2 top-2 text-white" />}
              {indice === 2 && (
                <span className="absolute left-2 top-2 rounded-full bg-white p-1 text-gray-900">
                  <IconoMano tam={14} />
                </span>
              )}
            </div>
          ))}
        </div>
        <div className="mt-3 flex justify-center gap-2">
          {["bg-sala-tesela", "bg-sala-tesela", "bg-sala-tesela", "bg-peligro"].map((fondo, indice) => (
            <span key={indice} className={`h-8 ${indice === 3 ? "w-12" : "w-8"} rounded-full ${fondo}`} />
          ))}
        </div>
      </div>
    </div>
  );
}
