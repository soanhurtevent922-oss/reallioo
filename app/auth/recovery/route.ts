import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function appUrl(request: Request, path: string) {
  const requestUrl = new URL(request.url);
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto") || "https";
  const origin = forwardedHost ? `${forwardedProto}://${forwardedHost}` : requestUrl.origin;

  return new URL(path, origin);
}

export async function GET(request: Request) {
  const code = new URL(request.url).searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return NextResponse.redirect(appUrl(request, "/reset-password"));
    }
  }

  return NextResponse.redirect(appUrl(request, "/forgot-password?error=invalid"));
}
