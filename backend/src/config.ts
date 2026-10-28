try {
  process.loadEnvFile("../.env");
} catch {
  // No .env file: use whatever is already in process.env.
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing environment variable ${name}. Copy .env.example to .env in the repo root.`,
    );
  }
  return value;
}

export const config = {
  port: Number(process.env.PORT ?? 3000),
  databaseUrl: required("DATABASE_URL"),
  // Optional on purpose: without a key the app still starts, and skill
  // inference reports "no_key" instead of crashing the server.
  gemini: {
    apiKey: process.env.GEMINI_API_KEY || null,
    model: process.env.GEMINI_MODEL || "gemini-3.8-flash",
    timeoutMs: Number(process.env.GEMINI_TIMEOUT_MS ?? 8000),
  },
};