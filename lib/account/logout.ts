export function authCookieNames(
  cookieHeader: string,
  supabaseUrl: string,
): string[] {
  let ref: string;
  try {
    ref = new URL(supabaseUrl).hostname.split(".")[0];
  } catch {
    return [];
  }
  if (!/^[a-z0-9-]+$/i.test(ref)) return [];
  const prefix = `sb-${ref}-auth-token`;
  return cookieHeader
    .split(";")
    .map((part) => part.trim().split("=")[0])
    .filter(
      (name) =>
        name === prefix ||
        (name.startsWith(prefix + ".") &&
          /^\d+$/.test(name.slice(prefix.length + 1))) ||
        name === prefix + "-code-verifier",
    );
}
export async function boundedLogout(
  request: (signal: AbortSignal) => Promise<{ remoteRevoked: boolean }>,
  clearLocal: () => void,
  milliseconds = 10000,
): Promise<{ remoteRevoked: boolean; reloadRequired: true }> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const result = await Promise.race([
      request(controller.signal),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          reject(new Error("Sign-out deadline"));
        }, milliseconds);
      }),
    ]);
    return {
      remoteRevoked: result.remoteRevoked === true,
      reloadRequired: true,
    };
  } catch {
    return { remoteRevoked: false, reloadRequired: true };
  } finally {
    if (timer) clearTimeout(timer);
    controller.abort();
    clearLocal();
  }
}
