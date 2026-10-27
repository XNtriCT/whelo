#!/usr/bin/env node
/**
 * Fetch the quantized Whisper tiny.en model used for local subtitle sync.
 *
 *   npm run models            # skip files that already exist
 *   npm run models -- --force # re-download everything
 *
 * The model is intentionally not committed: it is ~41 MB of binary weights.
 */
import fs from 'node:fs/promises';
import path from 'node:path';

const BASE = 'https://huggingface.co/Xenova/whisper-tiny.en/resolve/main';
const DEST = path.resolve('models', 'Xenova', 'whisper-tiny.en');
const FILES = [
  'config.json',
  'generation_config.json',
  'preprocessor_config.json',
  'tokenizer.json',
  'tokenizer_config.json',
  'onnx/encoder_model_quantized.onnx',
  'onnx/decoder_model_merged_quantized.onnx'
];

const force = process.argv.includes('--force');
const mb = (bytes) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;

async function download(file) {
  const target = path.join(DEST, file);
  await fs.mkdir(path.dirname(target), { recursive: true });

  if (!force) {
    const stat = await fs.stat(target).catch(() => null);
    if (stat && stat.size > 0) {
      console.log(`skip    ${file} (${mb(stat.size)})`);
      return;
    }
  }

  const url = `${BASE}/${file}`;
  process.stdout.write(`fetch   ${file} ... `);
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} for ${url}`);
  }
  const buffer = Buffer.from(await res.arrayBuffer());
  if (buffer.length === 0) {
    throw new Error(`empty response for ${url}`);
  }
  await fs.writeFile(target, buffer);
  console.log(mb(buffer.length));
}

async function main() {
  console.log(`Whisper tiny.en -> ${DEST}`);
  for (const file of FILES) {
    await download(file);
  }

  const encoder = await fs.stat(path.join(DEST, 'onnx', 'encoder_model_quantized.onnx'));
  const decoder = await fs.stat(path.join(DEST, 'onnx', 'decoder_model_merged_quantized.onnx'));
  if (encoder.size < 1024 * 1024 || decoder.size < 1024 * 1024) {
    throw new Error('Model files look incomplete. Re-run with --force.');
  }
  console.log(`done    encoder ${mb(encoder.size)}, decoder ${mb(decoder.size)}`);
}

main().catch((error) => {
  console.error(`\nModel download failed: ${error.message}`);
  console.error('Check your connection, or place the files in models/Xenova/whisper-tiny.en manually.');
  process.exit(1);
});
