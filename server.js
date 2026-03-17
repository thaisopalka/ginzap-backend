const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');

const app = express();

// 1. SEGURANÇA (CORS)
app.use(cors({
  origin: 'https://ginzap-app.vercel.app', // O link do seu app
  credentials: true
}));
app.use(express.json());

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: 'https://ginzap-app.vercel.app',
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    credentials: true
  }
});

// ==========================================
// 🧠 "BANCO DE DADOS" TEMPORÁRIO (Memória)
// ==========================================
// Aqui o servidor vai guardar as informações enquanto estiver ligado
let tasks = [];
let messages = [];

// ==========================================
// 🚪 PORTAS DE ENTRADA (Rotas da API)
// ==========================================

// Rota para CRIAR uma tarefa (O botão que deu erro vermelho)
app.post('/tasks', (req, res) => {
  const newTask = {
    task_id: Date.now().toString(), // Cria um ID único
    description: req.body.description,
    priority: req.body.priority,
    execution_status: "pending",
    created_by: req.body.created_by,
    created_by_name: req.body.created_by_name,
    created_at: new Date().toISOString()
  };
  
  tasks.unshift(newTask); // Guarda a tarefa no topo da lista
  res.status(201).json(newTask); // Devolve o sucesso para a tela!
});

// Rota para BUSCAR as tarefas pendentes ao abrir o app
app.get('/tasks', (req, res) => {
  const pendentes = tasks.filter(t => t.execution_status !== "completed");
  res.json(pendentes);
});

// Rota para BUSCAR o histórico de tarefas concluídas
app.get('/tasks/history', (req, res) => {
  const concluidas = tasks.filter(t => t.execution_status === "completed");
  res.json(concluidas);
});

// Rota para o Chat (Buscar mensagens antigas)
app.get('/messages', (req, res) => {
  res.json(messages);
});

// Rota para Usuários (Evitar erro na hora de mencionar alguém)
app.get('/users', (req, res) => {
  res.json([]);
});

// ==========================================
// 🔌 CHAT EM TEMPO REAL (Socket.io)
// ==========================================
io.on('connection', (socket) => {
  console.log('🟢 Alguém conectou:', socket.id);
  
  // Quando alguém envia uma mensagem no chat
  socket.on('send_message', (data) => {
    const newMessage = { ...data, message_id: Date.now().toString() };
    messages.push(newMessage);
    io.emit('new_message', newMessage); // Espalha a mensagem para todos
  });

  // Quando uma tarefa nova é criada, avisa todo mundo
  socket.on('send_task', (data) => {
    io.emit('new_task', data);
  });
});

// Liga o Motor
const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
  console.log(`🚀 Motor rodando na porta ${PORT}`);
});
