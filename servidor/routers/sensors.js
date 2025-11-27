class SensorManager {
  constructor() {
    this.data = new Map();
  }
  
  addReading(mac, reading) {
    if (!this.data.has(mac)) {
      this.data.set(mac, {
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
    
    const sensorData = this.data.get(mac);
    
    const dataPoint = {
      temp: reading.temp,
      hum: reading.hum,
      dist: reading.dist,
      timestamp: Date.now()
    };
    
    sensorData.current = dataPoint;
    sensorData.history.unshift(dataPoint);
    
    // Mantener solo últimas 100 lecturas
    if (sensorData.history.length > 100) {
      sensorData.history.splice(100);
    }
    
    // Actualizar estadísticas
    this.updateStats(mac);
    
    return sensorData;
  }
  
  updateStats(mac) {
    const sensorData = this.data.get(mac);
    if (!sensorData || sensorData.history.length === 0) return;
    
    const temps = sensorData.history.map(r => r.temp);
    const hums = sensorData.history.map(r => r.hum);
    
    sensorData.stats.tempMin = Math.min(...temps);
    sensorData.stats.tempMax = Math.max(...temps);
    sensorData.stats.humMin = Math.min(...hums);
    sensorData.stats.humMax = Math.max(...hums);
    sensorData.stats.tempAvg = temps.reduce((a, b) => a + b, 0) / temps.length;
    sensorData.stats.humAvg = hums.reduce((a, b) => a + b, 0) / hums.length;
  }
  
  getData(mac) {
    return this.data.get(mac);
  }
  
  getHistory(mac, limit = 100) {
    const sensorData = this.data.get(mac);
    if (!sensorData) return [];
    
    return sensorData.history.slice(0, limit);
  }
  
  // Formatear datos para gráficos (últimas 24 lecturas para gráfico)
  getChartData(mac) {
    const sensorData = this.data.get(mac);
    if (!sensorData || sensorData.history.length === 0) {
      return {
        labels: [],
        temp: [],
        hum: []
      };
    }
    
    const last24 = sensorData.history.slice(0, 24).reverse();
    
    return {
      labels: last24.map((r, i) => {
        const date = new Date(r.timestamp);
        return date.toLocaleTimeString('es-MX', { 
          hour: '2-digit', 
          minute: '2-digit' 
        });
      }),
      temp: last24.map(r => r.temp),
      hum: last24.map(r => r.hum)
    };
  }
}

module.exports = new SensorManager();