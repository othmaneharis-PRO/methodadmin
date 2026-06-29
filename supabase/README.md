# Système d'envoi d'emails — MethodAdmin

Système complet d'emails transactionnels propulsé par **Resend** et **Supabase Edge Functions**.

## 📋 Vue d'ensemble

| Email | Déclencheur | Destinataire |
|-------|-------------|--------------|
| 🎉 **Bienvenue / Confirmation de compte** | Inscription via Supabase Auth | Nouveau client (géré par Supabase Auth — voir `/email-templates/`) |
| 🔐 **Mot de passe oublié** | Demande de reset via Supabase Auth | Client (géré par Supabase Auth — voir `/email-templates/`) |
| ✅ **Confirmation de demande reçue** | Nouvelle ligne dans `demandes` | Client |
| 🔔 **Nouvelle demande reçue** | Nouvelle ligne dans `demandes` | Admin (`support@methodadmin.com`) |
| 📊 **Mise à jour du statut** | UPDATE `demandes.statut` | Client |
| 💬 **Nouveau message** | Nouvelle ligne dans `messages` | Client ou Admin (selon expéditeur) |
| 📎 **Documents demandés** | Appel manuel `envoyer_demande_documents()` | Client |

---

## 🔑 Étape 1 — Obtenir une clé API Resend

1. Crée un compte gratuit sur **https://resend.com** (3 000 emails/mois gratuits)
2. Dashboard → **API Keys** → **Create API Key**
3. Copie la clé qui commence par `re_...`
4. **Important** — Sans domaine vérifié, tu ne pourras envoyer qu'à l'adresse email du compte Resend (mode test). Pour envoyer à n'importe quel client, vérifie un domaine plus tard dans **Domains**.

---

## 📨 Étape 2 — Installer les 2 templates Supabase Auth

Templates de **confirmation de compte** et **mot de passe oublié** déjà créés dans `/app/email-templates/`.

👉 Voir le fichier [`/app/email-templates/README.md`](../email-templates/README.md) pour l'installation pas-à-pas.

---

## ⚡ Étape 3 — Déployer l'Edge Function `send-email`

### 3.1 — Installer la CLI Supabase (une seule fois)

```bash
# macOS / Linux
brew install supabase/tap/supabase

# Windows (via scoop)
scoop install supabase

# Ou via npm
npm install -g supabase
```

### 3.2 — Se connecter et lier le projet

```bash
cd /app
supabase login
supabase link --project-ref sahbhyccnkcqjzxkyzol
```

### 3.3 — Configurer les secrets de la fonction

```bash
supabase secrets set RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxx
supabase secrets set SENDER_EMAIL=onboarding@resend.dev
supabase secrets set ADMIN_EMAIL=support@methodadmin.com
supabase secrets set APP_URL=https://methodadmin.fr
```

> 💡 **Plus tard**, quand tu auras vérifié ton domaine dans Resend, remplace `SENDER_EMAIL` par `noreply@methodadmin.fr` (ou similaire).

### 3.4 — Déployer la fonction

```bash
supabase functions deploy send-email --no-verify-jwt
```

Le flag `--no-verify-jwt` permet aux triggers Postgres de l'appeler avec la clé `service_role` directement (sans token utilisateur).

### 3.5 — Tester manuellement

```bash
curl -X POST \
  -H "Authorization: Bearer TA_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "demande_confirmation",
    "to": "ton-email@example.com",
    "data": { "prenom": "Jean", "reference": "TEST-001", "service": "creation" }
  }' \
  https://sahbhyccnkcqjzxkyzol.supabase.co/functions/v1/send-email
```

Réponse attendue :
```json
{ "ok": true, "id": "xxxxxxxx-xxxx-..." }
```

---

## 🗄️ Étape 4 — Installer les triggers SQL

1. Ouvre **Supabase Dashboard → Database → SQL Editor**
2. Crée une nouvelle requête
3. Ouvre le fichier [`/app/supabase/migrations/email_triggers.sql`](./migrations/email_triggers.sql)
4. **Avant d'exécuter**, remplace dans le `INSERT INTO internal_config` :
   - `service_role_key` par ta vraie **service_role key** (Settings → API → `service_role` secret)
5. Exécute le script complet
6. Vérifie qu'aucune erreur n'apparaît dans la console SQL

> 🔒 La clé `service_role` est stockée dans une table interne avec **RLS activée et aucune policy** → personne ne peut la lire depuis le client (seuls les triggers en `SECURITY DEFINER` y accèdent).

---

## 🧪 Étape 5 — Tester de bout en bout

### Test 1 : confirmation de demande
1. Va sur `index.html` ou une page formulaire
2. Soumets une demande avec **ton email vérifié dans Resend**
3. Tu dois recevoir :
   - ✅ L'email de confirmation
   - 🔔 (Si tu utilises aussi ton email comme `ADMIN_EMAIL`) le mail admin

### Test 2 : changement de statut
1. Connecte-toi à `espace-admin.html`
2. Change le statut d'une demande
3. Le client doit recevoir le mail "Mise à jour de votre demande"

### Test 3 : message
1. Depuis `espace-admin.html`, envoie un message à un dossier
2. Le client doit recevoir l'email "Nouveau message"

### Test 4 : documents demandés (appel manuel)
Dans le SQL Editor :
```sql
SELECT envoyer_demande_documents(
  p_demande_id := '<UUID-de-la-demande>',
  p_documents  := ARRAY[
    'Carte d''identité du gérant',
    'Justificatif de domicile',
    'Statuts signés'
  ],
  p_note := 'Merci de nous transmettre ces pièces sous 48h.'
);
```

---

## 📊 Suivi & debug

### Voir les emails envoyés
- **Resend Dashboard → Logs** : tous les emails envoyés, leurs statuts (delivered, bounced, opened, etc.)

### Voir les appels HTTP des triggers
Dans le SQL Editor :
```sql
SELECT id, status_code, content, created
FROM net._http_response
ORDER BY created DESC
LIMIT 20;
```

### Voir les logs de l'Edge Function
- **Supabase Dashboard → Edge Functions → send-email → Logs**

---

## 🔧 Personnalisation rapide

### Changer l'email admin
- Soit : modifier la constante `v_admin_email` dans les 2 triggers SQL
- Soit : modifier le secret `ADMIN_EMAIL` côté Edge Function (mais les triggers passent l'email en dur dans le payload — voir SQL)

### Modifier le design d'un template
Édite `/app/supabase/functions/send-email/index.ts` → fonctions `tpl*` puis redéploie :
```bash
supabase functions deploy send-email --no-verify-jwt
```

### Désactiver temporairement un trigger
```sql
ALTER TABLE demandes DISABLE TRIGGER demande_created_email;
-- (et inversement avec ENABLE TRIGGER pour réactiver)
```

---

## ⚠️ Limites du mode test Resend (sans domaine vérifié)

Tant que tu utilises `onboarding@resend.dev` :
- Tu ne peux envoyer **qu'à l'adresse email du compte Resend** (le tien)
- Les emails contiennent une mention "via resend.dev"
- Le score de délivrabilité est plus faible

**Solution** : dès que possible, vérifie un domaine dans **Resend → Domains** (5 minutes, juste 3 enregistrements DNS à ajouter). Tu pourras alors envoyer à n'importe quelle adresse depuis `noreply@tondomaine.fr`.

---

## 📁 Structure des fichiers

```
/app/
├── email-templates/
│   ├── confirm-signup.html       ← Confirmation compte (à coller dans Supabase Auth)
│   ├── reset-password.html       ← Mot de passe oublié (idem)
│   └── README.md
└── supabase/
    ├── functions/send-email/
    │   └── index.ts              ← Edge Function (Deno/TS) — Resend API
    ├── migrations/
    │   └── email_triggers.sql    ← Triggers Postgres
    └── README.md                 ← Ce fichier
```

---

## ❓ Ce qu'il faut me fournir pour finaliser

Pour que je puisse t'aider à terminer le setup :
1. **Clé API Resend** (`re_...`) — uniquement si tu veux que je l'intègre côté code (sinon, configure-la toi-même via `supabase secrets set`)
2. **Service Role Key Supabase** — uniquement pour le `INSERT INTO internal_config` du SQL (ou tu le fais toi-même)
3. **Confirmation que tu as bien un compte Resend** créé

Tu peux faire le déploiement toi-même en suivant les étapes 3 et 4 ci-dessus — c'est ~10 minutes au total.
