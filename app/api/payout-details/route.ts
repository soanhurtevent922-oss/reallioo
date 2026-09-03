import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  encryptBankValue,
  isValidBic,
  isValidIban,
  maskedIban,
  normalizeBic,
  normalizeIban,
} from "@/lib/payout-bank";

export const runtime = "nodejs";

async function authenticatedAmbassador() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) return null;

  const userId = String(data.claims.sub);
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("plan, is_admin")
    .eq("id", userId)
    .maybeSingle();

  const hasPaidAccess = Boolean(profile?.is_admin || (profile?.plan && profile.plan !== "free"));
  return hasPaidAccess ? { userId, admin } : null;
}

export async function POST(request: NextRequest) {
  const authenticated = await authenticatedAmbassador();
  if (!authenticated) return NextResponse.json({ error: "Accès non autorisé" }, { status: 401 });

  try {
    const body = await request.json();
    const accountHolderName = String(body.accountHolderName || "").trim().replace(/\s+/g, " ");
    const iban = normalizeIban(String(body.iban || ""));
    const bic = normalizeBic(String(body.bic || ""));

    if (accountHolderName.length < 2 || accountHolderName.length > 120) {
      return NextResponse.json({ error: "Indique le nom complet du titulaire du compte." }, { status: 400 });
    }
    if (!isValidIban(iban)) {
      return NextResponse.json({ error: "Cet IBAN n’est pas valide." }, { status: 400 });
    }
    if (bic && !isValidBic(bic)) {
      return NextResponse.json({ error: "Ce BIC n’est pas valide." }, { status: 400 });
    }

    const encryptedIban = encryptBankValue(iban);
    const encryptedBic = bic ? encryptBankValue(bic) : null;
    const { error } = await authenticated.admin.from("payout_bank_details").upsert({
      user_id: authenticated.userId,
      account_holder_name: accountHolderName,
      iban_ciphertext: encryptedIban.ciphertext,
      iban_iv: encryptedIban.iv,
      iban_tag: encryptedIban.tag,
      iban_country: iban.slice(0, 2),
      iban_last4: iban.slice(-4),
      bic_ciphertext: encryptedBic?.ciphertext || null,
      bic_iv: encryptedBic?.iv || null,
      bic_tag: encryptedBic?.tag || null,
      updated_at: new Date().toISOString(),
    });
    if (error) throw error;

    return NextResponse.json({
      saved: true,
      accountHolderName,
      maskedIban: maskedIban(iban.slice(0, 2), iban.slice(-4)),
    });
  } catch (error) {
    console.error("Payout bank details could not be saved", error);
    return NextResponse.json(
      { error: "Impossible d’enregistrer le RIB pour le moment." },
      { status: 500 },
    );
  }
}

export async function DELETE() {
  const authenticated = await authenticatedAmbassador();
  if (!authenticated) return NextResponse.json({ error: "Accès non autorisé" }, { status: 401 });

  const { error } = await authenticated.admin
    .from("payout_bank_details")
    .delete()
    .eq("user_id", authenticated.userId);

  if (error) {
    console.error("Payout bank details could not be deleted", error);
    return NextResponse.json({ error: "Impossible de supprimer le RIB." }, { status: 500 });
  }
  return NextResponse.json({ deleted: true });
}
