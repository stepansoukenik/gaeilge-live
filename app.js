// Gaeilge Live — Irish ↔ English Real-Time Translator
// For Meta Ray-Ban Display glasses
// Uses MediaRecorder + Cloud Speech-to-Text (glasses) or Web Speech API (desktop)

(function() {
  "use strict";

  // --- Configuration ---
  const CONFIG = {
    translateEndpoint: "/api/translate",
    speechEndpoint: "/api/speech",
    recordingDurationMs: 4000,   // Record 4-second chunks
    maxDisplayChars: 120,
  };

  // --- State ---
  let state = {
    direction: "ga-en",
    isListening: false,
    focusIndex: 0,
    useWebSpeech: false, // Will be set to true if Web Speech API works
  };

  // --- DOM Elements ---
  const els = {
    directionLabel: document.getElementById("direction-label"),
    micStatus: document.getElementById("mic-status"),
    sourceContent: document.getElementById("source-content"),
    targetContent: document.getElementById("target-content"),
    btnListen: document.getElementById("btn-listen"),
    btnSwap: document.getElementById("btn-swap"),
    btnClear: document.getElementById("btn-clear"),
    langSource: document.getElementById("lang-source"),
    langTarget: document.getElementById("lang-target"),
    app: document.getElementById("app"),
  };

  const focusables = document.querySelectorAll(".focusable");

  // --- Detect capabilities ---
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  let recognition = null;
  let mediaRecorder = null;
  let audioStream = null;
  let recordingLoop = null;

  // Try Web Speech API first (works on desktop Chrome)
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
      els.sourceContent.textContent = truncate(final || interim);
      if (final) {
        translate(final);
      }
    };

    recognition.onerror = (event) => {
      console.warn("Web Speech API failed:", event.error);
      // Fall back to MediaRecorder approach
      if (event.error === "service-not-allowed" || event.error === "not-allowed" ||
          event.error === "network" || event.error === "aborted") {
        state.useWebSpeech = false;
        if (state.isListening) {
          stopListening();
          // Auto-restart with MediaRecorder
          startListeningMediaRecorder();
        }
      }
    };

    recognition.onend = () => {
      if (state.isListening && state.useWebSpeech) {
        try { recognition.start(); } catch(e) {}
      }
    };
  }

  // --- MediaRecorder approach (works on glasses) ---
  async function startListeningMediaRecorder() {
    try {
      audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      els.sourceContent.textContent = "Mic access denied";
      stopListening();
      return;
    }

    state.isListening = true;
    state.useWebSpeech = false;
    updateListeningUI(true);
    els.sourceContent.textContent = "Listening…";

    recordNextChunk();
  }

  function recordNextChunk() {
    if (!state.isListening || !audioStream) return;

    const chunks = [];
    mediaRecorder = new MediaRecorder(audioStream, {
      mimeType: getSupportedMimeType(),
    });

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };

    mediaRecorder.onstop = async () => {
      if (chunks.length === 0 || !state.isListening) return;

      const blob = new Blob(chunks, { type: mediaRecorder.mimeType });
      const base64 = await blobToBase64(blob);

      // Send to cloud speech-to-text
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
          translate(data.transcript);
        } else {
          els.sourceContent.textContent = "No speech detected";
        }
      } catch (err) {
        console.error("Speech recognition error:", err);
        els.sourceContent.textContent = "⚠ Recognition failed";
      }

      // Record next chunk
      if (state.isListening) {
        setTimeout(recordNextChunk, 500);
      }
    };

    mediaRecorder.start();
    setTimeout(() => {
      if (mediaRecorder && mediaRecorder.state === "recording") {
        mediaRecorder.stop();
      }
    }, CONFIG.recordingDurationMs);
  }

  // --- Translation ---
  async function translate(text) {
    if (!text.trim()) return;

    els.app.classList.add("translating");
    els.targetContent.textContent = "…";

    try {
      const [from, to] = state.direction === "ga-en" ? ["ga", "en"] : ["en", "ga"];
      const response = await fetch(CONFIG.translateEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: text.trim(), from, to }),
      });

      if (!response.ok) throw new Error(`API error: ${response.status}`);

      const data = await response.json();
      els.targetContent.textContent = truncate(data.translation || "No translation");

    } catch (err) {
      console.error("Translation error:", err);
      els.targetContent.textContent = "⚠ Translation failed";
      els.app.classList.add("error");
      setTimeout(() => els.app.classList.remove("error"), 2000);
    }
    els.app.classList.remove("translating");
  }

  // --- Actions ---
  function startListening() {
    // Try Web Speech API first (desktop)
    if (recognition) {
      state.useWebSpeech = true;
      state.isListening = true;
      updateListeningUI(true);
      els.sourceContent.textContent = "Listening…";
      recognition.lang = state.direction === "ga-en" ? "ga-IE" : "en-US";
      try {
        recognition.start();
      } catch(e) {
        // If Web Speech fails immediately, use MediaRecorder
        startListeningMediaRecorder();
      }
    } else {
      // No Web Speech API — go straight to MediaRecorder
      startListeningMediaRecorder();
    }
  }

  function stopListening() {
    state.isListening = false;
    updateListeningUI(false);

    if (recognition && state.useWebSpeech) {
      try { recognition.stop(); } catch(e) {}
    }
    if (mediaRecorder && mediaRecorder.state === "recording") {
      mediaRecorder.stop();
    }
    if (audioStream) {
      audioStream.getTracks().forEach(t => t.stop());
      audioStream = null;
    }
  }

  function toggleListening() {
    state.isListening ? stopListening() : startListening();
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

  // --- UI Updates ---
  function updateListeningUI(listening) {
    els.micStatus.textContent = listening ? "🎙️ ON" : "🎙️ OFF";
    els.micStatus.className = listening ? "mic-on" : "mic-off";
    els.btnListen.textContent = listening ? "■ Stop" : "● Listen";
    els.app.classList.toggle("listening", listening);
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

  document.addEventListener("keydown", (event) => {
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
      case "Enter":
      case " ":
        event.preventDefault();
        activateFocused();
        break;
    }
  });

  function activateFocused() {
    const action = focusables[state.focusIndex].dataset.action;
    switch (action) {
      case "listen": toggleListening(); break;
      case "swap":   swapLanguages(); break;
      case "clear":  clearAll(); break;
    }
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
      reader.onloadend = () => {
        const base64 = reader.result.split(",")[1];
        resolve(base64);
      };
      reader.readAsDataURL(blob);
    });
  }

  // --- Init ---
  updateFocus();
  updateDirectionUI();

  // Touch/click support for desktop testing
  focusables.forEach((btn, i) => {
    btn.addEventListener("click", () => {
      state.focusIndex = i;
      updateFocus();
      activateFocused();
    });
  });

})();
