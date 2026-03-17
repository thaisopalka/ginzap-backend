const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');

const app = express();

// 1. SEGURANÇA (CORS) LIBERADA PARA O VERCEL
app.use(cors({
  origin: 'https://ginzap-app.vercel.app',
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
// 🧠 GAVETAS DE MEMÓRIA (O "Banco de Dados")
// ==========================================
let tasks = [];
let messages = [];
let users = [];
let members = [];

// ==========================================
// 🚪 PORTAS DE ENTRADA (O que o seu app procura)
// ==========================================

// Rota para o seu login não dar erro 404
app.get('/auth/me', (req, res) => {
  res.status(401).json({ detail: "Sem sessão no motor, o Firebase cuida disso!" });
});

// Rotas de Busca do Chat e Equipe
app.get('/messages', (req, res) => res.json(messages));
app.get('/users', (req, res) => res.json(users));
app.get('/members', (req, res) => res.json(members));
app.get('/members/pending', (req, res) => res.json([]));

// Rotas para Criar e Buscar Tarefas (ISSO EVITA A TELA SUMIR)
app.get('/tasks', (req, res) => {
  res.json(tasks.filter(t => t.execution_status !== "completed"));
});

app.get('/tasks/history', (req, res) => {
  res.json(tasks.filter(t => t.execution_status === "completed"));
});

app.post('/tasks', (req, res) => {
  const newTask = {
    task_id: Date.now().toString(),
    description: req.body.description || "Nova Tarefa",
    priority: req.body.priority || "MEDIA",
    execution_status: "pending",
    created_by: req.body.created_by,
    created_by_name: req.body.created_by_name || "Usuário",
    created_at: new Date().toISOString(),
    status_log: ["Criado em " + new Date().toLocaleTimeString()]
  };
  tasks.unshift(newTask); // Guarda a tarefa!
  res.status(201).json(newTask);
});

app.patch('/tasks/:id/status', (req, res) => {
  const task = tasks.find(t => t.task_id === req.params.id);
  if(task) task.execution_status = req.body.execution_status;
  res.json(task || {});
});

app.post('/upload', (req, res) => {
  res.json({ url: "https://via.placeholder.com/300" }); // Rota falsa para uploads não quebrarem
});

// ==========================================
// 🔌 CHAT EM TEMPO REAL (O "Rádio" da Equipe)
// ==========================================
io.on('connection', (socket) => {
  console.log('🟢 Alguém conectou no rádio:', socket.id);
  
  socket.on('send_message', (data) => {
    const newMessage = { ...data, message_id: Date.now().toString() };
    messages.push(newMessage);
    io.emit('new_message', newMessage); // Espalha a mensagem para todos
  });

  socket.on('send_task', (data) => {
    io.emit('new_task', data);
  });
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
  console.log(`🚀 Motor V3 rodando perfeitamente na porta ${PORT}`);
});
