import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, "public");
loadEnvFile(path.join(__dirname, ".env"));
loadEnvFile(path.join(__dirname, ".env.local"));

const port = Number(process.env.PORT || 3000);
const provider = (process.env.LLM_PROVIDER || process.env.AI_PROVIDER || "openai").toLowerCase();
const providerDefaults = {
  openai: { baseUrl: "https://api.openai.com/v1", model: "gpt-4o-mini" },
  deepseek: { baseUrl: "https://api.deepseek.com", model: "deepseek-chat" },
  doubao: { baseUrl: "https://ark.cn-beijing.volces.com/api/v3", model: "请填写你的火山方舟推理接入点ID" },
  compatible: { baseUrl: "https://api.openai.com/v1", model: "gpt-4o-mini" },
};
const defaults = providerDefaults[provider] || providerDefaults.compatible;
const model = process.env.LLM_MODEL || process.env.OPENAI_MODEL || defaults.model;
const baseUrl = (process.env.LLM_BASE_URL || process.env.OPENAI_BASE_URL || defaults.baseUrl).replace(/\/$/, "");
const apiKey = process.env.LLM_API_KEY || process.env.OPENAI_API_KEY || "";

const scenes = {
  freechat: {
    id: "freechat",
    title: "自由语伴聊天",
    emoji: "💬",
    npcName: "小语",
    npcRole: "AI 中文语伴",
    map: "自由练习 · 没有固定任务",
    story: "完成场景练习后，你可以在这里和 AI 自由聊天。你可以聊学习、旅行、生活、兴趣，也可以让 AI 扮演老师或朋友。系统仍会保留实时纠错、渐进提示和词块辅助。",
    stages: ["自由开场", "深入追问", "表达扩展", "自然交流", "复盘总结"],
    targetGrammar: ["自然表达", "语序", "词语搭配", "连接词", "礼貌表达"],
    hintTiles: ["我想聊", "关于", "因为", "所以", "但是", "我觉得", "你能不能", "举个例子"],
    focus: "自由聊天时先表达观点，再补充原因或例子。",
  },
  hotpot: {
    id: "hotpot",
    title: "成都火锅店",
    emoji: "🌶️",
    npcName: "小蓉",
    npcRole: "火锅店服务员",
    map: "宽窄巷子 · 老火锅",
    story: "你刚到成都，朋友还没来。你需要独自完成点锅底、点菜、调辣度、询问打包和结账。服务员会穿插推荐、确认和误会。",
    stages: ["入座问候", "点锅底", "点菜", "调整辣度", "打包/结账"],
    targetGrammar: ["量词", "把字句", "程度补语", "礼貌请求", "选择疑问句"],
    hintTiles: ["请问", "我想", "点", "一份/一道", "微辣", "不要太", "可以", "把", "打包", "吗"],
    focus: "用礼貌请求完成点餐，不要只说名词。",
  },
  market: {
    id: "market",
    title: "夜市砍价",
    emoji: "🏮",
    npcName: "陈老板",
    npcRole: "夜市摊主",
    map: "西安夜市 · 纪念品摊",
    story: "你想买一个小礼物，但老板报价偏高。你需要询问价格、比较两个商品、礼貌砍价，最后决定买不买。",
    stages: ["询问价格", "比较商品", "表达太贵", "提出条件", "成交/离开"],
    targetGrammar: ["比较句", "太……了", "能愿动词", "如果……就……", "礼貌拒绝"],
    hintTiles: ["这个", "比", "那个", "贵", "一点", "能不能", "便宜", "如果", "我就", "考虑"],
    focus: "先比较，再提出条件，不要直接说“便宜”。",
  },
  subway: {
    id: "subway",
    title: "北京地铁问路",
    emoji: "🚇",
    npcName: "老周",
    npcRole: "地铁志愿者",
    map: "北京地铁 · 换乘大厅",
    story: "你赶时间去见老师。需要说清目的地、确认路线、换乘站、出口和大概时间。广播会临时改变出口。",
    stages: ["说明目的地", "询问线路", "确认换乘", "确认出口", "复述路线"],
    targetGrammar: ["先……再……", "方位词", "结果补语", "疑问句", "复述表达"],
    hintTiles: ["请问", "去", "怎么", "坐", "几号线", "先", "再", "换乘", "出口", "最近"],
    focus: "用“先……再……”复述路线。",
  },
  clinic: {
    id: "clinic",
    title: "社区诊所",
    emoji: "🏥",
    npcName: "林护士",
    npcRole: "门诊护士",
    map: "社区医院 · 挂号台",
    story: "你身体不舒服，但不知道挂哪个科。需要描述症状、持续时间、严重程度，并确认号源。",
    stages: ["描述症状", "说明时间", "表达程度", "选择科室", "确认号源"],
    targetGrammar: ["有点儿", "持续了", "程度补语", "应该", "时间表达"],
    hintTiles: ["我", "有点儿", "头疼", "咳嗽", "持续了", "两天", "应该", "挂", "哪个科", "还有号吗"],
    focus: "症状 + 时间 + 程度要说完整。",
  },
  apartment: {
    id: "apartment",
    title: "上海租房看房",
    emoji: "🏠",
    npcName: "阿杰",
    npcRole: "房产中介",
    map: "上海 · 老小区看房",
    story: "你正在看房。中介说房子很抢手，你需要询问租金、交通、押金、合同和噪音，避免仓促决定。",
    stages: ["询问租金", "比较交通", "确认押金", "查看合同", "提出条件"],
    targetGrammar: ["比较句", "离……近/远", "如果……就……", "能不能", "条件表达"],
    hintTiles: ["这间房", "比", "那间", "离地铁", "更近", "押金", "合同", "能不能", "便宜一点", "如果"],
    focus: "用比较和条件表达谈判，而不是只说“太贵”。",
  },
};

const analysisSchema = {
  type: "object",
  additionalProperties: false,
  required: ["score", "summary", "intent", "correctedSentence", "issues", "hint", "mastery"],
  properties: {
    score: { type: "number" },
    summary: { type: "string" },
    intent: { type: "string" },
    correctedSentence: { type: "string" },
    mastery: { type: "string", enum: ["struggling", "developing", "good", "excellent"] },
    hint: {
      type: "object",
      additionalProperties: false,
      required: ["nudge", "focus", "wordTiles", "sentenceFrame", "challenge"],
      properties: {
        nudge: { type: "string" },
        focus: { type: "string" },
        wordTiles: { type: "array", items: { type: "string" } },
        sentenceFrame: { type: "string" },
        challenge: { type: "string" },
      },
    },
    issues: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["type", "original", "replacement", "reason", "feedback", "severity"],
        properties: {
          type: { type: "string" },
          original: { type: "string" },
          replacement: { type: "string" },
          reason: { type: "string" },
          severity: { type: "string", enum: ["low", "medium", "high"] },
          feedback: {
            type: "object",
            additionalProperties: false,
            required: ["recast", "elicitation", "meta"],
            properties: {
              recast: { type: "string" },
              elicitation: { type: "string" },
              meta: { type: "string" },
            },
          },
        },
      },
    },
  },
};

const chatSchema = {
  type: "object",
  additionalProperties: false,
  required: ["assistantText", "mood", "progressDelta", "stageIndex", "microEvent", "analysis"],
  properties: {
    assistantText: { type: "string" },
    mood: { type: "string" },
    progressDelta: { type: "number" },
    stageIndex: { type: "number" },
    microEvent: { type: "string" },
    analysis: analysisSchema,
  },
};

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return;
  const lines = readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const index = trimmed.indexOf("=");
    const key = trimmed.slice(0, index).trim();
    let value = trimmed.slice(index + 1).trim();
    value = value.replace(/^['"]|['"]$/g, "");
    if (!process.env[key]) process.env[key] = value;
  }
}

createServer(async (request, response) => {
  try {
    const url = new URL(request.url || "/", `http://${request.headers.host}`);
    if (request.method === "GET" && url.pathname === "/api/status") return json(response, getStatus());
    if (request.method === "GET" && url.pathname === "/api/scenes") return json(response, { scenes });
    if (request.method === "POST" && url.pathname === "/api/analyze") return json(response, await handleAnalyze(await readJson(request)));
    if (request.method === "POST" && url.pathname === "/api/chat") return json(response, await handleChat(await readJson(request)));
    return serveStatic(url.pathname, response);
  } catch (error) {
    console.error(error);
    return json(response, { error: "SERVER_ERROR", message: error.message, status: getStatus() }, 500);
  }
}).listen(port, () => {
  console.log(`语伴探游记已启动：http://localhost:${port}`);
  console.log(`AI 状态：${getStatus().mode}，Provider：${provider}，模型：${model}，Base URL：${baseUrl}`);
});

function getStatus() {
  const key = apiKey || "";
  const hasKey = Boolean(key && !key.includes("your-key") && !key.includes("sk-your") && !key.includes("请在这里") && !key.includes("你的") && !key.includes("your-") && key.length > 12);
  return {
    mode: hasKey ? "ai-ready" : "local-fallback",
    hasKey,
    provider,
    model,
    baseUrl,
    message: hasKey ? `已检测到 ${provider} 模型密钥` : "未检测到有效模型密钥，当前使用本地兜底规则",
  };
}

async function handleAnalyze(body) {
  const text = String(body.text || "").trim();
  const scene = scenes[body.sceneId] || scenes.hotpot;
  if (!text) return emptyAnalysis(scene);
  if (!getStatus().hasKey) return localAnalyze(text, scene, "未配置有效 API Key，当前使用本地兜底。", false);

  const prompt = `你是一个结合多邻国式脚手架和国际中文教育理论的实时中文纠错引擎。
场景：${scene.title}
故事：${scene.story}
阶段：${scene.stages.join(" -> ")}
重点语法：${scene.targetGrammar.join("、")}
学生输入：${text}

任务：
1. 实时诊断学生输入，尽量发现真实偏误，但不要过度纠错。
2. 不要直接把完整答案当成提示给学生。hint 只能给渐进帮助：nudge 是一句引导问题；wordTiles 给 4-8 个可选择词块；sentenceFrame 用空格/括号保留思考空间，例如“我想____一____，可以____吗？”。
3. correctedSentence 可以给完整重铸句，但它用于纠错卡，不用于“提示区”。
4. issues 覆盖：语序、量词、搭配、补语、把字句、了/过/着、比较句、能愿动词、疑问句、礼貌表达、语气自然度。
5. 面向 HSK3-4 学生，解释简洁。`;

  try {
    return normalizeAnalysis(await callOpenAI(prompt, analysisSchema, "analysis_response"));
  } catch (error) {
    return localAnalyze(text, scene, `AI 连接失败，已切换本地兜底：${error.message}`, false);
  }
}

async function handleChat(body) {
  const scene = scenes[body.sceneId] || scenes.hotpot;
  const text = String(body.text || "").trim();
  const stageIndex = Number(body.stageIndex || 0);
  const messages = Array.isArray(body.messages) ? body.messages.slice(-10) : [];
  const transcript = messages.map((m) => `${m.role === "user" ? "学习者" : "NPC"}：${m.text}`).join("\n");

  if (!getStatus().hasKey) {
    const analysis = localAnalyze(text, scene, "未配置有效 API Key，当前使用本地兜底。", false);
    return localChat(scene, text, analysis, stageIndex);
  }

  const prompt = `你是《语伴探游记》的 NPC 和中文学习教练。请像多邻国关卡一样互动：有故事、有小目标、有轻微挑战，不直接给答案。
场景：${scene.title}
NPC：${scene.npcName}（${scene.npcRole}）
故事背景：${scene.story}
当前阶段序号：${stageIndex}
阶段列表：${scene.stages.join(" -> ")}
重点语法：${scene.targetGrammar.join("、")}

最近对话：
${transcript || "暂无"}

学生最新输入：${text}

输出要求：
1. assistantText 用 NPC 口吻回应，并推进当前阶段；不要像客服，要有场景感。
2. 如果学生表达有明显偏误，先确认意思，再温和指出“可以看右侧提示改一改”，不要在 assistantText 中直接给完整正确句。
3. analysis.hint 只给渐进提示：引导问题、词块、句框、挑战，不直接给完整句。
4. progressDelta：表达自然且完成当前阶段为 1；否则为 0。
5. microEvent 偶尔制造小事件，例如老板追问、出口关闭、医生号紧张。`;

  try {
    return normalizeChat(await callOpenAI(prompt, chatSchema, "chat_response"));
  } catch (error) {
    const analysis = localAnalyze(text, scene, `AI 连接失败，已切换本地兜底：${error.message}`, false);
    return localChat(scene, text, analysis, stageIndex);
  }
}

async function callOpenAI(prompt, schema, name) {
  const schemaText = JSON.stringify(schema, null, 2);
  const messages = [
    {
      role: "system",
      content: `你必须只输出合法 JSON，不要 Markdown，不要代码块。JSON 必须符合这个 schema：\n${schemaText}`,
    },
    { role: "user", content: prompt },
  ];

  const data = await postChatCompletions(`${baseUrl}/chat/completions`, {
    model,
    messages,
    temperature: 0.4,
    response_format: { type: "json_object" },
  });
  const outputText = data.choices?.[0]?.message?.content || "";
  if (!outputText) throw new Error("模型返回为空，请检查模型名称或接口地址。DeepSeek 建议 LLM_MODEL=deepseek-chat；豆包请填写火山方舟推理接入点 ID。");
  return parseModelJson(outputText);
}

async function postChatCompletions(url, body) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Number(process.env.LLM_TIMEOUT_MS || process.env.OPENAI_TIMEOUT_MS || 25000));
  try {
    const res = await fetch(url, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error?.message || data.message || `模型接口 HTTP ${res.status}`);
    return data;
  } catch (error) {
    if (error.name === "AbortError") throw new Error(`连接 ${provider} 超时，可检查网络或 LLM_BASE_URL。`);
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function parseModelJson(text) {
  const trimmed = text.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "").trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(trimmed.slice(start, end + 1));
    throw new Error("模型没有返回合法 JSON，请降低 temperature 或更换支持 JSON 输出的模型。原始返回：" + trimmed.slice(0, 120));
  }
}

function normalizeChat(chat) {
  return {
    ...chat,
    analysis: normalizeAnalysis(chat.analysis || emptyAnalysis(scenes.hotpot)),
  };
}

function normalizeAnalysis(analysis) {
  const safe = {
    score: Number.isFinite(Number(analysis.score)) ? Number(analysis.score) : 75,
    summary: analysis.summary || "??????",
    intent: analysis.intent || "????",
    correctedSentence: analysis.correctedSentence || "",
    mastery: ["struggling", "developing", "good", "excellent"].includes(analysis.mastery) ? analysis.mastery : "developing",
    hint: analysis.hint || { nudge: "??????????", focus: "????????", wordTiles: [], sentenceFrame: "??____???____??", challenge: "?????????????" },
    issues: Array.isArray(analysis.issues) ? analysis.issues : [],
  };
  safe.issues = safe.issues.map((issue) => normalizeIssue(issue));
  return safe;
}

function normalizeIssue(issue) {
  const normalized = {
    type: normalizeIssueType(issue.type, issue),
    original: issue.original || "",
    replacement: issue.replacement || issue.original || "",
    reason: issue.reason || "???????????",
    severity: ["low", "medium", "high"].includes(issue.severity) ? issue.severity : "medium",
    feedback: issue.feedback || {},
  };
  normalized.feedback = {
    recast: normalized.feedback.recast || normalized.replacement,
    elicitation: normalized.feedback.elicitation || `?????????????`,
    meta: normalized.feedback.meta || normalized.reason,
  };
  return normalized;
}

function normalizeIssueType(type, issue = {}) {
  const raw = String(type || "").trim();
  if (raw && !/missing|unspecified|unknown|null|undefined/i.test(raw)) return raw;
  return "\u8868\u8fbe\u95ee\u9898";
}

function localChat(scene, text, analysis, stageIndex) {
  const hasIssues = analysis.issues.length > 0;
  const nextStage = Math.min(scene.stages.length - 1, stageIndex + (hasIssues ? 0 : 1));
  const event = pickMicroEvent(scene.id, stageIndex);
  return {
    assistantText: hasIssues
      ? `${scene.npcName}：我大概听懂你想表达“${analysis.intent}”。不过这句话有一点不自然，先看右侧提示改一改，我再继续追问你。`
      : `${scene.npcName}：说得很清楚！${event} 现在请继续完成“${scene.stages[nextStage]}”。`,
    mood: hasIssues ? "耐心等待" : "开心推进",
    progressDelta: hasIssues ? 0 : 1,
    stageIndex: nextStage,
    microEvent: event,
    analysis,
  };
}

function localAnalyze(text, scene, prefix = "本地规则分析。", includeAnswer = true) {
  const issues = [];
  const add = (type, original, replacement, reason, severity = "medium") => {
    if (!original || issues.some((item) => item.original === original && item.type === type)) return;
    issues.push({
      type,
      original,
      replacement,
      reason,
      severity,
      feedback: {
        recast: text.replace(original, replacement),
        elicitation: `这里可以不用“${original}”，你能换成更自然的说法吗？`,
        meta: reason,
      },
    });
  };

  const measure = text.match(/一?个(菜|票|水|米饭|面|药|房间|毛肚|锅底)/);
  if (measure) {
    const map = { 菜: "一道菜", 票: "一张票", 水: "一瓶水", 米饭: "一碗米饭", 面: "一碗面", 药: "一盒药", 房间: "一间房", 毛肚: "一份毛肚", 锅底: "一个锅底" };
    add("量词", measure[0], map[measure[1]] || `一份${measure[1]}`, "名词前要选合适量词，例如“一份毛肚”“一瓶水”。");
  }
  const order = text.match(/(我|我们)(想|要|可以)?(吃|去|买|坐|看|租)(.{1,16}?)(今天|明天|现在|下午|上午)/);
  if (order) add("语序", order[0], `${order[1]}${order[5]}${order[2] || ""}${order[3]}${order[4]}`, "时间词通常放在主语后、动词前。", "high");
  const ba = text.match(/(打包|带走|退|换|取消)(这个|这些|它|菜|票|房间|毛肚)/);
  if (ba) add("把字句", ba[0], `把${ba[2]}${ba[1]}`, "强调处理某个确定对象时，可用“把 + 对象 + 动词”。");
  const degree = text.match(/(很|非常|太)(辣|贵|疼|远|麻烦)了?一点/);
  if (degree) add("程度表达", degree[0], degree[1] === "太" ? `太${degree[2]}了` : `有点儿${degree[2]}`, "“有点儿”表示轻微负面感受；“太……了”表示程度很高。", "low");
  const collocation = text.match(/吃水|喝饭|喝菜|喝药|坐路|走地铁/);
  if (collocation) {
    const map = { 吃水: "喝水", 喝饭: "吃饭", 喝菜: "吃菜", 喝药: "吃药", 坐路: "走路/坐车", 走地铁: "坐地铁" };
    add("搭配", collocation[0], map[collocation[0]], "汉语中有些动词和名词有固定搭配。", "medium");
  }
  const modal = text.match(/我可以(要|想|需要)/);
  if (modal) add("能愿动词", modal[0], modal[0].replace("可以", "想"), "表达愿望常用“我想……”，请求许可可说“可以……吗”。");
  const compare = text.match(/(.{1,8})比(.{1,8})(很|非常)(贵|便宜|快|慢|远|近)/);
  if (compare) add("比较句", compare[0], `${compare[1]}比${compare[2]}${compare[4]}一些`, "比较句里通常不直接用“很/非常”。");
  const punctuation = text.match(/(吗|呢|吧)\?/);
  if (punctuation) add("疑问表达", punctuation[0], `${punctuation[1]}？`, "中文疑问句建议使用中文问号“？”。", "low");

  const correctedSentence = issues.reduce((sentence, issue) => sentence.replace(issue.original, issue.replacement), text);
  const score = Math.max(42, 100 - issues.length * 14 - issues.filter((item) => item.severity === "high").length * 10);
  return {
    score,
    summary: `${prefix}${issues.length ? ` 发现 ${issues.length} 个可改进点。` : " 暂未发现明显错误。"}`,
    intent: inferIntent(text),
    correctedSentence: includeAnswer ? correctedSentence : correctedSentence,
    mastery: score >= 90 ? "excellent" : score >= 78 ? "good" : score >= 60 ? "developing" : "struggling",
    hint: buildHint(text, scene, issues),
    issues,
  };
}

function buildHint(text, scene, issues) {
  const firstType = issues[0]?.type || scene.targetGrammar[0];
  const selected = scene.hintTiles.slice(0, 8);
  return {
    nudge: issues.length ? `先想一想：这句话里“${issues[0].original}”是不是少了更合适的表达方式？` : `试着推进当前任务：${scene.stages[1] || scene.stages[0]}。`,
    focus: `本关重点：${firstType}。${scene.focus}`,
    wordTiles: selected,
    sentenceFrame: makeFrame(scene.id),
    challenge: issues.length ? "不用看完整答案，先用词块重新组织一句。" : "尝试加入一个礼貌表达，比如“请问/可以……吗”。",
  };
}

function makeFrame(sceneId) {
  const frames = {
    hotpot: "我想____一____，可以____吗？",
    market: "这个比____，能不能____一点？",
    subway: "请问去____，先____再____吗？",
    clinic: "我____，已经____，应该____？",
    apartment: "如果____可以____，我就____。",
  };
  return frames[sceneId] || "我想____，可以____吗？";
}

function inferIntent(text) {
  if (/打包|带走/.test(text)) return "请求打包";
  if (/辣|锅|菜|点|毛肚/.test(text)) return "点餐沟通";
  if (/便宜|贵|多少钱|价格/.test(text)) return "询价/砍价";
  if (/怎么去|几号线|出口|换乘/.test(text)) return "问路";
  if (/疼|咳嗽|挂|科|号/.test(text)) return "挂号就医";
  if (/租|押金|合同|地铁/.test(text)) return "租房咨询";
  return "继续对话";
}

function pickMicroEvent(sceneId, stageIndex) {
  const events = {
    hotpot: ["服务员突然推荐一份隐藏菜单。", "旁边客人说这个锅底很辣。", "店里马上要打烊了。"],
    market: ["老板说这个价格已经很低。", "旁边摊位看起来更便宜。", "老板拿出另一个颜色让你比较。"],
    subway: ["广播提示一个出口临时关闭。", "下一班车马上进站。", "地图上两个站名很像。"],
    clinic: ["护士追问症状持续多久。", "上午号源快没了。", "医生需要你描述疼痛程度。"],
    apartment: ["中介说下午还有人来看房。", "房东要求押二付一。", "窗外有一点噪音。"],
  };
  const list = events[sceneId] || events.hotpot;
  return list[stageIndex % list.length];
}

function emptyAnalysis(scene) {
  return {
    score: 100,
    summary: "请输入一句中文。",
    intent: "",
    correctedSentence: "",
    mastery: "developing",
    hint: buildHint("", scene, []),
    issues: [],
  };
}

async function serveStatic(urlPath, response) {
  const requested = urlPath === "/" ? "/index.html" : decodeURIComponent(urlPath);
  const filePath = path.normalize(path.join(publicDir, requested));
  if (!filePath.startsWith(publicDir) || !existsSync(filePath)) return text(response, "Not found", 404);
  const ext = path.extname(filePath);
  const contentType = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8" }[ext] || "application/octet-stream";
  response.writeHead(200, { "Content-Type": contentType });
  response.end(await readFile(filePath));
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => (body += chunk));
    request.on("end", () => resolve(body ? JSON.parse(body) : {}));
    request.on("error", reject);
  });
}

function json(response, data, status = 200) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(data));
}

function text(response, data, status = 200) {
  response.writeHead(status, { "Content-Type": "text/plain; charset=utf-8" });
  response.end(data);
}



