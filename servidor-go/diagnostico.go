package main

import "fmt"

// Diagnóstico de red al arrancar: IP pública, apertura de puertos en el router y CGNAT.
type EstadoRed struct {
	ipPublica   string
	mapeo       *Mapeo
	accesible   bool // el puerto de medios debería llegar desde Internet
	ipsAnunciar []string
}

func diagnosticarRed(config Config) EstadoRed {
	estado := EstadoRed{}
	ip, err := ipPublica()
	if err != nil {
		linea(1, "IP pública", "no se pudo averiguar (¿sin Internet?); solo funcionará en la red local")
	} else {
		estado.ipPublica = ip
		estado.ipsAnunciar = []string{ip}
	}
	puertos := []puertoAbrir{{config.puertoMedios, "UDP"}, {config.puertoMedios, "TCP"}}
	if config.puertoHTTPS > 0 {
		puertos = append(puertos, puertoAbrir{config.puertoHTTPS, "TCP"})
	}
	manual := fmt.Sprintf("ábrelos a mano en el router hacia este equipo: %d UDP y TCP (vídeo)", config.puertoMedios)
	if config.sinUPnP {
		linea(1, "Router", "apertura automática desactivada; "+manual)
		return estado
	}
	fmt.Println("  … Intentando abrir los puertos en el router (UPnP)")
	mapeo, err := abrirPuertos(puertos)
	if err != nil {
		linea(1, "Router", fmt.Sprintf("no se pudieron abrir solos (%v); %s", err, manual))
		return estado
	}
	estado.mapeo = mapeo
	switch {
	case estado.ipPublica != "" && mapeo.IPExterna != "" && mapeo.IPExterna != estado.ipPublica:
		linea(2, "Router", fmt.Sprintf("puertos abiertos con %s, pero hay CGNAT o doble NAT: la IP del router (%s) no es tu IP pública (%s). Desde Internet no se puede llegar a este equipo; hace falta TURN o pedir a tu operador una IP pública.", mapeo.Metodo, mapeo.IPExterna, estado.ipPublica))
	case mapeo.IPExterna != "" && esCGNAT(mapeo.IPExterna):
		linea(2, "Router", fmt.Sprintf("tu operador usa CGNAT (IP del router %s): desde Internet no se puede llegar a este equipo; hace falta TURN.", mapeo.IPExterna))
	default:
		estado.accesible = true
		linea(0, "Router", fmt.Sprintf("puertos %d UDP/TCP abiertos con %s (IP pública %s)", config.puertoMedios, mapeo.Metodo, estado.ipPublica))
	}
	return estado
}
