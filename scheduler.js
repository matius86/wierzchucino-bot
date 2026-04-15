import fs from "fs";
import axios from "axios";

const TOKEN = process.env.BOT_TOKEN;
const API = `https://api.telegram.org/bot${TOKEN}`;

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

// Formatowanie frakcji (ikona + kolor)
function formatType(type) {
  return `${getIcon(type)} <b><span style="color:${getColor(type)}">${type}</span></b>`;
}

function loadUsers() {
  return JSON.parse(fs.readFileSync(USERS_FILE, "utf8"));
}

function loadHarmonogram() {
  return JSON.parse(fs.readFileSync(HARM_FILE, "utf8"));
}

async function sendMessage(chatId, text) {
  await axios.post(`${API}/sendMessage`, {
    chat_id: chatId,
    text: text,
    parse_mode: "HTML"
  });
}

function getToday() {
  return new Date().toISOString().split("T")[0];
}

function getTomorrow() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split("T")[0];
}

function findPickup(date) {
  const harmonogram = loadHarmonogram();
  return harmonogram.find(entry => entry.date === date);
}

async function runScheduler() {
  const now = new Date();
  const hour = now.getHours();
  const minute = now.getMinutes();

  console.log(`Scheduler tick: ${hour}:${minute.toString().padStart(2, "0")}`);

  const users = loadUsers();
  if (users.length === 0) return;

  const today = getToday();
  const tomorrow = getTomorrow();

  const todayPickup = findPickup(today);
  const tomorrowPickup = findPickup(tomorrow);

  // 06:00 — powiadomienie o dzisiejszym odbiorze
  if (hour === 6 && minute === 0 && todayPickup) {
    console.log("Wysyłam powiadomienie: DZISIAJ");
    for (const chatId of users) {
      await sendMessage(
        chatId,
        `🔔 <b>Dzisiaj odpady:</b> ${formatType(todayPickup.type)}\nWystaw przed posesję.`
      );
    }
  }

  // 18:00 — powiadomienie o jutrzejszym odbiorze
  if (hour === 18 && minute === 0 && tomorrowPickup) {
    console.log("Wysyłam powiadomienie: JUTRO");
    for (const chatId of users) {
      await sendMessage(
        chatId,
        `🔔 <b>Jutro odpady:</b> ${formatType(tomorrowPickup.type)}\nWystaw przed posesję.`
      );
    }
  }
}

console.log("Scheduler działa…");
setInterval(runScheduler, 60 * 1000);
