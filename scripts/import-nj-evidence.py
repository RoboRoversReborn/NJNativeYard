"""Build factual NJ reference snapshots from downloaded primary sources.

Usage: python import-nj-evidence.py native.csv invasive.pdf njda.html
Requires pypdf for PDF extraction. No API credentials or network requests.
"""
import csv
import hashlib
import json
import re
import sys
from html.parser import HTMLParser
from pathlib import Path
from pypdf import PdfReader

root = Path(__file__).resolve().parents[1]
native_path, invasive_path, legal_path = map(Path, sys.argv[1:4])
native = []
regions = ["Northern Highlands", "Mid-Atlantic Coastal Plain", "Northern Piedmont", "Ridge and Valley", "Atlantic Coastal Pine Barrens"]
for row in list(csv.reader(native_path.read_text(encoding="cp1252").splitlines()))[2:]:
    if len(row) < 13 or not re.match(r"^[A-Z][a-z]+ (?:X )?[a-z]", row[0].strip()):
        continue
    native.append({"scientificName": row[0].strip(), "commonName": row[1].strip(),
                   "doNotPlant": bool(row[2].strip()), "conservationNote": row[2].strip(),
                   "ecoregions": [regions[i] for i in range(5) if row[6+i].strip().lower() == "x"],
                   "growthForm": row[12].strip()})

invasive = []
for page in PdfReader(invasive_path).pages:
    for line in page.extract_text().splitlines():
        m = re.match(r"^([A-Z][a-z]+ (?:x )?[a-z-]+(?: (?:var\.|ssp\.) [a-z-]+)?) (.+?) (Emerging|Widespread) (Tree|Shrub|Vine|Herb) (Yes|No)$", line.strip())
        if m:
            invasive.append(dict(zip(["scientificName", "commonName", "invasiveStatus", "growthForm", "soldForPlanting"], m.groups())))

class Tables(HTMLParser):
    def __init__(self):
        super().__init__(); self.rows=[]; self.row=[]; self.cell=None
    def handle_starttag(self, tag, attrs):
        if tag == "tr": self.row=[]
        if tag in ("td", "th"): self.cell=""
    def handle_data(self, data):
        if self.cell is not None: self.cell += data
    def handle_endtag(self, tag):
        if tag in ("td", "th") and self.cell is not None:
            self.row.append(" ".join(self.cell.split())); self.cell=None
        if tag == "tr" and self.row: self.rows.append(self.row)

parser=Tables(); parser.feed(legal_path.read_text())
legal=[]
for row in parser.rows:
    if len(row) == 5 and row[0].isdigit():
        if legal and int(row[0]) != len(legal) + 1:
            break
        # Correct two typographic species errors in the NJDA display table;
        # the statutory spellings and NJISST snapshot corroborate these names.
        sci=f"{row[2]} {row[3]}"
        sci=sci.replace("Humulus japonicas", "Humulus japonicus").replace("Lespedeza cuneate", "Lespedeza cuneata")
        legal.append({"scientificName": sci, "commonName": row[1], "subspecies": row[4]})
assert len(native) > 1500 and len(invasive) > 120 and len(legal) == 30, (len(native),len(invasive),len(legal))
result={"version":"2026-11-04.1", "checkedOn":"2026-11-04", "sources":{
    "native":{"title":"NJDEP New Jersey Native Regional Plant List 2022", "url":"https://dspace.njstatelib.org/items/b2543302-7f0b-4cf2-8ed5-e988bd48c10a", "download":"https://dspace.njstatelib.org/server/api/core/bitstreams/cb006c2c-8226-4c31-b510-663c48cd185d/content", "sha256":hashlib.sha256(native_path.read_bytes()).hexdigest()},
    "invasive":{"title":"NJ Invasive Species Strike Team · 2025 Do Not Plant List", "url":"https://www.fohvos.info/wp-content/uploads/2025_Strike_Team_Do_Not_Plant_List_Scientific_Name_Sort_2025_03_14.pdf", "sha256":hashlib.sha256(invasive_path.read_bytes()).hexdigest()},
    "legal":{"title":"NJ Department of Agriculture · Invasive Species", "url":"https://nj.gov/agriculture/divisions/pi/prog/InvasivePlants.shtml", "sha256":hashlib.sha256(legal_path.read_bytes()).hexdigest()}},
    "native":native,"invasive":invasive,"legal":legal}
(root/"data/nj-evidence.v1.json").write_text(json.dumps(result,ensure_ascii=False,indent=2)+"\n")
print(json.dumps({"native":len(native),"invasive":len(invasive),"legal":len(legal)}))
