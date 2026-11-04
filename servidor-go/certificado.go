package main

// Certificado propio para el HTTPS de la red local: los navegadores solo dan cámara y micrófono en
// HTTPS, y en la red local no hay un certificado público. El navegador avisará la primera vez.

import (
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/tls"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/pem"
	"math/big"
	"net"
	"os"
	"path/filepath"
	"time"
)

func certificadoLocal(carpeta string, ips []string) (tls.Certificate, error) {
	rutaCert, rutaClave := filepath.Join(carpeta, "local.crt"), filepath.Join(carpeta, "local.key")
	if par, err := tls.LoadX509KeyPair(rutaCert, rutaClave); err == nil && cubre(par, ips) {
		return par, nil
	}
	clave, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		return tls.Certificate{}, err
	}
	serie, _ := rand.Int(rand.Reader, big.NewInt(1<<62))
	plantilla := x509.Certificate{
		SerialNumber: serie,
		Subject:      pkix.Name{CommonName: "Kubox Meet (red local)", Organization: []string{"Kubox Meet"}},
		NotBefore:    time.Now().Add(-time.Hour),
		NotAfter:     time.Now().AddDate(1, 0, 0),
		KeyUsage:     x509.KeyUsageDigitalSignature,
		ExtKeyUsage:  []x509.ExtKeyUsage{x509.ExtKeyUsageServerAuth},
		DNSNames:     []string{"localhost"},
		IPAddresses:  []net.IP{net.ParseIP("127.0.0.1")},
	}
	for _, ip := range ips {
		plantilla.IPAddresses = append(plantilla.IPAddresses, net.ParseIP(ip))
	}
	der, err := x509.CreateCertificate(rand.Reader, &plantilla, &plantilla, &clave.PublicKey, clave)
	if err != nil {
		return tls.Certificate{}, err
	}
	claveDer, _ := x509.MarshalECPrivateKey(clave)
	certPem := pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: der})
	clavePem := pem.EncodeToMemory(&pem.Block{Type: "EC PRIVATE KEY", Bytes: claveDer})
	_ = os.WriteFile(rutaCert, certPem, 0o600)
	_ = os.WriteFile(rutaClave, clavePem, 0o600)
	return tls.X509KeyPair(certPem, clavePem)
}

func cubre(par tls.Certificate, ips []string) bool {
	cert, err := x509.ParseCertificate(par.Certificate[0])
	if err != nil || time.Until(cert.NotAfter) < 30*24*time.Hour {
		return false
	}
	for _, ip := range ips {
		if cert.VerifyHostname(ip) != nil {
			return false
		}
	}
	return true
}
