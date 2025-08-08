// index.js
import express from "express";
import multer from "multer";
import FormData from "form-data";
import fetch from "node-fetch";

const app = express();

// keep uploads in memory (bump if you expect bigger files)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB
});

// simple health check
app.get("/", (_req, res) => res.send("🟢 Vapi upload proxy running"));

// n8n/Postman will POST here with form-data key: file (binary)
app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "file is required" });
    }

    // ---- sanitize filename to avoid WAF false positives ----
    const orig = req.file.originalname || "upload.bin";
    const ext = orig.includes(".") ? orig.split(".").pop() : "bin";
    const safeName = `upload_${Date.now()}.${ext}`.replace(/[^A-Za-z0-9._-]/g, "_");
    // --------------------------------------------------------

    console.log(
      `[proxy] POST /upload -> ${safeName} (${req.file.mimetype}, ${req.file.size} bytes)`
    );

    // Build multipart form for Vapi
    const form = new FormData();
    // Vapi expects purpose for some flows; "assistant" is safe/default
    form.append("purpose", "assistant");
    form.append("file", req.file.buffer, {
      filename: safeName,
      contentType: req.file.mimetype || "application/octet-stream"
    });

    // Forward to Vapi
    const r = await fetch("https://api.vapi.ai/file", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.VAPI_KEY}` // set on Render
        // DO NOT set Content-Type; form-data will set the boundary
      },
      body: form
    });

    const text = await r.text(); // Vapi returns JSON; just forward
    res.status(r.status).type("application/json").send(text);
  } catch (err) {
    console.error("[proxy] error:", err);
    res.status(500).json({ error: String(err) });
  }
});

// Render injects PORT
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Proxy running on port ${PORT}`));

