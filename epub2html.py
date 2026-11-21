import sys, zipfile, re, base64, posixpath, mimetypes
from xml.etree import ElementTree as ET

src, out = sys.argv[1], sys.argv[2]
z = zipfile.ZipFile(src)
C = {"c": "urn:oasis:names:tc:opendocument:xmlns:container"}
O = "{http://www.idpf.org/2007/opf}"
opf_path = ET.fromstring(z.read("META-INF/container.xml")).find(".//c:rootfile", C).get("full-path")
opf = ET.fromstring(z.read(opf_path))
base = posixpath.dirname(opf_path)
man = {i.get("id"): i.get("href") for i in opf.iter(O + "item")}
spine = [man[r.get("idref")] for r in opf.iter(O + "itemref") if r.get("idref") in man]
if not spine:
    sys.exit(3)
parts = []
for href in spine:
    p = posixpath.normpath(posixpath.join(base, href))
    html = z.read(p).decode("utf-8", "replace")
    m = re.search(r"<body[^>]*>(.*)</body>", html, re.S | re.I)
    body = m.group(1) if m else html
    folder = posixpath.dirname(p)

    def inline(mm, folder=folder):
        ref = mm.group(2)
        if ref.startswith(("data:", "http")):
            return mm.group(0)
        ip = posixpath.normpath(posixpath.join(folder, ref.split("#")[0]))
        try:
            data = z.read(ip)
        except KeyError:
            return mm.group(0)
        mt = mimetypes.guess_type(ip)[0] or "image/png"
        return mm.group(1) + "data:%s;base64,%s" % (mt, base64.b64encode(data).decode()) + mm.group(3)

    body = re.sub(r"(<img[^>]*?src=[\"'])([^\"']+)([\"'])", inline, body, flags=re.I)
    parts.append(body)
with open(out, "w", encoding="utf-8") as f:
    f.write('<html><head><meta charset="utf-8"></head><body>' + '<p style="page-break-after:always"></p>'.join(parts) + "</body></html>")
