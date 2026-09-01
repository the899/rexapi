window.ShuobanGate = window.ShuobanGate || "oJaVRr2PPOGGsdYk98P2YrD4qMXY0o-p";
window.ShuobanASR = {
  endpoint: "https://tts.a1b2.cc/asr",
  rec: null,
  chunks: null,
  mime: "audio/webm",
  wantStop: false,
  available: function () {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder);
  },
  startHold: function () {
    var self = this;
    this.wantStop = false;
    return new Promise(function (resolve, reject) {
      navigator.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
        var mime = "";
        ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].forEach(function (m) {
          if (!mime && MediaRecorder.isTypeSupported(m)) mime = m;
        });
        self.mime = mime || "audio/webm";
        self.chunks = [];
        var rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
        self.rec = rec;
        rec.ondataavailable = function (e) {
          if (e.data && e.data.size) self.chunks.push(e.data);
        };
        rec.onerror = function () {
          stream.getTracks().forEach(function (t) { t.stop(); });
          resolve("");
        };
        rec.onstop = function () {
          stream.getTracks().forEach(function (t) { t.stop(); });
          var blob = new Blob(self.chunks, { type: self.mime });
          if (blob.size < 200) { resolve(""); return; }
          fetch(self.endpoint, { method: "POST", headers: { "Content-Type": self.mime, "X-Shuoban-Key": window.ShuobanGate }, body: blob })
            .then(function (r) { return r.json(); })
            .then(function (d) { resolve((d && d.text) || ""); })
            .catch(function () { resolve(""); });
        };
        rec.start();
        if (self.wantStop && rec.state === "recording") rec.stop();
      }).catch(reject);
    });
  },
  stopHold: function () {
    this.wantStop = true;
    try {
      if (this.rec && this.rec.state === "recording") this.rec.stop();
    } catch (e) {}
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
