package main

// Motor WebRTC del servidor: códecs (VP8 y Opus, que todos los navegadores admiten), interceptores
// (NACK, informes RTCP) y un único puerto de medios para UDP y TCP compartido por todas las conexiones.

import (
	"fmt"
	"net"

	"github.com/pion/ice/v4"
	"github.com/pion/interceptor"
	"github.com/pion/webrtc/v4"
)

var retroVideo = []webrtc.RTCPFeedback{{Type: "goog-remb"}, {Type: "ccm", Parameter: "fir"}, {Type: "nack"}, {Type: "nack", Parameter: "pli"}}

var capacidadVideo = webrtc.RTPCodecCapability{MimeType: webrtc.MimeTypeVP8, ClockRate: 90000, RTCPFeedback: retroVideo}
var capacidadAudio = webrtc.RTPCodecCapability{MimeType: webrtc.MimeTypeOpus, ClockRate: 48000, Channels: 2, SDPFmtpLine: "minptime=10;useinbandfec=1"}

// crearAPI abre el puerto de medios (UDP y TCP) y devuelve la API de Pion. ipsPublicas se anuncian
// como candidatos srflx (útil cuando el router redirige el puerto).
func crearAPI(puertoMedios int, ipsPublicas []string) (*webrtc.API, func(), error) {
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

	udp, err := ice.NewMultiUDPMuxFromPort(puertoMedios, ice.UDPMuxFromPortWithNetworks(ice.NetworkTypeUDP4), ice.UDPMuxFromPortWithLoopback())
	if err != nil {
		return nil, nil, fmt.Errorf("no se pudo abrir el puerto %d/UDP: %w", puertoMedios, err)
	}
	escucha, err := net.ListenTCP("tcp4", &net.TCPAddr{Port: puertoMedios})
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
