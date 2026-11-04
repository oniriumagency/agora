package main

import (
	"regexp"
	"strings"
)

// Validación de todo lo que llega del navegador: nada se da por bueno.

var patronSala = regexp.MustCompile(`^[a-z0-9]{3,12}(-[a-z0-9]{3,12}){0,3}$`)

const (
	// Nombres, chat y nombres de archivo llegan cifrados (base64url): el servidor no los lee, solo
	// limita su tamaño. 40 caracteres de nombre y 1000 de chat cifrados caben con holgura.
	largoMaximoNombre = 400
	largoMaximoChat   = 6000
	largoMaximoSDP    = 64_000
	// minimoLetrasSala: los códigos de reunión deben ser largos (los generados tienen 10 letras).
	minimoLetrasSala = 10
)

// patronAcceso: huella de 32 bytes en base64url que el navegador deriva de la clave de la reunión.
var patronAcceso = regexp.MustCompile(`^[A-Za-z0-9_-]{43}$`)

var reacciones = map[string]bool{"👍": true, "❤️": true, "😂": true, "😮": true, "👏": true, "🎉": true}

func salaValida(sala string) bool {
	return len(sala) <= 60 && patronSala.MatchString(sala) && len(strings.ReplaceAll(sala, "-", "")) >= minimoLetrasSala
}

func accesoValido(acceso string) bool {
	return patronAcceso.MatchString(acceso)
}

// cifradoValido: texto cifrado por el navegador (base64url con prefijo de versión), sin recortarlo.
func cifradoValido(texto string, maximo int) bool {
	if len(texto) < 4 || len(texto) > maximo {
		return false
	}
	for _, r := range texto {
		if !(r == '-' || r == '_' || r == '.' || (r >= '0' && r <= '9') || (r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z')) {
			return false
		}
	}
	return true
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
