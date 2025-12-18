const socket = io();

let currentRoom = null;

function setStatus(msg) {
    const el = document.getElementById("status");
    if (el) el.textContent = msg;
}

function getName() {
    const el = document.getElementById("name");
    const name = el ? el.value.trim() : "";
    return name || "Player";
}

function setRoomUI(roomId) {
    document.getElementById("roomCode").textContent = roomId || "-";
    document.getElementById("roomBadgeCode").textContent = roomId || "-";
    if (roomId) document.getElementById("roomId").value = roomId;
}

function createRoom() {
    const name = getName();

    socket.emit("createRoom", { name }, (res) => {
        if (!res || !res.ok) return setStatus(res?.error || "Oda oluşturulamadı");

        currentRoom = res.roomId;
        setRoomUI(currentRoom);
        setStatus(`Oda oluşturuldu: ${currentRoom}. Şimdi arkadaşına bu kodu gönder.`);
    });
}

function joinRoom() {
    const name = getName();
    const roomId = document.getElementById("roomId").value.trim().toUpperCase();

    if (!roomId) return setStatus("Oda kodu girmen lazım.");

    socket.emit("joinRoom", { roomId, name }, (res) => {
        if (!res || !res.ok) return setStatus(res?.error || "Odaya katılınamadı");

        currentRoom = res.roomId;
        setRoomUI(currentRoom);
        setStatus(`Odaya katıldın: ${currentRoom}`);
    });
}

function play(card) {
    if (!currentRoom) return setStatus("Önce oda oluştur veya odaya katıl.");
    socket.emit("play", { roomId: currentRoom, card });
}

// Şimdilik sadece UI demo: “ÇEK” butonu random kart üretir.
// İleride server-side gerçek deste/çekme mantığını ekleyeceğiz.
function drawCard() {
    const colors = ["Kırmızı", "Mavi", "Yeşil", "Sarı"];
    const nums = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];
    const card = `${colors[Math.floor(Math.random() * colors.length)]} ${nums[Math.floor(Math.random() * nums.length)]}`;
    setStatus(`Kart çektin: ${card} (demo)`);
}

socket.on("players", ({ roomId, players }) => {
    if (roomId !== currentRoom) return;

    const ul = document.getElementById("players");
    ul.innerHTML = "";

    players.forEach((p) => {
        const li = document.createElement("li");
        li.textContent = p.name;
        ul.appendChild(li);
    });
});

socket.on("played", ({ roomId, card }) => {
    if (roomId !== currentRoom) return;

    setStatus(`Kart oynandı: ${card}`);

    const discard = document.getElementById("discard");
    discard.innerHTML = "";

    const lower = card.toLowerCase();
    let cls = "red";
    if (lower.includes("mavi")) cls = "blue";
    if (lower.includes("yeşil")) cls = "green";
    if (lower.includes("sarı")) cls = "yellow";

    const num = card.split(" ").pop();

    const el = document.createElement("div");
    el.className = `card ${cls}`;
    el.style.transform = "scale(0.95)";
    el.innerHTML = `
    <div class="corner tl">${num}</div>
    <div class="center">${num}</div>
    <div class="corner br">${num}</div>
  `;
    discard.appendChild(el);
});

