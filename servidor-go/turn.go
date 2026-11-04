package main

// Credenciales TURN temporales de Cloudflare Realtime (igual que en Kubox). Con ellas el vídeo
// funciona aunque el servidor esté tras CGNAT: navegadores y servidor se encuentran en el relé.

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"regexp"
	"time"
)

const ttlTurn = 86400

var puerto53 = regexp.MustCompile(`:53(\?|$)`)

func pedirTurnCloudflare(id, token string) ([]ServidorIce, error) {
	ctx, cancelar := context.WithTimeout(context.Background(), 8*time.Second)
	defer cancelar()
	cuerpo, _ := json.Marshal(map[string]int{"ttl": ttlTurn})
	url := fmt.Sprintf("https://rtc.live.cloudflare.com/v1/turn/keys/%s/credentials/generate-ice-servers", id)
	req, _ := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(cuerpo))
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode/100 != 2 {
		return nil, fmt.Errorf("Cloudflare respondió %d", resp.StatusCode)
	}
	var datos struct {
		IceServers json.RawMessage `json:"iceServers"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&datos); err != nil {
		return nil, err
	}
	var lista []ServidorIce
	if json.Unmarshal(datos.IceServers, &lista) != nil {
		var uno ServidorIce
		if err := json.Unmarshal(datos.IceServers, &uno); err != nil {
			return nil, err
		}
		lista = []ServidorIce{uno}
	}
	for i := range lista {
		urls := lista[i].URLs[:0]
		for _, u := range lista[i].URLs {
			if !puerto53.MatchString(u) {
				urls = append(urls, u)
			}
		}
		lista[i].URLs = urls
	}
	return lista, nil
}

var stunPublicos = []ServidorIce{{URLs: []string{"stun:stun.cloudflare.com:3478", "stun:stun.l.google.com:19302"}}}

// obtenerIceInicial devuelve STUN y, si hay clave, las credenciales TURN (más de un servidor).
func obtenerIceInicial(id, token string) ([]ServidorIce, error) {
	if id == "" || token == "" {
		return stunPublicos, nil
	}
	turn, err := pedirTurnCloudflare(id, token)
	if err != nil {
		log.Printf("[TURN] No se pudieron obtener credenciales: %v", err)
		return stunPublicos, err
	}
	return append(append([]ServidorIce{}, stunPublicos...), turn...), nil
}

// renovarTurn renueva las credenciales a mitad de su vida.
func renovarTurn(s *Servidor, id, token string) {
	for range time.Tick(ttlTurn / 2 * time.Second) {
		if ice, err := obtenerIceInicial(id, token); err == nil {
			s.fijarIce(ice)
		}
	}
}
