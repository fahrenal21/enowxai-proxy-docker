import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';

import {
  buildOutputPath,
  extractAssistantText,
  isProbablyIncompleteMarkdown,
  normalizeModel,
  shouldContinue,
  slugify,
} from './planning-safe.mjs';

test('slugify creates a filesystem-safe lowercase slug', () => {
  assert.equal(slugify('Create API Design Plan!'), 'create-api-design-plan');
});

test('buildOutputPath writes under docs/plans with date prefix', () => {
  const projectDir = path.join('workspace', 'sample-project');

  assert.equal(
    buildOutputPath(projectDir, 'Service Layer Refactor', new Date('2026-05-01T00:00:00Z')),
    path.join(projectDir, 'docs', 'plans', '2026-05-01-service-layer-refactor-plan.md'),
  );
});

test('extractAssistantText reads OpenAI-compatible message content', () => {
  const text = extractAssistantText({
    choices: [{ message: { content: '# Plan\n\n- Step 1' } }],
  });

  assert.equal(text, '# Plan\n\n- Step 1');
});

test('normalizeModel removes provider prefix from model ids', () => {
  assert.equal(normalizeModel('provider/example-model'), 'example-model');
});

test('isProbablyIncompleteMarkdown detects dangling checklist bullet', () => {
  assert.equal(isProbablyIncompleteMarkdown('## Task\n\n- [ ] Implement validation\n-'), true);
});

test('isProbablyIncompleteMarkdown accepts completed markdown ending', () => {
  assert.equal(isProbablyIncompleteMarkdown('## Validation\n\n- [ ] Run tests\n\n## Acceptance Criteria\n\nDone.\n'), false);
});

test('shouldContinue triggers on length finish reason', () => {
  assert.equal(shouldContinue({ finishReason: 'length', text: 'complete sentence.' }), true);
});
