// overlay/modules/render/settingsPanel.js
//
// Renders the settings form as a centered modal (with a backdrop).

import { saveSettings, clearDescriptionCache } from '../storage.js';
import { testGithubToken } from '../github-api.js';
import { escapeHtml } from '../format.js';

const PROVIDER_LABELS = {
  gemini: 'Google Gemini (Free tier available)',
  openai: 'OpenAI (GPT-4o mini)',
  anthropic: 'Anthropic (Claude 3.5 Haiku)',
};

export function renderSettingsPanel(container, { settings, onSaved, forceOpen }) {
  container.innerHTML = `
    ${
      forceOpen
        ? ''
        : `<button class="settings__toggle" type="button" aria-label="Open settings" title="Settings">
            <svg class="icon icon-gear" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 0a8.2 8.2 0 0 0-.701.031C7.03.044 6.75.244 6.64.53l-.265.688a.8.8 0 0 1-.95.485l-.717-.2a.8.8 0 0 0-.916.38l-.7 1.212a.8.8 0 0 0 .193.987l.55.51a.8.8 0 0 1 0 1.176l-.55.51a.8.8 0 0 0-.193.987l.7 1.212a.8.8 0 0 0 .916.38l.717-.2a.8.8 0 0 1 .95.485l.265.688c.11.286.39.486.659.499A8.2 8.2 0 0 0 8 16a8.2 8.2 0 0 0 .701-.031c.269-.013.549-.213.659-.499l.265-.688a.8.8 0 0 1 .95-.485l.717.2a.8.8 0 0 0 .916-.38l.7-1.212a.8.8 0 0 0-.193-.987l-.55-.51a.8.8 0 0 1 0-1.176l.55-.51a.8.8 0 0 0 .193-.987l-.7-1.212a.8.8 0 0 0-.916-.38l-.717.2a.8.8 0 0 1-.95-.485l-.265-.688a.8.8 0 0 0-.659-.499A8.2 8.2 0 0 0 8 0Zm0 5.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5Z"/>
            </svg>
            <span>Settings</span>
          </button>`
    }
    <div class="modal-backdrop ${forceOpen ? 'modal-backdrop--visible' : ''}" data-role="backdrop">
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="settings-heading">
        ${forceOpen ? '' : '<button class="modal__close" type="button" aria-label="Close settings" title="Close (Esc)">✕</button>'}
        <div class="modal__header">
          <h2 id="settings-heading">${forceOpen ? 'Connect Your GitHub Account' : 'Settings'}</h2>
          <p class="modal__subtitle">
            ${
              forceOpen
                ? 'Your keys stay in this browser only and are never shared with any third party. Enter your GitHub personal access token to start browsing and analyzing your repositories.'
                : 'Your keys stay in this browser only and are never shared with any third party. The extension has no server — it talks directly to GitHub and your AI provider.'
            }
          </p>
        </div>

        <form class="settings__form">
          <div class="form-group">
            <label for="input-github-token">
              GitHub Personal Access Token <span class="required">*</span>
            </label>
            <div class="input-with-action">
              <input
                id="input-github-token"
                type="password"
                name="githubToken"
                placeholder="ghp_… or github_pat_…"
                value="${escapeHtml(settings.githubToken || '')}"
                required
                autocomplete="off"
                spellcheck="false"
              />
              <button type="button" class="btn-toggle-pw" title="Toggle token visibility" tabindex="-1">
                <svg class="icon-eye" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M8 2c1.981 0 3.67.992 4.933 2.078 1.27 1.091 2.187 2.345 2.637 3.023a1.62 1.62 0 0 1 0 1.798c-.45.678-1.367 1.932-2.637 3.023C11.67 13.008 9.981 14 8 14c-1.981 0-3.67-.992-4.933-2.078C1.797 10.83.88 9.577.43 8.899a1.62 1.62 0 0 1 0-1.798c.45-.678 1.367-1.932 2.637-3.023C4.33 2.992 6.019 2 8 2ZM1.679 7.938c.386.564 1.18 1.637 2.298 2.6C5.074 11.487 6.47 12.5 8 12.5c1.53 0 2.926-1.013 4.023-1.962 1.118-.963 1.912-2.036 2.298-2.6a.12.12 0 0 0 0-.076c-.386-.564-1.18-1.637-2.298-2.6C10.926 4.313 9.53 3.5 8 3.5c-1.53 0-2.926 1.013-4.023 1.962-1.118.963-1.912 2.036-2.298 2.6a.12.12 0 0 0 0 .076ZM8 5.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5Z"/>
                </svg>
              </button>
              <button type="button" class="btn-verify-token" id="btn-verify-token" title="Test this token with GitHub API">
                Test Token
              </button>
            </div>
            <div class="token-feedback" id="token-feedback" hidden></div>
            <p class="settings__hint">
              Requires <code>repo</code> scope to inspect private repos.
              <a href="https://github.com/settings/tokens/new?scopes=repo&description=Repo+Dashboard" target="_blank" rel="noopener" class="link-external">
                Generate token on GitHub ↗
              </a>
            </p>
          </div>

          <div class="form-group">
            <label for="select-ai-provider">
              AI Provider for Repository Summaries (Optional)
            </label>
            <div class="select-wrap">
              <select id="select-ai-provider" name="aiProvider">
                <option value="">None (stats and details only, no AI summaries)</option>
                ${Object.entries(PROVIDER_LABELS)
                  .map(
                    ([value, label]) =>
                      `<option value="${value}" ${settings.aiProvider === value ? 'selected' : ''}>${label}</option>`
                  )
                  .join('')}
              </select>
              <svg class="select-chevron" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                <path d="m4.427 6.427 3.396 3.396a.25.25 0 0 0 .354 0l3.396-3.396A.25.25 0 0 0 11.396 6H4.604a.25.25 0 0 0-.177.427Z"/>
              </svg>
            </div>
            <p class="settings__hint">
              Tip: Google Gemini has a free tier with generous limits — recommended!
            </p>
          </div>

          ${Object.entries(PROVIDER_LABELS)
            .map(
              ([value, label]) => `
                <div class="form-group settings__provider-key" data-provider="${value}" ${
                settings.aiProvider === value ? '' : 'hidden'
              }>
                  <label for="input-key-${value}">${label} API Key</label>
                  <div class="input-with-action">
                    <input
                      id="input-key-${value}"
                      type="password"
                      name="key_${value}"
                      placeholder="API key…"
                      value="${escapeHtml(settings.aiApiKeys?.[value] || '')}"
                      autocomplete="off"
                      spellcheck="false"
                    />
                    <button type="button" class="btn-toggle-pw" title="Toggle visibility" tabindex="-1">
                      <svg class="icon-eye" viewBox="0 0 16 16" fill="currentColor">
                        <path d="M8 2c1.981 0 3.67.992 4.933 2.078 1.27 1.091 2.187 2.345 2.637 3.023a1.62 1.62 0 0 1 0 1.798c-.45.678-1.367 1.932-2.637 3.023C11.67 13.008 9.981 14 8 14c-1.981 0-3.67-.992-4.933-2.078C1.797 10.83.88 9.577.43 8.899a1.62 1.62 0 0 1 0-1.798c.45-.678 1.367-1.932 2.637-3.023C4.33 2.992 6.019 2 8 2ZM1.679 7.938c.386.564 1.18 1.637 2.298 2.6C5.074 11.487 6.47 12.5 8 12.5c1.53 0 2.926-1.013 4.023-1.962 1.118-.963 1.912-2.036 2.298-2.6a.12.12 0 0 0 0-.076c-.386-.564-1.18-1.637-2.298-2.6C10.926 4.313 9.53 3.5 8 3.5c-1.53 0-2.926 1.013-4.023 1.962-1.118.963-1.912 2.036-2.298 2.6a.12.12 0 0 0 0 .076ZM8 5.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5Z"/>
                      </svg>
                    </button>
                  </div>
                </div>
              `
            )
            .join('')}

          <div class="settings__actions">
            <button type="submit" class="btn-primary" id="btn-save-settings">
              ${forceOpen ? 'Connect & Load Dashboard' : 'Save Changes'}
            </button>
            ${
              forceOpen
                ? ''
                : '<button type="button" class="btn-secondary settings__clear-cache" id="btn-clear-cache">Clear AI Cache</button>'
            }
          </div>
          <div class="settings__status" id="settings-status" hidden></div>
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
  const verifyBtn = form.querySelector('#btn-verify-token');
  const tokenInput = form.querySelector('#input-github-token');
  const tokenFeedback = form.querySelector('#token-feedback');
  const statusEl = form.querySelector('#settings-status');

  const openModal = () => {
    backdrop.classList.add('modal-backdrop--visible');
    tokenInput?.focus();
  };
  const closeModal = () => backdrop.classList.remove('modal-backdrop--visible');

  toggleButton?.addEventListener('click', openModal);
  closeButton?.addEventListener('click', closeModal);

  backdrop.addEventListener('click', (event) => {
    if (!forceOpen && event.target === backdrop) closeModal();
  });

  // Password visibility toggle buttons
  container.querySelectorAll('.btn-toggle-pw').forEach((btn) => {
    btn.addEventListener('click', () => {
      const input = btn.previousElementSibling;
      if (!input) return;
      const isPassword = input.type === 'password';
      input.type = isPassword ? 'text' : 'password';
      btn.classList.toggle('is-visible', isPassword);
    });
  });

  // Test token action
  if (verifyBtn) {
    verifyBtn.addEventListener('click', async () => {
      const token = tokenInput.value.trim();
      if (!token) {
        showFeedback(tokenFeedback, 'Please enter a token first.', 'error');
        return;
      }

      verifyBtn.disabled = true;
      verifyBtn.textContent = 'Testing…';

      try {
        const userInfo = await testGithubToken(token);
        showFeedback(
          tokenFeedback,
          `✓ Valid! Authenticated as <strong>${escapeHtml(userInfo.login)}</strong> (${escapeHtml(userInfo.name)})`,
          'success'
        );
      } catch (err) {
        showFeedback(tokenFeedback, `✕ ${escapeHtml(err.message)}`, 'error');
      } finally {
        verifyBtn.disabled = false;
        verifyBtn.textContent = 'Test Token';
      }
    });
  }

  // Provider selector change
  providerSelect.addEventListener('change', () => {
    for (const field of form.querySelectorAll('.settings__provider-key')) {
      field.hidden = field.dataset.provider !== providerSelect.value;
    }
  });

  // Form submit
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    const aiProvider = formData.get('aiProvider') || '';
    const tokenVal = formData.get('githubToken')?.trim() || '';

    const aiApiKeys = { ...settings.aiApiKeys };
    if (aiProvider) {
      aiApiKeys[aiProvider] = formData.get(`key_${aiProvider}`)?.trim() || '';
    }

    const saveBtn = form.querySelector('#btn-save-settings');
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving…';

    await saveSettings({
      githubToken: tokenVal,
      aiProvider,
      aiApiKeys,
    });

    closeModal();
    onSaved();
  });

  // Clear AI cache
  const clearBtn = container.querySelector('#btn-clear-cache');
  if (clearBtn) {
    clearBtn.addEventListener('click', async () => {
      clearBtn.disabled = true;
      clearBtn.textContent = 'Clearing…';
      await clearDescriptionCache();
      showFeedback(statusEl, '✓ AI description cache cleared! Reload to regenerate.', 'success');
      setTimeout(() => {
        clearBtn.disabled = false;
        clearBtn.textContent = 'Clear AI Cache';
      }, 1500);
    });
  }
}

function showFeedback(el, html, type) {
  if (!el) return;
  el.hidden = false;
  el.className = `settings-feedback settings-feedback--${type}`;
  el.innerHTML = html;
}

