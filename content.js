// Global Variables & State
let settings = {
  autoPopup: false,
  targetLang: "vi",
  engine: "google",
  apiKey: "",
  theme: "light",
  miniMode: false
};

let currentSelection = "";
let popupElement = null;
let triggerButton = null;
let shadowRoot = null;
let isPinned = false;
let isDragging = false;
let dragStartX, dragStartY;
let cardPosX = 0, cardPosY = 0;

// TTS State
let currentUtterance = null;
let currentAudio = null;
let ttsVoice = null;
let ttsRate = 1.0;
let ttsPitch = 1.0;
let ttsVolume = 1.0;
let isSpeaking = false;
let isPaused = false;
let useCloudTTS = true;
let currentTTSText = "";
let currentTTSLang = "";

// Languages metadata
const LANGUAGES = {
  "vi": "Tiếng Việt",
  "en": "English",
  "zh": "中文 (Chinese)",
  "ja": "日本語 (Japanese)",
  "ko": "한국어 (Korean)",
  "fr": "Français (French)",
  "de": "Deutsch (German)",
  "es": "Español (Spanish)",
  "ru": "Русский (Russian)"
};

// Initialize
function init() {
  // Load settings from storage
  chrome.storage.local.get(settings, (items) => {
    settings = { ...settings, ...items };
    setupListeners();
  });
}

// Set up DOM Event Listeners
function setupListeners() {
  document.addEventListener("mouseup", handleMouseUp);
  document.addEventListener("mousedown", handleMouseDown);
  
  // Listen for storage changes to update settings in real time
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local") {
      for (let key in changes) {
        settings[key] = changes[key].newValue;
        if (key === "theme" && popupElement) {
          updateThemeClass();
        }
      }
    }
  });
}

// Handle mouse down (close elements if clicked outside)
function handleMouseDown(e) {
  if (isPinned) return;

  // Check if click was outside our shadow container using composedPath (robust across Shadow DOM boundaries)
  const container = document.getElementById("antigravity-translator-root");
  if (container && e.composedPath().includes(container)) {
    return; // Click inside shadow DOM or on the host
  }

  // Clicked outside, remove elements
  removeTrigger();
  removePopup();
}

// Handle Mouse Up (detect text selection)
function handleMouseUp(e) {
  // Ignore events originating inside the extension Shadow DOM to avoid selection feedback loops
  const container = document.getElementById("antigravity-translator-root");
  if (container && e.composedPath().includes(container)) {
    return;
  }

  // Avoid selection triggers in editable fields or inputs to keep clean UX
  const activeEl = document.activeElement;
  if (activeEl && (activeEl.tagName === "INPUT" || activeEl.tagName === "TEXTAREA" || activeEl.isContentEditable)) {
    return;
  }

  // Small delay to let selection API capture correctly
  setTimeout(() => {
    const selection = window.getSelection();
    const selectedText = selection.toString().trim();

    if (!selectedText || selectedText.length < 2) {
      return;
    }

    currentSelection = selectedText;

    // Get position of selection
    try {
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      
      const x = rect.left + window.scrollX;
      const y = rect.bottom + window.scrollY;

      if (settings.autoPopup) {
        showPopup(x, y);
      } else {
        showTrigger(rect.right + window.scrollX, rect.top + window.scrollY - 30);
      }
    } catch (err) {
      console.error("Error retrieving selection range coordinates: ", err);
    }
  }, 10);
}

// Create and show floating action button
function showTrigger(x, y) {
  removeTrigger();
  if (popupElement) return; // If popup is already visible, do not show trigger

  const root = getShadowRoot();
  
  triggerButton = document.createElement("button");
  triggerButton.className = "translate-trigger";
  triggerButton.style.left = `${x}px`;
  triggerButton.style.top = `${y}px`;
  
  // Icon SVG
  triggerButton.innerHTML = `
    <svg viewBox="0 0 24 24">
      <path d="M12.87 15.07l-2.54-2.51.03-.03c1.74-1.94 2.98-4.17 3.71-6.53H17V4h-7V2H8v2H1v1.99h11.17C11.5 7.92 10.44 9.75 9 11.35 8.07 10.32 7.3 9.19 6.69 8h-2c.73 1.63 1.73 3.17 2.98 4.56l-5.09 5.02L4 19l5-5 3.11 3.11.76-2.04zM18.5 10h-2L12 22h2l1.12-3h4.75L21 22h2l-4.5-12zm-2.62 7l1.62-4.33L19.12 17h-3.24z"/>
    </svg>
  `;

  triggerButton.addEventListener("mousedown", (e) => {
    e.stopPropagation();
    e.preventDefault();
  });

  triggerButton.addEventListener("mouseup", (e) => {
    e.stopPropagation();
    e.preventDefault();
  });

  triggerButton.addEventListener("click", (e) => {
    e.stopPropagation();
    e.preventDefault();
    const triggerRect = triggerButton.getBoundingClientRect();
    showPopup(triggerRect.left + window.scrollX, triggerRect.bottom + window.scrollY + 5);
    removeTrigger();
  });

  root.appendChild(triggerButton);
}

// Remove floating action button
function removeTrigger() {
  if (triggerButton) {
    triggerButton.remove();
    triggerButton = null;
  }
}

// Get or Create Shadow DOM container
function getShadowRoot() {
  let container = document.getElementById("antigravity-translator-root");
  if (!container) {
    container = document.createElement("div");
    container.id = "antigravity-translator-root";
    container.style.position = "absolute";
    container.style.top = "0";
    container.style.left = "0";
    container.style.width = "100%";
    container.style.zIndex = "2147483647";
    document.body.appendChild(container);
    
    shadowRoot = container.attachShadow({ mode: "open" });

    // Link Stylesheet
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = chrome.runtime.getURL("content.css");
    shadowRoot.appendChild(link);
  }
  return shadowRoot;
}

// Create and show the Translate Popup Card
function showPopup(x, y) {
  removePopup();
  stopTTS();
  const root = getShadowRoot();

  // Create Popup Element
  popupElement = document.createElement("div");
  popupElement.className = `translate-card theme-${settings.theme}`;
  if (settings.miniMode) popupElement.classList.add("mini-mode");

  // Keep inside viewport bounds
  const popupWidth = 360;
  const popupHeight = 480;
  if (x + popupWidth > window.innerWidth + window.scrollX) {
    x = window.innerWidth + window.scrollX - popupWidth - 20;
  }
  if (y + popupHeight > window.innerHeight + window.scrollY) {
    y = window.innerHeight + window.scrollY - popupHeight - 20;
  }
  x = Math.max(10, x);
  y = Math.max(10, y);

  cardPosX = x;
  cardPosY = y;
  popupElement.style.left = `${x}px`;
  popupElement.style.top = `${y}px`;

  // Render Inner HTML
  popupElement.innerHTML = `
    <div class="card-header" id="drag-handle">
      <div class="header-title">
        <svg viewBox="0 0 24 24"><path d="M12.87 15.07l-2.54-2.51.03-.03c1.74-1.94 2.98-4.17 3.71-6.53H17V4h-7V2H8v2H1v1.99h11.17C11.5 7.92 10.44 9.75 9 11.35 8.07 10.32 7.3 9.19 6.69 8h-2c.73 1.63 1.73 3.17 2.98 4.56l-5.09 5.02L4 19l5-5 3.11 3.11.76-2.04zM18.5 10h-2L12 22h2l1.12-3h4.75L21 22h2l-4.5-12zm-2.62 7l1.62-4.33L19.12 17h-3.24z" fill="currentColor"/></svg>
        <span>TransTTS</span>
      </div>
      <div class="header-controls">
        <button class="icon-btn" id="btn-theme" title="Đổi giao diện">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
        </button>
        <button class="icon-btn" id="btn-mini" title="Chế độ thu nhỏ">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="9" y1="12" x2="15" y2="12"/></svg>
        </button>
        <button class="icon-btn" id="btn-pin" title="Ghim popup">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
        </button>
        <button class="icon-btn" id="btn-close" title="Đóng">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
    </div>

    <div class="card-body">
      <!-- Original Text Section -->
      <div class="text-section">
        <div class="section-label">
          <span>Văn bản gốc</span>
          <button class="icon-btn" id="tts-original" title="Nghe bản gốc">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
          </button>
        </div>
        <div class="text-box" id="box-original">${escapeHtml(currentSelection)}</div>
      </div>

      <!-- Language Selector -->
      <div class="lang-selector-row">
        <select class="lang-select" id="sel-source" disabled>
          <option value="auto">Tự động nhận diện</option>
        </select>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color: var(--text-muted)"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
        <select class="lang-select" id="sel-target">
          ${Object.entries(LANGUAGES).map(([code, name]) => `<option value="${code}" ${code === settings.targetLang ? "selected" : ""}>${name}</option>`).join("")}
        </select>
      </div>

      <!-- Translated Text Section -->
      <div class="text-section">
        <div class="section-label">
          <span>Bản dịch</span>
          <div style="display:flex; gap:4px;">
            <button class="icon-btn" id="btn-copy" title="Sao chép bản dịch">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
            </button>
            <button class="icon-btn" id="tts-translated" title="Nghe bản dịch">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
            </button>
          </div>
        </div>
        <div class="text-box translation-panel" id="box-translated">Đang dịch...</div>
      </div>

      <!-- TTS Player Section -->
      <div class="tts-player">
        <div class="tts-header">
          <div class="tts-title">Trình phát âm (TTS)</div>
          <div class="waveform-container" id="waveform">
            <div class="wave-bar"></div>
            <div class="wave-bar"></div>
            <div class="wave-bar"></div>
            <div class="wave-bar"></div>
            <div class="wave-bar"></div>
          </div>
        </div>
        
        <div class="tts-controls-row">
          <button class="play-btn" id="tts-play-control" title="Phát âm">
            <svg viewBox="0 0 24 24" id="svg-play-icon"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          </button>
          <button class="icon-btn" id="tts-stop-control" title="Dừng">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="4" width="16" height="16"/></svg>
          </button>
        </div>

        <div class="tts-sliders">
          <div class="slider-group voice-select-group">
            <label class="slider-label"><span>Giọng đọc</span></label>
            <select class="lang-select" id="sel-voice" style="width: 100%;">
              <option value="google-cloud" selected>Google Cloud AI Voice (Khuyên dùng)</option>
              <option value="default">Giọng mặc định hệ thống</option>
            </select>
          </div>
          <div class="slider-group">
            <label class="slider-label"><span>Tốc độ</span><span id="lbl-speed">1.0x</span></label>
            <input type="range" class="slider-input" id="sld-speed" min="0.5" max="2.0" step="0.1" value="1.0">
          </div>
          <div class="slider-group">
            <label class="slider-label"><span>Độ trầm bổng</span><span id="lbl-pitch">1.0</span></label>
            <input type="range" class="slider-input" id="sld-pitch" min="0.5" max="2.0" step="0.1" value="1.0">
          </div>
        </div>
      </div>
    </div>

    <div class="card-footer">
      <span id="lbl-engine">Engine: Google Translate</span>
      <span id="lbl-chars">0 kí tự</span>
    </div>
  `;

  // Attach event handlers
  setupCardEvents();
  
  // Perform Translation
  performTranslation();
  
  // Populate voices for TTS
  populateVoices();
  
  root.appendChild(popupElement);
}

// Remove popup from DOM
function removePopup() {
  if (popupElement) {
    stopTTS();
    popupElement.remove();
    popupElement = null;
    isPinned = false;
  }
}

// Set up event listeners for the translation card elements
function setupCardEvents() {
  // Drag support
  const dragHandle = popupElement.querySelector("#drag-handle");
  dragHandle.addEventListener("mousedown", dragStart);
  
  // Close button
  popupElement.querySelector("#btn-close").addEventListener("click", removePopup);
  
  // Pin button
  const pinBtn = popupElement.querySelector("#btn-pin");
  pinBtn.addEventListener("click", () => {
    isPinned = !isPinned;
    pinBtn.classList.toggle("active", isPinned);
  });

  // Mini mode
  const miniBtn = popupElement.querySelector("#btn-mini");
  miniBtn.addEventListener("click", () => {
    settings.miniMode = !settings.miniMode;
    popupElement.classList.toggle("mini-mode", settings.miniMode);
    miniBtn.classList.toggle("active", settings.miniMode);
    // Save to storage
    chrome.storage.local.set({ miniMode: settings.miniMode });
  });
  if (settings.miniMode) {
    miniBtn.classList.add("active");
  }

  // Theme toggle
  const themeBtn = popupElement.querySelector("#btn-theme");
  themeBtn.addEventListener("click", () => {
    settings.theme = settings.theme === "light" ? "dark" : "light";
    updateThemeClass();
    chrome.storage.local.set({ theme: settings.theme });
  });

  // Target Language dropdown change
  const targetSelect = popupElement.querySelector("#sel-target");
  targetSelect.addEventListener("change", (e) => {
    settings.targetLang = e.target.value;
    chrome.storage.local.set({ targetLang: settings.targetLang });
    performTranslation();
  });

  // Copy button
  const copyBtn = popupElement.querySelector("#btn-copy");
  copyBtn.addEventListener("click", () => {
    const translatedText = popupElement.querySelector("#box-translated").innerText;
    navigator.clipboard.writeText(translatedText).then(() => {
      // Temporary checkmark success animation
      const originalSvg = copyBtn.innerHTML;
      copyBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>`;
      setTimeout(() => copyBtn.innerHTML = originalSvg, 1500);
    });
  });

  // TTS Quick audio triggers
  popupElement.querySelector("#tts-original").addEventListener("click", () => {
    const text = popupElement.querySelector("#box-original").innerText;
    playTTS(text, popupElement.querySelector("#sel-source").value);
  });
  
  popupElement.querySelector("#tts-translated").addEventListener("click", () => {
    const text = popupElement.querySelector("#box-translated").innerText;
    playTTS(text, settings.targetLang);
  });

  // TTS Master Controls
  const playControlBtn = popupElement.querySelector("#tts-play-control");
  playControlBtn.addEventListener("click", () => {
    if (isSpeaking) {
      if (isPaused) {
        resumeTTS();
      } else {
        pauseTTS();
      }
    } else {
      // Default to reading translation
      const text = popupElement.querySelector("#box-translated").innerText;
      playTTS(text, settings.targetLang);
    }
  });

  popupElement.querySelector("#tts-stop-control").addEventListener("click", stopTTS);

  // Sliders adjustments
  const speedSlider = popupElement.querySelector("#sld-speed");
  speedSlider.addEventListener("input", (e) => {
    ttsRate = parseFloat(e.target.value);
    popupElement.querySelector("#lbl-speed").innerText = `${ttsRate.toFixed(1)}x`;
    if (useCloudTTS && currentAudio) {
      currentAudio.playbackRate = ttsRate;
    } else if (isSpeaking) {
      playTTS(currentTTSText, currentTTSLang);
    }
  });

  const pitchSlider = popupElement.querySelector("#sld-pitch");
  pitchSlider.addEventListener("input", (e) => {
    ttsPitch = parseFloat(e.target.value);
    popupElement.querySelector("#lbl-pitch").innerText = ttsPitch.toFixed(1);
    if (isSpeaking && !useCloudTTS) {
      playTTS(currentTTSText, currentTTSLang);
    }
  });

  // Voice selector
  const voiceSelect = popupElement.querySelector("#sel-voice");
  voiceSelect.addEventListener("change", (e) => {
    const val = e.target.value;
    if (val === "google-cloud") {
      useCloudTTS = true;
      ttsVoice = null;
    } else if (val === "default") {
      useCloudTTS = false;
      ttsVoice = null;
    } else {
      useCloudTTS = false;
      const voices = window.speechSynthesis.getVoices();
      ttsVoice = voices.find(v => v.voiceURI === val) || null;
    }
    
    if (isSpeaking) {
      playTTS(currentTTSText, currentTTSLang);
    }
  });
}

// Drag & Drop Mechanics
function dragStart(e) {
  if (e.target.closest(".header-controls")) return; // Don't drag from buttons
  isDragging = true;
  dragStartX = e.clientX - cardPosX;
  dragStartY = e.clientY - cardPosY;
  
  document.addEventListener("mousemove", dragMove);
  document.addEventListener("mouseup", dragEnd);
}

function dragMove(e) {
  if (!isDragging) return;
  cardPosX = e.clientX - dragStartX;
  cardPosY = e.clientY - dragStartY;
  
  popupElement.style.left = `${cardPosX}px`;
  popupElement.style.top = `${cardPosY}px`;
}

function dragEnd() {
  isDragging = false;
  document.removeEventListener("mousemove", dragMove);
  document.removeEventListener("mouseup", dragEnd);
}

// Update UI Theme class
function updateThemeClass() {
  if (!popupElement) return;
  popupElement.className = `translate-card theme-${settings.theme}`;
  if (settings.miniMode) popupElement.classList.add("mini-mode");
}

// Perform translation via Background Service Worker
function performTranslation() {
  const boxTranslated = popupElement.querySelector("#box-translated");
  const lblEngine = popupElement.querySelector("#lbl-engine");
  const lblChars = popupElement.querySelector("#lbl-chars");
  const sourceSelect = popupElement.querySelector("#sel-source");
  
  boxTranslated.innerText = "Đang dịch...";
  lblChars.innerText = `${currentSelection.length} kí tự`;

  chrome.runtime.sendMessage({
    action: "translate",
    text: currentSelection,
    targetLang: settings.targetLang,
    engine: settings.engine,
    apiKey: settings.apiKey
  }, response => {
    if (!popupElement) return; // Guard in case popup was closed during API request

    if (response && response.success) {
      boxTranslated.innerText = response.translation;
      
      // Update engine label
      const engineName = settings.engine === "gemini" ? "Gemini AI" : "Google Translate";
      lblEngine.innerText = `Engine: ${engineName}${response.cached ? " (Cached)" : ""}`;

      // Update source language dropdown
      if (response.sourceLang) {
        sourceSelect.innerHTML = `<option value="${response.sourceLang}">Tự động (${response.sourceLang.toUpperCase()})</option>`;
      }
    } else {
      boxTranslated.innerText = `Lỗi: ${response ? response.error : "Không thể kết nối dịch thuật."}`;
      boxTranslated.style.color = "#ef4444";
    }
  });
}

// TTS API - Web Speech API
function populateVoices() {
  let voices = window.speechSynthesis.getVoices();
  const voiceSelect = popupElement.querySelector("#sel-voice");
  
  const updateList = () => {
    voices = window.speechSynthesis.getVoices();
    voiceSelect.innerHTML = `
      <option value="google-cloud" ${useCloudTTS ? "selected" : ""}>Google Cloud AI Voice (Khuyên dùng)</option>
      <option value="default" ${!useCloudTTS && !ttsVoice ? "selected" : ""}>Giọng mặc định hệ thống</option>
    `;
    
    voices.forEach(voice => {
      const option = document.createElement("option");
      option.value = voice.voiceURI;
      option.innerText = `${voice.name} (${voice.lang})`;
      if (!useCloudTTS && ttsVoice && ttsVoice.voiceURI === voice.voiceURI) {
        option.selected = true;
      }
      voiceSelect.appendChild(option);
    });
  };

  if (voices.length > 0) {
    updateList();
  } else {
    window.speechSynthesis.onvoiceschanged = updateList;
  }
}

function playTTS(text, lang) {
  stopTTS();
  
  if (!text) return;
  
  currentTTSText = text;
  currentTTSLang = lang;

  if (useCloudTTS) {
    toggleWaveformAnimation(true);
    updatePlayPauseButtonIcon("pause");
    isSpeaking = true;
    isPaused = false;

    chrome.runtime.sendMessage({
      action: "tts",
      text: text,
      lang: lang
    }, response => {
      if (!isSpeaking || currentTTSText !== text) return;

      if (response && response.success && response.audioData) {
        currentAudio = new Audio(response.audioData);
        currentAudio.playbackRate = ttsRate;
        currentAudio.volume = ttsVolume;

        currentAudio.addEventListener("play", () => {
          isSpeaking = true;
          isPaused = false;
          toggleWaveformAnimation(true);
          updatePlayPauseButtonIcon("pause");
        });

        currentAudio.addEventListener("pause", () => {
          isPaused = true;
          toggleWaveformAnimation(false);
          updatePlayPauseButtonIcon("play");
        });

        currentAudio.addEventListener("ended", () => {
          isSpeaking = false;
          isPaused = false;
          toggleWaveformAnimation(false);
          updatePlayPauseButtonIcon("play");
          currentAudio = null;
        });

        currentAudio.addEventListener("error", (e) => {
          console.error("Cloud TTS Error, falling back to local system TTS:", e);
          currentAudio = null;
          playLocalTTS(text, lang);
        });

        currentAudio.play().catch(err => {
          console.error("Playback failed, falling back to local TTS:", err);
          currentAudio = null;
          playLocalTTS(text, lang);
        });
      } else {
        console.warn("Cloud TTS failed or was empty, falling back to local TTS.");
        playLocalTTS(text, lang);
      }
    });
  } else {
    playLocalTTS(text, lang);
  }
}

function playLocalTTS(text, lang) {
  currentUtterance = new SpeechSynthesisUtterance(text);
  
  if (ttsVoice) {
    currentUtterance.voice = ttsVoice;
  } else {
    const voices = window.speechSynthesis.getVoices();
    const matchedVoice = voices.find(v => v.lang.toLowerCase().startsWith(lang.toLowerCase())) ||
                         voices.find(v => v.lang.toLowerCase().startsWith("en"));
    if (matchedVoice) {
      currentUtterance.voice = matchedVoice;
    }
  }

  currentUtterance.lang = lang;
  currentUtterance.rate = ttsRate;
  currentUtterance.pitch = ttsPitch;
  currentUtterance.volume = ttsVolume;

  currentUtterance.onstart = () => {
    isSpeaking = true;
    isPaused = false;
    toggleWaveformAnimation(true);
    updatePlayPauseButtonIcon("pause");
  };

  currentUtterance.onend = () => {
    isSpeaking = false;
    isPaused = false;
    toggleWaveformAnimation(false);
    updatePlayPauseButtonIcon("play");
  };

  currentUtterance.onerror = (e) => {
    console.error("TTS SpeechSynthesis Error:", e);
    isSpeaking = false;
    isPaused = false;
    toggleWaveformAnimation(false);
    updatePlayPauseButtonIcon("play");
  };

  currentUtterance.onpause = () => {
    isPaused = true;
    toggleWaveformAnimation(false);
    updatePlayPauseButtonIcon("play");
  };

  currentUtterance.onresume = () => {
    isPaused = false;
    toggleWaveformAnimation(true);
    updatePlayPauseButtonIcon("pause");
  };

  window.speechSynthesis.speak(currentUtterance);
}

function pauseTTS() {
  if (useCloudTTS) {
    if (currentAudio && !currentAudio.paused) {
      currentAudio.pause();
    }
  } else {
    if (isSpeaking && !isPaused) {
      window.speechSynthesis.pause();
    }
  }
}

function resumeTTS() {
  if (useCloudTTS) {
    if (currentAudio && currentAudio.paused) {
      currentAudio.play().catch(console.error);
    }
  } else {
    if (isSpeaking && isPaused) {
      window.speechSynthesis.resume();
    }
  }
}

function stopTTS() {
  if (useCloudTTS) {
    if (currentAudio) {
      currentAudio.pause();
      currentAudio = null;
    }
  } else {
    window.speechSynthesis.cancel();
  }
  isSpeaking = false;
  isPaused = false;
  toggleWaveformAnimation(false);
  updatePlayPauseButtonIcon("play");
}

function toggleWaveformAnimation(animate) {
  if (!popupElement) return;
  const bars = popupElement.querySelectorAll(".wave-bar");
  bars.forEach(bar => {
    if (animate) {
      bar.classList.add("animating");
    } else {
      bar.classList.remove("animating");
    }
  });
}

function updatePlayPauseButtonIcon(state) {
  if (!popupElement) return;
  const playControlBtn = popupElement.querySelector("#tts-play-control");
  if (state === "pause") {
    // Show Pause Icon
    playControlBtn.innerHTML = `<svg viewBox="0 0 24 24" id="svg-play-icon"><rect x="4" y="4" width="4" height="16"/><rect x="16" y="4" width="4" height="16"/></svg>`;
    playControlBtn.title = "Tạm dừng";
  } else {
    // Show Play Icon
    playControlBtn.innerHTML = `<svg viewBox="0 0 24 24" id="svg-play-icon"><polygon points="5 3 19 12 5 21 5 3"/></svg>`;
    playControlBtn.title = "Phát âm";
  }
}

// Utility to escape HTML strings
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

// Launch
init();
