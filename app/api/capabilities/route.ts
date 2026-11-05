import { isLocalQaRequest } from "../../../lib/qa/gate";
import { localQaConfigured } from "../../../lib/qa/config";
import { isFirebaseConfigured } from "../../../lib/firebase/client";

export async function GET(request: Request) {
  const configured = isFirebaseConfigured();
  const accounts = configured;
  const google = configured;
  const email = false;
  const qa = isLocalQaRequest(request) && (await localQaConfigured());

  return Response.json({
    qa,
    vision: Boolean(process.env.GEMINI_API_KEY || process.env.PLANTNET_API_KEY),
    accounts,
    google,
    email,
    emailDeliveryRestricted: true,
  });
}
