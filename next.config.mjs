import { PHASE_DEVELOPMENT_SERVER } from "next/constants.js";

/**
 * Al compilar, la web se exporta como archivos estáticos (carpeta out/) que el servidor de Ágora
 * Meet lleva dentro. En desarrollo, cualquier ruta de reunión se reescribe a la página única.
 */
export default function configuracion(fase) {
  if (fase === PHASE_DEVELOPMENT_SERVER) {
    return {
      reactStrictMode: true,
      async rewrites() {
        return [{ source: "/:sala([a-z0-9-]{3,60})", destination: "/" }];
      },
    };
  }
  return { reactStrictMode: true, output: "export", poweredByHeader: false };
}
