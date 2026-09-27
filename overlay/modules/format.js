// overlay/modules/format.js
//
// Small, dependency-free string/date helpers shared by the render
// modules. Kept separate so repoCard.js, statsBar.js etc. don't each
// reinvent the same escaping/date-formatting logic.

const HTML_ESCAPES = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/** Escapes text before it's dropped into innerHTML, to stop a repo
 *  name or AI-generated description from being interpreted as markup. */
export function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (ch) => HTML_ESCAPES[ch]);
}

/** Converts an ISO timestamp into a relative string like "3 days ago". */
export function timeAgo(isoString) {
  const seconds = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
  const units = [
    ['year', 31536000],
    ['month', 2592000],
    ['week', 604800],
    ['day', 86400],
    ['hour', 3600],
    ['minute', 60],
  ];

  for (const [name, secondsInUnit] of units) {
    const count = Math.floor(seconds / secondsInUnit);
    if (count >= 1) return `${count} ${name}${count > 1 ? 's' : ''} ago`;
  }
  return 'just now';
}

/** Trims text to a max length with an ellipsis, never mid-word where avoidable. */
export function truncate(str, maxLength) {
  const text = str ?? '';
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 1).trimEnd() + '…';
}
