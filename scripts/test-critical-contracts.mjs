import assert from "node:assert/strict";
import fs from "node:fs";

const html = fs.readFileSync("index.html", "utf8");
const edge = fs.readFileSync("supabase/functions/flowtube-api/index.ts", "utf8");
const agentUi = fs.readFileSync("src/components/nexus-ui/agent-ui.tsx", "utf8");
const billingSql = fs.readFileSync("supabase/migrations/20260821100000_atomic_billing_credit_grants.sql", "utf8");
const generationSql = fs.readFileSync("supabase/migrations/20260821120000_atomic_generation_completion.sql", "utf8");
const persistUiState = html.match(/persistUiState\(\)\{([\s\S]*?)\n  isSettingsPage\(/)?.[1] || "";
const billingStatusStart = edge.indexOf("async function billingStatus(req: Request)");
const billingStatusEnd = edge.indexOf("function normalizeTeamRole", billingStatusStart);
const billingStatus = billingStatusStart >= 0 && billingStatusEnd > billingStatusStart
  ? edge.slice(billingStatusStart, billingStatusEnd)
  : "";

assert.ok(persistUiState, "The UI persistence boundary must remain detectable");
assert.doesNotMatch(persistUiState, /messages\s*:/, "Messages must never be persisted in localStorage");
assert.doesNotMatch(persistUiState, /studioContextByProject\s*:/, "Project context must remain server-backed");
assert.doesNotMatch(persistUiState, /attachments\s*:/, "Attachments must never be persisted in localStorage");
assert.doesNotMatch(html, /pl\.creditsTitle|pl\.creditsNote/, "Dead pricing placeholders must not return");
assert.match(html, /routeMainDisplay: st\.page === 'pricing' \|\| this\.isSettingsPage\(st\.page\) \? 'none' : 'flex'/, "Overlay routes must remove the private chat from the accessible tree");
assert.match(html, /intent\s*:\s*this\.state\.modelCatalogTab === 'media' \? 'generate' : 'auto'/, "The frontend must send explicit media intent");
assert.ok(html.includes("this.apiFetch('/api/runs/'+encodeURIComponent(runId)+'/cancel'"), "Run cancellation must reach the server");

assert.match(edge, /\/payment-status\/\$\{encodeURIComponent\(safeTransactionId\)\}/, "Fapshi callbacks must be verified with the provider status endpoint");
assert.match(edge, /fapshiPaymentMatchesSession\(session, verified\)/, "Verified payments must match the immutable checkout session");
assert.match(edge, /const successful = rawStatus === "successful"/, "Only a successful provider status may grant credits");
assert.match(edge, /safeExternalFetch\(resultUrl/, "Provider media downloads must use the SSRF-safe fetcher");
assert.match(edge, /complete_generation_with_result/, "Media completion and credit closure must be atomic");
assert.match(edge, /generatedMediaKind\(generation\.type\)/, "Media limits must be selected from the real generation type");
assert.match(edge, /refreshGenerationMediaUrls/, "Expired signed media URLs must be renewable");
assert.match(edge, /const socialReply = socialOnlyReply\(prompt\)/, "Social messages must bypass stale project orchestration");
assert.match(edge, /Bonjour ! Comment puis-je vous aider \?/, "Simple greetings need a short deterministic response");
assert.match(edge, /function orchestrateRequest\(/, "Every run must pass through one orchestration decision");
assert.match(edge, /usesAgentLoop = agentLoopEnabled\(\) && !media && usesTools/, "Agent tools must require an explicit tool-bearing workflow");
assert.match(edge, /orchestration\.requiresProjectContext \? history : \[\]/, "Independent prompts must not inherit unrelated project history");
assert.match(edge, /memory: orchestration\.requiresProjectContext \? memory : \[\]/, "Independent prompts must not inherit project memory");
assert.match(edge, /elements: orchestration\.requiresProjectContext \? elements : \[\]/, "Independent prompts must not inherit pinned project elements");
assert.match(edge, /const responseType = willGenerate \? type : \(orchestration\.intent === "document" \? "document" : "conversation"\)/, "Conversational turns must not be framed as image generations");
assert.match(edge, /complexity === "simple" && \/flash\|mini\|fast\|haiku\//, "Auto routing must prefer efficient models for simple requests");
assert.match(edge, /complexity === "complex" && \/opus\|pro\|reason\|thinking\|gpt-5\|gemini\.\*pro\//, "Auto routing must favor capable models for complex work");
assert.match(edge, /for \(const model of agentModelFallbacks\(requestedModel\)\)/, "Unavailable agent models must fall back to a confirmed compatible model");
assert.ok(billingStatus, "The public billing status contract must remain detectable");
assert.doesNotMatch(billingStatus, /\.select\("\*"\)/, "Billing status must not expose raw database rows");
assert.doesNotMatch(billingStatus, /stripe_(?:customer|subscription|invoice)_id/, "Billing status must not expose provider identifiers");
assert.doesNotMatch(billingStatus, /\bmetadata\b/, "Billing status must not expose private billing metadata");
assert.match(billingStatus, /amount_paid_usd \|\| 0\) \* 100/, "Invoice amounts must be normalized to minor units for the UI");

assert.match(billingSql, /for update/i, "Billing grants must lock the account balance");
assert.match(billingSql, /credit_transactions_billing_grant_unique/, "Billing grants need a database idempotency constraint");
assert.match(generationSql, /for update/i, "Generation completion must lock its terminal state");
assert.match(generationSql, /generation_reserved/, "Generation completion must close an existing reservation");

assert.doesNotMatch(html, /streamPhraseIndex|STREAM_PHRASES|streamPhraseFor/, "Legacy streaming phrases must not compete with the React shimmer");
assert.match(html, /this\.streamBuffers\[id\] = \(this\.streamBuffers\[id\] \|\| ''\) \+ delta/, "Response chunks must be buffered off-screen");
assert.doesNotMatch(html, /requestAnimationFrame\(\(\)=>\{[\s\S]{0,180}flushAgentText/, "Response chunks must not be rendered frame by frame");
assert.match(html, /hasMedia: !!m\.media && status==='done' && !!resultUrl/, "Incomplete media must not render a legacy progress card");
assert.match(html, /streamPhase: mediaFailed \? 'error' : \(mediaLoading \? 'rendering'/, "Failed hydrated media must never be marked complete");
assert.match(html, /responseText:mediaFailed[\s\S]{0,260}media\.errorMessage/, "Failed media must replace provisional copy with an actionable error");
assert.match(html, /responseStatus === 400 \|\| responseStatus === 401 \|\| responseStatus === 403/, "Transient refresh failures must not erase the local session");
assert.match(edge, /creditsRefunded: Boolean\(generation\.failure_refunded_at\)/, "The public media contract must distinguish confirmed refunds");
assert.doesNotMatch(edge, /Je prépare le rendu/, "Media runs must not persist or stream provisional assistant copy");
assert.match(edge, /content: String\(assistantText \|\| ""\)\.trim\(\)/, "Media lifecycle messages must not masquerade as final replies");
assert.match(edge, /lastTurnRequestsGenerationConfirmation\(history\)/, "Stale media confirmations must be handled without a paid model call");
assert.match(edge, /pendingBelongsToProject/, "Generation confirmations must be scoped to the active project");
assert.match(edge, /24 \* 60 \* 60 \* 1000/, "Generation confirmations must remain usable during a normal project session");
assert.match(agentUi, /import ReactMarkdown from 'react-markdown'/, "Agent responses must use a real Markdown renderer");
assert.match(agentUi, /remarkPlugins=\{\[remarkGfm\]\}/, "Agent responses must support GitHub-flavored Markdown");
assert.match(agentUi, /replace\(\/\[ \\t\]\+\[◆♦🔹\]/, "Inline model bullets must be normalized into readable lists");
assert.match(agentUi, /if \(!active && !hasDetails && !hasResponse\) return null/, "A final response must render even without action callbacks");

console.log("critical-contracts: ok");
