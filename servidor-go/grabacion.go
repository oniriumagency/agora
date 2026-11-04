package main

// Búfer de audio para quien se reconecta. El servidor guarda en memoria los paquetes Opus de audio
// de cada persona: siempre los últimos 30 s (un corte de red tarda unos segundos en notarse) y,
// mientras alguien está desconectado, toda la ventana de gracia. Al
// volver, el navegador pide por tramos lo que se perdió (GET /reposicion) y lo escucha a 1,5×
// hasta alcanzar el directo. Nunca se escribe a disco; se descarta en cuanto nadie lo necesita.

import (
	"bytes"
	"encoding/json"
	"net/http"
	"sort"
	"strconv"
	"sync"
	"time"

	"github.com/pion/rtp"
	"github.com/pion/webrtc/v4/pkg/media/oggwriter"
)

const (
	muestrasPorTrama = 960 // 20 ms a 48 kHz
	maximoSilencio   = 50  // tramas de silencio seguidas que se rellenan entre paquetes (1 s)
	ventanaFija      = 30 * time.Second
)

// Trama Opus de silencio de 20 ms (CELT, banda completa): la que usan los códecs para huecos.
var tramaSilencio = []byte{0xF8, 0xFF, 0xFE}

type paqueteAudio struct {
	llegada int64 // ms
	ts      uint32
	carga   []byte
}

type grabadora struct {
	mu          sync.Mutex
	activaHasta int64 // ms; 0 = no se graba
	porAutor    map[string][]paqueteAudio
	nombres     map[string]string
}

func (g *grabadora) activar(hasta int64) {
	g.mu.Lock()
	if hasta > g.activaHasta {
		g.activaHasta = hasta
	}
	g.mu.Unlock()
}

func (g *grabadora) detener() {
	g.mu.Lock()
	g.activaHasta = 0 // vuelve a guardar solo los últimos 30 s
	g.mu.Unlock()
}

func (g *grabadora) agregar(autor *Participante, paquete *rtp.Packet, ventana time.Duration) {
	ahora := ahoraMs()
	g.mu.Lock()
	defer g.mu.Unlock()
	if ahora > g.activaHasta {
		ventana = ventanaFija - time.Minute // con el margen de abajo quedan 30 s
	}
	if g.porAutor == nil {
		g.porAutor, g.nombres = map[string][]paqueteAudio{}, map[string]string{}
	}
	lista := append(g.porAutor[autor.id], paqueteAudio{llegada: ahora, ts: paquete.Timestamp, carga: append([]byte(nil), paquete.Payload...)})
	// Solo se conserva la ventana de gracia (más un margen)
	limite := ahora - (ventana + time.Minute).Milliseconds()
	inicio := 0
	for inicio < len(lista) && lista[inicio].llegada < limite {
		inicio++
	}
	g.porAutor[autor.id] = lista[inicio:]
	g.nombres[autor.id] = autor.datos.Nombre
}

type pistaReposicion struct {
	Autor  string `json:"autor"`
	Nombre string `json:"nombre"`
	Ogg    []byte `json:"ogg"` // base64 en JSON
}

// tramo devuelve, por persona, el audio entre desde y ahora como Ogg Opus que empieza en desde.
func (g *grabadora) tramo(desde int64, excepto string) ([]pistaReposicion, int64) {
	hasta := ahoraMs()
	g.mu.Lock()
	copia := map[string][]paqueteAudio{}
	for autor, lista := range g.porAutor {
		if autor == excepto {
			continue
		}
		i := sort.Search(len(lista), func(i int) bool { return lista[i].llegada >= desde })
		if i < len(lista) {
			copia[autor] = append([]paqueteAudio(nil), lista[i:]...)
		}
	}
	nombres := map[string]string{}
	for k, v := range g.nombres {
		nombres[k] = v
	}
	g.mu.Unlock()

	var pistas []pistaReposicion
	for autor, lista := range copia {
		var salida bytes.Buffer
		ogg, err := oggwriter.NewWith(&salida, 48000, 2)
		if err != nil {
			continue
		}
		ts := uint32(0)
		seq := uint16(0)
		escribir := func(carga []byte) {
			seq++
			_ = ogg.WriteRTP(&rtp.Packet{Header: rtp.Header{SequenceNumber: seq, Timestamp: ts}, Payload: carga})
			ts += muestrasPorTrama
		}
		// Silencio inicial para que todas las pistas empiecen en "desde"
		for n := (lista[0].llegada - desde) / 20; n > 0; n-- {
			escribir(tramaSilencio)
		}
		for i, p := range lista {
			if i > 0 {
				huecos := int(int32(p.ts-lista[i-1].ts))/muestrasPorTrama - 1
				if huecos > maximoSilencio {
					// Pausa larga (micrófono apagado): se rellena según la hora de llegada
					huecos = int((p.llegada-lista[i-1].llegada)/20) - 1
				}
				for ; huecos > 0; huecos-- {
					escribir(tramaSilencio)
				}
			}
			escribir(p.carga)
		}
		_ = ogg.Close()
		pistas = append(pistas, pistaReposicion{Autor: autor, Nombre: nombres[autor], Ogg: salida.Bytes()})
	}
	return pistas, hasta
}

// atenderReposicion: GET /reposicion?desde=ms (cabecera X-Clave). Con ?fin=1 avisa que ya está al día.
func (s *Servidor) atenderReposicion(w http.ResponseWriter, r *http.Request) {
	permitirOrigenes(w)
	if r.Method == http.MethodOptions {
		return
	}
	p := s.participantePorClave(r.Header.Get("X-Clave"))
	if p == nil || p.sala == nil {
		http.Error(w, "Solo quien está en la reunión.", http.StatusForbidden)
		return
	}
	sala := p.sala
	g := &sala.grabacion
	if r.URL.Query().Get("fin") == "1" {
		if !sala.hayAusentes() {
			g.detener()
		}
		w.WriteHeader(http.StatusNoContent)
		return
	}
	desde, err := strconv.ParseInt(r.URL.Query().Get("desde"), 10, 64)
	if err != nil || desde <= 0 {
		http.Error(w, "Falta desde.", http.StatusBadRequest)
		return
	}
	g.activar(ahoraMs() + 20_000) // mientras se pone al día se sigue grabando
	pistas, hasta := g.tramo(desde, p.id)
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	_ = json.NewEncoder(w).Encode(M{"hasta": hasta, "pistas": pistas})
}

func (s *Sala) hayAusentes() bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	for _, q := range s.miembros {
		if q.ausente {
			return true
		}
	}
	return false
}
