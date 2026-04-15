import axios from "axios";

const TIME = process.argv[2]; // evening / morning

async function run() {
  const url = `https://wierzchucino-bot.onrender.com/runScheduler?time=${TIME}`;
  console.log("Wywołuję:", url);

  try {
    await axios.post(url);
    console.log("OK");
  } catch (err) {
    console.error("Błąd:", err.message);
  }
}

run();
