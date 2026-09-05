// Legge un prompt in sospeso salvato dal popup (chrome.storage.local) e lo
// inserisce nell'editor della chat di Claude non appena è pronto.

const STORAGE_KEY = "pendingClaudePrompt";

function findComposer() {
  return document.querySelector('[data-testid="chat-input"]');
}

function insertPrompt(el, text) {
  el.focus();
  document.execCommand("selectAll", false);
  document.execCommand("insertText", false, text);
}

async function waitForComposerAndInsert(text) {
  for (let i = 0; i < 40; i++) {
    const el = findComposer();
    if (el) {
      insertPrompt(el, text);
      return true;
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  return false;
}

(async () => {
  const stored = await chrome.storage.local.get(STORAGE_KEY);
  const text = stored[STORAGE_KEY];
  if (!text) return;

  // Consuma subito la chiave: evita di reinserire il testo se l'utente
  // ricarica la pagina o naviga altrove dentro claude.ai.
  await chrome.storage.local.remove(STORAGE_KEY);
  await waitForComposerAndInsert(text);
})();
