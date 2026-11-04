/** Muestra un texto convirtiendo en enlaces las URL http(s). Nada de HTML del remitente se interpreta. */
const PATRON_URL = /(https?:\/\/[^\s<>"']+)/g;

export function TextoConEnlaces({ texto }: { texto: string }) {
  return (
    <>
      {texto.split(PATRON_URL).map((parte, indice) =>
        indice % 2 === 1 ? (
          <a key={indice} href={parte} target="_blank" rel="noopener noreferrer nofollow" className="text-acento-fuerte underline">
            {parte}
          </a>
        ) : (
          parte
        )
      )}
    </>
  );
}
