// ============================================
// SENSORES.JS - GRÁFICOS Y VISUALIZACIÓN
// ============================================

const Sensores = {
    stationMAC: null,
    charts: {
        temp: null,
        hum: null
    },
    
    currentData: {
        temp: 0,
        hum: 0,
        dist: 0
    },
    
    history: {
        temp: [],
        hum: [],
        labels: []
    },
    
    // ============================================
    // INICIALIZACIÓN
    // ============================================
    
    init() {
        console.log('📊 Sensores inicializado');
        
        // Encontrar kit de sensores
        this.findSensorsStation();
        
        // Inicializar gráficos
        this.initCharts();
        
        // Cargar datos históricos
        this.loadHistory();
        
        // Actualizar "hace X segundos" cada segundo
        setInterval(() => this.updateLastSeen(), 1000);
    },
    
    // ============================================
    // ENCONTRAR ESTACIÓN DE SENSORES
    // ============================================
    
    findSensorsStation() {
        if (!window.App || !window.App.state || !window.App.state.stations) {
            console.log('⚠️ App.state.stations no disponible aún');
            return;
        }
        
        const station = Array.from(window.App.state.stations.values())
            .find(s => s.type === 'sensores');
        
        if (station) {
            this.stationMAC = station.mac;
            console.log('✅ Kit Sensores encontrado:', this.stationMAC);
            
            // Cargar historial ahora que tenemos el MAC
            this.loadHistory();
        } else {
            console.log('⚠️ No se encontró kit de sensores');
        }
    },
    
    // ============================================
    // INICIALIZAR GRÁFICOS
    // ============================================
    
    initCharts() {
        // Configuración común
        const commonOptions = {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: 'rgba(26, 31, 58, 0.9)',
                    titleColor: '#e5e7eb',
                    bodyColor: '#e5e7eb',
                    borderColor: 'rgba(0, 212, 255, 0.3)',
                    borderWidth: 1,
                    padding: 12,
                    displayColors: false,
                    callbacks: {
                        title: () => '',
                        label: (context) => {
                            return context.parsed.y.toFixed(1) + (context.dataset.label === 'Temperatura' ? '°C' : '%');
                        }
                    }
                }
            },
            scales: {
                x: {
                    display: true,
                    grid: {
                        color: 'rgba(255, 255, 255, 0.05)'
                    },
                    ticks: {
                        color: '#6b7280',
                        maxTicksLimit: 6
                    }
                },
                y: {
                    display: true,
                    grid: {
                        color: 'rgba(255, 255, 255, 0.05)'
                    },
                    ticks: {
                        color: '#6b7280'
                    }
                }
            },
            animation: {
                duration: 750,
                easing: 'easeInOutQuart'
            }
        };
        
        // Gráfico de Temperatura
        const tempCanvas = document.getElementById('tempChart');
        if (tempCanvas) {
            this.charts.temp = new Chart(tempCanvas, {
                type: 'line',
                data: {
                    labels: [],
                    datasets: [{
                        label: 'Temperatura',
                        data: [],
                        borderColor: '#3b82f6',
                        backgroundColor: 'rgba(59, 130, 246, 0.1)',
                        borderWidth: 2,
                        fill: true,
                        tension: 0.4,
                        pointRadius: 3,
                        pointBackgroundColor: '#3b82f6',
                        pointBorderColor: '#fff',
                        pointBorderWidth: 2
                    }]
                },
                options: {
                    ...commonOptions,
                    scales: {
                        ...commonOptions.scales,
                        y: {
                            ...commonOptions.scales.y,
                            min: 15,
                            max: 35
                        }
                    }
                }
            });
        }
        
        // Gráfico de Humedad
        const humCanvas = document.getElementById('humChart');
        if (humCanvas) {
            this.charts.hum = new Chart(humCanvas, {
                type: 'line',
                data: {
                    labels: [],
                    datasets: [{
                        label: 'Humedad',
                        data: [],
                        borderColor: '#3b82f6',
                        backgroundColor: 'rgba(59, 130, 246, 0.1)',
                        borderWidth: 2,
                        fill: true,
                        tension: 0.4,
                        pointRadius: 3,
                        pointBackgroundColor: '#3b82f6',
                        pointBorderColor: '#fff',
                        pointBorderWidth: 2
                    }]
                },
                options: {
                    ...commonOptions,
                    scales: {
                        ...commonOptions.scales,
                        y: {
                            ...commonOptions.scales.y,
                            min: 0,
                            max: 100
                        }
                    }
                }
            });
        }
    },
    
    // ============================================
    // CARGAR HISTORIAL
    // ============================================
    
    async loadHistory() {
        if (!this.stationMAC) {
            this.findSensorsStation();
            if (!this.stationMAC) return;
        }
        
        try {
            const response = await fetch(`/api/sensors/history/${this.stationMAC}`);
            if (!response.ok) return;
            
            const data = await response.json();
            
            if (data.current) {
                this.updateData({
                    mac: this.stationMAC,
                    ...data.current,
                    stats: data.stats
                });
            }
            
            // Actualizar gráficos con historial
            if (data.history && data.history.length > 0) {
                const last24 = data.history.slice(0, 24).reverse();
                
                this.history.temp = last24.map(r => r.temp);
                this.history.hum = last24.map(r => r.hum);
                this.history.labels = last24.map(r => {
                    const date = new Date(r.timestamp);
                    return date.toLocaleTimeString('es-MX', {
                        hour: '2-digit',
                        minute: '2-digit'
                    });
                });
                
                this.updateCharts();
            }
            
        } catch (error) {
            console.error('❌ Error al cargar historial:', error);
        }
    },
    
    // ============================================
    // ACTUALIZAR DATOS (TIEMPO REAL)
    // ============================================
    
    updateData(data) {
        console.log('📊 updateData llamado con:', data);
        console.log('📊 stationMAC actual:', this.stationMAC);
        
        if (!data) {
            console.log('⚠️ No hay datos');
            return;
        }
        
        if (data.mac !== this.stationMAC) {
            console.log(`⚠️ MAC no coincide: ${data.mac} !== ${this.stationMAC}`);
            return;
        }
        
        console.log('✅ Actualizando datos:', data);
        
        // Guardar datos actuales
        this.currentData = {
            temp: data.temp,
            hum: data.hum,
            dist: data.dist,
            lastUpdate: Date.now()
        };
        
        // Actualizar timestamp "Actualizado hace X"
        this.updateLastSeen();
        
        // Verificar alertas
        this.checkAlerts(data);
        
        // Actualizar valores grandes
        this.updateValueDisplay('tempValue', data.temp, '°C');
        this.updateValueDisplay('humValue', data.hum, '%');
        this.updateValueDisplay('distValue', data.dist / 100, 'm'); // Pasar como número
        
        // Actualizar barras de progreso
        this.updateProgressBar('tempBar', data.temp, 18, 32);
        this.updateProgressBar('humBar', data.hum, 20, 80);
        
        // Actualizar visualización de radar
        this.updateRadar(data.dist);
        
        // Agregar a historial
        const now = new Date();
        const timeLabel = now.toLocaleTimeString('es-MX', {
            hour: '2-digit',
            minute: '2-digit'
        });
        
        this.history.temp.push(data.temp);
        this.history.hum.push(data.hum);
        this.history.labels.push(timeLabel);
        
        // Mantener solo últimas 24 lecturas
        if (this.history.temp.length > 24) {
            this.history.temp.shift();
            this.history.hum.shift();
            this.history.labels.shift();
        }
        
        // Actualizar gráficos
        this.updateCharts();
    },
    
    // ============================================
    // ACTUALIZAR DISPLAY DE VALOR
    // ============================================
    
    updateValueDisplay(elementId, value, unit) {
        const element = document.getElementById(elementId);
        if (!element) return;
        
        const valueSpan = element.querySelector('.value');
        const unitSpan = element.querySelector('.unit');
        
        if (valueSpan) {
            if (typeof value === 'number') {
                // Usar 2 decimales para distancia, 1 para temperatura y humedad
                const decimals = elementId === 'distValue' ? 2 : 1;
                valueSpan.textContent = value.toFixed(decimals);
            } else {
                valueSpan.textContent = '--';
            }
        }
        if (unitSpan) {
            unitSpan.textContent = unit;
        }
    },
    
    // ============================================
    // ACTUALIZAR BARRA DE PROGRESO
    // ============================================
    
    updateProgressBar(elementId, value, min, max) {
        const bar = document.getElementById(elementId);
        if (!bar) return;
        
        const percentage = ((value - min) / (max - min)) * 100;
        const clampedPercentage = Math.max(0, Math.min(100, percentage));
        
        bar.style.width = clampedPercentage + '%';
    },
    
    // ============================================
    // ACTUALIZAR VISUALIZACIÓN RADAR
    // ============================================
    
    updateRadar(distanceCm) {
        // Actualizar objeto en radar
        const radarObject = document.getElementById('radarObject');
        if (radarObject) {
            // Calcular posición (0-500cm = 0-100%)
            const maxDist = 500;
            const percentage = Math.min((distanceCm / maxDist) * 100, 100);
            
            // Posicionar objeto (de izquierda a derecha)
            radarObject.style.left = `${20 + (percentage * 0.7)}%`;
        }
        
        // Actualizar marcador en barra
        const distanceMarker = document.getElementById('distanceMarker');
        if (distanceMarker) {
            const maxDist = 500;
            const percentage = Math.min((distanceCm / maxDist) * 100, 100);
            distanceMarker.style.left = percentage + '%';
        }
        
        // Actualizar texto de estado
        const distanceStatus = document.getElementById('distanceStatus');
        if (distanceStatus) {
            const meters = (distanceCm / 100).toFixed(2);
            
            if (distanceCm < 20) {
                distanceStatus.textContent = '⚠️ Objeto muy cerca';
                distanceStatus.style.color = 'var(--accent-danger)';
            } else if (distanceCm < 100) {
                distanceStatus.textContent = `✓ Objeto detectado a ${meters}m`;
                distanceStatus.style.color = 'var(--accent-primary)';
            } else if (distanceCm > 400) {
                distanceStatus.textContent = 'Fuera de rango (>4m)';
                distanceStatus.style.color = 'var(--text-muted)';
            } else {
                distanceStatus.textContent = `Distancia: ${meters}m`;
                distanceStatus.style.color = 'var(--accent-success)';
            }
        }
    },
    
    // ============================================
    // VERIFICAR ALERTAS
    // ============================================
    
    checkAlerts(data) {
        // Umbrales de alerta
        const TEMP_MAX = 30;
        const TEMP_MIN = 15;
        const HUM_MAX = 80;
        const HUM_MIN = 20;
        const DIST_ALERT = 20; // cm
        
        // Evitar spam de notificaciones (solo cada 30 segundos)
        const now = Date.now();
        if (!this.lastAlertTime) this.lastAlertTime = {};
        
        // Temperatura alta
        if (data.temp > TEMP_MAX) {
            if (!this.lastAlertTime.tempHigh || now - this.lastAlertTime.tempHigh > 30000) {
                if (window.Notifications) {
                    window.Notifications.warning(`⚠️ Temperatura alta: ${data.temp.toFixed(1)}°C`);
                }
                this.lastAlertTime.tempHigh = now;
            }
        }
        
        // Temperatura baja
        if (data.temp < TEMP_MIN) {
            if (!this.lastAlertTime.tempLow || now - this.lastAlertTime.tempLow > 30000) {
                if (window.Notifications) {
                    window.Notifications.warning(`❄️ Temperatura baja: ${data.temp.toFixed(1)}°C`);
                }
                this.lastAlertTime.tempLow = now;
            }
        }
        
        // Humedad alta
        if (data.hum > HUM_MAX) {
            if (!this.lastAlertTime.humHigh || now - this.lastAlertTime.humHigh > 30000) {
                if (window.Notifications) {
                    window.Notifications.warning(`💧 Humedad alta: ${data.hum.toFixed(1)}%`);
                }
                this.lastAlertTime.humHigh = now;
            }
        }
        
        // Humedad baja
        if (data.hum < HUM_MIN) {
            if (!this.lastAlertTime.humLow || now - this.lastAlertTime.humLow > 30000) {
                if (window.Notifications) {
                    window.Notifications.warning(`🏜️ Humedad baja: ${data.hum.toFixed(1)}%`);
                }
                this.lastAlertTime.humLow = now;
            }
        }
        
        // Objeto cercano
        if (data.dist < DIST_ALERT && data.dist > 2) {
            if (!this.lastAlertTime.proximity || now - this.lastAlertTime.proximity > 10000) {
                if (window.Notifications) {
                    window.Notifications.info(`📍 Objeto detectado a ${data.dist.toFixed(1)}cm`);
                }
                this.lastAlertTime.proximity = now;
            }
        }
    },
    
    // ============================================
    // ACTUALIZAR "HACE X SEGUNDOS"
    // ============================================
    
    updateLastSeen() {
        const element = document.getElementById('sensorsLastSeen');
        if (!element) return;
        
        if (!this.currentData || !this.currentData.lastUpdate) {
            element.textContent = 'nunca';
            return;
        }
        
        const now = Date.now();
        const diff = Math.floor((now - this.currentData.lastUpdate) / 1000);
        
        if (diff < 5) {
            element.textContent = 'hace ' + diff + 's';
            element.style.color = 'var(--accent-success)';
        } else if (diff < 30) {
            element.textContent = 'hace ' + diff + 's';
            element.style.color = 'var(--accent-warning)';
        } else if (diff < 60) {
            element.textContent = 'hace ' + diff + 's';
            element.style.color = 'var(--accent-error)';
        } else {
            const minutes = Math.floor(diff / 60);
            element.textContent = 'hace ' + minutes + 'm';
            element.style.color = 'var(--accent-error)';
        }
    },
    
    // ============================================
    // ACTUALIZAR GRÁFICOS
    // ============================================
    
    updateCharts() {
        // Actualizar gráfico de temperatura
        if (this.charts.temp) {
            this.charts.temp.data.labels = this.history.labels;
            this.charts.temp.data.datasets[0].data = this.history.temp;
            this.charts.temp.update('none'); // Sin animación para tiempo real
        }
        
        // Actualizar gráfico de humedad
        if (this.charts.hum) {
            this.charts.hum.data.labels = this.history.labels;
            this.charts.hum.data.datasets[0].data = this.history.hum;
            this.charts.hum.update('none');
        }
    }
};

// Exponer globalmente
window.Sensores = Sensores;
