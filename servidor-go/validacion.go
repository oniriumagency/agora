package main

import (
	"regexp"
	"strings"
	"unicode"
)

// Validación de todo lo que llega del navegador: nada se da por bueno.

var patronSala = regexp.MustCompile(`^[a-z0-9]{3,12}(-[a-z0-9]{3,12}){0,3}$`)

const (
	largoMaximoNombre = 40
	largoMaximoChat   = 1000
	largoMaximoSDP    = 64_000
)

var reacciones = map[string]bool{"👍": true, "❤️": true, "😂": true, "😮": true, "👏": true, "🎉": true}

// limpiarTexto quita caracteres de control (salvo saltos de línea) y recorta espacios y longitud.
func limpiarTexto(texto string, maximo int, permitirSaltos bool) string {
	var b strings.Builder
	for _, r := range texto {
		if r == '\n' && permitirSaltos {
			b.WriteRune(r)
			continue
		}
		if unicode.IsControl(r) {
			continue
		}
		b.WriteRune(r)
	}
	limpio := []rune(strings.TrimSpace(b.String()))
	if len(limpio) > maximo {
		limpio = limpio[:maximo]
	}
	return strings.TrimSpace(string(limpio))
}

func salaValida(sala string) bool {
	return len(sala) <= 60 && patronSala.MatchString(sala)
}

func cargaValida(c *CargaSenal) bool {
	if c == nil {
		return false
	}
	if c.Tipo == "offer" || c.Tipo == "answer" {
		return len(c.SDP) > 0 && len(c.SDP) <= largoMaximoSDP
	}
	return c.Candidate != nil && len(*c.Candidate) <= 1000
}
