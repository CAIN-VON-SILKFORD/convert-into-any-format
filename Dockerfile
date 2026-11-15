FROM node:20-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends \
    libreoffice-writer libreoffice-calc libreoffice-impress libreoffice-draw \
    qpdf ffmpeg python3 python3-venv \
    fonts-liberation fonts-noto-core && rm -rf /var/lib/apt/lists/*
RUN python3 -m venv /opt/v && /opt/v/bin/pip install --no-cache-dir pdfplumber openpyxl
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY . .
ENV PORT=3000
EXPOSE 3000
CMD ["node","server.js"]
