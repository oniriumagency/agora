package main

import (
	"encoding/json"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gorilla/websocket"
)

func TestValidacion(t *testing.T) {
	if !salaValida("abc-defg-hij") || salaValida("../etc") || salaValida("ABC") {
		t.Fatal("validación de sala incorrecta")
	}
	if got := limpiarTexto("  Ana\u0007 ", 40, false); got != "Ana" {
		t.Fatalf("limpiarTexto = %q", got)
	}
	if got := limpiarTexto(strings.Repeat("ñ", 50), 40, false); len([]rune(got)) != 40 {
		t.Fatal("no recorta por caracteres")
	}
}

func TestClaveVP8(t *testing.T) {
	// Descriptor sin extensiones, S=1, PID=0, cabecera VP8 con bit P=0 (clave)
	if !esClaveVP8([]byte{0x10, 0x00}) {
		t.Fatal("no reconoce un fotograma clave")
	}
	if esClaveVP8([]byte{0x10, 0x01}) || esClaveVP8([]byte{0x00, 0x00}) {
		t.Fatal("marca como clave lo que no lo es")
	}
	// Con extensión X e ID de imagen de 15 bits
	if !esClaveVP8([]byte{0x90, 0x80, 0x81, 0x23, 0x00}) {
		t.Fatal("no salta el PictureID largo")
	}
}

// Cliente WebSocket de prueba contra el servidor real (sin medios).
type clientePrueba struct {
	conn *websocket.Conn
	t    *testing.T
}

func (c *clientePrueba) enviar(m M) {
	if err := c.conn.WriteJSON(m); err != nil {
		c.t.Fatal(err)
	}
}

func (c *clientePrueba) esperar(tipo string) map[string]any {
	_ = c.conn.SetReadDeadline(time.Now().Add(3 * time.Second))
	for {
		var m map[string]any
		if err := c.conn.ReadJSON(&m); err != nil {
			c.t.Fatalf("esperando %s: %v", tipo, err)
		}
		if m["tipo"] == tipo {
			return m
		}
	}
}

func TestSalaChatYEstado(t *testing.T) {
	api, cerrar, err := crearAPI(18091, nil)
	if err != nil {
		t.Fatal(err)
	}
	defer cerrar()
	s := nuevoServidor(Config{maximoPorSala: 2, maximoVideos: 9, maximoSalas: 5, maximoConexiones: 10}, api)
	s.fijarIce(nil)
	prueba := httptest.NewServer(s.rutas(manejadorWeb()))
	defer prueba.Close()
	url := "ws" + strings.TrimPrefix(prueba.URL, "http") + "/senal"
	conectar := func(nombre string) *clientePrueba {
		conn, _, err := websocket.DefaultDialer.Dial(url, nil)
		if err != nil {
			t.Fatal(err)
		}
		c := &clientePrueba{conn, t}
		c.enviar(M{"tipo": "UNIRSE", "sala": "sala-prueba", "nombre": nombre, "estado": M{"microfono": true, "camara": false}})
		return c
	}
	ana := conectar("Ana")
	ana.esperar("BIENVENIDA")
	beto := conectar("Beto")
	bienvenida := beto.esperar("BIENVENIDA")
	if lista, _ := json.Marshal(bienvenida["participantes"]); !strings.Contains(string(lista), "Ana") {
		t.Fatal("Beto no ve a Ana")
	}
	ana.esperar("ENTRO")
	ana.enviar(M{"tipo": "ESTADO", "cambios": M{"mano": true}})
	if estado := beto.esperar("ESTADO")["estado"].(map[string]any); estado["mano"] == nil {
		t.Fatal("la mano no llegó")
	}
	ana.enviar(M{"tipo": "CHAT", "texto": "  hola  "})
	if texto := beto.esperar("CHAT")["mensaje"].(map[string]any)["texto"]; texto != "hola" {
		t.Fatalf("chat = %v", texto)
	}
	carla := conectar("Carla")
	if codigo := carla.esperar("ERROR")["codigo"]; codigo != "SALA_LLENA" {
		t.Fatalf("esperaba SALA_LLENA, llegó %v", codigo)
	}
	ana.conn.Close()
	beto.esperar("SALIO")
}
