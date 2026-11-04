package main

// Ranuras: cada participante recibe el audio y el vídeo de los demás por un conjunto de
// transceptores fijos ("ranuras"). Cambiar quién se ve en una ranura (al pasar de página o al
// empezar alguien a presentar) no exige renegociar: el servidor cambia la fuente y reescribe los
// números de secuencia y las marcas de tiempo para que el navegador vea un flujo continuo.

import (
	"fmt"
	"sync"
	"time"

	"github.com/pion/rtp"
	"github.com/pion/webrtc/v4"
)

type Ranura struct {
	tipo   string // "audio", "camara" o "pantalla"
	local  *webrtc.TrackLocalStaticRTP
	sender *webrtc.RTPSender
	mid    string

	mu             sync.Mutex
	fuente         *Publicada
	cambio         bool
	iniciada       bool
	offSeq         uint16
	offTs          uint32
	ultimoSeq      uint16
	ultimoTs       uint32
	ultimaPeticion time.Time
}

// fijarFuente cambia el origen de la ranura; nil la deja en silencio.
func (r *Ranura) fijarFuente(nueva *Publicada) {
	r.mu.Lock()
	anterior := r.fuente
	if anterior == nueva {
		r.mu.Unlock()
		return
	}
	r.fuente = nueva
	r.cambio = true
	r.mu.Unlock()
	if anterior != nil {
		anterior.quitarDestino(r)
	}
	if nueva != nil {
		nueva.agregarDestino(r)
		nueva.pedirClave()
	}
}

func (r *Ranura) fuenteActual() *Publicada {
	r.mu.Lock()
	defer r.mu.Unlock()
	return r.fuente
}

// escribir reenvía un paquete de la fuente con la secuencia y el tiempo reescritos.
func (r *Ranura) escribir(paquete *rtp.Packet, desde *Publicada) {
	r.mu.Lock()
	if r.fuente != desde {
		r.mu.Unlock()
		return
	}
	if r.cambio {
		// En vídeo hay que empezar por un fotograma clave o el decodificador mostraría basura
		if r.tipo != "audio" && !esClaveVP8(paquete.Payload) {
			pedir := time.Since(r.ultimaPeticion) > time.Second
			if pedir {
				r.ultimaPeticion = time.Now()
			}
			r.mu.Unlock()
			if pedir {
				desde.pedirClave()
			}
			return
		}
		if r.iniciada {
			paso := uint32(3000)
			if r.tipo == "audio" {
				paso = 960
			}
			r.offSeq = r.ultimoSeq + 1 - paquete.SequenceNumber
			r.offTs = r.ultimoTs + paso - paquete.Timestamp
		}
		r.cambio = false
		r.iniciada = true
	}
	copia := *paquete
	copia.Header.Extensions = nil
	copia.Header.Extension = false
	copia.SequenceNumber += r.offSeq
	copia.Timestamp += r.offTs
	r.ultimoSeq, r.ultimoTs = copia.SequenceNumber, copia.Timestamp
	r.mu.Unlock()
	_ = r.local.WriteRTP(&copia)
}

// esClaveVP8 indica si el paquete empieza un fotograma clave VP8 (RFC 7741).
func esClaveVP8(carga []byte) bool {
	if len(carga) < 1 {
		return false
	}
	b0 := carga[0]
	inicio, pid := b0&0x10 != 0, b0&0x07
	if !inicio || pid != 0 {
		return false
	}
	i := 1
	if b0&0x80 != 0 {
		if len(carga) <= i {
			return false
		}
		x := carga[i]
		i++
		if x&0x80 != 0 { // PictureID
			if len(carga) <= i {
				return false
			}
			if carga[i]&0x80 != 0 {
				i += 2
			} else {
				i++
			}
		}
		if x&0x40 != 0 { // TL0PICIDX
			i++
		}
		if x&0x30 != 0 { // TID/KEYIDX
			i++
		}
	}
	return len(carga) > i && carga[i]&0x01 == 0
}

func nuevaRanura(tipo string, numero int) (*Ranura, error) {
	capacidad := capacidadVideo
	if tipo == "audio" {
		capacidad = capacidadAudio
	}
	local, err := webrtc.NewTrackLocalStaticRTP(capacidad, fmt.Sprintf("%s-%d", tipo, numero), "agora")
	if err != nil {
		return nil, err
	}
	return &Ranura{tipo: tipo, local: local}, nil
}
