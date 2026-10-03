# Rules Lens

Rules Lens is a small, browser-local evidence finder for someone comparing cash-prize opportunities on a limited budget. Paste the official rules and it locates candidate original sentences for five questions: entry fee, eligibility, deadline, cash prize, and payout method. It does not invent an answer when the text is silent.

This project was started on October 3, 2026 for the Hacktoberfest Weekend Challenge. It is a **new project**. The earlier Proof Desk project suggested the general problem, but Rules Lens has a different implementation: local model inference and automatic, quote-preserving evidence retrieval. No Proof Desk code was copied. The particular person and their relationship to the author should be described only with their consent and accurate facts in any contest write-up.

## Run

Requires Node.js 20.19+ and pnpm 11. Install dependencies and launch locally:

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Open the local address printed by Vite. Tests run without a network connection or downloaded model:

```sh
pnpm test
pnpm build
```

The production output is `dist/`. Deploy its contents to any static host. `vite.config.js` uses relative asset paths so a GitHub Pages project subpath works. A production build includes the open-source ONNX browser runtime, but **not the model weights**.

## What happens in the browser

1. The page splits pasted text into at most 120 original clauses. It never fetches the optional source URL.
2. A Web Worker loads [`@huggingface/transformers`](https://github.com/huggingface/transformers.js) and the Apache-2.0 licensed [`Xenova/all-MiniLM-L6-v2`](https://huggingface.co/Xenova/all-MiniLM-L6-v2) 8-bit model. The ONNX weight file is about 23 MB. The first load requires network access to Hugging Face. The library uses the browser Cache API when available; later loads may reuse it. Offline reuse depends on the browser and its cache, so offline availability is not promised.
3. The worker computes normalized sentence embeddings locally. The page ranks original clauses against the five questions with cosine similarity and requires a question-specific lexical cue before showing a match.
4. Results present exact source clauses and a *retrieval score*, not a probability that a claim is true. If there is no sufficiently relevant clause, the result says “not found”; that does **not** mean the restriction or payout method does not exist.

Pasted rule text is not sent to a server by this application. The browser contacts the model host to load weights and the CSS font host for fonts. There is no paid API, account requirement, local storage of pasted text, or payment feature.

## Limits and review

- English model and English query phrasing work best on English rules. Chinese UI terms have keyword hints, but semantic retrieval quality on Chinese rules is not established.
- Search results are candidates. They do not prove eligibility, payment method, rule validity, or actual prize receipt. Always verify the full official page and the latest rules.
- Long texts are capped at 18,000 characters in the input and 120 clauses for inference. Split longer rules into parts.
- The optional source URL is displayed as an external link only. `http` and `https` are accepted; unsafe URL schemes are rejected.
- The “fictional example” button is only for demonstrating the interface and must not be treated as a real contest.

## Attribution and licensing

Rules Lens source code is MIT licensed (see `LICENSE`). [Transformers.js](https://github.com/huggingface/transformers.js) is licensed under Apache-2.0, and the [MiniLM ONNX model](https://huggingface.co/Xenova/all-MiniLM-L6-v2) is listed as Apache-2.0 by its publisher. Third-party package licenses remain with their respective authors. Rules Lens neither vendors nor republishes the model weights.
