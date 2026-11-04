//go:build !windows

package main

import (
	"os"
	"runtime"
)

func atarAlProceso(*os.Process) {}

func prepararConsola() {}

func abrirNavegador(url string) {
	if runtime.GOOS == "darwin" {
		_ = execCommand("open", url).Start()
	} else if os.Getenv("DISPLAY") != "" || os.Getenv("WAYLAND_DISPLAY") != "" {
		_ = execCommand("xdg-open", url).Start()
	}
}
