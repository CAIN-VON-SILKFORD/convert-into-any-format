import sys
import pdfplumber
from openpyxl import Workbook

src, out = sys.argv[1], sys.argv[2]
wb = Workbook()
first = True
total = 0
with pdfplumber.open(src) as pdf:
    for i, page in enumerate(pdf.pages, 1):
        ws = wb.active if first else wb.create_sheet()
        first = False
        ws.title = ("Page %d" % i)[:31]
        r = 1
        tables = page.extract_tables()
        for t in tables:
            for row in t:
                for c, v in enumerate(row, 1):
                    ws.cell(r, c, v)
                r += 1
            r += 1
        if not tables:
            for line in (page.extract_text() or "").splitlines():
                ws.cell(r, 1, line)
                r += 1
        total += r - 1
if total == 0:
    sys.exit(3)
wb.save(out)
