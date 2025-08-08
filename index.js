import express from "express";
import multer from "multer";
import FormData from "form-data";
import fetch from "node-fetch";

const app = express();

// keep uploads in memory (raise if needed)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB
});

// simple health check
app.get("/", (_req, res) => res.send("🟢 Vapi upload proxy running"));

// upload endpoint n8n/Postman will call
app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "file is required" });

    // sanitize filename to avoid WAF false positives
    const orig = req.file.originalname || "upload.bin";
    const ext = orig.includes(".") ? orig.split(".").pop() : "bin";
    const safeName = `upload_${Date.now()}.${ext}`.replace(/[^A-Za-z0-9._-]/g, "_");

    console.log(`[proxy] POST /upload -> ${safeName} (${req.file.mimetype}, ${req.file.size} bytes)`);

    const form = new FormData();
    form.append("file", req.file.buffer, safeName); // let FormData set boundary

    const r = await fetch("https://api.vapi.ai/file", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.VAPI_KEY}` },
      body: form
    });

    const text = await r.text(); // forward raw JSON/text back
    res.status(r.status).type("application/json").send(text);
  } catch (err) {
    console.error("[proxy] error:", err);
    res.status(500).json({ error: String(err) });
  }
});

// Render provides PORT
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Proxy running on port ${PORT}`));
