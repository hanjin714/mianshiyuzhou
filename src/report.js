// ============================================================
// 评级、结局与面经
// ============================================================
import { WORLDS, GRADE_META, TIMELINES } from './content.js';

export function gradeOf(score) {
  if (score >= 76) return 'A';
  if (score >= 60) return 'B';
  if (score >= 44) return 'C';
  return 'D';
}

const NPC_BANDS = [
  { min: 82, line: '建议直接进入下一轮。他的判断不飘，落得下去。' },
  { min: 68, line: '可以进观察名单。方向对，但还需要一次更硬的验证。' },
  { min: 52, line: '有感觉，没完全形成方法。再给一次现场会更好判断。' },
  { min: 0, line: '这一轮我没有记住他。答案正确，但没有重量。' },
];

export function computeResult(state) {
  const worldStats = state.order.map((id) => {
    const world = WORLDS[id];
    const data = state.perWorld[id];
    const dims = { ...data.dims };
    const score = Math.round((Object.values(dims).reduce((a, b) => a + b, 0) / 96) * 100);
    const npcScores = state.npcs
      .filter((n) => state.worldId === id)
      .map((n) => 0); // 占位，下面按 answers 重算
    const npcScoreMap = world.npcs.map((_, ni) => {
      const ans = data.answers.filter((a) => a.npcIndex === ni);
      if (!ans.length) return 0;
      const earned = ans.reduce((sum, a) => sum + Object.values(a.scores).reduce((x, y) => x + y, 0), 0);
      return Math.round((earned / (ans.length * 16)) * 100);
    });
    return {
      id,
      name: world.name,
      en: world.en,
      code: world.code,
      score,
      grade: gradeOf(score),
      dims,
      dimList: world.dims,
      npcScores: npcScoreMap,
      line: score >= 76 ? world.endingLines.high : score >= 58 ? world.endingLines.mid : world.endingLines.low,
      answers: data.answers,
    };
  });

  const overall = Math.round(worldStats.reduce((s, w) => s + w.score, 0) / (worldStats.length || 1));
  const grade = gradeOf(overall);

  const allDims = [];
  worldStats.forEach((w) => {
    w.dimList.forEach((d) => {
      allDims.push({ world: w.name, key: d.key, name: d.name, score: Math.round((w.dims[d.key] / 24) * 100) });
    });
  });
  allDims.sort((a, b) => b.score - a.score);

  const bestPicks = state.transcript.filter((t) => t.isBest).length;
  const lowPicks = state.transcript.filter((t) => t.isLow).length;

  return {
    overall,
    grade,
    meta: GRADE_META[grade],
    worldStats,
    allDims,
    topDim: allDims[0],
    lowDim: allDims[allDims.length - 1],
    bestPicks,
    lowPicks,
    questionCount: state.transcript.length,
    bestWorld: worldStats.slice().sort((a, b) => b.score - a.score)[0],
    worstWorld: worldStats.slice().sort((a, b) => a.score - b.score)[0],
    candidate: state.candidate,
  };
}

export function localNarrative(result) {
  const gradeHeadline = {
    A: '你不是来答题的，是来定义的',
    B: '判断成立，但还差一个更硬的现场',
    C: '你接住了问题，还没接住自己',
    D: '这一轮，系统没记住你的名字',
  };
  const worldNames = result.worldStats.map((w) => w.name).join(' → ');

  return {
    headline: `${result.grade} 级 · ${gradeHeadline[result.grade]}`,
    summary: `${worldNames}，三个世界走完，你拿到 ${result.overall} 分。最稳的是「${result.topDim.name}」（${result.topDim.score}%），最薄的是「${result.lowDim.name}」（${result.lowDim.score}%）。${result.questionCount} 道题里，你有 ${result.bestPicks} 次选中了整套选项里判断最完整的那一条。${result.meta.desc.split('。')[0]}。`,
    highlights: [
      `「${result.topDim.name}」是你最稳的一块，${result.topDim.score}% 的得分集中在这里。`,
      `${result.bestWorld.name} 是你最舒服的战场（${result.bestWorld.score} 分）。${result.bestWorld.line}`,
      `${result.questionCount} 道题里有 ${result.bestPicks} 题，你的选择落在选项集中最完整的那一条上——这说明你不是在猜。`,
    ],
    improvements: [
      `「${result.lowDim.name}」是最薄的一环（${result.lowDim.score}%）。在需要它的题上，你倾向选择更安全、更短期的答案。`,
      `${result.worstWorld.name} 只有 ${result.worstWorld.score} 分。不是你不行，是你在那个世界里还没找到自己的语言。`,
      `${result.lowPicks} 道题你选了明显低分的路径。暴露出来的不是知识量，是判断顺序。`,
    ],
    advice: [
      `把「${result.lowDim.name}」写成一张检查表：下一次做同类判断前，先问自己三个问题。`,
      '用一周时间，把一个真实项目写成 3 页世界线规划：资源、机制、风险、退出条件。',
      '重开一局，刻意在同一道题上选那个你上次不敢选的答案。',
    ],
  };
}

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function renderReportHTML(result, narrative, aiReport) {
  const n = aiReport ? {
    headline: aiReport.headline || narrative.headline,
    summary: aiReport.summary || narrative.summary,
    highlights: Array.isArray(aiReport.highlights) && aiReport.highlights.length ? aiReport.highlights : narrative.highlights,
    improvements: Array.isArray(aiReport.improvements) && aiReport.improvements.length ? aiReport.improvements : narrative.improvements,
    advice: Array.isArray(aiReport.advice) && aiReport.advice.length ? aiReport.advice : narrative.advice,
  } : narrative;

  const circumference = 2 * Math.PI * 78;
  const dash = (result.overall / 100) * circumference;

  const worldCards = result.worldStats.map((w) => `
    <div class="world-card">
      <span class="wc-grade grade-${w.grade}">${w.grade}</span>
      <div class="wc-code">${esc(w.code)} · ${esc(w.en)}</div>
      <div class="wc-name">${esc(w.name)}</div>
      <div class="wc-score">${w.score}<span> / 100</span></div>
      <div class="wc-line">${esc(w.line)}</div>
    </div>`).join('');

  const npcVerdicts = result.worldStats.map((w) => {
    const world = WORLDS[w.id];
    return world.npcs.map((npc, i) => {
      const sc = w.npcScores[i] ?? 0;
      const band = NPC_BANDS.find((b) => sc >= b.min);
      return `
      <div class="verdict">
        <div class="v-name">${esc(npc.full)}</div>
        <div class="v-role">${esc(npc.role)}</div>
        <div class="v-line">${esc(band.line)}</div>
        <div class="v-grade">${w.name} · ${sc} / 100</div>
      </div>`;
    }).join('');
  }).join('');

  const dimGroups = result.worldStats.map((w) => `
    <div class="dim-group">
      <div class="dim-group-label">${esc(w.name)} / ${esc(w.en)}</div>
      ${w.dimList.map((d) => {
        const val = Math.round((w.dims[d.key] / 24) * 100);
        return `<div class="dim-row">
          <span class="dim-name">${esc(d.name)}</span>
          <span class="dim-track"><i style="width:${val}%"></i></span>
          <span class="dim-val">${val}</span>
        </div>`;
      }).join('')}
    </div>`).join('');

  const timeline = TIMELINES.map((t) => `
    <div class="tl-card ${t.grade === result.grade ? 'active' : ''}">
      <div class="tl-grade grade-${t.grade}">${t.grade}</div>
      <div class="tl-name">${esc(t.name)}</div>
      <div class="tl-desc">${esc(t.desc)}</div>
    </div>`).join('');

  const qa = result.worldStats.map((w) => w.answers.map((a) => `
    <div class="qa-item">
      <div class="qa-q"><b>${esc(w.name)} / ${esc(a.npcName)}</b><span>${esc(a.question)}</span></div>
      <div class="qa-a">你的选择：<em>${esc(a.answer)}</em></div>
    </div>`).join('')).join('');

  return `
    <div class="hero-result">
      <div class="grade-ring grade-${result.grade}">
        <svg viewBox="0 0 170 170">
          <circle cx="85" cy="85" r="78" fill="none" stroke="rgba(255,255,255,.1)" stroke-width="2"/>
          <circle cx="85" cy="85" r="78" fill="none" stroke="currentColor" stroke-width="3"
            stroke-dasharray="${dash} ${circumference}" stroke-linecap="butt"
            style="filter:drop-shadow(0 0 8px currentColor)"/>
        </svg>
        <div class="grade-letter">${result.grade}</div>
        <div class="grade-cap">CANDIDATE RANK</div>
      </div>
      <div class="hero-copy">
        <div class="ending-code">${esc(result.meta.ending)} / ${esc(result.candidate)}</div>
        <h3>${esc(result.meta.title)}</h3>
        <p>${esc(n.headline)}。${esc(n.summary)}</p>
        <div class="hero-score">
          <div>综合得分<b>${result.overall}</b></div>
          <div>完成世界<b>${result.worldStats.length} / 3</b></div>
          <div>面试题<b>${result.questionCount}</b></div>
          <div>最佳维度<b>${esc(result.topDim.name)}</b></div>
        </div>
      </div>
    </div>

    <div class="section-title">世界线表现 / WORLD PERFORMANCE</div>
    <div class="world-grid">${worldCards}</div>

    <div class="section-title">面试官评语 / INTERVIEWER VERDICTS</div>
    <div class="npc-verdicts">${npcVerdicts}</div>

    <div class="section-title">能力维度 / CAPABILITY MATRIX</div>
    <div class="dim-groups">${dimGroups}</div>

    <div class="section-title">面经 / TAKEAWAYS</div>
    <div class="two-col">
      <div class="list-block">
        <div class="sub-label">你的亮点</div>
        <ul>${n.highlights.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
      </div>
      <div class="list-block improve">
        <div class="sub-label">待补齐</div>
        <ul>${n.improvements.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
      </div>
    </div>
    <div class="list-block advice-block">
      <div class="sub-label">下一步行动</div>
      <ul>${n.advice.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
    </div>

    <div class="section-title">结局时间线 / OPEN TIMELINES</div>
    <div class="timeline">${timeline}</div>

    <details class="qa-details">
      <summary>完整问答记录 · ${result.questionCount} 题</summary>
      <div class="qa-log">${qa}</div>
    </details>
  `;
}

export function reportMarkdown(result, narrative, aiReport) {
  const n = aiReport ? {
    headline: aiReport.headline || narrative.headline,
    summary: aiReport.summary || narrative.summary,
    highlights: aiReport.highlights || narrative.highlights,
    improvements: aiReport.improvements || narrative.improvements,
    advice: aiReport.advice || narrative.advice,
  } : narrative;

  const lines = [
    '# 面试宇宙 · 面经',
    '',
    `- 候选人：${result.candidate}`,
    `- 评级：**${result.grade}**`,
    `- 综合得分：${result.overall} / 100`,
    `- 结局：${result.meta.ending} · ${result.meta.title}`,
    '',
    `## ${n.headline}`,
    '',
    n.summary,
    '',
    '## 世界线表现',
    '',
    '| 世界 | 得分 | 等级 | 评语 |',
    '| --- | --- | --- | --- |',
    ...result.worldStats.map((w) => `| ${w.name} | ${w.score} | ${w.grade} | ${w.line} |`),
    '',
    '## 能力维度',
    '',
    ...result.worldStats.flatMap((w) => [
      `### ${w.name}`,
      ...w.dimList.map((d) => `- ${d.name}：${Math.round((w.dims[d.key] / 24) * 100)}`),
      '',
    ]),
    '## 亮点',
    '',
    ...n.highlights.map((x) => `- ${x}`),
    '',
    '## 待补齐',
    '',
    ...n.improvements.map((x) => `- ${x}`),
    '',
    '## 下一步行动',
    '',
    ...n.advice.map((x) => `- ${x}`),
    '',
    '## 完整问答记录',
    '',
    ...result.worldStats.flatMap((w) => [
      `### ${w.name}`,
      ...w.answers.map((a) => `**Q（${a.npcName}）：** ${a.question}\n\n**你的选择：** ${a.answer}\n`),
    ]),
    '',
    '---',
    '由「面试宇宙 / INTERVIEWVERSE」生成 · 悖论矩阵',
  ];
  return lines.join('\n');
}
