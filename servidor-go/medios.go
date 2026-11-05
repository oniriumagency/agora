package main

// Motor WebRTC del servidor: códecs (VP8 y Opus, que todos los navegadores admiten), interceptores
// (NACK, informes RTCP, transport-cc y control de congestión) y un único puerto de medios para UDP
// y TCP compartido por todas las conexiones.
//
// transport-cc funciona en los dos sentidos: el servidor informa a cada navegador de cómo le llegan
// sus paquetes (así el navegador ajusta su audio y su vídeo a su subida real) y, a la vez, estima con
// GCC el ancho de banda hacia cada navegador para elegir qué calidad de cada cámara le envía.

import (
	"fmt"
	"net"
	"sync"

	"github.com/pion/ice/v4"
	"github.com/pion/interceptor"
	"github.com/pion/interceptor/pkg/cc"
	"github.com/pion/interceptor/pkg/gcc"
	"github.com/pion/webrtc/v4"
)

var retroVideo = []webrtc.RTCPFeedback{{Type: "goog-remb"}, {Type: "ccm", Parameter: "fir"}, {Type: "nack"}, {Type: "nack", Parameter: "pli"}}

var capacidadVideo = webrtc.RTPCodecCapability{MimeType: webrtc.MimeTypeVP8, ClockRate: 90000, RTCPFeedback: retroVideo}
// Opus con corrección de errores en banda (más cuanto más se pierde) y DTX: mientras alguien
// calla apenas se envían datos.
var capacidadAudio = webrtc.RTPCodecCapability{MimeType: webrtc.MimeTypeOpus, ClockRate: 48000, Channels: 2, SDPFmtpLine: "minptime=10;useinbandfec=1;usedtx=1"}

// Estimador de ancho de banda de la última RTCPeerConnection creada (ver nuevaConexion).
var (
	estimadorMu     sync.Mutex
	ultimoEstimador cc.BandwidthEstimator
)

// crearAPI abre el puerto de medios (UDP y TCP) y devuelve la API de Pion. ipsPublicas se anuncian
// como candidatos srflx (útil cuando el router redirige el puerto). soloLocal escucha solo en
// 127.0.0.1: lo usan las pruebas para que el Firewall de Windows no pregunte en cada ejecución.
func crearAPI(puertoMedios int, ipsPublicas []string, soloLocal bool) (*webrtc.API, func(), error) {
	m := &webrtc.MediaEngine{}
	if err := m.RegisterCodec(webrtc.RTPCodecParameters{RTPCodecCapability: capacidadVideo, PayloadType: 96}, webrtc.RTPCodecTypeVideo); err != nil {
		return nil, nil, err
	}
	if err := m.RegisterCodec(webrtc.RTPCodecParameters{RTPCodecCapability: capacidadAudio, PayloadType: 111}, webrtc.RTPCodecTypeAudio); err != nil {
		return nil, nil, err
	}
	registro := &interceptor.Registry{}
	if err := webrtc.RegisterDefaultInterceptors(m, registro); err != nil {
		return nil, nil, err
	}
	control, err := cc.NewInterceptor(func() (cc.BandwidthEstimator, error) {
		// Sin ritmo propio (NoOpPacer): el servidor solo reenvía, no debe retener paquetes
		return gcc.NewSendSideBWE(gcc.SendSideBWEInitialBitrate(1_000_000), gcc.SendSideBWEMinBitrate(100_000),
			gcc.SendSideBWEMaxBitrate(20_000_000), gcc.SendSideBWEPacer(gcc.NewNoOpPacer()))
	})
	if err != nil {
		return nil, nil, err
	}
	control.OnNewPeerConnection(func(_ string, estimador cc.BandwidthEstimator) { ultimoEstimador = estimador })
	registro.Add(control)
	// Después del control de congestión: así cada paquete ya lleva su número transport-cc cuando GCC lo anota
	if err := webrtc.ConfigureTWCCHeaderExtensionSender(m, registro); err != nil {
		return nil, nil, err
	}

	opcionesUDP := []ice.UDPMuxFromPortOption{ice.UDPMuxFromPortWithNetworks(ice.NetworkTypeUDP4), ice.UDPMuxFromPortWithLoopback()}
	ipEscucha := net.IPv4zero
	if soloLocal {
		opcionesUDP = append(opcionesUDP, ice.UDPMuxFromPortWithIPFilter(func(ip net.IP) bool { return ip.IsLoopback() }))
		ipEscucha = net.IPv4(127, 0, 0, 1)
	}
	udp, err := ice.NewMultiUDPMuxFromPort(puertoMedios, opcionesUDP...)
	if err != nil {
		return nil, nil, fmt.Errorf("no se pudo abrir el puerto %d/UDP: %w", puertoMedios, err)
	}
	escucha, err := net.ListenTCP("tcp4", &net.TCPAddr{IP: ipEscucha, Port: puertoMedios})
	if err != nil {
		_ = udp.Close()
		return nil, nil, fmt.Errorf("no se pudo abrir el puerto %d/TCP: %w", puertoMedios, err)
	}
	tcp := webrtc.NewICETCPMux(nil, escucha, 64)

	ajustes := webrtc.SettingEngine{}
	ajustes.SetICEUDPMux(udp)
	ajustes.SetICETCPMux(tcp)
	ajustes.SetNetworkTypes([]webrtc.NetworkType{webrtc.NetworkTypeUDP4, webrtc.NetworkTypeTCP4})
	ajustes.SetICEMulticastDNSMode(ice.MulticastDNSModeDisabled)
	ajustes.SetIncludeLoopbackCandidate(true)
	if len(ipsPublicas) > 0 {
		ajustes.SetNAT1To1IPs(ipsPublicas, webrtc.ICECandidateTypeSrflx) //nolint:staticcheck // equivalente moderno más verboso
	}
	api := webrtc.NewAPI(webrtc.WithMediaEngine(m), webrtc.WithInterceptorRegistry(registro), webrtc.WithSettingEngine(ajustes))
	cerrar := func() {
		_ = udp.Close()
		_ = tcp.Close()
	}
	return api, cerrar, nil
}

// nuevaConexion crea la RTCPeerConnection y devuelve también su estimador de ancho de banda (el
// interceptor lo entrega durante NewPeerConnection, por eso se crean de una en una).
func nuevaConexion(api *webrtc.API, configuracion webrtc.Configuration) (*webrtc.PeerConnection, cc.BandwidthEstimator, error) {
	estimadorMu.Lock()
	defer estimadorMu.Unlock()
	ultimoEstimador = nil
	pc, err := api.NewPeerConnection(configuracion)
	return pc, ultimoEstimador, err
}
