import express from "express";
import axios from "axios";
import fs from "fs";

const TOKEN = process.env.BOT_TOKEN;
const API = `https://api.telegram.org/bot${TOKEN}`;
const app = express();
app.use(express.json());

const USERS_FILE = "./users.json";
const HARM_FILE = "./harmonogram.json";

// Ikony dla frakcji
function getIcon(type) {
  const map = {
    "Plastik": "♳",
    "Bio": "🟫",
    "Zmieszane": "🗑️",
    "Szkło": "🟩",
    "Papier": "📄",
    "Odzież": "👕",
    "Tekstylia": "🧵",
    "Odpady wielkogabarytowe i elektroodpady": "🛋️"
  };
  return map[type] || "♻️";
}

// Kolory HTML dla frakcji
function getColor(type) {
  const map = {
    "Plastik": "#f1c40f",
    "Bio": "#8e5a2b",
    "Zmieszane": "#7f8c8d",
    "Szkło": "#2ecc71",
    "Papier": "#3498db",
    "Odzież": "#9b59b6",
    "Tekstylia": "#e67e22",
    "Odpady wielkogabarytowe i elektroodpady": "#c0392b"
  };
  return map[type] || "#ffffff";
}

function formatType(type) {
  return `${getIcon(type)} <b><span style="color:${getColor(type)}">${type}</span></b>`;
}

function loadUsers() {
  return JSON.parse(fs.readFileSync(USERS_FILE, "utf8"));
}

function saveUsers(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

async function sendMessage(chatId, text) {
  await axios.post(`${API}/sendMessage`, {
    chat_id: chatId,
    text: text,
    parse_mode: "HTML"
  });
}

// 🔥 KLUCZOWA POPRAWKA — NATYCHMIASTOWA ODPOWIEDŹ
app.post("/webhook", (req, res) => {
  res.sendStatus(200); // Telegram dostaje odpowiedź od razu

  const msg = req.body.message;
  console.log("Webhook received:", JSON.stringify(req.body, null, 2));

  if (!msg) return;

  const chatId = msg.chat.id;
  const text = msg.text?.trim();

  // /start
  if (text === "/start") {
    const users = loadUsers();

    if (!users.includes(chatId)) {
      users.push(chatId);
      saveUsers(users);
    }

    sendMessage(chatId, "Witaj! Od teraz będziesz otrzymywać powiadomienia o odbiorze odpadów dla Wierzchucina.");
    return;
  }

  // /test
  if (text === "/test") {
    sendMessage(chatId, "🔔 Test powiadomienia działa poprawnie!\n\nPrzykład:\n➡️ Jutro odbiór: Plastik");
    return;
  }

  // /test_scheduler
  if (text === "/test_scheduler") {
    const today = new Date().toISOString().split("T")[0];

    const d = new Date();
    d.setDate(d.getDate() + 1);
    const tomorrow = d.toISOString().split("T")[0];

    const harmonogram = JSON.parse(fs.readFileSync(HARM_FILE, "utf8"));
    const todayPickup = harmonogram.find(e => e.date === today);
    const tomorrowPickup = harmonogram.find(e => e.date === tomorrow);

    let msg = "🔧 <b>Test scheduler</b>\n\n";

    if (todayPickup) {
      msg += `🔔 <b>Dzisiaj odpady:</b> ${formatType(todayPickup.type)}\nWystaw przed posesję.\n\n`;
    } else {
      msg += "➡️ Dzisiaj: brak odbioru\n\n";
    }

    if (tomorrowPickup) {
      msg += `🔔 <b>Jutro odpady:</b> ${formatType(tomorrowPickup.type)}\nWystaw przed posesję.\n`;
    } else {
      msg += "➡️ Jutro: brak odbioru\n";
    }

    sendMessage(chatId, msg);
    return;
  }
});

app.listen(3000, () => console.log("Bot działa na porcie 3000"));
