const PB_BASE_URL = "https://api.phantombuster.com/api/v2";

type PhantomConfig = {
  apiKey: string;
  connectAgentId: string;
  messageAgentId: string;
};

type LaunchResult = {
  containerId: string;
};

async function pbRequest<T>(
  apiKey: string,
  path: string,
  body?: Record<string, unknown>
): Promise<T> {
  const res = await fetch(`${PB_BASE_URL}${path}`, {
    method: body ? "POST" : "GET",
    headers: {
      "X-Phantombuster-Key": apiKey,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PhantomBuster API error ${res.status}: ${text}`);
  }

  return res.json() as Promise<T>;
}

/**
 * Send a LinkedIn connection request via PhantomBuster.
 * Uses the LinkedIn Auto Connect phantom.
 *
 * Field names match the phantom's JSON config:
 * - inputType: "profileUrl" (single URL mode)
 * - profileUrl: the LinkedIn profile URL
 * - message: connection note (max 300 chars)
 * - numberOfAddsPerLaunch: 1 (one at a time from our system)
 */
export async function sendConnectionRequest(
  config: PhantomConfig,
  linkedinUrl: string,
  note: string
): Promise<LaunchResult> {
  const result = await pbRequest<LaunchResult>(config.apiKey, "/agents/launch", {
    id: config.connectAgentId,
    argument: JSON.stringify({
      inputType: "profileUrl",
      profileUrl: linkedinUrl,
      message: note.slice(0, 300),
      numberOfAddsPerLaunch: 1,
      onlySecondCircle: false,
      dwellTime: true,
    }),
  });

  return result;
}

/**
 * Send a LinkedIn message via PhantomBuster.
 * Uses the LinkedIn Message Sender phantom.
 */
export async function sendLinkedInMessage(
  config: PhantomConfig,
  linkedinUrl: string,
  message: string
): Promise<LaunchResult> {
  const result = await pbRequest<LaunchResult>(config.apiKey, "/agents/launch", {
    id: config.messageAgentId,
    argument: JSON.stringify({
      inputType: "profileUrl",
      profileUrl: linkedinUrl,
      message,
      numberOfMessagesPerLaunch: 1,
    }),
  });

  return result;
}

/**
 * Check the status of a PhantomBuster agent run.
 */
export async function checkAgentStatus(
  apiKey: string,
  containerId: string
): Promise<{ status: "running" | "finished" | "error"; output?: unknown }> {
  const result = await pbRequest<{ status: string; output?: unknown }>(
    apiKey,
    `/containers/fetch?id=${containerId}`
  );

  const status =
    result.status === "running"
      ? "running"
      : result.status === "finished"
        ? "finished"
        : "error";

  return { status, output: result.output };
}

export type { PhantomConfig };
