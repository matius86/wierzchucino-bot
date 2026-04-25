import fs from "fs";
import axios from "axios";

const TIME = process.argv[2]; // morning / evening

async function run() {
  console.log("=== START SCHEDULERA ===");
  console.log("Tryb:", TIME);

  // Wczytanie użytkowników
  const users = JSON.parse(fs.readFileSync("users.json", "utf8"));

  // Wczytanie harmonogramu
  const schedule = JSON.parse(fs.readFileSync("harmonogram.json", "utf8"));

  // Dzisiejsza data
  const today = new Date().toISOString().split("T")[0];

  // Jutrzejsza data
  const tomorrowDate = new Date(Date.now() + 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];

  let entry = null;
  let label = "";

  if (TIME === "morning") {
    // RANO → dzisiejszy odbiór
    entry = schedule.find((e) => e.date === today);
    label = "Dziś odbiór";
  } else if (TIME === "evening") {
    // WIECZOREM → jutrzejszy odbiór
    entry = schedule.find((e) => e.date === tomorrowDate);
    label = "Jutro odbiór";
  }

  if (!entry) {
    console.log("Brak harmonogramu na:", TIME === "morning" ? today : tomorrowDate);
    return;
  }

  const wasteType = entry.type;

  if (!wasteType) {
    console.log("Brak typu odpadu w harmonogramie");
    return;
  }

  console.log(`${label}: ${wasteType}`);

  // Wysyłanie wiadomości do każdego użytkownika
  for (const user of users) {
    try {
      await axios.post(
        `https://api.telegram.org/bot${process.env.BOT_TOKEN}/sendMessage`,
        {
          chat_id: user.chat_id,
          text: `♻️ ${label}: ${wasteType}.`,
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
