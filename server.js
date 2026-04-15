const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");
const nodemailer = require("nodemailer");
const mongoose = require("mongoose");
const crypto = require("crypto");

const app = express();

const FRONTEND_URL = process.env.FRONTEND_URL || "https://ginzap-app.vercel.app";
const ADMIN_EMAIL = "thaisopalka@gmail.com";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "gin6cre";

const allowedOrigins = [
  FRONTEND_URL,
  "https://ginzap-app.vercel.app",
  "http://localhost:3000",
  "http://127.0.0.1:3000"
];

// ==========================================
// CORS
// ==========================================
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error("Origem não permitida pelo CORS"));
    },
    credentials: true
  })
);

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    credentials: true
  }
});

// ==========================================
// MONGODB
// ==========================================
const MONGO_URI =
  process.env.MONGO_URI ||
  "mongodb+srv://thaisopalka_db_user:gin6cre@cluster0.npfkmy7.mongodb.net/ginzap_db?retryWrites=true&w=majority";

mongoose
  .connect(MONGO_URI)
  .then(() => console.log("🟢 MongoDB Atlas conectado com sucesso"))
  .catch((err) => console.log("🔴 Erro ao conectar no MongoDB:", err));

// ==========================================
// HELPERS
// ==========================================
const nowIso = () => new Date().toISOString();

const makeId = (prefix = "") => {
  return `${prefix}${Date.now()}_${crypto.randomBytes(6).toString("hex")}`;
};

const normalizeEmail = (email = "") => String(email).trim().toLowerCase();

const isAdminRequest = (req) => {
  const headerPass = req.headers["x-admin-password"];
  const bodyPass = req.body?.admin_password;
  const queryPass = req.query?.admin_password;
  return headerPass === ADMIN_PASSWORD || bodyPass === ADMIN_PASSWORD || queryPass === ADMIN_PASSWORD;
};

const requireAdmin = (req, res, next) => {
  if (isAdminRequest(req)) return next();
  return res.status(403).json({ error: "Acesso restrito ao administrador." });
};

const userColorByName = (name = "") => {
  const first = String(name).trim().toUpperCase();

  if (first.includes("THAÍS") || first.includes("THAIS")) return "#ec4899";
  if (first.includes("MÁRCIA") || first.includes("MARCIA")) return "#dc2626";
  if (first.includes("RODRIGO")) return "#2563eb";
  if (first.includes("MICHELLE")) return "#7c3aed";
  if (first.includes("SOLANGE")) return "#ca8a04";

  return "#1d4ed8";
};

const buildMagicPayloadBase64 = ({ token, email, name, exp }) => {
  const payload = { token, email, name, exp };
  return Buffer.from(JSON.stringify(payload)).toString("base64");
};

const reminderToMs = (reminder) => {
  const val = String(reminder || "").trim().toLowerCase();

  if (["7dias", "7 dias", "7_dias", "7d"].includes(val)) return 7 * 24 * 60 * 60 * 1000;
  if (["3dias", "3 dias", "3_dias", "3d"].includes(val)) return 3 * 24 * 60 * 60 * 1000;
  if (["2dias", "2 dias", "2_dias", "2d"].includes(val)) return 2 * 24 * 60 * 60 * 1000;
  if (["1dia", "1 dia", "1_dia", "1d", "amanhã", "amanha"].includes(val)) return 1 * 24 * 60 * 60 * 1000;
  if (["proprio_dia", "próprio dia", "proprio dia", "no próprio dia", "no proprio dia", "hoje"].includes(val)) return 0;

  return null;
};

// ==========================================
// TRANSPORTER DE E-MAIL
// ==========================================
let transporter = null;

if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
  transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });
} else {
  console.log("🟡 EMAIL_USER / EMAIL_PASS não configurados. O link mágico será gerado, mas o envio por e-mail ficará desativado.");
}

// ==========================================
// SCHEMAS
// ==========================================
const MessageSchema = new mongoose.Schema(
  {
    message_id: { type: String, unique: true, sparse: true, index: true },
    sender_name: String,
    sender_email: String,
    sender_picture: String,
    sender_color: String,
    content: String,
    image_url: String,
    message_type: String,
    reply_to_sender: String,
    reply_to_content: String,
    special_type: String,
    priority: String,
    created_at: String,
    updated_at: String,
    deleted_for_all: { type: Boolean, default: false }
  },
  { strict: false, versionKey: false }
);

const TaskSchema = new mongoose.Schema(
  {
    task_id: { type: String, unique: true, sparse: true, index: true },
    description: String,
    notes: String,
    created_by_name: String,
    created_by_email: String,
    execution_status: String,
    created_at: String,
    updated_at: String
  },
  { strict: false, versionKey: false }
);

const UserSchema = new mongoose.Schema(
  {
    email: { type: String, unique: true, sparse: true, index: true },
    name: String,
    picture: String,
    role: { type: String, default: "user" },
    approved: { type: Boolean, default: false },
    blocked: { type: Boolean, default: false },
    deleted: { type: Boolean, default: false },
    color: String,
    created_at: String,
    updated_at: String,
    last_seen_at: String
  },
  { strict: false, versionKey: false }
);

const MagicLinkSchema = new mongoose.Schema(
  {
    token: { type: String, unique: true, sparse: true, index: true },
    email: String,
    name: String,
    created_by: String,
    used: { type: Boolean, default: false },
    expires_at: Date,
    created_at: String
  },
  { strict: false, versionKey: false }
);

const EventSchema = new mongoose.Schema(
  {
    event_id: { type: String, unique: true, sparse: true, index: true },
    date: String,
    time: String,
    subject: String,
    emoji: String,
    reminder: String,
    created_by_name: String,
    created_by_email: String,
    notes: String,
    created_at: String,
    updated_at: String,
    reminders_sent: { type: Object, default: {} }
  },
  { strict: false, versionKey: false }
);

const Message = mongoose.model("Message", MessageSchema);
const Task = mongoose.model("Task", TaskSchema);
const User = mongoose.model("User", UserSchema);
const MagicLink = mongoose.model("MagicLink", MagicLinkSchema);
const Event = mongoose.model("Event", EventSchema);

// ==========================================
// FUNÇÕES DE USUÁRIO
// ==========================================
async function upsertUserFromLogin(data = {}) {
  const email = normalizeEmail(data.email);
  if (!email) return null;

  const current = await User.findOne({ email });

  const payload = {
    email,
    name: data.name || current?.name || email,
    picture: data.picture || current?.picture || `https://api.dicebear.com/7.x/avataaars/svg?seed=${email}`,
    role: email === ADMIN_EMAIL ? "admin" : current?.role || "user",
    approved: email === ADMIN_EMAIL ? true : current?.approved ?? false,
    blocked: current?.blocked ?? false,
    deleted: current?.deleted ?? false,
    color: userColorByName(data.name || current?.name || email),
    created_at: current?.created_at || nowIso(),
    updated_at: nowIso(),
    last_seen_at: nowIso()
  };

  const saved = await User.findOneAndUpdate({ email }, payload, {
    upsert: true,
    new: true,
    setDefaultsOnInsert: true
  });

  io.emit("users_updated", { type: "upsert", user: saved });
  return saved;
}

// ==========================================
// HEALTHCHECK
// ==========================================
app.get("/", (req, res) => {
  res.json({
    ok: true,
    service: "ginzap-backend",
    time: nowIso()
  });
});

app.get("/health", (req, res) => {
  res.json({
    ok: true,
    mongo: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
    time: nowIso()
  });
});

// ==========================================
// USUÁRIOS
// ==========================================
app.post("/users/register", async (req, res) => {
  try {
    const user = await upsertUserFromLogin(req.body || {});
    if (!user) return res.status(400).json({ error: "E-mail inválido." });
    return res.json(user);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

// ROTA PÚBLICA PARA O FRONTEND
app.get("/users", async (req, res) => {
  try {
    const users = await User.find(
      { deleted: { $ne: true } },
      { _id: 0, email: 1, name: 1, approved: 1, role: 1, picture: 1, blocked: 1 }
    ).sort({ name: 1, email: 1 });

    return res.json(users || []);
  } catch (e) {
    console.log("Erro ao listar usuários:", e);
    return res.status(500).json([]);
  }
});

// ROTA ADMIN SEPARADA
app.get("/admin/users", requireAdmin, async (req, res) => {
  try {
    const users = await User.find().sort({ name: 1, email: 1 });
    return res.json(users);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

app.get("/users/status", async (req, res) => {
  try {
    const email = normalizeEmail(req.query.email);

    if (!email) {
      return res.json({ approved: false, blocked: false, exists: false });
    }

    if (email === ADMIN_EMAIL) {
      return res.json({
        approved: true,
        blocked: false,
        exists: true,
        role: "admin"
      });
    }

    const user = await User.findOne({ email });

    return res.json({
      approved: !!(user && user.approved && !user.blocked && !user.deleted),
      blocked: !!user?.blocked,
      exists: !!user,
      role: user?.role || "user"
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

app.post("/users/block", requireAdmin, async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    if (!email) return res.status(400).json({ error: "E-mail obrigatório." });

    const user = await User.findOneAndUpdate(
      { email },
      {
        blocked: true,
        approved: false,
        deleted: true,
        updated_at: nowIso()
      },
      { new: true, upsert: true }
    );

    io.emit("users_updated", { type: "blocked", user });
    io.emit("user_blocked", { email });

    return res.json({ success: true, user });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

app.post("/users/unblock", requireAdmin, async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    if (!email) return res.status(400).json({ error: "E-mail obrigatório." });

    const user = await User.findOneAndUpdate(
      { email },
      {
        blocked: false,
        approved: true,
        deleted: false,
        updated_at: nowIso()
      },
      { new: true }
    );

    io.emit("users_updated", { type: "unblocked", user });

    return res.json({ success: true, user });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

app.delete("/users/:email", requireAdmin, async (req, res) => {
  try {
    const email = normalizeEmail(decodeURIComponent(req.params.email));

    const user = await User.findOneAndUpdate(
      { email },
      {
        blocked: true,
        approved: false,
        deleted: true,
        updated_at: nowIso()
      },
      { new: true, upsert: true }
    );

    await MagicLink.deleteMany({ email });

    io.emit("users_updated", { type: "deleted", user });
    io.emit("user_blocked", { email });

    return res.json({ success: true, user });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

// ==========================================
// LINK MÁGICO
// ==========================================
app.post("/magic-links/create", requireAdmin, async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const name = String(req.body.name || "").trim() || email;
    const sendEmail = req.body.send_email !== false;

    if (!email) {
      return res.status(400).json({ error: "E-mail obrigatório." });
    }

    await User.findOneAndUpdate(
      { email },
      {
        email,
        name,
        role: email === ADMIN_EMAIL ? "admin" : "user",
        approved: false,
        blocked: false,
        deleted: false,
        color: userColorByName(name),
        updated_at: nowIso(),
        created_at: nowIso()
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true
      }
    );

    const rawToken = crypto.randomBytes(32).toString("hex");
    const exp = Date.now() + 3 * 24 * 60 * 60 * 1000;

    await MagicLink.create({
      token: rawToken,
      email,
      name,
      created_by: ADMIN_EMAIL,
      used: false,
      expires_at: new Date(exp),
      created_at: nowIso()
    });

    const tokenBase64 = buildMagicPayloadBase64({
      token: rawToken,
      email,
      name,
      exp
    });

    const link = `${FRONTEND_URL}/login?token=${encodeURIComponent(tokenBase64)}`;

    if (sendEmail && transporter) {
      await transporter.sendMail({
        from: `"GinZap" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: "Seu acesso ao GinZap",
        html: `
          <div style="font-family: Arial, sans-serif; line-height:1.5;">
            <h2 style="color:#2563eb;">Acesso ao GinZap</h2>
            <p>Olá, <strong>${name}</strong>.</p>
            <p>Seu link mágico de acesso foi gerado.</p>
            <p>
              <a href="${link}" style="display:inline-block;background:#2563eb;color:#fff;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:bold;">
                Entrar no GinZap
              </a>
            </p>
            <p>Este link expira em 3 dias.</p>
          </div>
        `
      });
    }

    io.emit("users_updated", { type: "magic_link_created", email, name });

    return res.json({
      success: true,
      email,
      name,
      link,
      expires_at: new Date(exp).toISOString(),
      emailed: !!(sendEmail && transporter)
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

app.post("/magic-links/validate", async (req, res) => {
  try {
    const token = String(req.body.token || "").trim();
    const email = normalizeEmail(req.body.email);

    if (!token) {
      return res.status(400).json({ valid: false, error: "Token ausente." });
    }

    const magic = await MagicLink.findOne({ token });

    if (!magic) {
      return res.status(404).json({ valid: false, error: "Link não encontrado." });
    }

    if (magic.used) {
      return res.status(400).json({ valid: false, error: "Este link já foi usado." });
    }

    if (new Date(magic.expires_at).getTime() < Date.now()) {
      return res.status(400).json({ valid: false, error: "Este link expirou." });
    }

    if (email && magic.email !== email) {
      return res.status(403).json({ valid: false, error: "E-mail não confere com o link." });
    }

    const user = await User.findOneAndUpdate(
      { email: magic.email },
      {
        approved: true,
        blocked: false,
        deleted: false,
        role: magic.email === ADMIN_EMAIL ? "admin" : "user",
        updated_at: nowIso(),
        last_seen_at: nowIso()
      },
      { new: true, upsert: true }
    );

    if (user.blocked || user.deleted) {
      return res.status(403).json({ valid: false, error: "Acesso bloqueado." });
    }

    magic.used = true;
    await magic.save();

    io.emit("users_updated", { type: "approved", user });

    return res.json({
      valid: true,
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
        picture: user.picture || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.email}`,
        color: user.color || userColorByName(user.name)
      }
    });
  } catch (e) {
    return res.status(500).json({ valid: false, error: e.message });
  }
});

// ==========================================
// MENSAGENS
// ==========================================
app.get("/messages", async (req, res) => {
  try {
    const msgs = await Message.find({ deleted_for_all: { $ne: true } }).sort({ created_at: 1 });
    return res.json(msgs);
  } catch (e) {
    return res.status(500).json([]);
  }
});

app.post("/messages", async (req, res) => {
  try {
    const payload = {
      ...req.body,
      message_id: req.body.message_id || makeId("msg_"),
      created_at: req.body.created_at || nowIso(),
      updated_at: nowIso(),
      sender_color: req.body.sender_color || userColorByName(req.body.sender_name)
    };

    const msg = await Message.create(payload);

    io.emit("new_message", msg);

    return res.status(201).json(msg);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

app.put("/messages/:id", async (req, res) => {
  try {
    const msg = await Message.findOneAndUpdate(
      { message_id: req.params.id },
      {
        ...req.body,
        updated_at: nowIso()
      },
      { new: true }
    );

    if (msg) io.emit("edit_message", msg);

    return res.json(msg || {});
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

app.delete("/messages/:id", async (req, res) => {
  try {
    await Message.findOneAndDelete({ message_id: req.params.id });
    io.emit("delete_message", req.params.id);
    return res.json({ success: true });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

// ==========================================
// TAREFAS / VISITAS / CONFIGURAÇÕES
// ==========================================
app.get("/tasks", async (req, res) => {
  try {
    const tasks = await Task.find().sort({ created_at: -1 });
    return res.json(tasks);
  } catch (e) {
    return res.status(500).json([]);
  }
});

app.post("/tasks", async (req, res) => {
  try {
    const payload = {
      task_id: req.body.task_id || `task_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      ...req.body,
      created_at: req.body.created_at || nowIso(),
      updated_at: nowIso()
    };

    const task = await Task.create(payload);
    io.emit("new_task", task);
    return res.status(201).json(task);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

app.put("/tasks/:id", async (req, res) => {
  try {
    const task = await Task.findOneAndUpdate(
      { $or: [{ task_id: req.params.id }, { id: req.params.id }, { _id: req.params.id }] },
      { ...req.body, updated_at: nowIso() },
      { new: true }
    );

    if (task) io.emit("new_task", task);
    return res.json(task || {});
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

app.patch("/tasks/:id/status", async (req, res) => {
  try {
    const task = await Task.findOneAndUpdate(
      { $or: [{ task_id: req.params.id }, { id: req.params.id }, { _id: req.params.id }] },
      { execution_status: req.body.execution_status, updated_at: nowIso() },
      { new: true }
    );

    if (task) io.emit("new_task", task);
    return res.json(task || {});
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

app.delete("/tasks/:id", async (req, res) => {
  try {
    const deleted = await Task.findOneAndDelete({
      $or: [{ task_id: req.params.id }, { id: req.params.id }, { _id: req.params.id }]
    });

    if (deleted) io.emit("delete_task", req.params.id);
    return res.json({ success: true });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

// ==========================================
// AGENDA
// ==========================================
app.get("/events", async (req, res) => {
  try {
    const events = await Event.find().sort({ date: 1, time: 1 });
    return res.json(events);
  } catch (e) {
    return res.status(500).json([]);
  }
});

app.post("/events", async (req, res) => {
  try {
    const payload = {
      ...req.body,
      event_id: req.body.event_id || makeId("event_"),
      created_at: req.body.created_at || nowIso(),
      updated_at: nowIso(),
      reminders_sent: req.body.reminders_sent || {}
    };

    const event = await Event.create(payload);

    io.emit("sync_agenda", { type: "created", event });

    return res.status(201).json(event);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

app.put("/events/:id", async (req, res) => {
  try {
    const event = await Event.findOneAndUpdate(
      { event_id: req.params.id },
      { ...req.body, updated_at: nowIso() },
      { new: true }
    );

    if (event) io.emit("sync_agenda", { type: "updated", event });

    return res.json(event || {});
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

app.delete("/events/:id", async (req, res) => {
  try {
    await Event.findOneAndDelete({ event_id: req.params.id });
    io.emit("sync_agenda", { type: "deleted", event_id: req.params.id });
    return res.json({ success: true });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

// ==========================================
// LEMBRETES DA AGENDA
// ==========================================
async function processAgendaReminders() {
  try {
    const events = await Event.find();

    for (const event of events) {
      const reminderMs = reminderToMs(event.reminder);
      if (reminderMs === null) continue;
      if (!event.date) continue;

      const time = event.time && /^\d{2}:\d{2}$/.test(event.time) ? event.time : "09:00";
      const eventDate = new Date(`${event.date}T${time}:00`);
      if (Number.isNaN(eventDate.getTime())) continue;

      const triggerDate = new Date(eventDate.getTime() - reminderMs);
      const now = new Date();

      const key = String(event.reminder || "sem_lembrete");
      const alreadySent = event.reminders_sent?.[key];
      const diff = Math.abs(now.getTime() - triggerDate.getTime());

      if (!alreadySent && diff <= 60000) {
        io.emit("agenda_alarm", {
          event_id: event.event_id,
          subject: event.subject,
          date: event.date,
          time: event.time,
          emoji: event.emoji,
          reminder: event.reminder
        });

        event.reminders_sent = {
          ...(event.reminders_sent || {}),
          [key]: true
        };

        await event.save();
      }
    }
  } catch (e) {
    console.log("Erro no processador de lembretes:", e.message);
  }
}

setInterval(processAgendaReminders, 30000);

// ==========================================
// COMPATIBILIDADE COM O FLUXO ANTIGO
// ==========================================
app.post("/request-approval", async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const name = String(req.body.name || "").trim() || email;

    if (!email) {
      return res.status(400).json({ error: "E-mail obrigatório." });
    }

    await User.findOneAndUpdate(
      { email },
      {
        email,
        name,
        approved: false,
        blocked: false,
        deleted: false,
        role: email === ADMIN_EMAIL ? "admin" : "user",
        color: userColorByName(name),
        updated_at: nowIso(),
        created_at: nowIso()
      },
      { upsert: true, new: true }
    );

    if (transporter) {
      await transporter.sendMail({
        from: `"GinZap" <${process.env.EMAIL_USER}>`,
        to: ADMIN_EMAIL,
        subject: `Nova solicitação de acesso - ${name}`,
        html: `
          <div style="font-family: Arial, sans-serif;">
            <h2>Nova solicitação de acesso</h2>
            <p><strong>Nome:</strong> ${name}</p>
            <p><strong>E-mail:</strong> ${email}</p>
          </div>
        `
      });
    }

    io.emit("users_updated", { type: "approval_requested", email, name });

    return res.json({ success: true, message: "Solicitação enviada." });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

app.get("/approve-user", async (req, res) => {
  try {
    const email = normalizeEmail(req.query.email);
    if (!email) return res.status(400).send("E-mail não informado.");

    await User.findOneAndUpdate(
      { email },
      {
        approved: true,
        blocked: false,
        deleted: false,
        updated_at: nowIso()
      },
      { new: true, upsert: true }
    );

    io.emit("users_updated", { type: "approved_legacy", email });

    return res.send(`
      <h1 style="color:green; text-align:center; margin-top:100px; font-family:sans-serif;">
        ✅ Usuário ${email} foi aprovado!<br><br>
        Agora ele pode entrar no GinZap.
      </h1>
    `);
  } catch (e) {
    return res.status(500).send("Erro ao aprovar.");
  }
});

// ==========================================
// SOCKET.IO
// ==========================================
io.on("connection", (socket) => {
  console.log("🟢 Socket conectado:", socket.id);

  socket.on("send_message", (data) => {
    io.emit("new_message", data);
  });

  socket.on("send_task", (data) => {
    io.emit("new_task", data);
  });

  socket.on("edit_message", (data) => {
    io.emit("edit_message", data);
  });

  socket.on("delete_message", (id) => {
    io.emit("delete_message", id);
  });

  socket.on("sync_agenda", (data) => {
    io.emit("sync_agenda", data);
  });

  socket.on("delete_task", (id) => {
    io.emit("delete_task", id);
  });

  socket.on("disconnect", () => {
    console.log("🔴 Socket desconectado:", socket.id);
  });
});

// ==========================================
// START
// ==========================================
const PORT = process.env.PORT || 10000;

server.listen(PORT, () => {
  console.log(`🚀 GinZap backend rodando na porta ${PORT}`);
});
