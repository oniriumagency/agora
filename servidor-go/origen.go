package main

// Origen de la señalización: solo se aceptan WebSockets abiertos desde la propia web de Ágora
// (mismo host, o el que publica el túnel o el proxy) y, para desarrollo, desde localhost. Así otra
// página no puede usar el navegador de alguien para conectarse a su servidor.

import (
	"net"
	"net/http"
	"net/url"
	"os"
	"strings"
	"sync"
)

var (
	origenesExtra     map[string]bool
	origenesExtraUnaV sync.Once
	origenesMu        sync.RWMutex
)

// MEET_ORIGENES_PERMITIDOS: lista separada por comas de hosts adicionales (p. ej. meet.ejemplo.com).
func extras() map[string]bool {
	origenesExtraUnaV.Do(func() {
		origenesExtra = map[string]bool{}
		for _, h := range strings.Split(os.Getenv("MEET_ORIGENES_PERMITIDOS")+","+hostDe(os.Getenv("MEET_URL_PUBLICA")), ",") {
			if h = strings.ToLower(strings.TrimSpace(h)); h != "" {
				origenesExtra[h] = true
			}
		}
	})
	return origenesExtra
}

func hostDe(direccion string) string {
	u, err := url.Parse(direccion)
	if err != nil {
		return ""
	}
	return strings.ToLower(u.Hostname())
}

func sinPuerto(host string) string {
	if h, _, err := net.SplitHostPort(host); err == nil {
		return strings.ToLower(h)
	}
	return strings.ToLower(strings.Trim(host, "[]"))
}

func esLocal(host string) bool {
	if host == "localhost" || strings.HasSuffix(host, ".localhost") {
		return true
	}
	ip := net.ParseIP(host)
	return ip != nil && ip.IsLoopback()
}

func origenPermitido(r *http.Request) bool {
	origen := r.Header.Get("Origin")
	if origen == "" {
		return true // no es un navegador (pruebas, herramientas): no puede usar credenciales ajenas
	}
	host := hostDe(origen)
	if host == "" {
		return false
	}
	if host == sinPuerto(r.Host) || host == sinPuerto(r.Header.Get("X-Forwarded-Host")) || esLocal(host) {
		return true
	}
	permitidos := extras()
	origenesMu.RLock()
	defer origenesMu.RUnlock()
	return permitidos[host]
}

// permitirHost añade el host del enlace público (p. ej. el del túnel rápido, que cambia en cada arranque).
func permitirHost(direccion string) {
	permitidos := extras()
	if h := hostDe(direccion); h != "" {
		origenesMu.Lock()
		permitidos[h] = true
		origenesMu.Unlock()
	}
}
