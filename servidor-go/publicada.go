package main

// Publicada: una pista que un participante envía al servidor (micrófono, cámara o pantalla) y la
// lista de ranuras de otros participantes a las que se reenvía.

import (
	"sync"
	"time"

	"github.com/pion/rtcp"
	"github.com/pion/webrtc/v4"
)

type Publicada struct {
	autor  *Participante
	tipo   string
	remota *webrtc.TrackRemote

	mu       sync.RWMutex
	destinos map[*Ranura]struct{}

	claveMu     sync.Mutex
	ultimaClave time.Time
}

func nuevaPublicada(autor *Participante, tipo string, remota *webrtc.TrackRemote) *Publicada {
	return &Publicada{autor: autor, tipo: tipo, remota: remota, destinos: map[*Ranura]struct{}{}}
}

func (p *Publicada) agregarDestino(r *Ranura) {
	p.mu.Lock()
	p.destinos[r] = struct{}{}
	p.mu.Unlock()
}

func (p *Publicada) quitarDestino(r *Ranura) {
	p.mu.Lock()
	delete(p.destinos, r)
	p.mu.Unlock()
}

// reenviar lee la pista del autor y la copia a cada ranura suscrita hasta que se cierra.
func (p *Publicada) reenviar() {
	for {
		paquete, _, err := p.remota.ReadRTP()
		if err != nil {
			return
		}
		p.mu.RLock()
		for r := range p.destinos {
			r.escribir(paquete, p)
		}
		p.mu.RUnlock()
	}
}

// pedirClave solicita un fotograma clave al autor (como mucho cada 300 ms).
func (p *Publicada) pedirClave() {
	if p.tipo == "audio" {
		return
	}
	p.claveMu.Lock()
	if time.Since(p.ultimaClave) < 300*time.Millisecond {
		p.claveMu.Unlock()
		return
	}
	p.ultimaClave = time.Now()
	p.claveMu.Unlock()
	if pc := p.autor.pc; pc != nil {
		_ = pc.WriteRTCP([]rtcp.Packet{&rtcp.PictureLossIndication{MediaSSRC: uint32(p.remota.SSRC())}})
	}
}
