/** Círculo con la inicial del nombre; el color se deriva del nombre para que sea estable. */
const COLORES = ["#1a73e8", "#e8710a", "#188038", "#d93025", "#9334e6", "#12b5cb", "#e52592", "#7b5e57"];

export function colorDe(nombre: string): string {
  let suma = 0;
  for (const caracter of nombre) suma = (suma * 31 + caracter.codePointAt(0)!) >>> 0;
  return COLORES[suma % COLORES.length];
}

export function inicial(nombre: string): string {
  return ([...nombre.trim()][0] ?? "?").toUpperCase();
}

export function Avatar({ nombre, tam = 96, className = "" }: { nombre: string; tam?: number; className?: string }) {
  return (
    <div
      className={`flex shrink-0 select-none items-center justify-center rounded-full font-medium text-white ${className}`}
      style={{ width: tam, height: tam, backgroundColor: colorDe(nombre), fontSize: tam * 0.42 }}
    >
      {inicial(nombre)}
    </div>
  );
}
