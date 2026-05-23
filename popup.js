// Tab Navigation
const tabLinks = document.querySelectorAll(".tab-link");
const tabPanels = document.querySelectorAll(".tab-panel");
const appBody = document.getElementById("app-body");

let settings = {
  autoPopup: false,
  targetLang: "vi",
  engine: "google",
  apiKey: "",
  theme: "light",
  miniMode: false
};

// TTS State in Popup
let synth = window.speechSynthesis;
let currentUtterance = null;
let currentAudio = null;

// Initialize Popup
document.addEventListener("DOMContentLoaded", () => {
  // 1. Tab switches
  tabLinks.forEach(link => {
    link.addEventListener("click", () => {
      const tabId = link.getAttribute("data-tab");
      
      tabLinks.forEach(l => l.classList.remove("active"));
      tabPanels.forEach(p => p.classList.remove("active"));
      
      link.classList.add("active");
      document.getElementById(tabId).classList.add("active");

      if (tabId === "tab-history") {
        renderHistory();
      }
    });
  });

  // 2. Load settings and init fields
  chrome.storage.local.get(settings, (items) => {
    settings = { ...settings, ...items };
    applySettingsToUI();
  });

  // 3. Register Event Listeners
  setupSettingsListeners();
  setupTranslatorListeners();
  setupHistoryListeners();
});

// Apply configuration state to UI elements
function applySettingsToUI() {
  // Theme class
  appBody.className = `theme-${settings.theme}`;
  
  // Settings tab fields
  document.getElementById("chk-auto-popup").checked = settings.autoPopup;
  document.getElementById("sel-engine-settings").value = settings.engine;
  document.getElementById("txt-gemini-key").value = settings.apiKey;
  document.getElementById("chk-mini-mode").checked = settings.miniMode;
  document.getElementById("sel-default-target").value = settings.targetLang;

  // Toggle API key visibility based on engine select
  toggleGeminiKeyVisibility(settings.engine);

  // Setup default translator target dropdown
  document.getElementById("sel-target-lang").value = settings.targetLang;
}

// Watch Settings tab controls
function setupSettingsListeners() {
  // Auto Popup toggle
  document.getElementById("chk-auto-popup").addEventListener("change", (e) => {
    chrome.storage.local.set({ autoPopup: e.target.checked });
  });

  // Mini mode toggle
  document.getElementById("chk-mini-mode").addEventListener("change", (e) => {
    chrome.storage.local.set({ miniMode: e.target.checked });
  });

  // Default target language select
  document.getElementById("sel-default-target").addEventListener("change", (e) => {
    const val = e.target.value;
    chrome.storage.local.set({ targetLang: val });
    document.getElementById("sel-target-lang").value = val;
  });

  // Engine select
  document.getElementById("sel-engine-settings").addEventListener("change", (e) => {
    const val = e.target.value;
    chrome.storage.local.set({ engine: val });
    toggleGeminiKeyVisibility(val);
  });

  // Gemini API key keypress / blur
  const keyInput = document.getElementById("txt-gemini-key");
  const saveKey = () => {
    chrome.storage.local.set({ apiKey: keyInput.value });
  };
  keyInput.addEventListener("blur", saveKey);
  keyInput.addEventListener("change", saveKey);

  // Theme switch button (top header)
  document.getElementById("btn-theme").addEventListener("click", () => {
    const nextTheme = settings.theme === "light" ? "dark" : "light";
    settings.theme = nextTheme;
    appBody.className = `theme-${nextTheme}`;
    chrome.storage.local.set({ theme: nextTheme });
  });
}

function toggleGeminiKeyVisibility(engine) {
  const container = document.getElementById("gemini-key-container");
  if (engine === "gemini") {
    container.style.display = "flex";
  } else {
    container.style.display = "none";
  }
}

// Watch Translator tab actions
function setupTranslatorListeners() {
  const txtInput = document.getElementById("txt-input");
  const btnClear = document.getElementById("btn-clear-input");
  const counter = document.getElementById("char-counter");
  const btnTranslate = document.getElementById("btn-translate-manual");
  const btnSwap = document.getElementById("btn-swap-lang");
  
  // Character counter
  txtInput.addEventListener("input", () => {
    const len = txtInput.value.length;
    counter.innerText = `${len} / 2000`;
  });

  // Clear text
  btnClear.addEventListener("click", () => {
    txtInput.value = "";
    counter.innerText = "0 / 2000";
    document.getElementById("output-wrapper").style.display = "none";
    if (synth) synth.cancel();
    if (currentAudio) {
      currentAudio.pause();
      currentAudio = null;
    }
  });

  // Swap translation direction
  btnSwap.addEventListener("click", () => {
    const sourceSelect = document.getElementById("sel-source-lang");
    const targetSelect = document.getElementById("sel-target-lang");
    
    const srcVal = sourceSelect.value;
    const tgtVal = targetSelect.value;
    
    if (srcVal === "auto") {
      // Cannot swap easily if source is auto, force source to current target and vice-versa
      sourceSelect.value = tgtVal;
      targetSelect.value = "en"; // default target
    } else {
      sourceSelect.value = tgtVal;
      targetSelect.value = srcVal;
    }
  });

  // Handle manual translation click
  btnTranslate.addEventListener("click", () => {
    const text = txtInput.value.trim();
    if (!text) return;

    const sourceLang = document.getElementById("sel-source-lang").value;
    const targetLang = document.getElementById("sel-target-lang").value;
    const outputWrapper = document.getElementById("output-wrapper");
    const txtOutput = document.getElementById("txt-output");
    const engineBadge = document.getElementById("engine-badge");

    txtOutput.innerText = "Đang dịch...";
    outputWrapper.style.display = "block";

    chrome.runtime.sendMessage({
      action: "translate",
      text,
      targetLang,
      engine: settings.engine,
      apiKey: settings.apiKey
    }, response => {
      if (response && response.success) {
        txtOutput.innerText = response.translation;
        engineBadge.innerText = settings.engine === "gemini" ? "Gemini" : "Google";
      } else {
        txtOutput.innerText = `Lỗi: ${response ? response.error : "Không kết nối được dịch thuật."}`;
      }
    });
  });

  // Copy translated text
  document.getElementById("btn-copy-translated").addEventListener("click", () => {
    const txtOutput = document.getElementById("txt-output").innerText;
    navigator.clipboard.writeText(txtOutput).then(() => {
      const copyBtn = document.getElementById("btn-copy-translated");
      const originalSvg = copyBtn.innerHTML;
      copyBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>`;
      setTimeout(() => copyBtn.innerHTML = originalSvg, 1500);
    });
  });

  // TTS playback
  document.getElementById("btn-tts-translated").addEventListener("click", () => {
    const txtOutput = document.getElementById("txt-output").innerText;
    const targetLang = document.getElementById("sel-target-lang").value;
    
    if (!txtOutput || txtOutput === "Đang dịch...") return;

    if (currentAudio) {
      currentAudio.pause();
      currentAudio = null;
      return;
    }
    if (synth.speaking) {
      synth.cancel();
      return;
    }

    chrome.runtime.sendMessage({
      action: "tts",
      text: txtOutput,
      lang: targetLang
    }, response => {
      if (response && response.success && response.audioData) {
        currentAudio = new Audio(response.audioData);
        currentAudio.addEventListener("ended", () => {
          currentAudio = null;
        });
        currentAudio.play().catch(err => {
          console.error("Popup playback failed, falling back to local TTS:", err);
          currentAudio = null;
          playLocalPopupTTS(txtOutput, targetLang);
        });
      } else {
        playLocalPopupTTS(txtOutput, targetLang);
      }
    });
  });

  function playLocalPopupTTS(text, lang) {
    currentUtterance = new SpeechSynthesisUtterance(text);
    currentUtterance.lang = lang;
    
    const voices = synth.getVoices();
    const voice = voices.find(v => v.lang.startsWith(lang));
    if (voice) currentUtterance.voice = voice;
    
    synth.speak(currentUtterance);
  }
}

// Watch History Tab actions
function setupHistoryListeners() {
  const searchInput = document.getElementById("search-history");
  const btnClearAll = document.getElementById("btn-clear-history");

  // Search input filtering
  searchInput.addEventListener("input", () => {
    renderHistory(searchInput.value.trim());
  });

  // Clear all history
  btnClearAll.addEventListener("click", () => {
    if (confirm("Bạn có chắc chắn muốn xóa toàn bộ lịch sử dịch thuật?")) {
      chrome.storage.local.set({ history: [] }, () => {
        renderHistory();
      });
    }
  });
}

// Render history items to list panel
function renderHistory(filterKeyword = "") {
  const container = document.getElementById("history-container");
  
  chrome.storage.local.get({ history: [] }, (result) => {
    let history = result.history;

    if (filterKeyword) {
      history = history.filter(item => 
        item.original.toLowerCase().includes(filterKeyword.toLowerCase()) ||
        item.translated.toLowerCase().includes(filterKeyword.toLowerCase())
      );
    }

    if (history.length === 0) {
      container.innerHTML = `<div class="empty-state">${filterKeyword ? "Không tìm thấy kết quả phù hợp." : "Chưa có lịch sử dịch thuật."}</div>`;
      return;
    }

    container.innerHTML = history.map(item => `
      <div class="history-item" data-id="${item.id}">
        <div class="history-item-header">
          <span>${item.fromLang.toUpperCase()} ➔ ${item.toLang.toUpperCase()} (${item.engine})</span>
          <span>${formatDate(item.timestamp)}</span>
        </div>
        <div class="history-original">${escapeHtml(item.original)}</div>
        <div class="history-translated">${escapeHtml(item.translated)}</div>
        <div class="history-actions">
          <button class="icon-btn btn-copy-history" data-text="${escapeHtml(item.translated)}" title="Sao chép bản dịch">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
          </button>
          <button class="icon-btn btn-delete-history" data-id="${item.id}" title="Xóa dòng này">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      </div>
    `).join("");

    // Attach history item action listeners
    container.querySelectorAll(".btn-copy-history").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const text = btn.getAttribute("data-text");
        navigator.clipboard.writeText(text).then(() => {
          const originalSvg = btn.innerHTML;
          btn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>`;
          setTimeout(() => btn.innerHTML = originalSvg, 1500);
        });
      });
    });

    container.querySelectorAll(".btn-delete-history").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-id");
        deleteHistoryItem(id);
      });
    });
  });
}

// Remove single history log item
function deleteHistoryItem(id) {
  chrome.storage.local.get({ history: [] }, (result) => {
    const updatedHistory = result.history.filter(item => item.id !== id);
    chrome.storage.local.set({ history: updatedHistory }, () => {
      const searchKeyword = document.getElementById("search-history").value.trim();
      renderHistory(searchKeyword);
    });
  });
}

// Helper to format date strings
function formatDate(isoString) {
  const d = new Date(isoString);
  const pad = (n) => n.toString().padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())} ${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
}

// Helper to escape HTML characters
function escapeHtml(text) {
  const map = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}
