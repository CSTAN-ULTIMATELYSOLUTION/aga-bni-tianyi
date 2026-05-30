import assert from "node:assert/strict";
import test from "node:test";
import { calculateTeamBonusAwards, currentSubmissionWeeks, evidenceKindsForForm, validateEvidenceFile } from "./game.js";

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

const approved = {
  one_to_one_status: "approved",
  training_status: "approved",
  referral_status: "approved",
  tyfcb_status: "approved",
  visitor_status: "approved",
  status: "active",
};

const submission = (overrides) => ({
  member_id: "member-a",
  buddy_team_id: "team-1",
  week_id: 1,
  month: "June",
  one_to_one: 0,
  training: 0,
  referrals: 0,
  tyfcb: 0,
  visitors: 0,
  ...approved,
  ...overrides,
});

test("team bonus awards monthly all-five only when both buddies complete all five approved sections", () => {
  const awards = calculateTeamBonusAwards({
    teamId: "team-1",
    memberIds: ["member-a", "member-b"],
    submissions: [
      submission({ member_id: "member-a", week_id: 1, one_to_one: 1, training: 1, referrals: 1, tyfcb: 1000, visitors: 1 }),
      submission({ member_id: "member-b", week_id: 1, one_to_one: 1, training: 1, referrals: 1, tyfcb: 1000, visitors: 1 }),
      submission({ member_id: "member-a", week_id: 2, one_to_one: 1, training: 1, referrals: 1, tyfcb: 1000, visitors: 1 }),
      submission({ member_id: "member-b", week_id: 2, one_to_one: 1, training: 1, referrals: 1, tyfcb: 1000, visitors: 1 }),
    ],
  });

  assert.equal(awards.filter((award) => award.bonus_type === "all_five_buddy_monthly").length, 1);
  assert.equal(awards.find((award) => award.bonus_type === "all_five_buddy_monthly").points, 3);
});

test("team bonus awards weekly visitor bonus when both buddies have approved visitors in the same week", () => {
  const awards = calculateTeamBonusAwards({
    teamId: "team-1",
    memberIds: ["member-a", "member-b"],
    submissions: [
      submission({ member_id: "member-a", week_id: 4, visitors: 1 }),
      submission({ member_id: "member-b", week_id: 4, visitors: 2 }),
      submission({ member_id: "member-a", week_id: 5, visitors: 1 }),
    ],
  });

  assert.deepEqual(
    awards.filter((award) => award.bonus_type === "both_buddies_visitor_weekly").map((award) => award.week_id),
    [4]
  );
});

test("team bonus awards four visitor and rescue bonuses on two-week windows", () => {
  const awards = calculateTeamBonusAwards({
    teamId: "team-1",
    memberIds: ["member-a", "member-b"],
    submissions: [
      submission({ member_id: "member-a", week_id: 1, visitors: 2, referrals: 0 }),
      submission({ member_id: "member-a", week_id: 2, visitors: 2, referrals: 0 }),
      submission({ member_id: "member-b", week_id: 1, visitors: 0, referrals: 0 }),
      submission({ member_id: "member-b", week_id: 2, visitors: 0, referrals: 0 }),
    ],
  });

  assert.equal(awards.find((award) => award.bonus_type === "four_visitor_two_week")?.points, 10);
  assert.equal(awards.find((award) => award.bonus_type === "rescue_teammate")?.points, 5);
});

test("rescue bonus does not count a missing teammate submission as zero activity", () => {
  const awards = calculateTeamBonusAwards({
    teamId: "team-1",
    memberIds: ["member-a", "member-b"],
    submissions: [
      submission({ member_id: "member-a", week_id: 1, visitors: 1, referrals: 0 }),
      submission({ member_id: "member-a", week_id: 2, visitors: 0, referrals: 3 }),
    ],
  });

  assert.equal(awards.some((award) => award.bonus_type === "rescue_teammate"), false);
});
