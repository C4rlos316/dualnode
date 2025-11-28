/*
 * ============================================
 * DUALNODE - KIT LEDs + IA (FIXED WiFi SCAN)
 * ============================================
 * 
 * Hardware: ESP32 NodeMCU-32S
 * - 10 LEDs de colores:
 *   GPIO 4:  VERDE
 *   GPIO 5:  AMARILLO
 *   GPIO 12: ROJO
 *   GPIO 13: AZUL
 *   GPIO 14: ANARANJADO
 *   GPIO 15: ANARANJADO
 *   GPIO 16: AZUL
 *   GPIO 17: ROJO
 *   GPIO 18: AMARILLO
 *   GPIO 19: VERDE
 * - OLED I2C: SDA=21, SCL=22
 * - Botón BOOT: GPIO 0 (para reset)
 * 
 * IP del servidor se recibe dinámicamente por BLE
 * 
 * CAMBIOS:
 * - Escaneo WiFi proactivo al iniciar BLE
 * - Resultados almacenados y listos para lectura inmediata
 */


#include <Arduino.h>
#include <WiFi.h>
#include <AsyncTCP.h> 
#include <ESPAsyncWebServer.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <ArduinoJson.h>
#include <HTTPClient.h>


// ============================================
// CONFIGURACIÓN DE HARDWARE
// ============================================


// Pines LEDs
const int LED_PINS[10] = {4, 5, 12, 13, 14, 15, 16, 17, 18, 19};
bool led_states[10] = {false};


// OLED
#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
#define OLED_RESET -1
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);


// Botón de reset
#define RESET_BUTTON 0
#define RESET_HOLD_MS 5000


// ============================================
// CONFIGURACIÓN BLE
// ============================================


#define SERVICE_UUID        "4fafc201-1fb5-459e-8fcc-c5c9c331914b"
#define CHAR_SSID_UUID      "beb5483e-36e1-4688-b7f5-ea07361b26a8"
#define CHAR_PASS_UUID      "1c95d5e3-d8f7-413a-bf3d-7a2e5d7be87e"
#define CHAR_SCAN_UUID      "d8de624e-140f-4a22-8594-e2216b84a5f2"
#define CHAR_SERVER_UUID    "8a8e1c4f-2d3b-4e9a-a1c7-5f6d8e9a0b1c"


BLEServer* pServer = nullptr;
BLECharacteristic* pCharSSID = nullptr;
BLECharacteristic* pCharPass = nullptr;
BLECharacteristic* pCharScan = nullptr;
BLECharacteristic* pCharServer = nullptr;
bool deviceConnected = false;
bool wifiConfigured = false;


String receivedSSID = "";
String receivedPassword = "";
bool stopExecution = false;
String serverAddress = "";


// ============================================
// VARIABLES PARA ESCANEO PROACTIVO
// ============================================


String scannedNetworks = "";
bool networksScanned = false;


// ============================================
// SERVIDOR HTTP
// ============================================


AsyncWebServer server(80);
String serverIP = "";


// ============================================
// ESTADO DEL SISTEMA
// ============================================


enum SystemState {
  STATE_BLE_CONFIG,
  STATE_WIFI_CONNECTING,
  STATE_ONLINE,
  STATE_ERROR
};


SystemState currentState = STATE_BLE_CONFIG;


// ============================================
// DECLARACIONES DE FUNCIONES (FORWARD)
// ============================================


void showOLEDConfig(String deviceName);
void showOLEDConnecting(String ssid);
void showOLEDOnline(String ip);
void showOLEDError(String error);
void executeGeneratedCode(String code);
void registerToServer();
bool connectWiFi(String ssid, String password);


// ============================================
// CALLBACKS BLE
// ============================================


class ServerCallbacks: public BLEServerCallbacks {
  void onConnect(BLEServer* pServer) {
    deviceConnected = true;
    Serial.println("BLE: Cliente conectado");
  }


  void onDisconnect(BLEServer* pServer) {
    deviceConnected = false;
    Serial.println("BLE: Cliente desconectado");
  }
};


class CharacteristicCallbacks: public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic* pCharacteristic) {
    String uuid = String(pCharacteristic->getUUID().toString().c_str());
    String value = String(pCharacteristic->getValue().c_str());
    
    if (uuid.indexOf(CHAR_SERVER_UUID) != -1) {
      serverAddress = value;
      Serial.println("BLE: IP Servidor recibida: " + serverAddress);
    }
    else if (uuid.indexOf(CHAR_SSID_UUID) != -1) {
      receivedSSID = value;
      Serial.println("BLE: SSID recibido: " + receivedSSID);
    }
    else if (uuid.indexOf(CHAR_PASS_UUID) != -1) {
      receivedPassword = value;
      Serial.println("BLE: Password recibido");
      
      if (receivedSSID.length() > 0 && 
          receivedPassword.length() > 0 && 
          serverAddress.length() > 0) {
        
        Serial.println("BLE: Configuración completa recibida:");
        Serial.println("  Server: " + serverAddress);
        Serial.println("  SSID: " + receivedSSID);
        Serial.println("  Password: ***");
        
        delay(2000);
        
        wifiConfigured = true;
        Serial.println("BLE: Iniciando conexión WiFi...");
      } else {
        Serial.println("BLE: Esperando más datos de configuración...");
      }
    }
  }
  
  void onRead(BLECharacteristic* pCharacteristic) {
    String uuid = String(pCharacteristic->getUUID().toString().c_str());
    
    Serial.println("⚡⚡⚡ onRead() EJECUTADO - UUID: " + uuid);
    
    if (uuid.indexOf(CHAR_SCAN_UUID) != -1) {
      Serial.println("BLE: Cliente solicitó redes WiFi");
      Serial.println("    networksScanned=" + String(networksScanned));
      Serial.println("    scannedNetworks.length()=" + String(scannedNetworks.length()));
      
      // Devolver redes ya escaneadas
      if (networksScanned && scannedNetworks.length() > 0) {
        // ⚠️ Limitar a 500 bytes (MTU máximo)
        String dataToSend = scannedNetworks;
        if (dataToSend.length() > 500) {
          Serial.println("BLE: ⚠️ Datos muy grandes (" + String(dataToSend.length()) + " bytes), truncando a 500");
          dataToSend = dataToSend.substring(0, 500);
        }
        
        pCharacteristic->setValue(dataToSend.c_str());
        Serial.println("BLE: ✓ Enviando " + String(dataToSend.length()) + " bytes de redes");
        Serial.println("    Primeros 100 bytes: " + dataToSend.substring(0, 100));
      } else {
        // Si no hay redes, devolver vacío
        pCharacteristic->setValue("");
        Serial.println("BLE: ⚠ No hay redes escaneadas aún");
      }
    } else {
      Serial.println("⚠️ UUID no coincide con CHAR_SCAN_UUID");
    }
  }
};


// ============================================
// FUNCIONES DE INICIALIZACIÓN
// ============================================


void initLEDs() {
  Serial.println("Inicializando LEDs...");
  for (int i = 0; i < 10; i++) {
    pinMode(LED_PINS[i], OUTPUT);
    digitalWrite(LED_PINS[i], LOW);
    led_states[i] = false;
  }
  Serial.println("✓ 10 LEDs inicializados");
}


void initOLED() {
  Serial.println("Inicializando OLED...");
  Wire.begin(21, 22);
  
  if(!display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) {
    Serial.println("✗ Error al inicializar OLED");
    return;
  }
  
  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);
  display.display();
  
  Serial.println("✓ OLED inicializado");
}


void initBLE() {
  Serial.println("Inicializando BLE...");
  
  uint8_t mac[6];
  esp_read_mac(mac, ESP_MAC_WIFI_STA);
  char macStr[13];
  sprintf(macStr, "%02X%02X%02X", mac[3], mac[4], mac[5]);
  
  String deviceName = "DUALNODE_" + String(macStr);
  
  BLEDevice::init(deviceName.c_str());
  pServer = BLEDevice::createServer();
  pServer->setCallbacks(new ServerCallbacks());
  
  BLEService *pService = pServer->createService(SERVICE_UUID);
  
  pCharSSID = pService->createCharacteristic(
    CHAR_SSID_UUID,
    BLECharacteristic::PROPERTY_WRITE
  );
  pCharSSID->setCallbacks(new CharacteristicCallbacks());
  
  pCharPass = pService->createCharacteristic(
    CHAR_PASS_UUID,
    BLECharacteristic::PROPERTY_WRITE
  );
  pCharPass->setCallbacks(new CharacteristicCallbacks());
  
  pCharScan = pService->createCharacteristic(
    CHAR_SCAN_UUID,
    BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_NOTIFY
  );
  pCharScan->setCallbacks(new CharacteristicCallbacks());
  pCharScan->addDescriptor(new BLE2902());
  
  // ⚠️ IMPORTANTE: Establecer MTU grande
  BLEDevice::setMTU(512);
  
  // Establecer valor inicial
  pCharScan->setValue("INITIALIZING");
  
  pCharServer = pService->createCharacteristic(
    CHAR_SERVER_UUID,
    BLECharacteristic::PROPERTY_WRITE
  );
  pCharServer->setCallbacks(new CharacteristicCallbacks());
  
  pService->start();
  
  BLEAdvertising *pAdvertising = BLEDevice::getAdvertising();
  pAdvertising->addServiceUUID(SERVICE_UUID);
  pAdvertising->setScanResponse(true);
  pAdvertising->setMinPreferred(0x06);
  pAdvertising->setMinPreferred(0x12);
  BLEDevice::startAdvertising();
  
  Serial.println("✓ BLE iniciado como: " + deviceName);
  
  // ============================================
  // ESCANEO PROACTIVO DE REDES WiFi
  // ============================================
  
  Serial.println("📡 Escaneando redes WiFi de forma proactiva...");
  
  // Mostrar en OLED que está escaneando
  display.clearDisplay();
  display.setCursor(0, 0);
  display.setTextSize(1);
  display.println("DUALNODE");
  display.println("LEDs + IA");
  display.println();
  display.println("Escaneando WiFi...");
  display.display();
  
  WiFi.mode(WIFI_STA);
  WiFi.disconnect();
  delay(100);
  
  int n = WiFi.scanNetworks();
  scannedNetworks = "";
  
  for (int i = 0; i < n; i++) {
    if (i > 0) scannedNetworks += ";";
    scannedNetworks += WiFi.SSID(i) + "," + String(WiFi.RSSI(i)) + "," + String(WiFi.encryptionType(i));
  }
  
  networksScanned = true;
  Serial.println("✓ " + String(n) + " redes WiFi encontradas y almacenadas");
  Serial.println("Redes: " + scannedNetworks);
  
  // ⚠️ IMPORTANTE: Establecer el valor en la característica BLE
  pCharScan->setValue(scannedNetworks.c_str());
  Serial.println("✓ Redes almacenadas en característica BLE");
  
  showOLEDConfig(deviceName);
}


void initWebServer() {
  Serial.println("Inicializando servidor HTTP...");
  
  server.on("/ping", HTTP_GET, [](AsyncWebServerRequest *request){
    request->send(200, "application/json", "{\"status\":\"ok\"}");
  });
  
  server.on("/execute", HTTP_POST, [](AsyncWebServerRequest *request){}, 
    NULL, 
    [](AsyncWebServerRequest *request, uint8_t *data, size_t len, size_t index, size_t total) {
      
      JsonDocument doc;
      DeserializationError error = deserializeJson(doc, data, len);
      
      if (error) {
        request->send(400, "application/json", "{\"error\":\"JSON inválido\"}");
        return;
      }
      
      const char* code = doc["code"];
      
      if (code == nullptr) {
        request->send(400, "application/json", "{\"error\":\"Falta parámetro 'code'\"}");
        return;
      }
      
      Serial.println("Ejecutando código:");
      Serial.println(code);
      
      executeGeneratedCode(String(code));
      
      JsonDocument response;
      response["success"] = true;
      JsonArray ledArray = response["ledStates"].to<JsonArray>();
      for (int i = 0; i < 10; i++) {
        ledArray.add(led_states[i] ? 1 : 0);
      }
      
      String output;
      serializeJson(response, output);
      request->send(200, "application/json", output);
    }
  );
  
  server.on("/stop", HTTP_POST, [](AsyncWebServerRequest *request){
    Serial.println("⛔ Deteniendo ejecución y apagando LEDs...");
    stopExecution = true;
    for (int i = 0; i < 10; i++) {
      digitalWrite(LED_PINS[i], LOW);
      led_states[i] = false;
    }
    request->send(200, "application/json", "{\"success\":true,\"message\":\"Ejecución detenida\"}");
  });
  
  server.on("/reset", HTTP_POST, [](AsyncWebServerRequest *request){
    Serial.println("Reset solicitado...");
    request->send(200, "application/json", "{\"success\":true}");
    delay(1000);
    ESP.restart();
  });
  
  server.begin();
  Serial.println("✓ Servidor HTTP iniciado en puerto 80");
}


// ============================================
// FUNCIONES OLED
// ============================================


void showOLEDConfig(String deviceName) {
  display.clearDisplay();
  display.setCursor(0, 0);
  display.setTextSize(1);
  display.println("DUALNODE");
  display.println("LEDs + IA");
  display.println();
  display.println("Modo Config BLE");
  display.println();
  display.setTextSize(1);
  display.println(deviceName);
  display.display();
}


void showOLEDConnecting(String ssid) {
  display.clearDisplay();
  display.setCursor(0, 0);
  display.setTextSize(1);
  display.println("Conectando WiFi");
  display.println();
  display.println(ssid);
  display.println();
  display.println("Espera...");
  display.display();
}


void showOLEDOnline(String ip) {
  display.clearDisplay();
  display.setCursor(0, 0);
  display.setTextSize(1);
  display.println("ONLINE");
  display.setTextSize(1);
  display.println();
  display.println("LEDs + IA");
  display.println();
  display.println("IP:");
  display.println(ip);
  display.display();
}


void showOLEDError(String error) {
  display.clearDisplay();
  display.setCursor(0, 0);
  display.setTextSize(1);
  display.println("ERROR");
  display.println();
  display.println(error);
  display.display();
}


// ============================================
// FUNCIÓN: EJECUTAR CÓDIGO GENERADO
// ============================================


void executeGeneratedCode(String code) {
  stopExecution = false;
  
  Serial.println("========== INICIO EJECUCIÓN ==========");
  Serial.println("Código recibido:");
  Serial.println(code);
  Serial.println("--------------------------------------");
  
  String cleanCode = "";
  int pos = 0;
  while (pos < code.length()) {
    int commentPos = code.indexOf("//", pos);
    int newlinePos = code.indexOf("\n", pos);
    
    if (commentPos != -1 && (newlinePos == -1 || commentPos < newlinePos)) {
      cleanCode += code.substring(pos, commentPos);
      if (newlinePos != -1) {
        pos = newlinePos + 1;
      } else {
        break;
      }
    } else if (newlinePos != -1) {
      cleanCode += code.substring(pos, newlinePos + 1);
      pos = newlinePos + 1;
    } else {
      cleanCode += code.substring(pos);
      break;
    }
  }
  
  code = cleanCode;
  code.toLowerCase();
  
  Serial.println("Código limpio (sin comentarios):");
  Serial.println(code);
  Serial.println("--------------------------------------");
  
  pos = 0;
  int loopIterations = 0;
  const int MAX_ITERATIONS = 1000;
  
  while (pos < code.length() && loopIterations < MAX_ITERATIONS && !stopExecution) {
    loopIterations++;
    yield();
    
    int gpioPos = code.indexOf("gpio_set_level(", pos);
    int delayPos = code.indexOf("vtaskdelay(", pos);
    
    int nextPos = -1;
    bool isGpio = false;
    
    if (gpioPos != -1 && (delayPos == -1 || gpioPos < delayPos)) {
      nextPos = gpioPos;
      isGpio = true;
    } else if (delayPos != -1) {
      nextPos = delayPos;
      isGpio = false;
    }
    
    if (nextPos == -1) {
      break;
    }
    
    if (isGpio) {
      int startArgs = nextPos + 15;
      int endArgs = code.indexOf(")", startArgs);
      
      if (endArgs != -1) {
        String args = code.substring(startArgs, endArgs);
        args.trim();
        
        int commaPos = args.indexOf(",");
        if (commaPos != -1) {
          String pinStr = args.substring(0, commaPos);
          String stateStr = args.substring(commaPos + 1);
          
          pinStr.trim();
          stateStr.trim();
          
          int pin = pinStr.toInt();
          int state = stateStr.toInt();
          
          int ledIndex = -1;
          for (int i = 0; i < 10; i++) {
            if (LED_PINS[i] == pin) {
              ledIndex = i;
              break;
            }
          }
          
          if (ledIndex != -1) {
            digitalWrite(LED_PINS[ledIndex], state);
            led_states[ledIndex] = (state == 1);
            Serial.printf("✓ LED %d (GPIO %d) -> %s\n", ledIndex, pin, state ? "ON" : "OFF");
          } else {
            Serial.printf("⚠ GPIO %d no es un LED válido\n", pin);
          }
        }
        
        pos = endArgs + 1;
      } else {
        pos = nextPos + 15;
      }
    } else {
      int startArgs = nextPos + 11;
      int endArgs = code.indexOf(")", startArgs);
      
      if (endArgs != -1) {
        String args = code.substring(startArgs, endArgs);
        args.trim();
        
        int divPos = args.indexOf("/");
        int ms = 0;
        
        if (divPos != -1) {
          String msStr = args.substring(0, divPos);
          msStr.trim();
          ms = msStr.toInt();
        } else {
          ms = args.toInt();
        }
        
        if (ms > 0 && ms <= 5000) {
          Serial.printf("⏱ Delay %d ms\n", ms);
          int elapsed = 0;
          while (elapsed < ms && !stopExecution) {
            int chunk = min(50, ms - elapsed);
            delay(chunk);
            elapsed += chunk;
            yield();
          }
        } else if (ms > 5000) {
          Serial.printf("⚠ Delay muy largo (%d ms), limitando a 5000 ms\n", ms);
          int elapsed = 0;
          while (elapsed < 5000 && !stopExecution) {
            delay(50);
            elapsed += 50;
            yield();
          }
        }
        
        pos = endArgs + 1;
      } else {
        pos = nextPos + 11;
      }
    }
  }
  
  if (loopIterations >= MAX_ITERATIONS) {
    Serial.println("⚠ Límite de iteraciones alcanzado (posible loop infinito)");
  }
  
  if (stopExecution) {
    Serial.println("⛔ EJECUCIÓN DETENIDA POR USUARIO");
  }
  
  Serial.println("--------------------------------------");
  Serial.println("Estado final de LEDs:");
  for (int i = 0; i < 10; i++) {
    Serial.printf("  LED %d (GPIO %d): %s\n", i, LED_PINS[i], led_states[i] ? "ON" : "OFF");
  }
  Serial.println("========== FIN EJECUCIÓN ==========");
}


// ============================================
// FUNCIÓN: CONECTAR WiFi
// ============================================


bool connectWiFi(String ssid, String password) {
  Serial.println("Conectando a WiFi: " + ssid);
  showOLEDConnecting(ssid);
  
  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid.c_str(), password.c_str());
  
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500);
    Serial.print(".");
    attempts++;
  }
  Serial.println();
  
  if (WiFi.status() == WL_CONNECTED) {
    serverIP = WiFi.localIP().toString();
    Serial.println("✓ WiFi conectado");
    Serial.println("IP: " + serverIP);
    
    registerToServer();
    
    return true;
  } else {
    Serial.println("✗ WiFi falló");
    return false;
  }
}


// ============================================
// REGISTRAR EN SERVIDOR NODE.JS
// ============================================


void registerToServer() {
  uint8_t mac[6];
  esp_read_mac(mac, ESP_MAC_WIFI_STA);
  char macStr[13];
  sprintf(macStr, "%02X%02X%02X", mac[3], mac[4], mac[5]);
  
  HTTPClient http;
  
  String serverURL = "http://" + serverAddress + "/api/config/station";
  Serial.println("Registrando en: " + serverURL);
  
  http.begin(serverURL);
  http.addHeader("Content-Type", "application/json");
  
  JsonDocument doc;
  doc["mac"] = macStr;
  doc["name"] = "LEDs + IA";
  doc["type"] = "leds-ia";
  doc["ip"] = serverIP;
  
  String payload;
  serializeJson(doc, payload);
  
  int httpCode = http.POST(payload);
  
  if (httpCode > 0) {
    Serial.printf("✓ Registrado en servidor: %d\n", httpCode);
    String response = http.getString();
    Serial.println(response);
  } else {
    Serial.printf("✗ Error al registrar: %s\n", http.errorToString(httpCode).c_str());
  }
  
  http.end();
}


// ============================================
// VERIFICAR BOTÓN DE RESET
// ============================================


void checkResetButton() {
  static unsigned long pressStart = 0;
  static bool pressing = false;
  
  if (digitalRead(RESET_BUTTON) == LOW) {
    if (!pressing) {
      pressing = true;
      pressStart = millis();
      Serial.println("Botón RESET presionado");
    } else {
      if (millis() - pressStart >= RESET_HOLD_MS) {
        Serial.println("RESET ACTIVADO");
        showOLEDError("Reseteando...");
        
        for (int i = 0; i < 3; i++) {
          for (int j = 0; j < 10; j++) {
            digitalWrite(LED_PINS[j], HIGH);
          }
          delay(200);
          for (int j = 0; j < 10; j++) {
            digitalWrite(LED_PINS[j], LOW);
          }
          delay(200);
        }
        
        ESP.restart();
      }
    }
  } else {
    pressing = false;
  }
}


// ============================================
// SETUP
// ============================================


void setup() {
  Serial.begin(115200);
  delay(1000);
  
  Serial.println("\n\n");
  Serial.println("===========================================");
  Serial.println("   DUALNODE - Kit LEDs + IA (FIXED)      ");
  Serial.println("===========================================");
  
  pinMode(RESET_BUTTON, INPUT_PULLUP);
  
  initLEDs();
  initOLED();
  initBLE();
  
  Serial.println("\nSistema listo - Esperando configuración BLE");
}


// ============================================
// LOOP
// ============================================


void loop() {
  checkResetButton();
  
  switch (currentState) {
    case STATE_BLE_CONFIG:
      if (wifiConfigured) {
        currentState = STATE_WIFI_CONNECTING;
        BLEDevice::deinit();
        delay(1000);
      }
      break;
      
    case STATE_WIFI_CONNECTING:
      if (connectWiFi(receivedSSID, receivedPassword)) {
        currentState = STATE_ONLINE;
        showOLEDOnline(serverIP);
        initWebServer();
      } else {
        currentState = STATE_ERROR;
        showOLEDError("WiFi falló\nReiniciando...");
        delay(3000);
        ESP.restart();
      }
      break;
      
    case STATE_ONLINE:
      if (WiFi.status() != WL_CONNECTED) {
        Serial.println("✗ WiFi perdido");
        currentState = STATE_ERROR;
        showOLEDError("WiFi perdido\nReiniciando...");
        delay(3000);
        ESP.restart();
      }
      break;
      
    case STATE_ERROR:
      delay(1000);
      break;
  }
  
  delay(100);
}
