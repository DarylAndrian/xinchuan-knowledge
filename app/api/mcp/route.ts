import { NextRequest, NextResponse } from "next/server";
import {
  MCP_PROTOCOL_VERSION,
  SERVER_INFO,
  McpToolError,
  callTool,
  jsonRpcError,
  jsonRpcResult,
  listToolDefinitions,
} from "@/lib/mcp";
import { authenticateAccessToken, bearerToken } from "@/lib/tokens";

export const dynamic = "force-dynamic";

const ACCEPTED_VERSIONS = new Set(["2025-03-26", "2024-11-05", "2025-06-18"]);

function unauthorized() {
  return NextResponse.json(
    { error: "A valid Personal Access Token is required. Authorization: Bearer xk_pat_…" },
    { status: 401, headers: { "WWW-Authenticate": "Bearer" } }
  );
}

type JsonRpcMessage = {
  jsonrpc?: string;
  id?: string | number | null;
  method?: string;
  params?: Record<string, unknown>;
};

export async function POST(req: NextRequest) {
  const principal = authenticateAccessToken(bearerToken(req.headers.get("authorization")));
  if (!principal) return unauthorized();

  let body: JsonRpcMessage | JsonRpcMessage[];
  try {
    body = await req.json();
  } catch {
    return jsonRpcError(null, -32700, "Parse error");
  }

  // JSON-RPC batches are rare in MCP; handle single messages only.
  if (Array.isArray(body)) {
    return jsonRpcError(null, -32600, "Batch requests are not supported");
  }
  const message = body;
  const { id, method, params } = message;
  const isNotification = id === undefined || id === null;

  if (method === "notifications/initialized" || method === "notifications/cancelled") {
    return new NextResponse(null, { status: 202 });
  }

  if (method === "initialize") {
    const requested = String(params?.protocolVersion ?? MCP_PROTOCOL_VERSION);
    const protocolVersion = ACCEPTED_VERSIONS.has(requested) ? requested : MCP_PROTOCOL_VERSION;
    return jsonRpcResult(id ?? null, {
      protocolVersion,
      capabilities: { tools: {} },
      serverInfo: SERVER_INFO,
      instructions:
        "Xinchuan Knowledge Center MCP. Use PAT scopes to search/read content, manage pages and comments, and administer users/settings when granted.",
    });
  }

  if (method === "ping") {
    return jsonRpcResult(id ?? null, {});
  }

  if (method === "tools/list") {
    return jsonRpcResult(id ?? null, { tools: listToolDefinitions(principal) });
  }

  if (method === "tools/call") {
    const name = String(params?.name || "");
    const args = (params?.arguments && typeof params.arguments === "object"
      ? (params.arguments as Record<string, unknown>)
      : {});
    try {
      const result = await callTool(principal, name, args);
      const structured =
        result !== null && typeof result === "object"
          ? (result as Record<string, unknown>)
          : { result };
      return jsonRpcResult(id ?? null, {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        structuredContent: structured,
        isError: false,
      });
    } catch (error) {
      const messageText = error instanceof Error ? error.message : String(error);
      const code = error instanceof McpToolError ? error.status : -32000;
      return jsonRpcResult(id ?? null, {
        content: [{ type: "text", text: messageText }],
        isError: true,
        _meta: { code },
      });
    }
  }

  if (isNotification) {
    return new NextResponse(null, { status: 202 });
  }

  return jsonRpcError(id ?? null, -32601, `Method not found: ${method}`);
}

export async function GET(req: NextRequest) {
  const principal = authenticateAccessToken(bearerToken(req.headers.get("authorization")));
  if (!principal) return unauthorized();
  // Streamable HTTP GET is optional; advertise that clients should use POST.
  return NextResponse.json(
    {
      error: "Use POST for MCP JSON-RPC. This endpoint does not open an SSE stream.",
      protocolVersion: MCP_PROTOCOL_VERSION,
      serverInfo: SERVER_INFO,
    },
    { status: 405, headers: { Allow: "POST, OPTIONS" } }
  );
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      Allow: "POST, GET, OPTIONS",
      "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
      "Access-Control-Allow-Headers": "Authorization, Content-Type, Accept, Mcp-Session-Id",
      "Access-Control-Max-Age": "86400",
    },
  });
}
