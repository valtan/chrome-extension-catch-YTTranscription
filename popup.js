const statusEl = document.getElementById("status");
const titleEl = document.getElementById("title");
const saveBtn = document.getElementById("saveBtn");
const copyBtn = document.getElementById("copyBtn");
const claudeBtn = document.getElementById("claudeBtn");

let currentData = null;

function setStatus(msg) {
  statusEl.textContent = msg;
}

function toMarkdown(data) {
  const lines = [
    `# ${data.title}`,
    "",
    `- Canale: ${data.channel}`,
    `- URL: ${data.url}`,
    `- Estratta il: ${new Date().toLocaleString("it-IT")}`,
    "",
    "## Trascrizione",
    "",
  ];
  for (const seg of data.segments) {
    lines.push(seg.time ? `**[${seg.time}]** ${seg.text}` : seg.text);
  }
  return lines.join("\n");
}

function toPlainTranscript(data) {
  return data.segments.map((s) => s.text).join(" ");
}

function toClipboardText(data) {
  return `Titolo video: ${data.title}\nURL: ${data.url}\n\n${toPlainTranscript(data)}`;
}

async function loadTranscript() {
  setStatus("Estrazione trascrizione in corso...");
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab || !/^https?:\/\/([^/]*\.)?youtube\.com\/watch/.test(tab.url || "")) {
    setStatus("Apri un video YouTube per estrarre la trascrizione.");
    return;
  }

  chrome.tabs.sendMessage(tab.id, { type: "GET_TRANSCRIPT" }, (response) => {
    if (chrome.runtime.lastError) {
      setStatus("Ricarica la pagina YouTube e riprova.");
      return;
    }
    if (!response || response.error) {
      setStatus("Nessuna trascrizione disponibile per questo video.");
      return;
    }
    currentData = response;
    titleEl.textContent = response.title;
    setStatus(`Trascrizione pronta (${response.segments.length} segmenti).`);
    saveBtn.disabled = false;
    copyBtn.disabled = false;
    claudeBtn.disabled = false;
  });
}

saveBtn.addEventListener("click", () => {
  if (!currentData) return;
  const md = toMarkdown(currentData);
  const dataUrl = "data:text/markdown;charset=utf-8," + encodeURIComponent(md);
  const safeName =
    currentData.title.replace(/[\\/:*?"<>|]/g, "").slice(0, 80) || "trascrizione";

  chrome.downloads.download(
    { url: dataUrl, filename: `${safeName}.md`, saveAs: true },
    () => setStatus("Salvataggio avviato.")
  );
});

copyBtn.addEventListener("click", async () => {
  if (!currentData) return;
  try {
    await navigator.clipboard.writeText(toClipboardText(currentData));
    setStatus("Trascrizione copiata negli appunti.");
  } catch (e) {
    setStatus("Impossibile copiare negli appunti.");
  }
});

claudeBtn.addEventListener("click", async () => {
  if (!currentData) return;
  // Testo con lo slash-command in testa: inserito via execCommand
  // (non un vero "incolla" utente) dal content script su claude.ai,
  // che non fa scattare il troncamento visto con il paste manuale.
  const text = `/rielaborazione-trascrizioni\n\n${toClipboardText(currentData)}`;

  // Backup negli appunti nel caso l'inserimento automatico fallisca
  // (es. claude.ai cambia struttura della pagina).
  navigator.clipboard.writeText(toClipboardText(currentData)).catch(() => {});

  await chrome.storage.local.set({ pendingClaudePrompt: text });
  chrome.tabs.create({ url: "https://claude.ai/new" });

  setStatus(
    'Apertura di Claude... il prompt verrà inserito automaticamente. Se non succede, scrivi "/rielaborazione-trascrizioni" e incolla (Ctrl/Cmd+V) la trascrizione già copiata.'
  );
});

loadTranscript();
