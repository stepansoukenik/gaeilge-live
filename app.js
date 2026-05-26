// Gaeilge Live v4 — Display Mode + Audio-Only Mode
// Display: phone↔glasses bridge (for Ray-Ban Display)
// Audio: single device, mic→translate→TTS through glasses speakers (for Ray-Ban Meta)

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

  // iOS TTS unlock — must be triggered by user gesture
  let ttsUnlocked = false;
  function unlockTTS() {
    if (ttsUnlocked) return;
    const u = new SpeechSynthesisUtterance("");
    u.volume = 0;
    speechSynthesis.speak(u);
    ttsUnlocked = true;
  }

  // TTS via Google Cloud + <audio> element (works on iOS + Bluetooth)
  let audioEl = null;

  async function speakText(text, lang) {
    if (!text) return;

    try {
      const resp = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, lang: lang || "en-GB" }),
      });

      if (!resp.ok) {
        // Fallback to Web Speech Synthesis if TTS API fails
        if (window.speechSynthesis) {
          speechSynthesis.cancel();
          const u = new SpeechSynthesisUtterance(text);
          u.lang = lang || "en-GB";
          u.rate = 0.9;
          speechSynthesis.speak(u);
        }
        return;
      }

      const data = await resp.json();
      if (data.audio) {
        // Play via <audio> element — routes through Bluetooth properly
        if (audioEl) { audioEl.pause(); audioEl.remove(); }
        audioEl = new Audio("data:audio/mp3;base64," + data.audio);
        audioEl.volume = 1.0;
        audioEl.play().catch(e => console.warn("Audio play blocked:", e));
      }
    } catch (err) {
      console.warn("TTS error, falling back:", err);
      // Fallback
      if (window.speechSynthesis) {
        const u = new SpeechSynthesisUtterance(text);
        u.lang = lang || "en-GB";
        speechSynthesis.speak(u);
      }
    }
  }

  // Unlock on any user interaction (tap, click, keypress)
  ["click", "touchstart", "keydown"].forEach(evt => {
    document.addEventListener(evt, unlockTTS, { once: true });
  });

  let state = {
    device: null,      // "display" or "audio"
    mode: null,        // "phone", "glasses" (display mode only)
    screen: "device-select",
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
    const screens = ["device-select","mode-select","numpad-screen","phone-mode","glasses-mode","audio-mode"];
    screens.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.classList.toggle("hidden", id !== name);
    });
  }

  // ===========================
  // DEVICE SELECTOR
  // ===========================
  const deviceBtns = document.querySelectorAll("#device-select .mode-btn");
  let deviceFocusIndex = 0;

  function selectDevice(device) {
    state.device = device;
    if (device === "display") {
      showScreen("mode-select");
    } else {
      showScreen("audio-mode");
      initAudioMode();
    }
  }

  deviceBtns.forEach(btn => {
    btn.addEventListener("click", () => selectDevice(btn.dataset.device));
    btn.addEventListener("focus", () => {
      deviceFocusIndex = [...deviceBtns].indexOf(btn);
      deviceBtns.forEach((b, i) => b.classList.toggle("active", i === deviceFocusIndex));
    });
  });

  // ===========================
  // DISPLAY MODE SELECTOR
  // ===========================
  const modeBtns = document.querySelectorAll("#mode-select .mode-btn");
  let modeFocusIndex = 0;

  function selectMode(mode) {
    state.mode = mode;
    if (mode === "phone") {
      state.sessionId = generateSessionId();
      document.getElementById("session-code-display").textContent = state.sessionId;
      showScreen("phone-mode");
      initPhone();
    } else {
      state.numpadDigits = [];
      state.numpadFocusIndex = 4;
      updateNumpadDisplay();
      updateNumpadFocus();
      showScreen("numpad-screen");
    }
  }

  modeBtns.forEach(btn => {
    btn.addEventListener("click", () => selectMode(btn.dataset.mode));
    btn.addEventListener("focus", () => {
      modeFocusIndex = [...modeBtns].indexOf(btn);
      modeBtns.forEach((b, i) => b.classList.toggle("active", i === modeFocusIndex));
    });
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
    if (digit === "del") { state.numpadDigits.pop(); }
    else if (digit === "ok") {
      if (state.numpadDigits.length === 4) connectGlasses();
    } else if (state.numpadDigits.length < 4) {
      state.numpadDigits.push(digit);
    }
    updateNumpadDisplay();
    if (state.numpadDigits.length === 4 && digit !== "ok" && digit !== "del") {
      setTimeout(connectGlasses, 400);
    }
  }

  function connectGlasses() {
    state.sessionId = state.numpadDigits.join("");
    document.getElementById("glasses-session").textContent = state.sessionId;
    showScreen("glasses-mode");
    initGlasses();
  }

  numpadKeys.forEach(key => {
    key.addEventListener("click", () => numpadPress(key.dataset.digit));
  });

  // ===========================
  // KEYBOARD HANDLER
  // ===========================
  document.addEventListener("keydown", (event) => {
    switch (state.screen) {
      case "device-select": handleListKeys(event, deviceBtns, deviceFocusIndex, (i) => { deviceFocusIndex = i; }, selectDevice, "device"); break;
      case "mode-select": handleListKeys(event, modeBtns, modeFocusIndex, (i) => { modeFocusIndex = i; }, selectMode, "mode"); break;
      case "numpad-screen": handleNumpadKeys(event); break;
      case "phone-mode": if (window.handlePhoneKeys) window.handlePhoneKeys(event); break;
      case "audio-mode": if (window.handleAudioKeys) window.handleAudioKeys(event); break;
    }
  });

  function handleListKeys(event, btns, currentIndex, setIndex, selectFn, attr) {
    if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
      currentIndex = 0; setIndex(0);
      btns.forEach((b, i) => b.classList.toggle("active", i === 0));
      btns[0].focus();
    } else if (event.key === "ArrowDown" || event.key === "ArrowRight") {
      currentIndex = 1; setIndex(1);
      btns.forEach((b, i) => b.classList.toggle("active", i === 1));
      btns[1].focus();
    } else if (event.key === "Enter" || event.key === " " || event.key === "Return" || event.key === "Select") {
      event.preventDefault();
      const val = btns[currentIndex].dataset[attr];
      selectFn(val);
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
      case "Enter": case " ": case "Return": case "Select": numpadPress(numpadKeys[state.numpadFocusIndex].dataset.digit); break;
    }
    updateNumpadFocus();
  }

  // ===========================
  // AUDIO-ONLY MODE (Ray-Ban Meta)
  // ===========================
  function initAudioMode() {
    const els = {
      micStatus: document.getElementById("audio-mic-status"),
      sourceText: document.getElementById("audio-source-text"),
      targetText: document.getElementById("audio-target-text"),
      btnListen: document.getElementById("btn-audio-listen"),
      dirLabel: document.getElementById("audio-direction"),
      langSource: document.getElementById("audio-lang-source"),
      langTarget: document.getElementById("audio-lang-target"),
    };
    const focusables = document.querySelectorAll("#audio-mode .audio-btn");
    let audioFocusIndex = 0;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    let recognition = null;
    let audioStream = null;
    let mediaRecorder = null;

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
        els.sourceText.textContent = truncate(final || interim);
        if (final) translateAndSpeak(final);
      };

      recognition.onerror = (event) => {
        if (event.error === "service-not-allowed" || event.error === "not-allowed" || event.error === "network") {
          state.useMediaRecorder = true;
          if (state.isListening) startAudioMediaRecorder();
        } else {
          els.sourceText.textContent = "Error: " + event.error;
          stopAudioListening();
        }
      };

      recognition.onend = () => {
        if (state.isListening && !state.useMediaRecorder) try { recognition.start(); } catch(e) {}
      };
    } else {
      state.useMediaRecorder = true;
    }

    // MediaRecorder fallback
    async function startAudioMediaRecorder() {
      try {
        audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch (err) {
        els.sourceText.textContent = "Mic denied — check permissions";
        stopAudioListening();
        return;
      }
      els.sourceText.textContent = "Listening…";
      recordAudioChunk();
    }

    function recordAudioChunk() {
      if (!state.isListening || !audioStream) return;
      const chunks = [];
      mediaRecorder = new MediaRecorder(audioStream, { mimeType: getSupportedMimeType() });
      mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
      mediaRecorder.onstop = async () => {
        if (chunks.length === 0 || !state.isListening) return;
        const blob = new Blob(chunks, { type: mediaRecorder.mimeType });
        const base64 = await blobToBase64(blob);
        els.sourceText.textContent = "Processing…";
        try {
          const langCode = state.direction === "ga-en" ? "ga-IE" : "en-US";
          const resp = await fetch(CONFIG.speechEndpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ audio: base64, language: langCode, mimeType: mediaRecorder.mimeType }),
          });
          if (!resp.ok) throw new Error("Speech API error");
          const data = await resp.json();
          if (data.transcript && data.transcript.trim()) {
            els.sourceText.textContent = truncate(data.transcript);
            translateAndSpeak(data.transcript);
          } else {
            els.sourceText.textContent = "No speech detected";
          }
        } catch (err) {
          els.sourceText.textContent = "⚠ Recognition failed";
        }
        if (state.isListening) setTimeout(recordAudioChunk, 500);
      };
      mediaRecorder.start();
      setTimeout(() => { if (mediaRecorder && mediaRecorder.state === "recording") mediaRecorder.stop(); }, CONFIG.recordingDurationMs);
    }

    // Translate + speak aloud
    async function translateAndSpeak(text) {
      els.targetText.textContent = "…";
      try {
        const [from, to] = state.direction === "ga-en" ? ["ga", "en"] : ["en", "ga"];
        const resp = await fetch(CONFIG.translateEndpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, from, to }),
        });
        if (!resp.ok) throw new Error("Failed");
        const data = await resp.json();
        const translation = data.translation || "";
        els.targetText.textContent = truncate(translation);

        // Speak through glasses speakers (Bluetooth audio)
        speakText(translation, state.direction === "ga-en" ? "en-GB" : "ga-IE");
      } catch (err) {
        els.targetText.textContent = "⚠ Translation error";
      }
    }

    function startAudioListening() {
      state.isListening = true;
      els.micStatus.textContent = "🎙️ ON";
      els.micStatus.className = "mic-on";
      els.sourceText.textContent = "Listening…";
      els.btnListen.textContent = "● Listening…";
      if (!state.useMediaRecorder && recognition) {
        recognition.lang = state.direction === "ga-en" ? "ga-IE" : "en-US";
        try { recognition.start(); } catch(e) { startAudioMediaRecorder(); }
      } else {
        startAudioMediaRecorder();
      }
    }

    function stopAudioListening() {
      state.isListening = false;
      els.micStatus.textContent = "🎙️ OFF";
      els.micStatus.className = "mic-off";
      els.btnListen.textContent = "● Listen";
      if (recognition && !state.useMediaRecorder) try { recognition.stop(); } catch(e) {}
      if (mediaRecorder && mediaRecorder.state === "recording") mediaRecorder.stop();
      if (audioStream) { audioStream.getTracks().forEach(t => t.stop()); audioStream = null; }
      if (window.speechSynthesis) speechSynthesis.cancel();
    }

    function swapAudioLangs() {
      stopAudioListening();
      state.direction = state.direction === "ga-en" ? "en-ga" : "ga-en";
      els.dirLabel.textContent = state.direction === "ga-en" ? "GA → EN" : "EN → GA";
      els.langSource.textContent = state.direction === "ga-en" ? "🇮🇪 Gaeilge" : "🇬🇧 English";
      els.langTarget.textContent = state.direction === "ga-en" ? "🇬🇧 English" : "🇮🇪 Gaeilge";
      els.sourceText.textContent = "Tap to start listening";
      els.targetText.textContent = "—";
    }

    // Click handlers
    document.getElementById("btn-audio-listen").addEventListener("click", () => state.isListening ? stopAudioListening() : startAudioListening());
    document.getElementById("btn-audio-swap").addEventListener("click", swapAudioLangs);
    document.getElementById("btn-audio-stop").addEventListener("click", stopAudioListening);

    // D-pad for audio mode
    window.handleAudioKeys = function(event) {
      switch (event.key) {
        case "ArrowLeft": audioFocusIndex = Math.max(0, audioFocusIndex - 1); break;
        case "ArrowRight": audioFocusIndex = Math.min(focusables.length - 1, audioFocusIndex + 1); break;
        case "Enter": case " ": case "Return": case "Select":
          event.preventDefault();
          focusables[audioFocusIndex].click();
          break;
      }
      focusables.forEach((el, i) => el.classList.toggle("active", i === audioFocusIndex));
    };
  }

  // ===========================
  // DISPLAY: PHONE MODE
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

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    let recognition = null;
    let audioStream = null;
    let mediaRecorder = null;
    let phoneUseMediaRecorder = false;

    if (SpeechRecognition) {
      recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.onresult = (event) => {
        let final = "", interim = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const t = event.results[i][0].transcript;
          if (event.results[i].isFinal) final += t; else interim += t;
        }
        els.sourceContent.textContent = truncate(final || interim);
        if (final) phoneTranslateAndPush(final);
      };
      recognition.onerror = (event) => {
        if (["service-not-allowed","not-allowed","network","language-not-supported"].includes(event.error)) {
          phoneUseMediaRecorder = true;
          if (state.isListening) phoneStartMediaRecorder();
        } else { els.sourceContent.textContent = "Error: " + event.error; phoneStopListening(); }
      };
      recognition.onend = () => { if (state.isListening && !phoneUseMediaRecorder) try { recognition.start(); } catch(e) {} };
    } else { phoneUseMediaRecorder = true; }

    async function phoneStartMediaRecorder() {
      try { audioStream = await navigator.mediaDevices.getUserMedia({ audio: true }); }
      catch (err) { els.sourceContent.textContent = "Mic denied"; phoneStopListening(); return; }
      els.sourceContent.textContent = "Listening…";
      phoneRecordChunk();
    }

    function phoneRecordChunk() {
      if (!state.isListening || !audioStream) return;
      const chunks = [];
      mediaRecorder = new MediaRecorder(audioStream, { mimeType: getSupportedMimeType() });
      mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
      mediaRecorder.onstop = async () => {
        if (!chunks.length || !state.isListening) return;
        const blob = new Blob(chunks, { type: mediaRecorder.mimeType });
        const base64 = await blobToBase64(blob);
        els.sourceContent.textContent = "Processing…";
        try {
          const langCode = state.direction === "ga-en" ? "ga-IE" : "en-US";
          const resp = await fetch(CONFIG.speechEndpoint, { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify({audio:base64,language:langCode,mimeType:mediaRecorder.mimeType}) });
          if (!resp.ok) throw new Error("err");
          const data = await resp.json();
          if (data.transcript?.trim()) { els.sourceContent.textContent = truncate(data.transcript); phoneTranslateAndPush(data.transcript); }
          else { els.sourceContent.textContent = "No speech detected"; }
        } catch(e) { els.sourceContent.textContent = "⚠ Recognition failed"; }
        if (state.isListening) setTimeout(phoneRecordChunk, 500);
      };
      mediaRecorder.start();
      setTimeout(() => { if (mediaRecorder?.state === "recording") mediaRecorder.stop(); }, CONFIG.recordingDurationMs);
    }

    async function phoneTranslateAndPush(text) {
      els.targetContent.textContent = "…";
      try {
        const [from,to] = state.direction === "ga-en" ? ["ga","en"] : ["en","ga"];
        const resp = await fetch(CONFIG.translateEndpoint, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({text,from,to}) });
        if (!resp.ok) throw new Error("err");
        const data = await resp.json();
        els.targetContent.textContent = truncate(data.translation || "");
        await fetch(CONFIG.sessionEndpoint, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({sessionId:state.sessionId,source:text,translation:data.translation,direction:state.direction}) });
      } catch(e) { els.targetContent.textContent = "⚠ Error"; }
    }

    function phoneStartListening() {
      state.isListening = true;
      els.micStatus.textContent = "🎙️ ON"; els.micStatus.className = "mic-on";
      els.sourceContent.textContent = "Listening…"; els.btnListen.textContent = "■ Stop";
      if (!phoneUseMediaRecorder && recognition) { recognition.lang = state.direction === "ga-en" ? "ga-IE" : "en-US"; try { recognition.start(); } catch(e) { phoneStartMediaRecorder(); } }
      else { phoneStartMediaRecorder(); }
    }

    function phoneStopListening() {
      state.isListening = false;
      els.micStatus.textContent = "🎙️ OFF"; els.micStatus.className = "mic-off";
      els.btnListen.textContent = "● Listen";
      if (recognition && !phoneUseMediaRecorder) try { recognition.stop(); } catch(e) {}
      if (mediaRecorder?.state === "recording") mediaRecorder.stop();
      if (audioStream) { audioStream.getTracks().forEach(t => t.stop()); audioStream = null; }
    }

    function phoneSwap() {
      phoneStopListening();
      state.direction = state.direction === "ga-en" ? "en-ga" : "ga-en";
      els.directionLabel.textContent = state.direction === "ga-en" ? "GA → EN" : "EN → GA";
      els.langSource.textContent = state.direction === "ga-en" ? "🇮🇪 Gaeilge" : "🇬🇧 English";
      els.langTarget.textContent = state.direction === "ga-en" ? "🇬🇧 English" : "🇮🇪 Gaeilge";
      els.sourceContent.textContent = "Press ● to start"; els.targetContent.textContent = "—";
    }

    function phoneClear() { phoneStopListening(); els.sourceContent.textContent = "Press ● to start"; els.targetContent.textContent = "—"; }

    document.getElementById("btn-listen").addEventListener("click", () => state.isListening ? phoneStopListening() : phoneStartListening());
    document.getElementById("btn-swap").addEventListener("click", phoneSwap);
    document.getElementById("btn-clear").addEventListener("click", phoneClear);

    window.handlePhoneKeys = function(event) {
      let fi = state.focusIndex;
      switch (event.key) {
        case "ArrowLeft": fi = Math.max(0, fi - 1); break;
        case "ArrowRight": fi = Math.min(focusables.length - 1, fi + 1); break;
        case "Enter": case " ": case "Return": case "Select": event.preventDefault(); focusables[fi].click(); break;
      }
      state.focusIndex = fi;
      focusables.forEach((el, i) => el.classList.toggle("active", i === fi));
    };
  }

  // ===========================
  // DISPLAY: GLASSES MODE
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
          speakText(data.translation, data.direction === "ga-en" ? "en-GB" : "ga-IE");
        }
      } catch (err) {}
    }, CONFIG.pollIntervalMs);
  }

  // --- Utilities ---
  function truncate(text) { return text.length <= CONFIG.maxDisplayChars ? text : text.slice(0, CONFIG.maxDisplayChars) + "…"; }
  function getSupportedMimeType() {
    for (const t of ["audio/webm;codecs=opus","audio/webm","audio/ogg;codecs=opus","audio/mp4"]) { if (MediaRecorder.isTypeSupported(t)) return t; }
    return "audio/webm";
  }
  async function blobToBase64(blob) { return new Promise(r => { const fr = new FileReader(); fr.onloadend = () => r(fr.result.split(",")[1]); fr.readAsDataURL(blob); }); }

})();
