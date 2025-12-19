// server.js
const path = require("path");
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// 1) STATIK SERVIS (ASIL OLAY BU)
// public klasörünü root’tan yayınlıyoruz:
// public/css/cards.css  ->  /css/cards.css
// public/styles.css     ->  /styles.css
// public/client.js      ->  /client.js
app.use(express.static(path.join(__dirname, "public")));

// Ana sayfa
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ---------------------
// OYUN STATE (memory)
// ---------------------
const rooms = new Map(); // roomCode -> { players: Map(socketId->player), deck: [], discard: card|null }

function makeRoomCode(len = 6) {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let out = "";
    for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
    return out;
}

function newDeck() {
    // Basit UNO deste (demo): 0-9 renkli kartlar + birkaç aksiyon örneği
    const colors = ["Kırmızı", "Mavi", "Yeşil", "Sarı"];
    const deck = [];

    // 0-9
    for (const c of colors) {
        for (let n = 0; n <= 9; n++) {
            deck.push({ type: "number", color: c, value: String(n) });
            if (n !== 0) deck.push({ type: "number", color: c, value: String(n) }); // 2 adet
        }
        // +2, Pas, Yön Değiştir (örnek)
        deck.push({ type: "action", color: c, value: "+2" });
        deck.push({ type: "action", color: c, value: "+2" });
        deck.push({ type: "action", color: c, value: "Pas" });
        deck.push({ type: "action", color: c, value: "Pas" });
        deck.push({ type: "action", color: c, value: "Yön" });
        deck.push({ type: "action", color: c, value: "Yön" });
    }

    // Siyah kartlar (örnek)
    deck.push({ type: "wild", color: "Siyah", value: "Renk Seç" });
    deck.push({ type: "wild", color: "Siyah", value: "Renk Seç" });
    deck.push({ type: "wild", color: "Siyah", value: "+4" });
    deck.push({ type: "wild", color: "Siyah", value: "+4" });

    // Karıştır
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }

    return deck;
}

function cardToString(card) {
    // Senin HTML’de data-card örnekleri: "Kırmızı 5" gibi
    if (!card) return "";
    if (card.color === "Siyah") return `${card.value}`; // "+4", "Renk Seç" gibi
    return `${card.color} ${card.value}`;
}

function getRoomPublicState(roomCode) {
    const room = rooms.get(roomCode);
    if (!room) return null;

    const players = Array.from(room.players.values()).map((p) => ({
        id: p.id,
        name: p.name,
    }));

    return {
        roomCode,
        players,
        discard: room.discard ? cardToString(room.discard) : null,
        deckCount: room.deck.length,
    };
}

function ensureRoom(code) {
    if (!rooms.has(code)) {
        rooms.set(code, { players: new Map(), deck: newDeck(), discard: null });
    }
    return rooms.get(code);
}

function dealCard(room) {
    if (room.deck.length === 0) room.deck = newDeck();
    return room.deck.pop();
}

// ---------------------
// SOCKETS
// ---------------------
io.on("connection", (socket) => {
    socket.data.roomCode = null;
    socket.data.name = null;
    socket.data.hand = []; // kart string listesi

    // CREATE ROOM
    socket.on("createRoom", ({ name } = {}) => {
        const playerName = (name || "").trim() || "Player";

        let code = makeRoomCode();
        while (rooms.has(code)) code = makeRoomCode();

        const room = ensureRoom(code);

        socket.join(code);
        socket.data.roomCode = code;
        socket.data.name = playerName;

        room.players.set(socket.id, { id: socket.id, name: playerName });

        // 7 kart dağıt
        socket.data.hand = [];
        for (let i = 0; i < 7; i++) socket.data.hand.push(cardToString(dealCard(room)));

        // client tarafına state
        socket.emit("roomJoined", { roomCode: code, name: playerName });
        socket.emit("hand", { cards: socket.data.hand });

        io.to(code).emit("roomUpdate", getRoomPublicState(code));
    });

    // JOIN ROOM
    socket.on("joinRoom", ({ roomCode, name } = {}) => {
        const code = (roomCode || "").trim().toUpperCase();
        const playerName = (name || "").trim() || "Player";

        if (!code || !rooms.has(code)) {
            socket.emit("errorMsg", { message: "Oda bulunamadı." });
            return;
        }

        const room = rooms.get(code);

        socket.join(code);
        socket.data.roomCode = code;
        socket.data.name = playerName;

        room.players.set(socket.id, { id: socket.id, name: playerName });

        // 7 kart dağıt
        socket.data.hand = [];
        for (let i = 0; i < 7; i++) socket.data.hand.push(cardToString(dealCard(room)));

        socket.emit("roomJoined", { roomCode: code, name: playerName });
        socket.emit("hand", { cards: socket.data.hand });

        io.to(code).emit("roomUpdate", getRoomPublicState(code));
    });

    // DRAW CARD
    socket.on("drawCard", () => {
        const code = socket.data.roomCode;
        if (!code || !rooms.has(code)) return;

        const room = rooms.get(code);

        const c = cardToString(dealCard(room));
        socket.data.hand.push(c);

        socket.emit("hand", { cards: socket.data.hand });
        io.to(code).emit("roomUpdate", getRoomPublicState(code));
    });

    // PLAY CARD
    socket.on("play", ({ card } = {}) => {
        const code = socket.data.roomCode;
        if (!code || !rooms.has(code)) return;

        const cardStr = (card || "").trim();
        if (!cardStr) return;

        // elinde var mı?
        const idx = socket.data.hand.indexOf(cardStr);
        if (idx === -1) return;

        // discard'a koy
        const room = rooms.get(code);
        room.discard = { type: "raw", color: "", value: cardStr }; // string taşıyoruz

        // elden çıkar
        socket.data.hand.splice(idx, 1);

        // güncelle
        socket.emit("hand", { cards: socket.data.hand });
        io.to(code).emit("discardUpdate", { card: cardStr, by: socket.data.name });
        io.to(code).emit("roomUpdate", getRoomPublicState(code));
    });

    // DISCONNECT
    socket.on("disconnect", () => {
        const code = socket.data.roomCode;
        if (!code || !rooms.has(code)) return;

        const room = rooms.get(code);
        room.players.delete(socket.id);

        // oda boşsa sil
        if (room.players.size === 0) {
            rooms.delete(code);
            return;
        }

        io.to(code).emit("roomUpdate", getRoomPublicState(code));
    });
});

// ---------------------
// LISTEN
// ---------------------
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
