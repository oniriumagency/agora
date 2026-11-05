package main

// Publicada: una pista que un participante envía al servidor (micrófono, cámara o pantalla) y la
// lista de ranuras de otros participantes a las que se reenvía.
//
// La cámara llega en simulcast: tres capas ("q" baja, "h" media, "f" alta) de la misma imagen.
// Cada ranura recibe solo una, la que cabe en la conexión de quien mira (ver capas.go). El audio
// y la pantalla tienen una sola capa ("").

import (
	"sync"
	"sync/atomic"
	"time"

	"github.com/pion/rtcp"
	"github.com/pion/webrtc/v4"
)

// ordenCapas: de menos a más calidad.
var ordenCapas = []string{"q", "h", "f"}

type Capa struct {
	rid    string
	remota *webrtc.TrackRemote
	ultimo atomic.Int64 // ms del último paquete: una capa sin paquetes recientes no se usa
}

type Publicada struct {
	autor    *Participante
	tipo     string
	receptor *webrtc.RTPReceiver

	capasMu sync.RWMutex
	capas   map[string]*Capa

	mu       sync.RWMutex
	destinos map[*Ranura]struct{}

	claveMu     sync.Mutex
	ultimaClave map[string]time.Time
	// maxima: capa más alta que alguien está viendo; se le pide al autor que no envíe las de encima
	maxima atomic.Int32
}

func nuevaPublicada(autor *Participante, tipo string, receptor *webrtc.RTPReceiver) *Publicada {
	p := &Publicada{autor: autor, tipo: tipo, receptor: receptor, capas: map[string]*Capa{}, destinos: map[*Ranura]struct{}{}, ultimaClave: map[string]time.Time{}}
	p.maxima.Store(-1)
	return p
}

// agregarCapa empieza a reenviar una capa nueva de esta pista.
func (p *Publicada) agregarCapa(remota *webrtc.TrackRemote) {
	c := &Capa{rid: remota.RID(), remota: remota}
	c.ultimo.Store(ahoraMs())
	p.capasMu.Lock()
	p.capas[c.rid] = c
	p.capasMu.Unlock()
	go p.reenviar(c)
}

// activas devuelve las capas que llegan ahora, de menos a más calidad.
func (p *Publicada) activas() []string {
	limite := ahoraMs() - 1500
	p.capasMu.RLock()
	defer p.capasMu.RUnlock()
	if c := p.capas[""]; c != nil {
		return []string{""}
	}
	var lista []string
	for _, rid := range ordenCapas {
		if c := p.capas[rid]; c != nil && c.ultimo.Load() >= limite {
			lista = append(lista, rid)
		}
	}
	return lista
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

// reenviar lee una capa del autor y la entrega a cada ranura suscrita hasta que se cierra.
func (p *Publicada) reenviar(c *Capa) {
	for {
		paquete, _, err := c.remota.ReadRTP()
		if err != nil {
			return
		}
		c.ultimo.Store(ahoraMs())
		p.mu.RLock()
		for r := range p.destinos {
			r.escribir(paquete, p, c.rid)
		}
		p.mu.RUnlock()
	}
}

// pedirClave solicita un fotograma clave de una capa al autor (como mucho cada 300 ms).
func (p *Publicada) pedirClave(rid string) {
	if p.tipo == "audio" {
		return
	}
	p.capasMu.RLock()
	c := p.capas[rid]
	p.capasMu.RUnlock()
	if c == nil {
		return
	}
	p.claveMu.Lock()
	if time.Since(p.ultimaClave[rid]) < 300*time.Millisecond {
		p.claveMu.Unlock()
		return
	}
	p.ultimaClave[rid] = time.Now()
	p.claveMu.Unlock()
	if pc := p.autor.pc; pc != nil {
		_ = pc.WriteRTCP([]rtcp.Packet{&rtcp.PictureLossIndication{MediaSSRC: uint32(c.remota.SSRC())}})
	}
}
