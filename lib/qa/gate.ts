export type QaEnvironment = Record<string, string | undefined>;
const deploymentMarkers = [
  "VERCEL",
  "VERCEL_ENV",
  "NETLIFY",
  "AWS_LAMBDA_FUNCTION_NAME",
  "K_SERVICE",
  "RENDER",
  "RAILWAY_ENVIRONMENT",
  "DEPLOYMENT_ENV",
  "DEPLOYMENT_TARGET",
];
export function isLocalQaRequest(
  request: Request,
  environment: QaEnvironment = process.env,
): boolean {
  if (
    environment.NATIVEYARD_RUNTIME !== "local-qa" ||
    environment.NATIVEYARD_QA_AUTH !== "true"
  )
    return false;
  if (deploymentMarkers.some((key) => Boolean(environment[key]))) return false;
  if (
    environment.NATIVEYARD_DEPLOYMENT_TARGET &&
    environment.NATIVEYARD_DEPLOYMENT_TARGET !== "local"
  )
    return false;
  let url: URL;
  try {
    url = new URL(request.url);
  } catch {
    return false;
  }
  if (
    url.protocol !== "http:" ||
    !["localhost", "127.0.0.1"].includes(url.hostname) ||
    url.port !== "3100"
  )
    return false;
  if (request.headers.get("host") !== url.host) return false;
  const forwardedHost = request.headers.get("x-forwarded-host");
  if (forwardedHost && forwardedHost !== url.host) return false;
  const forwardedProto = request.headers.get("x-forwarded-proto");
  if (forwardedProto && forwardedProto !== "http") return false;
  const origin = request.headers.get("origin");
  if (origin && origin !== url.origin) return false;
  if (!["GET", "HEAD"].includes(request.method) && origin !== url.origin)
    return false;
  const site = request.headers.get("sec-fetch-site");
  if (site && !["same-origin", "none"].includes(site)) return false;
  return true;
}
