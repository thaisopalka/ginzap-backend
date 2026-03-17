const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');

const app = express();

// 1. AQUI ESTÁ A MÁGICA DE SEGURANÇA (CORS DO EXPRESS)
app.use(cors({
  origin: 'https://ginzap-app.vercel.app', // O endereço exato do seu site no Vercel
  credentials: true // Isso libera a passagem do login/cookies
}));

app.use(express.json());

const server = http.createServer(app);

// 2. AQUI LIBERAMOS O MOTOR DO CHAT EM TEMPO REAL (CORS DO SOCKET.IO)
const io = new Server(server, {
  cors: {
    origin: 'https://ginzap-app.vercel.app',
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    credentials: true
  }
});

// Agora o motor vai responder tanto no link puro quanto no /api
app.get('/', (req, res) => {
  res.send("🚀 Motor GinZap ligado e pronto!");
});

app.get('/api', (req, res) => {
  res.json({ status: "ok", message: "API operando!" });
});

io.on('connection', (socket) => {
  console.log('🟢 Alguém conectou:', socket.id);
  socket.emit('status', 'conectado ao motor');
});

const PORT = process.env.PORT || 10000; // Render prefere a porta 10000
server.listen(PORT, () => {
  console.log(`Motor rodando na porta ${PORT}`);
});
