import express from "express";
import multer from "multer";
import FormData from "form-data";
import fetch from "node-fetch";

const app = express();

// Optional: shared-secret to restrict who can call the proxy
const TOKEN = process.env.PROXY_TOKEN || null;

// Keep uploads in memory; bump fileSize if you expect bigger files
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB
});

app.get("/", (_, res) => res.send("🟢 Vapi upload proxy running"));

app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    // Optional token check
    if (TOKEN && req.header("X-Proxy-Token") !== TOKEN) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (!req.file) {
      return res.status(400).json({ message: "file is required" });
    }

    // ---- Sanitize filename to avoid WAF/Cloudflare false positives ----
    const orig = req.file.originalname || "upload.bin";
    const ext = orig.includes(".") ? orig.split(".").pop() : "bin";
    const safeName = `upload_${Date.now()}.${ext}`.replace(/[^A-Za-z0-9._-]/g, "_");
    // ------------------------------------------------------------------

    // Small log so you can see hits + final filename in Render logs
    console.log(`[proxy] POST /upload -> ${safeName} (${req.file.mimetype}, ${req.file.size} bytes)`);

    const form = new FormData();
    form.append("file", req.file.buffer, safeName); // let FormData set boundary

    const r = await fetch("https://api.vapi.ai/file", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.VAPI_KEY}` // set on Render
      },
      body: form
    });

    const text = await r.text();
    res.status(r.status).type("application/json").send(text);
  } catch (err) {
    console.error("[proxy] error:", err);
    res.status(500).json({ error: String(err) });
  }
});

// Render provides PORT
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Proxy listening on ${PORT}`));

