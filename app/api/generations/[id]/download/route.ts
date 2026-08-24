import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  const user = authData.user;

  if (authError || !user) {
    return new Response("Reconnecte-toi pour télécharger cette image.", { status: 401 });
  }

  const { id } = await context.params;
  const admin = createAdminClient();
  const { data: generation, error: generationError } = await admin
    .from("generations")
    .select("result_path")
    .eq("id", id)
    .eq("user_id", user.id)
    .eq("status", "completed")
    .maybeSingle();

  if (generationError || !generation?.result_path) {
    return new Response("Image introuvable.", { status: 404 });
  }

  const { data: file, error: downloadError } = await admin.storage
    .from("generations")
    .download(generation.result_path);

  if (downloadError || !file) {
    return new Response("Le téléchargement a échoué.", { status: 500 });
  }

  return new Response(file, {
    headers: {
      "Content-Type": file.type || "image/webp",
      "Content-Disposition": `attachment; filename="reallioo-${id}.webp"`,
      "Cache-Control": "private, max-age=3600",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
