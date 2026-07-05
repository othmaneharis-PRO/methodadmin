/* ============================================================
   MethodAdmin — Auto-complétion SIREN via API Recherche d'entreprises
   API officielle (gratuite, sans auth) : recherche-entreprises.api.gouv.fr
   Documentation : https://recherche-entreprises.api.gouv.fr/docs
   ============================================================ */

(function () {
  'use strict';

  // Mapping codes INSEE (nature_juridique) → libellés affichés dans <select>
  // Source officielle : https://www.insee.fr/fr/information/2028129
  const NATURE_TO_FORME = {
    '1000': 'EI (Entreprise Individuelle)',
    '1100': 'Micro-entreprise',
    '5410': 'EURL',
    '5498': 'EURL',
    '5499': 'SARL',
    '5485': 'SARL',
    '5710': 'SAS',
    '5720': 'SASU',
    '5500': 'SA',
    '5505': 'SA',
    '6540': 'SCI',
    '9220': 'Association',
  };

  /**
   * Active l'auto-complétion SIREN sur un formulaire.
   * @param {Object} opts
   * @param {string} opts.sirenSelector - sélecteur de l'input SIREN
   * @param {string} opts.denomSelector - sélecteur de l'input dénomination
   * @param {string} opts.formeSelector - sélecteur du <select> forme juridique
   * @param {string} [opts.adresseSelector] - sélecteur facultatif d'un input adresse
   * @param {string} [opts.cpSelector]      - sélecteur facultatif d'un input code postal
   * @param {string} [opts.villeSelector]   - sélecteur facultatif d'un input ville
   */
  window.activerRechercheSiren = function (opts) {
    const sirenInput = document.querySelector(opts.sirenSelector);
    if (!sirenInput) return;

    // Crée le conteneur de suggestion juste après l'input
    const wrapper = document.createElement('div');
    wrapper.className = 'siren-suggestion';
    wrapper.style.cssText = 'margin-top:.5rem; display:none;';
    sirenInput.parentElement.appendChild(wrapper);

    // Injecte les styles une seule fois
    if (!document.getElementById('siren-lookup-styles')) {
      const st = document.createElement('style');
      st.id = 'siren-lookup-styles';
      st.textContent = `
        .siren-suggestion .siren-loader { display:flex; align-items:center; gap:.5rem; font-size:.82rem; color:#475569; padding:.55rem .85rem; background:#f7f8fc; border:1px dashed #cbd5e1; border-radius:8px; }
        .siren-suggestion .siren-loader::before { content:''; width:14px; height:14px; border:2px solid #e8f0fe; border-top-color:#1a56db; border-radius:50%; animation:spinSiren .8s linear infinite; flex-shrink:0; }
        @keyframes spinSiren { to { transform:rotate(360deg); } }
        .siren-result { background:#eff6ff; border:1.5px solid #93c5fd; border-radius:10px; padding:.85rem 1rem; cursor:pointer; transition:.15s; display:flex; align-items:flex-start; gap:.75rem; }
        .siren-result:hover { background:#dbeafe; border-color:#1a56db; transform:translateY(-1px); box-shadow:0 4px 12px rgba(26,86,219,.15); }
        .siren-result .siren-check { flex-shrink:0; width:34px; height:34px; border-radius:8px; background:#1a56db; color:white; display:flex; align-items:center; justify-content:center; font-size:1.05rem; font-weight:700; }
        .siren-result-body { flex:1; min-width:0; }
        .siren-result-name { font-family:'Plus Jakarta Sans',sans-serif; font-weight:700; font-size:.92rem; color:#0f172a; margin-bottom:.15rem; line-height:1.3; }
        .siren-result-meta { font-size:.77rem; color:#475569; line-height:1.4; }
        .siren-result-cta { font-size:.72rem; font-weight:700; color:#1a56db; margin-top:.35rem; text-transform:uppercase; letter-spacing:.04em; }
        .siren-error { font-size:.82rem; color:#991b1b; background:#fef2f2; border:1px solid #fecaca; border-radius:8px; padding:.55rem .85rem; }
        .siren-applied { background:#d1fae5; border:1px solid #6ee7b7; border-radius:8px; padding:.55rem .85rem; font-size:.82rem; color:#065f46; display:flex; align-items:center; gap:.45rem; }
      `;
      document.head.appendChild(st);
    }

    let debounceTimer = null;
    let currentController = null;

    sirenInput.addEventListener('input', () => {
      // Reset visuel si l'utilisateur modifie le SIREN
      wrapper.style.display = 'none';
      wrapper.innerHTML = '';

      const digits = sirenInput.value.replace(/\D/g, '');
      if (digits.length !== 9) return;

      // Annule la requête précédente
      if (debounceTimer) clearTimeout(debounceTimer);
      if (currentController) currentController.abort();

      debounceTimer = setTimeout(() => rechercheSiren(digits), 300);
    });

    async function rechercheSiren(siren) {
      wrapper.style.display = 'block';
      wrapper.innerHTML = '<div class="siren-loader">Recherche dans la base officielle INSEE/INPI…</div>';

      currentController = new AbortController();
      const url = `https://recherche-entreprises.api.gouv.fr/search?q=${encodeURIComponent(siren)}&page=1&per_page=1`;

      try {
        const r = await fetch(url, { signal: currentController.signal });
        if (!r.ok) throw new Error('HTTP ' + r.status);
        const data = await r.json();

        if (!data.results || data.results.length === 0) {
          wrapper.innerHTML = '<div class="siren-error">⚠️ Aucune entreprise trouvée avec ce SIREN dans la base publique INSEE/INPI. Vérifiez le numéro ou poursuivez votre saisie manuellement.</div>';
          return;
        }

        afficherResultat(data.results[0]);
      } catch (err) {
        if (err.name === 'AbortError') return;
        console.warn('Erreur recherche SIREN:', err);
        wrapper.innerHTML = '<div class="siren-error">⚠️ Impossible de joindre la base SIRENE pour le moment. Renseignez les champs manuellement.</div>';
      }
    }

    function afficherResultat(entreprise) {
      const nom = entreprise.nom_complet || entreprise.nom_raison_sociale || '(Dénomination inconnue)';
      const naturejur = entreprise.nature_juridique;
      const adresse   = (entreprise.siege && entreprise.siege.adresse) || '';
      const activite  = entreprise.activite_principale_libelle || (entreprise.activite_principale ? 'NAF ' + entreprise.activite_principale : '');
      const dateCreation = entreprise.date_creation;
      const etat = entreprise.etat_administratif === 'A' ? 'Active' : (entreprise.etat_administratif === 'C' ? '⚠️ Cessée' : '');

      const metaParts = [];
      if (adresse) metaParts.push('📍 ' + escapeHtml(adresse));
      if (activite) metaParts.push('🏷️ ' + escapeHtml(activite));
      if (dateCreation) metaParts.push('📅 Créée le ' + escapeHtml(dateCreation));
      if (etat) metaParts.push(etat);

      wrapper.innerHTML = `
        <div class="siren-result" tabindex="0" role="button" aria-label="Utiliser ces informations">
          <div class="siren-check">✓</div>
          <div class="siren-result-body">
            <div class="siren-result-name">${escapeHtml(nom)}</div>
            <div class="siren-result-meta">${metaParts.join(' · ')}</div>
            <div class="siren-result-cta">Cliquez pour pré-remplir le formulaire →</div>
          </div>
        </div>`;

      const card = wrapper.querySelector('.siren-result');
      const apply = () => {
        // Dénomination
        if (opts.denomSelector) {
          const dInput = document.querySelector(opts.denomSelector);
          if (dInput) { dInput.value = nom; dInput.dispatchEvent(new Event('input', { bubbles: true })); }
        }
        // Forme juridique : tente un match
        if (opts.formeSelector && naturejur) {
          const sel = document.querySelector(opts.formeSelector);
          const libelle = NATURE_TO_FORME[naturejur];
          if (sel && libelle) {
            for (const opt of sel.options) {
              if (opt.value === libelle || opt.textContent.trim() === libelle) {
                sel.value = opt.value || opt.textContent.trim();
                break;
              }
            }
          }
        }
        // Adresse (facultatif - utilisé seulement si les champs existent)
        if (opts.adresseSelector || opts.cpSelector || opts.villeSelector) {
          const parts = parseAdresse(adresse);
          if (opts.adresseSelector && parts.rue) {
            const el = document.querySelector(opts.adresseSelector);
            if (el) el.value = parts.rue;
          }
          if (opts.cpSelector && parts.cp) {
            const el = document.querySelector(opts.cpSelector);
            if (el) el.value = parts.cp;
          }
          if (opts.villeSelector && parts.ville) {
            const el = document.querySelector(opts.villeSelector);
            if (el) el.value = parts.ville;
          }
        }
        wrapper.innerHTML = '<div class="siren-applied">✅ Informations pré-remplies avec succès. Vérifiez et modifiez si nécessaire.</div>';
      };
      card.addEventListener('click', apply);
      card.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); apply(); } });
    }

    function parseAdresse(adresse) {
      // Format API: "1 RUE EXEMPLE 75001 PARIS"
      const m = adresse.match(/^(.+?)\s+(\d{5})\s+(.+)$/);
      if (m) return { rue: m[1].trim(), cp: m[2], ville: m[3].trim() };
      return { rue: adresse, cp: '', ville: '' };
    }

    function escapeHtml(s) {
      return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }
  };
})();
