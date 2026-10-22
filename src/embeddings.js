import { createHash } from 'node:crypto';
export function createEmbedder(config, cache) {
  let extractor;
  return async text => {
    const key = createHash('sha256').update(`${config.model}:mean:normalized:${text}`).digest('hex');
    if (cache[key]) return cache[key];
    if (!extractor) {
      const { pipeline, env } = await import('@huggingface/transformers');
      env.cacheDir = '.cache/models';
      extractor = await pipeline('feature-extraction', config.model, { dtype: 'q8' });
    }
    const output = await extractor(text, { pooling: 'mean', normalize: true });
    cache[key] = Array.from(output.data);
    return cache[key];
  };
}
