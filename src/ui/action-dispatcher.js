function parseArgs(raw) {
  if (!raw.trim()) return [];
  return raw.match(/'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|true|false|-?\d+(?:\.\d+)?/g)?.map((token) => {
    if (token === 'true') return true;
    if (token === 'false') return false;
    if (/^-?\d/.test(token)) return Number(token);
    return token.slice(1, -1);
  }) || [];
}

function callAction(app, expression, element) {
  const calls = expression.split(';').map((part) => part.trim()).filter(Boolean);
  for (const call of calls) {
    const match = call.match(/^([A-Za-z0-9_]+)\((.*)\)$/);
    if (!match || typeof app[match[1]] !== 'function') continue;
    const args = parseArgs(match[2]).map((arg) => arg === '__VALUE__' ? element.value : arg);
    app[match[1]](...args);
  }
}

export function installActionDispatcher(app) {
  document.addEventListener('click', (event) => {
    const element = event.target.closest('[data-action]');
    if (element) callAction(app, element.dataset.action, element);
  });
  document.addEventListener('change', (event) => {
    const element = event.target.closest('[data-change]');
    if (!element) return;
    const value = element.dataset.changeProp === 'checked' ? element.checked : element.value;
    app[element.dataset.change](value);
  });
  document.querySelectorAll('[data-submit]').forEach((form) => {
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      app[form.dataset.submit](event);
    });
  });
}
