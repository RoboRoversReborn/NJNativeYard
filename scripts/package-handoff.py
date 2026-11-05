#!/usr/bin/env python3
"""Portable source ZIP, explicit allowlist, credential checks and extracted hash verification.
Default is staging only. Final creation requires --final and a frozen release receipt.
No live files, dependencies, credentials, user records or caches are copied or deleted.
"""
import argparse, gzip, hashlib, json, re, stat, tempfile, zipfile
from urllib.parse import urlparse
from pathlib import Path, PurePosixPath
ROOT=Path(__file__).resolve().parent.parent
TREES=('app','components','data','lib','public','scripts','supabase','tests')
ROOT_FILES=('package.json','package-lock.json','next.config.ts','tsconfig.json','eslint.config.mjs','postcss.config.mjs','proxy.ts','SETUP-EMAIL.txt','START-HERE.md','README.md','AGENTS.md','.gitignore','.gitattributes','.env.example')
DOCS=('NJ-CATALOG.md','ECOSYSTEM-ASSESSMENT.md','DESIGN-REVIEW.md','LOCAL-PREVIEW.md','ORIGINAL_README.md','PRODUCTION-HANDOFF.md','COPILOT-SETUP-PROMPT.md')
AUDITS=('optimized-audit.v1.json','coverage.v1.json','README.md','recovery-validation.v1.json')
EVIDENCE_EXCEPTIONS=(
    'research/sample-refresh/review-decisions.v3.json',
    'research/sample-refresh/native-canopy-source-permission.v1.json',
    'research/sample-refresh/planned-reference-samples.v4.audit.json',
    'research/plant-images/followup-r8/terminal-audit.v1.json',
    'research/plant-images/followup-r8/holds.v1.json',
    'research/plant-images/followup-r8/overlay-verification.v1.json',
    'research/nj-inventory/README.md',
    'research/nj-inventory/coverage.json',
    'research/nj-inventory/pending-followup-20261105.json',
)
BLOCK_PARTS={'node_modules','.git','.local','__pycache__','cache','raw','uploads','upload','private','user-data','userdata','sessions','screenshots','test-results','playwright-report','handoff'}
BLOCK_FILES={'data/reference-samples.v2.json'}
TEXT={'.ts','.tsx','.js','.jsx','.mjs','.mts','.json','.md','.txt','.py','.sql','.example','.css','.html','.svg','.yml','.yaml'}
SECRET=re.compile(rb'(?:sbp_[A-Za-z0-9]{25,}|GOCSPX-[A-Za-z0-9_-]{15,}|AQ\.Ab[A-Za-z0-9_-]{20,}|AIza[A-Za-z0-9_-]{25,}|sb_(?:secret|publishable)_[A-Za-z0-9_-]{15,}|eyJ[A-Za-z0-9_-]{12,}\.eyJ[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{16,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----)')
EXCLUDED=['node_modules and installed/native dependencies','Next/build outputs and caches','.git and editor/machine state','.env values, credentials, management/service keys','.local QA accounts/passwords/session state','private uploads, user data and browser test artifacts','raw research caches and contact sheets','sender-specific Google configuration instructions','generated next-env.d.ts (Next regenerates it)']

def sha(data):return hashlib.sha256(data).hexdigest()
def encoded(value):return str(value).strip().strip('\"\'').encode()
def host_private_values():
    values=[]
    file=ROOT/'.env.local'
    if file.exists():
        for line in file.read_text().splitlines():
            if '=' not in line or line.lstrip().startswith('#'):continue
            key,value=line.split('=',1)
            if re.search(r'(?:API_KEY|ANON_KEY|ACCESS_TOKEN|CLIENT_SECRET|SERVICE_ROLE_KEY|PASSWORD)$',key) or key=='NEXT_PUBLIC_SUPABASE_URL':
                data=encoded(value)
                if len(data)>=12:values.append(data)
                if key=='NEXT_PUBLIC_SUPABASE_URL':
                    host=urlparse(data.decode()).hostname
                    if host:values.extend([host.encode(),host.split('.')[0].encode()])
    file=ROOT/'.local/qa-accounts.json'
    if file.exists():
        config=json.loads(file.read_text())
        for account in config.get('accounts',{}).values():
            values.extend(encoded(account.get(key,'')) for key in ('id','email','password') if len(str(account.get(key,'')))>=12)
        if config.get('marker'):values.append(encoded(config['marker']))
    return values

def allowed(path):
    rel=path.relative_to(ROOT)
    return rel.as_posix() not in BLOCK_FILES and path.is_file() and not path.is_symlink() and not any(part in BLOCK_PARTS or part.startswith('.next') for part in rel.parts) and path.name!='.DS_Store' and not (path.name.startswith('.env') and path.name!='.env.example') and not re.search(r' \d+\.(?:tsx?|mts|json)$',path.name)
def collect():
    files=[]
    for tree in TREES:files.extend(path for path in (ROOT/tree).rglob('*') if allowed(path))
    for name in ROOT_FILES:
        path=ROOT/name
        if path.is_file():files.append(path)
    for name in DOCS:
        path=ROOT/'docs'/name
        if path.is_file():files.append(path)
    # Raw local receipts contain machine paths and historical checks, not recipient setup.
    # The selected normalized release receipt is injected explicitly below.
    for name in AUDITS:
        path=ROOT/'research/plant-images'/name
        if path.is_file():files.append(path)
    for name in EVIDENCE_EXCEPTIONS:
        path=ROOT/name
        if allowed(path):files.append(path)
    return sorted(set(files))

def scan(data,name,private):
    if SECRET.search(data) or any(value in data for value in private):raise RuntimeError('Credential/private-value scan failed in '+name+'; no value printed')
def payloads():
    private=host_private_values();result={}
    folded=set()
    for path in collect():
        name=path.relative_to(ROOT).as_posix()
        if name.casefold() in folded:raise RuntimeError('Case-insensitive filename collision: '+name)
        folded.add(name.casefold())
        if any(part in ('..','') for part in PurePosixPath(name).parts) or '\\' in name:raise RuntimeError('Nonportable path: '+name)
        data=path.read_bytes()
        if path.suffix in TEXT or path.name in ('.env.example','.gitignore','AGENTS.md'):scan(data,name,private)
        if path.suffix=='.gz':scan(gzip.decompress(data),name,private)
        result[name]=data
    template=result['.env.example'].decode()
    if any(line.strip() and not line.lstrip().startswith('#') and not re.fullmatch(r'[A-Z][A-Z0-9_]*=',line.strip()) for line in template.splitlines()):raise RuntimeError('.env.example must contain names only, with empty values')
    return result,private

def manifest_for(files,release):
    return {'format':1,'archiveRoot':'nativeyard','release':release,'exclusions':EXCLUDED,'files':[{'path':name,'bytes':len(data),'sha256':sha(data)} for name,data in sorted(files.items())]}
def verify_dir(directory):
    manifest=json.loads((directory/'SOURCE-MANIFEST.json').read_text())
    expected={row['path']:row for row in manifest['files']}
    for name,row in expected.items():
        p=PurePosixPath(name)
        if p.is_absolute() or '..' in p.parts or '\\' in name:raise RuntimeError('Unsafe manifest path')
        path=directory/name
        if not path.is_file() or path.is_symlink():raise RuntimeError('Missing/unsafe extracted file: '+name)
        data=path.read_bytes()
        if len(data)!=row['bytes'] or sha(data)!=row['sha256']:raise RuntimeError('Extracted hash mismatch: '+name)
    return {'verifiedFiles':len(expected),'release':manifest['release']}
def verify_zip(archive):
    with zipfile.ZipFile(archive) as z:
        names=z.namelist()
        if len(names)!=len(set(names)):raise RuntimeError('Duplicate ZIP entries')
        for item in z.infolist():
            p=PurePosixPath(item.filename)
            if p.is_absolute() or '..' in p.parts or not p.parts or p.parts[0]!='nativeyard' or '\\' in item.filename or stat.S_ISLNK(item.external_attr>>16):raise RuntimeError('Unsafe ZIP entry')
        m=json.loads(z.read('nativeyard/SOURCE-MANIFEST.json'))
        expected={'nativeyard/'+row['path'] for row in m['files']}|{'nativeyard/SOURCE-MANIFEST.json'}
        if set(names)!=expected:raise RuntimeError('Unexpected or missing ZIP entries')
        with tempfile.TemporaryDirectory(prefix='nativeyard-zip-verify-') as temp:
            z.extractall(temp)
            return verify_dir(Path(temp)/'nativeyard')
def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--final',action='store_true');parser.add_argument('--release-id');parser.add_argument('--release-receipt',type=Path)
    parser.add_argument('--output',type=Path,default=ROOT/'handoff');parser.add_argument('--verify',type=Path);parser.add_argument('--verify-dir',type=Path)
    args=parser.parse_args()
    if args.verify:print(json.dumps(verify_zip(args.verify),indent=2));return
    if args.verify_dir:print(json.dumps(verify_dir(args.verify_dir),indent=2));return
    files,private=payloads()
    release={'status':'STAGING ONLY; no archive created'}
    if args.final:
        if not args.release_id or not re.fullmatch(r'[A-Za-z0-9._-]+',args.release_id) or not args.release_receipt:parser.error('--final requires a safe --release-id and frozen --release-receipt')
        raw=json.loads(args.release_receipt.read_text())
        if not raw.get('buildId'):raise RuntimeError('Release receipt must identify the compiled build')
        release={'releaseId':args.release_id,**{key:raw[key] for key in ('buildId','releaseDate','sourceRelease','node','dependencies','validation','features','migrations','tests','typecheck','build','lint','qaStatus','deployment','plantPhotoTaxa','plantPhotoFiles','plantPhotoRenditions','catalogTaxa','runtimeSourceFilesVerified','runtimeSourceDigest','activeSampleVersion','sampleVersion','sampleIndices','sampleScores','sampleRegions','sampleRegionCounts','samples','sampleRefreshStatus','qaRemaining','qaChecks','qaGeometry','qaErrors','qaEvidence') if key in raw}}
        receipt_data=(json.dumps(release,indent=2)+'\n').encode();scan(receipt_data,'RELEASE-RECEIPT.json',private);files['RELEASE-RECEIPT.json']=receipt_data
        # Keep the current validation link usable without shipping machine paths
        # or raw historical release receipts.
        files['docs/evidence/'+args.release_receipt.name]=receipt_data
        files['docs/VALIDATION.md']=('''# Release validation\n\nR22 source handoff, November 5, 2026. See RELEASE-RECEIPT.json for build identity and scope.\n\nThe production build and minimal localhost HTTP/build identity check passed before packaging. Full R22 acceptance testing and further browser QA were deferred at the owner\'s request. Authenticated automatic plan generation/checkoff has not been live verified. Earlier revision results are not combined R22 acceptance.\n\nPackaging checks cover credential exclusions, required source files, manifest hashes and extraction integrity only. No dependency install, application suite, rebuild or browser testing was performed during packaging.\n''').encode()
    manifest=manifest_for(files,release);serialized=(json.dumps(manifest,indent=2)+'\n').encode();identity=sha(serialized)
    output=args.output.resolve();output.mkdir(parents=True,exist_ok=True)
    if not args.final:
        stage=output/'staging';stage.mkdir(exist_ok=True)
        (stage/'SOURCE-MANIFEST.json').write_bytes(serialized)
        report={'status':'staged; no final ZIP created','files':len(files),'uncompressedBytes':sum(map(len,files.values())),'sourceManifestSha256':identity,'credentialScan':'pass','excluded':EXCLUDED}
        (stage/'package-plan.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report,indent=2));return
    archive=output/f'nativeyard-source-{args.release_id}-{identity[:12]}.zip'
    if archive.exists():raise RuntimeError('Refusing to overwrite an existing release archive')
    with zipfile.ZipFile(archive,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=6) as z:
        for name,data in sorted({**files,'SOURCE-MANIFEST.json':serialized}.items()):
            info=zipfile.ZipInfo('nativeyard/'+name,date_time=(2026,1,1,0,0,0));info.external_attr=(stat.S_IFREG|0o644)<<16
            info.compress_type=zipfile.ZIP_STORED if Path(name).suffix.lower() in ('.webp','.png','.jpg','.jpeg','.gz','.ico') else zipfile.ZIP_DEFLATED
            z.writestr(info,data,compresslevel=6)
    verification=verify_zip(archive)
    archive_hash=sha(archive.read_bytes())
    (output/(archive.name+'.sha256')).write_text(archive_hash+'  '+archive.name+'\n')
    (output/'SOURCE-MANIFEST.json').write_bytes(serialized)
    report={'archive':archive.name,'archiveSha256':archive_hash,'sourceManifestSha256':identity,'files':len(files),'bytes':archive.stat().st_size,'credentialScan':'pass','extractionVerification':verification,'excluded':EXCLUDED}
    (output/'package-receipt.json').write_text(json.dumps(report,indent=2)+'\n');(output/f'package-receipt-{args.release_id}.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report,indent=2))
if __name__=='__main__':main()
