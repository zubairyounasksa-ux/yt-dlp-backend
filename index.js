// index.js
const express = require("express");
const cors = require("cors");
const { spawn } = require("child_process");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());

app.get("/", (req, res) => {
  res.send("✅ yt-dlp backend running");
});

/**
 * GET /info?url=YOUTUBE_URL
 * Returns JSON with video info and formats
 */
app.get("/info", (req, res) => {
  const url = req.query.url;
  if (!url) return res.status(400).json({ error: "Missing url parameter" });

  const ytDlp = spawn("yt-dlp", ["-J", "--no-playlist", url], {
    env: { ...process.env, SSL_CERT_FILE: "/etc/ssl/cert.pem" },
  });

  let output = "";
  let errorOutput = "";

  ytDlp.stdout.on("data", (data) => (output += data.toString()));
  ytDlp.stderr.on("data", (data) => (errorOutput += data.toString()));

  ytDlp.on("close", (code) => {
    if (code !== 0) {
      console.error("yt-dlp error:", errorOutput);
      return res.status(500).json({ error: "Failed to fetch video info" });
    }

    try {
      const json = JSON.parse(output);

      const formats = (json.formats || [])
        .filter((f) => f.format_id && (f.vcodec !== "none" || f.acodec !== "none"))
        .map((f) => ({
          formatId: f.format_id,
          quality: f.vcodec === "none" ? `${Math.round(f.abr || 0)} kbps (Audio)` : `${f.width || 0}x${f.height || 0}`,
          sizeMB: f.filesize ? (f.filesize / 1024 / 1024).toFixed(1) : "0",
          isAudio: f.vcodec === "none",
        }));

      // Sort: videos first (largest), audio last
      formats.sort((a, b) => {
        if (a.isAudio && !b.isAudio) return 1;
        if (!a.isAudio && b.isAudio) return -1;
        return parseFloat(b.sizeMB) - parseFloat(a.sizeMB);
      });

      res.json({
        title: json.title,
        thumbnail: json.thumbnail,
        duration: json.duration,
        channel: json.uploader,
        formats,
      });
    } catch (err) {
      console.error("Parse error:", err);
      res.status(500).json({ error: "Invalid yt-dlp response" });
    }
  });
});

/**
 * GET /download?url=YOUTUBE_URL&format=FORMAT_ID
 * Streams selected format
 */
app.get("/download", (req, res) => {
  const { url, format } = req.query;
  if (!url || !format) return res.status(400).json({ error: "Missing url or format parameter" });

  res.setHeader("Content-Disposition", "attachment");
  res.setHeader("Content-Type", "application/octet-stream");

  const ytDlp = spawn("yt-dlp", ["-f", format, "-o", "-", url], {
    env: { ...process.env, SSL_CERT_FILE: "/etc/ssl/cert.pem" },
  });

  ytDlp.stdout.pipe(res);
  ytDlp.stderr.on("data", (data) => console.error(`yt-dlp: ${data}`));

  ytDlp.on("close", (code) => {
    if (code !== 0) res.end();
  });
});

app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
