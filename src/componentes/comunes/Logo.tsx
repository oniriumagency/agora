/**
 * Marca de Ágora: la A de Ágora, cuyo interior son las gradas de un anfiteatro (y a la vez ondas de
 * voz), sobre una escalinata. Ágora era la plaza donde los griegos se reunían a hablar.
 * Variante oscura (fondo azul egeo, ondas terracota, base dorada) para fondos claros, y clara
 * (fondo caliza, base azul egeo) para la sala oscura. Originales en marca/logo-*.svg.
 */
const ONDAS = [
  "M155.84,150.65h-14.37c-.03-4.53-1.49-8.73-3.97-12.15l10.24-10.24c5.04,6.09,8.08,13.89,8.11,22.39Z",
  "M103.47,138.55c-2.46,3.41-3.91,7.58-3.94,12.1h-14.37c.03-8.48,3.05-16.26,8.06-22.34l10.25,10.25Z",
  "M117.1,115.58v14.48c-3.26.53-6.27,1.83-8.85,3.69l-10.24-10.24c5.29-4.38,11.88-7.25,19.09-7.94Z",
  "M142.96,123.48l-10.25,10.25c-2.58-1.86-5.59-3.14-8.85-3.67v-14.48c7.21.68,13.8,3.53,19.1,7.9Z",
  "M88.71,123.8l-.23.49h0c-4.45,5.38-7.57,11.89-8.86,19.01v.02c-.44,2.38-.67,4.83-.68,7.33h-14.37c0-4.08.46-8.06,1.3-11.89h0c1.78-8.15,5.35-15.63,10.27-22.02.79-1.03,1.61-2.04,2.49-3.01l10.08,10.08Z",
  "M196.68,150.65h-14.37c-.03-15.79-6.01-30.21-15.82-41.14l10.17-10.17c12.4,13.53,19.99,31.55,20.02,51.31Z",
  "M74.48,109.56c-9.79,10.91-15.76,25.32-15.78,41.08h-14.37c.03-19.74,7.59-37.73,19.98-51.26l10.18,10.18Z",
  "M176.42,150.65h-14.37c0-2.5-.24-4.95-.67-7.33v-.02c-1.3-7.13-4.42-13.64-8.87-19h0s-.25-.56-.25-.56l10.06-10.06c.89.99,1.72,2,2.53,3.05,4.92,6.39,8.49,13.87,10.27,22.01h0c.85,3.84,1.29,7.82,1.3,11.9Z",
  "M117.1,94.93v14.41c-8.92.73-17.05,4.29-23.49,9.78l-10.19-10.19c4.98-4.42,10.75-7.97,17.08-10.4,5.21-2,10.79-3.25,16.59-3.6Z",
  "M157.54,108.9l-8.32,8.32-1.86,1.86c-6.44-5.49-14.58-9.03-23.5-9.74v-14.41c5.83.35,11.43,1.59,16.65,3.6,6.31,2.42,12.06,5.95,17.03,10.36Z",
  "M120.52,21.63s-44.37,66.51-51.42,72.97l10.17,10.17c1.29-1.16,2.64-2.27,4.02-3.32,6.1-4.61,13.07-8.12,20.63-10.23,5.28-1.48,10.85-2.27,16.59-2.27s11.31.79,16.59,2.27c7.56,2.11,14.53,5.62,20.63,10.23,1.37,1.04,2.7,2.13,3.97,3.29l10.18-10.18c-7.04-6.44-51.37-72.93-51.37-72.93ZM120.52,74.58c-3.08,0-6.11.19-9.09.54l9.09-19.49,9.09,19.49c-2.98-.36-6.01-.54-9.09-.54Z",
];
const COLORES = {
  oscuro: { fondo: "#1A2432", ondas: "#C55B43", base: "#D4A373" },
  claro: { fondo: "#E2E4E8", ondas: "#C55B43", base: "#1A2432" },
};

export function SimboloAgora({ tam = 34, variante = "oscuro" }: { tam?: number; variante?: keyof typeof COLORES }) {
  const color = COLORES[variante];
  return (
    <svg width={tam} height={tam} viewBox="0 0 241 241" aria-hidden="true">
      <rect width="241" height="241" rx="42.53" fill={color.fondo} />
      <g fill={color.ondas}>
        {ONDAS.map((d) => (
          <path key={d} d={d} />
        ))}
      </g>
      <g fill={color.base}>
        <rect x="44.3" y="157.41" width="152.41" height="14.37" />
        <polygon points="204.75 171.78 204.75 178.55 36.3 178.55 36.3 171.78 22.36 171.78 22.36 192.92 30.36 192.92 36.3 192.92 204.75 192.92 210.64 192.92 218.68 192.92 218.68 171.78 204.75 171.78" />
      </g>
    </svg>
  );
}

export function Logo({ oscuro = false }: { oscuro?: boolean }) {
  return (
    <span className={`flex items-center gap-2.5 ${oscuro ? "text-sala-texto" : "text-gray-900"}`}>
      <SimboloAgora variante={oscuro ? "claro" : "oscuro"} />
      <span className="font-marca text-[24px] font-semibold tracking-[0.08em]">Ágora</span>
    </span>
  );
}

/** Greca (meandro griego) como franja decorativa. */
export function Greca({ className = "" }: { className?: string }) {
  return (
    <svg className={className} height="12" width="100%" aria-hidden="true">
      <defs>
        <pattern id="agora-greca" width="24" height="12" patternUnits="userSpaceOnUse">
          <path d="M0 11H24M22 11V1H6V7H16V4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="square" />
        </pattern>
      </defs>
      <rect width="100%" height="12" fill="url(#agora-greca)" />
    </svg>
  );
}
