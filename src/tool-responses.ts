export type ToolResponse = {
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
};

export function textResponse(text: string, isError = false): ToolResponse {
  return {
    content: [{ type: 'text', text }],
    isError,
  };
}

export function errorResponse(text: string): ToolResponse {
  return textResponse(text, true);
}

export function stackErrorResponse(prefix: string, error: unknown): ToolResponse {
  if (error instanceof Error) {
    return textResponse(`${prefix}: ${error.message}\n\nStack: ${error.stack ?? 'unavailable'}`, true);
  }

  return textResponse(`${prefix}: ${String(error)}`, true);
}
