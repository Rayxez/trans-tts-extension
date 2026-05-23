// Translation Cache
const translationCache = new Map();

// Helper to get/set cache keys
function getCacheKey(text, targetLang, engine) {
  return `${engine}:${targetLang}:${text.trim().toLowerCase()}`;
}

// Service Worker listener
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "translate") {
    const { text, targetLang, engine, apiKey } = message;

    // Check Cache
    const cacheKey = getCacheKey(text, targetLang, engine);
    if (translationCache.has(cacheKey)) {
      sendResponse({ success: true, translation: translationCache.get(cacheKey), cached: true });
      return true;
    }

    if (engine === "gemini") {
      translateWithGemini(text, targetLang, apiKey)
        .then(translation => {
          translationCache.set(cacheKey, translation);
          // Save to history
          saveToHistory(text, translation, "Auto", targetLang, "Gemini");
          sendResponse({ success: true, translation });
        })
        .catch(err => {
          sendResponse({ success: false, error: err.message });
        });
    } else {
      // Default to Google Translate
      translateWithGoogle(text, targetLang)
        .then(({ translation, sourceLang }) => {
          translationCache.set(cacheKey, translation);
          // Save to history
          saveToHistory(text, translation, sourceLang, targetLang, "Google");
          sendResponse({ success: true, translation, sourceLang });
        })
        .catch(err => {
          sendResponse({ success: false, error: err.message });
        });
    }
    return true; // Keep message channel open for async response
  }

  if (message.action === "tts") {
    const { text, lang } = message;
    fetchGoogleTTS(text, lang)
      .then(base64Audio => {
        sendResponse({ success: true, audioData: base64Audio });
      })
      .catch(err => {
        sendResponse({ success: false, error: err.message });
      });
    return true; // Keep message channel open for async response
  }
});

// Fetch Google TTS and convert to base64 data URL
async function fetchGoogleTTS(text, lang) {
  const url = `https://translate.google.com/translate_tts?ie=UTF-8&tl=${encodeURIComponent(lang)}&client=tw-ob&q=${encodeURIComponent(text)}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Google TTS API returned status ${response.status}`);
  }
  
  const arrayBuffer = await response.arrayBuffer();
  
  // Convert ArrayBuffer to Base64 in Service Worker
  let binary = "";
  const bytes = new Uint8Array(arrayBuffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 = btoa(binary);
  return `data:audio/mp3;base64,${base64}`;
}

// Google Translate API
async function translateWithGoogle(text, targetLang) {
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Google Translate API returned status ${response.status}`);
  }
  const data = await response.json();
  
  // Extract translations
  let translation = "";
  if (data[0]) {
    for (let i = 0; i < data[0].length; i++) {
      if (data[0][i][0]) {
        translation += data[0][i][0];
      }
    }
  }
  
  const sourceLang = data[2] || "Auto";
  return { translation, sourceLang };
}

// Gemini Translate API
async function translateWithGemini(text, targetLang, apiKey) {
  if (!apiKey) {
    throw new Error("Gemini API key is required but not configured.");
  }
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
  
  const prompt = `Translate the following text to the language '${targetLang}'. Detect the source language automatically. Provide only the direct translation. Do not wrap the response in code blocks, do not explain the translation, and do not add any extra text or conversational filler.
Text to translate:
${text}`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      contents: [{
        parts: [{ text: prompt }]
      }]
    })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const errMsg = errorData.error?.message || `Gemini API returned status ${response.status}`;
    throw new Error(errMsg);
  }

  const data = await response.json();
  const translation = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!translation) {
    throw new Error("Could not extract translation from Gemini response.");
  }
  return translation.trim();
}

// Helper to save translation to history in chrome.storage
function saveToHistory(original, translated, fromLang, toLang, engine) {
  chrome.storage.local.get({ history: [] }, (result) => {
    let history = result.history;
    
    // Check if duplicate already exists in the last 10 entries to avoid spamming
    const isDuplicate = history.slice(0, 10).some(item => 
      item.original.trim().toLowerCase() === original.trim().toLowerCase() && 
      item.toLang === toLang
    );
    
    if (isDuplicate) return;

    const newItem = {
      id: Date.now().toString(),
      original: original.trim(),
      translated: translated.trim(),
      fromLang,
      toLang,
      engine,
      timestamp: new Date().toISOString()
    };

    history.unshift(newItem);
    // Limit history to 100 entries
    if (history.length > 100) {
      history = history.slice(0, 100);
    }
    chrome.storage.local.set({ history });
  });
}
