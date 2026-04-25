import express from "express";
import TelegramBot from "node-telegram-bot-api";
import fs from "fs";
import axios from "axios";

const TOKEN = process.env.BOT_TOKEN;
const URL = "https://wierzchucino-bot.onrender.com";

const bot = new TelegramBot(TOKEN, {
  webHook: true
});

const app = express();
app.use(express.json());

// Ustawienie webhooka
bot.setWebHook(`${URL}/webhook`);

// Endpoint webhooka
app.post("/webhook", (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

// Ikonki dla frakcji
const ICONS = {
  "Plastik": "🟦",
  "Bio": "🟩",
  "Zmieszane": "🟫",
  "Papier": "🟨",
  "Szkło": "🟩",
  "Tekstylia": "🧵",
  "Odzież": "👕",
  "Odpady wielkogabarytowe i elektroodpady": "🔌"
};

// =========================
// /start
// =========================
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;

  bot.sendMessage(
    chatId,
    "👋 Witaj! Bot działa.\n\nDostępne komendy:\n" +
      "/test\n" +
      "/next\n" +
      "/test_scheduler\n" +
      "/test_morning\n" +
      "/test_evening\n" +
      "/status\n" +
      "/kalendarz\n" +
      "/menu"
  );
});

// =========================
// /menu
// =========================
bot.onText(/\/menu/, (msg) => {
  const chatId = msg.chat.id;

  bot.sendMessage(
    chatId,
    "📋 Menu:\n\n" +
      "/test – sprawdź bota\n" +
      "/next – najbliższy odbiór\n" +
      "/test_scheduler – test schedulera\n" +
      "/test_morning – test powiadomienia 06:00\n" +
      "/test_evening – test powiadomienia 18:00\n" +
      "/status – status bota\n" +
      "/kalendarz – dodaj odbiory do kalendarza"
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
    await axios.get(`${URL}/runScheduler?time=morning`);
    bot.sendMessage(chatId, "Scheduler działa.");
  } catch (err) {
    bot.sendMessage(chatId, "❌ Błąd schedulera:\n" + err.message);
  }
});

// =========================
// /test_morning
// =========================
bot.onText(/\/test_morning/, async (msg) => {
  const chatId = msg.chat.id;

  try {
    await axios.get(`${URL}/runScheduler?time=morning`);
    bot.sendMessage(chatId, "⏰ Test morning uruchomiony.");
  } catch (err) {
    bot.sendMessage(chatId, "❌ Błąd testu morning:\n" + err.message);
  }
});

// =========================
// /test_evening
// =========================
bot.onText(/\/test_evening/, async (msg) => {
  const chatId = msg.chat.id;

  try {
    await axios.get(`${URL}/runScheduler?time=evening`);
    bot.sendMessage(chatId, "🌙 Test evening uruchomiony.");
  } catch (err) {
    bot.sendMessage(chatId, "❌ Błąd testu evening:\n" + err.message);
  }
});

// =========================
// /status
// =========================
bot.onText(/\/status/, (msg) => {
  const chatId = msg.chat.id;

  const users = JSON.parse(fs.readFileSync("users.json", "utf8"));
  const schedule = JSON.parse(fs.readFileSync("harmonogram.json", "utf8"));

  const today = new Date()
    .toLocaleString("sv-SE", { timeZone: "Europe/Warsaw" })
    .split(" ")[0];
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)
    .toLocaleString("sv-SE", { timeZone: "Europe/Warsaw" })
    .split(" ")[0];

  const next = schedule.find((e) => e.date >= today);

  let nextInfo = "Brak danych";
  let daysLeft = "-";

  if (next) {
    const diff = Math.ceil(
      (new Date(next.date) - new Date(today)) / (1000 * 60 * 60 * 24)
    );

    nextInfo = `${next.date} → ${next.morning}`;
    daysLeft = diff;
  }

  const message =
    `📊 *Status bota*\n\n` +
    `📅 *Dziś:* ${today}\n` +
    `📅 *Jutro:* ${tomorrow}\n\n` +
    `♻️ *Najbliższy odbiór:* ${nextInfo}\n` +
    `⏳ *Dni do odbioru:* ${daysLeft}\n\n` +
    `👥 *Użytkownicy:* ${users.length}\n` +
    `🟢 Bot działa poprawnie`;

  bot.sendMessage(chatId, message, { parse_mode: "Markdown" });
});

// =========================
/* /kalendarz – indywidualny link ICS */
// =========================
bot.onText(/\/kalendarz/, (msg) => {
  const chatId = msg.chat.id;

  const icsUrl = `${URL}/calendar/${chatId}.ics`;

  bot.sendMessage(
    chatId,
    "📅 *Twój kalendarz odbiorów śmieci*\n\n" +
      "Kliknij poniższy link, aby dodać harmonogram do Google Calendar, Apple Calendar lub Outlook:\n\n" +
      `${icsUrl}\n\n` +
      "Kalendarz aktualizuje się automatycznie, gdy zmienisz harmonogram.",
    { parse_mode: "Markdown" }
  );
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
// KALENDARZ ICS PRO (emoji + alarm dzień wcześniej + per user)
// =========================
app.get("/calendar/:chatId.ics", (req, res) => {
  const schedule = JSON.parse(fs.readFileSync("harmonogram.json", "utf8"));

  let ics = "";
  ics += "BEGIN:VCALENDAR\n";
  ics += "VERSION:2.0\n";
  ics += "PRODID:-//Wierzchucino Bot//EN\n";

  for (const entry of schedule) {
    const date = entry.date.replace(/-/g, ""); // 2026-04-29 → 20260429
    const type = entry.morning;
    const icon = ICONS[type] || "♻️";
    const summary = `${icon} ${type} – odbiór`;

    ics += "BEGIN:VEVENT\n";
    ics += `DTSTART:${date}T060000\n`; // 06:00
    ics += `SUMMARY:${summary}\n`;
    ics += "BEGIN:VALARM\n";
    ics += "TRIGGER:-P1D\n"; // 1 dzień wcześniej
    ics += "ACTION:DISPLAY\n";
    ics += "DESCRIPTION:Przypomnienie o odbiorze odpadów\n";
    ics += "END:VALARM\n";
    ics += "END:VEVENT\n";
  }

  ics += "END:VCALENDAR\n";

  res.setHeader("Content-Type", "text/calendar; charset=utf-8");
  res.send(ics);
});

// =========================
// KEEPALIVE – zapobiega usypianiu Render
// =========================
setInterval(() => {
  axios
    .get(`${URL}`)
    .then(() => console.log("Keepalive OK"))
    .catch(() => console.log("Keepalive FAIL"));
}, 5 * 60 * 1000); // co 5 minut

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
console.log("Bot działa (webhook mode)");
