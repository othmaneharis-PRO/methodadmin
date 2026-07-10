/* ============================================================
   MethodAdmin — Sélection de pack via URL ?pack=xxx
   • Lit le pack sélectionné dans l'URL (venant de services.html)
   • Affiche un bandeau info en haut de la page
   • Expose window.packSelectionne = { id, label, prix }
   • Permet d'inclure le pack dans la description envoyée à Supabase
   ============================================================ */
(function () {
  'use strict';

  const CATALOG = {
    // Création
    'creation-micro-standard': { label: 'Pack Standard Création Micro-Entreprise',   prix: 49,  categorie: 'creation' },
    'creation-ei-standard':    { label: 'Pack Standard Création Entreprise Individuelle', prix: 59,  categorie: 'creation' },
    'creation-micro-express':  { label: 'Pack Création Micro-Entreprise Express',    prix: 59,  categorie: 'creation' },
    'creation-ei-express':     { label: 'Pack Création Entreprise Individuelle Express', prix: 69,  categorie: 'creation' },
    // Cessation
    'cessation-micro-standard': { label: 'Pack Standard Cessation Micro-Entreprise', prix: 59, categorie: 'fermeture' },
    'cessation-ei-standard':    { label: 'Pack Standard Cessation d\'Entreprise Individuelle', prix: 69, categorie: 'fermeture' },
    'cessation-micro-express':  { label: 'Pack Cessation Micro-Entreprise Express',  prix: 59, categorie: 'fermeture' },
    'cessation-ei-express':     { label: 'Pack Cessation Entreprise Individuelle Express', prix: 69, categorie: 'fermeture' },
    // Modification
    'modification-express':     { label: 'Pack Modification Express', prix: 100, categorie: 'modification' },
    // Kbis
    'kbis':                     { label: 'Extrait Kbis / Extrait K', prix: 9, categorie: 'kbis' },
  };

  function readPackFromURL() {
    const p = new URLSearchParams(window.location.search).get('pack');
    if (!p || !CATALOG[p]) return null;
    return Object.assign({ id: p }, CATALOG[p]);
  }

  function injectBanner(pack) {
    if (!pack) return;
    const style = document.createElement('style');
    style.textContent = `
      .pack-banner { max-width:880px; margin:1.25rem auto 0; padding:1rem 1.25rem; background:linear-gradient(135deg,#e8f0fe 0%, #dbeafe 100%); border:1.5px solid #93c5fd; border-radius:14px; display:flex; align-items:center; gap:1rem; }
      .pack-banner-icon { flex-shrink:0; width:44px; height:44px; border-radius:10px; background:#1a56db; color:#fff; display:flex; align-items:center; justify-content:center; font-size:1.35rem; }
      .pack-banner-body { flex:1; min-width:0; }
      .pack-banner-label { font-size:.72rem; font-weight:700; color:#1240b0; text-transform:uppercase; letter-spacing:.06em; margin-bottom:.2rem; }
      .pack-banner-name { font-family:'Plus Jakarta Sans',sans-serif; font-weight:700; font-size:1.02rem; color:#0f172a; line-height:1.3; }
      .pack-banner-price { font-family:'Plus Jakarta Sans',sans-serif; font-weight:800; font-size:1.35rem; color:#1a56db; flex-shrink:0; padding-left:1rem; border-left:1px solid #93c5fd; }
      .pack-banner-change { font-size:.75rem; color:#1a56db; text-decoration:underline; margin-left:.5rem; }
      @media(max-width:600px){ .pack-banner{margin:1rem;padding:.85rem 1rem;gap:.75rem;} .pack-banner-price{font-size:1.15rem;padding-left:.75rem;} .pack-banner-name{font-size:.92rem;} }
    `;
    document.head.appendChild(style);

    const banner = document.createElement('div');
    banner.className = 'pack-banner';
    banner.innerHTML = `
      <div class="pack-banner-icon">✓</div>
      <div class="pack-banner-body">
        <div class="pack-banner-label">Pack sélectionné</div>
        <div class="pack-banner-name">${escapeHtml(pack.label)} <a href="services.html" class="pack-banner-change">changer</a></div>
      </div>
      <div class="pack-banner-price">${pack.prix} €</div>`;

    // Insère juste après le <header>
    const header = document.querySelector('header');
    if (header && header.parentNode) {
      header.parentNode.insertBefore(banner, header.nextSibling);
    } else {
      document.body.prepend(banner);
    }
  }

  function escapeHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
  }

  // API publique
  const pack = readPackFromURL();
  window.packSelectionne = pack; // null si aucun pack

  /**
   * Retourne la description enrichie avec les infos du pack sélectionné.
   * À utiliser dans le handler submit du formulaire :
   *   description = window.enrichirDescriptionAvecPack(description);
   */
  window.enrichirDescriptionAvecPack = function (description) {
    if (!pack) return description || '';
    const prefix = `📦 Pack sélectionné : ${pack.label} — ${pack.prix} €\n──────────────────────────\n`;
    return prefix + (description || '');
  };

  document.addEventListener('DOMContentLoaded', () => injectBanner(pack));
})();
