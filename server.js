const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
const nodemailer = require('nodemailer');   // ← NOVO

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
// 🚪 NOVAS ROTAS DE APROVAÇÃO (PRIVACIDADE)
// ==========================================

// Configuração do e-mail (coloque suas variáveis no Render)
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// 1. Verifica se o usuário foi aprovado
app.get('/users/status', (req, res) => {
  const { email } = req.query;
  const user = users.find(u => u.email === email);
  const approved = user ? user.approved : false;
  res.json({ approved: approved || email === "thaisopalka@gmail.com" });
});

// 2. Usuário pede aprovação (envia e-mail para você)
app.post('/request-approval', (req, res) => {
  const { email, name } = req.body;
  
  // Salva no array de usuários
  let user = users.find(u => u.email === email);
  if (!user) {
    user = { email, name, approved: false };
    users.push(user);
  }

  // Envia e-mail para você
  transporter.sendMail({
    from: '"GinZap" <thaisopalka@gmail.com>',
    to: "thaisopalka@gmail.com",
    subject: `✅ Nova solicitação de acesso - ${name}`,
    html: `
      <h2>Nova pessoa quer entrar no GinZap!</h2>
      <p><strong>Nome:</strong> ${name}</p>
      <p><strong>Email:</strong> ${email}</p>
      <p>Clique aqui para aprovar:</p>
      <a href="https://ginzap-backend.onrender.com/approve-user?email=${email}" 
         style="background:#10b981;color:white;padding:15px 25px;text-decoration:none;border-radius:8px;font-size:16px;">
        ✅ APROVAR AGORA
      </a>
    `
  }).catch(err => console.log("Erro no e-mail:", err));

  res.json({ success: true, message: "Solicitação enviada!" });
});

// 3. Você clica no link do e-mail e aprova
app.get('/approve-user', (req, res) => {
  const { email } = req.query;
  const user = users.find(u => u.email === email);
  if (user) user.approved = true;

  res.send(`
    <h1 style="color:green; text-align:center; margin-top:100px; font-family:sans-serif;">
      ✅ Usuário ${email} foi aprovado!<br><br>
      Agora ele pode entrar no GinZap.
    </h1>
  `);
});

// ==========================================
// PORTAS DE ENTRADA ANTIGAS (mantidas)
// ==========================================
app.get('/auth/me', (req, res) => {
  res.status(401).json({ detail: "Sem sessão no motor, o Firebase cuida disso!" });
});

app.get('/messages', (req, res) => res.json(messages));
app.get('/users', (req, res) => res.json(users));
app.get('/members', (req, res) => res.json(members));
app.get('/members/pending', (req, res) => res.json([]));

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
  tasks.unshift(newTask);
  res.status(201).json(newTask);
});

app.patch('/tasks/:id/status', (req, res) => {
  const task = tasks.find(t => t.task_id === req.params.id);
  if(task) task.execution_status = req.body.execution_status;
  res.json(task || {});
});

app.post('/upload', (req, res) => {
  res.json({ url: "https://via.placeholder.com/300" });
});

// ==========================================
// CHAT EM TEMPO REAL
// ==========================================
io.on('connection', (socket) => {
  console.log('🟢 Alguém conectou no rádio:', socket.id);
 
  socket.on('send_message', (data) => {
    const newMessage = { ...data, message_id: Date.now().toString() };
    messages.push(newMessage);
    io.emit('new_message', newMessage);
  });
  socket.on('send_task', (data) => {
    io.emit('new_task', data);
  });
});

// ==========================================
// INICIA O SERVIDOR
// ==========================================
const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
  console.log(`🚀 Motor V3 rodando perfeitamente na porta ${PORT}`);
});
