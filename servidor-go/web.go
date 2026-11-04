package main

// Web de la reunión incrustada en el ejecutable (exportación estática de Next.js en web/).
// Cualquier ruta sin archivo (p. ej. /abc-defg-hij) devuelve index.html y la web decide.

import (
	"embed"
	"io/fs"
	"mime"
	"net/http"
	"os/exec"
	"path"
	"strings"
)

//go:embed all:web
var archivosWeb embed.FS

var execCommand = exec.Command

func manejadorWeb() http.Handler {
	raiz, _ := fs.Sub(archivosWeb, "web")
	archivos := http.FileServer(http.FS(raiz))
	if _, err := fs.Stat(raiz, "index.html"); err != nil {
		return http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
			w.Header().Set("Content-Type", "text/html; charset=utf-8")
			_, _ = w.Write([]byte("<p>Este servidor se compiló sin la web. Usa <code>npm run exe</code> para incluirla.</p>"))
		})
	}
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("Referrer-Policy", "no-referrer")
		// Nadie puede incrustar la reunión en otra página ni usar más permisos de los necesarios.
		w.Header().Set("X-Frame-Options", "DENY")
		w.Header().Set("Content-Security-Policy", "frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self'")
		w.Header().Set("Permissions-Policy", "camera=(self), microphone=(self), display-capture=(self), geolocation=(), payment=(), usb=()")
		w.Header().Set("Cross-Origin-Opener-Policy", "same-origin")
		ruta := strings.TrimPrefix(path.Clean(r.URL.Path), "/")
		if ruta != "" {
			if _, err := fs.Stat(raiz, ruta); err != nil {
				if _, err := fs.Stat(raiz, ruta+".html"); err == nil {
					r.URL.Path = "/" + ruta + ".html"
				} else {
					r.URL.Path = "/"
				}
			}
		}
		if strings.HasPrefix(ruta, "_next/static/") {
			w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
		} else {
			w.Header().Set("Cache-Control", "no-cache")
		}
		archivos.ServeHTTP(w, r)
	})
}

func init() {
	// Tipos que la tabla de Go no trae y que la web usa (manifiesto e iconos, fuente de la marca)
	_ = mime.AddExtensionType(".webmanifest", "application/manifest+json")
	_ = mime.AddExtensionType(".woff2", "font/woff2")
}
