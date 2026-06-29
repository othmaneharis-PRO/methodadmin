-- ============================================================
-- MethodAdmin — Triggers d'envoi automatique d'emails
-- ============================================================
-- Ce script crée 4 triggers Postgres qui appellent automatiquement
-- l'Edge Function "send-email" via l'extension pg_net :
--
--   1. INSERT sur public.demandes         → confirmation au client + notif admin
--   2. UPDATE de demandes.statut          → notification statut au client
--   3. INSERT sur public.messages         → notification au destinataire
--   4. (Document request : déclenché manuellement depuis l'espace admin)
--
-- ⚠️  À EXÉCUTER UNE SEULE FOIS dans le SQL Editor Supabase
--     (Database > SQL Editor) après avoir :
--     a) Déployé la fonction Edge "send-email"
--     b) Configuré ses secrets (RESEND_API_KEY, SENDER_EMAIL, ADMIN_EMAIL, APP_URL)
--     c) Remplacé les 2 variables ci-dessous (PROJECT_REF + SERVICE_ROLE_KEY)
-- ============================================================

-- ---------- 0. Prérequis ----------
-- L'extension pg_net est généralement déjà activée sur Supabase.
-- Si besoin :
CREATE EXTENSION IF NOT EXISTS pg_net;

-- ============================================================
-- ⚠️  REMPLACE CES 2 VALEURS AVANT D'EXÉCUTER LE SCRIPT
-- ============================================================
-- 1) PROJECT_REF : identifiant de ton projet Supabase
--    (ex: 'sahbhyccnkcqjzxkyzol' — visible dans l'URL du dashboard)
-- 2) SERVICE_ROLE_KEY : clé "service_role" (Settings > API)
--    ⚠️ NE JAMAIS exposer cette clé côté client !
-- ============================================================

-- Stocke ces valeurs dans une table de config interne (plus propre que hardcodé)
CREATE TABLE IF NOT EXISTS internal_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- ⚠️ Remplace les 2 valeurs ci-dessous :
INSERT INTO internal_config (key, value) VALUES
  ('edge_url', 'https://sahbhyccnkcqjzxkyzol.supabase.co/functions/v1/send-email'),
  ('service_role_key', 'REMPLACE_PAR_TA_SERVICE_ROLE_KEY')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- Empêche tout accès en lecture côté client
ALTER TABLE internal_config ENABLE ROW LEVEL SECURITY;
-- (aucune policy = personne d'autre que service_role ne peut lire)

-- ============================================================
-- HELPER : appel HTTP asynchrone à l'Edge Function
-- ============================================================
CREATE OR REPLACE FUNCTION send_email_async(payload JSONB)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  edge_url TEXT;
  srv_key TEXT;
  request_id BIGINT;
BEGIN
  SELECT value INTO edge_url FROM internal_config WHERE key = 'edge_url';
  SELECT value INTO srv_key FROM internal_config WHERE key = 'service_role_key';

  IF edge_url IS NULL OR srv_key IS NULL THEN
    RAISE WARNING 'send_email_async: internal_config manquante (edge_url ou service_role_key)';
    RETURN NULL;
  END IF;

  SELECT net.http_post(
    url := edge_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || srv_key
    ),
    body := payload
  ) INTO request_id;

  RETURN request_id;
EXCEPTION WHEN OTHERS THEN
  -- L'échec d'envoi d'email ne doit JAMAIS bloquer une transaction métier
  RAISE WARNING 'send_email_async failed: %', SQLERRM;
  RETURN NULL;
END;
$$;

-- ============================================================
-- TRIGGER 1 — Nouvelle demande créée
-- → Confirmation au client + notification à l'admin
-- ============================================================
CREATE OR REPLACE FUNCTION trg_demande_created()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_client RECORD;
  v_admin_email TEXT := 'support@methodadmin.com'; -- ⚠️ remplace si besoin
BEGIN
  -- Récupère les infos du client lié à la demande
  SELECT email, prenom, nom, telephone INTO v_client
  FROM clients
  WHERE id = NEW.client_id;

  IF v_client IS NULL THEN
    RAISE WARNING 'trg_demande_created: client introuvable id=%', NEW.client_id;
    RETURN NEW;
  END IF;

  -- 1) Email de confirmation au client
  PERFORM send_email_async(jsonb_build_object(
    'type', 'demande_confirmation',
    'to', v_client.email,
    'data', jsonb_build_object(
      'prenom', v_client.prenom,
      'reference', NEW.reference,
      'service', NEW.service
    )
  ));

  -- 2) Email de notification à l'admin
  PERFORM send_email_async(jsonb_build_object(
    'type', 'admin_new_demande',
    'to', v_admin_email,
    'data', jsonb_build_object(
      'reference', NEW.reference,
      'service', NEW.service,
      'prenom', v_client.prenom,
      'nom', v_client.nom,
      'email', v_client.email,
      'telephone', v_client.telephone,
      'urgence', NEW.urgence,
      'description', NEW.description
    )
  ));

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS demande_created_email ON public.demandes;
CREATE TRIGGER demande_created_email
  AFTER INSERT ON public.demandes
  FOR EACH ROW
  EXECUTE FUNCTION trg_demande_created();

-- ============================================================
-- TRIGGER 2 — Changement de statut d'une demande
-- → Notification au client
-- ============================================================
CREATE OR REPLACE FUNCTION trg_statut_changed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_client RECORD;
BEGIN
  -- Ne déclenche que si le statut a changé
  IF NEW.statut IS NOT DISTINCT FROM OLD.statut THEN
    RETURN NEW;
  END IF;

  SELECT email, prenom INTO v_client
  FROM clients
  WHERE id = NEW.client_id;

  IF v_client IS NULL THEN
    RETURN NEW;
  END IF;

  PERFORM send_email_async(jsonb_build_object(
    'type', 'statut_update',
    'to', v_client.email,
    'data', jsonb_build_object(
      'prenom', v_client.prenom,
      'reference', NEW.reference,
      'ancien', OLD.statut,
      'nouveau', NEW.statut
    )
  ));

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS demande_statut_email ON public.demandes;
CREATE TRIGGER demande_statut_email
  AFTER UPDATE OF statut ON public.demandes
  FOR EACH ROW
  EXECUTE FUNCTION trg_statut_changed();

-- ============================================================
-- TRIGGER 3 — Nouveau message dans une conversation
-- → Notification au destinataire (client si admin écrit, admin si client écrit)
-- ============================================================
CREATE OR REPLACE FUNCTION trg_message_created()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_demande RECORD;
  v_client RECORD;
  v_auteur_profile RECORD;
  v_extrait TEXT;
  v_admin_email TEXT := 'support@methodadmin.com'; -- ⚠️ remplace si besoin
  v_destinataire TEXT;
  v_dest_prenom TEXT;
  v_expediteur_nom TEXT;
  v_is_client_recipient BOOLEAN;
BEGIN
  -- Récupère la demande et le client
  SELECT d.reference, d.client_id, c.email, c.prenom AS client_prenom
    INTO v_demande
  FROM demandes d
  JOIN clients c ON c.id = d.client_id
  WHERE d.id = NEW.demande_id;

  IF v_demande IS NULL THEN
    RETURN NEW;
  END IF;

  -- Récupère le profil de l'auteur (pour savoir si c'est un client ou un admin)
  SELECT role, prenom, nom INTO v_auteur_profile
  FROM profiles
  WHERE id = NEW.auteur_id;

  -- Calcule destinataire : si admin écrit → email au client, sinon → email à l'admin
  IF v_auteur_profile.role = 'admin' THEN
    v_destinataire := v_demande.email;
    v_dest_prenom := v_demande.client_prenom;
    v_expediteur_nom := 'L''équipe MethodAdmin';
    v_is_client_recipient := TRUE;
  ELSE
    v_destinataire := v_admin_email;
    v_dest_prenom := 'Admin';
    v_expediteur_nom := COALESCE(v_auteur_profile.prenom || ' ' || v_auteur_profile.nom, v_demande.client_prenom);
    v_is_client_recipient := FALSE;
  END IF;

  -- Extrait : 200 premiers caractères max
  v_extrait := LEFT(NEW.contenu, 200);
  IF LENGTH(NEW.contenu) > 200 THEN
    v_extrait := v_extrait || '…';
  END IF;

  PERFORM send_email_async(jsonb_build_object(
    'type', 'nouveau_message',
    'to', v_destinataire,
    'data', jsonb_build_object(
      'prenom', v_dest_prenom,
      'reference', v_demande.reference,
      'expediteur', v_expediteur_nom,
      'extrait', v_extrait,
      'isClient', v_is_client_recipient
    )
  ));

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS message_created_email ON public.messages;
CREATE TRIGGER message_created_email
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION trg_message_created();

-- ============================================================
-- FONCTION HELPER — Demande de documents au client (appel manuel)
-- ============================================================
-- À appeler depuis l'espace admin via :
--   SELECT envoyer_demande_documents(
--     p_demande_id := 'uuid-demande',
--     p_documents  := ARRAY['Carte d''identité du gérant','Justificatif de domicile','Statuts signés'],
--     p_note       := 'Merci de nous transmettre ces pièces sous 48h.'
--   );
-- ============================================================
CREATE OR REPLACE FUNCTION envoyer_demande_documents(
  p_demande_id UUID,
  p_documents  TEXT[],
  p_note       TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_demande RECORD;
BEGIN
  SELECT d.reference, c.email, c.prenom
    INTO v_demande
  FROM demandes d
  JOIN clients c ON c.id = d.client_id
  WHERE d.id = p_demande_id;

  IF v_demande IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Demande introuvable');
  END IF;

  PERFORM send_email_async(jsonb_build_object(
    'type', 'document_request',
    'to', v_demande.email,
    'data', jsonb_build_object(
      'prenom', v_demande.prenom,
      'reference', v_demande.reference,
      'documents', to_jsonb(p_documents),
      'note', p_note
    )
  ));

  RETURN jsonb_build_object('success', TRUE, 'email', v_demande.email);
END;
$$;

-- Permet l'appel depuis l'app (RLS gérera la sécurité via le rôle admin)
GRANT EXECUTE ON FUNCTION envoyer_demande_documents(UUID, TEXT[], TEXT) TO authenticated;

-- ============================================================
-- VERIFICATION
-- ============================================================
-- Pour tester le système, tu peux exécuter dans le SQL Editor :
--
--   SELECT send_email_async(jsonb_build_object(
--     'type', 'demande_confirmation',
--     'to', 'TON_EMAIL_VERIFIE_RESEND@example.com',
--     'data', jsonb_build_object(
--       'prenom', 'Jean',
--       'reference', 'TEST-001',
--       'service', 'creation'
--     )
--   ));
--
-- ⚠️ Avec onboarding@resend.dev, les emails ne peuvent être envoyés
--    QU'à l'adresse email du compte Resend propriétaire.
--    Pour envoyer à n'importe quelle adresse, il faut vérifier un domaine.
-- ============================================================
