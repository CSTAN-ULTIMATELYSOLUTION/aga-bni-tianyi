export const WEEKS = [
  { id: 1, label: "Week 1 (02/06 - 08/06)", starts_on: "2026-06-02", ends_on: "2026-06-08", month: "June" },
  { id: 2, label: "Week 2 (09/06 - 15/06)", starts_on: "2026-06-09", ends_on: "2026-06-15", month: "June" },
  { id: 3, label: "Week 3 (16/06 - 22/06)", starts_on: "2026-06-16", ends_on: "2026-06-22", month: "June" },
  { id: 4, label: "Week 4 (23/06 - 29/06)", starts_on: "2026-06-23", ends_on: "2026-06-29", month: "June" },
  { id: 5, label: "Week 5 (30/06 - 06/07)", starts_on: "2026-06-30", ends_on: "2026-07-06", month: "July" },
  { id: 6, label: "Week 6 (07/07 - 13/07)", starts_on: "2026-07-07", ends_on: "2026-07-13", month: "July" },
  { id: 7, label: "Week 7 (14/07 - 20/07)", starts_on: "2026-07-14", ends_on: "2026-07-20", month: "July" },
  { id: 8, label: "Week 8 (21/07 - 27/07)", starts_on: "2026-07-21", ends_on: "2026-07-27", month: "July" },
  { id: 9, label: "Week 9 (28/07 - 31/07)", starts_on: "2026-07-28", ends_on: "2026-07-31", month: "July" },
];

export const FIELD_META = {
  one_to_one: { label: "1-2-1", zh: "一对一" },
  training: { label: "Training", zh: "培训" },
  referral: { label: "Referral", zh: "引荐" },
  tyfcb: { label: "TYFCB", zh: "引荐成交额" },
  visitor: { label: "Visitor", zh: "访客" },
};

export const MAX_EVIDENCE_BYTES = 5 * 1024 * 1024;
export const EVIDENCE_ACCEPT = ".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp";
export const ACCEPTED_EVIDENCE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];

const EVIDENCE_MIME_BY_EXTENSION = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
  heif: "image/heif",
};

export function evidenceFileExtension(fileName = "") {
  return String(fileName).split(".").pop()?.toLowerCase() || "";
}

export function evidenceFileMime(file = {}) {
  const declaredType = String(file.type || "").toLowerCase();
  if (declaredType) return declaredType;
  return EVIDENCE_MIME_BY_EXTENSION[evidenceFileExtension(file.name)] || "";
}

export function isHeicEvidenceFile(file = {}) {
  const extension = evidenceFileExtension(file.name);
  const mimeType = evidenceFileMime(file);
  return extension === "heic" || extension === "heif" || mimeType === "image/heic" || mimeType === "image/heif";
}

export function validateEvidenceFile(file = {}, maxBytes = MAX_EVIDENCE_BYTES) {
  const mimeType = evidenceFileMime(file);
  const extension = evidenceFileExtension(file.name);
  const size = Number(file.size || 0);

  if (isHeicEvidenceFile(file)) {
    return {
      valid: false,
      reason: "heic",
      mimeType,
      extension,
      message: "Please upload JPG/PNG image, not HEIC.",
    };
  }

  if (size > maxBytes) {
    return {
      valid: false,
      reason: "size",
      mimeType,
      extension,
      message: "Proof photo is over 5MB. Please upload an image under 5MB.",
    };
  }

  if (!ACCEPTED_EVIDENCE_MIME_TYPES.includes(mimeType)) {
    return {
      valid: false,
      reason: "type",
      mimeType,
      extension,
      message: "Proof photo must be JPG, JPEG, PNG, or WEBP.",
    };
  }

  return { valid: true, reason: "", mimeType, extension, message: "" };
}

export const ADMIN_EMAILS = (import.meta.env?.VITE_ADMIN_NOTIFICATION_EMAILS || "")
  .split(",")
  .map(normalizeEmail)
  .filter(Boolean);

export function tierPoints(amount) {
  if (amount >= 30000) return 12;
  if (amount >= 20000) return 9;
  if (amount >= 10000) return 6;
  if (amount >= 1000) return 3;
  if (amount >= 100) return 1;
  return 0;
}

export function calcScore(form) {
  return (
    Math.min(Number(form.one_to_one) || 0, 2) +
    (Number(form.training) || 0) * 5 +
    (Number(form.referrals) || 0) * 5 +
    tierPoints(Number(form.tyfcb) || 0) +
    (Number(form.visitors) || 0) * 10 +
    (Number(form.visitor_joined) || 0) * 25
  );
}

function isApprovedPositive(submission, valueKey, statusKey) {
  return submission?.status !== "archived"
    && submission?.[statusKey] === "approved"
    && Number(submission?.[valueKey] || 0) > 0;
}

function approvedCount(submissions, valueKey, statusKey) {
  return submissions.reduce((total, submission) => (
    total + (submission?.status !== "archived" && submission?.[statusKey] === "approved" ? Number(submission?.[valueKey] || 0) : 0)
  ), 0);
}

function memberCompletedAllFive(submissions) {
  return approvedCount(submissions, "one_to_one", "one_to_one_status") > 0
    && approvedCount(submissions, "training", "training_status") > 0
    && approvedCount(submissions, "referrals", "referral_status") > 0
    && approvedCount(submissions, "tyfcb", "tyfcb_status") > 0
    && approvedCount(submissions, "visitors", "visitor_status") > 0;
}

function campaignMonthKey(weekId) {
  return Number(weekId) <= 4 ? "month-1" : "month-2";
}

function campaignMonthLabel(monthKey) {
  return monthKey === "month-1" ? "Month 1 (Week 1-4)" : "Month 2 (Week 5-end)";
}

function awardKey(teamId, bonusType, periodKey) {
  return `${teamId}:${bonusType}:${periodKey}`;
}

export function calculateTeamBonusAwards({ teamId, memberIds = [], submissions = [], weeks = WEEKS }) {
  const activeMemberIds = memberIds.filter(Boolean);
  if (!teamId || activeMemberIds.length < 2) return [];

  const teamSubmissions = submissions.filter((submission) => (
    submission?.status !== "archived"
    && activeMemberIds.includes(submission.member_id)
  ));
  const awards = [];
  const seen = new Set();
  const pushAward = (award) => {
    const key = awardKey(teamId, award.bonus_type, award.period_key);
    if (seen.has(key)) return;
    seen.add(key);
    awards.push({ team_id: teamId, ...award });
  };

  const monthGroups = [...new Set(weeks.map((week) => campaignMonthKey(week.id)))];
  for (const monthKey of monthGroups) {
    const monthWeekIds = weeks.filter((week) => campaignMonthKey(week.id) === monthKey).map((week) => Number(week.id));
    const monthSubmissions = teamSubmissions.filter((submission) => monthWeekIds.includes(Number(submission.week_id)));
    const awardWeekId = Math.max(...monthWeekIds);
    const bothCompleted = activeMemberIds.every((memberId) => memberCompletedAllFive(monthSubmissions.filter((submission) => submission.member_id === memberId)));
    if (bothCompleted) {
      pushAward({
        bonus_type: "all_five_buddy_monthly",
        points: 3,
        week_id: awardWeekId,
        period_key: monthKey,
        reason: `Both buddy members completed all five approved sections in ${campaignMonthLabel(monthKey)}.`,
      });
    }

    const monthlyVisitors = approvedCount(monthSubmissions, "visitors", "visitor_status");
    if (monthlyVisitors >= 4) {
      pushAward({
        bonus_type: "monthly_visitor_4",
        points: 10,
        week_id: awardWeekId,
        period_key: monthKey,
        reason: `Buddy team reached 4 approved Visitors in ${campaignMonthLabel(monthKey)}.`,
      });
    } else if (monthlyVisitors >= 2) {
      pushAward({
        bonus_type: "monthly_visitor_2",
        points: 5,
        week_id: awardWeekId,
        period_key: monthKey,
        reason: `Buddy team reached 2 approved Visitors in ${campaignMonthLabel(monthKey)}.`,
      });
    }
  }

  const sortedWeeks = weeks.map((week) => Number(week.id)).sort((a, b) => a - b);
  for (const awardWeek of sortedWeeks.filter((weekId) => weekId >= 3)) {
    const windowWeeks = [awardWeek - 2, awardWeek - 1];
    const windowSubmissions = teamSubmissions.filter((submission) => windowWeeks.includes(Number(submission.week_id)));
    const rescued = activeMemberIds.some((weakMemberId) => {
      const helperMemberIds = activeMemberIds.filter((memberId) => memberId !== weakMemberId);
      const weakSubmissions = windowSubmissions.filter((submission) => submission.member_id === weakMemberId);
      const weakSubmittedBothWeeks = windowWeeks.every((weekId) => (
        weakSubmissions.some((submission) => Number(submission.week_id) === Number(weekId))
      ));
      const weakHadNoReferralOrVisitor = approvedCount(weakSubmissions, "referrals", "referral_status") === 0
        && approvedCount(weakSubmissions, "visitors", "visitor_status") === 0
        && approvedCount(weakSubmissions, "tyfcb", "tyfcb_status") === 0;
      const helperSubmissions = windowSubmissions.filter((submission) => helperMemberIds.includes(submission.member_id));
      return weakSubmittedBothWeeks
        && weakHadNoReferralOrVisitor
        && (approvedCount(helperSubmissions, "visitors", "visitor_status") > 0 || approvedCount(helperSubmissions, "referrals", "referral_status") >= 3);
    });
    if (rescued) {
      pushAward({
        bonus_type: "rescue_teammate",
        points: 5,
        week_id: awardWeek,
        period_key: `rescue:${windowWeeks[0]}-${windowWeeks[1]}:${awardWeek}`,
        reason: "One buddy had zero approved referrals, visitors, and TYFCB in the previous two weeks while the other carried visitors or referrals.",
      });
    }
  }

  return awards.sort((a, b) => (Number(a.week_id || 0) - Number(b.week_id || 0)) || a.bonus_type.localeCompare(b.bonus_type));
}

export function currentSubmissionWeeks(today = new Date()) {
  const todayTime = new Date(today.toDateString()).getTime();
  const current = WEEKS.find((week) => {
    const start = new Date(`${week.starts_on}T00:00:00`).getTime();
    const end = new Date(`${week.ends_on}T23:59:59`).getTime();
    return todayTime >= start && todayTime <= end;
  }) || WEEKS.find((week) => todayTime < new Date(`${week.starts_on}T00:00:00`).getTime()) || WEEKS[WEEKS.length - 1];
  return WEEKS.filter((week) => week.id === current.id || week.id === Math.max(1, current.id - 1)).sort((a, b) => b.id - a.id);
}

export function evidenceKindsForForm(form) {
  void form;
  return [];
}

export function activeSubmission(submissions) {
  return submissions.filter((item) => item.status !== "archived");
}

export function canSubmitWeek(submissions, weekId) {
  return !activeSubmission(submissions).some((item) => Number(item.week_id) === Number(weekId));
}

export function money(value) {
  return `RM ${Number(value || 0).toLocaleString("en-MY", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

export function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

export const DEMO_MEMBER = {
  id: "00000000-0000-4000-8000-000000000001",
  full_name: "Tianyi Demo Member",
  email: "demo.member@agaventures.ai",
  company: "AGA Ventures",
  buddy_team_id: "00000000-0000-4000-8000-000000000041",
};

export const DEMO_SUBMISSIONS = [
  {
    id: "demo-submission-week-1",
    member_id: DEMO_MEMBER.id,
    week_id: 1,
    week_label: "Week 1 (02/06 - 08/06)",
    full_name: DEMO_MEMBER.full_name,
    email: DEMO_MEMBER.email,
    team_no: 7,
    one_to_one: 2,
    training: 1,
    referrals: 3,
    tyfcb: 12000,
    visitors: 1,
    visitor_joined: 0,
    score: 41,
    one_to_one_status: "pending",
    training_status: "approved",
    referral_status: "pending",
    tyfcb_status: "pending",
    visitor_status: "approved",
    submitted_at: "2026-06-08T02:30:00.000Z",
    evidence: [
      { id: "ev-1", kind: "one_to_one", file_name: "one-to-one-proof.jpg", file_path: "demo/one-to-one-proof.jpg" },
      { id: "ev-2", kind: "referral", file_name: "referral-proof.jpg", file_path: "demo/referral-proof.jpg" },
      { id: "ev-3", kind: "tyfcb", file_name: "tyfcb-proof.jpg", file_path: "demo/tyfcb-proof.jpg" },
    ],
  },
  {
    id: "demo-submission-week-2",
    member_id: "00000000-0000-4000-8000-000000000002",
    week_id: 2,
    week_label: "Week 2 (09/06 - 15/06)",
    full_name: "Demo Buddy Partner",
    email: "demo.buddy@agaventures.ai",
    team_no: 7,
    one_to_one: 1,
    training: 2,
    referrals: 1,
    tyfcb: 3500,
    visitors: 2,
    visitor_joined: 1,
    score: 67,
    one_to_one_status: "approved",
    training_status: "pending",
    referral_status: "approved",
    tyfcb_status: "pending",
    visitor_status: "pending",
    submitted_at: "2026-06-15T02:30:00.000Z",
    evidence: [
      { id: "ev-4", kind: "training", file_name: "training-proof.jpg", file_path: "demo/training-proof.jpg" },
      { id: "ev-5", kind: "visitor", file_name: "visitor-proof.jpg", file_path: "demo/visitor-proof.jpg" },
    ],
  },
];

export const DEMO_MEMBERS = [
  { ...DEMO_MEMBER, buddy_member_id: "00000000-0000-4000-8000-000000000002", buddy: { id: "00000000-0000-4000-8000-000000000002", full_name: "Demo Buddy Partner", email: "demo.buddy@agaventures.ai" }, buddy_teams: { team_no: 7, name: "Buddy Team 7" } },
  {
    id: "00000000-0000-4000-8000-000000000002",
    full_name: "Demo Buddy Partner",
    email: "demo.buddy@agaventures.ai",
    company: "Partner Co",
    buddy_member_id: DEMO_MEMBER.id,
    buddy: { id: DEMO_MEMBER.id, full_name: DEMO_MEMBER.full_name, email: DEMO_MEMBER.email },
    buddy_team_id: "00000000-0000-4000-8000-000000000041",
    buddy_teams: { team_no: 7, name: "Buddy Team 7" },
  },
  {
    id: "00000000-0000-4000-8000-000000000003",
    full_name: "Demo Visitor Captain",
    email: "demo.visitor@agaventures.ai",
    company: "Visitor Studio",
    buddy_team_id: "00000000-0000-4000-8000-000000000008",
    buddy_teams: { team_no: 8, name: "Buddy Team 8" },
  },
];

export const DEMO_TEAMS = Array.from({ length: 10 }, (_, index) => ({
  id: `demo-team-${index + 1}`,
  team_no: index + 1,
  name: `Buddy Team ${index + 1}`,
}));

export const DEMO_BOARD = [
  { team_id: "demo-team-7", team_no: 7, team_name: "Buddy Team 7", members: ["Tianyi Demo Member", "Demo Buddy Partner"], total_score: 126, member_score: 108, team_bonus_points: 18, total_tyfcb: 15500, submission_count: 2, rank: 1 },
  { team_id: "demo-team-8", team_no: 8, team_name: "Buddy Team 8", members: ["Demo Visitor Captain"], total_score: 77, member_score: 72, team_bonus_points: 5, total_tyfcb: 8200, submission_count: 1, rank: 2 },
  { team_id: "demo-team-3", team_no: 3, team_name: "Buddy Team 3", members: ["Demo Training Lead"], total_score: 49, member_score: 49, team_bonus_points: 0, total_tyfcb: 1100, submission_count: 1, rank: 3 },
];
