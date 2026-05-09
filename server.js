const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const multer = require("multer");
const { v4: uuidv4 } = require("uuid");
const session = require("express-session");
const bcrypt = require("bcrypt");
const path = require("path");
const fs = require("fs");
const CHECK_FILE = "checklists.json";
let checklists =
loadJSON(CHECK_FILE);

// =========================
// 🚀 INIT
// =========================

const app = express();
const server = http.createServer(app);

const io = new Server(server);

const PORT = process.env.PORT || 3000;

const DB_FILE = "files.json";
const USERS_FILE = "users.json";

// =========================
// 📦 JSON / SESSION
// =========================

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const sessionMiddleware = session({
    secret: "super-secret-key",
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false
    }
});

app.use(sessionMiddleware);

// =========================
// 🔌 SOCKET SESSION SHARE
// =========================

io.use((socket, next) => {
    sessionMiddleware(
        socket.request,
        {},
        next
    );
});

// =========================
// 📁 STATIC
// =========================
app.use(
    "/check",
    express.static(
        path.join(__dirname, "Check/public")
    )
);

app.use(
    "/flow",
    express.static(
        path.join(__dirname, "flow/public")
    )
);

app.use(
    "/linkfill",
    express.static(
        path.join(__dirname, "LinkFill/public")
    )
);

app.use(
    "/uploads",
    express.static(
        path.join(__dirname, "uploads")
    )
);

app.use(express.static(__dirname));

// =========================
// 💾 DATABASE HELPERS
// =========================

function loadJSON(file) {

    if (!fs.existsSync(file)) {
        return {};
    }

    return JSON.parse(
        fs.readFileSync(file)
    );
}

function saveJSON(file, data) {

    fs.writeFileSync(
        file,
        JSON.stringify(data, null, 2)
    );
}

let files = loadJSON(DB_FILE);
let users = loadJSON(USERS_FILE);

// =========================
// 👑 CREATE ADMIN
// =========================

async function createAdmin() {

    if(users["admin"]) return;

    const hashed =
    await bcrypt.hash(
        "admin123",
        10
    );

    users["admin"] = {

        password: hashed,

        role: "admin"

    };

    saveJSON(
        USERS_FILE,
        users
    );

    console.log(
        "👑 Admin créé"
    );

}

createAdmin();

function isAdmin(req){

    return (
        users[
            req.session.user
        ]?.role === "admin"
    );

}

// =========================
// 🔐 AUTH MIDDLEWARE
// =========================

function requireAuth(req, res, next) {

    if (!req.session.user) {
        return res
            .status(401)
            .send("Non connecté");
    }

    next();
}

// =========================
// 👤 REGISTER
// =========================

app.post("/register", async (req, res) => {

    const {
        username,
        password
    } = req.body;

    if (!username || !password) {
        return res
            .status(400)
            .send("Champs manquants");
    }

    if (users[username]) {
        return res
            .status(400)
            .send("Utilisateur existe déjà");
    }

    const hashed =
        await bcrypt.hash(password, 10);

    users[username] = {
        password: hashed
    };

    saveJSON(USERS_FILE, users);

    req.session.user = username;

    res.json({
        success: true,
        user: username
    });

});

// =========================
// 🔑 LOGIN
// =========================

app.post("/login", async (req, res) => {

    const {
        username,
        password
    } = req.body;

    const user = users[username];

    if (!user) {
        return res
            .status(400)
            .send("Utilisateur inconnu");
    }

    const valid =
        await bcrypt.compare(
            password,
            user.password
        );

    if (!valid) {
        return res
            .status(400)
            .send("Mot de passe incorrect");
    }

    req.session.user = username;

    res.json({
        success: true,
        user: username
    });

});

// =========================
// 🚪 LOGOUT
// =========================

app.get("/logout", (req, res) => {

    req.session.destroy(() => {
        res.redirect("/");
    });

});

// =========================
// 👤 CURRENT USER
// =========================

app.get("/me", (req, res) => {

    const username =
req.session.user;

res.json({

    user: username || null,

    role:
    username
    ? users[username]?.role
    : null

});

});

// =========================
// 🔁 FLOW SYSTEM
// =========================

// messages par utilisateur
let messages = {};

// namespace flow
const flowIO = io.of("/flow");

flowIO.on("connection", (socket) => {

    const session =
        socket.request?.session;

    // sécurité anti crash
    if (
        !session ||
        !session.user
    ) {

        console.log(
            "❌ Socket sans session"
        );

        return socket.disconnect();

    }

    const username =
        session.user;
    if (!messages[username]) {
        messages[username] = [];
    }

    // historique personnel
    if(
    users[username]?.role ===
    "admin"
){

    socket.emit(
        "history",
        messages
    );

} else {

    socket.emit(
        "history",
        messages[username]
    );

}

    // nouveau message
    socket.on("send", (data) => {

        messages[username].push(data);

        socket.emit(
    "new",
    data
);

    });

});

// =========================
// 📤 MULTER CONFIG
// =========================

const storage = multer.diskStorage({

    destination: (req, file, cb) => {
        cb(null, "uploads/");
    },

    filename: (req, file, cb) => {

        const id = uuidv4();

        const ext =
            path.extname(
                file.originalname
            );

        cb(null, id + ext);

    }

});

const upload = multer({

    storage,

    limits: {
        fileSize:
            1024 * 1024 * 1024
    }

});

// =========================
// 📁 FILES PAGE
// =========================

app.get(
    "/files",
    requireAuth,
    (req, res) => {

        res.sendFile(
            path.join(
                __dirname,
                "LinkFill/public/index.html"
            )
        );

    }
);

// =========================
// 📤 FLOW FILE UPLOAD
// =========================

app.post(
    "/flow/upload",
    requireAuth,
    upload.single("file"),
    (req, res) => {

        const username =
            req.session.user;

        const fileData = {

            type: "file",

            name:
                req.file.originalname,

            url:
                "/uploads/" +
                req.file.filename

        };

        if (!messages[username]) {
            messages[username] = [];
        }

        messages[username].push(
            fileData
        );

        flowIO.emit(
            "new",
            fileData
        );

        res.json({
            success: true
        });

    }
);

// =========================
// 📤 FILES UPLOAD
// =========================

app.post(
    "/files/upload",
    requireAuth,
    upload.single("file"),
    (req, res) => {

        const fileId =
            path.parse(
                req.file.filename
            ).name;

        files[fileId] = {

            path: req.file.path,

            originalName:
                req.file.originalname,

            downloads: 0,

            owner:
                req.session.user

        };

        saveJSON(DB_FILE, files);

        const link =
            `${req.protocol}://${req.get("host")}/files/f/${fileId}`;

        res.json({
            success: true,
            link
        });

    }
);

// =========================
// 📥 DOWNLOAD
// =========================

app.get(
    "/files/f/:id",
    (req, res) => {

        const file =
            files[req.params.id];

        if (!file) {
            return res
                .status(404)
                .send("Introuvable");
        }

        file.downloads++;

        saveJSON(DB_FILE, files);

        res.setHeader(
            "Content-Disposition",
            `attachment; filename="${file.originalName}"`
        );

        res.sendFile(
            path.resolve(file.path)
        );

    }
);

// =========================
// 📃 FILES LIST
// =========================

app.get(
    "/files/list",
    requireAuth,
    (req, res) => {

        const userFiles = {};

        Object.entries(files)
            .forEach(([id, file]) => {

               if (

    file.owner ===
    req.session.user

    ||

    isAdmin(req)

) {

                    userFiles[id] = file;

                }

            });

        res.json(userFiles);

    }
);

// =========================
// 🗑 DELETE FILE
// =========================

app.delete(
    "/files/delete/:id",
    requireAuth,
    (req, res) => {

        const file =
            files[req.params.id];

        if (!file) {
            return res
                .status(404)
                .send("Introuvable");
        }

        // sécurité
        if (

    file.owner !==
    req.session.user

    &&

    !isAdmin(req)

) {

            return res
                .status(403)
                .send("Interdit");

        }

        if (
            fs.existsSync(file.path)
        ) {

            fs.unlinkSync(file.path);

        }

        delete files[req.params.id];

        saveJSON(DB_FILE, files);

        res.send("Supprimé");

    }
);
// =========================
// ✅ CHECK PAGE
// =========================

app.get(
    "/check",
    requireAuth,
    (req, res) => {

        res.sendFile(
            path.join(
                __dirname,
                "Check/public/index.html"
            )
        );

    }
);

app.get(
    "/api/check",
    requireAuth,
    (req, res) => {

        const user =
        req.session.user;

        if(!checklists[user]){

            checklists[user] = [];

        }

        res.json(
            checklists[user]
        );

    }
);
app.post(
    "/api/check",
    requireAuth,
    (req, res) => {

        const user =
        req.session.user;

        if(!checklists[user]){

            checklists[user] = [];

        }

        const task = {

            id: uuidv4(),

            text: req.body.text,

            done: false

        };

        checklists[user].push(task);

        saveJSON(
            CHECK_FILE,
            checklists
        );

        res.json(task);

    }
);
app.put(
    "/api/check/:id",
    requireAuth,
    (req, res) => {

        const user =
        req.session.user;

        const task =
        checklists[user]
        ?.find(
            t => t.id === req.params.id
        );

        if(!task){

            return res
            .status(404)
            .send("Introuvable");

        }

        task.done = !task.done;

        saveJSON(
            CHECK_FILE,
            checklists
        );

        res.json(task);

    }
);

app.delete(
    "/api/check/:id",
    requireAuth,
    (req, res) => {

        const user =
        req.session.user;

        checklists[user] =
        checklists[user]
        ?.filter(
            t => t.id !== req.params.id
        );

        saveJSON(
            CHECK_FILE,
            checklists
        );

        res.send("Supprimé");

    }
);

// =========================
// 🏠 HOME
// =========================

app.get("/", (req, res) => {

    res.sendFile(
        path.join(
            __dirname,
            "dashboard",
            "index.html"
        )
    );

});

// =========================
// 🚀 START
// =========================

server.listen(PORT, () => {

    console.log(
        "🚀 http://localhost:" + PORT
    );

});