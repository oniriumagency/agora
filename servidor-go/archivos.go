package main

// Archivos del chat. Se suben al servidor de la reunión (HTTP) y se reparten como un mensaje de
// chat con enlace de descarga. Viven en disco mientras exista la sala y se borran cuando sale el
// último participante. Solo puede subir quien está en la reunión (clave secreta de su conexión).

import (
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

var fechaCero = time.Time{}

const maximoBytesPorSala = 2 << 30 // 2 GB

type ArchivoChat struct {
	ID          string `json:"id"`
	Nombre      string `json:"nombre"`
	Tamano      int64  `json:"tamano"`
	Tipo        string `json:"tipo"`
	VistaPrevia bool   `json:"vistaPrevia"`
}

type archivoGuardado struct {
	ArchivoChat
	ruta string
	sala *Sala
}

type almacenArchivos struct {
	carpeta string
	mu      sync.Mutex
	porID   map[string]*archivoGuardado
	usado   map[*Sala]int64
}

func nuevoAlmacen(carpetaDatos string) *almacenArchivos {
	if carpetaDatos == "" {
		carpetaDatos = os.TempDir()
	}
	base := filepath.Join(carpetaDatos, "archivos")
	_ = os.MkdirAll(base, 0o700)
	// Cada ejecución usa su propia carpeta; se limpian las de ejecuciones viejas que no se cerraron bien.
	if entradas, err := os.ReadDir(base); err == nil {
		for _, e := range entradas {
			if info, err := e.Info(); err == nil && time.Since(info.ModTime()) > 24*time.Hour {
				_ = os.RemoveAll(filepath.Join(base, e.Name()))
			}
		}
	}
	carpeta, err := os.MkdirTemp(base, "sesion-")
	if err != nil {
		carpeta = base
	}
	return &almacenArchivos{carpeta: carpeta, porID: map[string]*archivoGuardado{}, usado: map[*Sala]int64{}}
}

// olvidarSala borra del disco los archivos de una sala que se cerró.
func (a *almacenArchivos) olvidarSala(sala *Sala) {
	a.mu.Lock()
	defer a.mu.Unlock()
	for id, archivo := range a.porID {
		if archivo.sala == sala {
			_ = os.Remove(archivo.ruta)
			delete(a.porID, id)
		}
	}
	delete(a.usado, sala)
}

func permitirOrigenes(w http.ResponseWriter) {
	// Las subidas se autentican con una cabecera propia, no con cookies: se puede abrir CORS
	// (necesario en desarrollo, donde la web corre en otro puerto).
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Headers", "X-Clave, Content-Type")
	w.Header().Set("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
}

func (s *Servidor) subirArchivo(w http.ResponseWriter, r *http.Request) {
	permitirOrigenes(w)
	if r.Method == http.MethodOptions {
		return
	}
	if r.Method != http.MethodPost {
		http.Error(w, "Método no permitido", http.StatusMethodNotAllowed)
		return
	}
	p := s.participantePorClave(r.Header.Get("X-Clave"))
	if p == nil || p.sala == nil {
		http.Error(w, "Solo quien está en la reunión puede enviar archivos.", http.StatusForbidden)
		return
	}
	// El nombre y el contenido llegan cifrados: el servidor guarda bytes que no puede leer.
	nombre := r.URL.Query().Get("nombre")
	if !cifradoValido(nombre, 1200) {
		http.Error(w, "Nombre de archivo no válido.", http.StatusBadRequest)
		return
	}
	limite := int64(s.config.maximoArchivoMB) << 20
	if r.ContentLength > limite {
		http.Error(w, fmt.Sprintf("El archivo supera el máximo de %d MB.", s.config.maximoArchivoMB), http.StatusRequestEntityTooLarge)
		return
	}
	archivo, err := s.archivos.guardar(p.sala, nombre, http.MaxBytesReader(w, r.Body, limite))
	if err != nil {
		var demasiado *http.MaxBytesError
		if errors.As(err, &demasiado) {
			http.Error(w, fmt.Sprintf("El archivo supera el máximo de %d MB.", s.config.maximoArchivoMB), http.StatusRequestEntityTooLarge)
		} else {
			http.Error(w, err.Error(), http.StatusInsufficientStorage)
		}
		return
	}
	log.Printf("[Sala %s] %s compartió un archivo cifrado (%s)", p.sala.codigo, p.id[:6], formatearBytes(archivo.Tamano))
	mensaje := p.sala.agregarChat(p, "", &archivo.ArchivoChat)
	p.sala.difundir(M{"tipo": "CHAT", "mensaje": mensaje}, "")
	w.WriteHeader(http.StatusCreated)
}

func (a *almacenArchivos) guardar(sala *Sala, nombre string, cuerpo io.Reader) (*archivoGuardado, error) {
	id := nuevoID() + nuevoID()
	ruta := filepath.Join(a.carpeta, id)
	destino, err := os.OpenFile(ruta, os.O_CREATE|os.O_WRONLY|os.O_EXCL, 0o600)
	if err != nil {
		return nil, errors.New("no se pudo guardar el archivo")
	}
	tamano, err := io.Copy(destino, cuerpo)
	destino.Close()
	if err != nil {
		_ = os.Remove(ruta)
		return nil, err
	}
	a.mu.Lock()
	defer a.mu.Unlock()
	if a.usado[sala]+tamano > maximoBytesPorSala {
		_ = os.Remove(ruta)
		return nil, errors.New("la reunión ya compartió demasiados archivos (2 GB)")
	}
	a.usado[sala] += tamano
	guardado := &archivoGuardado{ArchivoChat: ArchivoChat{ID: id, Nombre: nombre, Tamano: tamano, Tipo: "application/octet-stream"}, ruta: ruta, sala: sala}
	a.porID[id] = guardado
	return guardado, nil
}

// descargarArchivo sirve /archivos/<id>: bytes cifrados que el navegador descifra; siempre como descarga.
func (s *Servidor) descargarArchivo(w http.ResponseWriter, r *http.Request) {
	permitirOrigenes(w)
	id := strings.TrimPrefix(r.URL.Path, "/archivos/")
	s.archivos.mu.Lock()
	archivo := s.archivos.porID[id]
	s.archivos.mu.Unlock()
	if archivo == nil {
		http.Error(w, "El archivo ya no está disponible (la reunión terminó).", http.StatusNotFound)
		return
	}
	contenido, err := os.Open(archivo.ruta)
	if err != nil {
		http.NotFound(w, r)
		return
	}
	defer contenido.Close()
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.Header().Set("Content-Security-Policy", "sandbox; default-src 'none'")
	w.Header().Set("Cache-Control", "private, max-age=3600")
	w.Header().Set("Content-Type", "application/octet-stream")
	w.Header().Set("Content-Disposition", "attachment")
	http.ServeContent(w, r, "", fechaCero, contenido)
}

func formatearBytes(n int64) string {
	switch {
	case n >= 1<<30:
		return fmt.Sprintf("%.1f GB", float64(n)/(1<<30))
	case n >= 1<<20:
		return fmt.Sprintf("%.1f MB", float64(n)/(1<<20))
	case n >= 1<<10:
		return fmt.Sprintf("%.0f KB", float64(n)/(1<<10))
	}
	return fmt.Sprintf("%d B", n)
}
