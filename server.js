const express = require("express");
const multer = require("multer");
const { execFile } = require("child_process");
const fs = require("fs");
const path = require("path");
const os = require("os");

const app = express();
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "cv-"));
const upload = multer({ dest: tmp, limits: { fileSize: 50 * 1024 * 1024 } });

// tool id -> allowed input extensions, output extension, LibreOffice args
const T = {
  "pdf-to-word": { inx: [".pdf"], out: "docx", args: ["--infilter=writer_pdf_import", "--convert-to", "docx:MS Word 2007 XML"] },
  "pdf-to-ppt": { inx: [".pdf"], out: "pptx", args: ["--infilter=impress_pdf_import", "--convert-to", "pptx"] },
  "word-to-pdf": { inx: [".doc", ".docx"], out: "pdf", args: ["--convert-to", "pdf"] },
  "excel-to-pdf": { inx: [".xls", ".xlsx"], out: "pdf", args: ["--convert-to", "pdf"] },
  "ppt-to-pdf": { inx: [".ppt", ".pptx"], out: "pdf", args: ["--convert-to", "pdf"] },
  "odt-to-pdf": { inx: [".odt"], out: "pdf", args: ["--convert-to", "pdf"] },
  "ods-to-pdf": { inx: [".ods"], out: "pdf", args: ["--convert-to", "pdf"] },
  "odp-to-pdf": { inx: [".odp"], out: "pdf", args: ["--convert-to", "pdf"] },
};

// LibreOffice handles one conversion at a time per profile, so queue jobs.
let queue = Promise.resolve();
const enqueue = (fn) => (queue = queue.then(fn, fn));

function convert(t, src, dir) {
  return new Promise((resolve, reject) => {
    const profile = "file://" + path.join(tmp, "profile");
    execFile(
      "soffice",
      ["-env:UserInstallation=" + profile, "--headless", "--norestore", ...t.args, "--outdir", dir, src],
      { timeout: 120000 },
      (err) => (err ? reject(err) : resolve())
    );
  });
}

app.post("/api/convert/:id", upload.single("file"), async (req, res) => {
  const t = T[req.params.id];
  const f = req.file;
  const fail = (code, error) => {
    if (f) fs.rm(f.path, { force: true }, () => {});
    res.status(code).json({ error });
  };
  if (!t) return fail(404, "Unknown tool.");
  if (!f) return fail(400, "No file uploaded.");
  const ext = path.extname(f.originalname).toLowerCase();
  if (!t.inx.includes(ext)) return fail(400, "Unsupported file. Use: " + t.inx.join(", "));

  const dir = fs.mkdtempSync(path.join(tmp, "job-"));
  const src = path.join(dir, "input" + ext);
  fs.renameSync(f.path, src);
  const outDir = path.join(dir, "out");
  fs.mkdirSync(outDir);
  try {
    await enqueue(() => convert(t, src, outDir));
    const out = path.join(outDir, "input." + t.out);
    if (!fs.existsSync(out)) throw new Error("no output");
    res.setHeader("X-Ext", t.out);
    res.download(out, "converted." + t.out, () => fs.rm(dir, { recursive: true, force: true }, () => {}));
  } catch (e) {
    fs.rm(dir, { recursive: true, force: true }, () => {});
    res.status(500).json({ error: "Conversion failed. The file may be damaged, protected or too complex." });
  }
});

// safety net: delete anything older than 1 hour
setInterval(() => {
  for (const n of fs.readdirSync(tmp)) {
    if (n === "profile") continue;
    const p = path.join(tmp, n);
    try { if (Date.now() - fs.statSync(p).mtimeMs > 3600000) fs.rmSync(p, { recursive: true, force: true }); } catch (e) {}
  }
}, 600000).unref();

app.use((err, req, res, next) => res.status(400).json({ error: err.code === "LIMIT_FILE_SIZE" ? "File is over the 50 MB limit." : "Upload failed." }));
app.use(express.static(path.join(__dirname, "public")));
app.listen(process.env.PORT || 3000, () => console.log("Running"));
