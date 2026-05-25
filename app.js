// Gaeilge Live — Phone ↔ Glasses Bridge v2
// Now with D-pad navigable number pad for session code entry on glasses

(function() {
  "use strict";

  const CONFIG = {
    translateEndpoint: "/api/translate",
    sessionEndpoint: "/api/session",
    pollIntervalMs: 1500,
    maxDisplayChars: 120,
  };

  let state = {
    mode: null,
    screen: "mode-select", // mode-select, numpad, phone, glasses
    sessionId: null,
    direction: "ga-en",
    isListening: false,
    focusIndex: 0,
    lastTimestamp: 0,
    pollTimer: null,
    // Numpad state
    numpadDigits: [],
    numpadFocusIndex: 4, // Start focused on "5" (middle of grid)
  };

  // --- Generate 4-digit session code ---
  function generateSessionId() {
    return String(Math.floor(1000 + Math.random() * 9000));
  }

  // --- Screen management ---
  function showScreen(name) {
    state.screen = name;
    document.getElementById("mode-select").classList.toggle("hidden", name !== "mode-select");
    document.getElementById("numpad-screen").classList.toggle("hidden", name !== "numpad");
    document.getElementById("phone-mode").classList.toggle("hidden", name !== "phone");
    document.getElementById("glasses-mode").classList.toggle("hidden", name !== "glasses");
  }

  // --- Mode Selection ---
  const modeBtns = document.querySelectorAll("#mode-select .mode-btn");
  let modeFocusIndex = 0;

  function selectMode(mode) {
    state.mode = mode;
    if (mode === "phone") {
      state.sessionId = generateSessionId();
      document.getElementById("session-code-display").textContent = state.sessionId;
      showScreen("phone");
      initPhone();
    } else {
      // Show numpad for code entry
      state.numpadDigits = [];
      state.numpadFocusIndex = 4;
      updateNumpadDisplay();
      updateNumpadFocus();
      showScreen("numpad");
    }
  }

  // Click support for mode buttons
  modeBtns.forEach(btn => {
    btn.addEventListener("click", () => selectMode(btn.dataset.mode));
  });

  // ===========================
  // NUMPAD (Glasses code entry)
  // ===========================
  const numpadKeys = document.querySelectorAll(".numpad-key");

  function updateNumpadDisplay() {
    for (let i = 0; i < 4; i++) {
      const el = document.getElementById("d" + i);
      el.textContent = state.numpadDigits[i] || "_";
      el.classList.toggle("digit-filled", !!state.numpadDigits[i]);
    }
  }

  function updateNumpadFocus() {
    numpadKeys.forEach((key, i) => {
      key.classList.toggle("active", i === state.numpadFocusIndex);
    });
  }

  function numpadPress(digit) {
    if (digit === "del") {
      state.numpadDigits.pop();
    } else if (digit === "ok") {
      if (state.numpadDigits.length === 4) {
        state.sessionId = state.numpadDigits.join("");
        document.getElementById("glasses-session").textContent = state.sessionId;
        showScreen("glasses");
        initGlasses();
      }
    } else if (state.numpadDigits.length < 4) {
      state.numpadDigits.push(digit);
    }
    updateNumpadDisplay();

    // Auto-connect when 4 digits entered
    if (state.numpadDigits.length === 4 && digit !== "ok" && digit !== "del") {
      setTimeout(() => {
        state.sessionId = state.numpadDigits.join("");
        document.getElementById("glasses-session").textContent = state.sessionId;
        showScreen("glasses");
        initGlasses();
      }, 400);
    }
  }

  // Click support for numpad
  numpadKeys.forEach(key => {
    key.addEventListener("click", () => numpadPress(key.dataset.digit));
  });

  // ===========================
  // GLOBAL KEYBOARD HANDLER
  // ===========================
  document.addEventListener("keydown", (event) => {
    switch (state.screen) {
      case "mode-select":
        handleModeKeys(event);
        break;
      case "numpad":
        handleNumpadKeys(event);
        break;
      case "phone":
        handlePhoneKeys(event);
        break;
      // glasses mode has no interaction needed
    }
  });

  function handleModeKeys(event) {
    if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
      modeFocusIndex = 0;
      modeBtns.forEach((b, i) => b.classList.toggle("active", i === 0));
    } else if (event.key === "ArrowDown" || event.key === "ArrowRight") {
      modeFocusIndex = 1;
      modeBtns.forEach((b, i) => b.classList.toggle("active", i === 1));
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      selectMode(modeFocusIndex === 0 ? "phone" : "glasses");
    }
  }

  function handleNumpadKeys(event) {
    event.preventDefault();
    const cols = 3;
    const total = numpadKeys.length; // 12

    switch (event.key) {
      case "ArrowRight":
        state.numpadFocusIndex = Math.min(total - 1, state.numpadFocusIndex + 1);
        break;
      case "ArrowLeft":
        state.numpadFocusIndex = Math.max(0, state.numpadFocusIndex - 1);
        break;
      case "ArrowDown":
        if (state.numpadFocusIndex + cols < total)
          state.numpadFocusIndex += cols;
        break;
      case "ArrowUp":
        if (state.numpadFocusIndex - cols >= 0)
          state.numpadFocusIndex -= cols;
        break;
      case "Enter":
      case " ":
        numpadPress(numpadKeys[state.numpadFocusIndex].dataset.digit);
        break;
    }
    updateNumpadFocus();
  }

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
    };
    const focusables = document.querySelectorAll("#phone-mode .focusable");
    state.focusIndex = 0;
    focusables[0].classList.add("active");

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    let recognition = null;

    if (SpeechRecognition) {
      recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;

      recognition.onresult = (event) => {
        let final = "", interim = "";
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
        if (state.isListening) try { recognition.start(); } catch(e) {}
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
        if (!resp.ok) throw new Error("Failed");
        const data = await resp.json();
        els.targetContent.textContent = truncate(data.translation || "");

        // Push to glasses
        await fetch(CONFIG.sessionEndpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: state.sessionId,
            source: text,
            translation: data.translation,
            direction: state.direction,
          }),
        });
      } catch (err) {
        els.targetContent.textContent = "⚠ Error";
      }
    }

    function startListening() {
      if (!recognition) { els.sourceContent.textContent = "Speech not supported"; return; }
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

    window.handlePhoneKeys = function(event) {
      switch (event.key) {
        case "ArrowLeft":
          state.focusIndex = Math.max(0, state.focusIndex - 1);
          break;
        case "ArrowRight":
          state.focusIndex = Math.min(focusables.length - 1, state.focusIndex + 1);
          break;
        case "Enter": case " ":
          event.preventDefault();
          const action = focusables[state.focusIndex].dataset.action;
          if (action === "listen") state.isListening ? stopListening() : startListening();
          if (action === "swap") swapLanguages();
          if (action === "clear") clearAll();
          break;
      }
      focusables.forEach((el, i) => el.classList.toggle("active", i === state.focusIndex));
    };

    // Click handlers
    document.getElementById("btn-listen").addEventListener("click", () => state.isListening ? stopListening() : startListening());
    document.getElementById("btn-swap").addEventListener("click", swapLanguages);
    document.getElementById("btn-clear").addEventListener("click", clearAll);
  }

  // ===========================
  // GLASSES MODE
  // ===========================
  function initGlasses() {
    const srcEl = document.getElementById("glasses-source-text");
    const tgtEl = document.getElementById("glasses-target-text");
    const dirEl = document.getElementById("glasses-direction");

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
      } catch (err) {}
    }, CONFIG.pollIntervalMs);
  }

  // --- Utilities ---
  function truncate(text) {
    return text.length <= CONFIG.maxDisplayChars ? text : text.slice(0, CONFIG.maxDisplayChars) + "…";
  }

})();
