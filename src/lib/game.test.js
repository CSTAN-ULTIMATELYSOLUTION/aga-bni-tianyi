import assert from "node:assert/strict";
import test from "node:test";
import { currentSubmissionWeeks, evidenceKindsForForm, validateEvidenceFile } from "./game.js";

const fullActivity = {
  one_to_one: 2,
  training: 1,
  referrals: 1,
  tyfcb: 1000,
  visitors: 1,
  visitor_joined: 1,
};

test("proof photos are optional for member submissions", () => {
  assert.deepEqual(evidenceKindsForForm(fullActivity), []);
});

test("testing period before June opens only week 1", () => {
  assert.deepEqual(currentSubmissionWeeks(new Date("2026-05-26T12:00:00+08:00")).map((week) => week.id), [1]);
});

test("submission weeks run Tuesday through Monday", () => {
  assert.deepEqual(currentSubmissionWeeks(new Date("2026-06-08T12:00:00+08:00")).map((week) => week.id), [1]);
  assert.deepEqual(currentSubmissionWeeks(new Date("2026-06-09T12:00:00+08:00")).map((week) => week.id), [2, 1]);
});

test("proof validation accepts supported image types and infers missing jpg type", () => {
  assert.equal(validateEvidenceFile({ name: "proof.jpg", type: "", size: 1024 }).valid, true);
  assert.equal(validateEvidenceFile({ name: "proof.jpeg", type: "image/jpeg", size: 1024 }).valid, true);
  assert.equal(validateEvidenceFile({ name: "proof.png", type: "image/png", size: 1024 }).valid, true);
  assert.equal(validateEvidenceFile({ name: "proof.webp", type: "image/webp", size: 1024 }).valid, true);
});

test("proof validation rejects HEIC and files over 5MB", () => {
  assert.equal(validateEvidenceFile({ name: "iphone.HEIC", type: "image/heic", size: 1024 }).reason, "heic");
  assert.equal(validateEvidenceFile({ name: "too-large.jpg", type: "image/jpeg", size: 5 * 1024 * 1024 + 1 }).reason, "size");
});
