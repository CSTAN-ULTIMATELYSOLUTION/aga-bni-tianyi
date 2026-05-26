import assert from "node:assert/strict";
import test from "node:test";
import { calcScore, currentSubmissionWeeks, evidenceKindsForForm } from "./game.js";

const fullActivity = {
  one_to_one: 2,
  training: 1,
  referrals: 1,
  tyfcb: 1000,
  visitors: 1,
  visitor_joined: 1,
};

test("member-declared attendance does not add the attendance bonus", () => {
  assert.equal(calcScore({ ...fullActivity, attended: true }), 50);
});

test("admin-marked attendance adds the attendance bonus", () => {
  assert.equal(calcScore({ ...fullActivity, admin_attended: true }), 53);
});

test("proof photos are optional for member submissions", () => {
  assert.deepEqual(evidenceKindsForForm(fullActivity), []);
});

test("testing period before June opens only week 1", () => {
  assert.deepEqual(currentSubmissionWeeks(new Date("2026-05-26T12:00:00+08:00")).map((week) => week.id), [1]);
});
