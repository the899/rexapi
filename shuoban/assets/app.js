const html = htm.bind(React.createElement);
const { useState, useEffect, useRef } = React;

function load() {
  try {
    localStorage.removeItem("shuoban_tts_url");
    var s = JSON.parse(localStorage.getItem("shuoban") || "{}");
    delete s.ttsUrl;
    return s;
  } catch (e) { return {}; }
}
function save(s) { localStorage.setItem("shuoban", JSON.stringify(s)); }

function Chip({ kind, text }) {
  return html`<span className=${"chip " + kind}>${text}</span>`;
}

function App() {
  const store0 = load();
  const [view, setView] = useState("list");
  const [assignDraft, setAssignDraft] = useState(null);
  const [assignment, setAssignment] = useState(store0.assignment || {
    themeIds: ["club", "canteen", "ball", "corner"],
    n: 2,
    target: "会说"
  });
  const [best, setBest] = useState(store0.best || {});
  const [runs, setRuns] = useState(store0.runs || {});
  const [theme, setTheme] = useState(null);
  const [i, setI] = useState(0);
  const [phase, setPhase] = useState("a");
  const [teachStep, setTeachStep] = useState(1);
  const [teachRounds, setTeachRounds] = useState(0);
  const [silenceN, setSilenceN] = useState(0);
  const [usedTeach, setUsedTeach] = useState(false);
  const [hadClose, setHadClose] = useState(false);
  const [padded, setPadded] = useState(false);
  const [lineMarks, setLineMarks] = useState([]);
  const [holding, setHolding] = useState(false);
  const [toast, setToast] = useState("");
  const [typed, setTyped] = useState("");
  const [showFull, setShowFull] = useState(true);
  const asrPromise = useRef(null);
  const n = assignment.n || 2;

  useEffect(() => {
    save({ assignment, best, runs });
  }, [assignment, best, runs]);

  const themes = (window.SHUOBAN_THEMES || []).filter((t) => t.unit === "U1");
  const pairs = theme ? theme.pairs.slice(0, n) : [];
  const pair = pairs[i];
  const keywordMode = theme && (runs[theme.id] || 0) >= 2;

  function ping(msg) {
    setToast(msg);
    setTimeout(() => setToast(""), 1600);
  }

  function openTheme(t) {
    setTheme(t);
    setI(0);
    setPhase("a");
    setTeachStep(1);
    setTeachRounds(0);
    setSilenceN(0);
    setUsedTeach(false);
    setHadClose(false);
    setPadded(false);
    setLineMarks([]);
    setShowFull(!((runs[t.id] || 0) >= 2));
    setView("intro");
  }

  function playA() {
    if (!pair) return;
    setPhase("a");
    ShuobanTTS.speak(pair.a).then(() => setPhase("b"));
  }

  function startTalk() {
    ShuobanTTS.unlock();
    setView("talk");
    setTimeout(playA, 200);
  }

  function finishTheme(marks, flags) {
    const allPass = marks.every((m) => m === "过了");
    let rating = "会说";
    if (flags.padded) rating = "再练";
    else if (!allPass || flags.usedTeach || flags.hadClose) rating = "还生";
    const order = { "再练": 0, "还生": 1, "会说": 2 };
    const prev = best[theme.id];
    const nextBest = !prev || order[rating] > order[prev] ? rating : prev;
    const nextBestMap = Object.assign({}, best, { [theme.id]: nextBest });
    const nextRuns = Object.assign({}, runs, { [theme.id]: (runs[theme.id] || 0) + 1 });
    setBest(nextBestMap);
    setRuns(nextRuns);
    setLineMarks(marks);
    setView("replay");
    setPhase("done");
    ping(rating);
  }

  function nextLine(mark, flags) {
    const marks = lineMarks.concat([mark]);
    const f = {
      usedTeach: usedTeach || flags.usedTeach,
      hadClose: hadClose || flags.hadClose,
      padded: padded || flags.padded
    };
    setUsedTeach(f.usedTeach);
    setHadClose(f.hadClose);
    setPadded(f.padded);
    setLineMarks(marks);
    setTeachRounds(0);
    setSilenceN(0);
    setTeachStep(1);
    if (i + 1 >= pairs.length) finishTheme(marks, f);
    else {
      setI(i + 1);
      setPhase("a");
      setTimeout(() => {
        const nxt = pairs[i + 1];
        ShuobanTTS.speak(nxt.a).then(() => setPhase("b"));
      }, 250);
    }
  }

  function onSaid(text) {
    const g = ShuobanJudge.grade(text, pair);
    if (g === "silence") {
      const c = silenceN + 1;
      setSilenceN(c);
      ping(c >= 3 ? "先听这一截" : "没听清，再说一次");
      if (c >= 3) ShuobanTTS.speak(pair.c1);
      setPhase("b");
      return;
    }
    if (phase === "teach" && teachStep === 2) {
      setTeachStep(3);
      return;
    }
    if (phase === "teach" && teachStep === 3) {
      setTeachStep(4);
      ShuobanTTS.speak(pair.a);
      return;
    }
    if (g === "pass") {
      ping("过了");
      nextLine("过了", { usedTeach: phase === "teach" || usedTeach, hadClose: false, padded: false });
      return;
    }
    if (g === "close" && phase !== "teach") {
      ping("接近");
      nextLine("接近", { usedTeach: false, hadClose: true, padded: false });
      return;
    }
    // fail
    if (phase === "teach") {
      const rounds = teachRounds + 1;
      setTeachRounds(rounds);
      setUsedTeach(true);
      if (rounds >= 2) {
        ping("这句先带过去");
        ShuobanTTS.speak(pair.b);
        nextLine("再练", { usedTeach: true, hadClose: false, padded: true });
      } else {
        ping("再跟我读");
        setTeachStep(1);
        setPhase("teach");
        ShuobanTTS.speak(pair.b);
      }
      return;
    }
    setUsedTeach(true);
    setPhase("teach");
    setTeachStep(1);
    ping("听我的");
    ShuobanTTS.speak(pair.b);
  }

  function holdStart(ev) {
    ev.preventDefault();
    if (holding) return;
    setHolding(true);
    if (ShuobanASR.available()) {
      asrPromise.current = ShuobanASR.startHold();
    }
  }
  function holdEnd(ev) {
    ev.preventDefault();
    if (!holding) return;
    setHolding(false);
    if (ShuobanASR.available()) {
      ShuobanASR.stopHold();
      (asrPromise.current || Promise.resolve("")).then(onSaid).catch(function () { onSaid(""); });
    } else if (typed) {
      onSaid(typed);
      setTyped("");
    } else {
      ping("请打出你说的句子");
    }
  }

  function skipTeach() {
    ShuobanTTS.speak(pair.b);
    nextLine("再练", { usedTeach: true, hadClose: false, padded: true });
  }

  const header = (right) => html`
    <header className="bar">
      <b>说伴</b>
      <span>${right || ""}</span>
    </header>`;

  if (view === "list") {
    return html`<div id="app">
      ${header(html`<button className="link" onClick=${() => { setAssignDraft({ themeIds: assignment.themeIds.slice(), n: assignment.n, target: assignment.target }); setView("assign1"); }}>布置</button>`)}
      <main>
        <div className="unit">七年级上 · Unit 1</div>
        <h2 style=${{ fontSize: 20, marginBottom: 12 }}>尝试新事物</h2>
        <div className="goal">布置：开口 <em>${assignment.n} 次</em>，练到 <em>${assignment.target}</em></div>
        ${themes.map((t) => {
          const b = best[t.id];
          const kind = b === "会说" ? "ok" : b === "还生" ? "mid" : b === "再练" ? "low" : "none";
          const inTask = assignment.themeIds.indexOf(t.id) >= 0;
          return html`<button key=${t.id} className="card" style=${{ width: "100%", textAlign: "left", cursor: "pointer" }} onClick=${() => openTheme(t)}>
            <div className="grow">
              <h3>${t.name}</h3>
              <p>${inTask ? "任务中" : "可自练"} · A-B × ${assignment.n}</p>
            </div>
            <${Chip} kind=${kind} text=${b || "未练"} />
          </button>`;
        })}
        <p className="hint">点主题开始或重练。勾不会掉。</p>
      </main>
    </div>`;
  }

  if (view === "assign1") {
    const d = assignDraft;
    return html`<div id="app">
      ${header(html`<button className="link" onClick=${() => setView("list")}>取消</button>`)}
      <main>
        <h2 style=${{ fontSize: 20, marginBottom: 8 }}>布置任务</h2>
        <p className="hint" style=${{ marginBottom: 12 }}>选孩子这次要练的主题</p>
        ${themes.map((t) => {
          const on = d.themeIds.indexOf(t.id) >= 0;
          return html`<button key=${t.id} className=${"card " + (on ? "on" : "")} style=${{ width: "100%", textAlign: "left" }}
            onClick=${() => {
              const ids = on ? d.themeIds.filter((x) => x !== t.id) : d.themeIds.concat([t.id]);
              setAssignDraft(Object.assign({}, d, { themeIds: ids }));
            }}>
            <div className=${"box " + (on ? "" : "off")}>✓</div>
            <div className="grow"><h3>${t.name}</h3><p>${best[t.id] || "未练"}</p></div>
          </button>`;
        })}
        <div style=${{ marginTop: "auto" }}>
          <button className="btn primary" onClick=${() => setView("assign2")}>下一步</button>
        </div>
      </main>
    </div>`;
  }

  if (view === "assign2") {
    const d = assignDraft;
    return html`<div id="app">
      ${header(html`<button className="link" onClick=${() => setView("assign1")}>上一步</button>`)}
      <main>
        <h2 style=${{ fontSize: 20, marginBottom: 12 }}>定规则</h2>
        <div className="field">
          <div className="k">开口次数</div>
          <div className="stepper">
            <button className="pm" onClick=${() => setAssignDraft(Object.assign({}, d, { n: Math.max(1, d.n - 1) }))}>−</button>
            <div className="n">${d.n}</div>
            <button className="pm" onClick=${() => setAssignDraft(Object.assign({}, d, { n: Math.min(4, d.n + 1) }))}>+</button>
          </div>
        </div>
        <div className="field">
          <div className="k">要达到</div>
          <div className="seg">
            <button className=${d.target === "还生" ? "on" : ""} onClick=${() => setAssignDraft(Object.assign({}, d, { target: "还生" }))}>还生</button>
            <button className=${d.target === "会说" ? "on" : ""} onClick=${() => setAssignDraft(Object.assign({}, d, { target: "会说" }))}>会说</button>
          </div>
        </div>
        <p className="hint">会说 = 一次说对、没被教。还生 = 能演完即可。</p>
        <div style=${{ marginTop: "auto" }}>
          <button className="btn primary" onClick=${() => { setAssignment({ themeIds: d.themeIds, n: d.n, target: d.target }); setView("list"); }}>布置好了</button>
        </div>
      </main>
    </div>`;
  }

  if (view === "intro") {
    return html`<div id="app">
      ${header(html`<button className="link" onClick=${() => setView("list")}>返回</button>`)}
      <main>
        <div className="unit">Unit 1 · ${theme.name}</div>
        <h2 style=${{ fontSize: 22, margin: "8px 0 4px" }}>这一段你是 B</h2>
        <p className="hint">说伴当 A，先开口。你接 ${n} 句就演完。</p>
        <div className="cast">
          <div className="who"><div className="avatar a">A</div><h3>说伴</h3><p>先说</p></div>
          <div className="who you"><div className="avatar b">B</div><h3>你</h3><p>接话</p></div>
        </div>
        <p className="hint" style=${{ textAlign: "center" }}>开口 ${n} 次 · 目标 ${assignment.target}</p>
        <div style=${{ marginTop: "auto" }}><button className="btn primary" onClick=${startTalk}>开始</button></div>
      </main>
    </div>`;
  }

  if (view === "talk" && pair) {
    const dots = pairs.map((_, idx) => html`<i className=${idx <= i ? "on" : ""}></i>`);
    const bPrompt = (keywordMode && !showFull) ? pair.kw.join(" / ") : pair.b;
    const teach = phase === "teach";
    return html`<div id="app">
      ${header(theme.name + " · " + (i + 1) + "/" + pairs.length)}
      <main>
        <div className="dots">${dots}</div>
        <div className="bubble">${pair.a}</div>
        ${!teach && html`
          <div className="turn">${phase === "a" ? "说伴在说…" : "轮到你了"}</div>
          <div className="prompt" onClick=${() => keywordMode && setShowFull(!showFull)}>${bPrompt}</div>
          <p className="hint">${keywordMode ? (showFull ? "点句子收成关键词" : "点关键词看全句") : "先看见全句"} · ${pair.kw.join(" / ")}</p>
        `}
        ${teach && html`
          <div className="panel">
            <div className="bar">${[1,2,3,4].map((s) => html`<i className=${s <= teachStep ? "on" : ""}></i>`)}</div>
            <div className="step">教 · ${teachStep}/4</div>
            <div className="title">${["听我的","跟两截","合成句","接着演"][teachStep-1]}</div>
            <div className="prompt">${teachStep === 2 ? pair.c1 : pair.b}</div>
            <p className="hint">${teachStep === 1 ? "慢速示范，听完再开口。" : teachStep === 2 ? "先跟前半句。" : teachStep === 3 ? "两截合成一句。" : "对着 A 再说一遍。"}</p>
            ${teachStep === 1 && html`<button className="btn ghost" onClick=${() => { setTeachStep(2); ping("跟两截"); }}>听完了</button>`}
            <button className="btn ghost" onClick=${skipTeach}>先跳过教</button>
          </div>
        `}
        <div className="hold-wrap">
          ${!ShuobanASR.available() && html`<input className="typed" placeholder="设备不能听时，打出你说的句子" value=${typed} onInput=${(e) => setTyped(e.target.value)} />`}
          <button className=${"btn hold" + (holding ? " rec" : "")}
            onMouseDown=${holdStart} onMouseUp=${holdEnd} onMouseLeave=${holding ? holdEnd : undefined}
            onTouchStart=${holdStart} onTouchEnd=${holdEnd}
            disabled=${phase === "a" || (teach && teachStep === 1)}
          >${holding ? "松开" : "按住\n说话"}</button>
          <small>松开就停 · 对话中不弹档</small>
        </div>
      </main>
      ${toast && html`<div className="toast">${toast}</div>`}
    </div>`;
  }

  if (view === "replay") {
    const rating = (() => {
      const allPass = lineMarks.every((m) => m === "过了");
      if (padded) return "再练";
      if (!allPass || usedTeach || hadClose) return "还生";
      return "会说";
    })();
    const rateClass = rating === "会说" ? "ok" : rating === "再练" ? "low" : "";
    const met = rating === "会说" || (assignment.target === "还生" && rating !== "再练");
    return html`<div id="app">
      ${header("回放")}
      <main>
        <div className=${"rate " + rateClass}>
          <div className="big">${rating}</div>
          <p>目标 ${assignment.target} · ${met ? "任务这题完成" : "还没到目标，可再来"}</p>
        </div>
        ${pairs.map((p, idx) => html`
          <div className="item" key=${idx}>
            <div className="tag">A${idx+1}</div>
            <div className="line">${p.a}</div>
            <button className="toggle" onClick=${() => ShuobanTTS.speak(p.a)}>说伴</button>
          </div>
          <div className="item" key=${"b"+idx}>
            <div className="tag">B${idx+1}</div>
            <div>
              <div className="line">${p.b}</div>
              <div className="sub">${lineMarks[idx] || ""}</div>
            </div>
            <button className="toggle" onClick=${() => ShuobanTTS.speak(p.b)}>示范</button>
          </div>
        `)}
        <div className="row">
          <button className="btn secondary" onClick=${() => setView("list")}>返回</button>
          <button className="btn primary" style=${{ flex: 1.4, height: 46 }} onClick=${() => openTheme(theme)}>再来一次</button>
        </div>
      </main>
    </div>`;
  }

  return html`<div id="app"><main><p>加载中…</p></main></div>`;
}

ReactDOM.createRoot(document.getElementById("root")).render(html`<${App} />`);
