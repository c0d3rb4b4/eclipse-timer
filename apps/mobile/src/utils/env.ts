export function envFlagEnabled(value: string | undefined) {
  if (typeof value !== "string") return false;

  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
}

export function readEnvFlag(name: string) {
  return envFlagEnabled(process.env[name]);
}
