import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const maxDuration = 300;

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_FILE_SIZE = 2_200_000;
const MAX_PROMPT_LENGTH = 1_500;

class ImageGenerationError extends Error {
  constructor(
    message: string,
    readonly status: number = 502,
    readonly code: string = "IMAGE_GENERATION_FAILED",
  ) {
    super(message);
    this.name = "ImageGenerationError";
  }
}

function extensionFor(type: string) {
  if (type === "image/png") return "png";
  if (type === "image/webp") return "webp";
  return "jpg";
}

function isImageFile(value: FormDataEntryValue | null): value is File {
  return value instanceof File && value.size > 0 && ALLOWED_TYPES.has(value.type);
}

function generationPrompt(userPrompt: string, hasReference: boolean) {
  const inputs = hasReference
    ? `- Image 1 is the reference subject to insert or use for the requested edit. It can be a person, an animal, a product, a vehicle or another object. Preserve the identity and appearance of that subject. Use only the requested subject from this image; never copy its background or studio presentation.
- Image 2 is the authoritative source photograph. Its person, anatomy, pose, camera, framing, lighting and environment must remain unchanged.`
    : "- Image 1 is the authoritative source photograph. Its person, anatomy, pose, camera, framing, lighting and environment must remain unchanged.";

  return `ROLE
You are performing a precise photorealistic edit, not creating a new scene.

INPUTS
${inputs}

USER EDIT
${userPrompt}

NON-NEGOTIABLE PRESERVATION
- Change only the requested element. Keep every unrelated pixel and visual property as close to the source photograph as possible.
- Preserve the person's exact identity, skin tone, hand and finger count, wrist thickness, joints, body proportions, pose and silhouette. Never enlarge, bend, rebuild or deform anatomy to make the inserted object fit; resize and orient the object instead.
- Preserve the exact camera position, portrait framing, perspective, lens look, background, architecture, lighting direction, exposure, white balance, shadows and reflections of the source photograph.

PHYSICAL COMPOSITING
- Determine the real 3D placement surface before inserting the requested subject. Match its scale, rotation, perspective, depth, focal sharpness, grain, color temperature and lens distortion to the source photograph.
- The inserted subject must have believable contact, occlusion and cast/contact shadows. It must never float, intersect the body, melt into skin, duplicate, stretch, bend unnaturally or appear pasted on.
- If the inserted subject is worn on the body (watch, bracelet, ring, necklace, glasses, clothing or shoes), fit it to the existing anatomy without altering that anatomy. Parts on the near side stay visible; parts continuing around the far side pass naturally behind the body.
- For a watch or bracelet specifically: place the case centered on the natural top plane of the wrist; keep a realistic case diameter relative to wrist width; orient it with the arm; make the bracelet a single continuous closed band that wraps snugly around both sides of the wrist; hide the far section behind the wrist; preserve realistic gaps, links, clasp logic, metal reflections and a soft contact shadow. No open, broken, doubled, embedded or paper-flat strap.
- If the reference subject is a person: preserve that adult person's recognizable face, hairstyle, skin tone, clothing, body proportions and distinguishing appearance. Place the person naturally into the source scene at a realistic scale. Do not copy the reference background and do not alter the source environment beyond the requested insertion.
- If the reference subject is a product, vehicle or object: preserve its exact design, proportions, materials, colors and details while relighting it to belong in the source photograph.
- Apply logo and brand-preservation rules only when the requested reference subject is physical merchandise, equipment, a vehicle, clothing, an accessory or another branded object. Never apply product/logo rules to a person, animal, skin, face, hair, sky, landscape or background.
- For branded physical objects only, product identity is invariant: copy every visible logo, brand inscription, symbol, dial marking, number, engraving and distinctive shape exactly from the reference image. Treat the logo area as locked artwork: do not redraw, reinterpret, invent, respell, approximate, replace, mirror, blur, stylize or remove it. Keep lettering crisp, correctly oriented and naturally printed or engraved on the physical surface.
- For a watch face specifically: preserve the exact dial layout, logo artwork, logo placement and spelling, hand shapes, index count and positions, bezel screws, crown, date window, texture and metal finish from the reference image. Relight these details without redesigning them.

FINAL QUALITY CHECK
- The result must look like a genuine unedited iPhone photograph at first glance, with natural imperfections and no artificial beauty filtering.
- Verify anatomy, object scale, attachment, occlusion, shadows, reflections and perspective before returning the final image.
- No extra objects, text overlays, borders, UI, captions, watermarks or collage.`;
}

function classifyOpenAIError(
  status: number,
  error?: { message?: string; code?: string },
) {
  const details = `${error?.code || ""} ${error?.message || ""}`.toLowerCase();

  if (
    details.includes("content_policy") ||
    details.includes("moderation") ||
    details.includes("safety") ||
    details.includes("sexual")
  ) {
    return new ImageGenerationError(
      "Une des photos ou la demande a été bloquée par le filtre de sécurité. Essaie une référence moins suggestive ou une personne davantage vêtue. Ton crédit Reallioo a été rendu.",
      422,
      "AI_SAFETY_REJECTED",
    );
  }

  if (
    details.includes("invalid_image") ||
    details.includes("unsupported_image") ||
    details.includes("image_format") ||
    details.includes("invalid_file")
  ) {
    return new ImageGenerationError(
      "Une des images n’a pas pu être lue par le moteur IA. Enregistre-la en JPG, PNG ou WEBP puis réessaie. Ton crédit Reallioo a été rendu.",
      422,
      "AI_INVALID_IMAGE",
    );
  }

  if (
    details.includes("insufficient_quota") ||
    details.includes("billing") ||
    details.includes("hard_limit")
  ) {
    return new ImageGenerationError(
      "Le budget OpenAI de Reallioo est épuisé. Aucun nouveau test ne doit être lancé avant sa recharge. Ton crédit Reallioo a été rendu.",
      503,
      "AI_BILLING_LIMIT",
    );
  }

  if (details.includes("organization") && details.includes("verif")) {
    return new ImageGenerationError(
      "Le compte OpenAI de Reallioo doit encore être vérifié pour utiliser ce modèle. Ton crédit Reallioo a été rendu.",
      503,
      "AI_ORGANIZATION_VERIFICATION",
    );
  }

  if (
    details.includes("invalid_input_fidelity_model") ||
    (details.includes("input_fidelity") && details.includes("does not support"))
  ) {
    return new ImageGenerationError(
      "Le moteur IA a refusé un réglage technique incompatible. Ton crédit Reallioo a été rendu.",
      503,
      "AI_CONFIGURATION_ERROR",
    );
  }

  if (status === 429) {
    return new ImageGenerationError(
      "Le moteur IA reçoit trop de demandes. Ton crédit Reallioo a été rendu : attends une minute puis réessaie.",
      429,
      "AI_RATE_LIMIT",
    );
  }

  if (status >= 500) {
    return new ImageGenerationError(
      "Le moteur IA est momentanément indisponible. Ton crédit Reallioo a été rendu : réessaie dans quelques instants.",
      503,
      "AI_UNAVAILABLE",
    );
  }

  return new ImageGenerationError(
    "La demande a été refusée par le moteur IA. Ne relance pas plusieurs fois : vérifie les photos ou consulte les logs Vercel. Ton crédit Reallioo a été rendu.",
    422,
    "AI_REQUEST_REJECTED",
  );
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
    // With several high-fidelity inputs, the first image receives the richest
    // preservation. Put the product reference first so logos and dial artwork
    // stay as close as possible to the supplied product photo.
    if (referenceFile) {
      openAIForm.append("image[]", referenceFile, `reference.${extensionFor(referenceFile.type)}`);
      openAIForm.append("image[]", source, `source.${extensionFor(source.type)}`);
    } else {
      openAIForm.append("image[]", source, `source.${extensionFor(source.type)}`);
    }
    openAIForm.append("prompt", generationPrompt(prompt, Boolean(referenceFile)));
    // 1024x1536 is the portrait size officially supported by the Images API.
    // gpt-image-2 preserves input details automatically and rejects the
    // input_fidelity parameter, so it must not be sent for this model.
    openAIForm.append("size", "1024x1536");
    // High output quality costs much more but does not improve how faithfully
    // small logos or dial inscriptions are copied from a reference image.
    // Keep generations economical while product-faithful compositing is built.
    openAIForm.append("quality", "medium");
    // The official Images API supports a less restrictive moderation mode for
    // legitimate, non-explicit edits such as swimwear or beach photography.
    // Safety filtering remains enabled.
    openAIForm.append("moderation", "low");
    openAIForm.append("output_format", "webp");
    openAIForm.append("output_compression", "100");
    openAIForm.append("n", "1");

    const openAIResponse = await fetch("https://api.openai.com/v1/images/edits", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: openAIForm,
      signal: AbortSignal.timeout(280_000),
    });

    const requestId = openAIResponse.headers.get("x-request-id");
    const responseText = await openAIResponse.text();
    let openAIResult: { data?: Array<{ b64_json?: string }>; error?: { message?: string; code?: string } } = {};
    try {
      openAIResult = JSON.parse(responseText);
    } catch {
      // Some gateway failures return an empty or non-JSON response.
    }

    if (!openAIResponse.ok) {
      console.error("OpenAI image error", {
        status: openAIResponse.status,
        requestId,
        code: openAIResult.error?.code,
        message: openAIResult.error?.message,
      });

      throw classifyOpenAIError(openAIResponse.status, openAIResult.error);
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
    const generationError = error instanceof ImageGenerationError ? error : null;
    await admin
      .from("generations")
      .update({ status: "failed", error_message: generationError?.code || "generation_failed" })
      .eq("id", generationId)
      .eq("user_id", user.id);

    if (creditConsumed) {
      await admin.rpc("refund_generation_credit", { p_user_id: user.id });
    }

    return NextResponse.json(
      {
        error:
          generationError?.message ||
          "La génération n’a pas abouti. Ton crédit a été rendu, réessaie.",
        code: generationError?.code || "GENERATION_FAILED",
      },
      { status: generationError?.status || 500 },
    );
  }
}
