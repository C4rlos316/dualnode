/*
 * ============================================
 * DUALNODE - KIT SENSORES (FIXED WiFi SCAN)
 * ============================================
 * 
 * Hardware: ESP32 NodeMCU-32S
 * - DHT11: GPIO 25 (Temperatura y Humedad)
 * - HC-SR04: 
 *   - TRIG: GPIO 26
 *   - ECHO: GPIO 27
 * - OLED I2C: SDA=21, SCL=22
 * - Botón BOOT: GPIO 0 (para reset)
 * 
 * ACTUALIZACIÓN: Cada 1 segundo
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
#include <DHT.h>


// ============================================
// CONFIGURACIÓN DE HARDWARE
// ============================================


// DHT11
#define DHT_PIN 25
#define DHT_TYPE DHT11
DHT dht(DHT_PIN, DHT_TYPE);


// HC-SR04
#define TRIG_PIN 26
#define ECHO_PIN 27


// OLED
#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
#define OLED_RESET -1
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);


// Botón de reset
#define RESET_BUTTON 0
#define RESET_HOLD_MS 5000


// Variables de sensores
float temperature = 0.0;
float humidity = 0.0;
float distance = 0.0;


// Timer para envío de datos - 1 SEGUNDO
unsigned long lastSensorRead = 0;
const unsigned long SENSOR_INTERVAL = 1000;


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
void showOLEDSensorData();
void readSensors();
void sendDataToServer();
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
    
    if (uuid.indexOf(CHAR_SCAN_UUID) != -1) {
      Serial.println("BLE: Cliente solicitó redes WiFi");
      
      // Devolver redes ya escaneadas
      if (networksScanned && scannedNetworks.length() > 0) {
        pCharacteristic->setValue(scannedNetworks.c_str());
        Serial.println("BLE: Enviando " + String(scannedNetworks.length()) + " bytes de redes");
      } else {
        // Si no hay redes, devolver vacío
        pCharacteristic->setValue("");
        Serial.println("BLE: No hay redes escaneadas aún");
      }
    }
  }
};


// ============================================
// FUNCIONES DE INICIALIZACIÓN
// ============================================


void initSensors() {
  Serial.println("Inicializando sensores...");
  
  // DHT11
  dht.begin();
  Serial.println("✓ DHT11 inicializado");
  
  // HC-SR04
  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
  digitalWrite(TRIG_PIN, LOW);
  Serial.println("✓ HC-SR04 inicializado");
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
    BLECharacteristic::PROPERTY_READ
  );
  pCharScan->setCallbacks(new CharacteristicCallbacks());
  
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
  display.println("Sensores");
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
  
  showOLEDConfig(deviceName);
}


void initWebServer() {
  Serial.println("Inicializando servidor HTTP...");
  
  // Endpoint: Ping
  server.on("/ping", HTTP_GET, [](AsyncWebServerRequest *request){
    request->send(200, "application/json", "{\"status\":\"ok\"}");
  });
  
  // Endpoint: Obtener datos de sensores
  server.on("/data", HTTP_GET, [](AsyncWebServerRequest *request){
    JsonDocument doc;
    doc["temperature"] = round(temperature * 10) / 10.0;
    doc["humidity"] = round(humidity * 10) / 10.0;
    doc["distance"] = round(distance * 10) / 10.0;
    doc["timestamp"] = millis();
    
    String output;
    serializeJson(doc, output);
    
    AsyncWebServerResponse *response = request->beginResponse(200, "application/json", output);
    response->addHeader("Access-Control-Allow-Origin", "*");
    request->send(response);
    
    Serial.println("✓ Datos enviados via HTTP: " + output);
  });
  
  // Endpoint: Reset
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
  display.println("Sensores");
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
  display.println("Sensores");
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


void showOLEDSensorData() {
  display.clearDisplay();
  display.setCursor(0, 0);
  display.setTextSize(1);
  
  display.println("SENSORES [1s]");
  display.println();
  
  // Temperatura
  display.print("Temp: ");
  display.print(temperature, 1);
  display.println(" C");
  
  // Humedad
  display.print("Hum:  ");
  display.print(humidity, 1);
  display.println(" %");
  
  // Distancia
  display.print("Dist: ");
  display.print(distance, 1);
  display.println(" cm");
  
  display.display();
}


// ============================================
// LEER SENSORES
// ============================================


void readSensors() {
  // Leer DHT11
  float h = dht.readHumidity();
  float t = dht.readTemperature();
  
  if (isnan(h) || isnan(t)) {
    Serial.println("⚠ Error al leer DHT11");
  } else {
    temperature = t;
    humidity = h;
  }
  
  // Leer HC-SR04
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);
  
  long duration = pulseIn(ECHO_PIN, HIGH, 30000); // Timeout 30ms
  
  if (duration == 0) {
    Serial.println("⚠ Error al leer HC-SR04");
    distance = 500; // Valor fuera de rango
  } else {
    distance = duration * 0.034 / 2; // Convertir a cm
    
    // Limitar rango
    if (distance > 400) distance = 400;
    if (distance < 2) distance = 2;
  }
  
  Serial.printf("📊 Temp: %.1f°C | Hum: %.1f%% | Dist: %.1f cm\n", 
                temperature, humidity, distance);
}


// ============================================
// ENVIAR DATOS AL SERVIDOR
// ============================================


void sendDataToServer() {
  if (WiFi.status() != WL_CONNECTED) {
    return;
  }
  
  uint8_t mac[6];
  esp_read_mac(mac, ESP_MAC_WIFI_STA);
  char macStr[13];
  sprintf(macStr, "%02X%02X%02X", mac[3], mac[4], mac[5]);
  
  HTTPClient http;
  
  String serverURL = "http://" + serverAddress + "/api/sensors/data";
  
  http.begin(serverURL);
  http.addHeader("Content-Type", "application/json");
  http.setTimeout(5000);
  
  JsonDocument doc;
  doc["mac"] = macStr;
  doc["temp"] = round(temperature * 10) / 10.0; // 1 decimal
  doc["hum"] = round(humidity * 10) / 10.0;
  doc["dist"] = round(distance * 10) / 10.0;
  
  String payload;
  serializeJson(doc, payload);
  
  int httpCode = http.POST(payload);
  
  if (httpCode == 200) {
    Serial.println("✓ Datos enviados al servidor");
  } else {
    Serial.printf("✗ Error al enviar datos: %d\n", httpCode);
  }
  
  http.end();
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
  doc["name"] = "Sensores";
  doc["type"] = "sensores";
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
        delay(1000);
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
  Serial.println("  DUALNODE - Kit Sensores (FIXED)        ");
  Serial.println("===========================================");
  
  pinMode(RESET_BUTTON, INPUT_PULLUP);
  
  initSensors();
  initOLED();
  initBLE();
  
  Serial.println("\nSistema listo - Esperando configuración BLE");
  Serial.println("⚡ Intervalo de actualización: 1 SEGUNDO");
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
      // ⚡ Leer sensores cada 1 SEGUNDO
      if (millis() - lastSensorRead >= SENSOR_INTERVAL) {
        readSensors();
        showOLEDSensorData();
        sendDataToServer();
        lastSensorRead = millis();
      }
      
      // Verificar conexión WiFi
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
