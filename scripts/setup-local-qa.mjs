/** Dedicated local QA tenants only. Never outputs credentials, tokens or provider errors. */
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";
const file = path.join(process.cwd(), ".local", "qa-accounts.json");
const cleanup = process.argv.includes("--cleanup");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
if (!url) throw new Error("Configured Supabase project is required.");
const parsedURL = new URL(url),
  projectRef = parsedURL.hostname.split(".")[0];
if (
  parsedURL.protocol !== "https:" ||
  parsedURL.hostname !== `${projectRef}.supabase.co` ||
  parsedURL.username ||
  parsedURL.password
)
  throw new Error(
    "QA setup requires the configured HTTPS Supabase project origin.",
  );
let config;
try {
  config = JSON.parse(await fs.readFile(file, "utf8"));
} catch (error) {
  if (error.code !== "ENOENT")
    throw new Error("Private QA configuration could not be read.");
}
if (
  config &&
  (config.version !== 1 ||
    config.projectRef !== projectRef ||
    !/^[a-f0-9-]{36}$/i.test(config.marker || "") ||
    !config.accounts)
)
  throw new Error("Private QA configuration does not match this project.");
if (cleanup && !config) {
  console.log("No marker-owned local QA accounts to clean up.");
  process.exit(0);
}
config ??= {
  version: 1,
  projectRef,
  marker: crypto.randomUUID(),
  accounts: {},
};
let serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!serviceKey) {
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  if (!token)
    throw new Error("A host-held Supabase management token is required.");
  let response;
  try {
    response = await fetch(
      `https://api.supabase.com/v1/projects/${projectRef}/api-keys`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
  } catch {
    throw new Error("Management API unavailable; no accounts changed.");
  }
  if (!response.ok)
    throw new Error("Management API did not grant QA setup access.");
  const keys = await response.json();
  serviceKey = keys.find((key) => key.name === "service_role")?.api_key;
  if (!serviceKey)
    throw new Error("No service-role key available for authorized QA setup.");
}
const admin = createClient(url, serviceKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
});
async function save() {
  await fs.mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
  await fs.chmod(path.dirname(file), 0o700);
  const temp = file + ".tmp";
  await fs.writeFile(temp, JSON.stringify(config, null, 2) + "\n", {
    mode: 0o600,
  });
  await fs.chmod(temp, 0o600);
  await fs.rename(temp, file);
}
function owned(user, name) {
  return (
    user &&
    user.id === config.accounts[name]?.id &&
    user.email ===
      `qa-${name.toLowerCase()}-${config.marker}@qa.nativeyard.invalid` &&
    user.app_metadata?.nativeyard_qa === true &&
    user.app_metadata?.nativeyard_qa_marker === config.marker &&
    user.app_metadata?.nativeyard_qa_account === name
  );
}
async function removeStorage(userId, prefix = userId) {
  const { data, error } = await admin.storage
    .from("nativeyard-surveys")
    .list(prefix, { limit: 1000 });
  if (error)
    throw new Error("QA storage cleanup unavailable; account retained.");
  for (const item of data || []) {
    if (
      item.name === "." ||
      item.name === ".." ||
      item.name.includes("/") ||
      item.name.includes("\\")
    )
      throw new Error("QA storage path validation failed; stopped.");
    const name = `${prefix}/${item.name}`;
    if (!name.startsWith(`${userId}/`))
      throw new Error("QA storage scope mismatch; stopped.");
    if (item.id) {
      const result = await admin.storage
        .from("nativeyard-surveys")
        .remove([name]);
      if (result.error)
        throw new Error("QA storage cleanup failed; account retained.");
    } else await removeStorage(userId, name);
  }
  if ((data || []).length === 1000) await removeStorage(userId, prefix);
}
try {
  for (const name of ["A", "B"]) {
    const existing = config.accounts[name];
    if (existing) {
      const { data, error } = await admin.auth.admin.getUserById(existing.id);
      if (error || !owned(data.user, name))
        throw new Error(
          "Stored QA account ownership could not be verified; no account mutation performed.",
        );
      if (cleanup) {
        await removeStorage(existing.id);
        const result = await admin.auth.admin.deleteUser(existing.id);
        if (result.error) throw new Error("QA account cleanup failed.");
        delete config.accounts[name];
        await save();
      }
      continue;
    }
    if (cleanup) continue;
    const email = `qa-${name.toLowerCase()}-${config.marker}@qa.nativeyard.invalid`,
      password = crypto.randomBytes(36).toString("base64url");
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      app_metadata: {
        nativeyard_qa: true,
        nativeyard_qa_marker: config.marker,
        nativeyard_qa_account: name,
      },
      user_metadata: { full_name: `Local QA account ${name}` },
    });
    if (error || !data.user)
      throw new Error(
        "Dedicated QA account creation failed; no credentials printed.",
      );
    config.accounts[name] = { id: data.user.id, email, password };
    await save();
  }
  if (cleanup) {
    await fs.rm(file);
    console.log(
      "Removed only verified marker-owned QA users and their private survey storage.",
    );
  } else {
    await save();
    console.log(
      "Two dedicated local QA tenants are ready. Private credentials stored with mode0600; no credentials printed.",
    );
  }
} finally {
  await admin.auth.dispose();
}
