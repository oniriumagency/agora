"use client";
import { irAlDirecto, reintentarMedios } from "@/estado/sesion";
import { useReunion } from "@/estado/useReunion";
import { AudiosRemotos } from "./AudiosRemotos";
import { Avisos } from "./Avisos";
import { BarraControles } from "./BarraControles";
import { Escenario } from "./Escenario";
import { PanelLateral } from "./PanelLateral";
import { ReaccionesFlotantes } from "./ReaccionesFlotantes";
import { TarjetaInvitar } from "./TarjetaInvitar";
import { useAtajos } from "./useAtajos";

/** Pantalla de la reunión: escenario, panel lateral opcional y barra de controles. */
export function Reunion() {
  const fase = useReunion((estado) => estado.fase);
  const avisoMedios = useReunion((estado) => estado.avisoMedios);
  const reponiendo = useReunion((estado) => estado.reponiendo);
  useAtajos();

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-sala-fondo text-sala-texto">
      {fase === "reconectando" && (
        <div className="bg-oro px-4 py-2 text-center text-sm font-medium text-gray-900" role="status">
          Se perdió la conexión con el servidor. Reconectando…
        </div>
      )}
      {reponiendo && (
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 bg-acento-fuerte px-4 py-2 text-center text-sm text-white" role="status">
          <span>⏩ Escuchando a 1,5× lo que se dijo mientras no estabas</span>
          <button onClick={irAlDirecto} className="rounded-full bg-white/20 px-3 py-1 font-medium hover:bg-white/30">
            Ir al directo
          </button>
        </div>
      )}
      {avisoMedios && (
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 bg-peligro-fuerte px-4 py-2 text-center text-sm text-white" role="alert">
          <span>{avisoMedios}</span>
          <button onClick={reintentarMedios} className="rounded-full bg-white/20 px-3 py-1 font-medium hover:bg-white/30">
            Reintentar
          </button>
        </div>
      )}
      <div className="flex min-h-0 flex-1 gap-4 p-3 pb-0 sm:p-4 sm:pb-0">
        <main className="relative min-h-0 min-w-0 flex-1">
          {fase === "conectando" ? (
            <div className="flex h-full flex-col items-center justify-center gap-4 text-sala-tenue" role="status">
              <span className="h-10 w-10 animate-spin rounded-full border-4 border-sala-tesela border-t-acento" />
              Uniéndote a la reunión…
            </div>
          ) : (
            <Escenario />
          )}
        </main>
        <PanelLateral />
      </div>
      <BarraControles />
      <AudiosRemotos />
      <TarjetaInvitar />
      <ReaccionesFlotantes />
      <Avisos />
    </div>
  );
}
