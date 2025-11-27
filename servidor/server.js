const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const Groq = require('groq-sdk');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Configuración
const PORT = process.env.PORT || 3000;
const MAX_STATIONS = 2;

// Inicializar Groq
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

// Modelo Groq (puede configurarse vía .env como GROQ_MODEL)
// Cambio: usar por defecto una variante instant/ligera recomendada en lugar de modelos de mayor tamaño
const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.1-8b-instant';

if (!process.env.GROQ_API_KEY) {
  console.warn('⚠️ GROQ_API_KEY no está configurada. Las llamadas a la IA fallarán. Configure .env con GROQ_API_KEY');
}
console.log(`🤖 Modelo Groq seleccionado: ${GROQ_MODEL}`);

// ==========================================
// ALMACENAMIENTO EN MEMORIA (NO BASE DE DATOS)
// ==========================================

// Estaciones configuradas (máximo 2)
const stations = new Map();
// Key: MAC address (últimos 6 dígitos)
// Value: {mac, name, type, ip, status, lastSeen, pins}

// Datos de sensores (últimas 100 lecturas)
const sensorData = new Map();
// Key: MAC address
// Value: {current: {...}, history: [...], stats: {...}}

// Historial de comandos LEDs
const commandHistory = new Map();
// Key: MAC address
// Value: [{prompt, code, timestamp, status}]

// ==========================================
// RUTAS API
// ==========================================

// 🏠 Página principal
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

// 📊 Obtener lista de estaciones
app.get('/api/stations', (req, res) => {
  const stationsList = Array.from(stations.values());
  res.json({
    count: stationsList.length,
    maxStations: MAX_STATIONS,
    stations: stationsList
  });
});

// 🔧 Configurar nueva estación (desde BLE)
app.post('/api/config/station', (req, res) => {
  const { mac, name, type, ip } = req.body;
  
  // Validar que no exceda límite
  if (stations.size >= MAX_STATIONS) {
    // Verificar si ya existe esta MAC
    if (!stations.has(mac)) {
      return res.status(400).json({
        error: 'MAX_STATIONS_REACHED',
        message: `Solo se permiten ${MAX_STATIONS} estaciones`
      });
    }
  }
  
  // Validar tipo
  if (!['leds-ia', 'sensores'].includes(type)) {
    return res.status(400).json({
      error: 'INVALID_TYPE',
      message: 'Tipo debe ser "leds-ia" o "sensores"'
    });
  }
  
  // Verificar que no haya duplicado de tipo
  const existingType = Array.from(stations.values()).find(s => s.type === type && s.mac !== mac);
  if (existingType) {
    // Si ya existe una estación del mismo tipo, removerla primero
    console.log(`⚠️ Reemplazando estación ${existingType.name} (${existingType.mac}) con nueva estación`);
    stations.delete(existingType.mac);
    io.emit('station-removed', { mac: existingType.mac });
  }
  
  // Guardar estación
  const station = {
    mac,
    name: name || (type === 'leds-ia' ? 'LEDs + IA' : 'Sensores'),
    type,
    ip,
    status: 'online',
    lastSeen: Date.now(),
    configuredAt: Date.now()
  };
  
  stations.set(mac, station);
  
  // Notificar a clientes web
  io.emit('station-online', station);
  
  console.log(`✅ Estación configurada: ${station.name} (${mac}) - ${ip}`);
  
  res.json({
    success: true,
    station
  });
});

// 🤖 Generar código con IA para LEDs
app.post('/api/ai/generate-led-code', async (req, res) => {
  const { prompt, stationMAC } = req.body;
  
  if (!prompt || !stationMAC) {
    return res.status(400).json({
      error: 'MISSING_PARAMS',
      message: 'Se requiere prompt y stationMAC'
    });
  }
  
  // Verificar que la estación existe
  const station = stations.get(stationMAC);
  if (!station || station.type !== 'leds-ia') {
    return res.status(404).json({
      error: 'STATION_NOT_FOUND',
      message: 'Estación de LEDs no encontrada'
    });
  }
  
  try {
    console.log(`🤖 Generando código para: "${prompt}"`);
    
    // Llamar a Groq API
    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content: `Eres un experto en programación de microcontroladores ESP32 con Arduino.

HARDWARE DISPONIBLE:
- ESP32 NodeMCU-32S con 10 LEDs de colores conectados:
- GPIO 4:  LED 0 - VERDE
- GPIO 5:  LED 1 - AMARILLO
- GPIO 12: LED 2 - ROJO
- GPIO 13: LED 3 - AZUL
- GPIO 14: LED 4 - ANARANJADO
- GPIO 15: LED 5 - ANARANJADO
- GPIO 16: LED 6 - AZUL
- GPIO 17: LED 7 - ROJO
- GPIO 18: LED 8 - AMARILLO
- GPIO 19: LED 9 - VERDE

INSTRUCCIONES CRÍTICAS:
1. Usa SOLO llamadas directas a gpio_set_level(PIN, ESTADO)
2. NO uses arrays, variables, ni loops for/while
3. Escribe cada gpio_set_level() en una línea separada con el número de GPIO directo
4. Usa vTaskDelay(ms / portTICK_PERIOD_MS) para delays
5. NO uses includes, setup o loop
6. Solo código ejecutable directo
7. Máximo 30 líneas de código
8. IMPORTANTE: Solo usa los GPIOs: 4, 5, 12, 13, 14, 15, 16, 17, 18, 19
9. CRÍTICO: Los efectos deben ser CORTOS (máximo 3 segundos totales)
10. CRÍTICO: Delays individuales máximo 500ms
11. Para efectos de ola, haz solo 1-2 ciclos, NO loops infinitos

EJEMPLO CORRECTO:
Usuario: "Enciende todos los LEDs"
Código:
// Encender todos los LEDs
gpio_set_level(4, 1);
gpio_set_level(5, 1);
gpio_set_level(12, 1);
gpio_set_level(13, 1);
gpio_set_level(14, 1);
gpio_set_level(15, 1);
gpio_set_level(16, 1);
gpio_set_level(17, 1);
gpio_set_level(18, 1);
gpio_set_level(19, 1);

EJEMPLO EFECTO DE OLA (1 ciclo de izquierda a derecha):
// Efecto de ola
gpio_set_level(4, 1);
vTaskDelay(100 / portTICK_PERIOD_MS);
gpio_set_level(4, 0);
gpio_set_level(5, 1);
vTaskDelay(100 / portTICK_PERIOD_MS);
gpio_set_level(5, 0);
gpio_set_level(12, 1);
vTaskDelay(100 / portTICK_PERIOD_MS);
gpio_set_level(12, 0);
gpio_set_level(13, 1);
vTaskDelay(100 / portTICK_PERIOD_MS);
gpio_set_level(13, 0);

EJEMPLOS DE COMANDOS POR COLOR:
Usuario: "Enciende los LEDs verdes"
Código:
// Encender LEDs verdes (GPIO 4 y 19)
gpio_set_level(4, 1);
gpio_set_level(19, 1);

Usuario: "Enciende los LEDs rojos"
Código:
// Encender LEDs rojos (GPIO 12 y 17)
gpio_set_level(12, 1);
gpio_set_level(17, 1);

Usuario: "Parpadea los LEDs azules"
Código:
// Parpadear LEDs azules (GPIO 13 y 16)
gpio_set_level(13, 1);
gpio_set_level(16, 1);
vTaskDelay(200 / portTICK_PERIOD_MS);
gpio_set_level(13, 0);
gpio_set_level(16, 0);
vTaskDelay(200 / portTICK_PERIOD_MS);
gpio_set_level(13, 1);
gpio_set_level(16, 1);
vTaskDelay(200 / portTICK_PERIOD_MS);
gpio_set_level(13, 0);
gpio_set_level(16, 0);

EJEMPLO INCORRECTO (NO HAGAS ESTO):
int leds[] = {4, 5, 12};
for(int i = 0; i < 3; i++) {
    gpio_set_level(leds[i], 1);
}

Ahora genera código para: "${prompt}"`
        },
        {
          role: "user",
          content: prompt
        }
      ],
      model: GROQ_MODEL,
      temperature: 0.3,
      max_tokens: 1000
    });
    
    const generatedCode = completion.choices[0].message.content;
    
    console.log(`✅ Código generado (${generatedCode.length} chars)`);
    
    // Guardar en historial
    if (!commandHistory.has(stationMAC)) {
      commandHistory.set(stationMAC, []);
    }
    
    const command = {
      id: Date.now(),
      prompt,
      code: generatedCode,
      timestamp: Date.now(),
      status: 'generated'
    };
    
    const history = commandHistory.get(stationMAC);
    history.unshift(command);
    
    // Mantener solo últimos 50
    if (history.length > 50) {
      history.splice(50);
    }
    
    res.json({
      success: true,
      code: generatedCode,
      command
    });
    
  } catch (error) {
    // Mostrar error completo en consola para diagnóstico
    console.error('❌ Error al generar código:', error);

    // Groq SDK incluye status y estructura de error en `error`.
    const status = error && error.status ? error.status : 500;
    const detailedMessage = (error && error.error && error.error.error && error.error.error.message)
      || error.message || String(error);

    // Mensaje adicional si el modelo fue decommissioned
    if (error && error.error && error.error.error && error.error.error.code === 'model_decommissioned') {
      console.error('🔁 El modelo configurado ha sido decommissioned. Actualiza la variable de entorno GROQ_MODEL con un modelo soportado.');
    }

    res.status(status).json({
      error: 'AI_ERROR',
      message: 'Error al generar código con IA',
      details: detailedMessage
    });
  }
});

// ⚡ Ejecutar código en ESP32
app.post('/api/led/execute', async (req, res) => {
  const { stationMAC, code, commandId } = req.body;
  
  const station = stations.get(stationMAC);
  if (!station) {
    return res.status(404).json({
      error: 'STATION_NOT_FOUND'
    });
  }
  
  try {
    // Enviar código a ESP32 vía HTTP
    const fetch = (await import('node-fetch')).default;
    const url = `http://${station.ip}/execute`;
    
    console.log(`📤 Enviando código a ESP32: ${url}`);
    console.log(`📝 Código a ejecutar:\n${code}`);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ code }),
      timeout: 5000
    });
    
    console.log(`📥 Respuesta ESP32: ${response.status} ${response.statusText}`);
    
    if (!response.ok) {
      throw new Error(`ESP32 respondió: ${response.status}`);
    }
    
    const result = await response.json();
    console.log(`📊 Resultado ESP32:`, result);
    
    // Actualizar historial
    if (commandId) {
      const history = commandHistory.get(stationMAC);
      const cmd = history.find(c => c.id === commandId);
      if (cmd) {
        cmd.status = 'executed';
        cmd.executedAt = Date.now();
      }
    }
    
    // Notificar a clientes
    io.emit('led-executed', {
      stationMAC,
      commandId,
      result
    });
    
    console.log(`✅ Código ejecutado en ${station.name}`);
    
    res.json({
      success: true,
      result
    });
    
  } catch (error) {
    console.error('❌ Error al ejecutar código:', error);
    console.error('❌ Detalles del error:', error.message);
    
    // Actualizar historial con error
    if (commandId) {
      const history = commandHistory.get(stationMAC);
      const cmd = history.find(c => c.id === commandId);
      if (cmd) {
        cmd.status = 'error';
        cmd.error = error.message;
      }
    }
    
    res.status(500).json({
      error: 'EXECUTION_ERROR',
      message: error.message
    });
  }
});

// 🛑 Detener ejecución
app.post('/api/led/stop', async (req, res) => {
  const { stationMAC } = req.body;
  
  const station = stations.get(stationMAC);
  if (!station) {
    return res.status(404).json({ error: 'STATION_NOT_FOUND' });
  }
  
  try {
    const fetch = (await import('node-fetch')).default;
    await fetch(`http://${station.ip}/stop`, {
      method: 'POST',
      timeout: 3000
    });
    
    io.emit('led-stopped', { stationMAC });
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 📊 Recibir datos de sensores
app.post('/api/sensors/data', (req, res) => {
  const { mac, temp, hum, dist } = req.body;
  
  console.log(`📊 Datos recibidos de sensores - MAC: ${mac}, Temp: ${temp}°C, Hum: ${hum}%, Dist: ${dist}cm`);
  
  const station = stations.get(mac);
  if (!station) {
    console.log(`❌ Estación no encontrada para MAC: ${mac}`);
    console.log(`📋 Estaciones registradas:`, Array.from(stations.keys()));
    return res.status(404).json({ error: 'STATION_NOT_FOUND' });
  }
  
  // Actualizar última vez visto
  station.lastSeen = Date.now();
  station.status = 'online';
  
  // Guardar datos
  if (!sensorData.has(mac)) {
    sensorData.set(mac, {
      current: {},
      history: [],
      stats: {
        tempMin: Infinity,
        tempMax: -Infinity,
        humMin: Infinity,
        humMax: -Infinity
      }
    });
  }
  
  const data = sensorData.get(mac);
  
  const reading = {
    temp,
    hum,
    dist,
    timestamp: Date.now()
  };
  
  data.current = reading;
  data.history.unshift(reading);
  
  // Mantener solo últimas 100 lecturas (últimos ~3 minutos)
  if (data.history.length > 100) {
    data.history.splice(100);
  }
  
  // Actualizar estadísticas
  data.stats.tempMin = Math.min(data.stats.tempMin, temp);
  data.stats.tempMax = Math.max(data.stats.tempMax, temp);
  data.stats.humMin = Math.min(data.stats.humMin, hum);
  data.stats.humMax = Math.max(data.stats.humMax, hum);
  
  // Calcular promedios de últimas 24h (si hay suficientes datos)
  if (data.history.length > 10) {
    const temps = data.history.slice(0, 100).map(r => r.temp);
    const hums = data.history.slice(0, 100).map(r => r.hum);
    data.stats.tempAvg = temps.reduce((a, b) => a + b, 0) / temps.length;
    data.stats.humAvg = hums.reduce((a, b) => a + b, 0) / hums.length;
  }
  
  // Enviar a clientes en tiempo real
  const updatePayload = {
    mac,
    ...reading,
    stats: data.stats
  };
  
  console.log(`📡 Emitiendo sensor-update por WebSocket:`, updatePayload);
  io.emit('sensor-update', updatePayload);
  
  res.json({ success: true });
});

// 📈 Obtener datos históricos de sensores
app.get('/api/sensors/history/:mac', (req, res) => {
  const { mac } = req.params;
  const data = sensorData.get(mac);
  
  if (!data) {
    return res.status(404).json({ error: 'NO_DATA' });
  }
  
  res.json({
    current: data.current,
    history: data.history,
    stats: data.stats
  });
});

// 🔄 Resetear estación (enviar comando a ESP32)
app.post('/api/station/reset', async (req, res) => {
  const { mac } = req.body;
  
  const station = stations.get(mac);
  if (!station) {
    return res.status(404).json({ error: 'STATION_NOT_FOUND' });
  }
  
  try {
    const fetch = (await import('node-fetch')).default;
    await fetch(`http://${station.ip}/reset`, {
      method: 'POST',
      timeout: 3000
    });
    
    // Marcar como offline
    station.status = 'resetting';
    
    // Remover después de 5 segundos (tiempo de reinicio)
    setTimeout(() => {
      stations.delete(mac);
      io.emit('station-removed', { mac });
      console.log(`🔄 Estación ${station.name} reseteada y removida`);
    }, 5000);
    
    res.json({ success: true, message: 'Estación reiniciando...' });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 📜 Obtener historial de comandos
app.get('/api/led/history/:mac', (req, res) => {
  const { mac } = req.params;
  const history = commandHistory.get(mac) || [];
  res.json({ history });
});

// ==========================================
// WEBSOCKET (TIEMPO REAL)
// ==========================================

io.on('connection', (socket) => {
  console.log(`🔌 Cliente conectado: ${socket.id}`);
  
  // Enviar estado actual
  socket.emit('stations-list', {
    stations: Array.from(stations.values())
  });
  
  socket.on('disconnect', () => {
    console.log(`🔌 Cliente desconectado: ${socket.id}`);
  });
  
  // Ping para verificar estaciones online
  socket.on('ping-stations', async () => {
    const fetch = (await import('node-fetch')).default;
    
    for (const [mac, station] of stations) {
      try {
        const response = await fetch(`http://${station.ip}/ping`, {
          timeout: 2000
        });
        
        if (response.ok) {
          station.status = 'online';
          station.lastSeen = Date.now();
        } else {
          station.status = 'offline';
        }
      } catch (error) {
        station.status = 'offline';
      }
    }
    
    socket.emit('stations-status', {
      stations: Array.from(stations.values())
    });
  });
});

// ==========================================
// INICIAR SERVIDOR
// ==========================================

server.listen(PORT, () => {
  console.log('');
  console.log('╔════════════════════════════════════════╗');
  console.log('║                                        ║');
  console.log('║        ⚡ DUALNODE SERVER ⚡           ║');
  console.log('║                                        ║');
  console.log('╚════════════════════════════════════════╝');
  console.log('');
  console.log(`🌐 Servidor corriendo en: http://localhost:${PORT}`);
  console.log(`🤖 IA (Groq) configurada`);
  console.log(`📊 Máximo de estaciones: ${MAX_STATIONS}`);
  console.log('');
  console.log('💡 Abre tu navegador en: http://localhost:3000');
  console.log('');
});

// Monitorear estaciones offline cada 30 segundos
setInterval(() => {
  const now = Date.now();
  const OFFLINE_THRESHOLD = 10000; // 10 segundos sin reportar
  
  for (const [mac, station] of stations) {
    if (now - station.lastSeen > OFFLINE_THRESHOLD) {
      if (station.status === 'online') {
        station.status = 'offline';
        io.emit('station-offline', { mac, station });
        console.log(`⚠️ Estación offline: ${station.name}`);
      }
    }
  }
}, 30000);