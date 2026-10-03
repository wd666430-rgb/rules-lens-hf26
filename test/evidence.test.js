import test from 'node:test';
import assert from 'node:assert/strict';
import { QUESTIONS, cosine, rankEvidence, splitClauses } from '../src/evidence.js';

test('splits and preserves original rule sentences', () => {
  const raw = 'No entry fee is required. The winner receives $250.\nWinners will be emailed.';
  assert.deepEqual(splitClauses(raw), [
    'No entry fee is required.',
    'The winner receives $250.',
    'Winners will be emailed.',
  ]);
});

test('splits Chinese sentences without whitespace after punctuation', () => {
  assert.deepEqual(splitClauses('报名免费。参赛者须年满18岁。奖金为500美元；收款方式未注明。'), [
    '报名免费。',
    '参赛者须年满18岁。',
    '奖金为500美元；',
    '收款方式未注明。',
  ]);
});

test('limits the number of clauses to keep browser inference bounded', () => {
  assert.equal(splitClauses(Array.from({ length: 130 }, (_, i) => `Rule ${i}`).join('\n')).length, 120);
});

test('cosine handles valid and invalid embeddings', () => {
  assert.equal(cosine([1, 0], [1, 0]), 1);
  assert.equal(cosine([1, 0], [0, 1]), 0);
  assert.equal(cosine([], [1]), 0);
});

test('payout stays unknown when rules merely promise a cash prize and email notice', () => {
  const clauses = ['The winner receives a $250 cash prize.', 'Winners will be notified by email.'];
  const vectors = [[1, 0, 0, 0, 0], [0, 1, 0, 0, 0]];
  const queries = QUESTIONS.map((question) => question.id === 'payout' ? [1, 0, 0, 0, 0] : [1, 0, 0, 0, 0]);
  const answer = rankEvidence(clauses, vectors, queries).find((item) => item.id === 'payout');
  assert.equal(answer.status, 'unknown');
  assert.deepEqual(answer.matches, []);
});

test('deadline clause is surfaced when the rule says entries must be submitted by a date', () => {
  const quote = 'Entries must be submitted by October 5, 2026 at 06:59 UTC.';
  const answer = rankEvidence([quote], [[1, 0]], QUESTIONS.map(() => [1, 0]));
  assert.equal(answer.find((item) => item.id === 'deadline').matches[0].quote, quote);
});

test('common short English rule phrasings are surfaced', () => {
  const clauses = [
    'You must be 18 or older.',
    'Submissions are due by October 5, 2026 at 06:59 UTC.',
    'The winner gets $250 USD.',
  ];
  const vectors = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  const queries = QUESTIONS.map((question) => {
    if (question.id === 'eligibility') return [1, 0, 0];
    if (question.id === 'deadline') return [0, 1, 0];
    return [0, 0, 1];
  });
  const answer = rankEvidence(clauses, vectors, queries);
  assert.equal(answer.find((item) => item.id === 'eligibility').matches[0].quote, clauses[0]);
  assert.equal(answer.find((item) => item.id === 'deadline').matches[0].quote, clauses[1]);
  assert.equal(answer.find((item) => item.id === 'prize').matches[0].quote, clauses[2]);
});

test('returns only verbatim source clauses with a cautious strength marker', () => {
  const clauses = ['No entry fee is required.', 'Prizes are paid via PayPal.'];
  const vectors = [[1, 0], [0, 1]];
  const queries = QUESTIONS.map((question) => question.id === 'payout' ? [0, 1] : [1, 0]);
  const answer = rankEvidence(clauses, vectors, queries);
  assert.equal(answer.find((item) => item.id === 'fee').matches[0].quote, clauses[0]);
  assert.equal(answer.find((item) => item.id === 'payout').matches[0].quote, clauses[1]);
  assert.equal(answer.find((item) => item.id === 'payout').status, 'strong');
  assert.ok(answer.every((item) => item.matches.every((match) => clauses.includes(match.quote))));
});

test('rejects embeddings that could attach quotes to the wrong input', () => {
  assert.throws(() => rankEvidence(['one'], [], QUESTIONS.map(() => [1])), /did not match/);
});
