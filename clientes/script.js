class ChatClient {
    constructor() {
        this.baseURL = 'http://localhost:3000';
        this.usuario = this.getUsuario();
        this.initializeElements();
        this.setupEventListeners();
        this.loadMessages();
        
        if (!this.usuario) {
            window.location.href = '/';
        }
    }

    getUsuario() {
        return sessionStorage.getItem('usuarioChat');
    }

    initializeElements() {
        this.usuarioActual = document.getElementById('usuarioActual');
        this.mensajeInput = document.getElementById('mensajeInput');
        this.enviarBtn = document.getElementById('enviarBtn');
        this.cambiarUsuarioBtn = document.getElementById('cambiarUsuarioBtn');
        this.status = document.getElementById('status');
        this.mensajesContainer = document.getElementById('mensajesContainer');
        
        // Mostrar el usuario actual
        this.usuarioActual.textContent = this.usuario;
    }

    setupEventListeners() {
        this.enviarBtn.addEventListener('click', () => this.enviarMensaje());
        this.mensajeInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.enviarMensaje();
            }
        });
        this.cambiarUsuarioBtn.addEventListener('click', () => {
            sessionStorage.removeItem('usuarioChat');
            window.location.href = '/';
        });
    }

    async enviarMensaje() {
        const mensaje = this.mensajeInput.value.trim();

        if (!mensaje) {
            this.showStatus('Por favor escribe un mensaje', 'error');
            this.mensajeInput.focus();
            return;
        }

        try {
            const response = await fetch(`${this.baseURL}/enviar-mensaje`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ 
                    usuario: this.usuario, 
                    mensaje: mensaje 
                })
            });

            const result = await response.json();

            if (result.success) {
                this.showStatus('Mensaje enviado correctamente', 'success');
                this.mensajeInput.value = '';
                this.mensajeInput.focus();
                this.loadMessages();
            } else {
                this.showStatus('Error al enviar el mensaje', 'error');
            }
        } catch (error) {
            console.error('Error:', error);
            this.showStatus('Error de conexión con el servidor', 'error');
        }
    }

    async loadMessages() {
        try {
            const response = await fetch(`${this.baseURL}/obtener-mensajes`);
            const mensajes = await response.json();
            this.displayMessages(mensajes);
        } catch (error) {
            console.error('Error al cargar mensajes:', error);
        }
    }

    displayMessages(mensajes) {
        this.mensajesContainer.innerHTML = '';
        
        if (mensajes.length === 0) {
            this.mensajesContainer.innerHTML = '<p style="text-align: center; color: #666;">No hay mensajes aún</p>';
            return;
        }

        // Filtrar mensajes del usuario actual
        const misMensajes = mensajes.filter(msg => msg.usuario === this.usuario);

        if (misMensajes.length === 0) {
            this.mensajesContainer.innerHTML = '<p style="text-align: center; color: #666;">Aún no has enviado mensajes</p>';
            return;
        }

        misMensajes.forEach(msg => {
            const messageElement = document.createElement('div');
            messageElement.className = 'message';
            
            const time = new Date(msg.timestamp).toLocaleString();
            
            messageElement.innerHTML = `
                <div class="message-header">Tú</div>
                <div class="message-text">${this.escapeHtml(msg.mensaje)}</div>
                <div class="message-time">${time}</div>
            `;
            
            this.mensajesContainer.appendChild(messageElement);
        });

        this.mensajesContainer.scrollTop = this.mensajesContainer.scrollHeight;
    }

    showStatus(message, type) {
        this.status.textContent = message;
        this.status.className = `status ${type}`;
        
        setTimeout(() => {
            this.status.textContent = '';
            this.status.className = 'status';
        }, 3000);
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Inicializar la aplicación cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    new ChatClient();
});