/**
 * Marca de Ágora: un anfiteatro visto desde arriba, con sus gradas y pasillos (y que a la vez son
 * ondas de voz), y el escenario en oro. Ágora era la plaza donde los griegos se reunían a hablar.
 */
export function SimboloAgora({ tam = 34 }: { tam?: number }) {
  return (
    <svg width={tam} height={tam} viewBox="0 0 64 64" aria-hidden="true">
      <defs>
        <linearGradient id="agora-egeo" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2A6DB5" />
          <stop offset="1" stopColor="#173F73" />
        </linearGradient>
        <mask id="agora-pasillos">
          <rect width="64" height="64" fill="#fff" />
          <g stroke="#000" strokeWidth="2.6">
            <path d="M32 44 9.4 21.4" />
            <path d="M32 44V12" />
            <path d="M32 44 54.6 21.4" />
          </g>
        </mask>
      </defs>
      <rect width="64" height="64" rx="15" fill="url(#agora-egeo)" />
      <g fill="none" stroke="#F6F1E6" strokeWidth="5" mask="url(#agora-pasillos)">
        <path d="M22.5 44a9.5 9.5 0 0 1 19 0" />
        <path d="M15 44a17 17 0 0 1 34 0" />
        <path d="M7.5 44a24.5 24.5 0 0 1 49 0" />
      </g>
      <rect x="25" y="47" width="14" height="3.4" rx="1" fill="#D9AE4E" />
      <rect x="8" y="52.5" width="48" height="2.6" rx="1.3" fill="#D9AE4E" />
    </svg>
  );
}

export function Logo({ oscuro = false }: { oscuro?: boolean }) {
  return (
    <span className={`flex items-center gap-2.5 ${oscuro ? "text-sala-texto" : "text-gray-900"}`}>
      <SimboloAgora />
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
