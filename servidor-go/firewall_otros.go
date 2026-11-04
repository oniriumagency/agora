//go:build !windows

package main

import "os/exec"

func ocultarVentana(cmd *exec.Cmd) *exec.Cmd { return cmd }

func crearReglaFirewall() error { return nil }

// En Linux y macOS no se toca el cortafuegos: se indica qué puertos abrir si hay uno activo.
func asegurarFirewall() (string, bool) {
	return "no gestionado en este sistema (si usas ufw: sudo ufw allow <puertos>)", true
}
