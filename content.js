// Estrae la trascrizione dal pannello di YouTube (non dall'API timedtext,
// che richiede firme di sessione poco affidabili da fuori pagina).

const TRANSCRIPT_KEYWORDS = [
  "transcript", // en
  "trascrizion", // it
  "transcripc", // es
  "transcription", // fr
  "transkript", // de
  "transcrição", // pt
];

function findTranscriptButton() {
  // Selettore stabile e indipendente dalla lingua: YouTube usa sempre questo
  // tag per la sezione trascrizione sotto la descrizione del video.
  const stable = document.querySelector(
    "ytd-video-description-transcript-section-renderer button"
  );
  if (stable) return stable;

  // Fallback basato sul testo, nel caso YouTube cambi la struttura del DOM.
  const buttons = document.querySelectorAll("button");
  return [...buttons].find((b) => {
    const label = (b.getAttribute("aria-label") || b.textContent || "").toLowerCase();
    return TRANSCRIPT_KEYWORDS.some((kw) => label.includes(kw));
  });
}

function querySegments() {
  return document.querySelectorAll(
    "transcript-segment-view-model, ytd-transcript-segment-renderer"
  );
}

async function ensureTranscriptPanelOpen() {
  if (querySegments().length > 0) return true;

  const btn = findTranscriptButton();
  if (!btn) return false;
  btn.click();

  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 300));
    if (querySegments().length > 0) return true;
  }
  return false;
}

function extractSegments() {
  return [...querySegments()]
    .map((node) => {
      const timeEl = node.querySelector(
        ".ytwTranscriptSegmentViewModelTimestamp, .segment-timestamp"
      );
      const textEl = node.querySelector(
        ".ytAttributedStringHost, .segment-text, yt-formatted-string"
      );
      const time = timeEl ? timeEl.textContent.trim() : "";
      const text = textEl ? textEl.textContent.trim() : node.textContent.trim();
      return { time, text };
    })
    .filter((s) => s.text);
}

function getVideoMeta() {
  const title =
    document
      .querySelector("h1.ytd-watch-metadata yt-formatted-string, h1 yt-formatted-string")
      ?.textContent.trim() || document.title.replace(/ - YouTube$/, "");
  const channel =
    document.querySelector("ytd-channel-name a, #channel-name a")?.textContent.trim() || "";
  const url = location.href.split("&")[0];
  return { title, channel, url };
}

async function getTranscript() {
  const opened = await ensureTranscriptPanelOpen();
  if (!opened) return { error: "no-transcript" };

  const segments = extractSegments();
  if (segments.length === 0) return { error: "empty" };

  return { ...getVideoMeta(), segments };
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === "GET_TRANSCRIPT") {
    getTranscript().then(sendResponse);
    return true; // risposta asincrona
  }
});
