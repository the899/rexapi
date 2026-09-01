window.ShuobanASR = {
  Recognition: window.SpeechRecognition || window.webkitSpeechRecognition,
  available: function () {
    return !!this.Recognition;
  },
  rec: null,
  startHold: function () {
    var self = this;
    return new Promise(function (resolve, reject) {
      if (!self.Recognition) {
        reject(new Error("no-asr"));
        return;
      }
      try { if (self.rec) self.rec.abort(); } catch (e) {}
      var rec = new self.Recognition();
      self.rec = rec;
      rec.lang = "en-US";
      rec.interimResults = false;
      rec.maxAlternatives = 1;
      rec.continuous = false;
      var got = "";
      rec.onresult = function (e) {
        if (e.results && e.results[0] && e.results[0][0]) {
          got = e.results[0][0].transcript || "";
        }
      };
      rec.onerror = function (e) {
        if (e.error === "no-speech" || e.error === "aborted") resolve("");
        else reject(e);
      };
      rec.onend = function () { resolve(got); };
      try { rec.start(); } catch (err) { reject(err); }
    });
  },
  stopHold: function () {
    try { if (this.rec) this.rec.stop(); } catch (e) {}
  }
};

window.ShuobanJudge = {
  normalize: function (s) {
    return String(s || "")
      .toLowerCase()
      .replace(/i['’]m/g, "i am")
      .replace(/won['’]t/g, "will not")
      .replace(/['’]/g, "")
      .replace(/[^a-z\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  },
  grade: function (said, pair) {
    var n = this.normalize(said);
    if (!n || n.length < 2) return "silence";
    var kws = (pair.kw || []).map(this.normalize);
    if (!kws.length) return n.length > 0 ? "pass" : "silence";
    var hit = kws.filter(function (k) { return k && n.indexOf(k) !== -1; }).length;
    if (hit === kws.length) return "pass";
    if (hit >= Math.max(1, Math.ceil(kws.length * 0.5))) return "close";
    return "fail";
  }
};
