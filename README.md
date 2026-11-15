# Convert Into Any Format

Express server + LibreOffice, qpdf, ffmpeg and pdfplumber. It serves the website (public/) and the API.

Browser tools: merge, split, rotate, delete/extract/reorder pages, number pages, watermark, compress, crop, edit, annotate, sign, redact, form filler, flatten, repair, metadata, compare, reader, PDF to text, JPG/PNG/WebP/PDF image tools, scan to PDF.
Server tools: PDF to Word/PPT/Excel/EPUB, Word/Excel/PPT/OpenOffice/HTML/TXT to PDF, CSV to Excel, Protect, Unlock, audio and video, Share PDF (link valid for 1 hour).
Not built yet: OCR, PDF/A, Request Signatures, AI tools (need an API key).

## Deploy on Render
New > Web Service > this repo > Runtime: Docker > Free plan (or use the render.yaml Blueprint).

## Run locally (needs Docker)
docker build -t convert . && docker run -p 3000:3000 convert

Uploads are deleted right after conversion, and any leftovers after 1 hour.
