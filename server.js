const path = require("path");
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const { nanoid } = require("nanoid");

const app = express();
const server = http.createServer(app);

// Render gibi ortamlarda sorun yaşamamak için cors açık
const io = new Server(server, {
    cors: {
        origin: true,
        methods: ["GET", "POST"],
    },
});

// public klasörünü servis et
app.use(express.static(path.join(__dirname, "public")));

// Prod ortamında PORT env’den gelir
const PORT = process.env.PORT || 3000;

// roomId -> { players: [{id,name}] }
const rooms = new Map();

function roomState(roomId) {
    const room = rooms.get(roomId);
    return { roomId, players: room ? room.players : [] };
}

// Render/Proxy arkasında gerçek IP almak istersen
app.set("trust proxy", 1);

io.on("connection", (socket) => {
    console.log("Oyuncu bağlandı:", socket.id);

    socket.on("createRoom", ({ name }, cb) => {
        const roomId = nanoid(6).toUpperCase();

        rooms.set(roomId, {
            players: [{ id: socket.id, name: (name || "Host").trim() }],
        });

        socket.join(roomId);
        console.log("CREATE room:", roomId);

        if (typeof cb === "function") cb({ ok: true, roomId });
        io.to(roomId).emit("players", roomState(roomId));
    });

    socket.on("joinRoom", ({ roomId, name }, cb) => {
        const id = String(roomId || "").trim().toUpperCase();
        const room = rooms.get(id);

        console.log("JOIN attempt:", id, "exists?", !!room);

        if (!room) {
            if (typeof cb === "function") cb({ ok: false, error: "Oda bulunamadı." });
            return;
        }

        room.players.push({ id: socket.id, name: (name || "Player").trim() });
        socket.join(id);

        if (typeof cb === "function") cb({ ok: true, roomId: id });
        io.to(id).emit("players", roomState(id));
    });

    socket.on("play", ({ roomId, card }) => {
        const id = String(roomId || "").trim().toUpperCase();
        if (!rooms.has(id)) return;
        io.to(id).emit("played", { roomId: id, card });
    });

    socket.on("disconnect", () => {
        for (const [roomId, room] of rooms.entries()) {
            room.players = room.players.filter((p) => p.id !== socket.id);

            if (room.players.length === 0) {
                rooms.delete(roomId);
            } else {
                io.to(roomId).emit("players", roomState(roomId));
            }
        }
    });
});

server.listen(PORT, () => {
    console.log(`UNO oyunu çalışıyor: http://localhost:${PORT}`);
});
