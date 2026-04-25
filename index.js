const express = require("express");
const { exec } = require("child_process");
const app = express();

app.use(express.json());

// INFO: Bot start
console.log("Bot działa na porcie 3000");

// ===============================
//  ENDPOINT TESTOWY
// ===============================
app.get("/", (req, res) => {
  res.send("Menu");
});

// ===============================
//  ENDPOINT DO SCHEDULERA (GET)
// ===============================
app.get("/runScheduler", async (req, res) => {
  const time = req.query.time;

  console.log("====================================");
  console.log("Scheduler endpoint HIT:", time);
  console.log("====================================");

  if (!time) {
    console.log("Brak parametru time");
    return res.status(400).send("Brak parametru time");
  }

  try {
    exec(`node cron.js ${time}`, (error, stdout, stderr) => {
      if (error) {
        console.error("Scheduler error:", error);
        return res.status(500).send("Scheduler error");
      }

      console.log("Scheduler output:", stdout);
      if (stderr) console.error("Scheduler stderr:", stderr);

      res.send("OK");
    });
  } catch (err) {
    console.error("Scheduler exception:", err);
    res.status(500).send("Exception");
  }
});

// ===============================
//  START SERVERA
// ===============================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Serwer działa na porcie ${PORT}`);
});
