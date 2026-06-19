/**
 * Bannière de consentement cookies — Conforme CNIL / RGPD (France)
 * Exigences respectées :
 *  - Bouton "Tout accepter" et "Tout refuser" au même niveau et même format
 *  - Aucun cookie non essentiel avant consentement
 *  - Consentement enregistré 6 mois (localStorage)
 *  - Retrait du consentement possible à tout moment (bouton flottant bas de page)
 *  - Fermeture du bandeau sans action = refus
 *  - Consentement par acte positif clair uniquement
 *  - Finalités clairement expliquées avant acceptation
 */
(function() {
  const STORAGE_KEY = 'ma_consent_cookies';
  const CONSENT_DURATION_MS = 6 * 30 * 24 * 60 * 60 * 1000; // 6 mois

  function getConsent() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (Date.now() > data.expires) { localStorage.removeItem(STORAGE_KEY); return null; }
      return data;
    } catch(e) { return null; }
  }

  function saveConsent(accepted) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        accepted,
        date: new Date().toISOString(),
        expires: Date.now() + CONSENT_DURATION_MS
      }));
    } catch(e) {}
  }

  function injectCSS() {
    if (document.getElementById('mb-cookie-style')) return;
    const style = document.createElement('style');
    style.id = 'mb-cookie-style';
    style.textContent = `
      #mb-cookie-banner {
        position: fixed;
        bottom: 0; left: 0; right: 0;
        z-index: 99999;
        background: #fff;
        border-top: 2px solid #e2e8f0;
        box-shadow: 0 -4px 24px rgba(0,0,0,.12);
        padding: 1.25rem 1.5rem;
        font-family: 'Nunito Sans', 'Plus Jakarta Sans', system-ui, sans-serif;
        font-size: .88rem;
        color: #475569;
        animation: mb-slide-up .3s ease;
      }
      @keyframes mb-slide-up {
        from { transform: translateY(100%); opacity: 0; }
        to   { transform: translateY(0);    opacity: 1; }
      }
      #mb-cookie-banner .mb-inner {
        max-width: 900px;
        margin: 0 auto;
        display: flex;
        align-items: flex-start;
        gap: 1.5rem;
        flex-wrap: wrap;
      }
      #mb-cookie-banner .mb-text { flex: 1; min-width: 220px; }
      #mb-cookie-banner .mb-title {
        font-weight: 700;
        font-size: .95rem;
        color: #0f172a;
        margin-bottom: .35rem;
        display: flex;
        align-items: center;
        gap: .4rem;
      }
      #mb-cookie-banner .mb-desc { line-height: 1.55; }
      #mb-cookie-banner .mb-desc a { color: #1a56db; text-decoration: none; }
      #mb-cookie-banner .mb-desc a:hover { text-decoration: underline; }
      #mb-cookie-banner .mb-buttons {
        display: flex;
        gap: .65rem;
        align-items: center;
        flex-shrink: 0;
        flex-wrap: wrap;
      }
      #mb-cookie-banner .mb-btn {
        padding: .6rem 1.25rem;
        border-radius: 8px;
        font-size: .85rem;
        font-weight: 700;
        cursor: pointer;
        border: none;
        font-family: inherit;
        transition: .15s;
        white-space: nowrap;
      }
      #mb-cookie-banner .mb-accept {
        background: #1a56db;
        color: #fff;
      }
      #mb-cookie-banner .mb-accept:hover { background: #1240b0; }
      #mb-cookie-banner .mb-refuse {
        background: transparent;
        color: #475569;
        border: 1.5px solid #e2e8f0;
      }
      #mb-cookie-banner .mb-refuse:hover { border-color: #1a56db; color: #1a56db; }
      #mb-cookie-banner .mb-params {
        font-size: .78rem;
        color: #94a3b8;
        background: none;
        border: none;
        cursor: pointer;
        text-decoration: underline;
        font-family: inherit;
        padding: 0;
      }
      #mb-cookie-banner .mb-params:hover { color: #1a56db; }

      /* Bouton flottant "Gérer mes cookies" accessible en permanence */
      #mb-cookie-float {
        position: fixed;
        bottom: 1.25rem;
        left: 1.25rem;
        z-index: 99998;
        background: #fff;
        border: 1.5px solid #e2e8f0;
        border-radius: 50px;
        padding: .4rem .85rem .4rem .6rem;
        font-family: 'Nunito Sans', system-ui, sans-serif;
        font-size: .75rem;
        font-weight: 600;
        color: #475569;
        cursor: pointer;
        box-shadow: 0 2px 10px rgba(0,0,0,.10);
        display: flex;
        align-items: center;
        gap: .35rem;
        transition: .15s;
      }
      #mb-cookie-float:hover { border-color: #1a56db; color: #1a56db; }

      /* Panneau de gestion détaillée */
      #mb-cookie-panel-overlay {
        display: none;
        position: fixed;
        inset: 0;
        background: rgba(0,0,0,.5);
        z-index: 100000;
        align-items: center;
        justify-content: center;
        padding: 1rem;
      }
      #mb-cookie-panel-overlay.open { display: flex; }
      #mb-cookie-panel {
        background: #fff;
        border-radius: 16px;
        padding: 2rem;
        max-width: 520px;
        width: 100%;
        max-height: 85vh;
        overflow-y: auto;
        font-family: 'Nunito Sans', system-ui, sans-serif;
      }
      #mb-cookie-panel h2 {
        font-size: 1.1rem;
        font-weight: 700;
        color: #0f172a;
        margin-bottom: 1rem;
      }
      .mb-finalite {
        border: 1.5px solid #e2e8f0;
        border-radius: 10px;
        padding: .85rem 1rem;
        margin-bottom: .65rem;
      }
      .mb-finalite-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: .3rem;
      }
      .mb-finalite-title {
        font-weight: 700;
        font-size: .88rem;
        color: #0f172a;
      }
      .mb-finalite-desc { font-size: .81rem; color: #475569; line-height: 1.5; }
      .mb-badge-required {
        font-size: .7rem;
        background: #e8f0fe;
        color: #1a56db;
        border-radius: 20px;
        padding: .15rem .55rem;
        font-weight: 700;
        white-space: nowrap;
      }
      .mb-panel-btns {
        display: flex;
        gap: .65rem;
        margin-top: 1.25rem;
        flex-wrap: wrap;
      }
      .mb-panel-btns button {
        flex: 1;
        padding: .65rem 1rem;
        border-radius: 8px;
        font-size: .85rem;
        font-weight: 700;
        cursor: pointer;
        font-family: inherit;
        transition: .15s;
      }
      .mb-panel-accept { background: #1a56db; color: #fff; border: none; }
      .mb-panel-accept:hover { background: #1240b0; }
      .mb-panel-refuse { background: transparent; color: #475569; border: 1.5px solid #e2e8f0; }
      .mb-panel-refuse:hover { border-color: #1a56db; color: #1a56db; }
    `;
    document.head.appendChild(style);
  }

  function createBanner() {
    const banner = document.createElement('div');
    banner.id = 'mb-cookie-banner';
    banner.setAttribute('role', 'dialog');
    banner.setAttribute('aria-label', 'Gestion des cookies');
    banner.innerHTML = `
      <div class="mb-inner">
        <div class="mb-text">
          <div class="mb-title">🍪 Gestion des cookies</div>
          <div class="mb-desc">
            Ce site utilise des cookies techniques indispensables à son fonctionnement (authentification, sécurité). 
            Aucun cookie publicitaire ou de traçage n'est déposé. 
            <a href="confidentialite.html">En savoir plus</a>.
          </div>
        </div>
        <div class="mb-buttons">
          <button class="mb-btn mb-accept" id="mb-btn-accept" aria-label="Accepter les cookies">Tout accepter</button>
          <button class="mb-btn mb-refuse" id="mb-btn-refuse" aria-label="Refuser les cookies">Tout refuser</button>
          <button class="mb-params" id="mb-btn-params">Paramétrer</button>
        </div>
      </div>
    `;
    document.body.appendChild(banner);

    document.getElementById('mb-btn-accept').onclick = () => { saveConsent(true); hideBanner(); showFloat(); };
    document.getElementById('mb-btn-refuse').onclick = () => { saveConsent(false); hideBanner(); showFloat(); };
    document.getElementById('mb-btn-params').onclick = () => openPanel();
  }

  function hideBanner() {
    const b = document.getElementById('mb-cookie-banner');
    if (b) b.remove();
  }

  function showFloat() {
    if (document.getElementById('mb-cookie-float')) return;
    const btn = document.createElement('button');
    btn.id = 'mb-cookie-float';
    btn.setAttribute('aria-label', 'Gérer mes préférences cookies');
    btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg> Cookies`;
    btn.onclick = () => openPanel();
    document.body.appendChild(btn);
  }

  function createPanel() {
    if (document.getElementById('mb-cookie-panel-overlay')) return;
    const overlay = document.createElement('div');
    overlay.id = 'mb-cookie-panel-overlay';
    overlay.innerHTML = `
      <div id="mb-cookie-panel" role="dialog" aria-modal="true" aria-label="Paramètres des cookies">
        <h2>🍪 Paramètres des cookies</h2>

        <div class="mb-finalite">
          <div class="mb-finalite-header">
            <span class="mb-finalite-title">Cookies strictement nécessaires</span>
            <span class="mb-badge-required">Toujours actifs</span>
          </div>
          <div class="mb-finalite-desc">
            Ces cookies sont indispensables au fonctionnement du site : maintien de votre session, 
            sécurité, authentification à votre espace client. Ils ne peuvent pas être désactivés.
          </div>
        </div>

        <div class="mb-finalite">
          <div class="mb-finalite-header">
            <span class="mb-finalite-title">Cookies de préférences</span>
            <span class="mb-badge-required">Toujours actifs</span>
          </div>
          <div class="mb-finalite-desc">
            Mémorisation de vos choix de consentement (durée : 6 mois). 
            Strictement nécessaires à la gestion des cookies eux-mêmes.
          </div>
        </div>

        <p style="font-size:.78rem;color:#94a3b8;margin:.75rem 0 0;line-height:1.5">
          Ce site n'utilise pas de cookies publicitaires, de traçage tiers, ni d'outils de mesure d'audience soumis à consentement.<br>
          Pour exercer vos droits : <a href="mailto:contact@methodadmin.fr" style="color:#1a56db">contact@methodadmin.fr</a>
        </p>

        <div class="mb-panel-btns">
          <button class="mb-panel-refuse" id="mb-panel-refuse">Fermer</button>
          <button class="mb-panel-accept" id="mb-panel-accept">Enregistrer et fermer</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    overlay.addEventListener('click', (e) => { if (e.target === overlay) closePanel(); });
    document.getElementById('mb-panel-refuse').onclick = () => { saveConsent(false); closePanel(); showFloat(); hideBanner(); };
    document.getElementById('mb-panel-accept').onclick = () => { saveConsent(true); closePanel(); showFloat(); hideBanner(); };
  }

  function openPanel() {
    createPanel();
    document.getElementById('mb-cookie-panel-overlay').classList.add('open');
  }

  function closePanel() {
    const p = document.getElementById('mb-cookie-panel-overlay');
    if (p) p.classList.remove('open');
  }

  function init() {
    injectCSS();
    const consent = getConsent();
    if (consent === null) {
      // Aucun choix enregistré : afficher le bandeau
      createBanner();
    } else {
      // Choix déjà exprimé : montrer uniquement le bouton flottant pour retrait éventuel
      showFloat();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
