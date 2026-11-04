package main

// Red: IPs locales, IP pública (por STUN) y apertura automática de puertos en el router (UPnP o
// NAT-PMP), con detección de CGNAT o doble NAT.

import (
	"context"
	"errors"
	"fmt"
	"net"
	"strings"
	"time"

	"github.com/huin/goupnp"
	"github.com/huin/goupnp/dcps/internetgateway2"
	natpmp "github.com/jackpal/go-nat-pmp"
	"github.com/pion/stun/v3"
)

// ipsLocales devuelve las IPv4 privadas de las interfaces activas (para el enlace de red local).
func ipsLocales() []string {
	var ips []string
	interfaces, _ := net.Interfaces()
	for _, i := range interfaces {
		if i.Flags&net.FlagUp == 0 || i.Flags&net.FlagLoopback != 0 || esVirtual(i.Name) {
			continue
		}
		direcciones, _ := i.Addrs()
		for _, d := range direcciones {
			if red, ok := d.(*net.IPNet); ok && red.IP.To4() != nil && red.IP.IsPrivate() {
				ips = append(ips, red.IP.String())
			}
		}
	}
	return ips
}

// esVirtual descarta adaptadores de máquinas virtuales y VPN (VirtualBox, Hyper-V, VMware, WSL…).
func esVirtual(nombre string) bool {
	n := strings.ToLower(nombre)
	for _, marca := range []string{"virtualbox", "vethernet", "vmware", "hyper-v", "wsl", "docker", "vbox", "zerotier", "tailscale", "hamachi"} {
		if strings.Contains(n, marca) {
			return true
		}
	}
	return false
}

// ipPublica pregunta a un servidor STUN con qué IP nos ve Internet.
func ipPublica() (string, error) {
	for _, servidor := range []string{"stun.cloudflare.com:3478", "stun.l.google.com:19302"} {
		cliente, err := stun.Dial("udp4", servidor)
		if err != nil {
			continue
		}
		var ip string
		mensaje := stun.MustBuild(stun.TransactionID, stun.BindingRequest)
		_ = cliente.Do(mensaje, func(e stun.Event) {
			var direccion stun.XORMappedAddress
			if e.Error == nil && direccion.GetFrom(e.Message) == nil {
				ip = direccion.IP.String()
			}
		})
		cliente.Close()
		if ip != "" {
			return ip, nil
		}
	}
	return "", errors.New("sin respuesta de los servidores STUN")
}

// esCGNAT: 100.64.0.0/10 es el rango del CGNAT de los operadores.
func esCGNAT(ip string) bool {
	_, red, _ := net.ParseCIDR("100.64.0.0/10")
	parsed := net.ParseIP(ip)
	return parsed != nil && (red.Contains(parsed) || parsed.IsPrivate())
}

type Mapeo struct {
	Metodo    string // "UPnP" o "NAT-PMP"
	IPExterna string // IP WAN que dice el router
	quitar    func()
}

type puertoAbrir struct {
	puerto    int
	protocolo string // "UDP" o "TCP"
}

func ipLocalHacia(destino string) string {
	conexion, err := net.Dial("udp4", destino+":9")
	if err != nil {
		return ""
	}
	defer conexion.Close()
	return conexion.LocalAddr().(*net.UDPAddr).IP.String()
}

// abrirPuertos intenta UPnP (IGD v2 y v1) y, si no hay, NAT-PMP.
func abrirPuertos(puertos []puertoAbrir) (*Mapeo, error) {
	ctx, cancelar := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancelar()
	if m, err := abrirUPnP(ctx, puertos); err == nil {
		return m, nil
	} else if m2, err2 := abrirNATPMP(puertos); err2 == nil {
		return m2, nil
	} else {
		return nil, fmt.Errorf("UPnP: %v; NAT-PMP: %v", err, err2)
	}
}

type clienteMapeo interface {
	AddPortMappingCtx(ctx context.Context, remoto string, externo uint16, protocolo string, interno uint16, cliente string, activo bool, descripcion string, duracion uint32) error
	DeletePortMappingCtx(ctx context.Context, remoto string, externo uint16, protocolo string) error
	GetExternalIPAddressCtx(ctx context.Context) (string, error)
	GetServiceClient() *goupnp.ServiceClient
}

func abrirUPnP(ctx context.Context, puertos []puertoAbrir) (*Mapeo, error) {
	var clientes []clienteMapeo
	if c2, _, err := internetgateway2.NewWANIPConnection2ClientsCtx(ctx); err == nil {
		for _, c := range c2 {
			clientes = append(clientes, c)
		}
	}
	if c1, _, err := internetgateway2.NewWANIPConnection1ClientsCtx(ctx); err == nil {
		for _, c := range c1 {
			clientes = append(clientes, c)
		}
	}
	if c3, _, err := internetgateway2.NewWANPPPConnection1ClientsCtx(ctx); err == nil {
		for _, c := range c3 {
			clientes = append(clientes, c)
		}
	}
	if len(clientes) == 0 {
		return nil, errors.New("el router no anuncia UPnP (puede estar desactivado)")
	}
	var ultimoError error
	for _, c := range clientes {
		host := c.GetServiceClient().RootDevice.URLBase.Hostname()
		local := ipLocalHacia(host)
		var hechos []puertoAbrir
		var err error
		for _, p := range puertos {
			err = c.AddPortMappingCtx(ctx, "", uint16(p.puerto), p.protocolo, uint16(p.puerto), local, true, "Kubox Meet", 0)
			if err != nil {
				break
			}
			hechos = append(hechos, p)
		}
		if err != nil {
			ultimoError = err
			continue
		}
		externa, _ := c.GetExternalIPAddressCtx(ctx)
		cliente := c
		return &Mapeo{Metodo: "UPnP", IPExterna: externa, quitar: func() {
			ctx2, cancelar := context.WithTimeout(context.Background(), 3*time.Second)
			defer cancelar()
			for _, p := range hechos {
				_ = cliente.DeletePortMappingCtx(ctx2, "", uint16(p.puerto), p.protocolo)
			}
		}}, nil
	}
	return nil, fmt.Errorf("el router rechazó abrir el puerto: %v", ultimoError)
}

func abrirNATPMP(puertos []puertoAbrir) (*Mapeo, error) {
	pasarela := pasarelaPredeterminada()
	if pasarela == nil {
		return nil, errors.New("no se encontró la puerta de enlace")
	}
	cliente := natpmp.NewClientWithTimeout(pasarela, 2*time.Second)
	externa, err := cliente.GetExternalAddress()
	if err != nil {
		return nil, err
	}
	for _, p := range puertos {
		protocolo := "udp"
		if p.protocolo == "TCP" {
			protocolo = "tcp"
		}
		if _, err := cliente.AddPortMapping(protocolo, p.puerto, p.puerto, 7200); err != nil {
			return nil, err
		}
	}
	ip := net.IP(externa.ExternalIPAddress[:]).String()
	return &Mapeo{Metodo: "NAT-PMP", IPExterna: ip, quitar: func() {
		for _, p := range puertos {
			protocolo := "udp"
			if p.protocolo == "TCP" {
				protocolo = "tcp"
			}
			_, _ = cliente.AddPortMapping(protocolo, p.puerto, 0, 0)
		}
	}}, nil
}

// pasarelaPredeterminada supone la .1 de la red local (lo habitual en routers domésticos).
func pasarelaPredeterminada() net.IP {
	ip := net.ParseIP(ipLocalHacia("1.1.1.1")).To4()
	if ip == nil {
		return nil
	}
	return net.IPv4(ip[0], ip[1], ip[2], 1)
}
