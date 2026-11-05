package main

import (
	"testing"
	"time"

	"github.com/pion/interceptor"
	"github.com/pion/interceptor/pkg/cc"
	"github.com/pion/rtcp"
	"github.com/pion/rtp"
)

type estimadorFijo struct{ bps int }

func (e *estimadorFijo) GetTargetBitrate() int           { return e.bps }
func (e *estimadorFijo) OnTargetBitrateChange(func(int)) {}
func (e *estimadorFijo) GetStats() map[string]any        { return nil }
func (e *estimadorFijo) Close() error                    { return nil }

func (e *estimadorFijo) WriteRTCP([]rtcp.Packet, interceptor.Attributes) error { return nil }
func (e *estimadorFijo) AddStream(_ *interceptor.StreamInfo, w interceptor.RTPWriter) interceptor.RTPWriter {
	return w
}

var _ cc.BandwidthEstimator = (*estimadorFijo)(nil)

// Una cámara con sus tres capas recibiendo paquetes ahora mismo.
func publicadaConCapas() *Publicada {
	pub := nuevaPublicada(&Participante{id: "autor-de-prueba"}, "camara", nil)
	for _, rid := range ordenCapas {
		c := &Capa{rid: rid}
		c.ultimo.Store(ahoraMs())
		pub.capas[rid] = c
	}
	return pub
}

func TestControlDeCapas(t *testing.T) {
	estimador := &estimadorFijo{bps: 3_000_000}
	p := &Participante{id: "espectador-prueba", estimador: estimador}
	p.control.nivel.Store(nivelMedio)
	p.control.esperaSubida = esperaSubidaInicial
	r, _ := nuevaRanura("camara", 0)
	r.preferida = nivelMedio
	r.fuente = publicadaConCapas()
	p.ranuras = []*Ranura{r}
	ahora := time.Now()
	paso := func(enviado int64, segundos int) {
		for i := 0; i < segundos; i++ {
			for _, c := range r.fuente.capas {
				c.ultimo.Store(ahoraMs())
			}
			p.enviados.Store(enviado / 8)
			ahora = ahora.Add(time.Second)
			p.ajustarCapas(ahora)
		}
	}
	// Holgura (3 Mbps estimados, se envían 600 kbps): sube a la capa alta tras la espera
	paso(600_000, 8)
	if r.preferida != nivelAlto {
		t.Fatalf("con holgura debía subir a la capa alta, está en %d", r.preferida)
	}
	// Congestión justo después de subir: baja y la siguiente subida espera el doble
	estimador.bps = 900_000
	paso(1_600_000, 2)
	if r.preferida != nivelMedio || p.control.esperaSubida != 2*esperaSubidaInicial {
		t.Fatalf("con congestión debía bajar y esperar más: capa %d, espera %v", r.preferida, p.control.esperaSubida)
	}
	// Mucha congestión: hasta la capa baja
	estimador.bps = 200_000
	paso(600_000, 3)
	if r.preferida != nivelBajo {
		t.Fatalf("con poco ancho de banda debía quedar en la capa baja, está en %d", r.preferida)
	}
}

func TestCambioDeCapaEnFotogramaClave(t *testing.T) {
	pub := publicadaConCapas()
	r, _ := nuevaRanura("camara", 0)
	r.preferida = nivelMedio
	r.fijarFuente(pub)
	clave := []byte{0x10, 0x00, 0x9d} // inicio de fotograma clave VP8
	delta := []byte{0x10, 0x01, 0x9d} // inicio de fotograma normal
	enviar := func(rid string, carga []byte, seq uint16) {
		r.escribir(&rtp.Packet{Header: rtp.Header{SequenceNumber: seq, Timestamp: uint32(seq) * 3000}, Payload: carga}, pub, rid)
	}
	enviar("h", delta, 1)
	if r.iniciada {
		t.Fatal("no debía empezar sin fotograma clave")
	}
	enviar("h", clave, 2)
	if r.capa != "h" {
		t.Fatalf("debía empezar en la capa media, está en %q", r.capa)
	}
	r.fijarPreferida(nivelAlto)
	enviar("h", delta, 3)
	enviar("f", delta, 100)
	if r.capa != "h" || r.ultimoSeq != 3 {
		t.Fatalf("mientras llega la clave de la capa alta debía seguir la media: capa %q, seq %d", r.capa, r.ultimoSeq)
	}
	enviar("f", clave, 101)
	if r.capa != "f" || r.ultimoSeq != 4 {
		t.Fatalf("debía pasar a la capa alta sin saltos de secuencia: capa %q, seq %d", r.capa, r.ultimoSeq)
	}
}
