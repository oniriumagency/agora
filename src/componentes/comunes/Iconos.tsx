import type { SVGProps } from "react";

/** Iconos de trazo propios (24×24, currentColor) para no depender de librerías externas. */
type Props = SVGProps<SVGSVGElement> & { tam?: number };

function Base({ tam = 24, children, ...resto }: Props) {
  return (
    <svg width={tam} height={tam} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...resto}>
      {children}
    </svg>
  );
}

export const IconoClip = (p: Props) => (
  <Base {...p}><path d="m21.4 11.1-8.9 8.9a6 6 0 0 1-8.5-8.5l8.9-8.9a4 4 0 0 1 5.7 5.7l-8.9 8.9a2 2 0 0 1-2.8-2.8l8.2-8.2" /></Base>
);
export const IconoDescargar = (p: Props) => (
  <Base {...p}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" /></Base>
);
export const IconoArchivo = (p: Props) => (
  <Base {...p}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /></Base>
);
export const IconoMicro = (p: Props) => (
  <Base {...p}><rect x="9" y="2" width="6" height="12" rx="3" /><path d="M5 10v1a7 7 0 0 0 14 0v-1M12 18v4M8 22h8" /></Base>
);
export const IconoMicroOff = (p: Props) => (
  <Base {...p}><path d="M15 9.3V5a3 3 0 0 0-5.7-1.3M9 9v2a3 3 0 0 0 5 2.2M19 10v1a7 7 0 0 1-1.1 3.8M5 10v1a7 7 0 0 0 11.4 5.4M12 18v4M8 22h8M3 3l18 18" /></Base>
);
export const IconoCamara = (p: Props) => (
  <Base {...p}><rect x="2" y="6" width="14" height="12" rx="2" /><path d="m16 10 6-3.5v11L16 14" /></Base>
);
export const IconoCamaraOff = (p: Props) => (
  <Base {...p}><path d="M10.7 6H14a2 2 0 0 1 2 2v3.3l6-4.8v11M16 16a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h2M3 3l18 18" /></Base>
);
export const IconoPresentar = (p: Props) => (
  <Base {...p}><rect x="2" y="4" width="20" height="13" rx="2" /><path d="M8 21h8M12 17v4M12 13V8M9.5 10.5 12 8l2.5 2.5" /></Base>
);
export const IconoMano = (p: Props) => (
  <Base {...p}><path d="M18 11V6a2 2 0 0 0-4 0v5M14 10V4a2 2 0 0 0-4 0v6M10 10.5V6a2 2 0 0 0-4 0v8" /><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.9-6-2.4l-3.6-3.6a2 2 0 0 1 2.8-2.8L6 14" /></Base>
);
export const IconoChat = (p: Props) => (
  <Base {...p}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></Base>
);
export const IconoPersonas = (p: Props) => (
  <Base {...p}><circle cx="9" cy="7" r="4" /><path d="M17 11a3 3 0 1 0 0-6M1 21v-2a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v2M23 21v-2a5 5 0 0 0-3-4.6" /></Base>
);
export const IconoInfo = (p: Props) => (
  <Base {...p}><circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" /></Base>
);
export const IconoColgar = (p: Props) => (
  <Base {...p}><path d="M3.7 14.6 2.3 13.2a1.5 1.5 0 0 1 0-2.1C5 8.4 8.4 7 12 7s7 1.4 9.7 4.1a1.5 1.5 0 0 1 0 2.1l-1.4 1.4a1.5 1.5 0 0 1-2 .1l-2-1.6a1.5 1.5 0 0 1-.6-1.2v-1.6a12 12 0 0 0-7.4 0v1.6a1.5 1.5 0 0 1-.6 1.2l-2 1.6a1.5 1.5 0 0 1-2-.1z" /></Base>
);
export const IconoEmoji = (p: Props) => (
  <Base {...p}><circle cx="12" cy="12" r="10" /><path d="M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01" /></Base>
);
export const IconoCopiar = (p: Props) => (
  <Base {...p}><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></Base>
);
export const IconoEnviar = (p: Props) => (
  <Base {...p}><path d="m22 2-7 20-4-9-9-4zM22 2 11 13" /></Base>
);
export const IconoFijar = (p: Props) => (
  <Base {...p}><path d="M12 17v5M9 10.8V4h6v6.8l3 3.2v2H6v-2z" /></Base>
);
export const IconoPantallaCompleta = (p: Props) => (
  <Base {...p}><path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3" /></Base>
);
export const IconoSalirPantallaCompleta = (p: Props) => (
  <Base {...p}><path d="M8 3v3a2 2 0 0 1-2 2H3M21 8h-3a2 2 0 0 1-2-2V3M3 16h3a2 2 0 0 1 2 2v3M16 21v-3a2 2 0 0 1 2-2h3" /></Base>
);
export const IconoCerrar = (p: Props) => (
  <Base {...p}><path d="M18 6 6 18M6 6l12 12" /></Base>
);
export const IconoAjustes = (p: Props) => (
  <Base {...p}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></Base>
);
export const IconoTeclado = (p: Props) => (
  <Base {...p}><rect x="2" y="5" width="20" height="14" rx="2" /><path d="M6 9h.01M10 9h.01M14 9h.01M18 9h.01M8 13h.01M12 13h.01M16 13h.01M7 16h10" /></Base>
);
export const IconoVideoNuevo = (p: Props) => (
  <Base {...p}><rect x="2" y="6" width="14" height="12" rx="2" /><path d="m16 10 6-3.5v11L16 14M9 9v6M6 12h6" /></Base>
);
