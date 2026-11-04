/** Círculo con la inicial del nombre; el color se deriva del nombre para que sea estable. */
const COLORES = ["#1F5FA6", "#B44B27", "#6B7A3E", "#A9822C", "#2E7F86", "#8A4F7D", "#4B6385", "#9A5B3C"]; // egeo, terracota, olivo, oro, turquesa, púrpura de Tiro, piedra, arcilla

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
