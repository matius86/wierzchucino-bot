import express from "express";
import axios from "axios";
import fs from "fs";

const TOKEN = process.env.BOT_TOKEN;
const API = `https://api.telegram.org/bot${TOKEN}`;
const app = express();

// Obsługa JSON i URL-encoded
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const USERS_FILE = "./users.json";
const HARM_FILE = "./harmonogram.json";

// GET webhook — Telegram testuje ten endpoint zanim wyśle POST
app.get("/webhook", (req, res) => {
  res.send("OK");
});

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

// POST webhook — odbieranie wiadomości od Telegrama
app.post("/webhook", (req, res) => {
  res.sendStatus(200); // Telegram musi dostać odpowiedź w <1s

  console.log("Webhook received:", JSON.stringify(req.body, null, 2));

  const msg = req.body.message;
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

// 🔥 Scheduler endpoint — wywoływany przez Render Cron
app.post("/runScheduler", async (req, res) => {
  res.sendStatus(200);

  const time = req.query.time; // evening / morning
  const users = loadUsers();
  const harmonogram = JSON.parse(fs.readFileSync(HARM_FILE, "utf8"));

  const today = new Date().toISOString().split("T")[0];

  const d = new Date();
  d.setDate(d.getDate() + 1);
  const tomorrow = d.toISOString().split("T")[0];

  let pickup = null;

  // 18:00 — dzień przed
  if (time === "evening") {
    pickup = harmonogram.find(e => e.date === tomorrow);
    if (!pickup) return;

    for (const user of users) {
      sendMessage(
        user,
        `🔔 <b>Jutro odbiór:</b> ${formatType(pickup.type)}\nWystaw kubły wieczorem.`
      );
    }
  }

  // 06:00 — w dzień odbioru
  if (time === "morning") {
    pickup = harmonogram.find(e => e.date === today);
    if (!pickup) return;

    for (const user of users) {
      sendMessage(
        user,
        `🔔 <b>Dziś odbiór:</b> ${formatType(pickup.type)}\nJeśli jeszcze nie wystawiłeś — zrób to teraz.`
      );
    }
  }
});

// Test GET dla scheduler
app.get("/runScheduler", (req, res) => {
  res.send("Scheduler endpoint działa");
});

app.listen(3000, () => console.log("Bot działa na porcie 3000"));
