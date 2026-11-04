package main

import (
	"encoding/json"
	"log"
	"net/http"
	"time"

	"github.com/gorilla/websocket"
)

// WebSocket de señalización: admite, valida y despacha cada mensaje del navegador. La identidad
// del emisor es siempre la de su conexión; el servidor asigna los identificadores.

const (
	tamanoMaximoMensaje = 96 * 1024
	ventanaTasa         = 10 * time.Second
	maximoPorVentana    = 400
)

var actualizador = websocket.Upgrader{
	ReadBufferSize:  4096,
	WriteBufferSize: 4096,
	// La web se sirve desde el propio servidor (directo, red local o túnel); las salas se protegen
	// con su código, así que no se filtra el origen.
	CheckOrigin: func(*http.Request) bool { return true },
}

func (s *Servidor) atenderSenal(w http.ResponseWriter, r *http.Request) {
	s.mu.Lock()
	if s.conexiones >= s.config.maximoConexiones {
		s.mu.Unlock()
		http.Error(w, "Demasiadas conexiones", http.StatusServiceUnavailable)
		return
	}
	s.conexiones++
	s.mu.Unlock()
	defer func() {
		s.mu.Lock()
		s.conexiones--
		s.mu.Unlock()
	}()

	conn, err := actualizador.Upgrade(w, r, nil)
	if err != nil {
		return
	}
	defer conn.Close()
	conn.SetReadLimit(tamanoMaximoMensaje)
	_ = conn.SetReadDeadline(time.Now().Add(60 * time.Second))
	conn.SetPongHandler(func(string) error { return conn.SetReadDeadline(time.Now().Add(60 * time.Second)) })

	p := &Participante{id: nuevoID(), conn: conn, publicadas: map[string]*Publicada{}}
	detener := make(chan struct{})
	defer close(detener)
	go latido(p, detener)
	defer s.salir(p)

	clientes, _ := s.ice()
	p.enviar(M{"tipo": "SERVIDORES_ICE", "servidores": clientes})

	inicioVentana, cuenta := time.Now(), 0
	for {
		_, datos, err := conn.ReadMessage()
		if err != nil {
			return
		}
		if time.Since(inicioVentana) > ventanaTasa {
			inicioVentana, cuenta = time.Now(), 0
		}
		if cuenta++; cuenta > maximoPorVentana {
			log.Printf("[Política] Conexión cerrada por exceso de mensajes.")
			return
		}
		var mensaje MensajeEntrante
		if json.Unmarshal(datos, &mensaje) != nil {
			p.enviar(M{"tipo": "ERROR", "codigo": "MENSAJE_INVALIDO", "mensaje": "El mensaje no es JSON válido."})
			continue
		}
		s.despachar(p, &mensaje)
	}
}

func latido(p *Participante, detener <-chan struct{}) {
	t := time.NewTicker(25 * time.Second)
	defer t.Stop()
	for {
		select {
		case <-detener:
			return
		case <-t.C:
			p.escMu.Lock()
			_ = p.conn.WriteControl(websocket.PingMessage, nil, time.Now().Add(5*time.Second))
			p.escMu.Unlock()
		}
	}
}

func errorA(p *Participante, codigo, texto string) {
	p.enviar(M{"tipo": "ERROR", "codigo": codigo, "mensaje": texto})
}

func (s *Servidor) despachar(p *Participante, m *MensajeEntrante) {
	if m.Tipo == "UNIRSE" {
		s.unirse(p, m)
		return
	}
	sala := p.sala
	if sala == nil {
		errorA(p, "NO_EN_SALA", "Primero hay que unirse a una reunión.")
		return
	}
	switch m.Tipo {
	case "SENAL":
		if !cargaValida(m.Carga) {
			errorA(p, "MENSAJE_INVALIDO", "Señal no válida.")
			return
		}
		p.recibirSenal(m.Carga)
	case "ESTADO":
		s.cambiarEstado(p, m.Cambios)
	case "CHAT":
		texto := limpiarTexto(m.Texto, largoMaximoChat, true)
		if texto == "" || len(m.Texto) > largoMaximoChat*8 {
			errorA(p, "MENSAJE_INVALIDO", "Mensaje vacío o demasiado largo.")
			return
		}
		sala.difundir(M{"tipo": "CHAT", "mensaje": sala.agregarChat(p, texto, nil)}, "")
	case "REACCION":
		if !reacciones[m.Emoji] {
			errorA(p, "MENSAJE_INVALIDO", "Reacción no admitida.")
			return
		}
		sala.difundir(M{"tipo": "REACCION", "id": p.id, "emoji": m.Emoji}, "")
	case "SUSCRIBIR":
		if len(m.Videos) > 200 {
			return
		}
		sala.mu.Lock()
		p.deseados = append([]string{}, m.Videos...)
		p.suscrito = true
		sala.mu.Unlock()
		go p.actualizar()
	default:
		errorA(p, "MENSAJE_INVALIDO", "Tipo de mensaje desconocido.")
	}
}

func (s *Servidor) unirse(p *Participante, m *MensajeEntrante) {
	if p.sala != nil {
		errorA(p, "YA_EN_SALA", "Esta conexión ya está en una reunión.")
		return
	}
	nombre := limpiarTexto(m.Nombre, largoMaximoNombre, false)
	if !salaValida(m.Sala) || nombre == "" || m.Estado == nil {
		errorA(p, "MENSAJE_INVALIDO", "Código de reunión o nombre no válidos.")
		return
	}
	p.datos = DatosParticipante{ID: p.id, Nombre: nombre, EntradaEn: ahoraMs(), Estado: EstadoParticipante{Microfono: m.Estado.Microfono, Camara: m.Estado.Camara}}
	_, iceServidor := s.ice()
	if err := p.crearConexion(s.api, iceServidor); err != nil {
		errorA(p, "ERROR_INTERNO", "No se pudo preparar la conexión de medios.")
		return
	}
	if codigo, texto := s.entrar(p, m.Sala); codigo != "" {
		_ = p.pc.Close()
		errorA(p, codigo, texto)
	}
}

func (s *Servidor) cambiarEstado(p *Participante, crudo json.RawMessage) {
	var cambios CambiosEstado
	if json.Unmarshal(crudo, &cambios) != nil {
		return
	}
	sala := p.sala
	sala.mu.Lock()
	e := &p.datos.Estado
	pantallaAntes := e.Pantalla
	if cambios.Microfono != nil {
		e.Microfono = *cambios.Microfono
	}
	if cambios.Camara != nil {
		e.Camara = *cambios.Camara
	}
	if cambios.Pantalla != nil {
		e.Pantalla = *cambios.Pantalla
	}
	if cambios.Mano != nil {
		if *cambios.Mano && e.Mano == nil {
			ahora := ahoraMs()
			e.Mano = &ahora
		} else if !*cambios.Mano {
			e.Mano = nil
		}
	}
	estado := *e
	sala.mu.Unlock()
	sala.difundir(M{"tipo": "ESTADO", "id": p.id, "estado": estado}, "")
	if pantallaAntes != estado.Pantalla {
		sala.actualizarResto(p.id)
	}
}
