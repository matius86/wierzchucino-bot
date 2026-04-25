import dns from "dns";
dns.setDefaultResultOrder("ipv4first"); // WYMUSZENIE IPv4 GLOBALNIE

import express from "express";
import axios from "axios";
import fs from "fs";

const TOKEN = process.env.BOT_TOKEN;
const API = `https://api.telegram.org/bot${TOKEN}`;
const API_FALLBACK = `https://api.telegram.org/bot${TOKEN}`; // drugi host jeśli pierwszy padnie

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
  try {
    return JSON.parse(fs.readFileSync(USERS_FILE, "utf8"));
  } catch {
    return [];
  }
}

function saveUsers(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

function loadHarmonogram() {
  try {
    const data = JSON.parse(fs.readFileSync(HARM_FILE, "utf8"));
    return data.sort((a, b) => a.date.localeCompare(b.date));
  } catch {
    return [];
  }
}

/* ------------------------------------------
   WYSYŁANIE WIADOMOŚCI (IPv4 + fallback)
------------------------------------------- */

async function sendMessage(chatId, text) {
  try {
    await axios.post(
      `${API}/sendMessage`,
      { chat_id: chatId, text, parse_mode: "HTML" },
      { timeout: 8000, family: 4 }
    );
  } catch (err) {
    console.error("Błąd głównego API:", err.message);

    try {
      await axios.post(
        `${API_FALLBACK}/sendMessage`,
        { chat_id: chatId, text, parse_mode: "HTML" },
        { timeout: 8000, family: 4 }
      );
    } catch (err2) {
      console.error("Błąd fallback API:", err2.message);
    }
  }
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
   WEBHOOK
------------------------------------------- */

app.get("/webhook", (req, res) => res.send("OK"));

app.post("/webhook", (req, res) => {
  res.sendStatus(200);

  const msg = req.body.message;
  if (!msg) return;

  const chatId = msg.chat.id;
  const text = msg.text?.trim();

  if (text === "/start") {
    const users = loadUsers();
    if (!users.includes(chatId)) {
      users.push(chatId);
      saveUsers(users);
    }

    const { next } = getNextTwo();

    sendMessage(
      chatId,
      `Witaj! 👋\nOd teraz będziesz otrzymywać powiadomienia.\n\n` +
      `📅 <b>Najbliższy odbiór:</b>\n${formatType(next.type)} — <b>${next.date}</b>`
    );
    return;
  }

  if (text === "/next") {
    const { next, second } = getNextTwo();

    if (!next) {
      sendMessage(chatId, "Brak kolejnych terminów odbioru.");
      return;
    }

    let msg = `📅 <b>Najbliższy odbiór:</b>\n${formatType(next.type)} — <b>${next.date}</b>`;

    if (second) {
      msg += `\n\n➡️ <b>Kolejny:</b>\n${formatType(second.type)} — <b>${second.date}</b>`;
    }

    sendMessage(chatId, msg);
    return;
  }

  if (text === "/test") {
    sendMessage(chatId, "🔔 Test powiadomienia działa poprawnie!");
    return;
  }

  if (text === "/test_scheduler") {
    const harm = loadHarmonogram();
    const today = getToday();
    const tomorrow = getTomorrow();

    const todayPickup = harm.find(e => e.date === today);
    const tomorrowPickup = harm.find(e => e.date === tomorrow);

    const { second } = getNextTwo();

    let msg = "🔧 <b>Test scheduler</b>\n\n";

    msg += todayPickup
      ? `🔔 <b>Dzisiaj:</b> ${formatType(todayPickup.type)}\n`
      : "➡️ Dzisiaj: brak odbioru\n";

    msg += tomorrowPickup
      ? `🔔 <b>Jutro:</b> ${formatType(tomorrowPickup.type)}\n`
      : "➡️ Jutro: brak odbioru\n";

    if (second) {
      msg += `\n➡️ <b>Kolejny:</b> ${formatType(second.type)} — <b>${second.date}</b>`;
    }

    sendMessage(chatId, msg);
    return;
  }
});

/* ------------------------------------------
   ENDPOINT SCHEDULERA
------------------------------------------- */

app.post("/runScheduler", async (req, res) => {
  res.sendStatus(200);

  const time = req.query.time;
  const users = loadUsers();
  const harm = loadHarmonogram();

  const today = getToday();
  const tomorrow = getTomorrow();

  const todayPickup = harm.find(e => e.date === today);
  const tomorrowPickup = harm.find(e => e.date === tomorrow);

  const { second } = getNextTwo();

  if (time === "evening" && tomorrowPickup) {
    for (const user of users) {
      await sendMessage(
        user,
        `🔔 <b>Jutro odbiór:</b> ${formatType(tomorrowPickup.type)}\n\n` +
        (second ? `📅 <b>Kolejny:</b> ${formatType(second.type)} — <b>${second.date}</b>` : "")
      );
    }
  }

  if (time === "morning" && todayPickup) {
    for (const user of users) {
      await sendMessage(
        user,
        `🔔 <b>Dzisiaj odbiór:</b> ${formatType(todayPickup.type)}\n\n` +
        (second ? `📅 <b>Kolejny:</b> ${formatType(second.type)} — <b>${second.date}</b>` : "")
      );
    }
  }
});

app.listen(3000, () => console.log("Bot działa na porcie 3000"));
