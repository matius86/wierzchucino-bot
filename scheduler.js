import fs from "fs";
import axios from "axios";

const TOKEN = process.env.BOT_TOKEN;
const API = `https://api.telegram.org/bot${TOKEN}`;

const USERS_FILE = "./users.json";
const HARM_FILE = "./harmonogram.json";

/* ------------------------------------------
   FORMATOWANIE
------------------------------------------- */

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

/* ------------------------------------------
   PLIKI
------------------------------------------- */

function loadUsers() {
  return JSON.parse(fs.readFileSync(USERS_FILE, "utf8"));
}

function loadHarmonogram() {
  const data = JSON.parse(fs.readFileSync(HARM_FILE, "utf8"));
  return data.sort((a, b) => a.date.localeCompare(b.date));
}

/* ------------------------------------------
   WYSYŁANIE WIADOMOŚCI
------------------------------------------- */

async function sendMessage(chatId, text) {
  await axios.post(`${API}/sendMessage`, {
    chat_id: chatId,
    text,
    parse_mode: "HTML"
  });
}

/* ------------------------------------------
   LOGIKA TERMINÓW
------------------------------------------- */

function getToday() {
  return new Date().toISOString().split("T")[0];
}

function getTomorrow() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split("T")[0];
}

function getNextTwo() {
  const harm = loadHarmonogram();
  const today = getToday();

  const next = harm.find(e => e.date >= today);
  if (!next) return { next: null, second: null };

  const second = harm.find(e => e.date > next.date) || null;

  return { next, second };
}

/* ------------------------------------------
   ANTY-DUPLIKACJA POWIADOMIEŃ
------------------------------------------- */

let lastSent = {
  morning: null,
  evening: null
};

/* ------------------------------------------
   FALLBACK SCHEDULER
------------------------------------------- */

async function runScheduler() {
  const now = new Date();
  const hour = now.getHours();
  const minute = now.getMinutes();

  const users = loadUsers();
  if (users.length === 0) return;

  const harm = loadHarmonogram();
  const today = getToday();
  const tomorrow = getTomorrow();

  const todayPickup = harm.find(e => e.date === today);
  const tomorrowPickup = harm.find(e => e.date === tomorrow);

  const { second } = getNextTwo();

  /* ------------------------------------------
     06:00 — fallback powiadomienie
  ------------------------------------------- */
  if (hour === 6 && minute === 0 && todayPickup) {
    if (lastSent.morning === today) {
      console.log("⏭️ Pomijam — poranne powiadomienie już wysłane.");
      return;
    }

    console.log("📤 Fallback: wysyłam poranne powiadomienie.");

    for (const user of users) {
      await sendMessage(
        user,
        `🔔 <b>Dzisiaj odbiór:</b> ${formatType(todayPickup.type)}\n\n` +
        (second ? `📅 <b>Kolejny:</b> ${formatType(second.type)} — <b>${second.date}</b>` : "")
      );
    }

    lastSent.morning = today;
  }

  /* ------------------------------------------
     18:00 — fallback powiadomienie
  ------------------------------------------- */
  if (hour === 18 && minute === 0 && tomorrowPickup) {
    if (lastSent.evening === tomorrow) {
      console.log("⏭️ Pomijam — wieczorne powiadomienie już wysłane.");
      return;
    }

    console.log("📤 Fallback: wysyłam wieczorne powiadomienie.");

    for (const user of users) {
      await sendMessage(
        user,
        `🔔 <b>Jutro odbiór:</b> ${formatType(tomorrowPickup.type)}\n\n` +
        (second ? `📅 <b>Kolejny:</b> ${formatType(second.type)} — <b>${second.date}</b>` : "")
      );
    }

    lastSent.evening = tomorrow;
  }
}

console.log("Fallback scheduler działa…");
setInterval(runScheduler, 60 * 1000);
