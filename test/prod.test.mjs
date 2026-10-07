import test from "node:test";
import assert from "node:assert/strict";
import { LAYERS, SCENARIOS, listScenarios, run, matrix } from "../app/prod.mjs";

test("all thirteen article layers are present", () => {
  assert.equal(LAYERS.length, 13);
  assert.deepEqual(
    LAYERS.map((l) => l.id),
    ["dns-tls", "lb-health", "env-config", "secrets", "migrations", "conn-pools", "timeouts", "retries", "rate-limits", "logging", "metrics", "alerts", "rollbacks"],
  );
});

test("full stack absorbs every scenario", () => {
  for (const s of SCENARIOS) {
    const r = run(s.id, LAYERS.map((l) => l.id));
    assert.ok(r.absorbed, `${s.id} should be contained with all layers on`);
  }
});

test("removing every absorbing layer lets the blast through", () => {
  const s = SCENARIOS.find((x) => x.id === "slow-dep");
  const r = run("slow-dep", LAYERS.map((l) => l.id).filter((id) => !s.absorbedBy.includes(id)));
  assert.equal(r.absorbed, false);
  assert.match(r.outcome, /pile up|takes down/);
});

test("first active absorber catches — timeouts beat alerts for slow-dep", () => {
  const r = run("slow-dep", null);
  assert.equal(r.caughtBy, "Timeouts");
});

test("the chain reports each absorbing layer's state", () => {
  const r = run("bad-migration", LAYERS.map((l) => l.id).filter((id) => id !== "migrations"));
  const mig = r.chain.find((c) => c.id === "migrations");
  assert.equal(mig.active, false);
  assert.equal(r.caughtBy, "Rollbacks");
});

test("unknown scenario returns null", () => {
  assert.equal(run("nope", null), null);
});

test("matrix maps every scenario to its absorbing layers", () => {
  const m = matrix();
  assert.equal(m.length, SCENARIOS.length);
  for (const row of m) assert.equal(row.fullStack, true);
});

test("listScenarios exposes localhost framing for the UI", () => {
  for (const s of listScenarios()) {
    assert.ok(s.localhost.length > 10, `${s.id} needs a localhost contrast`);
  }
});
