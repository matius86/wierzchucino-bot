import fs from "fs";
import axios from "axios";

const TIME = process.argv[2]; // evening / morning

async function run() {
  console.log("=== START SCHEDULERA ===");
  console.log("Tryb:", TIME);

  // Wczytanie użytkowników
  const users = JSON.parse(fs.readFileSync("users.json", "utf8"));

  // Wczytanie harmonogramu
  const schedule = JSON.parse(fs.readFileSync("harmonogram.json", "utf8"));

  const today = new Date().toISOString().split("T")[0];

  const todayEntry = schedule.find((e) => e.date === today);

  if (!todayEntry) {
    console.log("Brak harmonogramu na dziś:", today);
    return;
  }

  const wasteType = todayEntry[TIME];

  if (!wasteType) {
    console.log("Brak odbioru w tym czasie:", TIME);
    return;
  }

  console.log("Dzisiejszy odbiór:", wasteType);

  // Wysyłanie wiadomości do każdego użytkownika
  for (const user of users) {
    try {
      await axios.post(
        `https://api.telegram.org/bot${process.env.BOT_TOKEN}/sendMessage`,
        {
          chat_id: user.chat_id,
          text: `♻️ Przypomnienie: dziś odbiór ${wasteType}.`,
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
