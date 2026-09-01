window.ShuobanGate = window.ShuobanGate || "oJaVRr2PPOGGsdYk98P2YrD4qMXY0o-p";
window.ShuobanTTS = {
  volume: 1,
  rate: 1,
  audio: null,
  currentUrl: null,
  unlocked: false,
  applyVolume: function (a) {
    var v = Math.max(0, Math.min(1, this.volume));
    try { a.volume = v; } catch (e) {}
  },
  ensure: function () {
    if (!this.audio) {
      this.audio = new Audio();
      this.audio.setAttribute("playsinline", "true");
      this.audio.preload = "auto";
    }
    this.applyVolume(this.audio);
    return this.audio;
  },
  reset: function () {
    this.stop();
    this.audio = null;
    return this.ensure();
  },
  unlock: function () {
    var a = this.ensure();
    this.unlocked = true;
    this.applyVolume(a);
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
        this.audio.onended = null;
        this.audio.onerror = null;
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
  browserSpeak: function (text) {
    var self = this;
    var rate = this.rate;
    var vol = Math.max(0, Math.min(1, this.volume));
    return new Promise(function (resolve) {
      self.stop();
      var u = new SpeechSynthesisUtterance(text);
      u.lang = "en-US";
      u.rate = rate;
      u.volume = vol;
      var voice = self.pickEnglishVoice();
      if (voice) u.voice = voice;
      u.onend = function () { resolve("browser"); };
      u.onerror = function () { resolve("browser"); };
      speechSynthesis.speak(u);
    });
  },
  playBlob: function (blob) {
    var self = this;
    var a = this.reset();
    if (this.currentUrl) {
      try { URL.revokeObjectURL(this.currentUrl); } catch (e) {}
    }
    this.currentUrl = URL.createObjectURL(blob);
    this.applyVolume(a);
    a.src = this.currentUrl;
    this.applyVolume(a);
    var play = a.play();
    this.applyVolume(a);
    return (play || Promise.resolve()).then(function () {
      self.applyVolume(a);
      return new Promise(function (resolve, reject) {
        a.onended = function () { resolve("cloud"); };
        a.onerror = function () { reject(new Error("audio")); };
      });
    });
  },
  speak: function (text) {
    var self = this;
    try { localStorage.removeItem("shuoban_tts_url"); } catch (e) {}
    this.stop();
    return fetch("https://tts.a1b2.cc", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Shuoban-Key": window.ShuobanGate },
      body: JSON.stringify({ text: text, rate: this.rate, volume: this.volume })
    }).then(function (r) {
      if (!r.ok) throw new Error("tts-http");
      return r.blob();
    }).then(function (blob) {
      return self.playBlob(blob).catch(function () {
        self.unlock();
        return self.playBlob(blob);
      });
    }).catch(function () {
      return self.browserSpeak(text);
    });
  }
};
if (window.speechSynthesis) speechSynthesis.addEventListener("voiceschanged", function () {});
