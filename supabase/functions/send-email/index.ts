// ============================================================
// MethodAdmin — Edge Function "send-email"
// Envoi d'emails transactionnels via Resend
// ============================================================
// Déploiement :
//   supabase functions deploy send-email --no-verify-jwt
// 
// Secrets à configurer (Supabase Dashboard > Edge Functions > send-email > Secrets) :
//   RESEND_API_KEY  = re_xxxxxxxxxxxxxxxxx
//   SENDER_EMAIL    = onboarding@resend.dev  (ou ton domaine vérifié)
//   ADMIN_EMAIL     = support@methodadmin.com
//   APP_URL         = https://methodadmin.fr (ou ton URL Vercel)
// ============================================================

// @ts-ignore — Deno runtime
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const SENDER_EMAIL   = Deno.env.get("SENDER_EMAIL")   ?? "onboarding@resend.dev";
const ADMIN_EMAIL    = Deno.env.get("ADMIN_EMAIL")    ?? "support@methodadmin.com";
const APP_URL        = Deno.env.get("APP_URL")        ?? "https://methodadmin.fr";
const FROM_NAME      = "MethodAdmin";

// ---------- Charte graphique commune ----------
const BLUE = "#1a56db";
const BLUE_LIGHT = "#e8f0fe";
const DARK = "#0f172a";
const GRAY = "#475569";
const BG = "#f7f8fc";

// ---------- Helpers ----------
const escapeHtml = (s: string) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const serviceLabel: Record<string, string> = {
  creation: "Création d'entreprise",
  modification: "Modification d'entreprise",
  fermeture: "Fermeture / Radiation",
  kbis: "Extrait Kbis",
  autre: "Autre demande",
};

const statutLabel: Record<string, string> = {
  nouvelle: "Nouvelle",
  en_cours: "En cours d'analyse",
  devis_envoye: "Devis envoyé",
  validee: "Validée",
  en_traitement: "En traitement",
  deposee: "Déposée au greffe",
  terminee: "Terminée",
  annulee: "Annulée",
  refusee: "Refusée",
};

// ---------- Wrapper HTML commun ----------
function emailLayout(opts: {
  title: string;
  preheader?: string;
  bodyHtml: string;
  ctaUrl?: string;
  ctaLabel?: string;
}) {
  return `<!DOCTYPE html>
<html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(opts.title)}</title></head>
<body style="margin:0;padding:0;background-color:${BG};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:${DARK};">
<div style="display:none;max-height:0;overflow:hidden;font-size:1px;line-height:1px;color:${BG};opacity:0;">${escapeHtml(opts.preheader ?? opts.title)}</div>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:${BG};padding:32px 12px;">
  <tr><td align="center">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="width:600px;max-width:100%;background-color:#ffffff;border-radius:16px;box-shadow:0 4px 24px rgba(15,23,42,0.06);overflow:hidden;">
      <tr><td style="background-color:${BLUE};padding:28px 40px;text-align:center;">
        <div style="font-size:22px;font-weight:800;color:#ffffff;letter-spacing:-0.01em;">METHOD<span style="color:#bfdbfe;">ADMIN</span></div>
        <div style="font-size:13px;color:#bfdbfe;margin-top:4px;">Formalités d'entreprise en ligne</div>
      </td></tr>
      <tr><td style="padding:36px 44px 12px;">
        ${opts.bodyHtml}
      </td></tr>
      ${opts.ctaUrl && opts.ctaLabel ? `
      <tr><td style="padding:12px 44px 28px;" align="center">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td style="border-radius:10px;background-color:${BLUE};">
          <a href="${opts.ctaUrl}" style="display:inline-block;padding:13px 32px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:10px;">${escapeHtml(opts.ctaLabel)}</a>
        </td></tr></table>
      </td></tr>` : ""}
      <tr><td style="background-color:${DARK};padding:22px 44px;text-align:center;">
        <p style="margin:0 0 4px;font-size:14px;font-weight:700;color:#ffffff;">MethodAdmin</p>
        <p style="margin:0;font-size:12px;color:#94a3b8;">Votre partenaire pour toutes vos formalités</p>
        <p style="margin:10px 0 0;font-size:11px;color:#64748b;">© 2026 MethodAdmin · <a href="${APP_URL}" style="color:#94a3b8;text-decoration:underline;">${APP_URL.replace(/^https?:\/\//, "")}</a></p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}

// ---------- TEMPLATES ----------

function tplDemandeConfirmation(p: { prenom: string; reference: string; service: string }) {
  const svc = serviceLabel[p.service] ?? p.service;
  const body = `
    <h1 style="margin:0 0 14px;font-size:24px;font-weight:800;color:${DARK};line-height:1.25;">Demande bien reçue ✅</h1>
    <p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:${GRAY};">Bonjour ${escapeHtml(p.prenom)},</p>
    <p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:${GRAY};">Nous avons bien reçu votre demande de <strong style="color:${DARK};">${escapeHtml(svc)}</strong>. Notre équipe l'analyse et vous transmet un devis détaillé sous <strong>24h ouvrées</strong>.</p>
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color:${BLUE_LIGHT};border-radius:12px;margin:18px 0;">
      <tr><td style="padding:16px 20px;">
        <p style="margin:0 0 4px;font-size:13px;color:${GRAY};">Référence de votre demande</p>
        <p style="margin:0;font-size:20px;font-weight:800;color:${BLUE};letter-spacing:.04em;">${escapeHtml(p.reference)}</p>
      </td></tr>
    </table>
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color:#fef9c3;border:1.5px solid #facc15;border-radius:12px;margin-bottom:18px;">
      <tr><td style="padding:14px 18px;">
        <p style="margin:0 0 4px;font-size:14px;font-weight:700;color:#422006;">💡 Suivez votre demande en ligne</p>
        <p style="margin:0;font-size:13px;line-height:1.55;color:#713f12;">Créez votre espace client avec <strong>la même adresse email</strong> que celle utilisée pour cette demande, et suivez l'avancement en temps réel.</p>
      </td></tr>
    </table>`;
  return {
    subject: `✅ Demande reçue · Réf. ${p.reference}`,
    html: emailLayout({
      title: "Demande reçue",
      preheader: `Votre demande ${p.reference} a bien été enregistrée.`,
      bodyHtml: body,
      ctaUrl: `${APP_URL}/login-client.html`,
      ctaLabel: "Accéder à mon espace client →",
    }),
  };
}

function tplAdminNewDemande(p: { reference: string; service: string; prenom: string; nom: string; email: string; telephone?: string; urgence?: string; description?: string }) {
  const svc = serviceLabel[p.service] ?? p.service;
  const body = `
    <h1 style="margin:0 0 14px;font-size:22px;font-weight:800;color:${DARK};">🔔 Nouvelle demande reçue</h1>
    <p style="margin:0 0 14px;font-size:14px;color:${GRAY};">Une nouvelle demande vient d'être soumise sur le site.</p>
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color:${BG};border:1px solid #e2e8f0;border-radius:12px;margin-bottom:16px;">
      <tr><td style="padding:14px 18px;font-size:14px;color:${DARK};">
        <p style="margin:0 0 6px;"><strong>Référence :</strong> ${escapeHtml(p.reference)}</p>
        <p style="margin:0 0 6px;"><strong>Service :</strong> ${escapeHtml(svc)}</p>
        <p style="margin:0 0 6px;"><strong>Urgence :</strong> ${escapeHtml(p.urgence ?? "normal")}</p>
        <p style="margin:0 0 6px;"><strong>Client :</strong> ${escapeHtml(p.prenom)} ${escapeHtml(p.nom)}</p>
        <p style="margin:0 0 6px;"><strong>Email :</strong> <a href="mailto:${escapeHtml(p.email)}" style="color:${BLUE};">${escapeHtml(p.email)}</a></p>
        ${p.telephone ? `<p style="margin:0 0 6px;"><strong>Téléphone :</strong> ${escapeHtml(p.telephone)}</p>` : ""}
        ${p.description ? `<p style="margin:8px 0 0;"><strong>Description :</strong></p><p style="margin:4px 0 0;white-space:pre-wrap;color:${GRAY};font-size:13px;">${escapeHtml(p.description)}</p>` : ""}
      </td></tr>
    </table>`;
  return {
    subject: `🔔 Nouvelle demande ${p.reference} · ${svc}`,
    html: emailLayout({
      title: "Nouvelle demande",
      preheader: `${p.prenom} ${p.nom} a soumis une demande de ${svc}`,
      bodyHtml: body,
      ctaUrl: `${APP_URL}/espace-admin.html`,
      ctaLabel: "Traiter dans l'espace admin →",
    }),
  };
}

function tplStatutUpdate(p: { prenom: string; reference: string; ancien: string; nouveau: string }) {
  const ancien = statutLabel[p.ancien] ?? p.ancien;
  const nouveau = statutLabel[p.nouveau] ?? p.nouveau;
  const body = `
    <h1 style="margin:0 0 14px;font-size:22px;font-weight:800;color:${DARK};">📊 Mise à jour de votre demande</h1>
    <p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:${GRAY};">Bonjour ${escapeHtml(p.prenom)},</p>
    <p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:${GRAY};">Le statut de votre demande <strong style="color:${DARK};">${escapeHtml(p.reference)}</strong> vient d'être mis à jour.</p>
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color:${BLUE_LIGHT};border-radius:12px;margin:18px 0;">
      <tr><td style="padding:16px 20px;">
        <p style="margin:0 0 4px;font-size:12px;color:${GRAY};text-transform:uppercase;letter-spacing:.05em;">Nouveau statut</p>
        <p style="margin:0;font-size:20px;font-weight:800;color:${BLUE};">${escapeHtml(nouveau)}</p>
        <p style="margin:6px 0 0;font-size:12px;color:${GRAY};">Précédent : ${escapeHtml(ancien)}</p>
      </td></tr>
    </table>
    <p style="margin:0;font-size:14px;line-height:1.6;color:${GRAY};">Consultez votre espace client pour voir le détail et échanger avec notre équipe.</p>`;
  return {
    subject: `📊 ${p.reference} · ${nouveau}`,
    html: emailLayout({
      title: "Statut mis à jour",
      preheader: `Votre demande ${p.reference} : ${nouveau}`,
      bodyHtml: body,
      ctaUrl: `${APP_URL}/espace-client.html`,
      ctaLabel: "Voir ma demande →",
    }),
  };
}

function tplNouveauMessage(p: { prenom: string; reference: string; expediteur: string; extrait: string; isClient: boolean }) {
  const body = `
    <h1 style="margin:0 0 14px;font-size:22px;font-weight:800;color:${DARK};">💬 Nouveau message</h1>
    <p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:${GRAY};">Bonjour ${escapeHtml(p.prenom)},</p>
    <p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:${GRAY};">Vous avez reçu un nouveau message de <strong style="color:${DARK};">${escapeHtml(p.expediteur)}</strong> concernant votre dossier <strong>${escapeHtml(p.reference)}</strong> :</p>
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color:${BG};border-left:4px solid ${BLUE};border-radius:8px;margin:18px 0;">
      <tr><td style="padding:14px 18px;font-size:14px;line-height:1.55;color:${DARK};font-style:italic;white-space:pre-wrap;">"${escapeHtml(p.extrait)}"</td></tr>
    </table>
    <p style="margin:0;font-size:14px;line-height:1.6;color:${GRAY};">Connectez-vous pour répondre directement depuis votre espace.</p>`;
  return {
    subject: `💬 Nouveau message · ${p.reference}`,
    html: emailLayout({
      title: "Nouveau message",
      preheader: `Message de ${p.expediteur} sur ${p.reference}`,
      bodyHtml: body,
      ctaUrl: p.isClient ? `${APP_URL}/espace-client.html` : `${APP_URL}/espace-admin.html`,
      ctaLabel: "Lire et répondre →",
    }),
  };
}

function tplDocumentRequest(p: { prenom: string; reference: string; documents: string[]; note?: string }) {
  const listHtml = p.documents.map(d => `<li style="margin-bottom:6px;font-size:14px;color:${DARK};">${escapeHtml(d)}</li>`).join("");
  const body = `
    <h1 style="margin:0 0 14px;font-size:22px;font-weight:800;color:${DARK};">📎 Documents demandés</h1>
    <p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:${GRAY};">Bonjour ${escapeHtml(p.prenom)},</p>
    <p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:${GRAY};">Pour faire avancer votre dossier <strong style="color:${DARK};">${escapeHtml(p.reference)}</strong>, nous avons besoin des documents suivants :</p>
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color:${BG};border:1px solid #e2e8f0;border-radius:12px;margin:18px 0;">
      <tr><td style="padding:14px 22px;">
        <ul style="margin:0;padding-left:20px;">${listHtml}</ul>
      </td></tr>
    </table>
    ${p.note ? `<p style="margin:0 0 14px;font-size:14px;line-height:1.6;color:${GRAY};"><strong>Note :</strong> ${escapeHtml(p.note)}</p>` : ""}
    <p style="margin:0;font-size:14px;line-height:1.6;color:${GRAY};">Déposez vos documents directement depuis votre espace client. Le téléversement est sécurisé.</p>`;
  return {
    subject: `📎 Documents à fournir · ${p.reference}`,
    html: emailLayout({
      title: "Documents demandés",
      preheader: `Documents requis pour ${p.reference}`,
      bodyHtml: body,
      ctaUrl: `${APP_URL}/espace-client.html`,
      ctaLabel: "Téléverser mes documents →",
    }),
  };
}

// ---------- HANDLER PRINCIPAL ----------

interface EmailPayload {
  type: "demande_confirmation" | "admin_new_demande" | "statut_update" | "nouveau_message" | "document_request" | "custom";
  to: string;
  data: Record<string, unknown>;
}

async function sendViaResend(to: string, subject: string, html: string) {
  if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY not configured");
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: `${FROM_NAME} <${SENDER_EMAIL}>`,
      to: [to],
      subject,
      html,
    }),
  });
  const body = await r.json();
  if (!r.ok) throw new Error(`Resend API error ${r.status}: ${JSON.stringify(body)}`);
  return body;
}

serve(async (req: Request) => {
  // CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
      },
    });
  }
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const payload = (await req.json()) as EmailPayload;
    if (!payload?.type || !payload?.to) {
      return new Response(JSON.stringify({ error: "Missing 'type' or 'to'" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    let built: { subject: string; html: string };
    // deno-lint-ignore no-explicit-any
    const d = payload.data as any;
    switch (payload.type) {
      case "demande_confirmation":
        built = tplDemandeConfirmation({ prenom: d.prenom ?? "", reference: d.reference ?? "", service: d.service ?? "autre" });
        break;
      case "admin_new_demande":
        built = tplAdminNewDemande(d);
        break;
      case "statut_update":
        built = tplStatutUpdate(d);
        break;
      case "nouveau_message":
        built = tplNouveauMessage(d);
        break;
      case "document_request":
        built = tplDocumentRequest({ prenom: d.prenom ?? "", reference: d.reference ?? "", documents: d.documents ?? [], note: d.note });
        break;
      case "custom":
        built = { subject: d.subject ?? "(sans objet)", html: d.html ?? "" };
        break;
      default:
        return new Response(JSON.stringify({ error: `Unknown type: ${payload.type}` }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
    }

    const result = await sendViaResend(payload.to, built.subject, built.html);
    return new Response(JSON.stringify({ ok: true, id: result.id }), {
      status: 200,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  } catch (err) {
    console.error("send-email error:", err);
    return new Response(JSON.stringify({ ok: false, error: String(err?.message ?? err) }), {
      status: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }
});
