// ============================================
// SISTEMA DE NOTIFICACIONES
// ============================================

const Notifications = {
    notifications: [],
    maxNotifications: 20,
    unreadCount: 0,
    panelOpen: false,
    
    // ============================================
    // INICIALIZACIÓN
    // ============================================
    
    init() {
        console.log('🔔 Sistema de notificaciones inicializado');
        
        // Event listener para el botón de notificaciones
        const btnNotifications = document.getElementById('btnNotifications');
        if (btnNotifications) {
            btnNotifications.addEventListener('click', () => this.togglePanel());
        }
        
        // Crear panel de notificaciones
        this.createPanel();
        
        // Cerrar panel al hacer clic fuera
        document.addEventListener('click', (e) => {
            const panel = document.getElementById('notificationsPanel');
            const btn = document.getElementById('btnNotifications');
            
            if (panel && btn && this.panelOpen) {
                if (!panel.contains(e.target) && !btn.contains(e.target)) {
                    this.closePanel();
                }
            }
        });
    },
    
    // ============================================
    // CREAR PANEL
    // ============================================
    
    createPanel() {
        // Verificar si ya existe
        if (document.getElementById('notificationsPanel')) {
            return;
        }
        
        const panel = document.createElement('div');
        panel.id = 'notificationsPanel';
        panel.className = 'notifications-panel';
        panel.innerHTML = `
            <div class="notifications-header">
                <h3>🔔 Notificaciones</h3>
                <button class="btn-clear-all" id="btnClearAll">Limpiar</button>
            </div>
            <div class="notifications-list" id="notificationsList">
                <div class="notification-empty">
                    <p>No hay notificaciones</p>
                </div>
            </div>
        `;
        
        document.body.appendChild(panel);
        
        // Event listener para limpiar
        const btnClearAll = document.getElementById('btnClearAll');
        if (btnClearAll) {
            btnClearAll.addEventListener('click', () => this.clearAll());
        }
    },
    
    // ============================================
    // TOGGLE PANEL
    // ============================================
    
    togglePanel() {
        if (this.panelOpen) {
            this.closePanel();
        } else {
            this.openPanel();
        }
    },
    
    openPanel() {
        const panel = document.getElementById('notificationsPanel');
        if (panel) {
            panel.classList.add('open');
            this.panelOpen = true;
            
            // Marcar todas como leídas
            this.markAllAsRead();
        }
    },
    
    closePanel() {
        const panel = document.getElementById('notificationsPanel');
        if (panel) {
            panel.classList.remove('open');
            this.panelOpen = false;
        }
    },
    
    // ============================================
    // AGREGAR NOTIFICACIÓN
    // ============================================
    
    add(message, type = 'info') {
        const notification = {
            id: Date.now(),
            message: message,
            type: type, // 'success', 'warning', 'error', 'info'
            timestamp: Date.now(),
            read: false
        };
        
        // Agregar al inicio del array
        this.notifications.unshift(notification);
        
        // Limitar cantidad
        if (this.notifications.length > this.maxNotifications) {
            this.notifications.pop();
        }
        
        // Incrementar contador de no leídas
        this.unreadCount++;
        
        // Actualizar UI
        this.updateBadge();
        this.updateList();
        
        // Log en consola
        console.log(`🔔 Notificación: ${message}`);
        
        // Reproducir sonido (opcional)
        this.playSound();
    },
    
    // ============================================
    // ACTUALIZAR BADGE
    // ============================================
    
    updateBadge() {
        const badge = document.getElementById('notificationBadge');
        if (badge) {
            badge.textContent = this.unreadCount;
            
            if (this.unreadCount > 0) {
                badge.style.display = 'flex';
                badge.classList.add('pulse');
            } else {
                badge.style.display = 'none';
                badge.classList.remove('pulse');
            }
        }
    },
    
    // ============================================
    // ACTUALIZAR LISTA
    // ============================================
    
    updateList() {
        const list = document.getElementById('notificationsList');
        if (!list) return;
        
        if (this.notifications.length === 0) {
            list.innerHTML = `
                <div class="notification-empty">
                    <p>No hay notificaciones</p>
                </div>
            `;
            return;
        }
        
        list.innerHTML = this.notifications.map(notif => {
            const icon = this.getIcon(notif.type);
            const timeAgo = this.getTimeAgo(notif.timestamp);
            const readClass = notif.read ? 'read' : 'unread';
            
            return `
                <div class="notification-item ${notif.type} ${readClass}" data-id="${notif.id}">
                    <div class="notification-icon">${icon}</div>
                    <div class="notification-content">
                        <p class="notification-message">${notif.message}</p>
                        <span class="notification-time">${timeAgo}</span>
                    </div>
                </div>
            `;
        }).join('');
    },
    
    // ============================================
    // OBTENER ÍCONO
    // ============================================
    
    getIcon(type) {
        const icons = {
            success: '✅',
            warning: '⚠️',
            error: '❌',
            info: 'ℹ️'
        };
        return icons[type] || 'ℹ️';
    },
    
    // ============================================
    // TIEMPO TRANSCURRIDO
    // ============================================
    
    getTimeAgo(timestamp) {
        const now = Date.now();
        const diff = Math.floor((now - timestamp) / 1000);
        
        if (diff < 60) {
            return `hace ${diff}s`;
        } else if (diff < 3600) {
            const minutes = Math.floor(diff / 60);
            return `hace ${minutes}m`;
        } else if (diff < 86400) {
            const hours = Math.floor(diff / 3600);
            return `hace ${hours}h`;
        } else {
            const days = Math.floor(diff / 86400);
            return `hace ${days}d`;
        }
    },
    
    // ============================================
    // MARCAR TODAS COMO LEÍDAS
    // ============================================
    
    markAllAsRead() {
        this.notifications.forEach(notif => {
            notif.read = true;
        });
        
        this.unreadCount = 0;
        this.updateBadge();
        this.updateList();
    },
    
    // ============================================
    // LIMPIAR TODAS
    // ============================================
    
    clearAll() {
        this.notifications = [];
        this.unreadCount = 0;
        this.updateBadge();
        this.updateList();
        
        console.log('🔔 Notificaciones limpiadas');
    },
    
    // ============================================
    // REPRODUCIR SONIDO
    // ============================================
    
    playSound() {
        // Sonido simple usando Web Audio API
        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            oscillator.frequency.value = 800;
            oscillator.type = 'sine';
            
            gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
            
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.1);
        } catch (e) {
            // Silenciar errores de audio
        }
    },
    
    // ============================================
    // MÉTODOS DE CONVENIENCIA
    // ============================================
    
    success(message) {
        this.add(message, 'success');
    },
    
    warning(message) {
        this.add(message, 'warning');
    },
    
    error(message) {
        this.add(message, 'error');
    },
    
    info(message) {
        this.add(message, 'info');
    }
};

// Exponer globalmente
window.Notifications = Notifications;
