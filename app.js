// Gaeilge Live — Phone ↔ Glasses Bridge
// Phone: captures speech, translates, pushes to session
// Glasses: polls session, displays translation on HUD

(function() {
  "use strict";

  const CONFIG = {
    translateEndpoint: "/api/translate",
    sessionEndpoint: "/api/session",
    pollIntervalMs: 1500,
    maxDisplayChars: 120,
  };

  let state = {
    mode: null,        // "phone" or "glasses"
    sessionId: null,
    direction: "ga-en",
    isListening: false,
    focusIndex: 0,
    lastTimestamp: 0,
    pollTimer: null,
  };

  // --- Generate 4-digit session code ---
  function generateSessionId() {
    return String(Math.floor(1000 + Math.random() * 9000));
  }

  // --- Mode Selection ---
  const modeSelect = document.getElementById("mode-select");
  const phoneMode = document.getElementById("phone-mode");
  const glassesMode = document.getElementById("glasses-mode");
  const modeBtns = modeSelect.querySelectorAll(".mode-btn");
  let modeFocusIndex = 0;

  function selectMode(mode) {
    state.mode = mode;
    state.sessionId = generateSessionId();
    modeSelect.classList.add("hidden");

    if (mode === "phone") {
      phoneMode.classList.remove("hidden");
      document.getElementById("session-code-display").textContent = state.sessionId;
      initPhone();
    } else {
      glassesMode.classList.remove("hidden");
      // Prompt for session code (use same as phone shows)
      const code = prompt("Enter 4-digit code from phone:");
      if (code && code.length === 4) {
        state.sessionId = code;
      }
      document.getElementById("glasses-session").textContent = state.sessionId;
      initGlasses();
    }
  }

  // Mode selector D-pad navigation
  document.addEventListener("keydown", (event) => {
    if (state.mode === null) {
      // Mode selection screen
      if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
        modeFocusIndex = 0;
        updateModeFocus();
      } else if (event.key === "ArrowDown" || event.key === "ArrowRight") {
        modeFocusIndex = 1;
        updateModeFocus();
      } else if (event.key === "Enter" || event.key === " ") {
        selectMode(modeFocusIndex === 0 ? "phone" : "glasses");
      }
    } else if (state.mode === "phone") {
      handlePhoneKeydown(event);
    }
  });

  function updateModeFocus() {
    modeBtns.forEach((btn, i) => btn.classList.toggle("active", i === modeFocusIndex));
  }

  // Click support
  modeBtns.forEach((btn, i) => {
    btn.addEventListener("click", () => selectMode(btn.dataset.mode));
  });

  // ===========================
  // PHONE MODE
  // ===========================
  function initPhone() {
    const els = {
      directionLabel: document.getElementById("direction-label"),
      micStatus: document.getElementById("mic-status"),
      sourceContent: document.getElementById("source-content"),
      targetContent: document.getElementById("target-content"),
      btnListen: document.getElementById("btn-listen"),
      langSource: document.getElementById("lang-source"),
      langTarget: document.getElementById("lang-target"),
      app: document.getElementById("app"),
    };
    const focusables = phoneMode.querySelectorAll(".focusable");

    // Web Speech API (works on phone browsers)
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    let recognition = null;

    if (SpeechRecognition) {
      recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;

      recognition.onresult = (event) => {
        let final = "";
        let interim = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const t = event.results[i][0].transcript;
          if (event.results[i].isFinal) final += t;
          else interim += t;
        }
        els.sourceContent.textContent = truncate(final || interim);
        if (final) translateAndPush(final);
      };

      recognition.onerror = (event) => {
        els.sourceContent.textContent = "Error: " + event.error;
        stopListening();
      };

      recognition.onend = () => {
        if (state.isListening) {
          try { recognition.start(); } catch(e) {}
        }
      };
    }

    async function translateAndPush(text) {
      els.targetContent.textContent = "…";
      try {
        const [from, to] = state.direction === "ga-en" ? ["ga", "en"] : ["en", "ga"];
        const resp = await fetch(CONFIG.translateEndpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, from, to }),
        });
        if (!resp.ok) throw new Error("Translation failed");
        const data = await resp.json();
        const translation = data.translation || "";
        els.targetContent.textContent = truncate(translation);

        // Push to session for glasses
        await fetch(CONFIG.sessionEndpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: state.sessionId,
            source: text,
            translation,
            direction: state.direction,
          }),
        });
      } catch (err) {
        els.targetContent.textContent = "⚠ Error";
      }
    }

    function startListening() {
      if (!recognition) {
        els.sourceContent.textContent = "Speech not supported";
        return;
      }
      state.isListening = true;
      els.micStatus.textContent = "🎙️ ON";
      els.micStatus.className = "mic-on";
      els.sourceContent.textContent = "Listening…";
      els.btnListen.textContent = "■ Stop";
      recognition.lang = state.direction === "ga-en" ? "ga-IE" : "en-US";
      try { recognition.start(); } catch(e) {}
    }

    function stopListening() {
      state.isListening = false;
      els.micStatus.textContent = "🎙️ OFF";
      els.micStatus.className = "mic-off";
      els.btnListen.textContent = "● Listen";
      if (recognition) try { recognition.stop(); } catch(e) {}
    }

    function swapLanguages() {
      stopListening();
      state.direction = state.direction === "ga-en" ? "en-ga" : "ga-en";
      els.directionLabel.textContent = state.direction === "ga-en" ? "GA → EN" : "EN → GA";
      els.langSource.textContent = state.direction === "ga-en" ? "🇮🇪 Gaeilge" : "🇬🇧 English";
      els.langTarget.textContent = state.direction === "ga-en" ? "🇬🇧 English" : "🇮🇪 Gaeilge";
      els.sourceContent.textContent = "Press ● to start";
      els.targetContent.textContent = "—";
    }

    function clearAll() {
      stopListening();
      els.sourceContent.textContent = "Press ● to start";
      els.targetContent.textContent = "—";
    }

    // D-pad
    window.handlePhoneKeydown = function(event) {
      const focusables = phoneMode.querySelectorAll(".focusable");
      switch (event.key) {
        case "ArrowLeft":
          state.focusIndex = Math.max(0, state.focusIndex - 1);
          updatePhoneFocus(focusables);
          break;
        case "ArrowRight":
          state.focusIndex = Math.min(focusables.length - 1, state.focusIndex + 1);
          updatePhoneFocus(focusables);
          break;
        case "Enter": case " ":
          event.preventDefault();
          const action = focusables[state.focusIndex].dataset.action;
          if (action === "listen") state.isListening ? stopListening() : startListening();
          if (action === "swap") swapLanguages();
          if (action === "clear") clearAll();
          break;
      }
    };

    function updatePhoneFocus(focusables) {
      focusables.forEach((el, i) => el.classList.toggle("active", i === state.focusIndex));
    }

    // Click handlers
    document.getElementById("btn-listen").addEventListener("click", () => state.isListening ? stopListening() : startListening());
    document.getElementById("btn-swap").addEventListener("click", swapLanguages);
    document.getElementById("btn-clear").addEventListener("click", clearAll);
  }

  // ===========================
  // GLASSES MODE (display only)
  // ===========================
  function initGlasses() {
    const srcEl = document.getElementById("glasses-source-text");
    const tgtEl = document.getElementById("glasses-target-text");
    const dirEl = document.getElementById("glasses-direction");

    // Poll for new translations
    state.pollTimer = setInterval(async () => {
      try {
        const resp = await fetch(`${CONFIG.sessionEndpoint}?id=${state.sessionId}`);
        if (!resp.ok) return;
        const data = await resp.json();

        if (data.timestamp && data.timestamp > state.lastTimestamp) {
          state.lastTimestamp = data.timestamp;
          srcEl.textContent = truncate(data.source || "");
          tgtEl.textContent = truncate(data.translation || "—");
          dirEl.textContent = data.direction === "ga-en" ? "GA → EN" : "EN → GA";
        }
      } catch (err) {
        // Silent retry
      }
    }, CONFIG.pollIntervalMs);
  }

  // --- Utilities ---
  function truncate(text) {
    return text.length <= CONFIG.maxDisplayChars ? text : text.slice(0, CONFIG.maxDisplayChars) + "…";
  }

})();
