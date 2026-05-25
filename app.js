// Gaeilge Live — Phone ↔ Glasses Bridge v3
// Phone mode: Web Speech API → falls back to MediaRecorder + Cloud Speech
// Glasses mode: Polls session, displays on HUD

(function() {
  "use strict";

  const CONFIG = {
    translateEndpoint: "/api/translate",
    speechEndpoint: "/api/speech",
    sessionEndpoint: "/api/session",
    pollIntervalMs: 1500,
    recordingDurationMs: 4000,
    maxDisplayChars: 120,
  };

  let state = {
    mode: null,
    screen: "mode-select",
    sessionId: null,
    direction: "ga-en",
    isListening: false,
    focusIndex: 0,
    lastTimestamp: 0,
    pollTimer: null,
    numpadDigits: [],
    numpadFocusIndex: 4,
    useMediaRecorder: false,
  };

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
      state.numpadDigits = [];
      state.numpadFocusIndex = 4;
      updateNumpadDisplay();
      updateNumpadFocus();
      showScreen("numpad");
    }
  }

  modeBtns.forEach(btn => {
    btn.addEventListener("click", () => selectMode(btn.dataset.mode));
  });

  // ===========================
  // NUMPAD
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
    numpadKeys.forEach((key, i) => key.classList.toggle("active", i === state.numpadFocusIndex));
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
    if (state.numpadDigits.length === 4 && digit !== "ok" && digit !== "del") {
      setTimeout(() => {
        state.sessionId = state.numpadDigits.join("");
        document.getElementById("glasses-session").textContent = state.sessionId;
        showScreen("glasses");
        initGlasses();
      }, 400);
    }
  }

  numpadKeys.forEach(key => {
    key.addEventListener("click", () => numpadPress(key.dataset.digit));
  });

  // ===========================
  // KEYBOARD HANDLER
  // ===========================
  document.addEventListener("keydown", (event) => {
    switch (state.screen) {
      case "mode-select": handleModeKeys(event); break;
      case "numpad": handleNumpadKeys(event); break;
      case "phone": handlePhoneKeys(event); break;
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
    const cols = 3, total = numpadKeys.length;
    switch (event.key) {
      case "ArrowRight": state.numpadFocusIndex = Math.min(total - 1, state.numpadFocusIndex + 1); break;
      case "ArrowLeft": state.numpadFocusIndex = Math.max(0, state.numpadFocusIndex - 1); break;
      case "ArrowDown": if (state.numpadFocusIndex + cols < total) state.numpadFocusIndex += cols; break;
      case "ArrowUp": if (state.numpadFocusIndex - cols >= 0) state.numpadFocusIndex -= cols; break;
      case "Enter": case " ": numpadPress(numpadKeys[state.numpadFocusIndex].dataset.digit); break;
    }
    updateNumpadFocus();
  }

  // ===========================
  // PHONE MODE (with MediaRecorder fallback)
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

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    let recognition = null;
    let audioStream = null;
    let mediaRecorder = null;

    // Try Web Speech API
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
        console.warn("Web Speech failed:", event.error);
        // Fall back to MediaRecorder
        if (event.error === "service-not-allowed" || event.error === "not-allowed" ||
            event.error === "network" || event.error === "language-not-supported") {
          state.useMediaRecorder = true;
          if (state.isListening) {
            startMediaRecorder();
          }
        } else {
          els.sourceContent.textContent = "Error: " + event.error;
          stopListening();
        }
      };

      recognition.onend = () => {
        if (state.isListening && !state.useMediaRecorder) {
          try { recognition.start(); } catch(e) {}
        }
      };
    } else {
      state.useMediaRecorder = true;
    }

    // --- MediaRecorder approach ---
    async function startMediaRecorder() {
      try {
        audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch (err) {
        els.sourceContent.textContent = "Mic denied — check permissions";
        stopListening();
        return;
      }
      els.sourceContent.textContent = "Listening…";
      recordNextChunk();
    }

    function recordNextChunk() {
      if (!state.isListening || !audioStream) return;

      const chunks = [];
      mediaRecorder = new MediaRecorder(audioStream, { mimeType: getSupportedMimeType() });

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        if (chunks.length === 0 || !state.isListening) return;
        const blob = new Blob(chunks, { type: mediaRecorder.mimeType });
        const base64 = await blobToBase64(blob);

        els.sourceContent.textContent = "Processing…";
        try {
          const langCode = state.direction === "ga-en" ? "ga-IE" : "en-US";
          const resp = await fetch(CONFIG.speechEndpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ audio: base64, language: langCode }),
          });
          if (!resp.ok) throw new Error("Speech API error");
          const data = await resp.json();
          if (data.transcript && data.transcript.trim()) {
            els.sourceContent.textContent = truncate(data.transcript);
            translateAndPush(data.transcript);
          } else {
            els.sourceContent.textContent = "No speech detected — try again";
          }
        } catch (err) {
          els.sourceContent.textContent = "⚠ Recognition failed";
        }
        // Next chunk
        if (state.isListening) setTimeout(recordNextChunk, 500);
      };

      mediaRecorder.start();
      setTimeout(() => {
        if (mediaRecorder && mediaRecorder.state === "recording") mediaRecorder.stop();
      }, CONFIG.recordingDurationMs);
    }

    // --- Translate + push to glasses ---
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
        // Push to glasses session
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
        els.targetContent.textContent = "⚠ Translation error";
      }
    }

    // --- Start/Stop ---
    function startListening() {
      state.isListening = true;
      els.micStatus.textContent = "🎙️ ON";
      els.micStatus.className = "mic-on";
      els.sourceContent.textContent = "Listening…";
      els.btnListen.textContent = "■ Stop";

      if (!state.useMediaRecorder && recognition) {
        recognition.lang = state.direction === "ga-en" ? "ga-IE" : "en-US";
        try { recognition.start(); } catch(e) { startMediaRecorder(); }
      } else {
        startMediaRecorder();
      }
    }

    function stopListening() {
      state.isListening = false;
      els.micStatus.textContent = "🎙️ OFF";
      els.micStatus.className = "mic-off";
      els.btnListen.textContent = "● Listen";
      if (recognition && !state.useMediaRecorder) try { recognition.stop(); } catch(e) {}
      if (mediaRecorder && mediaRecorder.state === "recording") mediaRecorder.stop();
      if (audioStream) { audioStream.getTracks().forEach(t => t.stop()); audioStream = null; }
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
    window.handlePhoneKeys = function(event) {
      switch (event.key) {
        case "ArrowLeft": state.focusIndex = Math.max(0, state.focusIndex - 1); break;
        case "ArrowRight": state.focusIndex = Math.min(focusables.length - 1, state.focusIndex + 1); break;
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

  function getSupportedMimeType() {
    const types = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4"];
    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) return type;
    }
    return "audio/webm";
  }

  async function blobToBase64(blob) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result.split(",")[1]);
      reader.readAsDataURL(blob);
    });
  }

})();
