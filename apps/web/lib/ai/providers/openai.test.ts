import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the OpenAI SDK: every instance shares one `create` spy we drive per test.
const create = vi.fn();
vi.mock("openai", () => ({
  default: class {
    chat = { completions: { create } };
  },
}));

import { openaiProvider } from "./openai";
import type { AgentStepRequest } from "./types";

/** Wrap a list of streamed chunks as the async-iterable the SDK returns. */
function streamOf(chunks: unknown[]) {
  return {
    async *[Symbol.asyncIterator]() {
      for (const c of chunks) yield c;
    },
  };
}

const baseReq: AgentStepRequest = {
  system: [{ text: "You are Otter." }],
  history: [{ role: "user", text: "find me a free 30 min" }],
  tools: [{ name: "find_free_slots", description: "…", schema: { type: "object" } }],
  tier: "deep",
};

describe("openaiProvider.streamAgentStep", () => {
  beforeEach(() => create.mockReset());

  it("streams text tokens and accumulates split tool-call argument deltas", async () => {
    create.mockResolvedValue(
      streamOf([
        { choices: [{ delta: { content: "Let me " } }] },
        { choices: [{ delta: { content: "check." } }] },
        // A single tool call whose id/name arrive once and args arrive in fragments.
        {
          choices: [
            {
              delta: {
                tool_calls: [
                  {
                    index: 0,
                    id: "call_1",
                    function: { name: "find_free_slots", arguments: '{"dur' },
                  },
                ],
              },
            },
          ],
        },
        {
          choices: [
            { delta: { tool_calls: [{ index: 0, function: { arguments: 'ationMinutes":30}' } }] } },
          ],
        },
      ]),
    );

    const tokens: string[] = [];
    const res = await openaiProvider.streamAgentStep({
      ...baseReq,
      onToken: (t) => tokens.push(t),
    });

    expect(tokens).toEqual(["Let me ", "check."]);
    expect(res.text).toBe("Let me check.");
    expect(res.toolCalls).toEqual([
      { id: "call_1", name: "find_free_slots", input: { durationMinutes: 30 } },
    ]);
    // The echoed assistant turn carries the reassembled arguments verbatim.
    const assistant = res.assistant as {
      role: string;
      tool_calls?: { id: string; function: { name: string; arguments: string } }[];
    };
    expect(assistant.role).toBe("assistant");
    expect(assistant.tool_calls?.[0]).toMatchObject({
      id: "call_1",
      function: { name: "find_free_slots", arguments: '{"durationMinutes":30}' },
    });
  });

  it("prepends a system message and maps tool results to role:tool messages", async () => {
    create.mockResolvedValue(streamOf([{ choices: [{ delta: { content: "ok" } }] }]));

    await openaiProvider.streamAgentStep({
      ...baseReq,
      history: [
        { role: "user", text: "hi" },
        { role: "assistant_raw", raw: { role: "assistant", content: null, tool_calls: [] } },
        { role: "tool_results", results: [{ id: "call_1", content: "no slots" }] },
      ],
    });

    const sent = create.mock.calls[0]![0] as { messages: { role: string; content?: unknown }[] };
    expect(sent.messages[0]).toEqual({ role: "system", content: "You are Otter." });
    expect(sent.messages.at(-1)).toEqual({
      role: "tool",
      tool_call_id: "call_1",
      content: "no slots",
    });
  });

  it("tolerates non-JSON tool arguments without throwing (input falls back to {})", async () => {
    create.mockResolvedValue(
      streamOf([
        {
          choices: [
            {
              delta: {
                tool_calls: [
                  {
                    index: 0,
                    id: "c",
                    function: { name: "get_preferences", arguments: "not json" },
                  },
                ],
              },
            },
          ],
        },
      ]),
    );

    const res = await openaiProvider.streamAgentStep(baseReq);
    expect(res.toolCalls).toEqual([{ id: "c", name: "get_preferences", input: {} }]);
  });
});
