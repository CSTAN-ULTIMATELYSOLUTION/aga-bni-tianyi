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

export function tierPoints(amount) {
  if (amount >= 30000) return 12;
  if (amount >= 20000) return 9;
  if (amount >= 10000) return 6;
  if (amount >= 1000) return 3;
  if (amount >= 100) return 1;
  return 0;
}

export function calcScore(form) {
  const fullAttendance = Boolean(form.attended && Number(form.one_to_one) > 0 && Number(form.training) > 0 && Number(form.referrals) > 0 && Number(form.tyfcb) > 0 && Number(form.visitors) > 0);
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
  const kinds = [];
  if (Number(form.one_to_one) > 0) kinds.push("one_to_one");
  if (Number(form.training) > 0) kinds.push("training");
  if (Number(form.referrals) > 0) kinds.push("referral");
  if (Number(form.tyfcb) > 0) kinds.push("tyfcb");
  if (Number(form.visitors) > 0 || Number(form.visitor_joined) > 0) kinds.push("visitor");
  return kinds;
}

export function money(value) {
  return `RM ${Number(value || 0).toLocaleString("en-MY", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

export function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}
