const express = require("express");
const cors = require("cors");
const { spawn } = require("child_process");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());

app.get("/", (req, res) => res.send("✅ yt-dlp backend running"));
app.get("/health", (req, res) => res.json({ ok: true }));

app.get("/info", (req, res) => {
  const url = req.query.url;
  if (!url) return res.status(400).json({ error: "Missing url parameter" });

  const p = spawn("yt-dlp", ["-J", "--no-playlist", url]);

  let out = "";
  let err = "";
  p.stdout.on("data", (d) => (out += d.toString()));
  p.stderr.on("data", (d) => (err += d.toString()));

  p.on("close", (code) => {
    if (code !== 0) return res.status(500).json({ error: "yt-dlp failed", details: err });

    try {
      const json = JSON.parse(out);
      res.json({
        title: json.title,
        thumbnail: json.thumbnail,
        duration: json.duration,
        channel: json.uploader,
        formats: (json.formats || []).map((f) => ({
          formatId: f.format_id,
          ext: f.ext,
          height: f.height,
          abr: f.abr,
          filesize: f.filesize,
          vcodec: f.vcodec,
          acodec: f.acodec
        }))
      });
    } catch (e) {
      res.status(500).json({ error: "Invalid yt-dlp JSON" });
    }
  });
});

app.get("/download", (req, res) => {
  const { url, format } = req.query;
  if (!url || !format) return res.status(400).json({ error: "Missing url or format" });

  res.setHeader("Content-Disposition", "attachment");
  res.setHeader("Content-Type", "application/octet-stream");

  const p = spawn("yt-dlp", ["-f", format, "-o", "-", url]);
  p.stdout.pipe(res);
  p.stderr.on("data", (d) => console.error(d.toString()));
  p.on("close", () => res.end());
});

app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
