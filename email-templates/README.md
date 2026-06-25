# Templates d'emails Supabase — MethodAdmin

Deux modèles HTML prêts à coller dans le **Dashboard Supabase** :

```
Supabase Dashboard → Authentication → Email Templates
```

---

## 📧 1. Email de confirmation de compte

**Fichier :** `confirm-signup.html`
**Emplacement Supabase :** Templates → **"Confirm signup"**

**Sujet recommandé (Subject heading) :**
```
Confirmez votre compte MethodAdmin ✅
```

**Comment l'installer :**
1. Connectez-vous à votre [Supabase Dashboard](https://supabase.com/dashboard)
2. Sélectionnez votre projet `sahbhyccnkcqjzxkyzol`
3. Allez dans **Authentication → Email Templates**
4. Cliquez sur l'onglet **"Confirm signup"**
5. Dans le champ **Subject heading**, collez le sujet ci-dessus
6. Dans le champ **Message body (HTML)**, **supprimez le contenu existant** et collez l'intégralité du contenu du fichier `confirm-signup.html`
7. Cliquez sur **Save changes**

---

## 🔐 2. Email de mot de passe oublié

**Fichier :** `reset-password.html`
**Emplacement Supabase :** Templates → **"Reset Password"**

**Sujet recommandé :**
```
Réinitialisation de votre mot de passe MethodAdmin 🔐
```

**Comment l'installer :**
1. Dans **Authentication → Email Templates**
2. Cliquez sur l'onglet **"Reset Password"**
3. Collez le sujet et le contenu de `reset-password.html` comme ci-dessus
4. Cliquez sur **Save changes**

---

## 🔧 Variables Supabase utilisées

Ces variables sont **automatiquement remplacées** par Supabase au moment de l'envoi :

| Variable | Description |
|----------|-------------|
| `{{ .ConfirmationURL }}` | URL signée unique pour confirmer / réinitialiser |
| `{{ .Email }}` | Adresse email du destinataire |
| `{{ .Token }}` | Code OTP 6 chiffres (alternative au lien) |
| `{{ .TokenHash }}` | Hash du token |
| `{{ .SiteURL }}` | URL de votre site (configurée dans Settings) |

⚠️ **Important :** Ne modifiez **pas** la syntaxe `{{ .NomVariable }}` — c'est la syntaxe Go template utilisée par Supabase.

---

## 🌐 Configuration de l'URL de redirection

Pour que les liens fonctionnent correctement, vérifiez que vos URLs sont bien configurées dans Supabase :

1. Allez dans **Authentication → URL Configuration**
2. **Site URL** : `https://methodadmin.fr` (ou votre domaine de production)
3. **Redirect URLs** : ajoutez :
   - `https://methodadmin.fr/espace-client.html`
   - `https://methodadmin.fr/reset-password.html`
   - `http://localhost:3000/espace-client.html` (pour le développement)
   - `http://localhost:3000/reset-password.html`

---

## 🎨 Aperçu visuel

Les deux emails partagent une identité visuelle cohérente :
- **Bandeau bleu** (#1a56db) en en-tête avec le logo METHODADMIN
- **Carte blanche** arrondie avec ombre douce
- **Bouton CTA** bleu bien visible
- **Encart contextuel** (jaune pour les astuces, rouge pour les alertes sécurité)
- **Footer dark** (#0f172a) avec rappel branding
- **Responsive mobile** (carte 100% largeur < 600px)

---

## 🧪 Comment tester

Une fois les templates enregistrés dans Supabase :

1. **Test confirmation** : allez sur `login-client.html`, créez un nouveau compte → vous devriez recevoir l'email
2. **Test mot de passe oublié** : sur la page de connexion, cliquez "Mot de passe oublié" → entrez votre email → vous devriez recevoir l'email

💡 **Astuce dev :** dans Supabase, allez dans **Authentication → Users** → cliquez sur un utilisateur → vous pouvez relancer manuellement un email de confirmation pour le tester.
