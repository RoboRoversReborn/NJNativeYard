"""Fetch/cache exact NC State Extension profiles and extract labelled facts.

Requires lxml. Source pages remain in the specified cache, not the repository.
No images, paragraphs, scripts, signed media URLs or unsupported care are copied.
Usage: python enrich-horticulture.py --profiles profiles.json --cache /tmp/cache
"""
import argparse
import concurrent.futures
import hashlib
import json
import re
import time
import unicodedata
import urllib.error
import urllib.request
from pathlib import Path
from lxml import html

parser=argparse.ArgumentParser()
parser.add_argument("--profiles",type=Path,required=True)
parser.add_argument("--cache",type=Path,required=True)
parser.add_argument("--checked-on",default="2026-11-04")
parser.add_argument("--offline",action="store_true")
parser.add_argument("--uconn-privet",type=Path,help="Optional cached UConn border privet profile for exact fallback")
parser.add_argument("--merge",action="store_true",help="Preserve other existing records while enriching a bounded new batch")
parser.add_argument("--revision",default="1",help="Snapshot revision suffix for this checked-on date")
args=parser.parse_args()
root=Path(__file__).resolve().parents[1]
args.cache.mkdir(parents=True,exist_ok=True)
profiles=json.loads(args.profiles.read_text())
target=root/"data/plant-horticulture.v1.json"
previous=json.loads(target.read_text()) if target.exists() else {"records":{},"unmatched":[]}
previous_errors={r["plantId"]:r for r in previous["unmatched"]}
sample_ids={p['plantId'] for s in json.loads((root/"data/reference-samples.v1.json").read_text()) for p in s['plants'] if p.get('plantId')}
profiles.sort(key=lambda p:(p['id'] not in sample_ids,p['scientificName']))
mapping={
 "Plant Type":"PlantType","Life Cycle":"LifeCycle","Growth Habit":"GrowthHabit","Habit/Form":"GrowthHabit","Growth Rate":"GrowthRate","Maintenance":"Maintenance",
 "Woody Plant Leaf Characteristics":"LeafCharacteristics","Leaf Type":"LeafType","Leaf Arrangement":"LeafArrangement","Leaf Shape":"LeafShape","Leaf Margin":"LeafMargin","Leaf Color":"LeafColor","Deciduous Leaf Fall Color":"LeafFallColor",
 "Flower Color":"FlowerColor","Flower Bloom Time":"FlowerBloomTime","Flower Shape":"FlowerShape","Flower Inflorescence":"FlowerInflorescence",
 "Fruit Type":"FruitType","Fruit Color":"FruitColor","Display/Harvest Time":"FruitDisplayTime",
 "Light":"Light","Soil Drainage":"SoilDrainage","Soil Texture":"SoilTexture","Soil pH":"SoilPH","USDA Plant Hardiness Zone":"HardinessZones",
 "Attracts":"Attracts","Resistance To Challenges":"Resistance","Landscape Location":"LandscapeLocation","Landscape Theme":"LandscapeTheme","Family":"Family","Country Or Region Of Origin":"Origin",
 "Appendage":"Appendage","Leaf Feel":"LeafFeel","Leaf Length":"LeafLength","Leaf Width":"LeafWidth","Hairs Present":"HairsPresent","Stem Color":"StemColor","Stem Cross Section":"StemCrossSection"
}
def clean(value):return " ".join(unicodedata.normalize("NFKC",str(value)).split())
def normalize(value):
    return " ".join(re.sub(r"\bspp?\.?\b|\bx\b|×", " ",clean(value).lower()).replace(".","").split())
def slug(name):return re.sub(r"[^a-z0-9]+","-",name.lower().replace("×","x").replace("spp.","")).strip("-")

def extract(page,expected,url):
    tree=html.fromstring(page)
    attrs={};all_fields={}
    for dt in tree.xpath("//dt"):
        label=clean(dt.text_content()).rstrip(":")
        values=[]
        for dd in dt.itersiblings():
            if dd.tag=="dt":break
            if dd.tag!="dd":continue
            for span in dd.xpath(".//span[contains(concat(' ',normalize-space(@class),' '),' detail_display_attribute ')]"):
                value=clean(span.text_content())
                if value and value not in values:values.append(value)
        if values:all_fields[label]=values
        key=mapping.get(label)
        if key and values:
            # These are categorical/factual attributes. Longer free-form prose
            # sometimes appears under Origin; omit rather than copy a paragraph.
            compact=[v for v in values if len(v.split())<=35 and len(v)<=300]
            if compact:attrs[key]=compact
        if label=="Dimensions":
            for value in values:
                for dimension in ("Height","Width"):
                    if value.startswith(dimension+":"):
                        attrs[dimension]=[value.split(":",1)[1].strip()]
    genus=all_fields.get("Genus",[""])[0]
    species=all_fields.get("Species",[""])[0]
    heading=clean(" ".join(tree.xpath("//h1/em//text()")))
    source_name=heading or clean(genus+" "+species)
    aliases=[]
    aliases.extend(clean(li.text_content()) for li in tree.xpath("//*[@id='synonyms']/li"))
    for label,values in all_fields.items():
        if "previously" in label.lower() or "synonym" in label.lower():aliases.extend(values)
    # Previous names can be plain links rather than attribute spans.
    for dt in tree.xpath("//dt[contains(translate(.,'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'),'previously')]"):
        for dd in dt.itersiblings():
            if dd.tag=="dt":break
            if dd.tag=="dd":aliases.extend(clean(x) for x in dd.xpath(".//a//text()"))
    accepted=[source_name,clean(genus+" "+species)]+aliases
    if normalize(expected) not in {normalize(n) for n in accepted}:
        raise ValueError(f"Taxon mismatch: requested {expected}; source {source_name}")
    if len(attrs)<6:raise ValueError("Too few labelled facts; source structure changed")
    return {"source":{"label":"NC State Extension Gardener Plant Toolbox","url":url,"checkedOn":args.checked_on,"sha256":hashlib.sha256(page).hexdigest(),"scope":"General horticultural attributes; source seasons and hardiness are not an NJ-specific bloom calendar or proof of NJ nativity"},"sourceTaxon":source_name,"requestedTaxon":expected,"taxonScope":"genus" if "spp" in expected.lower() else "species-or-hybrid","attributes":attrs}

def fetch(profile):
    name=profile['scientificName'];key=slug(name);url=f"https://plants.ces.ncsu.edu/plants/{key}/"
    if args.offline:
        url=previous["records"].get(profile['id'],{}).get("source",{}).get("url") or previous_errors.get(profile['id'],{}).get("url") or url
    cache=args.cache/(key+".html")
    try:
        if cache.exists():page=cache.read_bytes()
        elif args.offline:
            return profile['id'],None,previous_errors.get(profile['id']) or {"plantId":profile['id'],"scientificName":name,"url":url,"reason":"No cached source page"}
        else:
            time.sleep(.65)
            request=urllib.request.Request(url,headers={"User-Agent":"NativeYard factual profile reference importer"})
            with urllib.request.urlopen(request,timeout=25) as response:
                if response.status!=200:raise ValueError(f"HTTP {response.status}")
                final_url=response.url
                if not final_url.startswith("https://plants.ces.ncsu.edu/plants/"):raise ValueError("Unexpected redirect destination")
                url=final_url
                page=response.read()
            cache.write_bytes(page)
        return profile['id'],extract(page,name,url),None
    except urllib.error.HTTPError as error:
        if error.code==429:raise RuntimeError("Source rate limit; stop and retry later")
        return profile['id'],None,{"plantId":profile['id'],"scientificName":name,"url":url,"reason":f"HTTP {error.code}"}
    except (ValueError,urllib.error.URLError,TimeoutError) as error:
        return profile['id'],None,{"plantId":profile['id'],"scientificName":name,"url":url,"reason":str(error)[:180]}

records=dict(previous["records"]) if args.merge else {}
requested_ids={p['id'] for p in profiles}
missing=[r for r in previous["unmatched"] if r['plantId'] not in requested_ids] if args.merge else []
def write():
    temporary=target.with_suffix(".tmp")
    temporary.write_text(json.dumps({"version":args.checked_on+"."+args.revision,"checkedOn":args.checked_on,"sourceAccess":{"robotsUrl":"https://plants.ces.ncsu.edu/robots.txt","robotsStatus":404,"note":"No robots.txt published at check; public species pages returned 200. Modest request concurrency, cached extraction. No access controls bypassed."},"records":records,"unmatched":missing},ensure_ascii=False,indent=2)+"\n")
    temporary.replace(target)
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
    for index,(plant_id,record,error) in enumerate(executor.map(fetch,profiles),1):
        if record:records[plant_id]=record
        else:missing.append(error)
        if index%10==0 or index==len(profiles):
            write();print(json.dumps({"processed":index,"enriched":len(records),"unmatched":len(missing)}),flush=True)
write()

if args.uconn_privet:
    page=args.uconn_privet.read_bytes();tree=html.fromstring(page)
    source_name=clean(" ".join(tree.xpath("//h1[contains(@class,'latinName')]//text()")))
    if source_name!="Ligustrum obtusifolium":raise ValueError("UConn fallback is not the exact requested privet taxon")
    sections={}
    for paragraph in tree.xpath("//*[@id='description']/p"):
        label=clean(paragraph.text_content())
        listing=paragraph.getnext()
        if listing is not None and listing.tag.lower()=="ul":sections[label]=[clean(li.text_content()) for li in listing.xpath("./li")]
    # Corroborate the short factual transcription against the cached source,
    # including morphology and culture. No propagation/removal advice imported.
    full=clean(tree.text_content())
    required=["10' to 12' tall","opposite leaf arrangement","simple, elliptical leaves","entire leaf margins","full sun to partial shade"]
    if not all(value in full for value in required):raise ValueError("UConn source facts changed; review fallback")
    plant_id=next(p['id'] for p in profiles if p['scientificName']==source_name)
    records[plant_id]={"source":{"label":"University of Connecticut Plant Database","url":"https://plantdatabase.uconn.edu/detail.php?pid=254","checkedOn":args.checked_on,"sha256":hashlib.sha256(page).hexdigest(),"scope":"General horticultural facts; source flowering/fruit timing is Connecticut-oriented, not a verified NJ calendar"},"sourceTaxon":source_name,"requestedTaxon":source_name,"taxonScope":"species-or-hybrid","attributes":{
      "PlantType":["Shrub"],"Height":["10 ft. 0 in. - 12 ft. 0 in."],"Width":["Equal to or greater than its height"],"GrowthHabit":["Multistemmed","Broad horizontal branching"],"GrowthRate":["Medium"],"LeafCharacteristics":["Semi-evergreen"],"LeafArrangement":["Opposite"],"LeafType":["Simple"],"LeafShape":["Elliptical"],"LeafMargin":["Entire"],"LeafColor":["Deep green"],"LeafFallColor":["Reddish-purple"],"LeafLength":["1 to 2 inches"],"FlowerColor":["White"],"FlowerInflorescence":["Narrow panicles"],"FlowerBloomTime":["June (Connecticut source)"],"FruitType":["Drupe"],"FruitColor":["Black"],"FruitDisplayTime":["Ripens in September and persists (Connecticut source)"],"Light":["Full sun to partial shade"],"Origin":["Japan"],"HardinessZones":["Hardy to zone 4 (source lower limit)"]}}
    missing=[r for r in missing if r['plantId']!=plant_id]
    write();print(json.dumps({"fallback":"UConn exact border privet","enriched":len(records),"unmatched":len(missing)}),flush=True)
