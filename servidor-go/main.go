package main

// Ágora · servidor. Un único ejecutable que cualquiera puede abrir para alojar reuniones:
// web incluida, señalización y SFU (reenvía el audio y el vídeo de cada persona a las demás).

import (
	"crypto/tls"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"runtime"
	"syscall"
	"time"
)

const (
	verde    = "\033[32m"
	rojo     = "\033[31m"
	amarillo = "\033[33m"
	azul     = "\033[36m"
	negrita  = "\033[1m"
	normal   = "\033[0m"
)

func linea(nivel int, titulo, detalle string) {
	simbolo := map[int]string{0: verde + "✔", 1: amarillo + "!", 2: rojo + "✖"}[nivel]
	fmt.Printf("  %s%s %s%s: %s\n", simbolo, normal, negrita, titulo+normal, detalle)
}

func fallar(formato string, args ...any) {
	fmt.Printf("\n  %s✖ %s%s\n", rojo, fmt.Sprintf(formato, args...), normal)
	if runtime.GOOS == "windows" {
		fmt.Print("\n  Pulsa Enter para cerrar…")
		_, _ = fmt.Scanln()
	}
	os.Exit(1)
}

func main() {
	prepararConsola()
	config := leerConfig()
	if config.soloFirewall {
		if err := crearReglaFirewall(); err != nil {
			os.Exit(1)
		}
		return
	}
	log.SetFlags(log.Ltime)
	fmt.Printf("\n  %s%sÁgora%s · servidor de reuniones\n\n", negrita, azul, normal)

	if runtime.GOOS == "windows" && !config.sinFirewall {
		fmt.Println("  … Comprobando el Firewall de Windows (puede pedir permiso de administrador)")
		estado, ok := asegurarFirewall()
		linea(map[bool]int{true: 0, false: 1}[ok], "Firewall de Windows", estado)
	}

	iceInicial, _ := obtenerIceInicial(config.turnID, config.turnToken)
	turnActivo = len(iceInicial) > 1
	red := diagnosticarRed(config, turnActivo)
	api, cerrarMedios, err := crearAPI(config.puertoMedios, red.ipsAnunciar, false)
	if err != nil {
		fallar("%v. ¿Hay otro servidor abierto? Prueba con --puerto-medios.", err)
	}
	defer cerrarMedios()
	servidor := nuevoServidor(config, api)
	servidor.fijarIce(iceInicial)
	if turnActivo {
		go renovarTurn(servidor, config.turnID, config.turnToken)
		linea(0, "TURN de Cloudflare", "activo: se puede entrar desde cualquier red, aunque el router no abra puertos")
	} else if red.accesible {
		linea(1, "TURN", "sin configurar (opcional: los puertos están abiertos)")
	} else {
		linea(1, "TURN", "sin configurar: desde fuera de tu red local el vídeo probablemente no conecte. Añade MEET_TURN_CLOUDFLARE_ID y MEET_TURN_CLOUDFLARE_TOKEN en agora.env junto al .exe")
	}

	manejador := servidor.rutas(manejadorWeb())
	escuchar(&http.Server{Addr: fmt.Sprintf(":%d", config.puertoWeb), Handler: manejador, ReadHeaderTimeout: 10 * time.Second}, nil)
	locales := ipsLocales()
	if config.puertoHTTPS > 0 {
		if cert, err := certificadoLocal(config.carpetaDatos, locales); err == nil {
			escuchar(&http.Server{Addr: fmt.Sprintf(":%d", config.puertoHTTPS), Handler: manejador, ReadHeaderTimeout: 10 * time.Second,
				TLSConfig: &tls.Config{Certificates: []tls.Certificate{cert}, MinVersion: tls.VersionTLS12}}, &cert)
		}
	}

	publica := config.urlPublica
	detenerTunel := func() {}
	if publica == "" && !config.sinTunel {
		fmt.Println("  … Abriendo el enlace público (túnel de Cloudflare)")
		url, detener, err := abrirTunel(config.carpetaDatos, config.puertoWeb)
		if err != nil {
			linea(1, "Enlace público", fmt.Sprintf("no disponible (%v)", err))
		} else {
			publica, detenerTunel = url, detener
		}
	}
	defer detenerTunel()
	permitirHost(publica)
	if red.mapeo != nil {
		defer red.mapeo.quitar()
	}

	mostrarEnlaces(config, publica, locales)
	if !config.sinNavegador {
		abrirNavegador(fmt.Sprintf("http://localhost:%d", config.puertoWeb))
	}

	senales := make(chan os.Signal, 1)
	signal.Notify(senales, os.Interrupt, syscall.SIGTERM)
	<-senales
	fmt.Println("\n  Cerrando: se liberan los puertos del router y el túnel…")
}

func escuchar(srv *http.Server, cert *tls.Certificate) {
	go func() {
		var err error
		if cert != nil {
			err = srv.ListenAndServeTLS("", "")
		} else {
			err = srv.ListenAndServe()
		}
		if err != nil && err != http.ErrServerClosed {
			fallar("No se pudo abrir el puerto %s: %v", srv.Addr, err)
		}
	}()
}

func mostrarEnlaces(config Config, publica string, locales []string) {
	fmt.Printf("\n  %s──────────────────────────────────────────────────────────%s\n", azul, normal)
	if publica != "" {
		fmt.Printf("  %sComparte este enlace para entrar desde cualquier sitio:%s\n    %s%s%s\n\n", negrita, normal, verde+negrita, publica, normal)
	}
	if config.puertoHTTPS > 0 && len(locales) > 0 {
		fmt.Printf("  %sEn tu red local (wifi de casa u oficina):%s\n", negrita, normal)
		for _, ip := range locales {
			fmt.Printf("    https://%s:%d\n", ip, config.puertoHTTPS)
		}
		fmt.Println("    El navegador avisará del certificado: «Configuración avanzada» > «Continuar».")
		fmt.Println()
	}
	fmt.Printf("  %sEn este equipo:%s http://localhost:%d\n", negrita, normal, config.puertoWeb)
	fmt.Printf("  %s──────────────────────────────────────────────────────────%s\n", azul, normal)
	fmt.Println("  Deja esta ventana abierta mientras dure la reunión. Ctrl+C para cerrar.")
	fmt.Println()
}
