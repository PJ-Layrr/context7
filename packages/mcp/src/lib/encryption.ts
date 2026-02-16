import { createCipheriv, randomBytes } from "crypto";
import { SERVER_VERSION } from "./constants.js";

const ENCRYPTION_KEY = process.env.CLIENT_IP_ENCRYPTION_KEY;
const ALGORITHM = "aes-256-cbc";
const COLLECT_CLIENT_IP = process.env.CONTEXT7_COLLECT_CLIENT_IP === "true";

function validateEncryptionKey(key: string): boolean {
  // Must be exactly 64 hex characters (32 bytes)
  return /^[0-9a-fA-F]{64}$/.test(key);
}

function encryptClientIp(clientIp: string): string | undefined {
  if (!ENCRYPTION_KEY || !validateEncryptionKey(ENCRYPTION_KEY)) {
    console.error("Client IP encryption key missing or invalid. Disabling IP collection.");
    return undefined;
  }

  try {
    const iv = randomBytes(16);
    const cipher = createCipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY, "hex"), iv);
    let encrypted = cipher.update(clientIp, "utf8", "hex");
    encrypted += cipher.final("hex");
    return iv.toString("hex") + ":" + encrypted;
  } catch (error) {
    console.error("Error encrypting client IP:", error);
    return undefined;
  }
}

export interface ClientContext {
  clientIp?: string;
  apiKey?: string;
  clientInfo?: {
    ide?: string;
    version?: string;
  };
  transport?: "stdio" | "http";
}

/**
 * Generate headers for Context7 API requests.
 * Handles client IP encryption, authentication, and telemetry headers.
 */
export function generateHeaders(context: ClientContext): Record<string, string> {
  const headers: Record<string, string> = {
    "X-Context7-Source": "mcp-server",
    "X-Context7-Server-Version": SERVER_VERSION,
  };

  if (context.clientIp && COLLECT_CLIENT_IP) {
    const encryptedIp = encryptClientIp(context.clientIp);
    if (encryptedIp) {
      headers["mcp-client-ip"] = encryptedIp;
    }
  }
  if (context.apiKey) {
    headers["Authorization"] = `Bearer ${context.apiKey}`;
  }
  if (context.clientInfo?.ide) {
    headers["X-Context7-Client-IDE"] = context.clientInfo.ide;
  }
  if (context.clientInfo?.version) {
    headers["X-Context7-Client-Version"] = context.clientInfo.version;
  }
  if (context.transport) {
    headers["X-Context7-Transport"] = context.transport;
  }

  return headers;
}
