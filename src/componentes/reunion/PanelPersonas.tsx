"use client";
import { alternarMano } from "@/estado/controlesLocales";
import { moderar } from "@/estado/sesion";
import { useReunion } from "@/estado/useReunion";
import { Avatar } from "../comunes/Avatar";
import { IconoExpulsar, IconoMano, IconoMicro, IconoMicroOff, IconoPresentar } from "../comunes/Iconos";

/** Lista de personas: primero las manos levantadas (por orden de llegada) y después todos. */
interface Fila {
  id: string;
  nombre: string;
  esLocal: boolean;
  microfono: boolean;
  pantalla: boolean;
  mano: number | null;
}

export function PanelPersonas() {
  const local = useReunion((estado) => estado.local);
  const miNombre = useReunion((estado) => estado.miNombre);
  const miId = useReunion((estado) => estado.miId) ?? "yo";
  const participantes = useReunion((estado) => estado.participantes);
  const anfitrion = useReunion((estado) => estado.anfitrion);
  const soyAnfitrion = anfitrion !== null && anfitrion === miId;

  function expulsar(fila: Fila) {
    if (window.confirm(`¿Sacar a ${fila.nombre} de la reunión? No podrá volver a entrar a esta reunión.`)) moderar("expulsar", fila.id);
  }

  const filas: Fila[] = [
    { id: miId, nombre: miNombre, esLocal: true, microfono: local.microfono, pantalla: local.pantalla, mano: local.mano },
    ...Object.values(participantes)
      .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"))
      .map((p) => ({ id: p.id, nombre: p.nombre, esLocal: false, microfono: p.estado.microfono, pantalla: p.estado.pantalla, mano: p.estado.mano })),
  ];
  const manos = filas.filter((fila) => fila.mano !== null).sort((a, b) => a.mano! - b.mano!);

  const renglon = (fila: Fila, conMano: boolean) => (
    <li key={`${conMano}-${fila.id}`} className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-gray-50">
      <Avatar nombre={fila.nombre} tam={32} />
      <span className="min-w-0 flex-1 truncate text-sm">
        {fila.nombre}
        {fila.esLocal && <span className="text-gray-500"> (Tú)</span>}
        {fila.id === anfitrion && <span className="block text-xs text-oro-hondo">Anfitrión</span>}
      </span>
      {soyAnfitrion && !fila.esLocal && !conMano && (
        <span className="flex gap-1">
          {fila.microfono && (
            <button
              onClick={() => moderar("silenciar", fila.id)}
              className="flex h-8 w-8 items-center justify-center rounded-full text-gray-600 hover:bg-gray-100"
              title="Silenciar su micrófono"
              aria-label={`Silenciar a ${fila.nombre}`}
            >
              <IconoMicroOff tam={18} />
            </button>
          )}
          <button
            onClick={() => expulsar(fila)}
            className="flex h-8 w-8 items-center justify-center rounded-full text-peligro-fuerte hover:bg-peligro/10"
            title="Sacar de la reunión"
            aria-label={`Sacar a ${fila.nombre} de la reunión`}
          >
            <IconoExpulsar tam={18} />
          </button>
        </span>
      )}
      {fila.pantalla && <IconoPresentar tam={18} className="text-gray-500" aria-label="Presentando" />}
      {conMano && fila.esLocal ? (
        <button onClick={alternarMano} className="rounded-full px-3 py-1 text-xs font-medium text-acento-fuerte hover:bg-acento-suave/50">
          Bajar
        </button>
      ) : fila.microfono ? (
        <IconoMicro tam={18} className="text-gray-500" />
      ) : (
        <IconoMicroOff tam={18} className="text-gray-500" />
      )}
    </li>
  );

  return (
    <div className="desplazable flex-1 overflow-y-auto px-3 pb-4">
      {manos.length > 0 && (
        <section className="mb-4 rounded-xl border border-gray-200 py-2">
          <h3 className="flex items-center gap-2 px-3 pb-1 text-xs font-medium uppercase tracking-wide text-gray-500">
            <IconoMano tam={16} /> Manos levantadas ({manos.length})
          </h3>
          <ol>{manos.map((fila) => renglon(fila, true))}</ol>
        </section>
      )}
      <h3 className="px-3 pb-1 text-xs font-medium uppercase tracking-wide text-gray-500">En la reunión ({filas.length})</h3>
      <ul>{filas.map((fila) => renglon(fila, false))}</ul>
    </div>
  );
}
