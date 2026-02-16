import type { ContactKey } from "./contacts";

const CONTACT_COLORS: Record<ContactKey, string> = {
  c1: "#67d2ff",
  c2: "#8dff8d",
  max: "#e8e8e8",
  c3: "#ffd866",
  c4: "#ff8f8f",
};

export function colorForContactKey(key: ContactKey): string {
  return CONTACT_COLORS[key];
}
