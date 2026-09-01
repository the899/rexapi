window.ShuobanGate = window.ShuobanGate || "oJaVRr2PPOGGsdYk98P2YrD4qMXY0o-p";
window.ShuobanTTS = {
  audio: null,
  currentUrl: null,
  unlocked: false,
  ensure: function () {
    if (!this.audio) {
      this.audio = new Audio();
      this.audio.setAttribute("playsinline", "true");
      this.audio.preload = "auto";
    }
    return this.audio;
  },
  unlock: function () {
    var a = this.ensure();
    this.unlocked = true;
    try {
      a.src = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAA=";
      var p = a.play();
      if (p && p.then) p.then(function () { try { a.pause(); } catch (e) {} }).catch(function () {});
    } catch (e) {}
  },
  stop: function () {
    try { speechSynthesis.cancel(); } catch (e) {}
    try {
      if (this.audio) {
        this.audio.pause();
        this.audio.removeAttribute("src");
        this.audio.load();
      }
    } catch (e) {}
  },
  pickEnglishVoice: function () {
    var voices = speechSynthesis.getVoices() || [];
    return voices.find(function (v) { return /^en(-|_|$)/i.test(v.lang) && /us/i.test(v.lang); })
      || voices.find(function (v) { return /^en(-|_|$)/i.test(v.lang); })
      || null;
  },
  browserSpeak: function (text, rate) {
    var self = this;
    return new Promise(function (resolve) {
      self.stop();
      var u = new SpeechSynthesisUtterance(text);
      u.lang = "en-US";
      u.rate = rate || 1;
      var voice = self.pickEnglishVoice();
      if (voice) u.voice = voice;
      u.onend = function () { resolve("browser"); };
      u.onerror = function () { resolve("browser"); };
      speechSynthesis.speak(u);
    });
  },
  playBlob: function (blob) {
    var self = this;
    var a = this.ensure();
    if (this.currentUrl) {
      try { URL.revokeObjectURL(this.currentUrl); } catch (e) {}
    }
    this.currentUrl = URL.createObjectURL(blob);
    a.src = this.currentUrl;
    return a.play().then(function () {
      return new Promise(function (resolve, reject) {
        a.onended = function () { resolve("cloud"); };
        a.onerror = function () { reject(new Error("audio")); };
      });
    });
  },
  speak: function (text, opts) {
    opts = opts || {};
    var rate = opts.rate == null ? 1 : opts.rate;
    var self = this;
    this.ensure();
    return fetch("https://tts.a1b2.cc", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Shuoban-Key": window.ShuobanGate },
      body: JSON.stringify({ text: text, rate: rate })
    }).then(function (r) {
      if (!r.ok) throw new Error("tts-http");
      return r.blob();
    }).then(function (blob) {
      return self.playBlob(blob).catch(function () {
        self.unlock();
        return self.playBlob(blob);
      });
    }).catch(function () {
      return self.browserSpeak(text, rate);
    });
  }
};
if (window.speechSynthesis) speechSynthesis.addEventListener("voiceschanged", function () {});
