const path = require("path");
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Render/Express: public klasörünü root'tan static servis et
// Bu sayede: /styles.css ve /css/cards.css çalışır
app.use(express.static(path.join(__dirname, "public")));

// Ana sayfa
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

/* =========================
   Socket.io (senin mevcut kodun neyse buraya koy)
   Aşağıyı kendi oyun event’lerinle değiştirebilirsin.
========================= */
io.on("connection", (socket) => {
    console.log("client connected:", socket.id);

    socket.on("disconnect", () => {
        console.log("client disconnected:", socket.id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log("Server running on port", PORT));