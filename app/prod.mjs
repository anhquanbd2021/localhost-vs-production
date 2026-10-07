// prod.mjs — the article's thirteen production layers as a blast-radius
// simulator. Each layer absorbs a class of failure that localhost never
// exercises. Fire a scenario, see which layer catches it; toggle a layer off
// and watch the same failure reach users.
//
// Pure module: shared by app/server.js, the browser UI, and tests.

export const LAYERS = [
  { id: "dns-tls", name: "DNS + TLS", gist: "name resolution and certificates before your code runs" },
  { id: "lb-health", name: "LB + health checks", gist: "route only to instances that can actually serve" },
  { id: "env-config", name: "Environment config", gist: "fail loudly instead of defaulting to dev values" },
  { id: "secrets", name: "Managed secrets", gist: "rotation, access control, audit" },
  { id: "migrations", name: "Expand/contract migrations", gist: "schema changes that survive real data" },
  { id: "conn-pools", name: "Connection pools", gist: "deliberate limits vs the database's max" },
  { id: "timeouts", name: "Timeouts", gist: "a boundary on every call that leaves the process" },
  { id: "retries", name: "Retries (bounded)", gist: "backoff + jitter + idempotency, or a retry storm" },
  { id: "rate-limits", name: "Rate limits", gist: "visible ceilings in every direction" },
  { id: "logging", name: "Structured logs", gist: "what failed, which request, which dependency" },
  { id: "metrics", name: "Metrics (p95/p99)", gist: "the tail where damage lives, not the average" },
  { id: "alerts", name: "Actionable alerts", gist: "fire only when a human must act" },
  { id: "rollbacks", name: "Rollbacks", gist: "fast path back to known-good" },
];

export const SCENARIOS = [
  {
    id: "slow-dep",
    name: "Downstream dependency goes slow",
    localhost: "Your laptop doesn't notice — you restart the dev server.",
    absorbedBy: ["timeouts", "metrics", "alerts"],
    blast: "Requests pile up on the dead dependency until threads, workers, and memory are gone. One slow API takes down a healthy app.",
  },
  {
    id: "flaky-dep",
    name: "Payment API returns transient 500s",
    localhost: "You hit refresh once and it works.",
    absorbedBy: ["retries", "timeouts", "logging"],
    blast: "Every client retries at once with no backoff — a retry storm finishes the outage the first error started.",
  },
  {
    id: "traffic-burst",
    name: "Traffic spikes 50× at launch",
    localhost: "Fifty requests is your whole day in dev.",
    absorbedBy: ["rate-limits", "lb-health", "metrics"],
    blast: "Every request is admitted until the fleet saturates — an invisible limiter looks like random failure to clients.",
  },
  {
    id: "pool-starve",
    name: "Scale to 10 instances × pool of 20 against a 150-connection database",
    localhost: "One dev instance never comes close to the limit.",
    absorbedBy: ["conn-pools", "metrics"],
    blast: "The last instances starve. Scaling didn't make the system faster — it made it a queue.",
  },
  {
    id: "bad-migration",
    name: "Deploy ships a breaking schema change on real data",
    localhost: "Dropping a column on an empty dev database is instant.",
    absorbedBy: ["migrations", "rollbacks", "alerts"],
    blast: "Old code still running reads a schema that no longer exists — and there is no fast path back.",
  },
  {
    id: "env-drift",
    name: "Prod boots with a missing config value",
    localhost: "The default quietly points at your dev database.",
    absorbedBy: ["env-config", "alerts"],
    blast: "Production traffic silently writes to a dev store for six hours before anyone diffs the row counts.",
  },
  {
    id: "secret-leak",
    name: "An API key lands in logs and git history",
    localhost: "The key in your .env never leaves the laptop.",
    absorbedBy: ["secrets", "logging"],
    blast: "The commit is deleted but the key survives in history, build logs, and caches — deleting the commit deletes nothing.",
  },
  {
    id: "p99-tail",
    name: "5% of requests take 8 seconds",
    localhost: "Average latency looks great.",
    absorbedBy: ["metrics", "alerts"],
    blast: "The p50 is fine while one user in twenty gives up — the tail is where the damage lives, and nobody sees it.",
  },
  {
    id: "cert-expiry",
    name: "The TLS certificate expires at 02:00 on a weekend",
    localhost: "Dev runs plain HTTP — no cert to expire.",
    absorbedBy: ["alerts", "dns-tls"],
    blast: "A healthy backend behind an expired certificate is still unusable. Users get the browser warning, not your app.",
  },
];

export function listLayers() {
  return LAYERS;
}

export function listScenarios() {
  return SCENARIOS.map(({ id, name, localhost }) => ({ id, name, localhost }));
}

// run(scenarioId, enabledLayerIds) -> trace + outcome
export function run(scenarioId, enabledIds) {
  const s = SCENARIOS.find((x) => x.id === scenarioId);
  if (!s) return null;
  const enabled = new Set(enabledIds ?? LAYERS.map((l) => l.id));
  const chain = s.absorbedBy.map((id) => {
    const layer = LAYERS.find((l) => l.id === id);
    return { id, name: layer.name, active: enabled.has(id) };
  });
  const catcher = chain.find((c) => c.active);
  return {
    scenario: { id: s.id, name: s.name, localhost: s.localhost },
    chain,
    absorbed: !!catcher,
    caughtBy: catcher ? catcher.name : null,
    outcome: catcher
      ? `${catcher.name} absorbs it — the article's point: this failure only exists in production.`
      : s.blast,
  };
}

// matrix: every scenario × full stack vs. one layer removed
export function matrix() {
  const all = LAYERS.map((l) => l.id);
  return SCENARIOS.map((s) => {
    const full = run(s.id, all);
    const perLayer = {};
    for (const id of new Set(s.absorbedBy)) {
      perLayer[id] = run(s.id, all.filter((x) => x !== id));
    }
    return { scenario: s.id, fullStack: full.absorbed, removed: perLayer };
  });
}
