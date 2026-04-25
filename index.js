import express from "express";
import TelegramBot from "node-telegram-bot-api";
import fs from "fs";
import axios from "axios";

const TOKEN = process.env.BOT_TOKEN;
const URL = "https://wierzchucino-bot.onrender.com";

const bot = new TelegramBot(TOKEN, { webHook: true });
const app = express();
app.use(express.json());

// Ustawienie webhooka
bot.setWebHook(`${URL}/webhook`);

// Webhook endpoint
app.post("/webhook", (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

// Ikonki dla frakcji
const ICONS = {
  Plastik: "🟦",
  Bio: "🟩",
  Zmieszane: "🟫",
  Papier: "🟨",
  Szkło: "🟩",
  Tekstylia: "🧵",
  Odzież: "👕",
  "Odpady wielkogabarytowe i elektroodpady": "🔌"
};

// Kolory Google Calendar
const COLORS = {
  Plastik: "#4285F4",
  Bio: "#0F9D58",
  Zmieszane: "#795548",
  Papier: "#F4B400",
  Szkło: "#34A853",
  Tekstylia: "#9C27B0",
  Odzież: "#E91E63",
  "Odpady wielkogabarytowe i elektroodpady": "#DB4437"
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
  bot.sendMessage(msg.chat.id, "✅ Test działa!");
});

// =========================
// /next
// =========================
bot.onText(/\/next/, (msg) => {
  const chatId = msg.chat.id;
  const schedule = JSON.parse(fs.readFileSync("harmonogram.json", "utf8"));
  const today = new Date().toISOString().split("T")[0];

  const next = schedule.find((e) => e.date >= today);

  if (!next) return bot.sendMessage(chatId, "ℹ️ Brak kolejnych odbiorów.");

  bot.sendMessage(chatId, `📅 Najbliższy odbiór:\n${next.date} → ${next.morning}`);
});

// =========================
// /test_scheduler
// =========================
bot.onText(/\/test_scheduler/, async (msg) => {
  try {
    await axios.get(`${URL}/runScheduler?time=morning`);
    bot.sendMessage(msg.chat.id, "Scheduler działa.");
  } catch (err) {
    bot.sendMessage(msg.chat.id, "❌ Błąd schedulera:\n" + err.message);
  }
});

// =========================
// /test_morning
// =========================
bot.onText(/\/test_morning/, async (msg) => {
  try {
    await axios.get(`${URL}/runScheduler?time=morning`);
    bot.sendMessage(msg.chat.id, "⏰ Test morning uruchomiony.");
  } catch (err) {
    bot.sendMessage(msg.chat.id, "❌ Błąd testu morning:\n" + err.message);
  }
});

// =========================
// /test_evening
// =========================
bot.onText(/\/test_evening/, async (msg) => {
  try {
    await axios.get(`${URL}/runScheduler?time=evening`);
    bot.sendMessage(msg.chat.id, "🌙 Test evening uruchomiony.");
  } catch (err) {
    bot.sendMessage(msg.chat.id, "❌ Błąd testu evening:\n" + err.message);
  }
});

// =========================
// /status
// =========================
bot.onText(/\/status/, (msg) => {
  const chatId = msg.chat.id;

  const users = JSON.parse(fs.readFileSync("users.json", "utf8"));
  const schedule = JSON.parse(fs.readFileSync("harmonogram.json", "utf8"));

  const today = new Date().toLocaleString("sv-SE", { timeZone: "Europe/Warsaw" }).split(" ")[0];
  const tomorrow = new Date(Date.now() + 86400000)
    .toLocaleString("sv-SE", { timeZone: "Europe/Warsaw" })
    .split(" ")[0];

  const next = schedule.find((e) => e.date >= today);

  let nextInfo = "Brak danych";
  let daysLeft = "-";

  if (next) {
    const diff = Math.ceil((new Date(next.date) - new Date(today)) / 86400000);
    nextInfo = `${next.date} → ${next.morning}`;
    daysLeft = diff;
  }

  bot.sendMessage(
    chatId,
    `📊 *Status bota*\n\n` +
      `📅 *Dziś:* ${today}\n` +
      `📅 *Jutro:* ${tomorrow}\n\n` +
      `♻️ *Najbliższy odbiór:* ${nextInfo}\n` +
      `⏳ *Dni do odbioru:* ${daysLeft}\n\n` +
      `👥 *Użytkownicy:* ${users.length}\n` +
      `🟢 Bot działa poprawnie`,
    { parse_mode: "Markdown" }
  );
});

// =========================
// /kalendarz – indywidualny link ICS
// =========================
bot.onText(/\/kalendarz/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(
    chatId,
    "📅 *Twój kalendarz odbiorów śmieci*\n\n" +
      `${URL}/calendar/${chatId}.ics\n\n` +
      "Dodaj do Google/Apple/Outlook.\nAktualizuje się automatycznie.",
    { parse_mode: "Markdown" }
  );
});

// =========================
// ENDPOINT SCHEDULERA
// =========================
app.get("/runScheduler", async (req, res) => {
  const TIME = req.query.time;

  try {
    const { exec } = await import("child_process");
    exec(`node cron.js ${TIME}`);
    res.send("Scheduler uruchomiony.");
  } catch {
    res.status(500).send("Błąd uruchamiania schedulera.");
  }
});

// =========================
// ICS PRO — 2 wydarzenia + kolory + emoji + alarm
// =========================
app.get("/calendar/:chatId.ics", (req, res) => {
  const schedule = JSON.parse(fs.readFileSync("harmonogram.json", "utf8"));

  let ics = "";
  ics += "BEGIN:VCALENDAR\n";
  ics += "VERSION:2.0\n";
  ics += "CALSCALE:GREGORIAN\n";
  ics += "PRODID:-//Wierzchucino Bot//EN\n";

  for (const entry of schedule) {
    const date = entry.date.replace(/-/g, "");
    const type = entry.morning;
    const icon = ICONS[type] || "♻️";
    const color = COLORS[type] || "#000000";
    const summary = `${icon} ${type} – odbiór`;

    // WYDARZENIE 1 — całodniowe
    ics += "BEGIN:VEVENT\n";
    ics += `DTSTART;VALUE=DATE:${date}\n`;
    ics += `SUMMARY:${summary}\n`;
    ics += `COLOR:${color}\n`;
    ics += "BEGIN:VALARM\n";
    ics += "TRIGGER:-P1D\n";
    ics += "ACTION:DISPLAY\n";
    ics += "DESCRIPTION:Przypomnienie o odbiorze odpadów\n";
    ics += "END:VALARM\n";
    ics += "END:VEVENT\n";

    // WYDARZENIE 2 — 06:00
    ics += "BEGIN:VEVENT\n";
    ics += `DTSTART:${date}T060000\n`;
    ics += `SUMMARY:${summary} (godzina odbioru)\n`;
    ics += `COLOR:${color}\n`;
    ics += "END:VEVENT\n";
  }

  ics += "END:VCALENDAR\n";

  res.setHeader("Content-Type", "text/calendar; charset=utf-8");
  res.send(ics);
});

// =========================
// KEEPALIVE
// =========================
setInterval(() => {
  axios.get(URL).catch(() => {});
}, 5 * 60 * 1000);

// =========================
// SERWER
// =========================
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Serwer działa na porcie ${PORT}`));

console.log("Bot działa (webhook mode)");
