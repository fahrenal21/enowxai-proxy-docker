import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildUpstreamUrl,
  hasInvalidToolArguments,
  prepareRequestBody,
  prepareUpstreamHeaders,
  toChatCompletionSse,
} from './shim.mjs';

test('prepareRequestBody forces non-streaming requests', () => {
  const body = prepareRequestBody({ model: 'claude-sonnet-4.5', stream: true, messages: [] });

  assert.equal(body.stream, false);
});

test('hasInvalidToolArguments detects truncated JSON tool arguments', () => {
  const response = {
    choices: [
      {
        message: {
          tool_calls: [
            {
              type: 'function',
              function: {
                name: 'write',
                arguments: '{"filePath":"/tmp/plan.md"',
              },
            },
          ],
        },
      },
    ],
  };

  assert.equal(hasInvalidToolArguments(response), true);
});

test('hasInvalidToolArguments accepts complete JSON tool arguments', () => {
  const response = {
    choices: [
      {
        message: {
          tool_calls: [
            {
              type: 'function',
              function: {
                name: 'write',
                arguments: JSON.stringify({ filePath: '/tmp/plan.md', content: 'ok' }),
              },
            },
          ],
        },
      },
    ],
  };

  assert.equal(hasInvalidToolArguments(response), false);
});

test('buildUpstreamUrl preserves OpenAI /v1 paths', () => {
  assert.equal(
    buildUpstreamUrl('/v1/models', 'http://enowxai:1430/v1').toString(),
    'http://enowxai:1430/v1/models',
  );
});

test('prepareUpstreamHeaders removes stale content-length', () => {
  const headers = prepareUpstreamHeaders({ host: '127.0.0.1:1432', 'content-length': '123' });

  assert.equal(headers.host, undefined);
  assert.equal(headers['content-length'], undefined);
  assert.equal(headers['content-type'], 'application/json');
});

test('toChatCompletionSse converts non-stream content response to SSE', () => {
  const sse = toChatCompletionSse({
    id: 'chatcmpl-test',
    object: 'chat.completion',
    created: 1,
    model: 'claude-sonnet-4.5-thinking',
    choices: [{ index: 0, message: { role: 'assistant', content: 'pong' }, finish_reason: 'stop' }],
  });

  assert.match(sse, /^data: /);
  assert.match(sse, /"content":"pong"/);
  assert.match(sse, /data: \[DONE\]/);
});
