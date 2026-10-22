export const DEFAULT_BRIDGE_PORT = 8765;
export const DEFAULT_BRIDGE_HOST = "127.0.0.1";
export const BRIDGE_WS_URL = `ws://${DEFAULT_BRIDGE_HOST}:${DEFAULT_BRIDGE_PORT}/bridge`;
export const BRIDGE_HTTP_URL = `http://${DEFAULT_BRIDGE_HOST}:${DEFAULT_BRIDGE_PORT}`;

export const DEFAULT_MODE: "balanced" = "balanced";

export const SENSITIVE_KEYWORDS = [
  "password",
  "passcode",
  "pin",
  "credit card",
  "debit card",
  "cvv",
  "cvc",
  "ssn",
  "social security",
  "checkout",
  "place order",
  "pay now",
  "buy now",
  "purchase",
  "delete account",
  "delete organization",
  "transfer funds",
  "wire transfer",
  "terminate",
  "drop database",
  "revoke key"
];

export const SENSITIVE_INPUT_TYPES = [
  "password"
];

export const SENSITIVE_AUTOCOMPLETE_TYPES = [
  "current-password",
  "new-password",
  "cc-number",
  "cc-csc",
  "cc-exp",
  "cc-type"
];

export const PANIC_SHORTCUT = "Control+Shift+X";
