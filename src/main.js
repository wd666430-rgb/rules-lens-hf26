import './style.css';
import { QUESTIONS, rankEvidence, splitClauses } from './evidence.js';

const textInput = document.querySelector('#rules-text');
const urlInput = document.querySelector('#source-url');
const charCount = document.querySelector('#char-count');
const sampleButton = document.querySelector('#sample-button');
const analyzeButton = document.querySelector('#analyze-button');
const status = document.querySelector('#status');
const resultsSection = document.querySelector('#results-section');
const results = document.querySelector('#results');
const worker = new Worker(new URL('./model.worker.js', import.meta.url), { type: 'module' });

const SAMPLE = `FICTIONAL EXAMPLE — for demonstration only. This is not an official contest.\nNo entry fee or purchase is necessary to participate.\nEntrants must be at least 18 years old and residents of an eligible country.\nEntries must be submitted by October 5, 2026 at 06:59 UTC.\nThe overall winner receives a $250 USD cash prize.\nWinners will be contacted by email after judging.`;

let activeRequest = 0;
let pending = null;

function setStatus(message, kind = 'info') {
  status.className = `status status-${kind}`;
  status.querySelector('span:last-child').textContent = message;
  status.querySelector('.status-icon').textContent = kind === 'error' ? '!' : kind === 'success' ? '✓' : 'i';
}

function setBusy(busy) {
  analyzeButton.disabled = busy;
  sampleButton.disabled = busy;
  analyzeButton.innerHTML = busy ? '正在定位… <span aria-hidden="true">◌</span>' : '定位条款 <span aria-hidden="true">↗</span>';
}

function create(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function safeSourceUrl(value) {
  try {
    const parsed = new URL(value);
    return ['https:', 'http:'].includes(parsed.protocol) ? parsed.href : null;
  } catch {
    return null;
  }
}

function renderResults(items, clauseCount, truncated) {
  results.replaceChildren();
  const sourceUrl = safeSourceUrl(urlInput.value.trim());
  for (const item of items) {
    const card = create('article', `result-card result-${item.status}`);
    const top = create('div', 'result-top');
    top.append(create('span', 'result-number', item.icon));
    top.append(create('span', 'result-subtitle', item.subtitle));
    card.append(top);
    card.append(create('h3', '', item.title));

    const badgeText = item.status === 'strong' ? '较强匹配 · 请核对' : item.status === 'review' ? '可能相关 · 需复核' : '未找到明确原句';
    card.append(create('span', `result-badge badge-${item.status}`, badgeText));

    if (item.matches.length === 0) {
      card.append(create('p', 'empty-result', '已检索粘贴的文本，但没有足够明确的条款。请检查官方规则全文；不要把「未找到」当成「没有限制」。'));
    } else {
      for (const match of item.matches) {
        const quote = create('blockquote', 'evidence-quote', match.quote);
        card.append(quote);
        card.append(create('p', 'match-score', `语义匹配度 ${Math.round(match.score * 100)}% · 不是事实正确率`));
      }
    }
    results.append(card);
  }
  const footer = create('p', 'results-meta', `已检索 ${clauseCount} 条原句${truncated ? '；过长内容已截断，请分段再查' : ''}。`);
  if (sourceUrl) {
    const link = create('a', 'source-link', '打开原始来源 ↗');
    link.href = sourceUrl;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    footer.append(' ', link);
  }
  results.append(footer);
  resultsSection.hidden = false;
  resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

textInput.addEventListener('input', () => {
  charCount.textContent = `${textInput.value.length.toLocaleString()} / 18,000`;
});

sampleButton.addEventListener('click', () => {
  textInput.value = SAMPLE;
  urlInput.value = '';
  textInput.dispatchEvent(new Event('input'));
  resultsSection.hidden = true;
  setStatus('已载入虚构示例。示例不代表任何真实活动，也不能用来报名。');
});

analyzeButton.addEventListener('click', () => {
  const raw = textInput.value.trim();
  if (raw.length < 30) {
    setStatus('请先粘贴至少 30 个字符的规则原文。', 'error');
    textInput.focus();
    return;
  }
  const clauses = splitClauses(raw);
  if (clauses.length === 0) {
    setStatus('没有找到可检索的句子。', 'error');
    return;
  }
  const truncated = splitClauses(raw, 121).length > 120;
  resultsSection.hidden = true;
  setBusy(true);
  setStatus('正在准备浏览器本地模型。首次使用需联网下载，后续通常可从浏览器缓存读取。');
  activeRequest += 1;
  pending = { requestId: activeRequest, clauses, truncated };
  worker.postMessage({ type: 'embed', requestId: activeRequest, clauses, queries: QUESTIONS.map((question) => question.query) });
});

worker.addEventListener('message', ({ data }) => {
  if (data.type === 'load-progress' && pending) {
    setStatus(`正在下载开源模型… ${data.percent}%（仅下载模型；规则原文不上传）`);
    return;
  }
  if (!pending || data.requestId !== pending.requestId) return;
  if (data.type === 'status') {
    setStatus(data.message);
  } else if (data.type === 'result') {
    try {
      const items = rankEvidence(pending.clauses, data.clauseVectors, data.queryVectors);
      renderResults(items, pending.clauses.length, pending.truncated);
      setStatus('检索完成。显示的是原文候选句，请核对完整规则和来源。', 'success');
    } catch (error) {
      setStatus(`无法解析模型结果：${error.message}`, 'error');
    } finally {
      pending = null;
      setBusy(false);
    }
  } else if (data.type === 'error') {
    pending = null;
    setBusy(false);
    setStatus(`模型加载或检索失败：${data.message}。请检查网络后重试。`, 'error');
  }
});

worker.addEventListener('error', () => {
  pending = null;
  setBusy(false);
  setStatus('浏览器无法启动本地模型。请使用较新的浏览器并检查网络。', 'error');
});
