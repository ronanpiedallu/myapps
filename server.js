const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const multer = require("multer");
const { v4: uuidv4 } = require("uuid");
const path = require("path");
const fs = require("fs");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;
const DB_FILE = "files.json";

// =========================
// 📁 STATIC
// =========================
app.use("/flow", express.static("flow/public"));
app.use("/uploads", express.static("uploads"));

// =========================
// 🔁 FLOW (Socket.io)
// =========================
const flowIO = io.of("/flow");

let messages = [];

flowIO.on("connection", (socket) => {
  socket.emit("history", messages);

  socket.on("send", (data) => {
    messages.push(data);
    flowIO.emit("new", data);
  });
});

// =========================
// 📦 FILES SYSTEM (TON CODE)
// =========================

// ====== DATABASE ======
function loadDB() {
  if (!fs.existsSync(DB_FILE)) return {};
  return JSON.parse(fs.readFileSync(DB_FILE));
}

function saveDB(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

let files = loadDB();

// ====== UPLOAD CONFIG ======
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    const id = uuidv4();
    const ext = path.extname(file.originalname);
    cb(null, id + ext);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 1024 * 1024 * 1024 }
});

// ====== FRONTEND FILES ======
app.get("/files", (req, res) => {
  res.send(`
    <h2>📤 Upload fichier</h2>
    <form action="/files/upload" method="post" enctype="multipart/form-data">
      <input type="file" name="file" required />
      <button>Upload</button>
    </form>
    <hr>
    <h3>📁 Fichiers</h3>
    <div id="list"></div>

    <script>
      async function loadFiles() {
        const res = await fetch("/files/list");
        const data = await res.json();

        const container = document.getElementById("list");
        container.innerHTML = "";

        Object.entries(data).forEach(([id, file]) => {
          const link = location.origin + "/files/f/" + id;

          const div = document.createElement("div");
          div.innerHTML = \`
            <p>
              📄 \${file.originalName} 
              (<b>\${file.downloads || 0}</b> téléchargements)
              <br>
              <a href="\${link}" target="_blank">\${link}</a>
              <br>
              <button onclick="copy('\${link}')">Copier</button>
              <button onclick="del('\${id}')">Supprimer</button>
            </p>
            <hr>
          \`;
          container.appendChild(div);
        });
      }

      function copy(text) {
        navigator.clipboard.writeText(text);
        alert("Lien copié !");
      }

      async function del(id) {
        await fetch("/files/delete/" + id, { method: "DELETE" });
        loadFiles();
      }

      loadFiles();
    </script>
  `);
});

// ====== UPLOAD ======
app.post("/flow/upload", upload.single("file"), (req, res) => {
  const fileData = {
    type: "file",
    name: req.file.originalname,
    url: "/uploads/" + req.file.filename
  };

  messages.push(fileData);
  io.of("/flow").emit("new", fileData);

  res.json({ success: true });
});

app.post("/files/upload", upload.single("file"), (req, res) => {
  const fileId = path.parse(req.file.filename).name;

  files[fileId] = {
    path: req.file.path,
    originalName: req.file.originalname,
    downloads: 0
  };

  saveDB(files);

  const link = `${req.protocol}://${req.get("host")}/files/f/${fileId}`;

  res.send(`
    <p>✅ Upload réussi</p>
    <a href="${link}">${link}</a>
    <br><br>
    <a href="/files">⬅ Retour</a>
  `);
});

// ====== DOWNLOAD ======
app.get("/files/f/:id", (req, res) => {
  const file = files[req.params.id];

  if (!file) return res.status(404).send("Fichier introuvable");

  file.downloads++;
  saveDB(files);

  res.setHeader("Content-Disposition", `attachment; filename="${file.originalName}"`);
  res.sendFile(path.resolve(file.path));
});

// ====== LISTE ======
app.get("/files/list", (req, res) => {
  res.json(files);
});

// ====== DELETE ======
app.delete("/files/delete/:id", (req, res) => {
  const file = files[req.params.id];

  if (!file) return res.status(404).send("Introuvable");

  fs.unlinkSync(file.path);
  delete files[req.params.id];

  saveDB(files);

  res.send("Supprimé");
});

// =========================
// 🏠 HOME
// =========================
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "dashboard", "index.html"));
});
// =========================
// 🚀 START
// =========================
app.use(
  "/linkfill",
  express.static(path.join(__dirname, "LinkFill", "public"))
);
app.use(express.static(__dirname));
server.listen(PORT, () => {
  console.log("http://localhost:" + PORT);
});

