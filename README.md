# Convert Into Any Format

Express server + LibreOffice, qpdf, ffmpeg and pdfplumber. It serves the website (public/) and the API.

Browser tools: merge, split, rotate, delete/extract/reorder pages, number pages, watermark, compress, crop, edit, annotate, sign, redact, form filler, flatten, repair, metadata, compare, reader, PDF to text, PDF OCR (English, tesseract.js), image tools, scan to PDF.
Server tools: PDF to Word/PPT/Excel/EPUB/PDF-A, Word/Excel/PPT/OpenOffice/HTML/TXT/EPUB to PDF, CSV to Excel, Protect, Unlock, audio and video, Share PDF (link valid for 1 hour), Request Signatures (link valid for 24 hours).
AI tools (Summarize, Chat, Translate): add an environment variable ANTHROPIC_API_KEY on Render (optional AI_MODEL). Each visitor is limited to 15 AI requests per hour and the whole site to 400 per day.
Note: on Render's free plan the disk is temporary, so shared and signing links stop working if the server restarts or sleeps.

## Deploy on Render
New > Web Service > this repo > Runtime: Docker > Free plan (or use the render.yaml Blueprint).

## Run locally (needs Docker)
docker build -t convert . && docker run -p 3000:3000 convert

Uploads are deleted right after conversion, and any leftovers after 1 hour.
