package main

// Reconexión sin salir de la reunión. En el celular, al bloquear la pantalla, cambiar de app o de
// red, el navegador corta la conexión sin colgar. En vez de sacar a esa persona (y que todos vean
// "salió" y "entró"), se le guarda el sitio unos minutos marcada como ausente; si vuelve con la
// clave de su conexión anterior, retoma el mismo sitio, con el mismo id, chat y mano levantada.

import (
	"log"
	"time"
)

// desconectar se llama al cerrarse el WebSocket de p.
func (s *Servidor) desconectar(p *Participante, adrede bool) {
	sala := p.sala
	if sala == nil {
		p.cerrar()
		return
	}
	sala.mu.Lock()
	vigente := sala.miembros[p.id] == p
	sala.mu.Unlock()
	if !vigente { // ya lo reemplazó una conexión nueva de la misma persona
		p.cerrar()
		return
	}
	if adrede || s.config.graciaReconexion <= 0 {
		s.salir(p)
		return
	}
	p.cerrar()
	sala.mu.Lock()
	p.ausente = true
	p.publicadas = map[string]*Publicada{}
	p.datos.Estado.Ausente = true
	p.datos.Estado.Pantalla = false
	estado := p.datos.Estado
	sala.mu.Unlock()
	log.Printf("[Sala %s] %s perdió la conexión; se le guarda el sitio %s", sala.codigo, p.datos.Nombre, s.config.graciaReconexion)
	// Desde el último latido: lo que se dijo mientras el corte aún no se notaba también se repone
	p.ausenteDesde = p.ultimaSenal.Load()
	if p.ausenteDesde == 0 || ahoraMs()-p.ausenteDesde > ventanaFija.Milliseconds() {
		p.ausenteDesde = ahoraMs()
	}
	sala.grabacion.activar(ahoraMs() + (s.config.graciaReconexion + 30*time.Second).Milliseconds())
	sala.difundir(M{"tipo": "ESTADO", "id": p.id, "estado": estado}, p.id)
	sala.actualizarResto(p.id)
	time.AfterFunc(s.config.graciaReconexion, func() {
		sala.mu.Lock()
		sigue := sala.miembros[p.id] == p && p.ausente
		sala.mu.Unlock()
		if sigue {
			s.salir(p)
		}
	})
}

// reanudar mete la conexión nueva p en el sitio de la anterior. Devuelve false si no hay sitio que
// retomar (expiró o es otra sala): entonces se entra como alguien nuevo.
func (s *Servidor) reanudar(p *Participante, m *MensajeEntrante, nombre string) bool {
	anterior := s.participantePorClave(m.Reanudar)
	if anterior == nil || anterior == p || anterior.sala == nil || anterior.sala.codigo != m.Sala {
		return false
	}
	sala := anterior.sala
	p.id = anterior.id
	_, iceServidor := s.ice()
	if err := p.crearConexion(s.api, iceServidor); err != nil {
		errorA(p, "ERROR_INTERNO", "No se pudo preparar la conexión de medios.")
		return true
	}

	sala.mu.Lock()
	if sala.miembros[anterior.id] != anterior {
		sala.mu.Unlock()
		_ = p.pc.Close()
		p.id = nuevoID()
		p.pc = nil
		return false
	}
	p.datos = anterior.datos
	p.datos.Nombre = nombre
	p.datos.Estado.Microfono = m.Estado.Microfono
	p.datos.Estado.Camara = m.Estado.Camara
	p.datos.Estado.Pantalla = m.Estado.Pantalla
	p.datos.Estado.Ausente = false
	p.deseados, p.suscrito = anterior.deseados, anterior.suscrito
	p.dispositivo = anterior.dispositivo
	ausenteDesde := anterior.ausenteDesde
	p.sala = sala
	sala.miembros[p.id] = p
	presentes := make([]DatosParticipante, 0, len(sala.miembros))
	for _, q := range sala.miembros {
		if q != p {
			presentes = append(presentes, q.datos)
		}
	}
	chat := append([]MensajeChat{}, sala.chat...)
	estado := p.datos.Estado
	anfitrion := sala.anfitrion
	sala.mu.Unlock()

	p.clave = anterior.clave
	s.mu.Lock()
	s.claves[p.clave] = p
	s.mu.Unlock()
	// Si la conexión vieja seguía abierta (el servidor aún no notó el corte), se cierra ya.
	anterior.cerrar()
	_ = anterior.conn.Close()

	p.enviar(M{"tipo": "BIENVENIDA", "miId": p.id, "sala": sala.codigo, "participantes": presentes, "chat": chat, "maximoVideos": s.config.maximoVideos,
		"clave": p.clave, "maximoArchivoMB": s.config.maximoArchivoMB, "reanudada": true, "anfitrion": anfitrion, "ausenteDesde": ausenteDesde})
	sala.difundir(M{"tipo": "ESTADO", "id": p.id, "estado": estado}, p.id)
	sala.actualizarResto(p.id)
	log.Printf("[Sala %s] %s volvió a conectarse", sala.codigo, p.datos.Nombre)
	return true
}
