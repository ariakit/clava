// Keyed by the current console.warn so test spies start with empty dedupe
// state while repeated messages still warn only once per active function.
const warnedMessages = new WeakMap<typeof console.warn, Set<string>>();

export function warn(message: string): void {
  const warnFunction = console.warn;
  let messages = warnedMessages.get(warnFunction);
  if (!messages) {
    messages = new Set();
    warnedMessages.set(warnFunction, messages);
  }
  if (messages.has(message)) return;
  messages.add(message);
  warnFunction.call(console, message);
}
