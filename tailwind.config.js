/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Paleta de la sala: fondo grafito, superficies y acento azul
        sala: { fondo: "#202124", superficie: "#2d2e31", tesela: "#3c4043", borde: "#5f6368", texto: "#e8eaed", tenue: "#9aa0a6" },
        acento: { DEFAULT: "#8ab4f8", fuerte: "#1a73e8", suave: "#d2e3fc" },
        peligro: { DEFAULT: "#ea4335", fuerte: "#d93025" },
      },
      keyframes: {
        subir: { "0%": { transform: "translateY(0)", opacity: "0" }, "10%": { opacity: "1" }, "100%": { transform: "translateY(-60vh)", opacity: "0" } },
        aparecer: { from: { opacity: "0", transform: "translateY(8px)" }, to: { opacity: "1", transform: "none" } },
      },
      animation: { subir: "subir 4s ease-out forwards", aparecer: "aparecer 0.2s ease-out both" },
    },
  },
  plugins: [],
};
