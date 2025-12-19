const express = require("express");
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// public klasörünü static olarak yayınla
app.use(express.static(path.join(__dirname, "public")));

// ana sayfa
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

// socket bağlantısı (şimdilik log)
io.on("connection", (socket) => {
    console.log("connected:", socket.id);
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log("listening on", PORT));