package main

import (
	"log"
	"net/http"
	"sync"

	"github.com/pion/webrtc/v4"
)

// Servidor: salas, motor WebRTC y servidores ICE que se dan a los navegadores.
type Servidor struct {
	config Config
	api    *webrtc.API

	iceMu       sync.RWMutex
	iceClientes []ServidorIce // STUN/TURN para el navegador
	iceServidor []webrtc.ICEServer

	mu         sync.Mutex
	salas      map[string]*Sala
	conexiones int
	claves     map[string]*Participante
	archivos   *almacenArchivos
}

func (s *Servidor) participantePorClave(clave string) *Participante {
	if clave == "" {
		return nil
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.claves[clave]
}

func nuevoServidor(config Config, api *webrtc.API) *Servidor {
	return &Servidor{config: config, api: api, salas: map[string]*Sala{}, claves: map[string]*Participante{}, archivos: nuevoAlmacen(config.carpetaDatos)}
}

func (s *Servidor) fijarIce(clientes []ServidorIce) {
	servidor := []webrtc.ICEServer{}
	for _, c := range clientes {
		servidor = append(servidor, webrtc.ICEServer{URLs: c.URLs, Username: c.Username, Credential: c.Credential})
	}
	s.iceMu.Lock()
	s.iceClientes, s.iceServidor = clientes, servidor
	s.iceMu.Unlock()
}

func (s *Servidor) ice() ([]ServidorIce, []webrtc.ICEServer) {
	s.iceMu.RLock()
	defer s.iceMu.RUnlock()
	return s.iceClientes, s.iceServidor
}

// entrar mete al participante en su sala o devuelve un código de error.
func (s *Servidor) entrar(p *Participante, codigo string) (string, string) {
	s.mu.Lock()
	sala := s.salas[codigo]
	if sala == nil {
		if len(s.salas) >= s.config.maximoSalas {
			s.mu.Unlock()
			return "LIMITE_SALAS", "El servidor alcanzó el máximo de reuniones simultáneas."
		}
		sala = &Sala{codigo: codigo, servidor: s, miembros: map[string]*Participante{}}
		s.salas[codigo] = sala
	}
	s.mu.Unlock()

	sala.mu.Lock()
	if len(sala.miembros) >= s.config.maximoPorSala {
		sala.mu.Unlock()
		return "SALA_LLENA", "La reunión está completa."
	}
	presentes := make([]DatosParticipante, 0, len(sala.miembros))
	for _, q := range sala.miembros {
		presentes = append(presentes, q.datos)
	}
	chat := append([]MensajeChat{}, sala.chat...)
	p.sala = sala
	sala.miembros[p.id] = p
	sala.mu.Unlock()

	p.clave = nuevoID()
	s.mu.Lock()
	s.claves[p.clave] = p
	s.mu.Unlock()
	p.enviar(M{"tipo": "BIENVENIDA", "miId": p.id, "sala": codigo, "participantes": presentes, "chat": chat, "maximoVideos": s.config.maximoVideos,
		"clave": p.clave, "maximoArchivoMB": s.config.maximoArchivoMB})
	sala.difundir(M{"tipo": "ENTRO", "participante": p.datos}, p.id)
	log.Printf("[Sala %s] Entró %s (%d personas)", codigo, p.datos.Nombre, len(presentes)+1)
	return "", ""
}

// salir saca al participante de su sala, avisa al resto y borra la sala si queda vacía.
func (s *Servidor) salir(p *Participante) {
	sala := p.sala
	if sala == nil {
		return
	}
	p.cerrar()
	s.mu.Lock()
	if s.claves[p.clave] == p {
		delete(s.claves, p.clave)
	}
	s.mu.Unlock()
	sala.mu.Lock()
	estaba := sala.miembros[p.id] == p
	if estaba {
		delete(sala.miembros, p.id)
	}
	quedan := len(sala.miembros)
	sala.mu.Unlock()
	if !estaba {
		return
	}
	log.Printf("[Sala %s] Salió %s (%d personas)", sala.codigo, p.datos.Nombre, quedan)
	sala.difundir(M{"tipo": "SALIO", "id": p.id}, "")
	sala.actualizarResto("")
	if quedan == 0 {
		s.mu.Lock()
		if s.salas[sala.codigo] == sala {
			delete(s.salas, sala.codigo)
		}
		s.mu.Unlock()
		s.archivos.olvidarSala(sala)
	}
}

func (s *Servidor) cantidadSalas() int {
	s.mu.Lock()
	defer s.mu.Unlock()
	return len(s.salas)
}

func (s *Servidor) rutas(web http.Handler) http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("/senal", s.atenderSenal)
	mux.HandleFunc("/archivos", s.subirArchivo)
	mux.HandleFunc("/archivos/", s.descargarArchivo)
	mux.HandleFunc("/salud", func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte("ok"))
	})
	mux.Handle("/", web)
	return mux
}
