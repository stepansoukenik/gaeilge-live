// Gaeilge Live — Irish ↔ English Real-Time Translator
// For Meta Ray-Ban Display glasses

(function() {
  "use strict";

  // --- Configuration ---
  const CONFIG = {
    apiEndpoint: "/api/translate",  // Vercel serverless function
    debounceMs: 800,                // Delay before translating after speech pause
    maxDisplayChars: 120,           // Max chars to show on 600px display
  };

  // --- State ---
  let state = {
    direction: "ga-en",   // "ga-en" or "en-ga"
    isListening: false,
    focusIndex: 0,        // Which .focusable button is focused
  };

  // --- DOM Elements ---
  const els = {
    directionLabel: document.getElementById("direction-label"),
    micStatus: document.getElementById("mic-status"),
    sourceContent: document.getElementById("source-content"),
    targetContent: document.getElementById("target-content"),
    sourcePanel: document.getElementById("source-text"),
    targetPanel: document.getElementById("target-text"),
    btnListen: document.getElementById("btn-listen"),
    btnSwap: document.getElementById("btn-swap"),
    btnClear: document.getElementById("btn-clear"),
    langSource: document.getElementById("lang-source"),
    langTarget: document.getElementById("lang-target"),
    langArrow: document.getElementById("lang-arrow"),
    app: document.getElementById("app"),
  };

  const focusables = document.querySelectorAll(".focusable");

  // --- Speech Recognition Setup ---
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  let recognition = null;
  let debounceTimer = null;

  if (SpeechRecognition) {
    recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (event) => {
      let interim = "";
      let final = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          final += transcript;
        } else {
          interim += transcript;
        }
      }

      // Show what we're hearing
      const displayText = final || interim;
      els.sourceContent.textContent = truncate(displayText);

      // Debounce translation (wait for pause in speech)
      if (final) {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => translate(final), CONFIG.debounceMs);
      }
    };

    recognition.onerror = (event) => {
      console.error("Speech error:", event.error);
      if (event.error === "not-allowed") {
        els.sourceContent.textContent = "Mic access denied";
      } else {
        els.sourceContent.textContent = "Error: " + event.error;
      }
      stopListening();
    };

    recognition.onend = () => {
      // Auto-restart if still in listening mode
      if (state.isListening) {
        try { recognition.start(); } catch(e) {}
      }
    };
  }

  // --- Translation API ---
  async function translate(text) {
    if (!text.trim()) return;

    els.app.classList.add("translating");
    els.targetContent.textContent = "…";

    try {
      const [from, to] = state.direction === "ga-en" ? ["ga", "en"] : ["en", "ga"];

      const response = await fetch(CONFIG.apiEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: text.trim(), from, to }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      els.targetContent.textContent = truncate(data.translation || "No translation");
      els.app.classList.remove("translating");

    } catch (err) {
      console.error("Translation error:", err);
      els.targetContent.textContent = "⚠ Translation failed";
      els.app.classList.add("error");
      setTimeout(() => els.app.classList.remove("error"), 2000);
      els.app.classList.remove("translating");
    }
  }

  // --- Actions ---
  function startListening() {
    if (!recognition) {
      els.sourceContent.textContent = "Speech not supported";
      return;
    }

    state.isListening = true;
    els.app.classList.add("listening");
    els.micStatus.textContent = "🎙️ ON";
    els.micStatus.className = "mic-on";
    els.sourceContent.textContent = "Listening…";
    els.btnListen.textContent = "■ Stop";

    // Set recognition language based on source
    recognition.lang = state.direction === "ga-en" ? "ga-IE" : "en-US";

    try {
      recognition.start();
    } catch(e) {
      // Already started
    }
  }

  function stopListening() {
    state.isListening = false;
    els.app.classList.remove("listening");
    els.micStatus.textContent = "🎙️ OFF";
    els.micStatus.className = "mic-off";
    els.btnListen.textContent = "● Listen";

    if (recognition) {
      try { recognition.stop(); } catch(e) {}
    }
  }

  function toggleListening() {
    if (state.isListening) {
      stopListening();
    } else {
      startListening();
    }
  }

  function swapLanguages() {
    stopListening();
    state.direction = state.direction === "ga-en" ? "en-ga" : "ga-en";
    updateDirectionUI();
    els.sourceContent.textContent = "Press ● to start";
    els.targetContent.textContent = "—";
  }

  function clearAll() {
    stopListening();
    els.sourceContent.textContent = "Press ● to start";
    els.targetContent.textContent = "—";
    els.app.classList.remove("error", "translating");
  }

  function updateDirectionUI() {
    if (state.direction === "ga-en") {
      els.directionLabel.textContent = "GA → EN";
      els.langSource.textContent = "🇮🇪 Gaeilge";
      els.langTarget.textContent = "🇬🇧 English";
    } else {
      els.directionLabel.textContent = "EN → GA";
      els.langSource.textContent = "🇬🇧 English";
      els.langTarget.textContent = "🇮🇪 Gaeilge";
    }
  }

  // --- D-pad Navigation ---
  function updateFocus() {
    focusables.forEach((el, i) => {
      el.classList.toggle("active", i === state.focusIndex);
      if (i === state.focusIndex) el.focus();
    });
  }

  function handleKeyDown(event) {
    switch (event.key) {
      case "ArrowLeft":
        event.preventDefault();
        state.focusIndex = Math.max(0, state.focusIndex - 1);
        updateFocus();
        break;

      case "ArrowRight":
        event.preventDefault();
        state.focusIndex = Math.min(focusables.length - 1, state.focusIndex + 1);
        updateFocus();
        break;

      case "ArrowUp":
      case "ArrowDown":
        event.preventDefault();
        // Could be used for scrolling translated text if needed
        break;

      case "Enter":
      case " ":
        event.preventDefault();
        activateFocused();
        break;
    }
  }

  function activateFocused() {
    const btn = focusables[state.focusIndex];
    const action = btn.dataset.action;

    switch (action) {
      case "listen": toggleListening(); break;
      case "swap":   swapLanguages(); break;
      case "clear":  clearAll(); break;
    }
  }

  // --- Utilities ---
  function truncate(text) {
    if (text.length <= CONFIG.maxDisplayChars) return text;
    return text.slice(0, CONFIG.maxDisplayChars) + "…";
  }

  // --- Init ---
  document.addEventListener("keydown", handleKeyDown);
  updateFocus();
  updateDirectionUI();

  // Accessibility: also support touch/click for testing in browser
  focusables.forEach((btn, i) => {
    btn.addEventListener("click", () => {
      state.focusIndex = i;
      updateFocus();
      activateFocused();
    });
  });

})();

