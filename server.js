const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');

const app = express();
// Permite que a sua tela na Vercel consiga conversar com este motor
app.use(cors({
    origin: "*", 
    methods: ["GET", "POST"]
}));
app.use(express.json());

const server = http.createServer(app);

// Configuração do "rádio" (WebSockets) para mensagens em tempo real
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Rota de teste para sabermos se o motor ligou
app.get('/api', (req, res) => {
  res.json({ message: "Motor do GinZap operando 100%!" });
});

// Quando alguém entra no aplicativo...
io.on('connection', (socket) => {
  console.log('🟢 Um usuário conectou:', socket.id);

  // Quando alguém sai do aplicativo...
  socket.on('disconnect', () => {
    console.log('🔴 Usuário desconectou:', socket.id);
  });
});

// Liga o motor na porta correta
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Servidor rodando a todo vapor na porta ${PORT}`);
});
