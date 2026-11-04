package main

// Protocolo JSON entre la web y el servidor (espejo de src/red/protocolo.ts).

import "encoding/json"

type EstadoParticipante struct {
	Microfono bool   `json:"microfono"`
	Camara    bool   `json:"camara"`
	Pantalla  bool   `json:"pantalla"`
	Mano      *int64 `json:"mano"`
}

type DatosParticipante struct {
	ID        string             `json:"id"`
	Nombre    string             `json:"nombre"`
	Estado    EstadoParticipante `json:"estado"`
	EntradaEn int64              `json:"entradaEn"`
}

type MensajeChat struct {
	ID          string `json:"id"`
	AutorID     string `json:"autorId"`
	AutorNombre string `json:"autorNombre"`
	Texto       string `json:"texto"`
	EnviadoEn   int64  `json:"enviadoEn"`
}

// CargaSenal es una descripción SDP ({tipo, sdp}) o un candidato ICE.
type CargaSenal struct {
	Tipo             string  `json:"tipo,omitempty"`
	SDP              string  `json:"sdp,omitempty"`
	Candidate        *string `json:"candidate,omitempty"`
	SDPMid           *string `json:"sdpMid,omitempty"`
	SDPMLineIndex    *uint16 `json:"sdpMLineIndex,omitempty"`
	UsernameFragment *string `json:"usernameFragment,omitempty"`
}

type ServidorIce struct {
	URLs       []string `json:"urls"`
	Username   string   `json:"username,omitempty"`
	Credential string   `json:"credential,omitempty"`
}

// Pista describe qué lleva cada transceptor que el servidor envía a un participante.
type Pista struct {
	ID   string `json:"id"`
	Tipo string `json:"tipo"`
}

// MensajeEntrante agrupa todos los campos posibles de un mensaje del cliente.
type MensajeEntrante struct {
	Tipo    string          `json:"tipo"`
	Sala    string          `json:"sala"`
	Nombre  string          `json:"nombre"`
	Estado  *struct {
		Microfono bool `json:"microfono"`
		Camara    bool `json:"camara"`
	} `json:"estado"`
	Carga   *CargaSenal     `json:"carga"`
	Cambios json.RawMessage `json:"cambios"`
	Texto   string          `json:"texto"`
	Emoji   string          `json:"emoji"`
	Videos  []string        `json:"videos"`
}

type CambiosEstado struct {
	Microfono *bool `json:"microfono"`
	Camara    *bool `json:"camara"`
	Pantalla  *bool `json:"pantalla"`
	Mano      *bool `json:"mano"`
}

// Mensaje saliente genérico: tipo + campos.
type M map[string]any
