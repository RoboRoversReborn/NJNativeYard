import fs from "node:fs/promises";
import path from "node:path";
export type QaAccountName = "A" | "B";
export type QaAccount = { id: string; email: string; password: string };
export type LocalQaConfig = {
  version: 1;
  projectRef: string;
  marker: string;
  accounts: Record<QaAccountName, QaAccount>;
};
const uuid =
  /^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
export function validQaConfig(
  value: unknown,
  projectRef: string,
): value is LocalQaConfig {
  if (!value || typeof value !== "object") return false;
  const config = value as LocalQaConfig;
  if (
    config.version !== 1 ||
    config.projectRef !== projectRef ||
    !uuid.test(config.marker || "") ||
    !config.accounts
  )
    return false;
  for (const name of ["A", "B"] as const) {
    const account = config.accounts[name];
    if (
      !account ||
      !uuid.test(account.id) ||
      account.email !==
        `qa-${name.toLowerCase()}-${config.marker}@qa.nativeyard.invalid` ||
      typeof account.password !== "string" ||
      account.password.length < 32
    )
      return false;
  }
  return config.accounts.A.id !== config.accounts.B.id;
}
export async function loadQaConfig(): Promise<LocalQaConfig> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) throw new Error("QA unavailable");
  const projectRef = new URL(url).hostname.split(".")[0];
  const filename = path.join(process.cwd(), ".local", "qa-accounts.json");
  const stat = await fs.lstat(filename);
  if (
    !stat.isFile() ||
    stat.isSymbolicLink() ||
    (stat.mode & 0o077) !== 0 ||
    (process.getuid && stat.uid !== process.getuid())
  )
    throw new Error("QA unavailable");
  const config: unknown = JSON.parse(await fs.readFile(filename, "utf8"));
  if (!validQaConfig(config, projectRef)) throw new Error("QA unavailable");
  return config;
}
export async function localQaConfigured(): Promise<boolean> {
  try {
    await loadQaConfig();
    return true;
  } catch {
    return false;
  }
}
