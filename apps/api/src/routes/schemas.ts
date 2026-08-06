import { z } from "zod";
import { openaiError } from "../lib/errors.js";
import type { NormalizedChatRequest } from "../types/chat.js";

const messageSchema = z.object({
  role: z.enum(["system", "user", "assistant", "tool", "function"]),
  content: z.union([z.string(), z.null(), z.array(z.unknown())]).optional(),
  name: z.string().optional(),
  tool_calls: z.unknown().optional(),
  tool_call_id: z.string().optional(),
});

export const chatCompletionBodySchema = z
  .object({
    model: z.string().min(1),
    messages: z.array(messageSchema).min(1),
    stream: z.boolean().optional(),
    temperature: z.number().optional(),
    max_tokens: z.number().int().positive().optional(),
    top_p: z.number().optional(),
    stop: z.union([z.string(), z.array(z.string())]).optional(),
    n: z.number().optional(),
    presence_penalty: z.number().optional(),
    frequency_penalty: z.number().optional(),
    user: z.string().optional(),
    models: z.array(z.string()).optional(),
    tools: z.array(z.unknown()).optional(),
    tool_choice: z.unknown().optional(),
    functions: z.array(z.unknown()).optional(),
    function_call: z.unknown().optional(),
    response_format: z.unknown().optional(),
  })
  .passthrough();

export function validateAndNormalizeChat(
  body: unknown,
  defaultMaxTokens: number,
): NormalizedChatRequest {
  const parsed = chatCompletionBodySchema.safeParse(body);
  if (!parsed.success) {
    throw openaiError(
      400,
      parsed.error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join("; "),
      "invalid_request_error",
    );
  }
  const data = parsed.data;

  if (data.tools?.length || data.tool_choice || data.functions?.length || data.function_call) {
    throw openaiError(
      400,
      "Tools and function calling are not supported in V1. Send text-only chat completions.",
      "unsupported_parameter",
      "tools",
    );
  }

  for (const m of data.messages) {
    if (Array.isArray(m.content)) {
      throw openaiError(
        400,
        "Vision / multimodal message content is not supported in V1. Use string content only.",
        "unsupported_parameter",
        "messages",
      );
    }
    if (m.content !== null && m.content !== undefined && typeof m.content !== "string") {
      throw openaiError(
        400,
        "Vision / multimodal message content is not supported in V1. Use string content only.",
        "unsupported_parameter",
        "messages",
      );
    }
    if (m.role === "tool" || m.role === "function" || m.tool_calls) {
      throw openaiError(
        400,
        "Tool messages are not supported in V1.",
        "unsupported_parameter",
        "messages",
      );
    }
  }

  const maxTokens = Math.min(data.max_tokens ?? defaultMaxTokens, defaultMaxTokens);

  return {
    model: data.model,
    messages: data.messages.map((m) => {
      const content: string | null =
        typeof m.content === "string" ? m.content : m.content == null ? null : null;
      return {
        role: m.role,
        content,
        ...(m.name ? { name: m.name } : {}),
      };
    }),
    stream: data.stream ?? false,
    temperature: data.temperature,
    max_tokens: maxTokens,
    top_p: data.top_p,
    stop: data.stop,
    user: data.user,
    models: data.models,
  };
}
