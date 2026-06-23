# MethodAdmin — PRD

## Problème initial
SaaS français de formalités d'entreprise (création, modification, fermeture, Kbis). L'utilisateur a demandé de retravailler la page d'accueil en ajoutant des photos et la barre de menu, tout en conservant les couleurs existantes.

## Stack
- Site statique HTML/CSS/JS (Vercel deployment)
- Supabase pour soumission des demandes (RPC `soumettre_demande`)
- Couleurs : Bleu `#1a56db`, Dark `#0f172a`, Light bg `#f7f8fc`

## Réalisé (2026-06-23)
- **Nouvelle barre de menu** (sticky, max-width 1200px) avec :
  - Logo avec "logo mark" carré bleu
  - Liens : Accueil (actif), Services, Création, FAQ, Contact
  - CTA double : Connexion + Mon espace
  - Menu hamburger mobile fonctionnel
- **Hero retravaillé** : portrait entrepreneure + image secondaire (documents) + carte stat "48h pour votre Kbis" + badge trust (5 étoiles, 4 avatars, "+1 200 entrepreneurs")
- **Strip partenaires** : INPI, Greffe, URSSAF, Infogreffe, JAL, BODACC
- **Section "Comment ça marche"** : photo équipe à gauche + 4 étapes à droite (mise en page horizontale)
- **Services cards** : chaque carte a maintenant une image en haut
- **Form CTA** : photo de poignée de main à côté du formulaire
- **Testimonial** : portrait Sophie M. + guillemet bleu + citation élégante
- **CSP mis à jour** dans `vercel.json` pour autoriser `images.unsplash.com`

## Backlog
- Ajouter une vraie galerie clients / case studies
- Optimiser les images (formats AVIF/WebP, srcset responsive)
- Ajouter une section "Tarifs" / pricing détaillée
- Animation au scroll (intersection observer)

## Suggestion d'amélioration
Pour augmenter la conversion : ajouter un mini-chiffre dynamique "X entreprises créées ce mois-ci" en haut du hero — c'est un puissant déclencheur de preuve sociale en temps réel.
