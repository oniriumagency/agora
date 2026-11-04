package main

import "log"

// moderar: el anfitrión silencia el micrófono de alguien o lo expulsa de la reunión.
func (s *Servidor) moderar(p *Participante, accion, objetivo string) {
	sala := p.sala
	sala.mu.Lock()
	esAnfitrion := sala.anfitrion == p.id
	q := sala.miembros[objetivo]
	sala.mu.Unlock()
	if !esAnfitrion {
		errorA(p, "NO_ANFITRION", "Solo el anfitrión puede hacer eso.")
		return
	}
	if q == nil || q == p {
		return
	}
	switch accion {
	case "silenciar":
		sala.mu.Lock()
		q.datos.Estado.Microfono = false
		estado := q.datos.Estado
		sala.mu.Unlock()
		q.enviar(M{"tipo": "SILENCIADO", "por": p.datos.Nombre})
		sala.difundir(M{"tipo": "ESTADO", "id": q.id, "estado": estado}, q.id)
		log.Printf("[Sala %s] %s silenció a %s", sala.codigo, p.id[:6], q.id[:6])
	case "expulsar":
		sala.mu.Lock()
		if q.dispositivo != "" {
			if sala.vetados == nil {
				sala.vetados = map[string]bool{}
			}
			sala.vetados[q.dispositivo] = true
		}
		sala.mu.Unlock()
		q.enviar(M{"tipo": "EXPULSADO", "por": p.datos.Nombre})
		log.Printf("[Sala %s] %s expulsó a %s", sala.codigo, p.id[:6], q.id[:6])
		s.salir(q)
		_ = q.conn.Close()
	default:
		errorA(p, "MENSAJE_INVALIDO", "Acción de moderación desconocida.")
	}
}
