//go:build windows

package main

// Firewall de Windows: una regla de entrada para este .exe (todos sus puertos). Crearla requiere
// administrador, así que si falta se relanza el propio .exe elevado (aparece el aviso de UAC).

import (
	"fmt"
	"os"
	"os/exec"
	"strings"
	"syscall"
)

const nombreRegla = "Kubox Meet"

func ocultarVentana(cmd *exec.Cmd) *exec.Cmd {
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}
	return cmd
}

func reglaFirewallCorrecta(exe string) bool {
	salida, err := ocultarVentana(exec.Command("netsh", "advfirewall", "firewall", "show", "rule", "name="+nombreRegla, "verbose")).CombinedOutput()
	return err == nil && strings.Contains(strings.ToLower(string(salida)), strings.ToLower(exe))
}

// crearReglaFirewall se ejecuta ya elevado (--solo-firewall).
func crearReglaFirewall() error {
	exe, err := os.Executable()
	if err != nil {
		return err
	}
	_ = ocultarVentana(exec.Command("netsh", "advfirewall", "firewall", "delete", "rule", "name="+nombreRegla)).Run()
	salida, err := ocultarVentana(exec.Command("netsh", "advfirewall", "firewall", "add", "rule", "name="+nombreRegla,
		"dir=in", "action=allow", "program="+exe, "enable=yes", "profile=any")).CombinedOutput()
	if err != nil {
		return fmt.Errorf("%v: %s", err, salida)
	}
	return nil
}

// asegurarFirewall devuelve (estado legible, ok).
func asegurarFirewall() (string, bool) {
	exe, err := os.Executable()
	if err != nil {
		return "no se pudo localizar el ejecutable", false
	}
	if reglaFirewallCorrecta(exe) {
		return "permitido", true
	}
	escapado := strings.ReplaceAll(exe, "'", "''")
	orden := fmt.Sprintf("Start-Process -FilePath '%s' -ArgumentList '--solo-firewall' -Verb RunAs -Wait -WindowStyle Hidden", escapado)
	_ = ocultarVentana(exec.Command("powershell", "-NoProfile", "-NonInteractive", "-Command", orden)).Run()
	if reglaFirewallCorrecta(exe) {
		return "permitido (regla creada)", true
	}
	return "sin permiso de administrador: Windows preguntará al primer uso; acepta en redes privadas y públicas", false
}
