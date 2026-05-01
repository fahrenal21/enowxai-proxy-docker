#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const DEFAULT_CONFIG = process.env.OPENCODE_CONFIG
  || path.join(os.homedir(), '.config', 'opencode', 'opencode.json');
const DEFAULT_MODEL = process.env.OPENCODE_MODEL
  || process.env.OPENCODE_CURRENT_MODEL
  || process.env.AI_MODEL
  || process.env.MODEL
  || 'claude-sonnet-4.5-thinking';
const DEFAULT_BASE_URL = 'http://127.0.0.1:1432/v1';

export function slugify(value) {
  return String(value)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'planning-safe';
}

export function buildOutputPath(projectDir, title, date = new Date()) {
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(date.getUTCDate()).padStart(2, '0');
  return path.join(projectDir, 'docs', 'plans', `${yyyy}-${mm}-${dd}-${slugify(title)}-plan.md`);
}

export function extractAssistantText(payload) {
  const content = payload?.choices?.[0]?.message?.content;
  if (Array.isArray(content)) {
    return content.map((part) => part?.text || '').join('').trim();
  }
  return typeof content === 'string' ? content.trim() : '';
}

export function isProbablyIncompleteMarkdown(text) {
  const trimmed = String(text || '').trimEnd();
  if (!trimmed) return true;
  const lines = trimmed.split(/\r?\n/);
  const last = lines.at(-1)?.trim() || '';
  const fenceCount = (trimmed.match(/```/g) || []).length;
  if (fenceCount % 2 !== 0) return true;
  if (/^[-*+]\s*$/.test(last)) return true;
  if (/^- \[[ xX]\]\s*$/.test(last)) return true;
  if (/^(#{1,6}|\*\*[^*]+:?\*\*|####?\s+.+):?\s*$/.test(last)) return true;
  if (/[,:;([]$/.test(last)) return true;
  return false;
}

export function shouldContinue({ finishReason, text }) {
  return finishReason === 'length' || isProbablyIncompleteMarkdown(text);
}

function parseArgs(argv) {
  const args = { model: DEFAULT_MODEL, baseURL: undefined, config: DEFAULT_CONFIG };
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--dir') args.dir = argv[++i];
    else if (arg === '--title') args.title = argv[++i];
    else if (arg === '--model') args.model = argv[++i];
    else if (arg === '--base-url') args.baseURL = argv[++i];
    else if (arg === '--config') args.config = argv[++i];
    else if (arg === '--out') args.out = argv[++i];
    else rest.push(arg);
  }
  args.prompt = rest.join(' ').trim();
  return args;
}

export function normalizeModel(model) {
  if (!model) return DEFAULT_MODEL;
  const value = String(model).trim();
  return value.includes('/') ? value.split('/').pop() : value;
}

function readOpenCodeProvider(configPath) {
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const options = config.provider?.enowxlabs?.options || {};
  return {
    apiKey: options.apiKey,
    baseURL: options.baseURL || DEFAULT_BASE_URL,
  };
}

function safeRead(filePath, maxBytes = 8000) {
  try {
    const stat = fs.statSync(filePath);
    if (!stat.isFile() || stat.size > maxBytes) return '';
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return '';
  }
}

function listFiles(root, limit = 160) {
  const ignored = new Set(['.git', 'node_modules', 'dist', 'build', '.next', 'coverage', '.turbo']);
  const out = [];
  function walk(dir) {
    if (out.length >= limit) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (out.length >= limit || ignored.has(entry.name) || entry.name.startsWith('.env')) continue;
      const full = path.join(dir, entry.name);
      const rel = path.relative(root, full);
      if (entry.isDirectory()) walk(full);
      else out.push(rel);
    }
  }
  try { walk(root); } catch { return []; }
  return out;
}

function collectContext(projectDir, prompt) {
  const packageJson = safeRead(path.join(projectDir, 'package.json'));
  const agents = safeRead(path.join(projectDir, 'AGENTS.md'), 6000);
  const files = listFiles(projectDir).filter((file) => /ai|insight|dashboard|route|page|component|src|app/i.test(file));
  const searchTerms = ['AI Insights', 'ai insights', 'insights', 'AiInsights'];
  const matches = [];

  for (const file of files.slice(0, 120)) {
    const full = path.join(projectDir, file);
    const body = safeRead(full, 12000);
    if (!body) continue;
    if (searchTerms.some((term) => body.includes(term))) {
      matches.push(`--- ${file} ---\n${body.slice(0, 3500)}`);
    }
    if (matches.length >= 8) break;
  }

  return [
    `User request: ${prompt}`,
    packageJson ? `package.json:\n${packageJson.slice(0, 4000)}` : '',
    agents ? `AGENTS.md:\n${agents}` : '',
    files.length ? `Relevant file list:\n${files.slice(0, 120).join('\n')}` : '',
    matches.length ? `Relevant content matches:\n${matches.join('\n\n')}` : '',
  ].filter(Boolean).join('\n\n');
}

function buildMessages(projectDir, prompt, previous = '') {
  const userContent = previous
    ? [
        collectContext(projectDir, prompt),
        'The previous response was incomplete. Continue the same markdown document exactly from where it stopped.',
        'Do not repeat earlier sections. Start with the next unfinished bullet/sentence/section only.',
        `Last 3000 characters already written:\n${previous.slice(-3000)}`,
      ].join('\n\n')
    : collectContext(projectDir, prompt);

  return [
    {
      role: 'system',
      content: [
        'You are a senior staff engineer creating implementation plans.',
        'Return markdown only. Do not call tools. Do not claim files were written.',
        'The caller will save your markdown to docs/plans locally.',
        'Include concrete file paths, phases, risks, validation, and acceptance criteria.',
      ].join('\n'),
    },
    {
      role: 'user',
      content: userContent,
    },
  ];
}

async function requestPlanChunk({ baseURL, apiKey, model, projectDir, prompt, previous = '' }) {
  const response = await fetch(`${baseURL.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: normalizeModel(model),
      stream: false,
      messages: buildMessages(projectDir, prompt, previous),
      max_tokens: 12000,
    }),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${text.slice(0, 1000)}`);
  const payload = JSON.parse(text);
  const plan = extractAssistantText(payload);
  if (!plan) throw new Error('Empty assistant response');
  return { text: plan, finishReason: payload?.choices?.[0]?.finish_reason || 'unknown' };
}

function mergeContinuation(current, next) {
  const left = current.trimEnd();
  const right = next.trimStart();
  return `${left}\n${right}`;
}

async function requestPlan(options) {
  const maxContinuations = 4;
  let combined = '';
  let lastFinishReason = 'unknown';

  for (let attempt = 0; attempt <= maxContinuations; attempt++) {
    const chunk = await requestPlanChunk({ ...options, previous: combined });
    combined = combined ? mergeContinuation(combined, chunk.text) : chunk.text;
    lastFinishReason = chunk.finishReason;

    if (!shouldContinue({ finishReason: chunk.finishReason, text: combined })) {
      return combined;
    }

    console.error(`[planning-safe] continuing incomplete plan attempt=${attempt + 1}/${maxContinuations} finish_reason=${chunk.finishReason}`);
  }

  if (shouldContinue({ finishReason: lastFinishReason, text: combined })) {
    throw new Error(`Plan still appears incomplete after continuations; finish_reason=${lastFinishReason}`);
  }

  return combined;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.dir || !args.prompt) {
    throw new Error('Usage: planning-safe.mjs --dir <project> [--title <title>] [--model <model>] <prompt>');
  }

  const projectDir = path.resolve(args.dir);
  const provider = readOpenCodeProvider(args.config);
  const baseURL = args.baseURL || provider.baseURL || DEFAULT_BASE_URL;
  const apiKey = provider.apiKey;
  if (!apiKey) throw new Error(`Missing enowxlabs apiKey in ${args.config}`);

  const title = args.title || args.prompt;
  const outPath = args.out ? path.resolve(projectDir, args.out) : buildOutputPath(projectDir, title);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });

  const plan = await requestPlan({ baseURL, apiKey, model: normalizeModel(args.model), projectDir, prompt: args.prompt });
  const content = plan.endsWith('\n') ? plan : `${plan}\n`;
  fs.writeFileSync(outPath, content, 'utf8');
  console.log(outPath);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(`[planning-safe] ${error.message}`);
    process.exit(1);
  });
}
