# Convert Into Any Format

Express server + LibreOffice. It serves the website (public/index.html) and the API (POST /api/convert/:tool).

Browser tools: merge, split, rotate, delete/extract/reorder pages, number pages, watermark, compress, JPG/PNG/WebP to PDF, PDF to JPG/PNG.
Server tools: PDF to Word, PDF to PPT, Word/Excel/PPT to PDF, ODT/ODS/ODP to PDF.

## Deploy on Render
New > Web Service > this repo > Runtime: Docker > Free plan (or use the render.yaml Blueprint).

## Run locally (needs Docker)
docker build -t convert . && docker run -p 3000:3000 convert

Uploads are deleted right after conversion, and any leftovers after 1 hour.
