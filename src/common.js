export class InputError extends Error {
  constructor(message, field) { super(message); this.field = field; }
}
export function requireObject(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new InputError('Send a JSON object as the request body.', 'body');
  }
}
export function trace() {
  const steps = [];
  return {
    steps,
    add(stage, action, title, explanation, formula, keyPoints, state = {}, highlights = []) {
      steps.push({
        id: steps.length + 1, stage, action, title, explanation, formula, keyPoints,
        state: structuredClone(state), highlights: structuredClone(highlights)
      });
    }
  };
}
export function finish(module, operation, level, input, result, t, keyPoints) {
  return { success: true, schemaVersion: '1.0', module, operation, level, input,
    result, steps: t.steps, summary: { totalSteps: t.steps.length, keyPoints } };
}
