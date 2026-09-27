// overlay/modules/render/settingsPanel.js
//
// Renders the settings form as a centered modal (with a backdrop),
// used two ways from overlay.js:
//   - forceOpen: true  -> shown immediately, first run, no dismiss
//     (there's nothing to fall back to until a token is saved)
//   - forceOpen: false -> hidden behind a gear button in the header;
//     dismissible via the × button, clicking the backdrop, or saving

import { saveSettings, clearDescriptionCache } from '../storage.js';
import { escapeHtml } from '../format.js';

const PROVIDER_LABELS = {
  openai: 'OpenAI',
  anthropic: 'Anthropic (Claude)',
  gemini: 'Google Gemini',
};

export function renderSettingsPanel(container, { settings, onSaved, forceOpen }) {
  container.innerHTML = `
    ${forceOpen ? '' : '<button class="settings__toggle" type="button" aria-label="Open settings">⚙</button>'}
    <div class="modal-backdrop ${forceOpen ? 'modal-backdrop--visible' : ''}" data-role="backdrop">
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="settings-heading">
        ${forceOpen ? '' : '<button class="modal__close" type="button" aria-label="Close settings">✕</button>'}
        <h2 id="settings-heading">${forceOpen ? 'Set up the dashboard' : 'Settings'}</h2>
        ${
          forceOpen
            ? `<p class="settings__intro">
                 Both keys stay in this browser only (chrome.storage.local) —
                 never sent anywhere except GitHub and whichever AI provider you pick below.
               </p>`
            : ''
        }

        <form class="settings__form">
          <label>
            GitHub personal access token
            <input
              type="password"
              name="githubToken"
              placeholder="ghp_…"
              value="${escapeHtml(settings.githubToken || '')}"
              required
            />
          </label>
          <p class="settings__hint">
            Needs the <code>repo</code> scope to see private repos.
            Create one at GitHub → Settings → Developer settings → Personal access tokens.
          </p>

          <label>
            AI provider for descriptions
            <select name="aiProvider">
              <option value="">None (skip AI descriptions)</option>
              ${Object.entries(PROVIDER_LABELS)
                .map(
                  ([value, label]) =>
                    `<option value="${value}" ${settings.aiProvider === value ? 'selected' : ''}>${label}</option>`
                )
                .join('')}
            </select>
          </label>

          ${Object.entries(PROVIDER_LABELS)
            .map(
              ([value, label]) => `
                <label class="settings__provider-key" data-provider="${value}" ${
                settings.aiProvider === value ? '' : 'hidden'
              }>
                  ${label} API key
                  <input type="password" name="key_${value}" value="${escapeHtml(
                settings.aiApiKeys?.[value] || ''
              )}" />
                </label>
              `
            )
            .join('')}

          <div class="settings__actions">
            <button type="submit">Save</button>
            ${forceOpen ? '' : '<button type="button" class="settings__clear-cache">Clear AI cache</button>'}
          </div>
        </form>
      </div>
    </div>
  `;

  wireUpForm(container, settings, onSaved, forceOpen);
}

function wireUpForm(container, settings, onSaved, forceOpen) {
  const backdrop = container.querySelector('[data-role="backdrop"]');
  const toggleButton = container.querySelector('.settings__toggle');
  const closeButton = container.querySelector('.modal__close');
  const form = container.querySelector('.settings__form');
  const providerSelect = form.querySelector('[name="aiProvider"]');

  const openModal = () => backdrop.classList.add('modal-backdrop--visible');
  // First-run has nothing to close back to (no token saved yet), so
  // dismissing is only wired up once forceOpen is false.
  const closeModal = () => backdrop.classList.remove('modal-backdrop--visible');

  toggleButton?.addEventListener('click', openModal);
  closeButton?.addEventListener('click', closeModal);
  backdrop.addEventListener('click', (event) => {
    if (!forceOpen && event.target === backdrop) closeModal();
  });

  // Only show the API-key field for whichever provider is selected.
  providerSelect.addEventListener('change', () => {
    for (const field of form.querySelectorAll('.settings__provider-key')) {
      field.hidden = field.dataset.provider !== providerSelect.value;
    }
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    const aiProvider = formData.get('aiProvider') || '';

    // Keep any previously-saved keys for OTHER providers so switching
    // back and forth doesn't make you re-enter a key you already gave.
    const aiApiKeys = { ...settings.aiApiKeys };
    if (aiProvider) {
      aiApiKeys[aiProvider] = formData.get(`key_${aiProvider}`) || '';
    }

    await saveSettings({
      githubToken: formData.get('githubToken').trim(),
      aiProvider,
      aiApiKeys,
    });

    onSaved();
  });

  container.querySelector('.settings__clear-cache')?.addEventListener('click', async () => {
    await clearDescriptionCache();
    alert('AI description cache cleared — descriptions will regenerate on next load.');
  });
}
