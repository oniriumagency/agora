package main

import (
	"crypto/rand"
	"encoding/hex"
	"sort"
	"sync"
	"time"
)

// Salas en memoria: nacen con su primer participante y desaparecen con el último.

const historialMaximoChat = 200

type Sala struct {
	codigo   string
	servidor *Servidor
	mu       sync.Mutex
	miembros map[string]*Participante
	chat     []MensajeChat
	// anfitrion: quien abrió la reunión (o el siguiente en llegar si se fue). Puede silenciar y expulsar.
	anfitrion string
	// vetados: dispositivos expulsados; no pueden volver a esta reunión mientras exista.
	vetados map[string]bool
}

func nuevoID() string {
	b := make([]byte, 16)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}

func ahoraMs() int64 { return time.Now().UnixMilli() }

// difundir envía a todos (menos a `excepto`, si no es vacío). No se llama con s.mu tomado.
func (s *Sala) difundir(mensaje M, excepto string) {
	for _, p := range s.copiaMiembros() {
		if p.id != excepto {
			p.enviar(mensaje)
		}
	}
}

func (s *Sala) copiaMiembros() []*Participante {
	s.mu.Lock()
	defer s.mu.Unlock()
	lista := make([]*Participante, 0, len(s.miembros))
	for _, p := range s.miembros {
		lista = append(lista, p)
	}
	return lista
}

// actualizarResto reparte de nuevo las ranuras de todos salvo `excepto`.
func (s *Sala) actualizarResto(excepto string) {
	for _, p := range s.copiaMiembros() {
		if p.id != excepto {
			go p.actualizar()
		}
	}
}

func (s *Sala) publicar(p *Participante, pub *Publicada) {
	s.mu.Lock()
	if _, sigue := s.miembros[p.id]; !sigue {
		s.mu.Unlock()
		return
	}
	p.publicadas[pub.tipo] = pub
	s.mu.Unlock()
	go pub.reenviar()
	s.actualizarResto(p.id)
}

// repartir asigna a las ranuras existentes las fuentes que `p` debe recibir y devuelve las que
// no caben (hacen falta ranuras nuevas). Audio: todos. Cámara: las que pidió ver, con tope.
// Pantalla: todas las presentaciones activas.
func (s *Sala) repartir(p *Participante, ranuras []*Ranura) []*Publicada {
	s.mu.Lock()
	otros := make([]*Participante, 0, len(s.miembros))
	for _, q := range s.miembros {
		if q != p {
			otros = append(otros, q)
		}
	}
	sort.Slice(otros, func(i, j int) bool { return otros[i].datos.EntradaEn < otros[j].datos.EntradaEn })
	porID := map[string]*Participante{}
	for _, q := range otros {
		porID[q.id] = q
	}
	quiere := map[string][]*Publicada{}
	for _, q := range otros {
		if pub := q.publicadas["audio"]; pub != nil {
			quiere["audio"] = append(quiere["audio"], pub)
		}
		if pub := q.publicadas["pantalla"]; pub != nil && q.datos.Estado.Pantalla {
			quiere["pantalla"] = append(quiere["pantalla"], pub)
		}
	}
	candidatos := p.deseados
	if !p.suscrito {
		candidatos = nil
		for _, q := range otros {
			candidatos = append(candidatos, q.id)
		}
	}
	for _, id := range candidatos {
		if q := porID[id]; q != nil && q.publicadas["camara"] != nil && len(quiere["camara"]) < s.servidor.config.maximoVideos {
			quiere["camara"] = append(quiere["camara"], q.publicadas["camara"])
		}
	}
	s.mu.Unlock()

	var sobrantes []*Publicada
	for _, tipo := range ordenPublicacion {
		deseadas := map[*Publicada]bool{}
		for _, pub := range quiere[tipo] {
			deseadas[pub] = true
		}
		var libres []*Ranura
		for _, r := range ranuras {
			if r.tipo != tipo {
				continue
			}
			if f := r.fuenteActual(); f != nil && deseadas[f] {
				delete(deseadas, f) // ya está en una ranura
			} else {
				libres = append(libres, r)
			}
		}
		for _, pub := range quiere[tipo] {
			if !deseadas[pub] {
				continue
			}
			if len(libres) > 0 {
				libres[0].fijarFuente(pub)
				libres = libres[1:]
			} else {
				sobrantes = append(sobrantes, pub)
			}
		}
		for _, r := range libres {
			r.fijarFuente(nil)
		}
	}
	return sobrantes
}

func (s *Sala) agregarChat(autor *Participante, texto string, archivo *ArchivoChat) MensajeChat {
	s.mu.Lock()
	defer s.mu.Unlock()
	mensaje := MensajeChat{ID: nuevoID(), AutorID: autor.id, AutorNombre: autor.datos.Nombre, Texto: texto, EnviadoEn: ahoraMs(), Archivo: archivo}
	s.chat = append(s.chat, mensaje)
	if len(s.chat) > historialMaximoChat {
		s.chat = s.chat[1:]
	}
	return mensaje
}
