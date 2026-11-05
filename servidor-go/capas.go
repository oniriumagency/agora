package main

// Control de calidad por participante. Cada segundo compara el ancho de banda que GCC estima hacia
// su navegador con lo que de verdad se le envía, y sube o baja la capa de simulcast de las cámaras
// que ve. GCC no estima más de 1,5× lo que recibe, así que para subir hay que probar: si tras subir
// aparece congestión se baja enseguida y se espera cada vez más antes de volver a intentarlo.
//
// Además, a quien publica se le dice qué capa más alta está viendo alguien (mensaje CAPAS), para
// que su navegador no gaste subida en calidades que nadie recibe.

import (
	"sync/atomic"
	"time"

	"github.com/pion/webrtc/v4"
)

const (
	nivelBajo  = 0
	nivelMedio = 1
	nivelAlto  = 2

	esperaSubidaInicial = 6 * time.Second
	esperaSubidaMaxima  = 2 * time.Minute
)

type controlCapas struct {
	nivel atomic.Int32
	// Solo los usa el bucle de vigilarCapas:
	tasa         float64 // bps enviados, suavizados
	holguraDesde time.Time
	ultimaSubida time.Time
	esperaSubida time.Duration
}

func (p *Participante) vigilarCapas(pc *webrtc.PeerConnection) {
	c := &p.control
	c.nivel.Store(nivelMedio)
	c.esperaSubida = esperaSubidaInicial
	reloj := time.NewTicker(time.Second)
	defer reloj.Stop()
	for range reloj.C {
		if pc.ConnectionState() == webrtc.PeerConnectionStateClosed {
			return
		}
		p.ajustarCapas(time.Now())
		if pub := p.publicadaDe("camara"); pub != nil {
			pub.anunciarMaxima()
		}
	}
}

func (p *Participante) camarasVisibles() []*Ranura {
	p.negMu.Lock()
	defer p.negMu.Unlock()
	var lista []*Ranura
	for _, r := range p.ranuras {
		if r.tipo == "camara" && r.fuenteActual() != nil {
			lista = append(lista, r)
		}
	}
	return lista
}

func (p *Participante) ajustarCapas(ahora time.Time) {
	c := &p.control
	bps := float64(p.enviados.Swap(0) * 8)
	if c.tasa == 0 {
		c.tasa = bps
	} else {
		c.tasa = 0.6*c.tasa + 0.4*bps
	}
	camaras := p.camarasVisibles()
	if p.estimador == nil || len(camaras) == 0 {
		return
	}
	estimado := float64(p.estimador.GetTargetBitrate())
	// Con pocas cámaras en pantalla se ven grandes y vale la pena la calidad alta
	techo := int32(nivelMedio)
	if len(camaras) <= 2 {
		techo = nivelAlto
	}
	nivel := c.nivel.Load()
	switch {
	case c.tasa > 150_000 && estimado < 0.85*c.tasa && nivel > nivelBajo:
		nivel--
		if ahora.Sub(c.ultimaSubida) < 10*time.Second { // la subida reciente no cabía
			c.esperaSubida = min(c.esperaSubida*2, esperaSubidaMaxima)
		}
		c.holguraDesde = time.Time{}
	case estimado > 1.3*c.tasa:
		if c.holguraDesde.IsZero() {
			c.holguraDesde = ahora
		}
		if nivel < techo && ahora.Sub(c.holguraDesde) >= c.esperaSubida {
			nivel++
			c.ultimaSubida = ahora
			c.holguraDesde = time.Time{}
		}
	default:
		c.holguraDesde = time.Time{}
	}
	if ahora.Sub(c.ultimaSubida) > 5*time.Minute {
		c.esperaSubida = esperaSubidaInicial
	}
	nivel = min(nivel, techo)
	c.nivel.Store(nivel)
	for _, r := range camaras {
		r.fijarPreferida(int(nivel))
	}
}

// anunciarMaxima avisa al autor de la capa más alta que alguien quiere recibir.
func (pub *Publicada) anunciarMaxima() {
	maxima := int32(nivelBajo)
	pub.mu.RLock()
	for r := range pub.destinos {
		r.mu.Lock()
		maxima = max(maxima, int32(r.preferida))
		r.mu.Unlock()
	}
	pub.mu.RUnlock()
	if pub.maxima.Swap(maxima) != maxima {
		pub.autor.enviar(M{"tipo": "CAPAS", "maxima": maxima})
	}
}
