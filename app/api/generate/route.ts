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
  return `ROLE
You are performing a precise photorealistic edit, not creating a new scene.

INPUTS
- Image 1 is the authoritative source photograph. Its person, anatomy, pose, camera, framing and environment must remain unchanged.
${
    hasReference
      ? "- Image 2 is the reference subject. Reproduce only the requested object/person/vehicle/clothing from it. Never copy Image 2's background, framing, lighting or studio presentation."
      : "- No separate reference image is supplied."
  }

USER EDIT
${userPrompt}

NON-NEGOTIABLE PRESERVATION
- Change only the requested element. Keep every unrelated pixel and visual property as close to Image 1 as possible.
- Preserve the person's exact identity, skin tone, hand and finger count, wrist thickness, joints, body proportions, pose and silhouette. Never enlarge, bend, rebuild or deform anatomy to make the inserted object fit; resize and orient the object instead.
- Preserve the exact camera position, crop, 9:16 framing, perspective, lens look, background, architecture, lighting direction, exposure, white balance, shadows and reflections of Image 1.

PHYSICAL COMPOSITING
- Determine the real 3D placement surface before inserting the requested subject. Match its scale, rotation, perspective, depth, focal sharpness, grain, color temperature and lens distortion to Image 1.
- The inserted subject must have believable contact, occlusion and cast/contact shadows. It must never float, intersect the body, melt into skin, duplicate, stretch, bend unnaturally or appear pasted on.
- If the inserted subject is worn on the body (watch, bracelet, ring, necklace, glasses, clothing or shoes), fit it to the existing anatomy without altering that anatomy. Parts on the near side stay visible; parts continuing around the far side pass naturally behind the body.
- For a watch or bracelet specifically: place the case centered on the natural top plane of the wrist; keep a realistic case diameter relative to wrist width; orient it with the arm; make the bracelet a single continuous closed band that wraps snugly around both sides of the wrist; hide the far section behind the wrist; preserve realistic gaps, links, clasp logic, metal reflections and a soft contact shadow. No open, broken, doubled, embedded or paper-flat strap.
- Preserve the reference subject's exact design, proportions, materials, colors and details, while relighting it to belong in Image 1.
- Product identity is invariant: reproduce every visible logo, brand inscription, symbol, dial marking, index, hand, number, date window, engraving and distinctive shape exactly as shown in Image 2. Do not invent, respell, approximate, replace, mirror, blur or remove brand details. Keep lettering crisp, correctly oriented and naturally printed or engraved on the physical surface.
- For a watch face specifically: preserve the exact dial layout, logo placement and spelling, hand shapes, index count and positions, bezel screws, crown, date window, texture and metal finish from Image 2. Relight these details without redesigning them.

FINAL QUALITY CHECK
- The result must look like a genuine unedited iPhone photograph at first glance, with natural imperfections and no artificial beauty filtering.
- Verify anatomy, object scale, attachment, occlusion, shadows, reflections and perspective before returning the final image.
- No extra objects, text overlays, borders, UI, captions, watermarks or collage.`;
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
