// ============================================
// LEDS-IA.JS - CHAT CON IA PARA CONTROL DE LEDS
// ============================================

const LedsIA = {
    stationMAC: null,
    isExecuting: false,
    currentCommand: null,
    
    // ============================================
    // INICIALIZACIÓN
    // ============================================
    
    init() {
        console.log('🎨 LEDs IA inicializado');
        
        // Input de chat
        const chatInput = document.getElementById('chatInput');
        const btnSend = document.getElementById('btnSendChat');
        
        if (chatInput) {
            chatInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && !chatInput.disabled) {
                    this.sendMessage();
                }
            });
        }
        
        if (btnSend) {
            btnSend.addEventListener('click', () => this.sendMessage());
        }
        
        // Botón detener
        const btnStop = document.getElementById('btnStopLeds');
        if (btnStop) {
            btnStop.addEventListener('click', () => this.stopExecution());
        }
        
        // Suggestion chips
        document.querySelectorAll('.suggestion-chip').forEach(chip => {
            chip.addEventListener('click', (e) => {
                const prompt = e.target.dataset.prompt;
                if (prompt && chatInput) {
                    chatInput.value = prompt;
                    this.sendMessage();
                }
            });
        });
        
        // Obtener MAC del kit LEDs
        this.findLedsStation();
    },
    
    // ============================================
    // ENCONTRAR ESTACIÓN DE LEDS
    // ============================================
    
    findLedsStation() {
        const station = Array.from(window.App.state.stations.values())
            .find(s => s.type === 'leds-ia');
        
        if (station) {
            this.stationMAC = station.mac;
            console.log('🎨 Kit LEDs encontrado:', this.stationMAC);
        }
    },
    
    // ============================================
    // ENVIAR MENSAJE
    // ============================================
    
    async sendMessage() {
        const chatInput = document.getElementById('chatInput');
        if (!chatInput) return;
        
        const prompt = chatInput.value.trim();
        if (!prompt) return;
        
        // Verificar que tengamos kit
        if (!this.stationMAC) {
            this.findLedsStation();
            if (!this.stationMAC) {
                window.App.showToast('No hay kit de LEDs configurado', 'error');
                return;
            }
        }
        
        // Limpiar input
        chatInput.value = '';
        
        // Agregar mensaje del usuario al chat
        this.addChatMessage('user', prompt);
        
        // Mostrar "pensando"
        const thinkingId = this.addChatMessage('assistant', 'Generando código...', true);
        
        try {
            console.log('🤖 Generando código para:', prompt);
            
            // Llamar al servidor para generar código
            const response = await fetch('/api/ai/generate-led-code', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    prompt: prompt,
                    stationMAC: this.stationMAC
                })
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Error al generar código');
            }
            
            const data = await response.json();
            console.log('✅ Código generado:', data.code);
            
            // Remover mensaje de "pensando"
            this.removeChatMessage(thinkingId);
            
            // Agregar respuesta de IA
            this.addChatMessage('assistant', '✓ Código generado. Ejecutando en ESP32...');
            
            // Ejecutar código
            await this.executeCode(data.code, data.command.id);
            
        } catch (error) {
            console.error('❌ Error:', error);
            
            // Remover mensaje de "pensando"
            this.removeChatMessage(thinkingId);
            
            // Mostrar error en chat
            this.addChatMessage('assistant', `❌ Error: ${error.message}`);
            window.App.showToast('Error al generar código', 'error');
        }
    },
    
    // ============================================
    // EJECUTAR CÓDIGO EN ESP32
    // ============================================
    
    async executeCode(code, commandId) {
        this.isExecuting = true;
        this.currentCommand = commandId;
        
        try {
            const response = await fetch('/api/led/execute', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    stationMAC: this.stationMAC,
                    code: code,
                    commandId: commandId
                })
            });
            
            if (!response.ok) {
                throw new Error('Error al ejecutar código');
            }
            
            const result = await response.json();
            console.log('✅ Código ejecutado:', result);
            
            // Intentar actualizar visualizador basado en el código ejecutado
            this.updateVisualizerFromCode(code);
            
            // Agregar confirmación al chat
            this.addChatMessage('assistant', '✅ ¡Listo! Código ejecutado correctamente.');
            window.App.showToast('Código ejecutado', 'success');
            
        } catch (error) {
            console.error('❌ Error al ejecutar:', error);
            this.addChatMessage('assistant', '❌ Error al ejecutar código en ESP32.');
            window.App.showToast('Error al ejecutar código', 'error');
        } finally {
            this.isExecuting = false;
            this.currentCommand = null;
        }
    },
    
    // ============================================
    // ACTUALIZAR VISUALIZADOR DESDE CÓDIGO
    // ============================================
    
    updateVisualizerFromCode(code) {
        console.log('🔍 Analizando código para actualizar visualizador...');
        
        try {
            // Apagar todos primero si hay digitalWrite(X, LOW) o apagar()
            if (code.includes('apagar()') || code.includes('apagarTodos()')) {
                console.log('💡 Detectado: Apagar todos');
                this.setAllLEDs(false);
                return;
            }
            
            // Encender todos si hay encender() o encenderTodos()
            if (code.includes('encender()') || code.includes('encenderTodos()')) {
                console.log('💡 Detectado: Encender todos');
                this.setAllLEDs(true);
                return;
            }
            
            // Detectar gpio_set_level (código C del ESP32)
            const gpioRegex = /gpio_set_level\((\d+),\s*([01])\)/gi;
            let match;
            let foundAny = false;
            
            // Mapeo de pines GPIO a índices de LED (0-9)
            const gpioToLED = {
                4: 0, 5: 1, 12: 2, 13: 3, 14: 4,
                15: 5, 16: 6, 17: 7, 18: 8, 19: 9
            };
            
            while ((match = gpioRegex.exec(code)) !== null) {
                const gpioPin = parseInt(match[1]);
                const state = match[2] === '1';
                const ledIndex = gpioToLED[gpioPin];
                
                if (ledIndex !== undefined) {
                    console.log(`💡 GPIO ${gpioPin} (LED ${ledIndex}): ${state ? 'ON' : 'OFF'}`);
                    this.setLED(ledIndex, state);
                    foundAny = true;
                }
            }
            
            // Detectar digitalWrite individuales
            const digitalWriteRegex = /digitalWrite\((\d+),\s*(HIGH|LOW)\)/gi;
            
            while ((match = digitalWriteRegex.exec(code)) !== null) {
                const ledIndex = parseInt(match[1]);
                const state = match[2].toUpperCase() === 'HIGH';
                
                if (ledIndex >= 0 && ledIndex <= 9) {
                    console.log(`💡 LED ${ledIndex}: ${state ? 'ON' : 'OFF'}`);
                    this.setLED(ledIndex, state);
                    foundAny = true;
                }
            }
            
            // Detectar encender(led) o apagar(led)
            const encenderRegex = /encender\((\d+)\)/gi;
            while ((match = encenderRegex.exec(code)) !== null) {
                const ledIndex = parseInt(match[1]);
                if (ledIndex >= 0 && ledIndex <= 9) {
                    console.log(`💡 LED ${ledIndex}: ON`);
                    this.setLED(ledIndex, true);
                    foundAny = true;
                }
            }
            
            const apagarRegex = /apagar\((\d+)\)/gi;
            while ((match = apagarRegex.exec(code)) !== null) {
                const ledIndex = parseInt(match[1]);
                if (ledIndex >= 0 && ledIndex <= 9) {
                    console.log(`💡 LED ${ledIndex}: OFF`);
                    this.setLED(ledIndex, false);
                    foundAny = true;
                }
            }
            
            if (!foundAny) {
                console.log('⚠️ No se detectaron comandos de LEDs específicos');
            }
            
        } catch (error) {
            console.error('❌ Error al analizar código:', error);
        }
    },
    
    setLED(index, state) {
        // Buscar el contenedor con data-led y luego el .led-visual dentro
        const ledItem = document.querySelector(`.led-item[data-led="${index}"]`);
        if (ledItem) {
            const led = ledItem.querySelector('.led-visual');
            if (led) {
                console.log(`🔧 Actualizando LED ${index}: ${state ? 'ON' : 'OFF'}`);
                if (state) {
                    led.classList.remove('off');
                    led.classList.add('on');
                } else {
                    led.classList.remove('on');
                    led.classList.add('off');
                }
            } else {
                console.warn(`⚠️ No se encontró .led-visual dentro de led-item[data-led="${index}"]`);
            }
        } else {
            console.warn(`⚠️ No se encontró .led-item[data-led="${index}"]`);
        }
    },
    
    setAllLEDs(state) {
        console.log(`🔧 Actualizando TODOS los LEDs: ${state ? 'ON' : 'OFF'}`);
        const leds = document.querySelectorAll('.led-visual');
        console.log(`📊 LEDs encontrados: ${leds.length}`);
        
        leds.forEach((led, index) => {
            if (state) {
                led.classList.remove('off');
                led.classList.add('on');
            } else {
                led.classList.remove('on');
                led.classList.add('off');
            }
        });
    },
    
    // ============================================
    // DETENER EJECUCIÓN
    // ============================================
    
    async stopExecution() {
        if (!this.stationMAC) return;
        
        try {
            window.App.showToast('Deteniendo ejecución...', 'info');
            
            const response = await fetch('/api/led/stop', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    stationMAC: this.stationMAC
                })
            });
            
            if (!response.ok) {
                throw new Error('Error al detener');
            }
            
            // Apagar todos los LEDs visualmente
            document.querySelectorAll('.led-visual').forEach(led => {
                led.classList.remove('on');
                led.classList.add('off');
            });
            
            this.addChatMessage('assistant', '⏹️ Ejecución detenida.');
            window.App.showToast('Ejecución detenida', 'success');
            
        } catch (error) {
            console.error('❌ Error al detener:', error);
            window.App.showToast('Error al detener ejecución', 'error');
        }
    },
    
    // ============================================
    // AGREGAR MENSAJE AL CHAT
    // ============================================
    
    addChatMessage(role, content, isTemporary = false) {
        const chatMessages = document.getElementById('chatMessages');
        if (!chatMessages) return null;
        
        const messageId = 'msg-' + Date.now();
        
        const messageDiv = document.createElement('div');
        messageDiv.className = `chat-message ${role}`;
        messageDiv.id = messageId;
        
        const avatar = role === 'user' ? '👤' : '🤖';
        
        messageDiv.innerHTML = `
            <div class="message-avatar">${avatar}</div>
            <div class="message-content">
                <p>${content}</p>
            </div>
        `;
        
        chatMessages.appendChild(messageDiv);
        
        // Scroll al final
        chatMessages.scrollTop = chatMessages.scrollHeight;
        
        return isTemporary ? messageId : null;
    },
    
    // ============================================
    // REMOVER MENSAJE DEL CHAT
    // ============================================
    
    removeChatMessage(messageId) {
        if (!messageId) return;
        
        const message = document.getElementById(messageId);
        if (message) {
            message.remove();
        }
    }
};

// Exponer globalmente
window.LedsIA = LedsIA;