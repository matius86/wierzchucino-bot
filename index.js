import express from "express";
import TelegramBot from "node-telegram-bot-api";
import fs from "fs";
import axios from "axios";
import cron from "node-cron";

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

// Ikonki dla frakcji — PRAWDZIWE IKONY
const ICONS = {
  Plastik: "🧴",
  Bio: "🌱",
  Zmieszane: "🗑️",
  Papier: "📄",
  Szkło: "🍾",
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

// Funkcja wysyłająca powiadomienia
function runScheduler(time) {
  const users = JSON.parse(fs.readFileSync("users.json", "utf8"));
  const schedule = JSON.parse(fs.readFileSync("harmonogram.json", "utf8"));

  const today = new Date().toISOString().split("T")[0];
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split("T")[0];

  let targetDate = time === "morning" ? today : tomorrow;

  const entry = schedule.find((e) => e.date === targetDate);
  if (!entry) return;

  const icon = ICONS[entry.morning] || "♻️";

  for (const user of users) {
    bot.sendMessage(
      user.chatId,
      `${icon} Przypomnienie!\n${entry.date} → ${entry.morning}`
    );
  }
}

// =========================
// TEST SCHEDULERA — USUNĄĆ PO SPRAWDZENIU
// =========================
setTimeout(() => {
  console.log("TEST: odpalam scheduler ręcznie (5 sekund po starcie)");
  runScheduler("morning");
}, 5000);

// Log startowy
console.log("Scheduler załadowany — czekam na 06:00 i 18:00");

// =========================
// SCHEDULER — DZIAŁA 24/7 NA RENDER STARTER
// =========================

// 06:00 — powiadomienie poranne
cron.schedule("0 6 * * *", () => {
  console.log("Scheduler: 06:00 morning");
  runScheduler("morning");
}, { timezone: "Europe/Warsaw" });

// 18:00 — powiadomienie dzień wcześniej
cron.schedule("0 18 * * *", () => {
  console.log("Scheduler: 18:00 evening");
  runScheduler("evening");
}, { timezone: "Europe/Warsaw" });

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
// ICS PRO — 2 wydarzenia + emoji + kolory + alarm
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
