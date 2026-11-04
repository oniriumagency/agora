import { useMemo } from "react";
import { useReunion } from "./useReunion";

/**
 * Lista de teselas a pintar: la cámara (o avatar) de cada persona y, aparte, cada pantalla
 * compartida. La propia persona va primero.
 */
export interface DatosTesela {
  clave: string;
  id: string;
  nombre: string;
  esLocal: boolean;
  pantalla: boolean;
  video: MediaStream | null;
  audio: MediaStream | null;
  microfono: boolean;
  mano: number | null;
}

export function useTeselas(): DatosTesela[] {
  const local = useReunion((estado) => estado.local);
  const participantes = useReunion((estado) => estado.participantes);
  const miNombre = useReunion((estado) => estado.miNombre);
  const miId = useReunion((estado) => estado.miId) ?? "yo";

  return useMemo(() => {
    const comunes = { id: miId, nombre: miNombre, esLocal: true, audio: local.flujoMicro, microfono: local.microfono, mano: local.mano };
    const teselas: DatosTesela[] = [{ ...comunes, clave: `${miId}:camara`, pantalla: false, video: local.camara ? local.flujoCamara : null }];
    if (local.pantalla && local.flujoPantalla) teselas.push({ ...comunes, clave: `${miId}:pantalla`, pantalla: true, video: local.flujoPantalla });

    const remotos = Object.values(participantes).sort((a, b) => a.entradaEn - b.entradaEn);
    for (const participante of remotos) {
      const { estado, flujos } = participante;
      const base = { id: participante.id, nombre: participante.nombre, esLocal: false, audio: flujos.audio ?? null, microfono: estado.microfono, mano: estado.mano };
      teselas.push({ ...base, clave: `${participante.id}:camara`, pantalla: false, video: estado.camara ? flujos.camara ?? null : null });
      if (estado.pantalla && flujos.pantalla) teselas.push({ ...base, clave: `${participante.id}:pantalla`, pantalla: true, video: flujos.pantalla });
    }
    return teselas;
  }, [local, participantes, miNombre, miId]);
}
