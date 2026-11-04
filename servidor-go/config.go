package main

import (
	"bufio"
	"flag"
	"os"
	"path/filepath"
	"strconv"
	"strings"
)

// Config: opciones de línea de órdenes, con valores por defecto pensados para hacer doble clic en
// el .exe. Las claves secretas (TURN de Cloudflare) se leen de kubox-meet.env junto al ejecutable.
type Config struct {
	puertoWeb        int
	puertoHTTPS      int
	puertoMedios     int
	maximoPorSala    int
	maximoVideos     int
	maximoSalas      int
	maximoConexiones int
	maximoArchivoMB  int
	urlPublica       string
	sinTunel         bool
	sinUPnP          bool
	sinFirewall      bool
	sinNavegador     bool
	soloFirewall     bool
	turnID           string
	turnToken        string
	carpetaDatos     string
}

func leerConfig() Config {
	cargarArchivoEntorno()
	c := Config{}
	flag.IntVar(&c.puertoWeb, "puerto-web", entero("MEET_PUERTO_WEB", 8090), "puerto HTTP de la web y la señalización")
	flag.IntVar(&c.puertoHTTPS, "puerto-https", entero("MEET_PUERTO_HTTPS", 8443), "puerto HTTPS (certificado propio) para la red local; 0 lo desactiva")
	flag.IntVar(&c.puertoMedios, "puerto-medios", entero("MEET_PUERTO_MEDIOS", 8091), "puerto de audio y vídeo (UDP y TCP)")
	flag.IntVar(&c.maximoPorSala, "maximo-por-sala", entero("MEET_MAXIMO_POR_SALA", 100), "personas por reunión")
	flag.IntVar(&c.maximoVideos, "maximo-videos", entero("MEET_MAXIMO_VIDEOS", 9), "vídeos de cámara que recibe cada persona a la vez")
	flag.IntVar(&c.maximoSalas, "maximo-salas", entero("MEET_MAXIMO_SALAS", 50), "reuniones simultáneas")
	flag.IntVar(&c.maximoConexiones, "maximo-conexiones", entero("MEET_MAXIMO_CONEXIONES", 500), "conexiones simultáneas")
	flag.IntVar(&c.maximoArchivoMB, "maximo-archivo-mb", entero("MEET_MAXIMO_ARCHIVO_MB", 95), "tamaño máximo de cada archivo del chat (el túnel de Cloudflare admite hasta 100 MB)")
	flag.StringVar(&c.urlPublica, "url-publica", os.Getenv("MEET_URL_PUBLICA"), "URL pública propia (p. ej. https://meet.midominio.com); evita el túnel rápido")
	flag.BoolVar(&c.sinTunel, "sin-tunel", os.Getenv("MEET_SIN_TUNEL") == "true", "no abrir el túnel de Cloudflare")
	flag.BoolVar(&c.sinUPnP, "sin-upnp", os.Getenv("MEET_SIN_UPNP") == "true", "no intentar abrir puertos en el router")
	flag.BoolVar(&c.sinFirewall, "sin-firewall", false, "no tocar el Firewall de Windows")
	flag.BoolVar(&c.sinNavegador, "sin-navegador", os.Getenv("MEET_SIN_NAVEGADOR") == "true", "no abrir el navegador al arrancar")
	flag.BoolVar(&c.soloFirewall, "solo-firewall", false, "uso interno: crea la regla del firewall y termina")
	flag.Parse()
	c.turnID = os.Getenv("MEET_TURN_CLOUDFLARE_ID")
	c.turnToken = os.Getenv("MEET_TURN_CLOUDFLARE_TOKEN")
	c.carpetaDatos = carpetaDatos()
	return c
}

func entero(nombre string, porDefecto int) int {
	if v, err := strconv.Atoi(os.Getenv(nombre)); err == nil && v > 0 {
		return v
	}
	return porDefecto
}

func carpetaEjecutable() string {
	if exe, err := os.Executable(); err == nil {
		return filepath.Dir(exe)
	}
	return "."
}

// carpetaDatos guarda lo descargado (cloudflared) y el certificado local.
func carpetaDatos() string {
	base, err := os.UserCacheDir()
	if err != nil {
		base = carpetaEjecutable()
	}
	dir := filepath.Join(base, "KuboxMeet")
	_ = os.MkdirAll(dir, 0o755)
	return dir
}

// cargarArchivoEntorno lee CLAVE=valor de kubox-meet.env (junto al .exe o en la carpeta actual)
// sin pisar variables ya definidas.
func cargarArchivoEntorno() {
	for _, ruta := range []string{filepath.Join(carpetaEjecutable(), "kubox-meet.env"), "kubox-meet.env", ".env.local"} {
		archivo, err := os.Open(ruta)
		if err != nil {
			continue
		}
		lector := bufio.NewScanner(archivo)
		for lector.Scan() {
			linea := strings.TrimSpace(lector.Text())
			clave, valor, ok := strings.Cut(linea, "=")
			if !ok || strings.HasPrefix(linea, "#") {
				continue
			}
			clave = strings.TrimSpace(clave)
			if _, existe := os.LookupEnv(clave); !existe {
				_ = os.Setenv(clave, strings.Trim(strings.TrimSpace(valor), `"'`))
			}
		}
		archivo.Close()
		return
	}
}
