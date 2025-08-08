import express from "express";
import multer from "multer";
import FormData from "form-data";
import fetch from "node-fetch";

const app = express();

// Optional: simple allow-list using a shared token
const TOKEN = process.env.PROXY_TOKEN; // set on Render if you want protection

// Keep files in memory (no disk). Raise limit if you expect bigger files.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB
});

app.get("/", (_, res) => res.send("🟢 Vapi upload proxy running"));

app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    if (TOKEN && req.header("X-Proxy-Token") !== TOKEN) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (!req.file) {
      return res.status(400).json({ message: "file is required" });
    }

    const form = new FormData();
    // Use originalname so Vapi can infer mimetype/filename
    form.append("file", req.file.buffer, req.file.originalname);

    const r = await fetch("https://api.vapi.ai/file", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.VAPI_KEY}`
        // DO NOT set Content-Type — FormData handles boundary
      },
      body: form
    });

    const text = await r.text();
    res.status(r.status).type("application/json").send(text);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: String(err) });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Proxy listening on ${PORT}`));
