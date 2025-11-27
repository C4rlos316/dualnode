// ============================================
// SISTEMA DE MANEJO DE ERRORES
// ============================================

const ErrorHandler = {
    errors: [],
    maxErrors: 50,
    
    // ============================================
    // INICIALIZACIÓN
    // ============================================
    
    init() {
        console.log('🛡️ Sistema de manejo de errores inicializado');
        
        // Capturar errores globales
        window.addEventListener('error', (event) => {
            this.logError('JavaScript Error', event.error?.message || event.message, {
                filename: event.filename,
                lineno: event.lineno,
                colno: event.colno
            });
        });
        
        // Capturar promesas rechazadas
        window.addEventListener('unhandledrejection', (event) => {
            this.logError('Unhandled Promise Rejection', event.reason?.message || event.reason, {
                promise: event.promise
            });
        });
    },
    
    // ============================================
    // REGISTRAR ERROR
    // ============================================
    
    logError(type, message, details = {}) {
        const error = {
            id: Date.now(),
            type: type,
            message: message,
            details: details,
            timestamp: Date.now(),
            userAgent: navigator.userAgent
        };
        
        this.errors.unshift(error);
        
        // Limitar cantidad
        if (this.errors.length > this.maxErrors) {
            this.errors.pop();
        }
        
        // Log en consola
        console.error(`🚨 ${type}: ${message}`, details);
        
        // Notificar al usuario
        if (window.Notifications) {
            window.Notifications.error(`Error: ${message}`);
        }
        
        // Enviar al servidor (opcional)
        this.reportToServer(error);
    },
    
    // ============================================
    // VALIDAR CONEXIÓN
    // ============================================
    
    validateConnection() {
        if (!window.App || !window.App.state) {
            this.logError('State Error', 'App state no inicializado');
            return false;
        }
        
        if (!window.App.state.isConnected) {
            this.logError('Connection Error', 'No hay conexión con el servidor');
            if (window.Notifications) {
                window.Notifications.warning('⚠️ Sin conexión al servidor');
            }
            return false;
        }
        
        return true;
    },
    
    // ============================================
    // VALIDAR ESTACIÓN
    // ============================================
    
    validateStation(type) {
        if (!this.validateConnection()) {
            return null;
        }
        
        const stations = window.App.state.stations;
        if (!stations || stations.size === 0) {
            this.logError('Station Error', 'No hay kits registrados');
            if (window.Notifications) {
                window.Notifications.warning('⚠️ No hay kits configurados');
            }
            return null;
        }
        
        const station = Array.from(stations.values()).find(s => s.type === type);
        if (!station) {
            this.logError('Station Error', `Kit tipo "${type}" no encontrado`);
            if (window.Notifications) {
                window.Notifications.warning(`⚠️ Kit "${type}" no encontrado`);
            }
            return null;
        }
        
        if (station.status !== 'online') {
            this.logError('Station Error', `Kit "${station.name}" está offline`);
            if (window.Notifications) {
                window.Notifications.warning(`⚠️ ${station.name} está desconectada`);
            }
            return null;
        }
        
        return station;
    },
    
    // ============================================
    // VALIDAR FORMULARIO
    // ============================================
    
    validateForm(formData, rules) {
        const errors = [];
        
        for (const [field, rule] of Object.entries(rules)) {
            const value = formData[field];
            
            // Required
            if (rule.required && (!value || value.trim() === '')) {
                errors.push(`${rule.label || field} es requerido`);
                continue;
            }
            
            // Min length
            if (rule.minLength && value.length < rule.minLength) {
                errors.push(`${rule.label || field} debe tener al menos ${rule.minLength} caracteres`);
            }
            
            // Max length
            if (rule.maxLength && value.length > rule.maxLength) {
                errors.push(`${rule.label || field} debe tener máximo ${rule.maxLength} caracteres`);
            }
            
            // Pattern
            if (rule.pattern && !rule.pattern.test(value)) {
                errors.push(`${rule.label || field} tiene formato inválido`);
            }
            
            // Custom validator
            if (rule.validator && !rule.validator(value)) {
                errors.push(rule.message || `${rule.label || field} es inválido`);
            }
        }
        
        if (errors.length > 0) {
            this.logError('Validation Error', 'Errores de validación', { errors });
            if (window.Notifications) {
                errors.forEach(err => {
                    window.Notifications.warning(`⚠️ ${err}`);
                });
            }
            return { valid: false, errors };
        }
        
        return { valid: true, errors: [] };
    },
    
    // ============================================
    // MANEJAR ERROR DE FETCH
    // ============================================
    
    async handleFetchError(response, context = '') {
        let errorMessage = 'Error desconocido';
        
        try {
            const data = await response.json();
            errorMessage = data.error || data.message || errorMessage;
        } catch (e) {
            errorMessage = response.statusText || errorMessage;
        }
        
        this.logError('API Error', `${context}: ${errorMessage}`, {
            status: response.status,
            url: response.url
        });
        
        if (window.Notifications) {
            window.Notifications.error(`❌ ${context}: ${errorMessage}`);
        }
        
        return errorMessage;
    },
    
    // ============================================
    // REINTENTAR OPERACIÓN
    // ============================================
    
    async retry(operation, maxRetries = 3, delay = 1000) {
        for (let i = 0; i < maxRetries; i++) {
            try {
                return await operation();
            } catch (error) {
                if (i === maxRetries - 1) {
                    throw error;
                }
                
                console.log(`🔄 Reintentando... (${i + 1}/${maxRetries})`);
                if (window.Notifications) {
                    window.Notifications.info(`🔄 Reintentando... (${i + 1}/${maxRetries})`);
                }
                
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    },
    
    // ============================================
    // REPORTAR AL SERVIDOR
    // ============================================
    
    async reportToServer(error) {
        try {
            // Solo reportar errores críticos
            if (error.type === 'JavaScript Error' || error.type === 'API Error') {
                await fetch('/api/error-report', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(error)
                });
            }
        } catch (e) {
            // Silenciar errores de reporte
            console.warn('No se pudo reportar error al servidor:', e);
        }
    },
    
    // ============================================
    // OBTENER ERRORES
    // ============================================
    
    getErrors() {
        return this.errors;
    },
    
    // ============================================
    // LIMPIAR ERRORES
    // ============================================
    
    clearErrors() {
        this.errors = [];
        console.log('🧹 Errores limpiados');
    },
    
    // ============================================
    // MOSTRAR PANEL DE ERRORES (DEBUG)
    // ============================================
    
    showErrorPanel() {
        console.group('🚨 Errores Registrados');
        this.errors.forEach((error, index) => {
            console.log(`\n[${index + 1}] ${error.type}`);
            console.log(`Mensaje: ${error.message}`);
            console.log(`Timestamp: ${new Date(error.timestamp).toLocaleString()}`);
            console.log('Detalles:', error.details);
        });
        console.groupEnd();
    }
};

// Exponer globalmente
window.ErrorHandler = ErrorHandler;
