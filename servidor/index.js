const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const admin = require('firebase-admin');
const cors = require('cors');
const path = require('path');

// Inicializar Firebase
const serviceAccount = require('./firebase-key.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '../clientes')));

// Almacen de usuarios conectados
const usuariosConectados = new Map();

// Configuración de Socket.IO
io.on('connection', (socket) => {
  console.log('Usuario conectado:', socket.id);

  // Cuando un usuario establece su nombre
  socket.on('establecer-usuario', (usuario) => {
    usuariosConectados.set(socket.id, usuario);
    socket.usuario = usuario;
    
    console.log(`Usuario ${usuario} conectado (${socket.id})`);
    
    // Emitir a todos los usuarios la lista actualizada
    io.emit('usuarios-actualizados', Array.from(usuariosConectados.values()));
    
    // Enviar mensaje de sistema
    const mensajeSistema = {
      usuario: 'Sistema',
      mensaje: `${usuario} se ha unido al chat`,
      timestamp: new Date(),
      tipo: 'sistema'
    };
    
    io.emit('nuevo-mensaje', mensajeSistema);
  });

  // Cuando un usuario envía un mensaje
  socket.on('enviar-mensaje', async (data) => {
    try {
      const { usuario, mensaje } = data;
      
      if (!usuario || !mensaje) {
        socket.emit('error', 'Usuario y mensaje son requeridos');
        return;
      }

      const mensajeData = {
        usuario: usuario,
        mensaje: mensaje,
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      };

      // Guardar en Firebase
      const docRef = await db.collection('mensajes').add(mensajeData);
      
      // Obtener el mensaje guardado con ID
      const mensajeGuardado = {
        id: docRef.id,
        usuario: usuario,
        mensaje: mensaje,
        timestamp: new Date()
      };

      // Enviar a TODOS los clientes (incluyendo el que lo envió)
      io.emit('nuevo-mensaje', mensajeGuardado);
      
    } catch (error) {
      console.error('Error al enviar mensaje:', error);
      socket.emit('error', 'Error al enviar mensaje');
    }
  });

  // Cuando un usuario solicita los mensajes existentes
  socket.on('cargar-mensajes', async () => {
    try {
      const mensajesSnapshot = await db.collection('mensajes')
        .orderBy('timestamp', 'desc')
        .limit(100)
        .get();
      
      const mensajes = [];
      mensajesSnapshot.forEach(doc => {
        const data = doc.data();
        mensajes.push({
          id: doc.id,
          usuario: data.usuario,
          mensaje: data.mensaje,
          timestamp: data.timestamp?.toDate() || new Date()
        });
      });
      
      socket.emit('mensajes-cargados', mensajes.reverse());
    } catch (error) {
      console.error('Error al cargar mensajes:', error);
      socket.emit('error', 'Error al cargar mensajes');
    }
  });

  // Cuando un usuario se desconecta
  socket.on('disconnect', () => {
    const usuario = usuariosConectados.get(socket.id);
    
    if (usuario) {
      usuariosConectados.delete(socket.id);
      
      console.log(`Usuario ${usuario} desconectado (${socket.id})`);
      
      // Emitir a todos los usuarios la lista actualizada
      io.emit('usuarios-actualizados', Array.from(usuariosConectados.values()));
      
      // Enviar mensaje de sistema
      const mensajeSistema = {
        usuario: 'Sistema',
        mensaje: `${usuario} ha abandonado el chat`,
        timestamp: new Date(),
        tipo: 'sistema'
      };
      
      io.emit('nuevo-mensaje', mensajeSistema);
    }
  });

  // Manejo de errores del socket
  socket.on('error', (error) => {
    console.error('Error en socket:', error);
  });
});

// Endpoints HTTP tradicionales (para compatibilidad)
app.post('/enviar-mensaje', async (req, res) => {
  try {
    const { usuario, mensaje } = req.body;
    
    if (!usuario || !mensaje) {
      return res.status(400).json({ error: 'Usuario y mensaje son requeridos' });
    }

    const mensajeData = {
      usuario: usuario,
      mensaje: mensaje,
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    };

    await db.collection('mensajes').add(mensajeData);
    
    // Emitir a través de sockets también
    io.emit('nuevo-mensaje', {
      usuario: usuario,
      mensaje: mensaje,
      timestamp: new Date()
    });

    res.json({ success: true, message: 'Mensaje enviado correctamente' });
  } catch (error) {
    console.error('Error al enviar mensaje:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

app.get('/obtener-mensajes', async (req, res) => {
  try {
    const mensajesSnapshot = await db.collection('mensajes')
      .orderBy('timestamp', 'desc')
      .limit(100)
      .get();
    
    const mensajes = [];
    mensajesSnapshot.forEach(doc => {
      const data = doc.data();
      mensajes.push({
        id: doc.id,
        usuario: data.usuario,
        mensaje: data.mensaje,
        timestamp: data.timestamp?.toDate() || new Date()
      });
    });
    
    res.json(mensajes.reverse());
  } catch (error) {
    console.error('Error al obtener mensajes:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Rutas de navegación
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../clientes/index.html'));
});

app.post('/establecer-usuario', (req, res) => {
  const { usuario } = req.body;
  
  if (!usuario || usuario.trim() === '') {
    return res.redirect('/?error=Por favor ingresa un nombre de usuario');
  }

  res.redirect(`/servidor?usuario=${encodeURIComponent(usuario.trim())}`);
});

app.get('/servidor', (req, res) => {
  res.sendFile(path.join(__dirname, 'servidor.html'));
});

server.listen(PORT, () => {
  console.log(`🚀 Servidor con Socket.IO corriendo en http://localhost:${PORT}`);
  console.log(`📱 Clientes: http://localhost:${PORT}/`);
  console.log(`🖥️ Servidor: http://localhost:${PORT}/servidor`);
  console.log(`🔌 Sockets activos en: ws://localhost:${PORT}`);
});