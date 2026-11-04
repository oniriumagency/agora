//go:build windows

package main

import (
	"os"
	"unsafe"

	"golang.org/x/sys/windows"
)

var trabajo windows.Handle

// atarAlProceso mete el proceso hijo en un "job" que Windows cierra al cerrarse este .exe, para
// que cloudflared no quede vivo si se cierra la ventana.
func atarAlProceso(proceso *os.Process) {
	if trabajo == 0 {
		h, err := windows.CreateJobObject(nil, nil)
		if err != nil {
			return
		}
		info := windows.JOBOBJECT_EXTENDED_LIMIT_INFORMATION{}
		info.BasicLimitInformation.LimitFlags = windows.JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE
		if _, err := windows.SetInformationJobObject(h, windows.JobObjectExtendedLimitInformation, uintptr(unsafe.Pointer(&info)), uint32(unsafe.Sizeof(info))); err != nil {
			return
		}
		trabajo = h
	}
	h, err := windows.OpenProcess(windows.PROCESS_SET_QUOTA|windows.PROCESS_TERMINATE, false, uint32(proceso.Pid))
	if err != nil {
		return
	}
	defer windows.CloseHandle(h)
	_ = windows.AssignProcessToJobObject(trabajo, h)
}

// prepararConsola activa colores ANSI y UTF-8 en la consola de Windows.
func prepararConsola() {
	_ = windows.SetConsoleOutputCP(65001)
	salida := windows.Handle(os.Stdout.Fd())
	var modo uint32
	if windows.GetConsoleMode(salida, &modo) == nil {
		_ = windows.SetConsoleMode(salida, modo|windows.ENABLE_VIRTUAL_TERMINAL_PROCESSING)
	}
}

func abrirNavegador(url string) {
	_ = ocultarVentana(execCommand("rundll32", "url.dll,FileProtocolHandler", url)).Start()
}
