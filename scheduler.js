import axios from "axios";
import fs from "fs";

const TOKEN = process.env.BOT_TOKEN;
const API = `https://api.telegram.org/bot${TOKEN}`;

const USERS_FILE = "./users.json";
const HARM_FILE = "./harmonogram.json";

/* ------------------------------------------
   FUNKCJE POMOCNICZE
------------------------------------------- */

function loadUsers() {
  try {
    return JSON.parse(fs.readFileSync(USERS_FILE, "utf8"));
  } catch (err) {
    console.error("Błąd ładowania users.json:", err);
    return [];
  }
}

function loadHarmonogram() {
  try {
    const data = JSON.parse(fs.readFileSync(HARM_FILE, "utf8"));
    return data.sort((a, b) => a.date.localeCompare(b.date));
  } catch (err) {
    console.error("Błąd ładowania harmonogram.json:", err);
    return [];
  }
}

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
   WYSYŁANIE WIADOMOŚCI (WYMUSZONE IPv4)
------------------------------------------- */

async function sendMessage(chatId, text) {
  try {
    await axios.post(
      `${API}/sendMessage`,
      {
        chat_id: chatId,
        text,
        parse_mode: "HTML"
      },
      {
        timeout: 8000,
        family: 4 // WYMUSZENIE IPv4
      }
    );
  } catch (err) {
    console.error("Błąd wysyłania wiadomości:", err.message);
  }
}

/* ------------------------------------------
   GŁÓWNA FUNKCJA SCHEDULERA
------------------------------------------- */

export async function runScheduler(time) {
  console.log("Scheduler start:", time);

  const users = loadUsers();
  const harm = loadHarmonogram();

  const today = getToday();
  const tomorrow = getTomorrow();

  const todayPickup = harm.find(e => e.date === today);
  const tomorrowPickup = harm.find(e => e.date === tomorrow);

  const { second } = getNextTwo();

  if (time === "evening" && tomorrowPickup) {
    console.log("Wysyłam powiadomienia wieczorne…");

    for (const user of users) {
      await sendMessage(
        user,
        `🔔 <b>Jutro odbiór:</b> ${tomorrowPickup.type} — <b>${tomorrowPickup.date}</b>\n\n` +
        (second ? `📅 <b>Kolejny:</b> ${second.type} — <b>${second.date}</b>` : "")
      );
    }
  }

  if (time === "morning" && todayPickup) {
    console.log("Wysyłam powiadomienia poranne…");

    for (const user of users) {
      await sendMessage(
        user,
        `🔔 <b>Dzisiaj odbiór:</b> ${todayPickup.type} — <b>${todayPickup.date}</b>\n\n` +
        (second ? `📅 <b>Kolejny:</b> ${second.type} — <b>${second.date}</b>` : "")
      );
    }
  }

  console.log("Scheduler zakończony.");
}
