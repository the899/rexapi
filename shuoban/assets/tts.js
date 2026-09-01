window.ShuobanGate = window.ShuobanGate || "oJaVRr2PPOGGsdYk98P2YrD4qMXY0o-p";
window.ShuobanTTS = {
  volume: 1,
  rate: 1,
  ctx: null,
  gain: null,
  comp: null,
  source: null,
  audio: null,
  currentUrl: null,
  unlocked: false,
  ensureEl: function () {
    if (!this.audio) {
      this.audio = new Audio();
      this.audio.setAttribute("playsinline", "true");
      this.audio.setAttribute("webkit-playsinline", "true");
      this.audio.preload = "auto";
    }
    this.audio.volume = Math.max(0, Math.min(1, this.volume));
    return this.audio;
  },
  ensureCtx: function () {
    var self = this;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return Promise.reject(new Error("no-ctx"));
    if (!this.ctx) {
      this.ctx = new AC();
      this.gain = this.ctx.createGain();
      this.comp = this.ctx.createDynamicsCompressor();
      this.comp.threshold.value = -18;
      this.comp.knee.value = 8;
      this.comp.ratio.value = 6;
      this.comp.attack.value = 0.003;
      this.comp.release.value = 0.15;
      this.gain.connect(this.comp);
      this.comp.connect(this.ctx.destination);
    }
    this.gain.gain.value = Math.max(0, Math.min(1, this.volume));
    var p = this.ctx.state === "suspended" ? this.ctx.resume() : Promise.resolve();
    return Promise.resolve(p).then(function () { return self.ctx; });
  },
  unlock: function () {
    this.unlocked = true;
    this.ensureEl();
    this.ensureCtx().then(function (ctx) {
      var buf = ctx.createBuffer(1, Math.max(1, Math.floor(ctx.sampleRate * 0.05)), ctx.sampleRate);
      var src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(ctx.destination);
      try { src.start(0); } catch (e) {}
    }).catch(function () {});
  },
  stopSource: function () {
    try {
      if (this.source) {
        this.source.onended = null;
        this.source.stop();
      }
    } catch (e) {}
    this.source = null;
  },
  stop: function () {
    try { speechSynthesis.cancel(); } catch (e) {}
    this.stopSource();
    try {
      if (this.audio) {
        this.audio.pause();
        this.audio.onended = null;
        this.audio.onerror = null;
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
  decode: function (ctx, raw) {
    return new Promise(function (resolve, reject) {
      var copy = raw.slice(0);
      var done = false;
      var ok = function (buf) { if (done) return; done = true; resolve(buf); };
      var fail = function (e) { if (done) return; done = true; reject(e || new Error("decode")); };
      try {
        var p = ctx.decodeAudioData(copy, ok, fail);
        if (p && p.then) p.then(ok, fail);
      } catch (e) { fail(e); }
    });
  },
  playBlob: function (blob) {
    var self = this;
    this.stopSource();
    return this.ensureCtx().then(function (ctx) {
      return blob.arrayBuffer().then(function (raw) {
        return self.decode(ctx, raw);
      }).then(function (audioBuf) {
        var src = ctx.createBufferSource();
        src.buffer = audioBuf;
        src.connect(self.gain);
        self.source = src;
        self.gain.gain.value = Math.max(0, Math.min(1, self.volume));
        return new Promise(function (resolve, reject) {
          src.onended = function () {
            if (self.source === src) self.source = null;
            resolve("cloud");
          };
          try { src.start(0); } catch (e) { reject(e); }
        });
      });
    }).catch(function () {
      return self.playEl(blob);
    });
  },
  playEl: function (blob) {
    var self = this;
    var a = this.ensureEl();
    if (this.currentUrl) {
      try { URL.revokeObjectURL(this.currentUrl); } catch (e) {}
    }
    this.currentUrl = URL.createObjectURL(blob);
    a.volume = Math.max(0, Math.min(1, this.volume));
    a.src = this.currentUrl;
    return a.play().then(function () {
      return new Promise(function (resolve, reject) {
        a.onended = function () { resolve("cloud"); };
        a.onerror = function () { reject(new Error("audio")); };
      });
    });
  },
  mem: {},
  inflight: {},
  idb: null,
  keyOf: function (text) {
    return "v1|" + this.rate + "|" + this.volume + "|" + text;
  },
  openDb: function () {
    var self = this;
    if (this.idb) return Promise.resolve(this.idb);
    return new Promise(function (resolve) {
      try {
        var req = indexedDB.open("shuoban-tts", 1);
        req.onupgradeneeded = function () {
          if (!req.result.objectStoreNames.contains("clips")) req.result.createObjectStore("clips");
        };
        req.onsuccess = function () { self.idb = req.result; resolve(self.idb); };
        req.onerror = function () { resolve(null); };
      } catch (e) { resolve(null); }
    });
  },
  idbGet: function (key) {
    return this.openDb().then(function (db) {
      if (!db) return null;
      return new Promise(function (resolve) {
        try {
          var q = db.transaction("clips", "readonly").objectStore("clips").get(key);
          q.onsuccess = function () { resolve(q.result || null); };
          q.onerror = function () { resolve(null); };
        } catch (e) { resolve(null); }
      });
    });
  },
  idbPut: function (key, blob) {
    return this.openDb().then(function (db) {
      if (!db) return;
      try { db.transaction("clips", "readwrite").objectStore("clips").put(blob, key); } catch (e) {}
    });
  },
  fetchClip: function (text) {
    var self = this;
    var key = this.keyOf(text);
    if (this.mem[key]) return Promise.resolve(this.mem[key]);
    if (this.inflight[key]) return this.inflight[key];
    var p = this.idbGet(key).then(function (hit) {
      if (hit) { self.mem[key] = hit; return hit; }
      return fetch("https://tts.a1b2.cc", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Shuoban-Key": window.ShuobanGate },
        body: JSON.stringify({ text: text, rate: self.rate, volume: self.volume })
      }).then(function (r) {
        if (!r.ok) throw new Error("tts-http");
        return r.blob();
      }).then(function (blob) {
        self.mem[key] = blob;
        self.idbPut(key, blob);
        return blob;
      });
    });
    this.inflight[key] = p;
    p.then(function () { delete self.inflight[key]; }, function () { delete self.inflight[key]; });
    return p;
  },
  prefetch: function (texts, onProgress) {
    var self = this;
    var list = [];
    var seen = {};
    (texts || []).forEach(function (t) {
      if (t && !seen[t]) { seen[t] = 1; list.push(t); }
    });
    var total = list.length;
    var done = 0;
    if (onProgress) onProgress(0, total);
    if (!total) return Promise.resolve();
    var i = 0;
    function next() {
      if (i >= list.length) return Promise.resolve();
      var t = list[i++];
      return self.fetchClip(t).catch(function () { return null; }).then(function () {
        done += 1;
        if (onProgress) onProgress(done, total);
        return next();
      });
    }
    return Promise.all([next(), next()]);
  },
  speak: function (text) {
    var self = this;
    try { localStorage.removeItem("shuoban_tts_url"); } catch (e) {}
    this.stop();
    return this.fetchClip(text).then(function (blob) {
      return self.playBlob(blob);
    }).catch(function () {
      return self.browserSpeak(text);
    });
  }
};
if (window.speechSynthesis) speechSynthesis.addEventListener("voiceschanged", function () {});
