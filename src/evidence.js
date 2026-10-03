export const QUESTIONS = [
  {
    id: 'fee', icon: '01', title: '报名要花钱吗？', subtitle: 'Entry fee',
    query: 'What is the entry fee or purchase requirement to participate in this contest?',
    cue: /\b(no entry fee|no purchase necessary|free to enter|entry fee|registration fee|participation fee|purchase (is )?required|cost to enter)\b|报名费|免费报名|无需购买|无需付费|参赛费用/i,
  },
  {
    id: 'eligibility', icon: '02', title: '谁有资格参加？', subtitle: 'Eligibility',
    query: 'Who is eligible to enter? What age, residence, location, or citizenship restrictions apply?',
    cue: /\b(eligib(?:le|ility)|resident|residency|citizen|country|countries|age|years old|18\+|18 or older|at least 18|must be 18|void where prohibited|jurisdiction)\b|参赛资格|年龄限制|居住地|国籍|地区限制/i,
  },
  {
    id: 'deadline', icon: '03', title: '最晚什么时候提交？', subtitle: 'Deadline',
    query: 'What is the exact deadline, due date, closing time, or end of the entry period?',
    cue: /\b(deadline|due|entry period ends?|closes? (on|at)|ends? (on|at)|submit(?:ted)? by|must be submitted by|no later than)\b|截止|提交期限|报名结束|最晚提交/i,
  },
  {
    id: 'prize', icon: '04', title: '现金奖有多少？', subtitle: 'Cash prize',
    query: 'How much money is the cash prize or award for winners?',
    cue: /cash prize|prize money|winner.{0,80}(?:receives?|gets?|wins?)|awarded?.{0,80}\$|\$\s?\d[\d,.]*|USD\s?\d[\d,.]*|\bdollars?\b|奖金|现金奖励|获奖金额/i,
  },
  {
    id: 'payout', icon: '05', title: '钱怎么到账？', subtitle: 'Payout method',
    query: 'How is the cash prize paid to the winner, such as PayPal, bank transfer, or another payout method?',
    cue: /\b(paypal|payoneer|stripe|bank transfer|wire transfer|gift card|payout method|payment method|paid (via|through|by)|sent (via|through) (paypal|bank|wire))\b|收款方式|付款方式|银行转账|支付宝|微信支付/i,
  },
];

const MIN_RELEVANCE = 0.20;
const STRONG_RELEVANCE = 0.36;

export function splitClauses(raw, limit = 120) {
  if (typeof raw !== 'string') return [];
  const pieces = [];
  for (const line of raw.split(/\r?\n/)) {
    let start = 0;
    for (let i = 0; i < line.length; i += 1) {
      const char = line[i];
      const sentenceEnd = /[。！？；]/.test(char) || (/[.!?;]/.test(char) && (i === line.length - 1 || /\s/.test(line[i + 1])));
      if (sentenceEnd) {
        const piece = line.slice(start, i + 1).trim();
        if (piece) pieces.push(piece);
        start = i + 1;
      }
    }
    const tail = line.slice(start).trim();
    if (tail) pieces.push(tail);
  }
  const clauses = [];
  for (const piece of pieces) {
    if (piece.length <= 460) {
      clauses.push(piece);
    } else {
      let remainder = piece;
      while (remainder.length > 460) {
        const breakAt = Math.max(remainder.lastIndexOf(' ', 420), 200);
        clauses.push(remainder.slice(0, breakAt).trim());
        remainder = remainder.slice(breakAt).trim();
      }
      if (remainder) clauses.push(remainder);
    }
    if (clauses.length >= limit) break;
  }
  return clauses.slice(0, limit);
}

export function cosine(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length === 0 || a.length !== b.length) return 0;
  let dot = 0, left = 0, right = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    left += a[i] * a[i];
    right += b[i] * b[i];
  }
  return left && right ? dot / Math.sqrt(left * right) : 0;
}

export function rankEvidence(clauses, clauseVectors, queryVectors) {
  if (clauses.length !== clauseVectors.length || queryVectors.length !== QUESTIONS.length) {
    throw new Error('Model output did not match the submitted text.');
  }
  return QUESTIONS.map((question, queryIndex) => {
    const ranked = clauses
      .map((quote, index) => ({ quote, index, score: cosine(clauseVectors[index], queryVectors[queryIndex]) }))
      .filter((item) => question.cue.test(item.quote) && item.score >= MIN_RELEVANCE)
      .sort((a, b) => b.score - a.score)
      .slice(0, 2);
    const strongest = ranked[0];
    return {
      id: question.id,
      title: question.title,
      subtitle: question.subtitle,
      icon: question.icon,
      status: !strongest ? 'unknown' : strongest.score >= STRONG_RELEVANCE ? 'strong' : 'review',
      matches: ranked.map(({ quote, score }) => ({ quote, score: Math.round(score * 100) / 100 })),
    };
  });
}
