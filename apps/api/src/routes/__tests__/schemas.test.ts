import { describe, expect, it } from "vitest";
import { AppError } from "../../lib/errors.js";
import { validateAndNormalizeChat } from "../schemas.js";

describe("validateAndNormalizeChat", () => {
  it("accepts text chat", () => {
    const n = validateAndNormalizeChat(
      {
        model: "openai/gpt-4o-mini",
        messages: [{ role: "user", content: "hi" }],
      },
      4096,
    );
    expect(n.model).toBe("openai/gpt-4o-mini");
    expect(n.stream).toBe(false);
    expect(n.max_tokens).toBe(4096);
  });

  it("clamps max_tokens", () => {
    const n = validateAndNormalizeChat(
      {
        model: "openai/gpt-4o-mini",
        messages: [{ role: "user", content: "hi" }],
        max_tokens: 99999,
      },
      100,
    );
    expect(n.max_tokens).toBe(100);
  });

  it("rejects tools", () => {
    expect(() =>
      validateAndNormalizeChat(
        {
          model: "openai/gpt-4o-mini",
          messages: [{ role: "user", content: "hi" }],
          tools: [{ type: "function", function: { name: "x" } }],
        },
        4096,
      ),
    ).toThrow(AppError);
  });
});
