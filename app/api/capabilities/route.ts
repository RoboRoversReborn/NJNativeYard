import { isLocalQaRequest } from "../../../lib/qa/gate";
import { localQaConfigured } from "../../../lib/qa/config";
export async function GET(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
    key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  let accounts = false;
  let google = false;
  let email = false;
  if (url && key) {
    try {
      const response = await fetch(
        `${url.replace(/\/$/, "")}/auth/v1/settings`,
        {
          headers: { apikey: key },
          signal: AbortSignal.timeout(5000),
          next: { revalidate: 60 },
        },
      );
      if (response.ok) {
        const settings = await response.json();
        google = Boolean(settings.external?.google);
        email =
          process.env.ENABLE_PUBLIC_EMAIL_AUTH === "true" &&
          settings.external?.email === true &&
          settings.mailer_autoconfirm === false;
        accounts = google || email;
      }
    } catch {
      /* Account setup unavailable; guest scanning remains independent. */
    }
  }
  const qa = isLocalQaRequest(request) && (await localQaConfigured());
  return Response.json({
    qa,
    vision: Boolean(process.env.GEMINI_API_KEY || process.env.PLANTNET_API_KEY),
    accounts,
    google,
    email,
    emailDeliveryRestricted: process.env.EMAIL_DELIVERY_MODE !== "configured",
  });
}
