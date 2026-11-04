"use client";
import { alternarMano } from "@/estado/controlesLocales";
import { useReunion } from "@/estado/useReunion";
import { Avatar } from "../comunes/Avatar";
import { IconoMano, IconoMicro, IconoMicroOff, IconoPresentar } from "../comunes/Iconos";

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
      </span>
      {fila.pantalla && <IconoPresentar tam={18} className="text-gray-500" aria-label="Presentando" />}
      {conMano && fila.esLocal ? (
        <button onClick={alternarMano} className="rounded-full px-3 py-1 text-xs font-medium text-acento-fuerte hover:bg-blue-50">
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
