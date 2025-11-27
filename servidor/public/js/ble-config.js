// ============================================
// BLE-CONFIG.JS - CONFIGURACIÓN BLUETOOTH REAL
// ============================================

const BLEConfig = {
    device: null,
    server: null,
    service: null,
    charSSID: null,
    charPass: null,
    charScan: null,
    charServer: null,
    selectedMAC: null,
    wifiNetworks: [],
    
    SERVICE_UUID: '4fafc201-1fb5-459e-8fcc-c5c9c331914b',
    CHAR_SSID_UUID: 'beb5483e-36e1-4688-b7f5-ea07361b26a8',
    CHAR_PASS_UUID: '1c95d5e3-d8f7-413a-bf3d-7a2e5d7be87e',
    CHAR_SCAN_UUID: 'd8de624e-140f-4a22-8594-e2216b84a5f2',
    CHAR_SERVER_UUID: '8a8e1c4f-2d3b-4e9a-a1c7-5f6d8e9a0b1c',
    
    init() {
        console.log('🔵 BLE Config inicializado (IP dinámica)');
        
        const btnScan = document.getElementById('btnScanBLE');
        if (btnScan) {
            btnScan.addEventListener('click', () => this.scanDevices());
        }
        
        const btnConfigure = document.getElementById('btnConfigure');
        if (btnConfigure) {
            btnConfigure.addEventListener('click', () => this.configureStation());
        }
        
        const btnBack1 = document.getElementById('btnBack1');
        if (btnBack1) {
            btnBack1.addEventListener('click', () => {
                this.resetState();
                window.App.goToStep(1);
            });
        }
        
        const btnFinish = document.getElementById('btnFinish');
        if (btnFinish) {
            btnFinish.addEventListener('click', () => {
                this.resetState();
                window.App.closeConfigModal();
                
                // Esperar 2 segundos antes de recargar para que el kit se conecte
                setTimeout(() => {
                    window.location.reload();
                }, 2000);
            });
        }
        
        const wifiSelect = document.getElementById('wifiSelect');
        const wifiPassword = document.getElementById('wifiPassword');
        const stationType = document.querySelectorAll('input[name="stationType"]');
        
        const validateForm = () => {
            const btnConfigure = document.getElementById('btnConfigure');
            if (!btnConfigure) return;
            
            const ssid = wifiSelect?.value;
            const password = wifiPassword?.value;
            const type = document.querySelector('input[name="stationType"]:checked')?.value;
            
            btnConfigure.disabled = !ssid || !password || !type;
        };
        
        if (wifiSelect) wifiSelect.addEventListener('change', validateForm);
        if (wifiPassword) wifiPassword.addEventListener('input', validateForm);
        stationType.forEach(radio => {
            radio.addEventListener('change', validateForm);
        });
    },
    
    async scanDevices() {
        console.log('🔍 Escaneando dispositivos BLE...');
        
        if (!navigator.bluetooth) {
            window.App.showToast('Tu navegador no soporta Web Bluetooth', 'error');
            alert('Web Bluetooth no está disponible.\n\nUsa Chrome, Edge o Opera en Windows/Mac/Android.\n\niOS no soporta Web Bluetooth.');
            return;
        }
        
        const btnScan = document.getElementById('btnScanBLE');
        const loading = document.getElementById('scanLoading');
        const devicesList = document.getElementById('devicesList');
        
        try {
            if (btnScan) btnScan.style.display = 'none';
            if (loading) loading.style.display = 'block';
            
            console.log('Solicitando dispositivo BLE...');
            
            this.device = await navigator.bluetooth.requestDevice({
                filters: [
                    { namePrefix: 'DUALNODE_' }
                ],
                optionalServices: [this.SERVICE_UUID]
            });
            
            console.log('✅ Dispositivo seleccionado:', this.device.name);
            
            // Agregar listener para detectar desconexión
            this.device.addEventListener('gattserverdisconnected', () => {
                console.log('⚠️ Dispositivo BLE desconectado');
                // Limpiar referencias
                this.server = null;
                this.service = null;
                this.charSSID = null;
                this.charPass = null;
                this.charScan = null;
                this.charServer = null;
            });
            
            this.selectedMAC = this.device.name.split('_').pop();
            
            if (loading) loading.style.display = 'none';
            
            if (devicesList) {
                devicesList.style.display = 'block';
                devicesList.innerHTML = `
                    <h4>Dispositivo seleccionado:</h4>
                    <div class="device-item" style="border-color: var(--accent-primary); cursor: default;">
                        <div class="device-info">
                            <span class="device-icon">📡</span>
                            <div>
                                <div class="device-name">${this.device.name}</div>
                                <div class="device-mac">MAC: ${this.selectedMAC}</div>
                            </div>
                        </div>
                        <span style="color: var(--accent-success);">✓</span>
                    </div>
                `;
            }
            
            await this.connectAndScanWiFi();
            
        } catch (error) {
            console.error('❌ Error al escanear:', error);
            
            if (loading) loading.style.display = 'none';
            if (btnScan) btnScan.style.display = 'block';
            
            if (error.name === 'NotFoundError') {
                window.App.showToast('No se encontraron dispositivos', 'warning');
            } else {
                window.App.showToast('Error al buscar dispositivos: ' + error.message, 'error');
            }
        }
    },
    
    async connectAndScanWiFi() {
        console.log('🔗 Conectando a ESP32 por BLE...');
        
        window.App.showToast('Conectando a ESP32...', 'info');
        
        try {
            // Verificar que el dispositivo existe y no está conectado
            if (!this.device) {
                throw new Error('No hay dispositivo BLE seleccionado');
            }
            
            // Si ya está conectado, desconectar primero
            if (this.device.gatt.connected) {
                console.log('⚠️ Dispositivo ya conectado, desconectando...');
                this.device.gatt.disconnect();
                await this.sleep(500); // Esperar a que se desconecte
            }
            
            console.log('Conectando GATT...');
            this.server = await this.device.gatt.connect();
            console.log('✅ GATT conectado');
            
            console.log('Obteniendo servicio...');
            this.service = await this.server.getPrimaryService(this.SERVICE_UUID);
            console.log('✅ Servicio obtenido');
            
            console.log('Obteniendo características...');
            this.charSSID = await this.service.getCharacteristic(this.CHAR_SSID_UUID);
            this.charPass = await this.service.getCharacteristic(this.CHAR_PASS_UUID);
            this.charScan = await this.service.getCharacteristic(this.CHAR_SCAN_UUID);
            this.charServer = await this.service.getCharacteristic(this.CHAR_SERVER_UUID);
            console.log('✅ Características obtenidas');
            
            // Escanear redes WiFi con reintentos
            console.log('Leyendo redes WiFi...');
            window.App.showToast('Escaneando redes WiFi...', 'info');
            
            const scanResult = await this.scanWiFiWithRetry(3, 2000);
            
            if (!scanResult.success) {
                throw new Error('No se pudieron obtener las redes WiFi después de varios intentos');
            }
            
            console.log('📶 Redes WiFi obtenidas:', this.wifiNetworks);
            
            const wifiSelect = document.getElementById('wifiSelect');
            if (wifiSelect) {
                wifiSelect.innerHTML = '<option value="">Selecciona una red</option>';
                
                this.wifiNetworks.forEach(network => {
                    const bars = this.getRSSIBars(network.rssi);
                    const icon = '📶'.repeat(bars);
                    
                    const option = document.createElement('option');
                    option.value = network.ssid;
                    option.textContent = `${icon} ${network.ssid} (${network.security})`;
                    wifiSelect.appendChild(option);
                });
                
                wifiSelect.disabled = false;
            }
            
            const wifiPassword = document.getElementById('wifiPassword');
            if (wifiPassword) {
                wifiPassword.disabled = false;
            }
            
            const selectedDevice = document.getElementById('selectedDevice');
            if (selectedDevice) {
                selectedDevice.innerHTML = `
                    <span class="device-icon">📡</span>
                    <span class="device-name">${this.device.name}</span>
                `;
            }
            
            window.App.goToStep(2);
            window.App.showToast(`${this.wifiNetworks.length} redes WiFi encontradas`, 'success');
            
        } catch (error) {
            console.error('❌ Error al conectar:', error);
            window.App.showToast('Error al conectar con ESP32: ' + error.message, 'error');
            
            if (this.server && this.server.connected) {
                this.server.disconnect();
            }
        }
    },
    
    async scanWiFiWithRetry(maxRetries = 3, delayMs = 1000) {
        let attempt = 0;
        
        while (attempt < maxRetries) {
            attempt++;
            
            try {
                console.log(`📡 Intento ${attempt}/${maxRetries} - Leyendo redes WiFi del ESP32...`);
                
                // El ESP32 ya tiene las redes escaneadas, solo leer
                const scanValue = await this.charScan.readValue();
                const scanText = new TextDecoder().decode(scanValue);
                
                console.log(`Datos recibidos (${scanText.length} bytes):`, scanText.substring(0, 100) + '...');
                
                // Validar que recibimos datos
                if (!scanText || scanText.trim().length === 0) {
                    console.warn(`⚠️ Intento ${attempt}: Respuesta vacía del ESP32`);
                    
                    if (attempt < maxRetries) {
                        console.log(`⏳ Esperando ${delayMs}ms antes de reintentar...`);
                        await this.sleep(delayMs);
                        continue;
                    } else {
                        throw new Error('El ESP32 no devolvió datos de redes WiFi');
                    }
                }
                
                // Parsear redes
                this.wifiNetworks = [];
                const networks = scanText.split(';');
                
                console.log(`📋 Procesando ${networks.length} redes...`);
                
                networks.forEach((network, index) => {
                    if (!network || network.trim().length === 0) return;
                    
                    const parts = network.split(',');
                    if (parts.length >= 3) {
                        const ssid = parts[0].trim();
                        const rssi = parseInt(parts[1]);
                        const encType = parseInt(parts[2]);
                        const security = this.getSecurityType(encType);
                        
                        // Validar que el SSID no esté vacío
                        if (ssid && ssid.length > 0) {
                            this.wifiNetworks.push({
                                ssid: ssid,
                                rssi: rssi,
                                security: security
                            });
                        }
                    }
                });
                
                // Verificar que obtuvimos al menos una red
                if (this.wifiNetworks.length === 0) {
                    console.warn(`⚠️ Intento ${attempt}: No se pudieron parsear redes válidas`);
                    
                    if (attempt < maxRetries) {
                        await this.sleep(delayMs);
                        continue;
                    } else {
                        throw new Error('No se encontraron redes WiFi válidas en los datos');
                    }
                }
                
                // Éxito: ordenar por señal (RSSI más alto primero)
                this.wifiNetworks.sort((a, b) => b.rssi - a.rssi);
                
                console.log(`✅ Escaneo exitoso: ${this.wifiNetworks.length} redes encontradas`);
                console.log('📶 Primeras 5 redes:', this.wifiNetworks.slice(0, 5).map(n => `${n.ssid} (${n.rssi}dBm)`));
                
                return {
                    success: true,
                    networks: this.wifiNetworks,
                    attempt: attempt
                };
                
            } catch (error) {
                console.error(`❌ Error en intento ${attempt}:`, error);
                
                if (attempt >= maxRetries) {
                    return {
                        success: false,
                        error: error.message,
                        attempt: attempt
                    };
                }
                
                // Esperar antes del siguiente intento
                await this.sleep(delayMs);
            }
        }
        
        return {
            success: false,
            error: 'Se agotaron los intentos de escaneo',
            attempt: maxRetries
        };
    },
    
    // FUNCIÓN MEJORADA: Obtener IP del servidor
    // FUNCIÓN MEJORADA: Obtener IP del servidor
    getServerAddress() {
    // Obtener IP desde URL si es válida
    let defaultValue = 'localhost:3000';
    
    if (window.location.hostname && 
        window.location.hostname !== 'localhost' &&
        window.location.hostname !== '127.0.0.1') {
        const port = window.location.port || '3000';
        defaultValue = `${window.location.hostname}:${port}`;
    }
    
    // SIEMPRE pedir confirmación al usuario
    const userIP = prompt(
        '📡 Confirma o ingresa la IP del servidor:\n\n' +
        'Esta es la IP de tu PC donde corre Node.js\n\n' +
        'Para obtenerla:\n' +
        '  • Windows: abre CMD y ejecuta "ipconfig"\n' +
        '  • Mac/Linux: abre Terminal y ejecuta "ifconfig"\n\n' +
        'Formato: IP:PUERTO',
        defaultValue
    );
    
    return userIP || defaultValue;
    },
    
    async configureStation() {
    const wifiSelect = document.getElementById('wifiSelect');
    const wifiPassword = document.getElementById('wifiPassword');
    const stationType = document.querySelector('input[name="stationType"]:checked');
    
    if (!wifiSelect?.value || !wifiPassword?.value || !stationType?.value) {
        window.App.showToast('Completa todos los campos', 'warning');
        return;
    }
    
    const config = {
        ssid: wifiSelect.value,
        password: wifiPassword.value,
        type: stationType.value
    };
    
    console.log('⚙️ Configurando kit:', config);
    
    window.App.goToStep(3);
    
    try {
        const progressBar = document.getElementById('progressBar');
        const progressText = document.getElementById('progressText');
        
        // Obtener IP del servidor
        const serverAddress = this.getServerAddress();
        console.log('📡 IP del servidor:', serverAddress);
        
        if (!serverAddress) {
            throw new Error('No se pudo obtener la IP del servidor');
        }
        
        const encoder = new TextEncoder();
        
        // Paso 0: Enviar IP del servidor
        if (progressText) progressText.textContent = 'Enviando IP del servidor...';
        if (progressBar) progressBar.style.width = '15%';
        
        await this.charServer.writeValue(encoder.encode(serverAddress));
        console.log('✅ IP del servidor enviada:', serverAddress);
        await this.sleep(800);
        
        // Paso 1: Enviar SSID
        if (progressText) progressText.textContent = 'Enviando SSID...';
        if (progressBar) progressBar.style.width = '35%';
        
        await this.charSSID.writeValue(encoder.encode(config.ssid));
        console.log('✅ SSID enviado');
        await this.sleep(800);
        
        // Paso 2: Enviar Password
        if (progressText) progressText.textContent = 'Enviando Password...';
        if (progressBar) progressBar.style.width = '55%';
        
        await this.charPass.writeValue(encoder.encode(config.password));
        console.log('✅ Password enviado');
        
        // IMPORTANTE: Esperar un poco antes de desconectar
        if (progressText) progressText.textContent = 'Configuración enviada, finalizando...';
        if (progressBar) progressBar.style.width = '70%';
        await this.sleep(3000);  // Esperar 3 segundos
        
        // Paso 3: Desconectar BLE
        if (progressText) progressText.textContent = 'Cerrando conexión BLE...';
        if (progressBar) progressBar.style.width = '75%';
        
        if (this.server && this.server.connected) {
            this.server.disconnect();
            console.log('✅ BLE desconectado');
        }
        
        await this.sleep(1000);
        
        // Paso 4: ESP32 conectándose a WiFi
        if (progressText) progressText.textContent = 'ESP32 conectando a WiFi...';
        if (progressBar) progressBar.style.width = '85%';
        await this.sleep(5000);
        
        // Paso 5: Esperar registro del ESP32 en servidor
        if (progressText) progressText.textContent = 'Esperando registro en servidor...';
        if (progressBar) progressBar.style.width = '95%';
        
        await this.waitForStation(this.selectedMAC, 20000);  // 20 segundos timeout
        
        if (progressBar) progressBar.style.width = '100%';
        
        this.showSuccess(config, stationType.value);
        
    } catch (error) {
        console.error('❌ Error al configurar:', error);
        window.App.showToast('Error: ' + error.message, 'error');
        
        // Intentar desconectar si hay error
        if (this.server && this.server.connected) {
            try {
                this.server.disconnect();
            } catch (e) {
                console.log('Error al desconectar:', e);
            }
        }
        
        window.App.goToStep(2);
    }
},
    
    async waitForStation(mac, timeout) {
        const startTime = Date.now();
        
        while (Date.now() - startTime < timeout) {
            try {
                const response = await fetch('/api/stations');
                const data = await response.json();
                
                const station = data.stations.find(s => s.mac === mac);
                
                if (station && station.status === 'online') {
                    console.log('✅ Kit encontrado y online:', station);
                    return station;
                }
                
            } catch (error) {
                console.error('Error al verificar kit:', error);
            }
            
            await this.sleep(1000);
        }
        
        throw new Error('El kit no se registró en el servidor. Verifica que el ESP32 tenga la IP correcta del servidor.');
    },
    
    showSuccess(config, type) {
        window.App.goToStep(4);
        
        const successTitle = document.getElementById('successTitle');
        const successDetails = document.getElementById('successDetails');
        
        const name = type === 'leds-ia' ? 'LEDs + IA' : 'Sensores';
        
        if (successTitle) {
            successTitle.textContent = `${name} configurada correctamente`;
        }
        
        if (successDetails) {
            successDetails.innerHTML = `
                <div class="success-detail-item">
                    <span style="color: var(--text-secondary);">Tipo:</span>
                    <span style="font-weight: 600;">${name}</span>
                </div>
                <div class="success-detail-item">
                    <span style="color: var(--text-secondary);">MAC:</span>
                    <span style="font-weight: 600;">${this.selectedMAC}</span>
                </div>
                <div class="success-detail-item">
                    <span style="color: var(--text-secondary);">WiFi:</span>
                    <span style="font-weight: 600;">${config.ssid}</span>
                </div>
            `;
        }
        
        window.App.showToast('¡Kit configurado exitosamente!', 'success');
    },
    
    getSecurityType(encType) {
        const types = {
            0: 'Abierta',
            2: 'WPA',
            3: 'WPA2',
            4: 'WPA/WPA2',
            5: 'WPA2-Enterprise',
            7: 'WPA3'
        };
        return types[encType] || 'Desconocida';
    },
    
    getRSSIBars(rssi) {
        if (rssi >= -50) return 4;
        if (rssi >= -60) return 3;
        if (rssi >= -70) return 2;
        return 1;
    },
    
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    },
    
    // ============================================
    // RESETEAR ESTADO
    // ============================================
    
    resetState() {
        console.log('🔄 Reseteando estado de BLE Config...');
        
        // Desconectar dispositivo BLE completamente
        try {
            // Desconectar el dispositivo si existe y está conectado
            if (this.device) {
                if (this.device.gatt && this.device.gatt.connected) {
                    console.log('⚠️ Desconectando dispositivo BLE anterior...');
                    this.device.gatt.disconnect();
                    console.log('✅ Dispositivo BLE desconectado');
                }
                
                // Remover event listeners
                this.device.removeEventListener('gattserverdisconnected', this.onDisconnected);
            }
        } catch (e) {
            console.warn('⚠️ Error al desconectar BLE:', e);
        }
        
        // Limpiar variables
        this.device = null;
        this.server = null;
        this.service = null;
        this.charSSID = null;
        this.charPass = null;
        this.charScan = null;
        this.charServer = null;
        this.selectedMAC = null;
        this.wifiNetworks = [];
        
        // Resetear UI del Paso 1
        const btnScan = document.getElementById('btnScanBLE');
        const loading = document.getElementById('scanLoading');
        const devicesList = document.getElementById('devicesList');
        
        if (btnScan) {
            btnScan.style.display = 'block';
            btnScan.disabled = false;
        }
        if (loading) {
            loading.style.display = 'none';
        }
        if (devicesList) {
            devicesList.style.display = 'none';
            devicesList.innerHTML = '<h4>Dispositivos encontrados:</h4>';
        }
        
        // Resetear UI del Paso 2
        const wifiSelect = document.getElementById('wifiSelect');
        const wifiPassword = document.getElementById('wifiPassword');
        const btnConfigure = document.getElementById('btnConfigure');
        const stationType = document.querySelectorAll('input[name="stationType"]');
        
        if (wifiSelect) {
            wifiSelect.innerHTML = '<option>Escaneando redes...</option>';
            wifiSelect.disabled = true;
            wifiSelect.value = '';
        }
        if (wifiPassword) {
            wifiPassword.value = '';
            wifiPassword.disabled = true;
        }
        if (btnConfigure) {
            btnConfigure.disabled = true;
        }
        stationType.forEach(radio => {
            radio.checked = false;
        });
        
        console.log('✅ Estado reseteado');
    }
};

window.BLEConfig = BLEConfig;