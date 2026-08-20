import assert from "node:assert/strict";
import fs from "node:fs";
import esbuild from "esbuild";

const source = fs.readFileSync("src/components/nexus-ui/agent-run.ts", "utf8");
const compiled = esbuild.transformSync(source, { loader: "ts", target: "es2020", format: "cjs" }).code;
const module = { exports: {} };
new Function("exports", "module", compiled)(module.exports, module);
const { initialAgentRunState, parseSseBlock, reduceAgentRunEvent, splitSseBlocks } = module.exports;

const event = parseSseBlock(`event: assistant.delta\r\nid: 1\r\ndata: ${JSON.stringify({
  type: "assistant.delta",
  runId: "run-1",
  messageId: "message-1",
  sequence: 1,
  payload: { delta: "Bonjour" },
})}\r\n\r\n`);
assert.equal(event.runId, "run-1");
assert.equal(event.sequence, 1);

let state = initialAgentRunState("run-1", "message-1");
state = reduceAgentRunEvent(state, event);
assert.equal(state.responseText, "Bonjour");
assert.equal(state.status, "working");

const duplicate = reduceAgentRunEvent(state, event);
assert.equal(duplicate.responseText, "Bonjour");
assert.equal(duplicate.sequence, 1);

state = reduceAgentRunEvent(state, {
  type: "run.completed",
  runId: "run-1",
  messageId: "message-1",
  sequence: 2,
  timestamp: new Date().toISOString(),
  payload: { status: "queued", resultConfirmed: false },
});
assert.equal(state.status, "working");
assert.equal(state.phase, "rendering");

state = reduceAgentRunEvent(state, {
  type: "run.completed",
  runId: "run-1",
  messageId: "message-1",
  sequence: 3,
  timestamp: new Date().toISOString(),
  payload: { resultConfirmed: false },
});
assert.equal(state.status, "interrupted");

let textState = initialAgentRunState("run-text", "message-text");
textState = reduceAgentRunEvent(textState, {
  type: "assistant.delta",
  runId: "run-text",
  messageId: "message-text",
  sequence: 2,
  timestamp: new Date().toISOString(),
  payload: { delta: "Réponse confirmée" },
});
textState = reduceAgentRunEvent(textState, {
  type: "run.completed",
  runId: "run-text",
  messageId: "message-text",
  sequence: 3,
  timestamp: new Date().toISOString(),
  payload: {},
});
assert.equal(textState.status, "complete");

let failedState = initialAgentRunState("run-failed", "message-failed");
failedState = reduceAgentRunEvent(failedState, {
  type: "run.failed",
  runId: "run-failed",
  messageId: "message-failed",
  sequence: 1,
  timestamp: new Date().toISOString(),
  payload: { message: "Le rendu a échoué." },
});
assert.equal(failedState.status, "error");
assert.equal(failedState.errorMessage, "Le rendu a échoué.");

const cancelledState = reduceAgentRunEvent(failedState, {
  type: "run.cancelled",
  runId: "run-failed",
  messageId: "message-failed",
  sequence: 2,
  timestamp: new Date().toISOString(),
  payload: {},
});
assert.equal(cancelledState.status, "cancelled");

const split = splitSseBlocks("data: one\r\n\r\ndata: two\r\n");
assert.deepEqual(split.blocks, ["data: one"]);
assert.equal(split.remainder, "data: two\r\n");

console.log("agent-run-contract: ok");
