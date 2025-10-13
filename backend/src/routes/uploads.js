import { Router } from "express"
import multer from "multer"
import sharp from "sharp"
import { requireAuth } from "../middlewares/require-auth.js"

const r = Router()
r.use(requireAuth)

// Use memory storage to avoid temp files; enforce per-file limits via multer
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB per file
    files: 24,
  },
  fileFilter: (_req, file, cb) => {
    if (/^image\/(jpeg|png|webp)$/i.test(file.mimetype)) return cb(null, true)
    cb(new Error("Nepodržan tip fajla"))
  },
})

// POST /api/uploads/images -> returns array of processed images {name,type,size,dataUrl}
r.post("/images", upload.array("photos", 24), async (req, res) => {
  try {
    const files = req.files || []
    const results = []
    for (const f of files) {
      // Use sharp to transcode to webp (lossy but efficient), cap dimensions
      const img = sharp(f.buffer, { failOnError: false })
      const meta = await img.metadata().catch(() => ({}))
      // Resize very large images to reasonable max (e.g., 2560px max width/height)
      const w = meta.width || 0
      const h = meta.height || 0
      const shouldResize = w > 2560 || h > 2560
      const pipeline = shouldResize
        ? img.resize({ width: 2560, height: 2560, fit: "inside" })
        : img
      const webpBuf = await pipeline.webp({ quality: 82 }).toBuffer()
      const b64 = webpBuf.toString("base64")
      results.push({
        name: f.originalname.replace(/\.[^.]+$/, ".webp"),
        type: "image/webp",
        size: webpBuf.length,
        dataUrl: `data:image/webp;base64,${b64}`,
        source: "upload",
      })
    }
    res.json({ ok: true, images: results })
  } catch (e) {
    console.error("[upload] error", e)
    // Avoid 413; always reply 200 with per-file errors if needed
    return res
      .status(200)
      .json({ ok: false, error: e.message || "Upload greška" })
  }
})

export default r
