const express = require("express");
const multer = require("multer");
const crypto = require("crypto");
const { execFile } = require("child_process");
const fs = require("fs");
const path = require("path");
const os = require("os");

const PY = fs.existsSync("/opt/v/bin/python3") ? "/opt/v/bin/python3" : "python3";
const app = express();
app.set("trust proxy", 1);
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "cv-"));
const shareDir = path.join(tmp, "shared");
fs.mkdirSync(shareDir);
const upload = multer({ dest: tmp, limits: { fileSize: 50 * 1024 * 1024 } });

// One heavy job at a time keeps the free plan's small server stable.
let queue = Promise.resolve();
const enqueue = (fn) => (queue = queue.then(fn, fn));

const fail = (msg) => Object.assign(new Error(msg), { user: msg });
function sh(cmd, args, ms, okCodes = [0]) {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { timeout: ms, maxBuffer: 1 << 24 }, (err) => {
      if (!err || okCodes.includes(err.code)) return resolve();
      reject(err);
    });
  });
}
// LibreOffice conversion; output is always <outDir>/input.<ext>
const lo = (inx, out, args) => ({
  inx, out,
  run: ({ src, outDir }) =>
    sh("soffice", ["-env:UserInstallation=file://" + path.join(tmp, "profile"), "--headless", "--norestore", ...args, "--outdir", outDir, src], 120000),
});
const AUDIO = [".mp3", ".wav", ".ogg", ".m4a", ".aac", ".flac", ".wma"];
const VIDEO = [".mp4", ".mov", ".avi", ".mkv", ".webm", ".gif"];
const MEDIA_OUT = { mp3: [], wav: [], ogg: [], mp4: ["-c:v", "libx264", "-preset", "veryfast", "-crf", "28", "-c:a", "aac", "-movflags", "+faststart"], gif: ["-t", "10", "-vf", "fps=10,scale=480:-1:flags=lanczos"] };

const T = {
  "pdf-to-word": lo([".pdf"], "docx", ["--infilter=writer_pdf_import", "--convert-to", "docx:MS Word 2007 XML"]),
  "pdf-to-ppt": lo([".pdf"], "pptx", ["--infilter=impress_pdf_import", "--convert-to", "pptx"]),
  "pdf-to-epub": lo([".pdf"], "epub", ["--infilter=writer_pdf_import", "--convert-to", "epub"]),
  "word-to-pdf": lo([".doc", ".docx"], "pdf", ["--convert-to", "pdf"]),
  "excel-to-pdf": lo([".xls", ".xlsx"], "pdf", ["--convert-to", "pdf"]),
  "ppt-to-pdf": lo([".ppt", ".pptx"], "pdf", ["--convert-to", "pdf"]),
  "odt-to-pdf": lo([".odt"], "pdf", ["--convert-to", "pdf"]),
  "ods-to-pdf": lo([".ods"], "pdf", ["--convert-to", "pdf"]),
  "odp-to-pdf": lo([".odp"], "pdf", ["--convert-to", "pdf"]),
  "html-to-pdf": lo([".html", ".htm"], "pdf", ["--convert-to", "pdf:writer_web_pdf_Export"]),
  "txt-to-pdf": lo([".txt"], "pdf", ["--convert-to", "pdf"]),
  "csv-to-excel": lo([".csv"], "xlsx", ["--convert-to", "xlsx"]),
  "pdf-to-excel": {
    inx: [".pdf"], out: "xlsx",
    run: async ({ src, outDir }) => {
      try { await sh(PY, [path.join(__dirname, "pdf2xlsx.py"), src, path.join(outDir, "input.xlsx")], 120000); }
      catch (e) { throw fail(e.code === 3 ? "No tables or text found. Scanned PDFs need OCR, which is not available yet." : "Could not read this PDF."); }
    },
  },
  protect: {
    inx: [".pdf"], out: "pdf",
    run: async ({ src, outDir, o }) => {
      if (!o) throw fail("Enter a password.");
      await sh("qpdf", ["--encrypt", o, o, "256", "--", src, path.join(outDir, "input.pdf")], 60000, [0, 3]);
    },
  },
  unlock: {
    inx: [".pdf"], out: "pdf",
    run: async ({ src, outDir, o }) => {
      try { await sh("qpdf", ["--password=" + (o || ""), "--decrypt", src, path.join(outDir, "input.pdf")], 60000, [0, 3]); }
      catch (e) { throw fail("Wrong password, or this PDF is not protected."); }
    },
  },
  media: {
    inx: [...AUDIO, ...VIDEO], out: null,
    run: async ({ src, outDir, o }) => {
      if (!MEDIA_OUT[o]) throw fail("Choose an output format.");
      const audioOnly = ["mp3", "wav", "ogg"].includes(o);
      try { await sh("ffmpeg", ["-i", src, ...(audioOnly ? ["-vn"] : []), ...MEDIA_OUT[o], "-y", path.join(outDir, "input." + o)], 110000); }
      catch (e) { throw fail("Could not convert this file. It may have no audio track, be too long, or use an unsupported format."); }
      return o;
    },
  },
};

app.post("/api/convert/:id", upload.single("file"), async (req, res) => {
  const t = T[req.params.id];
  const f = req.file;
  const bye = (code, error) => {
    if (f) fs.rm(f.path, { force: true }, () => {});
    res.status(code).json({ error });
  };
  if (!t) return bye(404, "Unknown tool.");
  if (!f) return bye(400, "No file uploaded.");
  const ext = path.extname(f.originalname).toLowerCase();
  if (!t.inx.includes(ext)) return bye(400, "Unsupported file. Use: " + t.inx.join(", "));

  const dir = fs.mkdtempSync(path.join(tmp, "job-"));
  const src = path.join(dir, "input" + ext);
  fs.renameSync(f.path, src);
  const outDir = path.join(dir, "out");
  fs.mkdirSync(outDir);
  const clean = () => fs.rm(dir, { recursive: true, force: true }, () => {});
  try {
    const o = String(req.body.o || "");
    const made = await enqueue(() => t.run({ src, outDir, o }));
    const outExt = t.out || made;
    const out = path.join(outDir, "input." + outExt);
    if (!fs.existsSync(out)) throw new Error("no output");
    res.setHeader("X-Ext", outExt);
    res.download(out, "converted." + outExt, clean);
  } catch (e) {
    clean();
    res.status(e.user ? 400 : 500).json({ error: e.user || "Conversion failed. The file may be damaged, protected or too complex." });
  }
});

// Share PDF: temporary link, deleted after 1 hour
app.post("/api/share", upload.single("file"), (req, res) => {
  const f = req.file;
  const bye = (code, error) => { if (f) fs.rm(f.path, { force: true }, () => {}); res.status(code).json({ error }); };
  if (!f) return bye(400, "No file uploaded.");
  const head = Buffer.alloc(5);
  const fd = fs.openSync(f.path, "r"); fs.readSync(fd, head, 0, 5, 0); fs.closeSync(fd);
  if (path.extname(f.originalname).toLowerCase() !== ".pdf" || head.toString() !== "%PDF-") return bye(400, "Only PDF files can be shared.");
  const id = crypto.randomBytes(12).toString("hex");
  fs.renameSync(f.path, path.join(shareDir, id + ".pdf"));
  res.json({ id });
});
app.get("/s/:id", (req, res) => {
  if (!/^[a-f0-9]{24}$/.test(req.params.id)) return res.status(404).send("Not found");
  const p = path.join(shareDir, req.params.id + ".pdf");
  if (!fs.existsSync(p)) return res.status(404).send("This link has expired.");
  res.type("application/pdf").sendFile(p);
});

// safety net: delete anything older than 1 hour
setInterval(() => {
  const sweep = (dir) => {
    for (const n of fs.readdirSync(dir)) {
      if (n === "profile" || n === "shared") continue;
      const p = path.join(dir, n);
      try { if (Date.now() - fs.statSync(p).mtimeMs > 3600000) fs.rmSync(p, { recursive: true, force: true }); } catch (e) {}
    }
  };
  sweep(tmp); sweep(shareDir);
}, 600000).unref();

app.use((err, req, res, next) => res.status(400).json({ error: err.code === "LIMIT_FILE_SIZE" ? "File is over the 50 MB limit." : "Upload failed." }));
app.use(express.static(path.join(__dirname, "public")));
app.listen(process.env.PORT || 3000, () => console.log("Running"));
