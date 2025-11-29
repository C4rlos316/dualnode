# 🚀 DUALNODE – Proyecto final de fundamentos de sistemas embebidos semestre 2026-1

**Profesor:** Rodrigo Ramos Díaz  
**Alumnos:** Uriel Benjamin De La Merced Soriano, Brian Erik Martinez Perez, Ruiz Agilar Cristian Jair, Carlos Mario Hernandez Gutierrez  

## 🏷️ Tecnologías Utilizadas

![ESP32](https://img.shields.io/badge/ESP32-000000?style=for-the-badge&logo=espressif&logoColor=white)
![Arduino IDE](https://img.shields.io/badge/Arduino_IDE-00979D?style=for-the-badge&logo=arduino&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-3C873A?style=for-the-badge&logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/Express.js-000000?style=for-the-badge&logo=express&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)
![BLE](https://img.shields.io/badge/BLE-Bluetooth?style=for-the-badge&logo=bluetooth&logoColor=white&color=0072CE)
![Groq AI](https://img.shields.io/badge/Groq_AI-FF4D00?style=for-the-badge&logo=neovim&logoColor=white)
![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white)


## 📋 Índice

1. [Descripción General](#descripción-general)
2. [Arquitectura del Sistema](#arquitectura-del-sistema)
3. [Componentes de Hardware](#componentes-de-hardware)
4. [Estructura del Proyecto](#estructura-del-proyecto)
5. [Firmware ESP32](#firmware-esp32)
6. [Servidor Node.js](#servidor-nodejs)
7. [Interfaz Web](#interfaz-web)
8. [Protocolo BLE](#protocolo-ble)
9. [Flujo de Comunicación](#flujo-de-comunicación)
10. [API REST](#api-rest)
11. [Configuración y Despliegue](#configuración-y-despliegue)
12. [Solución de Problemas](#solución-de-problemas)

---

## 🎯 Descripción General

**DUALNODE** es un sistema IoT modular que permite controlar y monitorear dispositivos ESP32 a través de una interfaz web. El sistema soporta dos tipos de kits:

| Kit | Función | Componentes |
|-----|---------|-------------|
| **LEDs + IA** | Control inteligente de LEDs mediante comandos de lenguaje natural | 10 LEDs de colores + OLED |
| **Sensores** | Monitoreo ambiental en tiempo real | DHT11 + HC-SR04 + OLED |

### Características Principales

- ✅ Configuración WiFi vía Bluetooth Low Energy (BLE)
- ✅ Interfaz web responsive y moderna
- ✅ Control por voz/texto con IA (Groq API)
- ✅ Monitoreo en tiempo real de sensores
- ✅ Almacenamiento en Firebase
- ✅ Detección automática de dispositivos

---

## 🏗️ Arquitectura del Sistema

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              ARQUITECTURA DUALNODE                          │
└─────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│                           🖥️ SERVIDOR NODE.JS                                │
│                              (Express.js)                                    │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │   /api/ia   │  │ /api/sensors│  │ /api/config │  │   Archivos Static   │  │
│  │  (Groq AI)  │  │   (datos)   │  │ (registro)  │  │    (HTML/CSS/JS)    │  │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└───────────────────────────────┬──────────────────────────────────────────────┘
                                │
                    ┌───────────┴───────────┐
                    │      RED WiFi LOCAL   │
                    │    (HTTP Requests)    │
                    └───────────┬───────────┘
                                │
          ┌─────────────────────┼
          │                     │                     
          ▼                     ▼                     
┌──────────────────┐  ┌──────────────────┐  
│   🔵 ESP32 #1    │  │   🟢 ESP32 #2    │  
│   Kit LEDs + IA  │  │   Kit Sensores   │  
│                  │  │                  │  
│  ┌────────────┐  │  │  ┌────────────┐  │  
│  │ 10 LEDs    │  │  │  │   DHT11    │  │  
│  │ RGB Colors │  │  │  │  Temp/Hum  │  │  
│  └────────────┘  │  │  └────────────┘  │  
│  ┌────────────┐  │  │  ┌────────────┐  │  
│  │   OLED     │  │  │  │  HC-SR04   │  │  
│  │  128x64    │  │  │  │ Distancia  │  │  
│  └────────────┘  │  │  └────────────┘  │  
│  ┌────────────┐  │  │  ┌────────────┐  │                    
│  │    BLE     │  │  │  │    BLE     │  │  
│  │  Config    │  │  │  │  Config    │  │  
│  └────────────┘  │  │  └────────────┘  │  
└──────────────────┘  └──────────────────┘  

          ▲                     ▲
          │      BLUETOOTH      │
          │    LOW ENERGY (BLE) │
          └──────────┬──────────┘
                     │
          ┌──────────┴──────────┐
          │  📱 NAVEGADOR WEB   │
          │  (Chrome/Edge)      │
          │                     │
          │  ┌───────────────┐  │
          │  │  Web Bluetooth│  │
          │  │     API       │  │
          │  └───────────────┘  │
          └─────────────────────┘
```

### Flujo de Datos

```
1. CONFIGURACIÓN INICIAL (BLE)
   Navegador ──BLE──> ESP32
   - Escaneo de redes WiFi
   - Envío de credenciales
   - Envío de IP del servidor

2. OPERACIÓN NORMAL (WiFi/HTTP)
   ESP32 <──HTTP──> Servidor <──HTTP──> Navegador
   - LEDs: Comandos de IA → Código ESP-IDF → Ejecución
   - Sensores: Lectura → POST al servidor → Display en web
```

---

## 🔧 Componentes de Hardware

### Kit LEDs + IA

| Componente | GPIO | Descripción |
|------------|------|-------------|
| LED Verde #1 | 4 | LED de color verde |
| LED Amarillo #1 | 5 | LED de color amarillo |
| LED Rojo #1 | 12 | LED de color rojo |
| LED Azul #1 | 13 | LED de color azul |
| LED Anaranjado #1 | 14 | LED de color anaranjado |
| LED Anaranjado #2 | 15 | LED de color anaranjado |
| LED Azul #2 | 16 | LED de color azul |
| LED Rojo #2 | 17 | LED de color rojo |
| LED Amarillo #2 | 18 | LED de color amarillo |
| LED Verde #2 | 19 | LED de color verde |
| OLED SDA | 21 | Comunicación I2C |
| OLED SCL | 22 | Comunicación I2C |
| Botón RESET | 0 | Botón BOOT integrado |

### Kit Sensores

| Componente | GPIO | Descripción |
|------------|------|-------------|
| DHT11 Data | 25 | Sensor temperatura/humedad |
| HC-SR04 TRIG | 26 | Trigger ultrasonido |
| HC-SR04 ECHO | 27 | Echo ultrasonido |
| OLED SDA | 21 | Comunicación I2C |
| OLED SCL | 22 | Comunicación I2C |
| Botón RESET | 0 | Botón BOOT integrado |

### Diagrama de Conexión - Kit LEDs

```
                    ESP32 NodeMCU-32S
                   ┌─────────────────┐
                   │                 │
    LED Verde ◄────┤ GPIO 4     3V3  ├
    LED Amarillo ◄─┤ GPIO 5     GND  ├
    LED Rojo ◄─────┤ GPIO 12    GPIO23├
    LED Azul ◄─────┤ GPIO 13    GPIO22├───► OLED SCL
    LED Naranja ◄──┤ GPIO 14    GPIO21├───► OLED SDA
    LED Naranja ◄──┤ GPIO 15    GPIO19├───► LED Verde
    LED Azul ◄─────┤ GPIO 16    GPIO18├───► LED Amarillo
    LED Rojo ◄─────┤ GPIO 17    GPIO17├───► LED Rojo
                   │                 │
                   │    [BOOT]       │ ◄── Reset (GPIO 0)
                   └─────────────────┘
```

### Diagrama de Conexión - Kit Sensores

```
                    ESP32 NodeMCU-32S
                   ┌─────────────────┐
                   │                 │
                   │ GPIO 25    3V3  ├───► DHT11 VCC
    DHT11 Data ◄───┤ GPIO 25    GND  ├───► DHT11 GND, HC-SR04 GND
    HC-SR04 TRIG ◄─┤ GPIO 26    5V   ├───► HC-SR04 VCC
    HC-SR04 ECHO ◄─┤ GPIO 27    GPIO22├───► OLED SCL
                   │            GPIO21├───► OLED SDA
                   │                 │
                   │    [BOOT]       │ ◄── Reset (GPIO 0)
                   └─────────────────┘
```

---

## 📁 Estructura del Proyecto

```
dualnode/
│
├── 📄 firmware_leds_ia_fixed.ino     # Firmware ESP32 - Kit LEDs + IA
├── 📄 firmware_sensores_fixed.ino    # Firmware ESP32 - Kit Sensores
├── 📄 .gitignore                     # Archivos ignorados por Git
│
└── 📁 servidor/                      # Servidor Node.js
    │
    ├── 📄 package.json               # Dependencias npm
    ├── 📄 server.js                  # Servidor principal Express
    ├── 📄 test-groq.js               # Script de prueba Groq API
    │
    ├── 📁 routers/                   # Rutas API
    │   ├── 📄 esp32.js               # Rutas configuración ESP32
    │   ├── 📄 ia.js                  # Rutas IA (Groq)
    │   └── 📄 sensors.js             # Rutas datos sensores
    │
    └── 📁 public/                    # Archivos estáticos (Frontend)
        │
        ├── 📄 index.html             # Página principal
        │
        ├── 📁 css/
        │   ├── 📄 style.css          # Estilos principales
        │   └── 📄 notifications.css  # Estilos notificaciones
        │
        └── 📁 js/
            ├── 📄 app.js             # Lógica principal
            ├── 📄 ble-config.js      # Configuración BLE
            ├── 📄 leds-ia.js         # Control LEDs + IA
            ├── 📄 sensores.js        # Visualización sensores
            ├── 📄 notifications.js   # Sistema notificaciones
            └── 📄 error-handler.js   # Manejo de errores
```

---

## 🔌 Firmware ESP32

### Estados del Sistema

```
┌────────────────┐
│ STATE_BLE_     │  ← Estado inicial
│ CONFIG         │    Esperando configuración BLE
└───────┬────────┘
        │ wifiConfigured = true
        ▼
┌────────────────┐
│ STATE_WIFI_    │    Conectando a WiFi
│ CONNECTING     │    con credenciales recibidas
└───────┬────────┘
        │ WiFi.status() == WL_CONNECTED
        ▼
┌────────────────┐
│ STATE_ONLINE   │  ← Estado operativo
│                │    Servidor HTTP activo
└───────┬────────┘
        │ WiFi perdido o error
        ▼
┌────────────────┐
│ STATE_ERROR    │    Muestra error en OLED
│                │    Reinicia automáticamente
└────────────────┘
```

### Firmware LEDs + IA

#### Características Principales

```cpp
// Pines de LEDs
const int LED_PINS[10] = {4, 5, 12, 13, 14, 15, 16, 17, 18, 19};

// Función principal: Ejecutar código generado por IA
void executeGeneratedCode(String code) {
    // Parsea comandos ESP-IDF:
    // - gpio_set_level(GPIO, STATE)  → Enciende/apaga LED
    // - vTaskDelay(MS / portTICK)    → Delay en milisegundos
}
```

#### Endpoints HTTP

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/ping` | Verificar conexión |
| POST | `/execute` | Ejecutar código de LEDs |
| POST | `/stop` | Detener ejecución y apagar LEDs |
| POST | `/reset` | Reiniciar ESP32 |

#### Formato de Código Ejecutable

```cpp
// Ejemplo de código generado por IA
gpio_set_level(4, 1);      // Encender LED en GPIO 4
vTaskDelay(500 / portTICK); // Esperar 500ms
gpio_set_level(4, 0);      // Apagar LED en GPIO 4
```

### Firmware Sensores

#### Características Principales

```cpp
// Intervalo de lectura: 1 segundo
const unsigned long SENSOR_INTERVAL = 1000;

// Lectura de sensores
void readSensors() {
    // DHT11: Temperatura y Humedad
    temperature = dht.readTemperature();
    humidity = dht.readHumidity();
    
    // HC-SR04: Distancia ultrasónica
    distance = pulseIn(ECHO_PIN, HIGH) * 0.034 / 2;
}
```

#### Endpoints HTTP

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/ping` | Verificar conexión |
| GET | `/data` | Obtener datos de sensores |
| POST | `/reset` | Reiniciar ESP32 |

#### Formato de Datos

```json
{
    "temperature": 25.5,
    "humidity": 60.0,
    "distance": 45.3,
    "timestamp": 123456789
}
```

---

## 🖥️ Servidor Node.js

### Dependencias

```json
{
    "express": "^4.x",      // Framework web
    "cors": "^2.x",         // Cross-Origin Resource Sharing
    "groq-sdk": "^0.x",     // API de IA Groq
    "firebase-admin": "^11.x" // Firebase SDK
}
```

### Estructura del Servidor

```javascript
// server.js - Estructura principal
const express = require('express');
const app = express();

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Routers
app.use('/api/ia', require('./routers/ia'));
app.use('/api/sensors', require('./routers/sensors'));
app.use('/api/config', require('./routers/esp32'));

// Puerto
app.listen(3000);
```

### Variables de Entorno

Crear archivo `.env` en `/servidor`:

```env
GROQ_API_KEY=tu_api_key_de_groq
PORT=3000
```

---

## 🌐 Interfaz Web

### Tecnologías Frontend

- **HTML5** - Estructura semántica
- **CSS3** - Estilos modernos con variables CSS
- **JavaScript ES6+** - Lógica del cliente
- **Web Bluetooth API** - Comunicación BLE

### Módulos JavaScript

#### `app.js` - Controlador Principal

```javascript
// Inicialización de la aplicación
// Manejo de navegación entre secciones
// Detección de dispositivos
```

#### `ble-config.js` - Configuración BLE

```javascript
// Funciones principales
async function connectBLE()          // Conectar al ESP32
async function scanWiFiNetworks()    // Escanear redes WiFi
async function sendWiFiCredentials() // Enviar SSID/Password
async function sendServerIP()        // Enviar IP del servidor
```

#### `leds-ia.js` - Control de LEDs

```javascript
// Integración con IA
async function sendCommand(prompt)   // Enviar comando de texto
async function executeCode(code)     // Ejecutar en ESP32
async function stopExecution()       // Detener LEDs
```

#### `sensores.js` - Visualización de Datos

```javascript
// Polling de datos
function startPolling()              // Iniciar lectura cada 1s
function updateDisplay(data)         // Actualizar UI
function createChart()               // Gráficos de datos
```

---

## 📡 Protocolo BLE

### UUIDs del Servicio

```
Servicio Principal:
  UUID: 4fafc201-1fb5-459e-8fcc-c5c9c331914b

Características:
  SSID:    beb5483e-36e1-4688-b7f5-ea07361b26a8  (WRITE)
  Password: 1c95d5e3-d8f7-413a-bf3d-7a2e5d7be87e (WRITE)
  Scan:    d8de624e-140f-4a22-8594-e2216b84a5f2  (READ/NOTIFY)
  Server:  8a8e1c4f-2d3b-4e9a-a1c7-5f6d8e9a0b1c  (WRITE)
```

### Formato de Datos WiFi Scan

```
Red1_SSID,RSSI,EncType;Red2_SSID,RSSI,EncType;...

Ejemplo:
"MiWiFi,-45,3;Vecino,-78,4;Oficina,-60,3"

Donde EncType:
  0 = Abierta
  1 = WEP
  2 = WPA_PSK
  3 = WPA2_PSK
  4 = WPA_WPA2_PSK
  5 = WPA2_ENTERPRISE
```

### Secuencia de Configuración

```
┌──────────────┐                              ┌──────────────┐
│   Navegador  │                              │    ESP32     │
└──────┬───────┘                              └──────┬───────┘
       │                                             │
       │  1. Scan BLE devices                        │
       │────────────────────────────────────────────>│
       │                                             │
       │  2. Connect to "DUALNODE_XXXXXX"            │
       │<────────────────────────────────────────────│
       │                                             │
       │  3. Read CHAR_SCAN (WiFi networks)          │
       │────────────────────────────────────────────>│
       │                                             │
       │  4. Return "SSID1,-45,3;SSID2,-60,4..."     │
       │<────────────────────────────────────────────│
       │                                             │
       │  5. Write CHAR_SERVER (IP del servidor)     │
       │────────────────────────────────────────────>│
       │                                             │
       │  6. Write CHAR_SSID (nombre red WiFi)       │
       │────────────────────────────────────────────>│
       │                                             │
       │  7. Write CHAR_PASS (contraseña)            │
       │────────────────────────────────────────────>│
       │                                             │
       │  8. ESP32 se desconecta de BLE              │
       │     y conecta a WiFi                        │
       │                                             │
       │  9. ESP32 registra en servidor via HTTP     │
       │                                             │
```

### Limitaciones BLE Importantes

| Parámetro | Valor | Notas |
|-----------|-------|-------|
| MTU Default | ~20 bytes | Muy pequeño para lista de redes |
| MTU Configurado | 512 bytes | `BLEDevice::setMTU(512)` |
| Límite Práctico | 500 bytes | Se truncan los datos |
| Redes Máximas | ~15-20 | Depende de longitud de nombres |

---

## 🔄 Flujo de Comunicación

### Configuración Inicial

```
┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐
│  User   │    │ Browser │    │  ESP32  │    │ Server  │
└────┬────┘    └────┬────┘    └────┬────┘    └────┬────┘
     │              │              │              │
     │ Click        │              │              │
     │ "Configurar" │              │              │
     │─────────────>│              │              │
     │              │              │              │
     │              │ BLE Scan     │              │
     │              │─────────────>│              │
     │              │              │              │
     │              │ Connect      │              │
     │              │─────────────>│              │
     │              │              │              │
     │              │ Read WiFi    │              │
     │              │─────────────>│              │
     │              │              │              │
     │              │ Networks list│              │
     │              │<─────────────│              │
     │              │              │              │
     │ Select WiFi  │              │              │
     │─────────────>│              │              │
     │              │              │              │
     │              │ Write Config │              │
     │              │─────────────>│              │
     │              │              │              │
     │              │              │ Connect WiFi │
     │              │              │─────────────>│
     │              │              │              │
     │              │              │ Register     │
     │              │              │─────────────>│
     │              │              │              │
     │              │              │ Confirmed    │
     │              │              │<─────────────│
     │              │              │              │
```

### Operación LEDs + IA

```
┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐
│  User   │    │ Browser │    │ Server  │    │  Groq   │    │  ESP32  │
└────┬────┘    └────┬────┘    └────┬────┘    └────┬────┘    └────┬────┘
     │              │              │              │              │
     │ "Enciende    │              │              │              │
     │  LED rojo"   │              │              │              │
     │─────────────>│              │              │              │
     │              │              │              │              │
     │              │ POST /api/ia │              │              │
     │              │─────────────>│              │              │
     │              │              │              │              │
     │              │              │ Generate code│              │
     │              │              │─────────────>│              │
     │              │              │              │              │
     │              │              │ ESP-IDF code │              │
     │              │              │<─────────────│              │
     │              │              │              │              │
     │              │ Code response│              │              │
     │              │<─────────────│              │              │
     │              │              │              │              │
     │              │ POST /execute│              │              │
     │              │─────────────────────────────────────────>│
     │              │              │              │              │
     │              │              │              │  LED ON! 💡  │
     │              │              │              │              │
     │              │ Success      │              │              │
     │              │<─────────────────────────────────────────│
     │              │              │              │              │
```

### Operación Sensores

```
┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐
│  User   │    │ Browser │    │ Server  │    │  ESP32  │
└────┬────┘    └────┬────┘    └────┬────┘    └────┬────┘
     │              │              │              │
     │              │              │   Cada 1s    │
     │              │              │<─────────────│
     │              │              │ POST /sensors│
     │              │              │   data       │
     │              │              │              │
     │              │ GET /sensors │              │
     │              │─────────────>│              │
     │              │              │              │
     │              │ JSON data    │              │
     │              │<─────────────│              │
     │              │              │              │
     │  Ver datos   │              │              │
     │<─────────────│              │              │
     │  Temp: 25°C  │              │              │
     │  Hum: 60%    │              │              │
     │  Dist: 45cm  │              │              │
     │              │              │              │
```

---

## 📡 API REST

### Endpoints del Servidor

#### Configuración ESP32

```http
POST /api/config/station
Content-Type: application/json

{
    "mac": "AABBCC",
    "name": "LEDs + IA",
    "type": "leds-ia",
    "ip": "192.168.1.100"
}

Response: 200 OK
{
    "success": true,
    "message": "Estación registrada"
}
```

#### IA - Generación de Código

```http
POST /api/ia/generate
Content-Type: application/json

{
    "prompt": "Enciende el LED rojo por 2 segundos"
}

Response: 200 OK
{
    "success": true,
    "code": "gpio_set_level(12, 1);\nvTaskDelay(2000 / portTICK_PERIOD_MS);\ngpio_set_level(12, 0);",
    "explanation": "Este código enciende el LED rojo..."
}
```

#### Sensores - Datos

```http
POST /api/sensors/data
Content-Type: application/json

{
    "mac": "DDEEFF",
    "temp": 25.5,
    "hum": 60.0,
    "dist": 45.3
}

Response: 200 OK
{
    "success": true
}
```

```http
GET /api/sensors/latest

Response: 200 OK
{
    "temperature": 25.5,
    "humidity": 60.0,
    "distance": 45.3,
    "timestamp": 1701234567890
}
```

---

## ⚙️ Configuración y Despliegue

### Requisitos Previos

1. **Node.js** v16+ instalado
2. **Arduino IDE** con soporte ESP32
3. **Navegador** Chrome o Edge (Web Bluetooth)
4. **Cuenta Groq** para API de IA

### Instalación del Servidor

```bash
# 1. Navegar al directorio del servidor
cd servidor

# 2. Instalar dependencias
npm install

# 3. Configurar variables de entorno
# Crear archivo .env con:
# GROQ_API_KEY=tu_api_key

# 4. Iniciar servidor
npm start
```

### Flasheo del Firmware

1. Abrir Arduino IDE
2. Seleccionar placa: **ESP32 Dev Module**
3. Seleccionar puerto COM correcto
4. Instalar librerías requeridas:
   - `Adafruit SSD1306`
   - `Adafruit GFX`
   - `DHT sensor library`
   - `ArduinoJson`
   - `AsyncTCP`
   - `ESPAsyncWebServer`
5. Compilar y subir firmware

### Librerías Arduino Requeridas

| Librería | Versión | Uso |
|----------|---------|-----|
| WiFi | Built-in | Conexión WiFi |
| BLEDevice | Built-in | Bluetooth LE |
| Wire | Built-in | I2C para OLED |
| Adafruit_SSD1306 | 2.5.x | Display OLED |
| Adafruit_GFX | 1.11.x | Gráficos |
| DHT | 1.4.x | Sensor DHT11 |
| ArduinoJson | 6.x | Parsing JSON |
| AsyncTCP | Latest | TCP asíncrono |
| ESPAsyncWebServer | Latest | Servidor HTTP |

### Despliegue en Producción

#### Opción 1: ngrok (Desarrollo/Demo)

```bash
# Instalar ngrok
npm install -g ngrok

# Exponer servidor
ngrok http 3000
```


---

## 🔧 Solución de Problemas

### BLE no encuentra el ESP32

| Problema | Solución |
|----------|----------|
| Dispositivo no aparece | Verificar que el ESP32 esté encendido y en modo BLE |
| Navegador no soportado | Usar Chrome o Edge en desktop |
| Bluetooth desactivado | Activar Bluetooth en el sistema |

### WiFi no conecta

| Problema | Solución |
|----------|----------|
| Credenciales incorrectas | Verificar SSID y contraseña |
| Red no encontrada | Verificar que el ESP32 esté cerca del router |
| Timeout de conexión | Reiniciar ESP32 y volver a configurar |

### Escaneo WiFi vacío o incompleto

| Problema | Solución |
|----------|----------|
| 0 redes encontradas | Reiniciar ESP32 para nuevo escaneo |
| Pocas redes | Normal, se limita a 500 bytes (~15-20 redes) |

### LEDs no responden

| Problema | Solución |
|----------|----------|
| No ejecuta código | Verificar conexión HTTP entre servidor y ESP32 |
| Código inválido | Revisar formato del código ESP-IDF |
| LEDs siempre apagados | Verificar conexiones físicas |

### Sensores muestran error

| Problema | Solución |
|----------|----------|
| Temperatura NaN | Verificar conexión DHT11 |
| Distancia 500cm | HC-SR04 no detecta objeto o está desconectado |
| Datos no se actualizan | Verificar que el servidor esté recibiendo datos |

### Mensajes de Error Comunes

```
"Error al leer DHT11"
→ Verificar conexión del sensor en GPIO 25

"Error al leer HC-SR04"  
→ Verificar TRIG (GPIO 26) y ECHO (GPIO 27)

"WiFi perdido - Reiniciando..."
→ Problema de conexión WiFi, verificar cobertura

"Error al registrar en servidor"
→ Verificar IP del servidor y que esté ejecutándose
```

---

## 📊 Especificaciones Técnicas

### Rendimiento

| Métrica | Valor |
|---------|-------|
| Intervalo sensores | 1 segundo |
| Latencia BLE | ~100-500ms |
| Latencia HTTP | ~50-200ms |
| Redes WiFi máx | 15-20 (500 bytes) |

### Consumo de Memoria ESP32

| Recurso | Uso Aproximado |
|---------|----------------|
| Flash | ~1.2 MB |
| RAM | ~80 KB |
| BLE Stack | ~40 KB |

### Compatibilidad

| Plataforma | Soporte |
|------------|---------|
| Chrome Desktop | ✅ Completo |
| Edge Desktop | ✅ Completo |
| Chrome Android | ⚠️ Parcial (BLE limitado) |
| Firefox | ❌ No soporta Web Bluetooth |
| Safari | ❌ No soporta Web Bluetooth |
---

## 👥 Créditos

**DUALNODE** - Sistema IoT Modular para ESP32

Desarrollado como proyecto de Fudamento de sistemas embebidos.

---
