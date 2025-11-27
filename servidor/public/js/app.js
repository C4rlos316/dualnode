// ============================================
// APP.JS - LÓGICA PRINCIPAL
// ============================================

// Estado global de la aplicación
const AppState = {
    socket: null,
    stations: new Map(),
    isConnected: false,
    configModalOpen: false
};

// ============================================
// INICIALIZACIÓN
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 DualNode iniciando...');
    
    try {
        // Inicializar sistema de manejo de errores
        if (window.ErrorHandler) {
            window.ErrorHandler.init();
        }
        
        // Inicializar sistema de notificaciones
        if (window.Notifications) {
            window.Notifications.init();
        }
        
        // Inicializar Socket.io
        initSocket();
        
        // Configurar event listeners
        setupEventListeners();
        
        // Cargar kits
        loadStations();
        
        // Inicializar módulos
        if (window.BLEConfig) {
            window.BLEConfig.init();
        }
        if (window.LedsIA) {
            window.LedsIA.init();
        }
        if (window.Sensores) {
            window.Sensores.init();
        }
        
        console.log('✅ DualNode iniciado correctamente');
        
    } catch (error) {
        console.error('❌ Error al iniciar DualNode:', error);
        if (window.ErrorHandler) {
            window.ErrorHandler.logError('Initialization Error', error.message, { error });
        }
        alert('Error al iniciar la aplicación. Por favor recarga la página.');
    }
});

// ============================================
// SOCKET.IO
// ============================================

function initSocket() {
    AppState.socket = io();
    
    AppState.socket.on('connect', () => {
        console.log('✅ Conectado al servidor');
        AppState.isConnected = true;
        updateServerStatus(true);
        showToast('Conectado al servidor', 'success');
        
        // Notificación
        if (window.Notifications) {
            window.Notifications.success('Conectado al servidor');
        }
    });
    
    AppState.socket.on('disconnect', () => {
        console.log('❌ Desconectado del servidor');
        AppState.isConnected = false;
        updateServerStatus(false);
        showToast('Desconectado del servidor', 'error');
        
        // Notificación
        if (window.Notifications) {
            window.Notifications.error('Desconectado del servidor');
        }
    });
    
    // Recibir lista de kits
    AppState.socket.on('stations-list', (data) => {
        console.log('📊 Kits recibidos:', data.stations);
        data.stations.forEach(station => {
            AppState.stations.set(station.mac, station);
        });
        updateUI();
        
        // Notificar al módulo de sensores que hay kits disponibles
        if (window.Sensores && window.Sensores.findSensorsStation) {
            window.Sensores.findSensorsStation();
        }
    });
    
    // Kit online
    AppState.socket.on('station-online', (station) => {
        console.log('✅ Kit online:', station.name);
        AppState.stations.set(station.mac, station);
        updateUI();
        showToast(`${station.name} está online`, 'success');
        
        // Notificación
        if (window.Notifications) {
            window.Notifications.success(`${station.name} conectada`);
        }
        
        // Si es kit de sensores, actualizar referencia
        if (station.type === 'sensores' && window.Sensores && window.Sensores.findSensorsStation) {
            window.Sensores.findSensorsStation();
        }
    });
    
    // Kit offline
    AppState.socket.on('station-offline', (data) => {
        console.log('⚠️ Kit offline:', data.mac);
        const station = AppState.stations.get(data.mac);
        if (station) {
            station.status = 'offline';
            updateUI();
            showToast(`${station.name} está offline`, 'warning');
            
            // Notificación
            if (window.Notifications) {
                window.Notifications.warning(`${station.name} desconectada`);
            }
        }
    });
    
    // Kit removido
    AppState.socket.on('station-removed', (data) => {
        console.log('🗑️ Kit removido:', data.mac);
        AppState.stations.delete(data.mac);
        updateUI();
    });
    
    // Actualización de sensores
    AppState.socket.on('sensor-update', (data) => {
        if (window.Sensores && window.Sensores.updateData) {
            window.Sensores.updateData(data);
        }
    });
    
    // LED ejecutado
    AppState.socket.on('led-executed', (data) => {
        if (window.LedsIA && window.LedsIA.onExecuted) {
            window.LedsIA.onExecuted(data);
        }
    });
    
    // LED detenido
    AppState.socket.on('led-stopped', (data) => {
        if (window.LedsIA && window.LedsIA.onStopped) {
            window.LedsIA.onStopped(data);
        }
    });
}

// ============================================
// EVENT LISTENERS
// ============================================

function setupEventListeners() {
    // Botón configurar (primera vez)
    const btnConfigureFirst = document.getElementById('btnConfigureFirst');
    if (btnConfigureFirst) {
        btnConfigureFirst.addEventListener('click', openConfigModal);
    }
    
    // FAB configurar
    const fabConfigure = document.getElementById('fabConfigure');
    if (fabConfigure) {
        fabConfigure.addEventListener('click', openConfigModal);
    }
    
    // Botón configurar header
    const btnSettings = document.getElementById('btnSettings');
    if (btnSettings) {
        btnSettings.addEventListener('click', openConfigModal);
    }
    
    // Modal overlay y close
    const modalOverlay = document.getElementById('modalOverlay');
    const modalClose = document.getElementById('modalClose');
    
    if (modalOverlay) {
        modalOverlay.addEventListener('click', () => {
            if (confirm('¿Cerrar configuración?\n\nSe perderá el progreso actual.')) {
                closeConfigModal();
            }
        });
    }
    if (modalClose) {
        modalClose.addEventListener('click', () => {
            if (confirm('¿Cerrar configuración?\n\nSe perderá el progreso actual.')) {
                closeConfigModal();
            }
        });
    }
    
    // Resetear kits
    const btnResetLeds = document.getElementById('btnResetLeds');
    const btnResetSensors = document.getElementById('btnResetSensors');
    
    if (btnResetLeds) {
        btnResetLeds.addEventListener('click', () => resetStation('leds-ia'));
    }
    if (btnResetSensors) {
        btnResetSensors.addEventListener('click', () => resetStation('sensores'));
    }
    
    // Exportar datos
    const btnExportData = document.getElementById('btnExportData');
    if (btnExportData) {
        btnExportData.addEventListener('click', exportSensorData);
    }
    
    // Botones de navegación del modal
    const btnFinish = document.getElementById('btnFinish');
    if (btnFinish) {
        btnFinish.addEventListener('click', closeConfigModal);
    }
    
    // Ping periódico a kits
    setInterval(() => {
        if (AppState.isConnected && AppState.stations.size > 0) {
            AppState.socket.emit('ping-stations');
        }
    }, 10000); // Cada 10 segundos
}

// ============================================
// CARGAR ESTACIONES
// ============================================

async function loadStations() {
    try {
        const response = await fetch('/api/stations');
        const data = await response.json();
        
        console.log('📊 Kits cargados:', data.stations);
        
        data.stations.forEach(station => {
            AppState.stations.set(station.mac, station);
        });
        
        updateUI();
        
        // Notificar al módulo de sensores
        if (window.Sensores && window.Sensores.findSensorsStation) {
            window.Sensores.findSensorsStation();
        }
    } catch (error) {
        console.error('❌ Error al cargar kits:', error);
        showToast('Error al cargar kits', 'error');
    }
}

// ============================================
// ACTUALIZAR UI
// ============================================

function updateUI() {
    const stationCount = AppState.stations.size;
    
    console.log('🔄 updateUI llamado - Kits:', stationCount);
    console.log('📋 Kits registrados:', Array.from(AppState.stations.values()).map(s => `${s.name} (${s.type})`));
    
    const emptyState = document.getElementById('emptyState');
    const stationsGrid = document.getElementById('stationsGrid');
    const fabConfigure = document.getElementById('fabConfigure');
    
    // Primero ocultar todas las tarjetas
    const stationLeds = document.getElementById('stationLeds');
    const stationSensors = document.getElementById('stationSensors');
    if (stationLeds) {
        stationLeds.style.display = 'none';
        console.log('🔒 Ocultando tarjeta LEDs');
    }
    if (stationSensors) {
        stationSensors.style.display = 'none';
        console.log('🔒 Ocultando tarjeta Sensores');
    }
    
    if (stationCount === 0) {
        // No hay kits
        console.log('❌ No hay kits - Mostrando estado vacío');
        if (emptyState) emptyState.style.display = 'block';
        if (stationsGrid) stationsGrid.style.display = 'none';
        if (fabConfigure) fabConfigure.style.display = 'none';
    } else {
        // Hay kits
        console.log('✅ Hay kits - Mostrando grid');
        if (emptyState) emptyState.style.display = 'none';
        if (stationsGrid) stationsGrid.style.display = 'grid';
        // Siempre mostrar botón de configurar para poder agregar/cambiar kits
        if (fabConfigure) fabConfigure.style.display = 'flex';
        
        // Actualizar cada kit (esto mostrará solo los que existen)
        AppState.stations.forEach(station => {
            console.log(`🔓 Mostrando tarjeta: ${station.name} (${station.type})`);
            updateStationCard(station);
        });
    }
}

function updateStationCard(station) {
    const isLeds = station.type === 'leds-ia';
    const cardId = isLeds ? 'stationLeds' : 'stationSensors';
    const card = document.getElementById(cardId);
    
    if (!card) return;
    
    console.log(`🔄 Actualizando tarjeta: ${station.name} (${station.type}) - Estado: ${station.status}`);
    
    // Mostrar card
    card.style.display = 'block';
    
    // Actualizar status
    const statusEl = document.getElementById(isLeds ? 'ledsStatus' : 'sensorsStatus');
    const ipEl = document.getElementById(isLeds ? 'ledsIP' : 'sensorsIP');
    const lastSeenEl = document.getElementById(isLeds ? 'ledsLastSeen' : 'sensorsLastSeen');
    
    if (statusEl) {
        const dot = statusEl.querySelector('.status-dot');
        const text = statusEl.querySelector('span:last-child');
        
        if (station.status === 'online') {
            dot.classList.remove('offline');
            dot.classList.add('online');
            text.textContent = 'Online';
        } else {
            dot.classList.remove('online');
            dot.classList.add('offline');
            text.textContent = 'Offline';
        }
    }
    
    if (ipEl) {
        ipEl.textContent = station.ip || '---';
    }
    
    if (lastSeenEl) {
        lastSeenEl.textContent = station.lastSeen 
            ? getTimeAgo(station.lastSeen) 
            : 'nunca';
    }
    
    // Habilitar/deshabilitar botones según el estado de la estación
    const btnReset = document.getElementById(isLeds ? 'btnResetLeds' : 'btnResetSensors');
    if (btnReset) {
        const shouldEnable = station.status === 'online';
        btnReset.disabled = !shouldEnable;
        console.log(`  🔘 Botón Reset ${isLeds ? 'LEDs' : 'Sensores'}: ${shouldEnable ? 'HABILITADO' : 'DESHABILITADO'}`);
    }
    
    // Solo actualizar controles de LEDs si esta estación ES de LEDs
    if (isLeds && station.type === 'leds-ia') {
        const chatInput = document.getElementById('chatInput');
        const btnSend = document.getElementById('btnSendChat');
        const btnStop = document.getElementById('btnStopLeds');
        
        const shouldEnable = station.status === 'online';
        
        if (chatInput) {
            chatInput.disabled = !shouldEnable;
            console.log(`  ⌨️ Chat Input: ${shouldEnable ? 'HABILITADO' : 'DESHABILITADO'}`);
        }
        if (btnSend) {
            btnSend.disabled = !shouldEnable;
            console.log(`  📤 Botón Enviar: ${shouldEnable ? 'HABILITADO' : 'DESHABILITADO'}`);
        }
        if (btnStop) {
            btnStop.disabled = !shouldEnable;
            console.log(`  ⏹️ Botón Detener: ${shouldEnable ? 'HABILITADO' : 'DESHABILITADO'}`);
        }
    }
    
    // Solo actualizar controles de Sensores si esta estación ES de Sensores
    if (!isLeds && station.type === 'sensores') {
        const btnExport = document.getElementById('btnExportData');
        
        const shouldEnable = station.status === 'online';
        
        if (btnExport) {
            btnExport.disabled = !shouldEnable;
            console.log(`  📥 Botón Exportar: ${shouldEnable ? 'HABILITADO' : 'DESHABILITADO'}`);
        }
    }
}

// ============================================
// MODAL DE CONFIGURACIÓN
// ============================================

function openConfigModal() {
    const modal = document.getElementById('configModal');
    if (modal) {
        modal.classList.add('active');
        AppState.configModalOpen = true;
        
        // Resetear estado de BLE ANTES de mostrar el modal
        if (window.BLEConfig && window.BLEConfig.resetState) {
            window.BLEConfig.resetState();
        }
        
        // Resetear pasos
        resetConfigSteps();
    }
}

function closeConfigModal() {
    const modal = document.getElementById('configModal');
    if (modal) {
        modal.classList.remove('active');
        AppState.configModalOpen = false;
        
        // Resetear pasos
        resetConfigSteps();
        
        // Resetear estado de BLE
        if (window.BLEConfig && window.BLEConfig.resetState) {
            window.BLEConfig.resetState();
        }
    }
}

function resetConfigSteps() {
    // Ocultar todos los pasos
    document.querySelectorAll('.config-step').forEach(step => {
        step.classList.remove('active');
        step.style.display = 'none';
    });
    
    // Mostrar paso 1
    const step1 = document.getElementById('step1');
    if (step1) {
        step1.classList.add('active');
        step1.style.display = 'block';
    }
    
    // Limpiar listas
    const devicesList = document.getElementById('devicesList');
    if (devicesList) {
        devicesList.style.display = 'none';
        devicesList.innerHTML = '<h4>Dispositivos encontrados:</h4>';
    }
}

function goToStep(stepNumber) {
    // Ocultar todos
    document.querySelectorAll('.config-step').forEach(step => {
        step.classList.remove('active');
        step.style.display = 'none';
    });
    
    // Mostrar el solicitado
    const step = document.getElementById(`step${stepNumber}`);
    if (step) {
        step.classList.add('active');
        step.style.display = 'block';
    }
}

// ============================================
// RESETEAR ESTACIÓN
// ============================================

async function resetStation(type) {
    try {
        // Validar conexión
        if (window.ErrorHandler && !window.ErrorHandler.validateConnection()) {
            return;
        }
        
        // Validar kit (con fallback si no hay ErrorHandler)
        let station;
        if (window.ErrorHandler) {
            station = window.ErrorHandler.validateStation(type);
            if (!station) {
                return;
            }
        } else {
            // Fallback: validación manual
            if (!AppState.isConnected) {
                showToast('No hay conexión con el servidor', 'error');
                return;
            }
            
            station = Array.from(AppState.stations.values()).find(s => s.type === type);
            if (!station) {
                showToast('Kit no encontrado', 'error');
                return;
            }
            
            if (station.status !== 'online') {
                showToast('El kit está desconectado', 'warning');
                return;
            }
        }
        
        const stationName = type === 'leds-ia' ? 'LEDs + IA' : 'Sensores';
        
        if (!confirm(`¿Estás seguro de resetear ${stationName}?\n\nDeberás volver a configurarla.`)) {
            return;
        }
        
        showToast(`Reseteando ${stationName}...`, 'info');
        
        // Notificación
        if (window.Notifications) {
            window.Notifications.info(`🔄 Reseteando ${stationName}...`);
        }
        
        // Enviar comando de reset
        const response = await fetch('/api/station/reset', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ mac: station.mac })
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || 'Error al resetear kit');
        }
        
        showToast(`${stationName} reseteada correctamente`, 'success');
        
        // Notificación
        if (window.Notifications) {
            window.Notifications.success(`✅ ${stationName} reseteada`);
        }
        
        // Cerrar modal de configuración si está abierto
        closeConfigModal();
        
        // Remover de UI después de 5 segundos
        setTimeout(() => {
            AppState.stations.delete(station.mac);
            updateUI();
            
            // Notificación de que debe reconfigurar
            if (window.Notifications) {
                window.Notifications.warning(`⚙️ Debes reconfigurar ${stationName}`);
            }
        }, 5000);
        
    } catch (error) {
        console.error('❌ Error al resetear:', error);
        
        if (window.ErrorHandler) {
            window.ErrorHandler.logError('Reset Error', error.message, { type, error });
        }
        
        showToast('Error al resetear kit. Intenta de nuevo.', 'error');
    }
}

// ============================================
// EXPORTAR DATOS
// ============================================

async function exportSensorData() {
    try {
        // Validar conexión
        if (!window.ErrorHandler.validateConnection()) {
            return;
        }
        
        // Validar kit
        const station = window.ErrorHandler.validateStation('sensores');
        if (!station) {
            return;
        }
        
        showToast('Exportando datos...', 'info');
        
        const response = await fetch(`/api/sensors/history/${station.mac}`);
        
        if (!response.ok) {
            await window.ErrorHandler.handleFetchError(response, 'Exportar datos');
            return;
        }
        
        const data = await response.json();
        
        if (!data.history || data.history.length === 0) {
            showToast('No hay datos para exportar', 'warning');
            if (window.Notifications) {
                window.Notifications.warning('⚠️ No hay datos históricos disponibles');
            }
            return;
        }
        
        // Crear CSV
        let csv = 'Timestamp,Fecha,Hora,Temperatura (°C),Humedad (%),Distancia (cm)\n';
        
        data.history.forEach(reading => {
            const date = new Date(reading.timestamp);
            csv += `${reading.timestamp},`;
            csv += `${date.toLocaleDateString()},`;
            csv += `${date.toLocaleTimeString()},`;
            csv += `${reading.temp},`;
            csv += `${reading.hum},`;
            csv += `${reading.dist}\n`;
        });
        
        // Descargar
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `sensores-${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        
        showToast(`${data.history.length} registros exportados`, 'success');
        
        if (window.Notifications) {
            window.Notifications.success(`✅ ${data.history.length} registros exportados`);
        }
        
    } catch (error) {
        console.error('❌ Error al exportar:', error);
        
        if (window.ErrorHandler) {
            window.ErrorHandler.logError('Export Error', error.message, { error });
        }
        
        showToast('Error al exportar datos. Intenta de nuevo.', 'error');
    }
}

// ============================================
// ACTUALIZAR STATUS DEL SERVIDOR
// ============================================

function updateServerStatus(connected) {
    const statusEl = document.getElementById('serverStatus');
    if (!statusEl) return;
    
    const dot = statusEl.querySelector('.status-dot');
    const text = statusEl.querySelector('.status-text');
    
    if (connected) {
        dot.style.background = 'var(--accent-success)';
        text.textContent = 'Conectado';
    } else {
        dot.style.background = 'var(--accent-danger)';
        text.textContent = 'Desconectado';
    }
}

// ============================================
// TOAST NOTIFICATIONS
// ============================================

function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const icons = {
        success: '✅',
        error: '❌',
        warning: '⚠️',
        info: 'ℹ️'
    };
    
    toast.innerHTML = `
        <span class="toast-icon">${icons[type] || icons.info}</span>
        <span class="toast-message">${message}</span>
    `;
    
    container.appendChild(toast);
    
    // Auto-remover después de 5 segundos
    setTimeout(() => {
        toast.classList.add('removing');
        setTimeout(() => {
            toast.remove();
        }, 300);
    }, 5000);
}

// ============================================
// UTILIDADES
// ============================================

function getTimeAgo(timestamp) {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    
    if (seconds < 60) return 'hace ' + seconds + 's';
    if (seconds < 3600) return 'hace ' + Math.floor(seconds / 60) + ' min';
    if (seconds < 86400) return 'hace ' + Math.floor(seconds / 3600) + 'h';
    return 'hace ' + Math.floor(seconds / 86400) + ' días';
}

// Exponer funciones globales
window.App = {
    state: AppState,
    updateUI,
    showToast,
    goToStep,
    closeConfigModal
};