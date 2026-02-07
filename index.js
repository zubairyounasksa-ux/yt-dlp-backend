import express from "express";
import cors from "cors";
import ytdlp from "yt-dlp-exec";

const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors());

// Health check
app.get("/health", (req, res) => res.json({ ok: true }));

// Root
app.get("/", (req, res) => res.send("✅ yt-dlp backend running"));

// GET /info?url=...
app.get("/info", async (req, res) => {
  const url = req.query.url;
  if (!url) return res.status(400).json({ error: "Missing url parameter" });

  try {
    const info = await ytdlp(url, {
      dumpSingleJson: true,
      noPlaylist: true,
      noWarnings: true
    });

    const formats = (info.formats || [])
      .filter((f) => f.format_id && (f.vcodec !== "none" || f.acodec !== "none"))
      .map((f) => ({
        formatId: f.format_id,
        ext: f.ext || "",
        quality:
          f.vcodec === "none"
            ? `${Math.round(f.abr || 0)} kbps (Audio)`
            : `${f.height || 0}p`,
        fps: f.fps || null,
        sizeMB: f.filesize ? (f.filesize / 1024 / 1024).toFixed(1) : null,
        isAudio: f.vcodec === "none",
        vcodec: f.vcodec,
        acodec: f.acodec
      }))
      .sort((a, b) => {
        // video first, audio last, then bigger size first (null sizes go last)
        if (a.isAudio && !b.isAudio) return 1;
        if (!a.isAudio && b.isAudio) return -1;
        const as = a.sizeMB ? parseFloat(a.sizeMB) : -1;
        const bs = b.sizeMB ? parseFloat(b.sizeMB) : -1;
        return bs - as;
      });

    res.json({
      title: info.title,
      thumbnail: info.thumbnail,
      duration: info.duration,
      channel: info.uploader,
      webpage_url: info.webpage_url,
      formats
    });
  } catch (err) {
    console.error("INFO ERROR:", err?.message || err);
    res.status(500).json({ error: "Failed to fetch info" });
  }
});

// GET /download?url=...&format=...
app.get("/download", async (req, res) => {
  const { url, format } = req.query;
  if (!url || !format) {
    return res.status(400).json({ error: "Missing url or format parameter" });
  }

  // Basic filename safety
  res.setHeader("Content-Disposition", "attachment");
  res.setHeader("Content-Type", "application/octet-stream");

  try {
    const proc = ytdlp.raw(url, {
      format,
      output: "-",         // pipe to stdout
      noPlaylist: true,
      noWarnings: true
    });

    proc.stdout.pipe(res);

    proc.stderr.on("data", (d) => console.error("yt-dlp:", d.toString()));
    proc.on("close", (code) => {
      if (code !== 0 && !res.headersSent) res.status(500).end();
      else res.end();
    });
  } catch (err) {
    console.error("DOWNLOAD ERROR:", err?.message || err);
    if (!res.headersSent) res.status(500).json({ error: "Download failed" });
  }
});

app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
