// Verify an extracted source handoff with Node only; no dependencies or secrets needed.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
const directory = path.resolve(process.argv[2] || process.cwd());
const manifest = JSON.parse(
  fs.readFileSync(path.join(directory, "SOURCE-MANIFEST.json"), "utf8"),
);
for (const entry of manifest.files) {
  const filename = path.resolve(directory, entry.path);
  if (
    !filename.startsWith(directory + path.sep) ||
    fs.lstatSync(filename).isSymbolicLink()
  )
    throw new Error("Unsafe source-manifest path");
  const data = fs.readFileSync(filename),
    hash = crypto.createHash("sha256").update(data).digest("hex");
  if (data.length !== entry.bytes || hash !== entry.sha256)
    throw new Error("Source verification failed: " + entry.path);
}
console.log(
  JSON.stringify({
    verifiedFiles: manifest.files.length,
    release: manifest.release,
  }),
);
