import assert from "node:assert/strict";
import test from "node:test";
import { buildActivityLeaderboards, calculateTeamBonusAwards, currentSubmissionWeeks, evidenceKindsForForm, validateEvidenceFile } from "./game.js";

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

test("activity leaderboards count only approved values from active submissions", () => {
  const leaderboards = buildActivityLeaderboards([
    { member_id: "member-a", full_name: "Alex", status: "active", one_to_one: 2, one_to_one_status: "approved", training: 4, training_status: "pending", referrals: 3, referral_status: "approved", tyfcb: 1200, tyfcb_status: "approved", visitors: 1, visitor_status: "approved" },
    { member_id: "member-a", full_name: "Alex", status: "archived", one_to_one: 2, one_to_one_status: "approved", referrals: 20, referral_status: "approved" },
    { member_id: "member-b", full_name: "Bea", status: "active", one_to_one: 2, one_to_one_status: "approved", training: 2, training_status: "approved", referrals: 1, referral_status: "approved", tyfcb: 5000, tyfcb_status: "pending", visitors: 2, visitor_status: "approved" },
  ]);

  assert.deepEqual(leaderboards.one_to_one.map(({ full_name, value, rank }) => ({ full_name, value, rank })), [
    { full_name: "Alex", value: 2, rank: 1 },
    { full_name: "Bea", value: 2, rank: 1 },
  ]);
  assert.equal(leaderboards.training[0].full_name, "Bea");
  assert.equal(leaderboards.referral[0].value, 3);
  assert.equal(leaderboards.tyfcb[0].value, 1200);
  assert.equal(leaderboards.visitor[0].value, 2);
});

test("activity leaderboards exclude inactive members", () => {
  const leaderboards = buildActivityLeaderboards(
    [
      { member_id: "active", status: "active", referrals: 1, referral_status: "approved" },
      { member_id: "inactive", status: "active", referrals: 50, referral_status: "approved" },
    ],
    [
      { id: "active", full_name: "Active member", is_active: true },
      { id: "inactive", full_name: "Inactive member", is_active: false },
    ]
  );

  assert.deepEqual(leaderboards.referral.map((member) => member.full_name), ["Active member"]);
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
  assert.equal(awards.find((award) => award.bonus_type === "all_five_buddy_monthly").period_key, "month-1");
});

test("team bonus awards monthly all-five separately for week 5 to campaign end", () => {
  const awards = calculateTeamBonusAwards({
    teamId: "team-1",
    memberIds: ["member-a", "member-b"],
    submissions: [
      submission({ member_id: "member-a", week_id: 5, one_to_one: 1, training: 1, referrals: 1, tyfcb: 1000, visitors: 1 }),
      submission({ member_id: "member-b", week_id: 6, one_to_one: 1, training: 1, referrals: 1, tyfcb: 1000, visitors: 1 }),
    ],
  });

  assert.equal(awards.find((award) => award.bonus_type === "all_five_buddy_monthly")?.period_key, "month-2");
  assert.equal(awards.find((award) => award.bonus_type === "all_five_buddy_monthly")?.points, 3);
});

test("team bonus awards monthly visitor tiers using highest tier only", () => {
  const twoVisitorAwards = calculateTeamBonusAwards({
    teamId: "team-1",
    memberIds: ["member-a", "member-b"],
    submissions: [
      submission({ member_id: "member-a", week_id: 1, visitors: 1 }),
      submission({ member_id: "member-b", week_id: 2, visitors: 1 }),
    ],
  });
  assert.equal(twoVisitorAwards.find((award) => award.bonus_type === "monthly_visitor_2")?.points, 5);
  assert.equal(twoVisitorAwards.some((award) => award.bonus_type === "monthly_visitor_4"), false);

  const fourVisitorAwards = calculateTeamBonusAwards({
    teamId: "team-1",
    memberIds: ["member-a", "member-b"],
    submissions: [
      submission({ member_id: "member-a", week_id: 1, visitors: 2 }),
      submission({ member_id: "member-b", week_id: 3, visitors: 2 }),
    ],
  });
  assert.equal(fourVisitorAwards.find((award) => award.bonus_type === "monthly_visitor_4")?.points, 10);
  assert.equal(fourVisitorAwards.some((award) => award.bonus_type === "monthly_visitor_2"), false);

  const fiveVisitorAwards = calculateTeamBonusAwards({
    teamId: "team-1",
    memberIds: ["member-a", "member-b"],
    submissions: [
      submission({ member_id: "member-a", week_id: 1, visitors: 5 }),
    ],
  });
  assert.equal(fiveVisitorAwards.find((award) => award.bonus_type === "monthly_visitor_4")?.points, 10);
  assert.equal(fiveVisitorAwards.some((award) => award.bonus_type === "monthly_visitor_2"), false);
});

test("rescue bonus triggers when one buddy is empty and the other has visitor or referrals", () => {
  const awards = calculateTeamBonusAwards({
    teamId: "team-1",
    memberIds: ["member-a", "member-b"],
    submissions: [
      submission({ member_id: "member-a", week_id: 1, visitors: 1, referrals: 0, tyfcb: 0 }),
      submission({ member_id: "member-a", week_id: 2, visitors: 0, referrals: 0, tyfcb: 0 }),
      submission({ member_id: "member-b", week_id: 1, visitors: 0, referrals: 0 }),
      submission({ member_id: "member-b", week_id: 2, visitors: 0, referrals: 0 }),
    ],
  });

  assert.equal(awards.find((award) => award.bonus_type === "rescue_teammate")?.points, 5);

  const referralAwards = calculateTeamBonusAwards({
    teamId: "team-1",
    memberIds: ["member-a", "member-b"],
    submissions: [
      submission({ member_id: "member-a", week_id: 1, visitors: 0, referrals: 3, tyfcb: 0 }),
      submission({ member_id: "member-a", week_id: 2, visitors: 0, referrals: 0, tyfcb: 0 }),
      submission({ member_id: "member-b", week_id: 1, visitors: 0, referrals: 0 }),
      submission({ member_id: "member-b", week_id: 2, visitors: 0, referrals: 0 }),
    ],
  });
  assert.equal(referralAwards.find((award) => award.bonus_type === "rescue_teammate")?.points, 5);
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

test("rescue bonus does not trigger if empty buddy has TYFCB", () => {
  const awards = calculateTeamBonusAwards({
    teamId: "team-1",
    memberIds: ["member-a", "member-b"],
    submissions: [
      submission({ member_id: "member-a", week_id: 1, visitors: 1, referrals: 0 }),
      submission({ member_id: "member-a", week_id: 2, visitors: 0, referrals: 0 }),
      submission({ member_id: "member-b", week_id: 1, visitors: 0, referrals: 0, tyfcb: 1000 }),
      submission({ member_id: "member-b", week_id: 2, visitors: 0, referrals: 0 }),
    ],
  });

  assert.equal(awards.some((award) => award.bonus_type === "rescue_teammate"), false);
});
