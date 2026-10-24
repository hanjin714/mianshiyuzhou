// ============================================================
// 大模型接入：OpenAI 兼容 / Gemini / 本地降级
// ============================================================
import { WORLDS } from './content.js';

const STORE_KEY = 'interviewverse.llm.v1';

const DEFAULT_CFG = {
  provider: 'local',
  baseURL: 'https://api.deepseek.com/v1',
  apiKey: '',
  model: 'deepseek-chat',
  geminiModel: 'gemini-2.0-flash',
};

function load() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    return raw ? { ...DEFAULT_CFG, ...JSON.parse(raw) } : { ...DEFAULT_CFG };
  } catch {
    return { ...DEFAULT_CFG };
  }
}

export const LLM = {
  cfg: load(),
  save(next) {
    this.cfg = { ...this.cfg, ...next };
    try { localStorage.setItem(STORE_KEY, JSON.stringify(this.cfg)); } catch { /* ignore */ }
  },
  isOnline() {
    return this.cfg.provider !== 'local' && !!this.cfg.apiKey;
  },
  label() {
    if (!this.isOnline()) return 'LOCAL ENGINE';
    return this.cfg.provider === 'gemini' ? `GEMINI · ${this.cfg.geminiModel}` : `LLM · ${this.cfg.model}`;
  },
};

// ---------- 底层调用 ----------
function stripFence(text) {
  return text.replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
}

function extractJSON(text) {
  const raw = stripFence(String(text || '').trim());
  try { return JSON.parse(raw); } catch { /* next */ }
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start >= 0 && end > start) {
    try { return JSON.parse(raw.slice(start, end + 1)); } catch { /* next */ }
  }
  return null;
}

async function withTimeout(promise, ms) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error('请求超时')), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

async function callOpenAI(messages, { json = true, maxTokens = 1200 } = {}) {
  const base = LLM.cfg.baseURL.replace(/\/+$/, '');
  const url = `${base}/chat/completions`;
  const body = {
    model: LLM.cfg.model,
    messages,
    temperature: 0.95,
    max_tokens: maxTokens,
    stream: false,
  };
  if (json) body.response_format = { type: 'json_object' };

  const doFetch = async (payload) => fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${LLM.cfg.apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  let res;
  try {
    res = await withTimeout(doFetch(body), 32000);
    if (!res.ok && res.status === 400 && json) {
      const clone = { ...body };
      delete clone.response_format;
      res = await withTimeout(doFetch(clone), 32000);
    }
  } catch (e) {
    throw new Error(`连接失败：${e.message}`);
  }

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`接口 ${res.status}：${errText.slice(0, 160)}`);
  }
  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw new Error('模型返回为空');
  return text;
}

async function callGemini(system, user, { json = true, maxTokens = 1200 } = {}) {
  const model = LLM.cfg.geminiModel || 'gemini-2.0-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(LLM.cfg.apiKey)}`;
  const body = {
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: 'user', parts: [{ text: user }] }],
    generationConfig: {
      temperature: 0.95,
      maxOutputTokens: maxTokens,
      ...(json ? { responseMimeType: 'application/json' } : {}),
    },
  };
  let res;
  try {
    res = await withTimeout(fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }), 32000);
  } catch (e) {
    throw new Error(`连接失败：${e.message}`);
  }
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Gemini ${res.status}：${errText.slice(0, 160)}`);
  }
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join('\n');
  if (!text) throw new Error('Gemini 返回为空');
  return text;
}

async function chat(system, user, opts) {
  if (LLM.cfg.provider === 'gemini') return callGemini(system, user, opts);
  return callOpenAI([{ role: 'system', content: system }, { role: 'user', content: user }], opts);
}

// ---------- 本地题库 ----------
const usedQuestionIndex = new Set();

function fallbackQuestion(worldId, npcIndex) {
  const world = WORLDS[worldId];
  const pool = world.questions
    .map((q, i) => ({ ...q, i }))
    .filter((q) => Math.floor(q.i / 3) === npcIndex);
  const fresh = pool.filter((q) => !usedQuestionIndex.has(`${worldId}:${q.i}`));
  const pick = (fresh.length ? fresh : pool)[Math.floor(Math.random() * (fresh.length || pool.length))];
  usedQuestionIndex.add(`${worldId}:${pick.i}`);
  const dims = world.dims.map((d) => d.key);
  return {
    source: 'local',
    question: pick[0],
    options: pick[1].map(([text, scores, reaction], idx) => ({
      id: 'ABCD'[idx],
      text,
      reaction,
      scores: Object.fromEntries(dims.map((k, di) => [k, scores[di] ?? 2])),
    })),
  };
}

function normalizeQuestion(raw, fallback, dims) {
  if (!raw || typeof raw !== 'object') return fallback;
  const question = String(raw.question || '').trim();
  const opts = Array.isArray(raw.options) ? raw.options : [];
  if (question.length < 6 || opts.length < 3) return fallback;

  const options = opts.slice(0, 4).map((o, i) => {
    const scores = {};
    dims.forEach((d) => {
      const v = Number(o?.scores?.[d]);
      scores[d] = Number.isFinite(v) ? Math.max(0, Math.min(4, Math.round(v))) : 2;
    });
    return {
      id: 'ABCD'[i],
      text: String(o?.text || '').trim(),
      reaction: String(o?.reaction || o?.note || '面试官在记录里写下了一行字。').trim(),
      scores,
    };
  }).filter((o) => o.text.length > 0);

  if (options.length < 3) return fallback;
  return { source: 'ai', question, options };
}

// ---------- 对外：出题 ----------
export async function generateQuestion({ worldId, npcIndex, qIndex, history }) {
  const world = WORLDS[worldId];
  const npc = world.npcs[npcIndex];
  const fallback = fallbackQuestion(worldId, npcIndex);

  if (!LLM.isOnline()) return fallback;

  const dimText = world.dims.map((d, i) => `${i + 1}. ${d.key}（${d.name}）`).join('\n');
  const histText = history.length
    ? history.map((h, i) => `第${i + 1}题：${h.question}\n候选人选择：${h.answer}`).join('\n\n')
    : '（尚无历史问答）';

  const system = `你是《面试宇宙 / INTERVIEWVERSE》的面试官系统，服务于「悖论矩阵」。
你只输出合法 JSON，不输出 markdown、不输出解释。
你出的题目必须与当前赛博世界强绑定，不能是通用面试题。`;

  const user = `【世界】${world.name}（${world.en}）
【世界设定】${world.lore}
【面试官】${npc.full}｜${npc.role}
【面试官风格】${npc.greeting}
【本世界评估维度】
${dimText}
【候选人本轮已答】
${histText}
【任务】这是第 ${qIndex + 1} 题（每位面试官共 2 题）。请基于世界设定与已答内容，生成一道有现场感、能区分思维层级的题，并提供 4 个互不相同的选项。
要求：
1. question 不超过 90 字，具体、有场景、有约束条件，避免“你怎么看”这种空题；
2. 每题 4 个选项，每个选项 20–60 字，代表不同的判断路径，不要有明显凑数项；
3. 每个选项给出 4 个维度的评分，取值为 0–4 的整数，必须拉开差距；
4. reaction 是面试官听到这个回答后的即时反应，15–40 字，符合角色口吻；
5. 选项顺序不要按优劣排列，正确答案不要总在 A；
6. 严禁编造真实人物、真实公司数据或具体客户案例。

输出 JSON：
{"question":"...","options":[{"text":"...","scores":{"${world.dims.map((d) => d.key).join('":0,"')}":0},"reaction":"..."},{"text":"...","scores":{...},"reaction":"..."},{"text":"...","scores":{...},"reaction":"..."},{"text":"...","scores":{...},"reaction":"..."}]}`;

  try {
    const text = await chat(system, user, { json: true, maxTokens: 1400 });
    const raw = extractJSON(text);
    return normalizeQuestion(raw, fallback, world.dims.map((d) => d.key));
  } catch (e) {
    console.warn('[AI] 出题失败，使用本地题库:', e);
    return { ...fallback, error: e.message };
  }
}

// ---------- 对外：面经 ----------
export async function generateReport({ grade, score, worldStats, transcript }) {
  if (!LLM.isOnline()) return null;

  const system = `你是「悖论矩阵」的面试复盘官。你只输出合法 JSON，不输出 markdown。
你的判断必须基于候选人的真实回答，不能编造经历或数据。`;
  const worldLines = worldStats.map((w) => `${w.name}：${w.score} 分，等级 ${w.grade}。${w.line}`).join('\n');
  const qa = transcript.map((t) => `【${t.world} / ${t.npc}】${t.question}\n候选人：${t.answer}`).join('\n\n');

  const user = `候选人最终评级：${grade}，综合得分 ${score}。
各世界表现：
${worldLines}

完整问答记录：
${qa}

请输出一份中文面经 JSON：
{"headline":"一句总评，不超过 30 字","summary":"120–180 字总评，指出他最稳定的能力和最致命的短板","highlights":["亮点1","亮点2","亮点3"],"improvements":["改进1","改进2","改进3"],"advice":["下一步行动1","下一步行动2","下一步行动3"]}
要求：具体、克制、不要套话；亮点和改进必须引用他真实选择过的答案倾向；不要编造任何数据。`;

  try {
    const text = await chat(system, user, { json: true, maxTokens: 1400 });
    return extractJSON(text);
  } catch (e) {
    console.warn('[AI] 面经生成失败:', e);
    return null;
  }
}

// ---------- 对外：连通性测试 ----------
export async function testConnection() {
  if (!LLM.isOnline()) throw new Error('请先选择提供商并填写 API Key');
  const text = await chat('你是一个连通性检测服务，只输出 JSON。', '只输出 {"ok":true,"msg":"connected"}', { json: true, maxTokens: 80 });
  const obj = extractJSON(text);
  if (!obj) throw new Error(`模型未返回合法 JSON：${String(text).slice(0, 80)}`);
  return obj;
}

export function resetQuestionMemory() {
  usedQuestionIndex.clear();
}
