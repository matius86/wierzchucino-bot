import fs from "fs";
import axios from "axios";

const TIME = process.argv[2]; // morning / evening

// Ikonki dla typów odpadów
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

// Kolory HTML
const COLORS = {
  "Plastik": "#1E90FF",
  "Bio": "#2ECC71",
  "Zmieszane": "#8B4513",
  "Papier": "#F1C40F",
  "Szkło": "#27AE60",
  "Tekstylia": "#9B59B6",
  "Odzież": "#E67E22",
  "Odpady wielkogabarytowe i elektroodpady": "#E74C3C"
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

  let entry = null;
  let label = "";

  if (TIME === "morning") {
    entry = schedule.find((e) => e.date === today);
    label = "Dziś odbiór";
  } else if (TIME === "evening") {
    entry = schedule.find((e) => e.date === tomorrow);
    label = "Jutro odbiór";
  }

  if (!entry) {
    console.log("Brak harmonogramu na:", TIME === "morning" ? today : tomorrow);
    return;
  }

  const wasteType = entry[TIME]; // morning / evening

  if (!wasteType) {
    console.log("Brak odbioru w tym czasie:", TIME);
    return;
  }

  const icon = ICONS[wasteType] || "♻️";
  const color = COLORS[wasteType] || "#3498DB";

  console.log(`${label}: ${wasteType}`);

  const message = `
<b>${icon} ${label}: <span style="color:${color}">${wasteType}</span></b>
`;

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
