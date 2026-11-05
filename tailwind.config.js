/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Paleta de Ágora (ver README):
        //   Azul Egeo Oscuro #1A2432 · texto, tipografía del logo, iconos y la sala de reunión
        //   Blanco Mármol    #F8F9FA · fondo principal
        //   Gris Caliza      #E2E4E8 · paneles, modales y bordes sutiles
        //   Terracota Ánfora #C55B43 · botones de acción y avisos
        //   Dorado Cívico    #D4A373 · acentos secundarios y estados activos
        sala: { fondo: "#1A2432", superficie: "#233041", tesela: "#2C3B50", borde: "#4A5A70", texto: "#F8F9FA", tenue: "#A8B2C0" },
        // acento: fuerte = terracota (acciones); DEFAULT y suave = dorado (activo, sobre fondo oscuro)
        acento: { DEFAULT: "#D4A373", fuerte: "#C55B43", hondo: "#A8472F", suave: "#F1DCC7" },
        // Colgar y errores: un rojo distinto de la terracota de los botones
        peligro: { DEFAULT: "#C2412D", fuerte: "#9F2F1E" },
        oro: { DEFAULT: "#D4A373", hondo: "#A8794A", suave: "#F3E6D8" },
        olivo: { DEFAULT: "#7D8B4E", suave: "#E5E9D6" },
        // Grises fríos de mármol y caliza, con el azul egeo oscuro como tinta
        gray: { 50: "#F8F9FA", 100: "#F0F1F3", 200: "#E2E4E8", 300: "#CBCFD6", 400: "#9AA1AB", 500: "#6E7682", 600: "#525A66", 700: "#3A4350", 800: "#283240", 900: "#1A2432" },
      },
      fontFamily: { marca: ["var(--fuente-marca)", "Georgia", "serif"] },
      keyframes: {
        subir: { "0%": { transform: "translateY(0)", opacity: "0" }, "10%": { opacity: "1" }, "100%": { transform: "translateY(-60vh)", opacity: "0" } },
        aparecer: { from: { opacity: "0", transform: "translateY(8px)" }, to: { opacity: "1", transform: "none" } },
      },
      animation: { subir: "subir 4s ease-out forwards", aparecer: "aparecer 0.2s ease-out both" },
    },
  },
  plugins: [],
};
