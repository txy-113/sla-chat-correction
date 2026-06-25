const fallbackScenes = {
  hotpot: { id: "hotpot", title: "成都火锅店", emoji: "🌶️", npcName: "小蓉", npcRole: "火锅店服务员", map: "宽窄巷子 · 老火锅", story: "独自完成点锅底、点菜、调辣度、询问打包和结账。", stages: ["入座问候", "点锅底", "点菜", "调整辣度", "打包/结账"], hintTiles: ["请问", "我想", "点", "一份/一道", "微辣", "可以", "把", "打包"] },
};

const STORAGE_KEY = "yuban-ai-product-state-v4";
const ANALYZE_DEBOUNCE_MS = 1200;

const state = {
  scenes: fallbackScenes,
  sceneId: "hotpot",
  stageIndex: 0,
  messages: [],
  input: "",
  liveAnalysis: null,
  reviews: [],
  loading: false,
  analyzing: false,
  apiStatus: { mode: "detecting", message: "正在检测 AI 连接..." },
  hintLevel: 0,
  selectedTiles: [],
  activePanel: "hint",
  sceneStates: {},
};

let debounceTimer;

async function init() {
  await Promise.allSettled([loadScenes(), loadStatus()]);
  restoreAppState();
  if (!state.messages.length) resetScene(state.sceneId, true);
  render();
}

async function loadScenes() {
  const data = await getJson("/api/scenes");
  state.scenes = data.scenes;
}

async function loadStatus() {
  state.apiStatus = await getJson("/api/status");
}

function currentScene() {
  return state.scenes[state.sceneId] || Object.values(state.scenes)[0];
}

function resetScene(sceneId, skipSaveCurrent = false) {
  if (!skipSaveCurrent) saveCurrentSceneState();
  const scene = state.scenes[sceneId] || currentScene();
  state.sceneId = scene.id;
  const saved = state.sceneStates[scene.id];
  if (saved) {
    state.stageIndex = saved.stageIndex || 0;
    state.messages = saved.messages || [];
    state.input = saved.input || "";
    state.liveAnalysis = saved.liveAnalysis || null;
    state.hintLevel = saved.hintLevel || 0;
    state.selectedTiles = saved.selectedTiles || [];
    state.activePanel = saved.activePanel || "hint";
    return;
  }
  startFreshScene(scene.id, true);
}

function startFreshScene(sceneId = state.sceneId, skipSaveCurrent = false) {
  if (!skipSaveCurrent) saveCurrentSceneState();
  const scene = state.scenes[sceneId] || currentScene();
  state.sceneId = scene.id;
  state.stageIndex = 0;
  state.input = "";
  state.liveAnalysis = null;
  state.hintLevel = 0;
  state.selectedTiles = [];
  state.activePanel = "hint";
  state.messages = [{ role: "assistant", text: `${scene.npcName}\uFF1A${scene.story} \u5148\u4ECE\u201C${scene.stages[0]}\u201D\u5F00\u59CB\u5427\u3002` }];
  saveCurrentSceneState();
}

function restoreAppState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    state.sceneId = saved.sceneId || state.sceneId;
    state.sceneStates = saved.sceneStates || {};
    if (state.sceneStates[state.sceneId]) resetScene(state.sceneId, true);
  } catch {
    state.sceneStates = {};
  }
}

function saveCurrentSceneState() {
  if (!state.sceneId) return;
  state.sceneStates[state.sceneId] = {
    stageIndex: state.stageIndex,
    messages: state.messages,
    input: state.input,
    liveAnalysis: state.liveAnalysis,
    hintLevel: state.hintLevel,
    selectedTiles: state.selectedTiles,
    activePanel: state.activePanel,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ sceneId: state.sceneId, sceneStates: state.sceneStates }));
}

function render() {
  const scene = currentScene();
  const stagePercent = Math.min(100, (state.stageIndex / Math.max(1, scene.stages.length - 1)) * 100);
  document.querySelector("#app").innerHTML = `
    <main class="app-shell">
      <header class="topbar glass">
        <div class="brand"><div class="logo">语</div><div><span>Duolingo-inspired AI Chinese Adventure</span><h1>语伴探游记</h1></div></div>
        <div class="ai-pill ${state.apiStatus.mode === "ai-ready" ? "ready" : "fallback"}">
          <b>${state.apiStatus.mode === "ai-ready" ? "AI 已连接" : "本地兜底"}</b><small>${escapeHtml(state.apiStatus.message || "")}</small>
        </div>
      </header>

      <section class="layout">
        <aside class="map-panel glass">
          <div class="map-title"><span>Adventure Map</span><h2>选择关卡</h2></div>
          <div class="scene-list">${orderedScenes().map(sceneCard).join("")}</div>
          <button class="refresh" data-action="status">重新检测 AI</button>
        </aside>

        <section class="lesson glass">
          <div class="lesson-head">
            <div class="npc-avatar">${scene.emoji}</div>
            <div><span>${escapeHtml(scene.map)}</span><h2>${scene.title}</h2><p>${scene.npcName} · ${scene.npcRole}</p></div>
            <button class="restart" data-action="restart-scene" type="button">重新开始</button>
          </div>
          <div class="stage-track">
            <div class="track-label"><b>${scene.stages[state.stageIndex] || scene.stages.at(-1)}</b><span>${state.stageIndex + 1}/${scene.stages.length}</span></div>
            <div class="track"><i style="width:${stagePercent}%"></i></div>
            <div class="stage-dots">${scene.stages.map((stage, index) => `<button class="${index <= state.stageIndex ? "done" : ""}" title="${escapeHtml(stage)}">${index + 1}</button>`).join("")}</div>
          </div>
          <div class="messages">${state.messages.map(messageTemplate).join("")}${state.loading ? `<article class="assistant"><div class="bubble typing">NPC 正在听你的表达，并准备追问...</div></article>` : ""}</div>
          <section class="answer-lab">
            <div class="lab-tabs"><button class="${state.activePanel === "hint" ? "active" : ""}" data-panel="hint">渐进提示</button><button class="${state.activePanel === "tiles" ? "active" : ""}" data-panel="tiles">词块拼句</button><button class="${state.activePanel === "type" ? "active" : ""}" data-panel="type">自己输入</button></div>
            ${answerPanel()}
          </section>
        </section>

        <aside class="coach glass">
          <div class="coach-card score-card">${scoreTemplate()}</div>
          <div class="coach-card">${analysisTemplate()}</div>
          <div class="coach-card">${reviewTemplate()}</div>
        </aside>
      </section>
    </main>`;
  bindEvents();
  const box = document.querySelector(".messages");
  if (box) box.scrollTop = box.scrollHeight;
}

function orderedScenes() {
  const list = Object.values(state.scenes);
  return [...list.filter((scene) => scene.id !== "freechat"), ...list.filter((scene) => scene.id === "freechat")];
}

function sceneCard(scene) {
  const active = scene.id === state.sceneId;
  return `<button class="scene-card ${active ? "active" : ""}" data-scene="${scene.id}"><span>${scene.emoji}</span><div><b>${escapeHtml(scene.title)}</b><small>${escapeHtml(scene.focus || scene.story)}</small></div></button>`;
}

function messageTemplate(message) {
  return `<article class="message ${message.role}"><div class="bubble">${escapeHtml(message.text)}</div></article>`;
}

function answerPanel() {
  if (state.activePanel === "tiles") return tilesPanel();
  if (state.activePanel === "type") return inputPanel();
  return hintPanel();
}

function hintPanel() {
  const scene = currentScene();
  const hint = state.liveAnalysis?.hint || {
    nudge: `先想：你现在要完成“${scene.stages[state.stageIndex]}”，该怎么礼貌开口？`,
    focus: scene.focus || "注意礼貌表达和语序。",
    wordTiles: scene.hintTiles || [],
    sentenceFrame: "我想____，可以____吗？",
    challenge: "先自己说一遍，再点开下一层提示。",
  };
  const blocks = [
    `<div class="hint-step unlocked"><span>1</span><div><b>想一想</b><p>${escapeHtml(hint.nudge)}</p></div></div>`,
    `<div class="hint-step ${state.hintLevel >= 1 ? "unlocked" : "locked"}"><span>2</span><div><b>关注点</b><p>${state.hintLevel >= 1 ? escapeHtml(hint.focus) : "点击下方按钮解锁语法关注点"}</p></div></div>`,
    `<div class="hint-step ${state.hintLevel >= 2 ? "unlocked" : "locked"}"><span>3</span><div><b>句子框架</b><p>${state.hintLevel >= 2 ? escapeHtml(hint.sentenceFrame) : "保留空格，不直接给答案"}</p></div></div>`,
  ];
  return `<div class="hint-panel">${blocks.join("")}<button class="unlock" data-action="unlock-hint">${state.hintLevel >= 2 ? "已解锁全部提示" : "再给我一点提示"}</button>${inputPanel()}</div>`;
}

function tilesPanel() {
  const scene = currentScene();
  const tiles = state.liveAnalysis?.hint?.wordTiles?.length ? state.liveAnalysis.hint.wordTiles : scene.hintTiles;
  return `<div class="tiles-panel"><div class="tile-answer">${state.selectedTiles.map((tile, index) => `<button data-remove-tile="${index}">${escapeHtml(tile)}</button>`).join("") || "<span>点击词块来组织你的句子</span>"}</div><div class="tile-bank">${tiles.map((tile) => `<button data-tile="${escapeHtml(tile)}">${escapeHtml(tile)}</button>`).join("")}</div><div class="tile-actions"><button data-action="clear-tiles">清空</button><button data-action="use-tiles">放入输入框</button></div>${inputPanel()}</div>`;
}

function inputPanel() {
  return `<form class="composer" data-form><textarea placeholder="先自己组织一句。输入停顿后会实时分析，但提示不会直接给完整答案。">${escapeHtml(state.input)}</textarea><button ${state.loading ? "disabled" : ""}>发送</button></form>`;
}

function scoreTemplate() {
  const analysis = state.liveAnalysis;
  const score = analysis?.score ?? 0;
  const label = analysis ? masteryLabel(analysis.mastery) : "等待输入";
  return `<div class="score-ring" style="--score:${score * 3.6}deg"><b>${analysis ? score : "--"}</b></div><div><h3>${label}</h3><p>${analysis ? escapeHtml(analysis.summary) : "输入中文后会实时显示表达分。"}</p></div>`;
}

function analysisTemplate() {
  if (state.analyzing) return `<h2>实时教练</h2><div class="empty pulse">正在分析你的表达...</div>`;
  const analysis = state.liveAnalysis;
  if (!analysis) return `<h2>实时教练</h2><div class="empty">这里会显示偏误、提示层级和纠错卡。</div>`;
  return `<h2>实时教练</h2><div class="intent">意图：${escapeHtml(analysis.intent || "待判断")}</div>${analysis.issues.length ? analysis.issues.map(issueTemplate).join("") : `<div class="empty ok">暂未发现明显错误，试着继续推进关卡。</div>`}`;
}

function issueTemplate(issue) {
  const blue = "\u{1F535}";
  const green = "\u{1F7E2}";
  const orange = "\u{1F7E0}";
  return `<article class="issue"><div><b>${escapeHtml(displayIssueType(issue.type, issue))}</b><span>${severityLabel(issue.severity)}</span></div><p><mark>${escapeHtml(issue.original)}</mark><em class="thinking-gap">先想想这里该怎么改</em></p><small>${escapeHtml(issue.reason)}</small><details><summary>我想好了，查看完整纠错</summary><p><b>建议替换</b>: ${escapeHtml(issue.replacement)}</p><p>${blue} ${escapeHtml(issue.feedback.recast)}</p><p>${green} ${escapeHtml(issue.feedback.elicitation)}</p><p>${orange} ${escapeHtml(issue.feedback.meta)}</p></details></article>`;
}

function reviewTemplate() {
  const counts = state.reviews.reduce((acc, item) => { const type = displayIssueType(item.type, item); acc[type] = (acc[type] || 0) + 1; return acc; }, {});
  const bars = Object.entries(counts).map(([type, count]) => `<div class="bar"><span>${escapeHtml(type)}</span><i style="width:${Math.min(100, count * 24)}%"></i><b>${count}</b></div>`).join("");
  const recent = state.reviews.slice(-4).reverse().map((item) => `<li><b>${escapeHtml(displayIssueType(item.type, item))}</b>${escapeHtml(item.original)} &rarr; ${escapeHtml(item.replacement)}</li>`).join("");
  return `<h2>成长档案</h2>${bars || `<div class="empty">还没有错题记录。</div>`}<ul class="recent">${recent}</ul>`;
}

function bindEvents() {
  document.querySelectorAll("[data-scene]").forEach((button) => button.addEventListener("click", () => { resetScene(button.dataset.scene); saveCurrentSceneState(); render(); }));
  document.querySelector("[data-action='status']")?.addEventListener("click", async () => { await loadStatus(); render(); });
  document.querySelector("[data-action='restart-scene']")?.addEventListener("click", () => { if (confirm("确定要重新开始当前关卡吗？之前记录会被清空。")) { delete state.sceneStates[state.sceneId]; startFreshScene(state.sceneId, true); saveCurrentSceneState(); render(); } });
  document.querySelectorAll("[data-panel]").forEach((button) => button.addEventListener("click", () => { state.activePanel = button.dataset.panel; saveCurrentSceneState(); render(); }));
  document.querySelector("[data-action='unlock-hint']")?.addEventListener("click", () => { state.hintLevel = Math.min(2, state.hintLevel + 1); saveCurrentSceneState(); render(); });
  document.querySelectorAll("[data-tile]").forEach((button) => button.addEventListener("click", () => { state.selectedTiles.push(button.dataset.tile); saveCurrentSceneState(); render(); }));
  document.querySelectorAll("[data-remove-tile]").forEach((button) => button.addEventListener("click", () => { state.selectedTiles.splice(Number(button.dataset.removeTile), 1); saveCurrentSceneState(); render(); }));
  document.querySelector("[data-action='clear-tiles']")?.addEventListener("click", () => { state.selectedTiles = []; saveCurrentSceneState(); render(); });
  document.querySelector("[data-action='use-tiles']")?.addEventListener("click", () => updateInput(state.selectedTiles.join("")));
  document.querySelectorAll("textarea").forEach((textarea) => textarea.addEventListener("input", (event) => updateInput(event.target.value, false)));
  document.querySelector("[data-form]")?.addEventListener("submit", sendMessage);
}

function updateInput(value, rerender = true) {
  state.input = value;
  clearTimeout(debounceTimer);
  if (value.trim().length >= 2) {
    state.analyzing = true;
    debounceTimer = setTimeout(() => analyze(value), ANALYZE_DEBOUNCE_MS);
  } else {
    state.liveAnalysis = null;
    state.analyzing = false;
  }
  saveCurrentSceneState();
  if (rerender) render();
}

async function analyze(text) {
  try {
    const data = await postJson("/api/analyze", { sceneId: state.sceneId, text, stageIndex: state.stageIndex });
    state.liveAnalysis = data;
    state.apiStatus.mode = data.summary?.includes("兜底") || data.summary?.includes("失败") ? "local-fallback" : "ai-ready";
  } catch (error) {
    state.liveAnalysis = null;
    state.apiStatus = { mode: "local-fallback", message: `AI 连接失败：${error.message}` };
  } finally {
    state.analyzing = false;
    saveCurrentSceneState();
    render();
  }
}

async function sendMessage(event) {
  event.preventDefault();
  const text = state.input.trim();
  if (!text || state.loading) return;
  state.messages.push({ role: "user", text });
  state.input = "";
  state.selectedTiles = [];
  state.loading = true;
  render();
  try {
    const data = await postJson("/api/chat", { sceneId: state.sceneId, text, stageIndex: state.stageIndex, messages: state.messages });
    state.messages.push({ role: "assistant", text: `${currentScene().npcName}：${data.assistantText}` });
    state.stageIndex = Math.max(state.stageIndex, Math.min(currentScene().stages.length - 1, data.stageIndex ?? state.stageIndex));
    state.liveAnalysis = data.analysis;
    state.reviews.push(...data.analysis.issues);
    state.hintLevel = data.analysis.issues.length ? 1 : 0;
    state.apiStatus.mode = data.analysis.summary?.includes("兜底") || data.analysis.summary?.includes("失败") ? "local-fallback" : "ai-ready";
  } catch (error) {
    state.messages.push({ role: "assistant", text: `连接 AI 失败：${error.message}。请检查右上角状态，或在 .env 配置 OPENAI_API_KEY / OPENAI_BASE_URL。` });
  } finally {
    state.loading = false;
    saveCurrentSceneState();
    render();
  }
}

async function getJson(url) {
  const res = await fetch(url);
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || data.error || "请求失败");
  return data;
}

async function postJson(url, body) {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || data.error || "请求失败");
  return data;
}

function displayIssueType(type, issue = {}) {
  const value = String(type || "").trim();
  if (value && !/missing|unspecified|unknown|null|undefined/i.test(value)) return value;
  return "\u8868\u8fbe\u95ee\u9898";
}

function masteryLabel(mastery) {
  return { struggling: "需要脚手架", developing: "正在形成", good: "表达不错", excellent: "非常自然" }[mastery] || "实时反馈";
}

function severityLabel(severity) {
  return { low: "可优化", medium: "需注意", high: "影响理解" }[severity] || severity;
}

function escapeHtml(value = "") {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

init();



