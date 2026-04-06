const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
const nodemailer = require('nodemailer');
const mongoose = require('mongoose'); // ← MONGODB AQUI!

const app = express();

// 1. SEGURANÇA (CORS) LIBERADA PARA O VERCEL
app.use(cors({
  origin: 'https://ginzap-app.vercel.app',
  credentials: true
}));

// Aumentamos o limite para 50mb por causa das fotos dos relatórios!
app.use(express.json({ limit: '50mb' })); 
app.use(express.urlencoded({ limit: '50mb', extended: true }));

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: 'https://ginzap-app.vercel.app',
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    credentials: true
  }
});

// ==========================================
// 🧠 BANCO DE DADOS DEFINITIVO (NUVEM)
// ==========================================
// Pega a URL do painel do Render, ou usa uma de segurança (não deixe a senha exposta depois!)
const MONGO_URI = process.env.MONGO_URI || "mongodb+srv://thaisopalka_db_user:gin6cre@cluster0.npfkmy7.mongodb.net/ginzap_db?retryWrites=true&w=majority";

mongoose.connect(MONGO_URI)
  .then(() => console.log('🟢 MongoDB Atlas Conectado com Sucesso!'))
  .catch(err => console.log('🔴 Erro ao conectar no MongoDB:', err));

// Esquemas Flexíveis (strict: false permite que o frontend envie qualquer campo sem quebrar)
const TaskSchema = new mongoose.Schema({}, { strict: false });
const Task = mongoose.model('Task', TaskSchema);

const MessageSchema = new mongoose.Schema({}, { strict: false });
const Message = mongoose.model('Message', MessageSchema);

const UserSchema = new mongoose.Schema({ email: String, name: String, approved: Boolean }, { strict: false });
const User = mongoose.model('User', UserSchema);

// ==========================================
// 🚪 ROTAS DE APROVAÇÃO (PRIVACIDADE)
// ==========================================
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

app.get('/users/status', async (req, res) => {
  try {
    const { email } = req.query;
    const user = await User.findOne({ email });
    const approved = user ? user.approved : false;
    res.json({ approved: approved || email === "thaisopalka@gmail.com" });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/request-approval', async (req, res) => {
  try {
    const { email, name } = req.body;
    let user = await User.findOne({ email });
    if (!user) {
      user = await User.create({ email, name, approved: false });
    }
    
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
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/approve-user', async (req, res) => {
  try {
    const { email } = req.query;
    await User.findOneAndUpdate({ email }, { approved: true });
    res.send(`
      <h1 style="color:green; text-align:center; margin-top:100px; font-family:sans-serif;">
        ✅ Usuário ${email} foi aprovado!<br><br>
        Agora ele pode entrar no GinZap.
      </h1>
    `);
  } catch(e) { res.status(500).send("Erro ao aprovar."); }
});

// ==========================================
// 💬 ROTAS DE MENSAGENS E CHAT
// ==========================================
app.get('/messages', async (req, res) => {
  try { const msgs = await Message.find(); res.json(msgs); } 
  catch(e) { res.status(500).json([]); }
});

app.post('/messages', async (req, res) => {
  try { const msg = await Message.create(req.body); res.status(201).json(msg); } 
  catch(e) { res.status(500).json({ error: e.message }); }
});

app.put('/messages/:id', async (req, res) => {
  try { 
    const msg = await Message.findOneAndUpdate({ message_id: req.params.id }, req.body, { new: true });
    res.json(msg || {}); 
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.delete('/messages/:id', async (req, res) => {
  try { 
    await Message.findOneAndDelete({ message_id: req.params.id }); 
    res.json({ success: true }); 
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ==========================================
// ✅ ROTAS DE TAREFAS E VISITAS
// ==========================================
app.get('/tasks', async (req, res) => {
  try { const tasks = await Task.find(); res.json(tasks); } 
  catch(e) { res.status(500).json([]); }
});

app.post('/tasks', async (req, res) => {
  try { const task = await Task.create(req.body); res.status(201).json(task); } 
  catch(e) { res.status(500).json({ error: e.message }); }
});

app.put('/tasks/:id', async (req, res) => {
  try { 
    const task = await Task.findOneAndUpdate(
      { $or: [{ task_id: req.params.id }, { id: req.params.id }] }, 
      req.body, { new: true }
    );
    res.json(task || {}); 
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.patch('/tasks/:id/status', async (req, res) => {
  try {
    const task = await Task.findOneAndUpdate(
      { $or: [{ task_id: req.params.id }, { id: req.params.id }] }, 
      { execution_status: req.body.execution_status }, { new: true }
    );
    res.json(task || {});
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.delete('/tasks/:id', async (req, res) => {
  try {
    await Task.findOneAndDelete({ $or: [{ task_id: req.params.id }, { id: req.params.id }] });
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ==========================================
// CHAT EM TEMPO REAL (SOCKET.IO)
// ==========================================
io.on('connection', (socket) => {
  console.log('🟢 Alguém conectou no rádio:', socket.id);
  
  socket.on('send_message', (data) => {
    io.emit('new_message', data); // Agora o frontend que gera a ID, então apenas repassamos
  });
  socket.on('send_task', (data) => {
    io.emit('new_task', data);
  });
  socket.on('edit_message', (data) => {
    io.emit('edit_message', data);
  });
  socket.on('delete_message', (id) => {
    io.emit('delete_message', id);
  });
  socket.on('sync_agenda', (data) => {
    io.emit('sync_agenda', data);
  });
});

// ==========================================
// INICIA O SERVIDOR
// ==========================================
const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
  console.log(`🚀 Motor MongoDB rodando perfeitamente na porta ${PORT}`);
});
