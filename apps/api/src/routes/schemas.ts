import { z } from "zod";
import { openaiError } from "../lib/errors.js";
import type { ModelRecord } from "../registry/types.js";
import type { ChatMessage, NormalizedChatRequest } from "../types/chat.js";

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

export interface ValidateChatOptions {
  defaultMaxTokens: number;
  /** FEATURE_TOOLS_VISION */
  toolsVisionEnabled?: boolean;
  /** Resolved model (after alias); used for capability checks */
  model?: ModelRecord | null;
}

function hasMultimodal(messages: Array<{ content?: unknown }>): boolean {
  return messages.some((m) => Array.isArray(m.content));
}

function hasToolPayload(data: {
  tools?: unknown[];
  tool_choice?: unknown;
  functions?: unknown[];
  function_call?: unknown;
  messages: Array<{ role: string; tool_calls?: unknown }>;
}): boolean {
  if (data.tools?.length || data.tool_choice || data.functions?.length || data.function_call) {
    return true;
  }
  return data.messages.some(
    (m) => m.role === "tool" || m.role === "function" || Boolean(m.tool_calls),
  );
}

export function validateAndNormalizeChat(
  body: unknown,
  defaultMaxTokensOrOpts: number | ValidateChatOptions,
  maybeOpts?: Omit<ValidateChatOptions, "defaultMaxTokens">,
): NormalizedChatRequest {
  const opts: ValidateChatOptions =
    typeof defaultMaxTokensOrOpts === "number"
      ? { defaultMaxTokens: defaultMaxTokensOrOpts, ...maybeOpts }
      : defaultMaxTokensOrOpts;

  const parsed = chatCompletionBodySchema.safeParse(body);
  if (!parsed.success) {
    throw openaiError(
      400,
      parsed.error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join("; "),
      "invalid_request_error",
    );
  }
  const data = parsed.data;
  const toolsVision = opts.toolsVisionEnabled === true;
  const model = opts.model;

  const wantsTools = hasToolPayload(data);
  const wantsVision = hasMultimodal(data.messages);

  if (wantsTools) {
    if (!toolsVision) {
      throw openaiError(
        400,
        "Tools and function calling are not enabled. Set FEATURE_TOOLS_VISION=true.",
        "unsupported_parameter",
        "tools",
      );
    }
    if (model && !model.supports_tools) {
      throw openaiError(
        400,
        `Model ${model.id} does not support tools (supports_tools=false).`,
        "unsupported_parameter",
        "tools",
      );
    }
  }

  if (wantsVision) {
    if (!toolsVision) {
      throw openaiError(
        400,
        "Vision / multimodal message content is not enabled. Set FEATURE_TOOLS_VISION=true.",
        "unsupported_parameter",
        "messages",
      );
    }
    if (model && !model.supports_vision) {
      throw openaiError(
        400,
        `Model ${model.id} does not support vision (supports_vision=false).`,
        "unsupported_parameter",
        "messages",
      );
    }
  }

  for (const m of data.messages) {
    if (m.content !== null && m.content !== undefined) {
      if (typeof m.content !== "string" && !Array.isArray(m.content)) {
        throw openaiError(
          400,
          "Message content must be a string, null, or content-part array.",
          "invalid_request_error",
          "messages",
        );
      }
    }
  }

  const maxTokens = Math.min(data.max_tokens ?? opts.defaultMaxTokens, opts.defaultMaxTokens);

  const messages: ChatMessage[] = data.messages.map((m) => {
    let content: ChatMessage["content"] = null;
    if (typeof m.content === "string") content = m.content;
    else if (Array.isArray(m.content)) content = m.content as ChatMessage["content"];
    else if (m.content == null) content = null;

    return {
      role: m.role,
      content,
      ...(m.name ? { name: m.name } : {}),
      ...(m.tool_calls !== undefined ? { tool_calls: m.tool_calls } : {}),
      ...(m.tool_call_id !== undefined ? { tool_call_id: m.tool_call_id } : {}),
    };
  });

  return {
    model: data.model,
    messages,
    stream: data.stream ?? false,
    temperature: data.temperature,
    max_tokens: maxTokens,
    top_p: data.top_p,
    stop: data.stop,
    user: data.user,
    models: data.models,
    ...(data.tools ? { tools: data.tools } : {}),
    ...(data.tool_choice !== undefined ? { tool_choice: data.tool_choice } : {}),
    ...(data.response_format !== undefined ? { response_format: data.response_format } : {}),
  };
}
