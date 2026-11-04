package main

import (
	"encoding/json"
	"fmt"
	"log"
	"sync"
	"sync/atomic"
	"time"

	"github.com/gorilla/websocket"
	"github.com/pion/rtcp"
	"github.com/pion/webrtc/v4"
)

// Participante: su WebSocket, su conexión WebRTC con el servidor, lo que publica y sus ranuras.
//
// Negociación: el navegador ofrece una vez al entrar (tres transceptores de envío: audio, cámara y
// pantalla). Después solo ofrece el servidor, y solo cuando necesita ranuras nuevas; así nunca hay
// ofertas cruzadas.
var ordenPublicacion = []string{"audio", "camara", "pantalla"}

type Participante struct {
	id    string
	clave string // secreto para subir archivos y retomar el sitio; solo lo conoce su navegador
	// ausente: su conexión se cortó sin colgar y se le guarda el sitio (protegido por sala.mu)
	ausente      bool
	dispositivo  string
	ausenteDesde int64        // ms; cuándo se cortó (para reponerle lo que se perdió)
	ultimaSenal  atomic.Int64 // ms; último mensaje o pong recibido
	sala         *Sala
	datos        DatosParticipante // protegido por sala.mu

	conn  *websocket.Conn
	escMu sync.Mutex

	pc         *webrtc.PeerConnection
	publicadas map[string]*Publicada // protegido por sala.mu
	deseados   []string              // vídeos que quiere ver; protegido por sala.mu
	suscrito   bool                  // ya envió SUSCRIBIR; protegido por sala.mu

	negMu      sync.Mutex
	listo      bool
	esperando  bool
	pendiente  bool
	cerrado    bool
	ranuras    []*Ranura
	mapaPrevio string
}

func (p *Participante) enviar(mensaje M) {
	datos, err := json.Marshal(mensaje)
	if err != nil {
		return
	}
	p.escMu.Lock()
	defer p.escMu.Unlock()
	_ = p.conn.SetWriteDeadline(time.Now().Add(5 * time.Second))
	if err := p.conn.WriteMessage(websocket.TextMessage, datos); err != nil {
		_ = p.conn.Close()
	}
}

// crearConexion prepara la RTCPeerConnection antes de recibir la oferta del navegador.
func (p *Participante) crearConexion(api *webrtc.API, ice []webrtc.ICEServer) error {
	pc, err := api.NewPeerConnection(webrtc.Configuration{ICEServers: ice, BundlePolicy: webrtc.BundlePolicyMaxBundle})
	if err != nil {
		return err
	}
	p.pc = pc
	pc.OnICECandidate(func(c *webrtc.ICECandidate) {
		if c == nil {
			return
		}
		init := c.ToJSON()
		p.enviar(M{"tipo": "SENAL", "carga": CargaSenal{Candidate: &init.Candidate, SDPMid: init.SDPMid, SDPMLineIndex: init.SDPMLineIndex}})
	})
	pc.OnTrack(func(remota *webrtc.TrackRemote, receptor *webrtc.RTPReceiver) {
		indice := -1
		for i, t := range pc.GetTransceivers() {
			if t.Receiver() == receptor {
				indice = i
			}
		}
		if indice < 0 || indice >= len(ordenPublicacion) {
			return
		}
		p.sala.publicar(p, nuevaPublicada(p, ordenPublicacion[indice], remota))
	})
	conecto := false
	pc.OnConnectionStateChange(func(estado webrtc.PeerConnectionState) {
		switch estado {
		case webrtc.PeerConnectionStateConnected:
			if !conecto {
				log.Printf("[Medios] %s conectado.", p.id[:6])
			}
			conecto = true
		case webrtc.PeerConnectionStateFailed:
			if conecto {
				// Corte de red tras haber funcionado: se cierra para que el navegador vuelva a entrar
				log.Printf("[Medios] Se cortó la conexión con %s; volverá a entrar.", p.id[:6])
				_ = p.conn.Close()
				return
			}
			log.Printf("[Medios] %s no pudo conectar el audio ni el vídeo: su red no llega al puerto de medios. %s", p.id[:6], pistaSinConexion())
		}
	})
	return nil
}

// recibirSenal aplica una oferta, respuesta o candidato del navegador.
func (p *Participante) recibirSenal(carga *CargaSenal) {
	if carga.Candidate != nil {
		_ = p.pc.AddICECandidate(webrtc.ICECandidateInit{Candidate: *carga.Candidate, SDPMid: carga.SDPMid, SDPMLineIndex: carga.SDPMLineIndex, UsernameFragment: carga.UsernameFragment})
		return
	}
	p.negMu.Lock()
	reintentar := false
	defer func() {
		p.negMu.Unlock()
		if reintentar {
			p.actualizar()
		}
	}()
	switch carga.Tipo {
	case "offer":
		if p.listo || p.pc.SignalingState() != webrtc.SignalingStateStable {
			return // solo se admite la oferta inicial
		}
		if err := p.pc.SetRemoteDescription(webrtc.SessionDescription{Type: webrtc.SDPTypeOffer, SDP: carga.SDP}); err != nil {
			log.Printf("[Medios] Oferta no válida de %s: %v", p.id[:6], err)
			return
		}
		respuesta, err := p.pc.CreateAnswer(nil)
		if err == nil {
			err = p.pc.SetLocalDescription(respuesta)
		}
		if err != nil {
			log.Printf("[Medios] No se pudo responder a %s: %v", p.id[:6], err)
			return
		}
		p.enviar(M{"tipo": "SENAL", "carga": CargaSenal{Tipo: "answer", SDP: p.pc.LocalDescription().SDP}})
		p.listo = true
		reintentar = true
	case "answer":
		if !p.esperando {
			return
		}
		if err := p.pc.SetRemoteDescription(webrtc.SessionDescription{Type: webrtc.SDPTypeAnswer, SDP: carga.SDP}); err != nil {
			log.Printf("[Medios] Respuesta no válida de %s: %v", p.id[:6], err)
		}
		p.esperando = false
		p.enviarMapa()
		reintentar = p.pendiente
	}
}

// actualizar reparte las fuentes en las ranuras y, si faltan ranuras, renegocia.
func (p *Participante) actualizar() {
	p.negMu.Lock()
	defer p.negMu.Unlock()
	if p.cerrado || !p.listo {
		p.pendiente = true
		return
	}
	p.pendiente = false
	sobrantes := p.sala.repartir(p, p.ranuras)
	if len(sobrantes) == 0 {
		p.enviarMapa()
		return
	}
	if p.esperando || p.pc.SignalingState() != webrtc.SignalingStateStable {
		p.pendiente = true
		p.enviarMapa()
		return
	}
	for _, fuente := range sobrantes {
		r, err := nuevaRanura(fuente.tipo, len(p.ranuras))
		if err != nil {
			continue
		}
		t, err := p.pc.AddTransceiverFromTrack(r.local, webrtc.RTPTransceiverInit{Direction: webrtc.RTPTransceiverDirectionSendonly})
		if err != nil {
			log.Printf("[Medios] No se pudo crear una ranura: %v", err)
			continue
		}
		r.sender = t.Sender()
		r.fijarFuente(fuente)
		go leerRTCP(r)
		p.ranuras = append(p.ranuras, r)
	}
	oferta, err := p.pc.CreateOffer(nil)
	if err == nil {
		err = p.pc.SetLocalDescription(oferta)
	}
	if err != nil {
		log.Printf("[Medios] No se pudo ofrecer a %s: %v", p.id[:6], err)
		return
	}
	for _, t := range p.pc.GetTransceivers() {
		for _, r := range p.ranuras {
			if t.Sender() == r.sender {
				r.mid = t.Mid()
			}
		}
	}
	p.enviarMapa()
	p.enviar(M{"tipo": "SENAL", "carga": CargaSenal{Tipo: "offer", SDP: p.pc.LocalDescription().SDP}})
	p.esperando = true
}

// enviarMapa cuenta al navegador qué persona y qué tipo lleva cada transceptor (por mid).
func (p *Participante) enviarMapa() {
	mapa := map[string]Pista{}
	for _, r := range p.ranuras {
		if fuente := r.fuenteActual(); fuente != nil && r.mid != "" {
			mapa[r.mid] = Pista{ID: fuente.autor.id, Tipo: r.tipo}
		}
	}
	firma := fmt.Sprint(mapa)
	if firma == p.mapaPrevio {
		return
	}
	p.mapaPrevio = firma
	p.enviar(M{"tipo": "PISTAS", "mapa": mapa})
}

// leerRTCP atiende las peticiones de fotograma clave del navegador que recibe la ranura.
func leerRTCP(r *Ranura) {
	for {
		paquetes, _, err := r.sender.ReadRTCP()
		if err != nil {
			return
		}
		for _, paquete := range paquetes {
			switch paquete.(type) {
			case *rtcp.PictureLossIndication, *rtcp.FullIntraRequest:
				if fuente := r.fuenteActual(); fuente != nil {
					fuente.pedirClave()
				}
			}
		}
	}
}

func (p *Participante) cerrar() {
	p.negMu.Lock()
	p.cerrado = true
	ranuras := p.ranuras
	p.negMu.Unlock()
	for _, r := range ranuras {
		r.fijarFuente(nil)
	}
	if p.pc != nil {
		_ = p.pc.Close()
	}
}
