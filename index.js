const express = require("express");
const cors = require("cors");
const { spawn } = require("child_process");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());

// Root check
app.get("/", (req, res) => res.send("✅ yt-dlp backend running"));

// Health check
app.get("/health", (req, res) => res.json({ ok: true }));

/**
 * GET /info?url=YOUTUBE_URL
 * Fetch video metadata & formats
 */
app.get("/info", (req, res) => {
  const url = req.query.url;
  if (!url) {
    return res.status(400).json({ error: "Missing url parameter" });
  }

  const p = spawn("yt-dlp", [
    "-J",
    "--no-playlist",
    "--force-ipv4",
    "--extractor-args",
    "youtube:player_client=android",
    url,
  ]);

  p.on("error", (e) => {
    return res.status(500).json({
      error: "Failed to start yt-dlp",
      details: e.message,
    });
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
    } catch (e) {
      res.status(500).json({ error: "Invalid yt-dlp JSON" });
    }
  });
});

/**
 * GET /download?url=YOUTUBE_URL&format=FORMAT_ID
 * Stream selected format
 */
app.get("/download", (req, res) => {
  const { url, format } = req.query;
  if (!url || !format) {
    return res.status(400).json({ error: "Missing url or format parameter" });
  }

  res.setHeader("Content-Disposition", "attachment");
  res.setHeader("Content-Type", "application/octet-stream");

  const p = spawn("yt-dlp", [
    "-f",
    format,
    "--force-ipv4",
    "--extractor-args",
    "youtube:player_client=android",
    "-o",
    "-",
    url,
  ]);

  p.on("error", (e) => {
    return res.status(500).json({
      error: "Failed to start yt-dlp",
      details: e.message,
    });
  });

  p.stdout.pipe(res);
  p.stderr.on("data", (d) => console.error(d.toString()));
  p.on("close", () => res.end());
});

app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
