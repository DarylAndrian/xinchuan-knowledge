"use client";

import { useEffect } from "react";

type ToolDefinition = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations: { readOnlyHint: true };
  execute: (input: Record<string, unknown>) => Promise<unknown>;
};

declare global {
  interface Document {
    modelContext?: { registerTool: (tool: ToolDefinition) => Promise<void> | void };
  }
  interface Window {
    __xinchuanWebMcpRegistered?: boolean;
  }
}

async function getJson(path: string) {
  const response = await fetch(path, { headers: { Accept: "application/json" } });
  const data = await response.json().catch(() => ({ error: "Invalid server response." }));
  if (!response.ok) throw new Error(String(data.error || `Request failed (${response.status}).`));
  return data;
}

export default function WebMCPTools() {
  useEffect(() => {
    const register = document.modelContext?.registerTool;
    if (typeof register !== "function" || window.__xinchuanWebMcpRegistered) return;
    window.__xinchuanWebMcpRegistered = true;

    const tools: ToolDefinition[] = [
      {
        name: "search_xinchuan_wiki",
        description: "Search the publicly published Xinchuan wiki and return matching pages.",
        inputSchema: {
          type: "object",
          properties: { query: { type: "string", minLength: 1, maxLength: 200 } },
          required: ["query"],
          additionalProperties: false,
        },
        annotations: { readOnlyHint: true },
        execute: async ({ query }) => getJson(`/api/public/search?q=${encodeURIComponent(String(query))}`),
      },
      {
        name: "read_xinchuan_page",
        description: "Read the plain-text content of one publicly published Xinchuan wiki page by ID.",
        inputSchema: {
          type: "object",
          properties: { page_id: { type: "integer", minimum: 1 } },
          required: ["page_id"],
          additionalProperties: false,
        },
        annotations: { readOnlyHint: true },
        execute: async ({ page_id }) => getJson(`/api/public/pages/${Number(page_id)}`),
      },
      {
        name: "list_xinchuan_collections",
        description: "List public Xinchuan wiki collections and their published page counts.",
        inputSchema: { type: "object", properties: {}, additionalProperties: false },
        annotations: { readOnlyHint: true },
        execute: async () => getJson("/api/public/collections"),
      },
      {
        name: "recent_xinchuan_updates",
        description: "List recently updated public Xinchuan wiki pages.",
        inputSchema: {
          type: "object",
          properties: { limit: { type: "integer", minimum: 1, maximum: 20, default: 10 } },
          additionalProperties: false,
        },
        annotations: { readOnlyHint: true },
        execute: async ({ limit = 10 }) => getJson(`/api/public/recent?limit=${Number(limit)}`),
      },
    ];

    Promise.all(tools.map((tool) => Promise.resolve(register.call(document.modelContext, tool))))
      .catch(() => { window.__xinchuanWebMcpRegistered = false; });
  }, []);

  return null;
}
