// overlay/modules/render/settingsPanel.js
//
// Renders the settings form: GitHub token + AI provider dropdown +
// one API-key field per provider (only the active one is shown).
// Used two ways from overlay.js:
//   - forceOpen: true  -> full-screen first-run setup (no data yet)
//   - forceOpen: false -> collapsed panel behind a gear button

import { saveSettings, clearDescriptionCache } from '../storage.js';
import { escapeHtml } from '../format.js';

const PROVIDER_LABELS = {
  openai: 'OpenAI',
  anthropic: 'Anthropic (Claude)',
  gemini: 'Google Gemini',
};

export function renderSettingsPanel(container, { settings, onSaved, forceOpen }) {
  container.innerHTML = `
    <div class="${forceOpen ? 'settings settings--first-run' : 'settings settings--collapsed'}">
      ${
        forceOpen
          ? `<h2>Set up the dashboard</h2>
             <p class="settings__intro">
               Both keys stay in this browser only (chrome.storage.local) —
               never sent anywhere except GitHub and whichever AI provider you pick below.
             </p>`
          : '<button class="settings__toggle" type="button">⚙ Settings</button>'
      }

      <form class="settings__form" ${forceOpen ? '' : 'hidden'}>
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
  `;

  wireUpForm(container, settings, onSaved);
}

function wireUpForm(container, settings, onSaved) {
  const form = container.querySelector('.settings__form');
  const toggleButton = container.querySelector('.settings__toggle');
  const providerSelect = form.querySelector('[name="aiProvider"]');

  // Collapsed mode: gear button reveals/hides the form.
  toggleButton?.addEventListener('click', () => {
    form.hidden = !form.hidden;
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
