import { env, pipeline } from '@huggingface/transformers';

const MODEL_ID = 'Xenova/all-MiniLM-L6-v2';
env.allowLocalModels = false;
env.useBrowserCache = true;
env.useWasmCache = true;
env.backends.onnx.wasm.numThreads = 1;

let extractorPromise;

function getExtractor() {
  if (!extractorPromise) {
    extractorPromise = pipeline('feature-extraction', MODEL_ID, {
      dtype: 'q8',
      progress_callback: (event) => {
        if (event.status === 'progress') {
          self.postMessage({ type: 'load-progress', percent: Math.round(event.progress || 0) });
        }
      },
    }).catch((error) => {
      extractorPromise = undefined;
      throw error;
    });
  }
  return extractorPromise;
}

self.onmessage = async ({ data }) => {
  if (data.type !== 'embed') return;
  const { requestId, clauses, queries } = data;
  try {
    self.postMessage({ type: 'status', requestId, message: '正在准备浏览器本地模型…' });
    const extractor = await getExtractor();
    const vectors = [];
    const texts = [...clauses, ...queries];
    for (let start = 0; start < texts.length; start += 12) {
      const slice = texts.slice(start, start + 12);
      const output = await extractor(slice, { pooling: 'mean', normalize: true });
      vectors.push(...output.tolist());
      self.postMessage({ type: 'status', requestId, message: `正在比对原句… ${Math.min(start + slice.length, texts.length)} / ${texts.length}` });
    }
    self.postMessage({ type: 'result', requestId, clauseVectors: vectors.slice(0, clauses.length), queryVectors: vectors.slice(clauses.length) });
  } catch (error) {
    self.postMessage({ type: 'error', requestId, message: error instanceof Error ? error.message : String(error) });
  }
};
