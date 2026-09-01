window.ShuobanTTS = {
  stop: function () {
    try { speechSynthesis.cancel(); } catch (e) {}
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
  speak: function (text, opts) {
    opts = opts || {};
    var rate = opts.rate == null ? 1 : opts.rate;
    var endpoint = localStorage.getItem("shuoban_tts_url") || "";
    var self = this;
    if (!endpoint) return this.browserSpeak(text, rate);
    return fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: text, rate: rate })
    }).then(function (r) {
      if (!r.ok) throw new Error("tts-http");
      return r.blob();
    }).then(function (blob) {
      return new Promise(function (resolve, reject) {
        var audio = new Audio(URL.createObjectURL(blob));
        audio.onended = function () { resolve("cloud"); };
        audio.onerror = reject;
        audio.play().catch(reject);
      });
    }).catch(function () {
      return self.browserSpeak(text, rate);
    });
  }
};
if (window.speechSynthesis) speechSynthesis.addEventListener("voiceschanged", function () {});
