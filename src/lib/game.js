export const WEEKS = [
  { id: 1, label: "Week 1 (01/06 - 07/06)", starts_on: "2026-06-01", ends_on: "2026-06-07", month: "June" },
  { id: 2, label: "Week 2 (08/06 - 14/06)", starts_on: "2026-06-08", ends_on: "2026-06-14", month: "June" },
  { id: 3, label: "Week 3 (15/06 - 21/06)", starts_on: "2026-06-15", ends_on: "2026-06-21", month: "June" },
  { id: 4, label: "Week 4 (22/06 - 28/06)", starts_on: "2026-06-22", ends_on: "2026-06-28", month: "June" },
  { id: 5, label: "Week 5 (29/06 - 05/07)", starts_on: "2026-06-29", ends_on: "2026-07-05", month: "July" },
  { id: 6, label: "Week 6 (06/07 - 12/07)", starts_on: "2026-07-06", ends_on: "2026-07-12", month: "July" },
  { id: 7, label: "Week 7 (13/07 - 19/07)", starts_on: "2026-07-13", ends_on: "2026-07-19", month: "July" },
  { id: 8, label: "Week 8 (20/07 - 26/07)", starts_on: "2026-07-20", ends_on: "2026-07-26", month: "July" },
  { id: 9, label: "Week 9 (27/07 - 31/07)", starts_on: "2026-07-27", ends_on: "2026-07-31", month: "July" },
];

export const FIELD_META = {
  one_to_one: { label: "1-2-1", zh: "一对一" },
  training: { label: "Training", zh: "培训" },
  referral: { label: "Referral", zh: "引荐" },
  tyfcb: { label: "TYFCB", zh: "引荐成交额" },
  visitor: { label: "Visitor", zh: "访客" },
};

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
  const fullAttendance = Boolean(form.admin_attended && Number(form.one_to_one) > 0 && Number(form.training) > 0 && Number(form.referrals) > 0 && Number(form.tyfcb) > 0 && Number(form.visitors) > 0);
  return (
    Math.min(Number(form.one_to_one) || 0, 2) +
    (Number(form.training) || 0) * 5 +
    (Number(form.referrals) || 0) * 5 +
    tierPoints(Number(form.tyfcb) || 0) +
    (Number(form.visitors) || 0) * 10 +
    (Number(form.visitor_joined) || 0) * 25 +
    (fullAttendance ? 3 : 0)
  );
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
    week_label: "Week 1 (01/06 - 07/06)",
    full_name: DEMO_MEMBER.full_name,
    email: DEMO_MEMBER.email,
    team_no: 7,
    one_to_one: 2,
    training: 1,
    referrals: 3,
    tyfcb: 12000,
    visitors: 1,
    visitor_joined: 0,
    attended: true,
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
    week_label: "Week 2 (08/06 - 14/06)",
    full_name: "Demo Buddy Partner",
    email: "demo.buddy@agaventures.ai",
    team_no: 7,
    one_to_one: 1,
    training: 2,
    referrals: 1,
    tyfcb: 3500,
    visitors: 2,
    visitor_joined: 1,
    attended: true,
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
  { team_id: "demo-team-7", team_no: 7, team_name: "Buddy Team 7", members: ["Tianyi Demo Member", "Demo Buddy Partner"], total_score: 108, total_tyfcb: 15500, submission_count: 2, rank: 1 },
  { team_id: "demo-team-8", team_no: 8, team_name: "Buddy Team 8", members: ["Demo Visitor Captain"], total_score: 72, total_tyfcb: 8200, submission_count: 1, rank: 2 },
  { team_id: "demo-team-3", team_no: 3, team_name: "Buddy Team 3", members: ["Demo Training Lead"], total_score: 49, total_tyfcb: 1100, submission_count: 1, rank: 3 },
];
