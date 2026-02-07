const express = require("express");
const cors = require("cors");
const { spawn } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// Put your exported cookies.txt content into this env var on Render
const COOKIES_TEXT = process.env.YTDLP_COOKIES || "";

app.use(cors());

app.get("/", (req, res) => res.send("✅ yt-dlp backend running"));
app.get("/health", (req, res) => res.json({ ok: true }));

function buildCookiesFileIfNeeded() {
  if (!COOKIES_TEXT.trim()) return null;

  const filePath = path.join(os.tmpdir(), "yt_cookies.txt");
  fs.writeFileSync(filePath, COOKIES_TEXT, "utf8");
  return filePath;
}

function ytdlpArgsBase(url) {
  // Cookies are optional; yt-dlp will still run without them, but YouTube may block
  const cookiesFile = buildCookiesFileIfNeeded();

  const args = [
    "--no-playlist",
    "--force-ipv4",
    "--extractor-args",
    "youtube:player_client=android",
  ];

  if (cookiesFile) {
    args.unshift("--cookies", cookiesFile);
  }

  args.push(url);
  return args;
}

app.get("/info", (req, res) => {
  const url = req.query.url;
  if (!url) return res.status(400).json({ error: "Missing url parameter" });

  const args = ["-J", ...ytdlpArgsBase(url)];
  const p = spawn("yt-dlp", args);

  p.on("error", (e) => {
    return res.status(500).json({ error: "Failed to start yt-dlp", details: e.message });
  });

  let out = "";
  let err = "";
  p.stdout.on("data", (d) => (out += d.toString()));
  p.stderr.on("data", (d) => (err += d.toString()));

  p.on("close", (code) => {
    if (code !== 0) {
      return res.status(500).json({
        error: "yt-dlp failed",
        details: err,
        hint: COOKIES_TEXT.trim()
          ? "Cookies provided but YouTube still blocked. Refresh cookies."
          : "YouTube requires cookies. Add YTDLP_COOKIES env var (cookies.txt content).",
      });
    }

    try {
      const json = JSON.parse(out);
      const formats = (json.formats || []).map((f) => ({
        formatId: f.format_id,
        ext: f.ext,
        height: f.height,
        abr: f.abr,
        filesize: f.filesize,
        vcodec: f.vcodec,
        acodec: f.acodec,
      }));

      res.json({
        title: json.title,
        thumbnail: json.thumbnail,
        duration: json.duration,
        channel: json.uploader,
        formats,
      });
    } catch {
      res.status(500).json({ error: "Invalid yt-dlp JSON" });
    }
  });
});

app.get("/download", (req, res) => {
  const { url, format } = req.query;
  if (!url || !format) return res.status(400).json({ error: "Missing url or format parameter" });

  res.setHeader("Content-Disposition", "attachment");
  res.setHeader("Content-Type", "application/octet-stream");

  const args = ["-f", format, "-o", "-", ...ytdlpArgsBase(url)];
  const p = spawn("yt-dlp", args);

  p.on("error", (e) => {
    return res.status(500).json({ error: "Failed to start yt-dlp", details: e.message });
  });

  p.stdout.pipe(res);
  p.stderr.on("data", (d) => console.error(d.toString()));
  p.on("close", () => res.end());
});

app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
