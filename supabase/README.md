# Système d'envoi d'emails — MethodAdmin

Système complet d'emails transactionnels propulsé par **Resend** et **Supabase Edge Functions**.

Domaine d'envoi : **`methodadmin.com`**

## 📋 Vue d'ensemble

| Email | Déclencheur | Destinataire |
|-------|-------------|--------------|
| 🎉 **Bienvenue / Confirmation de compte** | Inscription via Supabase Auth | Nouveau client (template `/email-templates/confirm-signup.html`) |
| 🔐 **Mot de passe oublié** | Demande de reset via Supabase Auth | Client (template `/email-templates/reset-password.html`) |
| ✅ **Confirmation de demande reçue** | Nouvelle ligne dans `demandes` | Client |
| 🔔 **Nouvelle demande reçue** | Nouvelle ligne dans `demandes` | Admin (`support@methodadmin.com`) |
| 📊 **Mise à jour du statut** | UPDATE `demandes.statut` | Client |
| 💬 **Nouveau message** | Nouvelle ligne dans `messages` | Client ou Admin (selon expéditeur) |
| 📎 **Documents demandés** | Appel manuel `SELECT envoyer_demande_documents(...)` | Client |

---

## 🔑 Étape 1 — Créer un compte Resend & obtenir la clé API

1. Crée un compte gratuit sur **https://resend.com** (3 000 emails/mois gratuits)
2. Dashboard → **API Keys** → **Create API Key** → "MethodAdmin production"
3. Copie la clé qui commence par `re_...` — tu en auras besoin à l'étape 3

---

## 🌐 Étape 2 — Vérifier ton domaine `methodadmin.com` dans Resend

C'est **l'étape la plus importante**. Sans cette vérification, tu ne pourras pas envoyer depuis `noreply@methodadmin.com`.

### 2.1 — Ajouter le domaine dans Resend

1. Dashboard Resend → **Domains** → **Add Domain**
2. Saisis : `methodadmin.com`
3. Choisis la région : **EU (Frankfurt)** (recommandé pour RGPD/clients français)
4. Resend t'affiche **3 à 4 enregistrements DNS à ajouter** chez ton registrar (OVH, Gandi, Cloudflare, IONOS…)

### 2.2 — Enregistrements DNS à ajouter

Tu auras à ajouter ce type d'enregistrements (les valeurs exactes te sont données par Resend) :

| Type | Nom (Host) | Valeur (à copier depuis Resend) |
|------|------------|---------------------------------|
| **TXT** (SPF) | `send.methodadmin.com` (ou `@`) | `v=spf1 include:amazonses.com ~all` |
| **TXT** (DKIM) | `resend._domainkey.methodadmin.com` | Long string fournie par Resend (`p=MIGfMA0GC...`) |
| **MX** (optionnel — pour bounce tracking) | `send.methodadmin.com` | `10 feedback-smtp.eu-west-1.amazonses.com` |
| **TXT** (DMARC — recommandé) | `_dmarc.methodadmin.com` | `v=DMARC1; p=none; rua=mailto:dmarc@methodadmin.com` |

### 2.3 — Où ajouter ces DNS ?

Cela dépend de **où est géré ton domaine `methodadmin.com`** :

- **OVH** : Espace client → Domaines → `methodadmin.com` → onglet **Zone DNS** → "Ajouter une entrée"
- **Gandi** : Domaine → onglet **DNS Records** → "Add"
- **Cloudflare** : Sélectionne le domaine → onglet **DNS** → "Add record"
- **IONOS / 1&1** : Domaines → Gérer → DNS → Modifier
- **Google Domains / Squarespace** : DNS → Custom records

> 💡 Une fois les enregistrements ajoutés, retourne sur Resend et clique **"Verify"**. La propagation DNS peut prendre de 5 minutes à 24h (généralement < 1h).

### 2.4 — Confirmation

Quand le domaine est vérifié dans Resend (statut "Verified" en vert), tu pourras envoyer depuis **n'importe quelle adresse `@methodadmin.com`** (`noreply@`, `contact@`, `support@`, etc.).

---

## 📨 Étape 3 — Installer les 2 templates Supabase Auth

Templates **confirmation de compte** et **mot de passe oublié** déjà créés dans `/app/email-templates/`.

👉 Voir [`/app/email-templates/README.md`](../email-templates/README.md) pour les détails.

Dans **Supabase Dashboard → Authentication → Email Templates** :
- **Confirm signup** : colle `confirm-signup.html`
- **Reset Password** : colle `reset-password.html`

Puis dans **Authentication → URL Configuration**, ajoute aux **Redirect URLs** :
- `https://methodadmin.com/espace-client.html`
- `https://methodadmin.com/reset-password.html`

---

## ⚡ Étape 4 — Déployer l'Edge Function `send-email`

### 4.1 — Installer la CLI Supabase (une fois)

```bash
# macOS / Linux
brew install supabase/tap/supabase

# Windows (scoop)
scoop install supabase

# ou via npm
npm install -g supabase
```

### 4.2 — Se connecter et lier le projet

```bash
cd /app
supabase login
supabase link --project-ref sahbhyccnkcqjzxkyzol
```

### 4.3 — Configurer les secrets

```bash
supabase secrets set RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxx
supabase secrets set SENDER_EMAIL=noreply@methodadmin.com
supabase secrets set ADMIN_EMAIL=support@methodadmin.com
supabase secrets set APP_URL=https://methodadmin.com
```

### 4.4 — Déployer

```bash
supabase functions deploy send-email --no-verify-jwt
```

### 4.5 — Test manuel

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

Réponse attendue : `{"ok":true,"id":"..."}`. Vérifie ta boîte mail.

---

## 🗄️ Étape 5 — Installer les triggers SQL

1. **Supabase Dashboard → Database → SQL Editor → New query**
2. Ouvre [`/app/supabase/migrations/email_triggers.sql`](./migrations/email_triggers.sql)
3. **Avant d'exécuter**, remplace dans le `INSERT INTO internal_config` :
   - La valeur `REMPLACE_PAR_TA_SERVICE_ROLE_KEY` par ta vraie **service_role key** (Settings → API)
4. Exécute le script complet
5. Vérifie qu'aucune erreur n'apparaît

> 🔒 La clé `service_role` est stockée dans une table avec **RLS activée et zéro policy** → personne ne peut la lire depuis le client.

---

## 🧪 Étape 6 — Tests de bout en bout

| Test | Comment faire | Email attendu |
|------|---------------|---------------|
| **Confirmation demande** | Soumets le formulaire `index.html` ou `/modification.html` | Email "Demande reçue" au client + "Nouvelle demande" à l'admin |
| **Statut** | Dans `espace-admin.html`, change le statut d'une demande | Email "Mise à jour" au client |
| **Message** | Envoie un message depuis `espace-admin.html` | Email "Nouveau message" au client |
| **Documents** | SQL Editor : `SELECT envoyer_demande_documents(...)` (voir ci-dessous) | Email "Documents demandés" au client |

```sql
-- Test de demande de documents :
SELECT envoyer_demande_documents(
  p_demande_id := '<UUID_de_la_demande>',
  p_documents  := ARRAY[
    'Carte d''identité du gérant',
    'Justificatif de domicile (- 3 mois)',
    'Statuts signés'
  ],
  p_note := 'Merci de nous transmettre ces pièces sous 48h.'
);
```

---

## 📊 Suivi & debug

| Quoi observer | Où |
|---------------|----|
| Liste de tous les emails envoyés (delivered, bounced, opened…) | **Resend Dashboard → Logs** |
| Appels HTTP des triggers Postgres | SQL : `SELECT * FROM net._http_response ORDER BY created DESC LIMIT 20;` |
| Logs / erreurs de l'Edge Function | **Supabase Dashboard → Edge Functions → send-email → Logs** |
| Statut de vérification du domaine | **Resend → Domains → methodadmin.com** |

---

## 🔧 Personnalisations utiles

### Changer l'adresse expéditrice
Une fois ton domaine vérifié, tu peux utiliser n'importe quelle adresse :
```bash
supabase secrets set SENDER_EMAIL=contact@methodadmin.com
```

### Modifier le design d'un template
Édite `/app/supabase/functions/send-email/index.ts` (fonctions `tpl*`) puis redéploie :
```bash
supabase functions deploy send-email --no-verify-jwt
```

### Désactiver temporairement un trigger
```sql
ALTER TABLE demandes DISABLE TRIGGER demande_created_email;
-- réactiver :
ALTER TABLE demandes ENABLE TRIGGER demande_created_email;
```

---

## 📁 Structure des fichiers

```
/app/
├── email-templates/
│   ├── confirm-signup.html       ← Template "Confirm signup" (Supabase Auth)
│   ├── reset-password.html       ← Template "Reset Password" (Supabase Auth)
│   └── README.md
└── supabase/
    ├── functions/send-email/
    │   └── index.ts              ← Edge Function (Deno/TS) — Resend API
    ├── migrations/
    │   └── email_triggers.sql    ← Triggers Postgres automatiques
    └── README.md                 ← Ce fichier
```

---

## ✅ Checklist finale

- [ ] Compte Resend créé + clé API copiée
- [ ] Domaine `methodadmin.com` ajouté dans Resend
- [ ] Enregistrements DNS ajoutés chez le registrar
- [ ] Domaine vérifié (badge "Verified" vert dans Resend)
- [ ] Templates Auth installés dans Supabase
- [ ] Redirect URLs configurées (`https://methodadmin.com/...`)
- [ ] CLI Supabase installée + projet lié
- [ ] Secrets de la fonction Edge configurés
- [ ] Fonction Edge déployée
- [ ] Triggers SQL installés (avec la vraie service_role key)
- [ ] Test de chaque type d'email réussi 🎉
