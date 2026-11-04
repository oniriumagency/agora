package main

import (
	"encoding/json"
	"io"
	"net/http"
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
	s := nuevoServidor(Config{carpetaDatos: t.TempDir(), maximoArchivoMB: 1, maximoPorSala: 2, maximoVideos: 9, maximoSalas: 5, maximoConexiones: 10}, api)
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
	claveAna := ana.esperar("BIENVENIDA")["clave"].(string)
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
	// Archivos: sin clave se rechaza; con clave llega al chat y se descarga como adjunto.
	subir := func(clave string, cuerpo string) int {
		pedido, _ := http.NewRequest("POST", prueba.URL+"/archivos?nombre=..%2Fnotas.txt", strings.NewReader(cuerpo))
		pedido.Header.Set("X-Clave", clave)
		r, err := http.DefaultClient.Do(pedido)
		if err != nil {
			t.Fatal(err)
		}
		r.Body.Close()
		return r.StatusCode
	}
	if codigo := subir("inventada", "x"); codigo != http.StatusForbidden {
		t.Fatalf("subida sin clave = %d", codigo)
	}
	if codigo := subir(claveAna, strings.Repeat("x", 2<<20)); codigo != http.StatusRequestEntityTooLarge {
		t.Fatalf("subida enorme = %d", codigo)
	}
	if codigo := subir(claveAna, "<script>hola</script>"); codigo != http.StatusCreated {
		t.Fatalf("subida = %d", codigo)
	}
	archivo := beto.esperar("CHAT")["mensaje"].(map[string]any)["archivo"].(map[string]any)
	if archivo["nombre"] != "notas.txt" || archivo["tamano"].(float64) != 21 {
		t.Fatalf("archivo = %v", archivo)
	}
	r, err := http.Get(prueba.URL + "/archivos/" + archivo["id"].(string) + "?ver=1")
	if err != nil {
		t.Fatal(err)
	}
	contenido, _ := io.ReadAll(r.Body)
	r.Body.Close()
	if string(contenido) != "<script>hola</script>" || !strings.HasPrefix(r.Header.Get("Content-Disposition"), "attachment") || r.Header.Get("Content-Type") != "application/octet-stream" {
		t.Fatalf("descarga insegura: %s %v", contenido, r.Header)
	}
	carla := conectar("Carla")
	if codigo := carla.esperar("ERROR")["codigo"]; codigo != "SALA_LLENA" {
		t.Fatalf("esperaba SALA_LLENA, llegó %v", codigo)
	}
	ana.conn.Close()
	beto.esperar("SALIO")
}

func TestReconexionGuardaElSitio(t *testing.T) {
	api, cerrar, err := crearAPI(18092, nil)
	if err != nil {
		t.Fatal(err)
	}
	defer cerrar()
	s := nuevoServidor(Config{carpetaDatos: t.TempDir(), maximoPorSala: 5, maximoVideos: 9, maximoSalas: 5, maximoConexiones: 10, graciaReconexion: 400 * time.Millisecond}, api)
	s.fijarIce(nil)
	prueba := httptest.NewServer(s.rutas(manejadorWeb()))
	defer prueba.Close()
	url := "ws" + strings.TrimPrefix(prueba.URL, "http") + "/senal"
	conectar := func(nombre, reanudar string) *clientePrueba {
		conn, _, err := websocket.DefaultDialer.Dial(url, nil)
		if err != nil {
			t.Fatal(err)
		}
		c := &clientePrueba{conn, t}
		c.enviar(M{"tipo": "UNIRSE", "sala": "sala-vuelta", "nombre": nombre, "reanudar": reanudar, "estado": M{"microfono": true, "camara": false}})
		return c
	}
	ana := conectar("Ana", "")
	bienvenida := ana.esperar("BIENVENIDA")
	idAna, clave := bienvenida["miId"].(string), bienvenida["clave"].(string)
	beto := conectar("Beto", "")
	beto.esperar("BIENVENIDA")
	ana.esperar("ENTRO")

	// Corte brusco (como al bloquear el celular): Ana queda ausente, no sale
	ana.conn.UnderlyingConn().Close()
	if estado := beto.esperar("ESTADO")["estado"].(map[string]any); estado["ausente"] != true {
		t.Fatalf("esperaba ausente, llegó %v", estado)
	}
	vuelta := conectar("Ana", clave)
	otra := vuelta.esperar("BIENVENIDA")
	if otra["miId"] != idAna || otra["reanudada"] != true {
		t.Fatalf("no retomó su sitio: %v", otra)
	}
	if estado := beto.esperar("ESTADO")["estado"].(map[string]any); estado["ausente"] == true {
		t.Fatal("sigue ausente tras volver")
	}
	time.Sleep(600 * time.Millisecond) // pasa la gracia de la conexión vieja: no debe sacarla
	vuelta.enviar(M{"tipo": "CHAT", "texto": "sigo aquí"})
	if m := beto.esperar("CHAT")["mensaje"].(map[string]any); m["autorId"] != idAna {
		t.Fatalf("chat de otra persona: %v", m)
	}

	// Colgar de verdad: sale al momento
	vuelta.enviar(M{"tipo": "SALIR"})
	if id := beto.esperar("SALIO")["id"]; id != idAna {
		t.Fatalf("salió %v", id)
	}
	// Corte brusco sin volver: sale al acabar la gracia
	carla := conectar("Carla", "")
	carla.esperar("BIENVENIDA")
	beto.esperar("ENTRO")
	carla.conn.UnderlyingConn().Close()
	beto.esperar("SALIO")
}
