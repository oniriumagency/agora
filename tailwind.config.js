/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Paleta griega de Ágora: noche del Egeo para la sala, mármol para las páginas claras,
        // azul egeo como acento, terracota para colgar y oro de las ánforas para destacar.
        sala: { fondo: "#0F1B2D", superficie: "#18293F", tesela: "#22385A", borde: "#4B6385", texto: "#F3EEE3", tenue: "#A9B6C8" },
        acento: { DEFAULT: "#8DBFEA", fuerte: "#1F5FA6", hondo: "#174A84", suave: "#D7E7F6" },
        peligro: { DEFAULT: "#D0603B", fuerte: "#B44B27" },
        oro: { DEFAULT: "#D9AE4E", hondo: "#A9822C", suave: "#F4E6C3" },
        olivo: { DEFAULT: "#7D8B4E", suave: "#E5E9D6" },
        // Grises cálidos de mármol y piedra, con tinta azul marino en lo más oscuro
        gray: { 50: "#FAF7F1", 100: "#F3EEE4", 200: "#E7E0D2", 300: "#D4CBBA", 400: "#A9A08F", 500: "#7D776B", 600: "#5D5A53", 700: "#45433F", 800: "#2C2F35", 900: "#142236" },
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
