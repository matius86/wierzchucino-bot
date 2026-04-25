import fs from "fs";
import axios from "axios";

const TIME = process.argv[2]; // morning / evening / tomorrow

// Ikonki
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

async function run() {
  console.log("=== START SCHEDULERA ===");
  console.log("Tryb:", TIME);

  const users = JSON.parse(fs.readFileSync("users.json", "utf8"));
  const schedule = JSON.parse(fs.readFileSync("harmonogram.json", "utf8"));

  const today = new Date().toISOString().split("T")[0];
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];

  const todayEntry = schedule.find((e) => e.date === today);
  const tomorrowEntry = schedule.find((e) => e.date === tomorrow);

  let wasteType = null;
  let label = "";

  if (TIME === "morning") {
    if (!todayEntry) return console.log("Brak harmonogramu na dziś");
    wasteType = todayEntry.morning;
    label = "Dziś odbiór";
  }

  if (TIME === "evening") {
    if (!todayEntry) return console.log("Brak harmonogramu na dziś");
    wasteType = todayEntry.evening;
    label = "Dziś odbiór";
  }

  if (TIME === "tomorrow") {
    if (!tomorrowEntry) return console.log("Brak harmonogramu na jutro");
    wasteType = tomorrowEntry.morning;
    label = "Jutro odbiór";
  }

  if (!wasteType) {
    console.log("Brak odbioru w tym czasie:", TIME);
    return;
  }

  const icon = ICONS[wasteType] || "♻️";

  const message = `<b>${icon} ${label}: ${wasteType}</b>`;

  for (const user of users) {
    try {
      await axios.post(
        `https://api.telegram.org/bot${process.env.BOT_TOKEN}/sendMessage`,
        {
          chat_id: user.chat_id,
          text: message,
          parse_mode: "HTML"
        }
      );
      console.log("Wysłano do:", user.chat_id);
    } catch (err) {
      console.error("Błąd wysyłania do", user.chat_id, err.message);
    }
  }

  console.log("=== KONIEC SCHEDULERA ===");
}

run();
