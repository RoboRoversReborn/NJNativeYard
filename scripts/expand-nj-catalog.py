"""Reproducible offline factual expansion; Python openpyxl/pypdf are required.

Inputs are public source files; no API keys, generated care text or image fetches.
Run --help for arguments. Output includes source SHA256 and rejected PDF rows.
"""
import argparse
import hashlib
import json
import re
import unicodedata
from pathlib import Path
from pypdf import PdfReader
import openpyxl

parser=argparse.ArgumentParser()
parser.add_argument("--flora",type=Path,required=True)
parser.add_argument("--native-program",type=Path,required=True)
parser.add_argument("--watch",type=Path,required=True)
parser.add_argument("--nwf",type=Path,required=True)
parser.add_argument("--checked-on",default="2026-11-04")
args=parser.parse_args()
root=Path(__file__).resolve().parents[1]
data=json.loads((root/"data/nj-evidence.v1.json").read_text())
def clean(value): return " ".join(unicodedata.normalize("NFKC",str(value or "")).split())
def norm(value): return clean(value).lower().replace("×","x").replace("ssp.","subsp.")
flora=[]
workbook=openpyxl.load_workbook(args.flora,read_only=True,data_only=True)
for row in list(workbook["all"].values)[1:]:
    name,common,origin,family,category,wetland=map(clean,row[:6])
    if not name or origin not in ("N","I","NI"): raise ValueError("Unexpected NJ flora row")
    flora.append(dict(scientificName=name,commonName=common,originCode=origin,family=family,botanicalCategory=category,wetlandIndicators=wetland))
if len(flora)!=3048 or len({norm(r["scientificName"]) for r in flora})!=len(flora): raise ValueError("NJ flora row count/uniqueness changed; review before importing")

# Reassemble multiline PDF rows, normalize ligatures, and quarantine spellings
# whose binomial is not corroborated by the independent NJ source tables.
known={norm(r["scientificName"]) for r in flora+data["native"]}
known.update(norm(a["to"]) for a in json.loads((root/"data/nj-taxonomy-aliases.v1.json").read_text())["aliases"])
native_program=[]; rejected=[]
row_pattern=re.compile(r"^([A-Z][a-z]+ [a-z-]+(?:(?: subsp\.| var\.| f\.) [a-z-]+)?) (.+?) (Herb|Tree|Shrub|Vine|Graminoid|Subshrub|Tree/Shrub|Shrub/Tree)$")
for page in PdfReader(args.native_program).pages[4:]:
    buffer=""
    for raw in page.extract_text().splitlines():
        line=clean(raw)
        if re.match(r"^[A-Z][a-z]+ [a-z-]+",line):
            if buffer: rejected.append({"candidate":buffer[:100],"reason":"incomplete row"})
            buffer=line
        elif buffer: buffer+=" "+line
        if buffer and re.search(r" (Herb|Tree|Shrub|Vine|Graminoid|Subshrub|Tree/Shrub|Shrub/Tree)$",buffer):
            match=row_pattern.match(buffer)
            if match:
                name,common,habit=match.groups()
                base=" ".join(name.split()[:2])
                if common.startswith("x "):
                    rejected.append({"candidate":name+" "+common,"reason":"Hybrid formula must not merge into a parent species"})
                elif norm(base) in known:
                    native_program.append(dict(scientificName=name,commonName=common,growthForm=habit))
                else: rejected.append({"candidate":name,"reason":"PDF spelling not corroborated in independent NJ name tables"})
            else: rejected.append({"candidate":buffer[:100],"reason":"unrecognized row structure"})
            buffer=""
    if buffer: rejected.append({"candidate":buffer[:100],"reason":"incomplete page row"})
if len(native_program)<900: raise ValueError(f"Native program extraction too small: {len(native_program)}")
if len({norm(r['scientificName']) for r in native_program})!=len(native_program): raise ValueError("Duplicate native program names")

watch=[]
for page in PdfReader(args.watch).pages:
    for line in page.extract_text().splitlines():
        m=re.match(r"^([A-Z][a-z]+ (?:x )?[a-z-]+(?: (?:var\.|ssp\.) [a-z-]+)?) (.+?) (Uncertain) (Tree|Shrub|Vine|Herb) (Yes|No)$",clean(line))
        if m: watch.append(dict(zip(["scientificName","commonName","watchStatus","growthForm","soldForPlanting"],m.groups())))
if len(watch)<60: raise ValueError(f"Watch extraction too small: {len(watch)}")

# Transcribed genus names (not wildlife counts) from the two NWF Ecoregion 8
# tables. Source spellings Symphyatrichum/Symphyotrichun corrected to the genus
# Symphyotrichum also printed in the source's bee table and species examples.
caterpillar="Quercus Prunus Salix Betula Populus Acer Malus Vaccinium Carya Pinus Alnus Ulmus Picea Tilia Rubus Juglans Fraxinus Fagus Castanea Abies Larix Corylus Solidago Myrica Rosa Symphyotrichum Cornus Tsuga Amelanchier".split()
bee="Helianthus Solidago Symphyotrichum Grindelia Rudbeckia Heterotheca Coreopsis Chrysopsis Verbesina Bidens Cirsium Salix Vaccinium Erigeron Vernonia Pityopsis Ratibida Silphium Baccharis Euthamia Dalea Oenothera Echinacea Gaillardia Balduina Helenium Heliopsis Pectis Cornus Lyonia".split()
nwf_text=" ".join(page.extract_text() for page in PdfReader(args.nwf).pages)
for genus in set(caterpillar+bee)-{"Symphyotrichum"}:
    if genus not in nwf_text: raise ValueError(f"NWF genus absent: {genus}")
keystone=[{"genus":g,"scope":"Genus in Eastern Temperate Forests / Level I Ecoregion 8","caterpillarHost":g in caterpillar,"specialistBeeHost":g in bee} for g in sorted(set(caterpillar+bee))]

def source(title,url,path,scope): return {"title":title,"url":url,"scope":scope,"sha256":hashlib.sha256(path.read_bytes()).hexdigest()}
data["sources"].update({
 "flora":source("NPSNJ-hosted USDA NJ vascular-plant report (uploaded 2023)","https://npsnj.org/wp-content/uploads/2023/01/usda_nj_final2.xlsx",args.flora,"NJ occurrence report; N/I origin codes refer to broader USDA native-status jurisdictions, not a guarantee of NJ nativity"),
 "nativeProgram":source("NJDA Jersey Native Plants program · published native-species list","https://nj.gov/agriculture/divisions/md/pdf/Native%20Plant%20Regulations.pdf",args.native_program,"Listed taxon native to NJ for the published program; source listing does not establish site suitability or conservation safety"),
 "watch":source("NJISST 2025 Watch List","https://www.fohvos.info/wp-content/uploads/2025_Strike_Team_Watch_List_2025_03_14.pdf",args.watch,"Uncertain ecological concern, not an established invasive finding or regulatory ban"),
 "keystone":source("NWF Eastern Temperate Forests · Ecoregion 8 keystone genera","https://www.nwf.org/-/media/Documents/PDFs/Garden-for-Wildlife/Keystone-Plants/NWF-GFW-keystone-plant-list-ecoregion-8-eastern-temperate-forests.pdf",args.nwf,"Genus-level regional food-web evidence; not a species-specific wildlife count"),
 "nativeStatusDefinition":{"title":"USDA PLANTS Help · native-status jurisdiction definitions","url":"https://plants.usda.gov/assets/docs/PLANTS_Help_Document.pdf","scope":"N can be native anywhere in the reporting jurisdiction; NPSNJ workbook does not specify a state-native jurisdiction"}
})
data.update(version=args.checked_on+".2",checkedOn=args.checked_on,flora=flora,nativeProgram=native_program,watch=watch,keystoneGenera=keystone,nativeProgramRejectedRows=rejected)
target=root/"data/nj-evidence.v2.json"
target.write_text(json.dumps(data,ensure_ascii=False,indent=2)+"\n")
print(json.dumps({"flora":len(flora),"nativeProgram":len(native_program),"quarantinedPDFRows":len(rejected),"watch":len(watch),"keystoneGenera":len(keystone)}))
