package main

// Túnel rápido de Cloudflare (trycloudflare.com): da una URL HTTPS pública sin cuenta ni abrir
// puertos web, necesaria porque los navegadores solo permiten cámara y micrófono en HTTPS. Solo
// transporta la web y la señalización; el audio y el vídeo van directos al puerto de medios.

import (
	"bufio"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"runtime"
	"time"
)

var patronTunel = regexp.MustCompile(`https://[a-z0-9-]+\.trycloudflare\.com`)

func rutaCloudflared(carpeta string) (string, error) {
	if ruta, err := exec.LookPath("cloudflared"); err == nil {
		return ruta, nil
	}
	nombre := "cloudflared"
	if runtime.GOOS == "windows" {
		nombre += ".exe"
	}
	ruta := filepath.Join(carpeta, nombre)
	if _, err := os.Stat(ruta); err == nil {
		return ruta, nil
	}
	archivo := map[string]string{"windows": "cloudflared-windows-amd64.exe", "linux": "cloudflared-linux-amd64"}[runtime.GOOS]
	if runtime.GOARCH == "arm64" && runtime.GOOS == "linux" {
		archivo = "cloudflared-linux-arm64"
	}
	if archivo == "" {
		return "", errors.New("instala cloudflared para este sistema")
	}
	fmt.Println("  … Descargando cloudflared (solo la primera vez, unos 60 MB)")
	cliente := &http.Client{Timeout: 5 * time.Minute}
	resp, err := cliente.Get("https://github.com/cloudflare/cloudflared/releases/latest/download/" + archivo)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("descarga fallida (%d)", resp.StatusCode)
	}
	temporal := ruta + ".descarga"
	destino, err := os.OpenFile(temporal, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0o755)
	if err != nil {
		return "", err
	}
	_, err = io.Copy(destino, resp.Body)
	destino.Close()
	if err != nil {
		return "", err
	}
	return ruta, os.Rename(temporal, ruta)
}

// abrirTunel arranca cloudflared y devuelve la URL pública y la función que lo detiene.
func abrirTunel(carpeta string, puertoWeb int) (string, func(), error) {
	ruta, err := rutaCloudflared(carpeta)
	if err != nil {
		return "", nil, err
	}
	cmd := ocultarVentana(exec.Command(ruta, "tunnel", "--no-autoupdate", "--url", fmt.Sprintf("http://127.0.0.1:%d", puertoWeb)))
	salida, err := cmd.StderrPipe()
	if err != nil {
		return "", nil, err
	}
	if err := cmd.Start(); err != nil {
		return "", nil, err
	}
	atarAlProceso(cmd.Process)
	detener := func() { _ = cmd.Process.Kill() }
	encontrada := make(chan string, 1)
	go func() {
		lector := bufio.NewScanner(salida)
		for lector.Scan() {
			if url := patronTunel.FindString(lector.Text()); url != "" {
				select {
				case encontrada <- url:
				default:
				}
			}
		}
	}()
	select {
	case url := <-encontrada:
		return url, detener, nil
	case <-time.After(40 * time.Second):
		detener()
		return "", nil, errors.New("cloudflared no dio una URL a tiempo")
	}
}
