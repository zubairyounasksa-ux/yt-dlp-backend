const express = require("express");
const cors = require("cors");
const { spawn } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// Render Environment Variable: YTDLP_COOKIES (full cookies.txt content)
const COOKIES_TEXT = process.env.YTDLP_COOKIES || "";

app.use(cors());

app.get("/", (req, res) => res.send("✅ yt-dlp backend running"));
app.get("/health", (req, res) => res.json({ ok: true }));

function getCookiesFilePath() {
  if (!COOKIES_TEXT.trim()) return null;

  // Write cookies into a temp file inside container
  const filePath = path.join(os.tmpdir(), "yt_cookies.txt");
  fs.writeFileSync(filePath, COOKIES_TEXT, "utf8");
  return filePath;
}

function makeYtDlpArgsForInfo(url) {
  const cookiesFile = getCookiesFilePath();

  const args = [
    "-J",
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

function makeYtDlpArgsForDownload(url, format) {
  const cookiesFile = getCookiesFilePath();

  const args = [
    "-f",
    format,
    "--force-ipv4",
    "--extractor-args",
    "youtube:player_client=android",
    "-o",
    "-",
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

  const args = makeYtDlpArgsForInfo(url);
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
        cookiesLoaded: !!COOKIES_TEXT.trim(),
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
        cookiesLoaded: !!COOKIES_TEXT.trim(),
      });
    } catch (e) {
      res.status(500).json({ error: "Invalid yt-dlp JSON", cookiesLoaded: !!COOKIES_TEXT.trim() });
    }
  });
});

app.get("/download", (req, res) => {
  const { url, format } = req.query;
  if (!url || !format) return res.status(400).json({ error: "Missing url or format parameter" });

  res.setHeader("Content-Disposition", "attachment");
  res.setHeader("Content-Type", "application/octet-stream");

  const args = makeYtDlpArgsForDownload(url, format);
  const p = spawn("yt-dlp", args);

  p.on("error", (e) => {
    return res.status(500).json({ error: "Failed to start yt-dlp", details: e.message });
  });

  p.stdout.pipe(res);
  p.stderr.on("data", (d) => console.error(d.toString()));
  p.on("close", () => res.end());
});

app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
