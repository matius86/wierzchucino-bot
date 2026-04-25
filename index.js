import express from "express";
import TelegramBot from "node-telegram-bot-api";
import fs from "fs";
import axios from "axios";

const TOKEN = process.env.BOT_TOKEN;
const bot = new TelegramBot(TOKEN, { polling: true });

const app = express();
app.use(express.json());

// =========================
// /start
// =========================
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;

  bot.sendMessage(
    chatId,
    "👋 Witaj! Bot działa.\n\nDostępne komendy:\n/test\n/next\n/test_scheduler\n/menu"
  );
});

// =========================
// /menu
// =========================
bot.onText(/\/menu/, (msg) => {
  const chatId = msg.chat.id;

  bot.sendMessage(
    chatId,
    "📋 Menu:\n\n/test – sprawdź bota\n/next – najbliższy odbiór\n/test_scheduler – test schedulera"
  );
});

// =========================
// /test
// =========================
bot.onText(/\/test/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, "✅ Test działa!");
});

// =========================
// /next
// =========================
bot.onText(/\/next/, (msg) => {
  const chatId = msg.chat.id;

  const schedule = JSON.parse(fs.readFileSync("harmonogram.json", "utf8"));
  const today = new Date().toISOString().split("T")[0];

  const next = schedule.find((e) => e.date >= today);

  if (!next) {
    return bot.sendMessage(chatId, "ℹ️ Brak kolejnych odbiorów.");
  }

  bot.sendMessage(
    chatId,
    `📅 Najbliższy odbiór:\n${next.date} → ${next.morning}`
  );
});

// =========================
// /test_scheduler
// =========================
bot.onText(/\/test_scheduler/, async (msg) => {
  const chatId = msg.chat.id;

  try {
    const res = await axios.get(
      "https://wierzchucino-bot.onrender.com/runScheduler?time=morning"
    );

    bot.sendMessage(chatId, "Scheduler działa.");
  } catch (err) {
    bot.sendMessage(chatId, "❌ Błąd schedulera:\n" + err.message);
  }
});

// =========================
// ENDPOINT SCHEDULERA
// =========================
app.get("/runScheduler", async (req, res) => {
  const TIME = req.query.time;

  console.log("====================================");
  console.log("Scheduler endpoint HIT:", TIME);
  console.log("====================================");

  try {
    const { exec } = await import("child_process");
    exec(`node cron.js ${TIME}`, (error, stdout, stderr) => {
      console.log("Scheduler output:", stdout);
      if (stderr) console.log("Scheduler stderr:", stderr);
    });

    res.send("Scheduler uruchomiony.");
  } catch (err) {
    res.status(500).send("Błąd uruchamiania schedulera.");
  }
});

// =========================
// SERWER EXPRESS
// =========================
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Serwer działa na porcie ${PORT}`);
});

// =========================
// INFO O BOCIE
// =========================
console.log("Bot działa na porcie 3000");
