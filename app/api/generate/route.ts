import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const maxDuration = 300;

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_FILE_SIZE = 2_200_000;
const MAX_PROMPT_LENGTH = 1_500;

function extensionFor(type: string) {
  if (type === "image/png") return "png";
  if (type === "image/webp") return "webp";
  return "jpg";
}

function isImageFile(value: FormDataEntryValue | null): value is File {
  return value instanceof File && value.size > 0 && ALLOWED_TYPES.has(value.type);
}

function generationPrompt(userPrompt: string, hasReference: boolean) {
  return `Edit the first image, which is the source scene. ${
    hasReference
      ? "The second image is a visual reference only: use it to reproduce the requested person, vehicle, clothing, object, colors or design accurately, without copying its background."
      : "There is no separate reference image."
  }

User request: ${userPrompt}

Production requirements:
- Create one highly photorealistic image in native iPhone/TikTok vertical 9:16 composition.
- Preserve the source image's real adult identities, facial features, body proportions, camera position, framing, perspective, background, lighting, reflections and shadows unless the request explicitly asks to change one of them.
- Change only what the user requested. Blend the edit naturally into the original scene with physically coherent scale, depth, contact shadows, reflections, texture and color grading.
- If a reference image is supplied, match only the requested reference subject and keep the source scene dominant.
- Keep realistic skin texture and natural photographic imperfections. Avoid plastic skin, distorted hands, duplicated objects, warped architecture and impossible geometry.
- Do not add text, logos, watermarks, borders, UI, captions or a collage.
- The result must look like a genuine iPhone photo, not an illustration or an obvious AI render.`;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  const user = authData.user;

  if (authError || !user) {
    return NextResponse.json({ error: "Reconnecte-toi pour créer une image." }, { status: 401 });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Le moteur IA n’est pas encore configuré." }, { status: 503 });
  }

  const form = await request.formData();
  const source = form.get("source");
  const reference = form.get("reference");
  const prompt = String(form.get("prompt") || "").trim();

  if (!isImageFile(source)) {
    return NextResponse.json({ error: "Ajoute une photo JPG, PNG ou WEBP." }, { status: 400 });
  }
  if (source.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "La photo principale est encore trop lourde." }, { status: 413 });
  }
  if (reference instanceof File && reference.size > 0 && !isImageFile(reference)) {
    return NextResponse.json({ error: "L’image de référence doit être en JPG, PNG ou WEBP." }, { status: 400 });
  }
  if (reference instanceof File && reference.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "L’image de référence est encore trop lourde." }, { status: 413 });
  }
  if (prompt.length < 6 || prompt.length > MAX_PROMPT_LENGTH) {
    return NextResponse.json({ error: "Décris précisément la modification souhaitée." }, { status: 400 });
  }

  const admin = createAdminClient();
  const generationId = crypto.randomUUID();
  const folder = `${user.id}/${generationId}`;
  const sourcePath = `${folder}/source.${extensionFor(source.type)}`;
  const referenceFile = isImageFile(reference) ? reference : null;
  const referencePath = referenceFile ? `${folder}/reference.${extensionFor(referenceFile.type)}` : null;
  let creditConsumed = false;
  let newCredits: number | null = null;

  try {
    const { data: creditData, error: creditError } = await admin.rpc("consume_generation_credit", {
      p_user_id: user.id,
    });

    if (creditError) {
      if (creditError.message.includes("insufficient_credits")) {
        return NextResponse.json({ error: "Tu n’as plus de crédits.", code: "NO_CREDITS" }, { status: 402 });
      }
      throw creditError;
    }

    creditConsumed = Number(creditData) !== -1;
    newCredits = Number(creditData) === -1 ? null : Number(creditData);

    const sourceBytes = Buffer.from(await source.arrayBuffer());
    const { error: sourceUploadError } = await admin.storage
      .from("generations")
      .upload(sourcePath, sourceBytes, { contentType: source.type, upsert: false });
    if (sourceUploadError) throw sourceUploadError;

    if (referenceFile && referencePath) {
      const referenceBytes = Buffer.from(await referenceFile.arrayBuffer());
      const { error: referenceUploadError } = await admin.storage
        .from("generations")
        .upload(referencePath, referenceBytes, { contentType: referenceFile.type, upsert: false });
      if (referenceUploadError) throw referenceUploadError;
    }

    const { error: insertError } = await admin.from("generations").insert({
      id: generationId,
      user_id: user.id,
      source_path: sourcePath,
      reference_path: referencePath,
      prompt,
      status: "processing",
    });
    if (insertError) throw insertError;

    const openAIForm = new FormData();
    openAIForm.append("model", "gpt-image-2");
    openAIForm.append("image[]", source, `source.${extensionFor(source.type)}`);
    if (referenceFile) {
      openAIForm.append("image[]", referenceFile, `reference.${extensionFor(referenceFile.type)}`);
    }
    openAIForm.append("prompt", generationPrompt(prompt, Boolean(referenceFile)));
    openAIForm.append("size", "1152x2048");
    openAIForm.append("quality", "medium");
    openAIForm.append("output_format", "webp");
    openAIForm.append("output_compression", "95");
    openAIForm.append("n", "1");

    const openAIResponse = await fetch("https://api.openai.com/v1/images/edits", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: openAIForm,
      signal: AbortSignal.timeout(280_000),
    });

    const openAIResult = await openAIResponse.json();
    if (!openAIResponse.ok) {
      console.error("OpenAI image error", openAIResponse.status, openAIResult?.error?.message);
      throw new Error("image_generation_failed");
    }

    const base64 = openAIResult?.data?.[0]?.b64_json;
    if (!base64) throw new Error("missing_generated_image");

    const resultPath = `${folder}/result.webp`;
    const resultBytes = Buffer.from(base64, "base64");
    const { error: resultUploadError } = await admin.storage
      .from("generations")
      .upload(resultPath, resultBytes, { contentType: "image/webp", upsert: false });
    if (resultUploadError) throw resultUploadError;

    const { error: updateError } = await admin
      .from("generations")
      .update({ status: "completed", result_path: resultPath, error_message: null })
      .eq("id", generationId)
      .eq("user_id", user.id);
    if (updateError) throw updateError;

    const { data: signedData, error: signedError } = await admin.storage
      .from("generations")
      .createSignedUrl(resultPath, 3600);
    if (signedError) throw signedError;

    return NextResponse.json({
      generation: {
        id: generationId,
        resultUrl: signedData.signedUrl,
        prompt,
        createdAt: new Date().toISOString(),
      },
      creditsRemaining: newCredits,
    });
  } catch (error) {
    console.error("Generation failed", error);
    await admin
      .from("generations")
      .update({ status: "failed", error_message: "generation_failed" })
      .eq("id", generationId)
      .eq("user_id", user.id);

    if (creditConsumed) {
      await admin.rpc("refund_generation_credit", { p_user_id: user.id });
    }

    return NextResponse.json(
      { error: "La génération n’a pas abouti. Ton crédit a été rendu, réessaie." },
      { status: 500 },
    );
  }
}
