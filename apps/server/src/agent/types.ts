import type { z } from 'zod';

export type JsonSchema = Record<string, unknown>;

export type AgentToolDefinition = {
  name: string;
  description: string;
  inputSchema: JsonSchema;
};

export type AgentTool<I, O> = AgentToolDefinition & {
  input: z.ZodType<I>;
  run: (input: I) => Promise<O>;
};

export type AgentInvokeRequest = {
  tool: string;
  arguments?: unknown;
};

export type AgentInvokeSuccess = {
  ok: true;
  tool: string;
  result: unknown;
};

export type AgentInvokeError = {
  ok: false;
  error: string;
  issues?: unknown;
};
