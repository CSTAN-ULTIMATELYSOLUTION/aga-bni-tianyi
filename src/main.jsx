import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Link, Navigate, Route, Routes, useNavigate, useParams } from "react-router-dom";
import {
  Award,
  BarChart3,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Eye,
  FileImage,
  Handshake,
  Loader2,
  LogOut,
  Mail,
  Medal,
  Plus,
  Search,
  ShieldCheck,
  Upload,
  UserRound,
  UsersRound,
  XCircle,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { supabase } from "./lib/supabase";
import {
  FIELD_META,
  WEEKS,
  calcScore,
  currentSubmissionWeeks,
  evidenceKindsForForm,
  money,
  normalizeEmail,
  tierPoints,
} from "./lib/game";
import "./styles.css";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<PublicPortal />} />
        <Route path="/submission/:id" element={<SubmissionReceipt />} />
        <Route path="/admin" element={<AdminPortal />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

function Shell({ children, wide = false }) {
  return (
    <main className={wide ? "shell shell-wide" : "shell"}>
      {children}
      <FooterBanner />
    </main>
  );
}

function FooterBanner() {
  return (
    <footer className="footer-banner">
      <span>Supported by AGA VENTURES SDN BHD</span>
      <a href="https://agaventures.ai" target="_blank" rel="noreferrer">
        agaventures.ai
      </a>
    </footer>
  );
}

function PublicPortal() {
  const [session, setSession] = useState(null);
  const [member, setMember] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      if (data.session) await linkAndLoadMember(setMember);
      setLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      setSession(nextSession);
      if (nextSession) await linkAndLoadMember(setMember);
      else setMember(null);
    });
    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  if (loading) return <LoadingScreen />;

  return (
    <Shell>
      <HeroHeader />
      {!session || !member ? <MemberOtpLogin /> : <WeeklyDesk member={member} />}
    </Shell>
  );
}

async function linkAndLoadMember(setMember) {
  const { data, error } = await supabase.rpc("tianyi_link_current_user");
  if (error) {
    setMember(null);
    return;
  }
  setMember(data);
}

function LoadingScreen() {
  return (
    <Shell>
      <section className="loading-card">
        <Loader2 className="spin" />
        <p>Loading Tianyi Game 天一游戏载入中</p>
      </section>
    </Shell>
  );
}

function HeroHeader() {
  return (
    <header className="hero">
      <div className="brand-row">
        <div className="brand-mark">天</div>
        <div>
          <p>BNI Klang Region</p>
          <h1>Tianyi Game 天一游戏</h1>
        </div>
      </div>
      <div className="hero-copy">
        <p>Weekly accountability portal 每周活动提交系统</p>
        <span>01 Jun 2026 - 31 Jul 2026</span>
      </div>
    </header>
  );
}

function MemberOtpLogin() {
  const [phase, setPhase] = useState("search");
  const [form, setForm] = useState({ name: "", email: "", otp: "" });
  const [found, setFound] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function findMember(event) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const { data, error } = await supabase.rpc("tianyi_find_member", {
      p_email: normalizeEmail(form.email),
      p_name: form.name.trim(),
    });
    const match = data?.[0];
    if (error || !match) {
      setMessage("Member not found. Please check name and email. 找不到会员，请确认姓名和电邮。");
      setBusy(false);
      return;
    }
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email: normalizeEmail(form.email),
      options: {
        shouldCreateUser: true,
      },
    });
    if (otpError) setMessage(otpError.message);
    else {
      setFound(match);
      setPhase("otp");
      setMessage("OTP sent to your email. 验证码已发送到你的电邮。");
    }
    setBusy(false);
  }

  async function verifyOtp(event) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const { error } = await supabase.auth.verifyOtp({
      email: normalizeEmail(form.email),
      token: form.otp.trim(),
      type: "email",
    });
    if (error) setMessage(error.message);
    setBusy(false);
  }

  return (
    <section className="panel login-panel">
      <div className="section-heading">
        <Search />
        <div>
          <h2>Find your member record 查找会员资料</h2>
          <p>Enter your registered name and email to receive OTP.</p>
        </div>
      </div>

      {phase === "search" ? (
        <form onSubmit={findMember} className="stack">
          <Label text="Full name 姓名">
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </Label>
          <Label text="Email 电邮">
            <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
          </Label>
          <Button disabled={busy}>
            {busy ? <Loader2 className="spin" /> : <Mail />}
            Send OTP 发送验证码
          </Button>
        </form>
      ) : (
        <form onSubmit={verifyOtp} className="stack">
          <div className="member-found">
            <CheckCircle2 />
            <div>
              <strong>{found.full_name}</strong>
              <span>{found.email}</span>
            </div>
          </div>
          <Label text="Email OTP 电邮验证码">
            <input inputMode="numeric" value={form.otp} onChange={(e) => setForm({ ...form, otp: e.target.value })} required />
          </Label>
          <Button disabled={busy}>
            {busy ? <Loader2 className="spin" /> : <ShieldCheck />}
            Verify and enter 验证并登入
          </Button>
          <button className="ghost-button" type="button" onClick={() => setPhase("search")}>
            Search again 重新查找
          </button>
        </form>
      )}
      {message && <p className="notice">{message}</p>}
    </section>
  );
}

function WeeklyDesk({ member }) {
  const [weeks, setWeeks] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [selectedWeek, setSelectedWeek] = useState(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const available = currentSubmissionWeeks();
    const [{ data: dbWeeks }, { data: subs }] = await Promise.all([
      supabase.from("tianyi_weeks").select("*").in("id", available.map((week) => week.id)).order("id", { ascending: false }),
      supabase.from("tianyi_submission_details").select("*").eq("member_id", member.id).order("submitted_at", { ascending: false }),
    ]);
    setWeeks(dbWeeks?.length ? dbWeeks : available);
    setSubmissions(subs || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [member.id]);

  if (loading) return <LoadingScreen />;
  const submittedWeekIds = new Set(submissions.map((item) => item.week_id));

  return (
    <section className="stack">
      <div className="member-card">
        <div>
          <p>Welcome 欢迎</p>
          <h2>{member.full_name}</h2>
          <span>{member.email}</span>
        </div>
        <button className="icon-button" onClick={() => supabase.auth.signOut()} aria-label="Sign out">
          <LogOut />
        </button>
      </div>

      {!selectedWeek ? (
        <>
          <div className="section-heading">
            <ClipboardCheck />
            <div>
              <h2>Weekly report 每周报告</h2>
              <p>Submit current week or last missed week only.</p>
            </div>
          </div>
          <div className="week-grid">
            {weeks.map((week) => {
              const submitted = submittedWeekIds.has(week.id);
              return (
                <button key={week.id} className="week-card" disabled={submitted} onClick={() => setSelectedWeek(week)}>
                  <div>
                    <strong>{week.label}</strong>
                    <span>{submitted ? "Submitted 已提交" : "Open for submission 可提交"}</span>
                  </div>
                  {submitted ? <CheckCircle2 /> : <ChevronRight />}
                </button>
              );
            })}
          </div>
          <SubmissionHistory submissions={submissions} />
        </>
      ) : (
        <WeeklyForm member={member} week={selectedWeek} onCancel={() => setSelectedWeek(null)} onSubmitted={load} />
      )}
    </section>
  );
}

function WeeklyForm({ member, week, onCancel, onSubmitted }) {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    one_to_one: 0,
    training: 0,
    referrals: 0,
    tyfcb: "",
    visitors: 0,
    visitor_joined: 0,
    attended: false,
  });
  const [files, setFiles] = useState({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const score = calcScore(form);
  const neededEvidence = evidenceKindsForForm(form);

  async function submit(event) {
    event.preventDefault();
    setError("");
    for (const kind of neededEvidence) {
      if (!files[kind]?.length) {
        setError(`${FIELD_META[kind].label} proof photo is required. 需要上传证明照片。`);
        return;
      }
    }
    setBusy(true);
    const payload = {
      member_id: member.id,
      week_id: week.id,
      one_to_one: Number(form.one_to_one) || 0,
      training: Number(form.training) || 0,
      referrals: Number(form.referrals) || 0,
      tyfcb: Number(form.tyfcb) || 0,
      visitors: Number(form.visitors) || 0,
      visitor_joined: Number(form.visitor_joined) || 0,
      attended: form.attended,
    };
    const { data: submission, error: insertError } = await supabase
      .from("tianyi_submissions")
      .insert(payload)
      .select()
      .single();

    if (insertError) {
      setError(insertError.code === "23505" ? "This week was already submitted. 本周已经提交。" : insertError.message);
      setBusy(false);
      return;
    }

    const evidenceRows = [];
    for (const kind of neededEvidence) {
      for (const file of Array.from(files[kind] || [])) {
        const safeName = file.name.replace(/[^a-z0-9._-]/gi, "-").toLowerCase();
        const path = `${member.id}/${submission.id}/${kind}-${Date.now()}-${safeName}`;
        const { error: uploadError } = await supabase.storage.from("tianyi-evidence").upload(path, file);
        if (uploadError) {
          setError(uploadError.message);
          setBusy(false);
          return;
        }
        evidenceRows.push({ submission_id: submission.id, kind, file_path: path, file_name: file.name });
      }
    }
    if (evidenceRows.length) await supabase.from("tianyi_evidence").insert(evidenceRows);

    await fetch("/api/submission-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: member.email,
        name: member.full_name,
        submissionId: submission.id,
        week: week.label,
        score: submission.score,
        origin: window.location.origin,
      }),
    }).catch(() => {});

    setBusy(false);
    await onSubmitted();
    navigate(`/submission/${submission.id}`);
  }

  return (
    <form className="panel report-form" onSubmit={submit}>
      <div className="form-top">
        <div>
          <span>{week.label}</span>
          <h2>Submit activity 提交活动</h2>
        </div>
        <div className="score-badge">
          <strong>{score}</strong>
          <span>pts 分</span>
        </div>
      </div>

      <ActivityStepper icon={<Handshake />} title="1-2-1" sub="1 pt each, max 2 每次1分" value={form.one_to_one} max={2} onChange={(value) => setForm({ ...form, one_to_one: value })} />
      <ActivityStepper title="Training 培训" sub="5 pts each 每次5分" value={form.training} max={3} onChange={(value) => setForm({ ...form, training: value })} />
      <ActivityStepper title="Referral 引荐" sub="5 pts each 每个5分" value={form.referrals} max={50} onChange={(value) => setForm({ ...form, referrals: value })} />
      <Label text="TYFCB 引荐成交额 RM">
        <input type="number" min="0" value={form.tyfcb} onChange={(e) => setForm({ ...form, tyfcb: e.target.value })} placeholder="5000" />
      </Label>
      <div className="tier-row">
        {[100, 1000, 10000, 20000, 30000].map((amount) => (
          <span key={amount} className={Number(form.tyfcb) >= amount ? "active" : ""}>
            RM{amount >= 1000 ? `${amount / 1000}k` : amount}
          </span>
        ))}
        <strong>{tierPoints(Number(form.tyfcb) || 0)} pts</strong>
      </div>
      <ActivityStepper title="Visitor 访客" sub="10 pts each 每位10分" value={form.visitors} max={50} onChange={(value) => setForm({ ...form, visitors: value })} />
      <ActivityStepper title="Visitor joined 访客加入" sub="25 pts each 每位25分" value={form.visitor_joined} max={20} onChange={(value) => setForm({ ...form, visitor_joined: value })} />
      <label className="toggle-row">
        <input type="checkbox" checked={form.attended} onChange={(e) => setForm({ ...form, attended: e.target.checked })} />
        <span>Attendance marked 出席已确认</span>
      </label>

      {neededEvidence.length > 0 && (
        <div className="proof-box">
          <h3>Proof photos 证明照片</h3>
          {neededEvidence.map((kind) => (
            <Label key={kind} text={`${FIELD_META[kind].label} ${FIELD_META[kind].zh}`}>
              <input type="file" accept="image/*" multiple onChange={(e) => setFiles({ ...files, [kind]: e.target.files })} />
            </Label>
          ))}
        </div>
      )}

      {error && <p className="error">{error}</p>}
      <div className="button-row">
        <button className="ghost-button" type="button" onClick={onCancel}>
          Back 返回
        </button>
        <Button disabled={busy}>
          {busy ? <Loader2 className="spin" /> : <Upload />}
          Submit 提交
        </Button>
      </div>
    </form>
  );
}

function ActivityStepper({ title, sub, value, max, onChange, icon }) {
  return (
    <div className="activity-row">
      <div>
        <strong>{icon}{title}</strong>
        <span>{sub}</span>
      </div>
      <div className="stepper">
        <button type="button" onClick={() => onChange(Math.max(0, Number(value) - 1))}>-</button>
        <b>{value}</b>
        <button type="button" onClick={() => onChange(Math.min(max, Number(value) + 1))}>+</button>
      </div>
    </div>
  );
}

function SubmissionHistory({ submissions }) {
  return (
    <section className="panel compact">
      <div className="section-heading small">
        <Award />
        <div>
          <h2>Your submissions 你的提交</h2>
          <p>{submissions.length} records 记录</p>
        </div>
      </div>
      <div className="history-list">
        {submissions.length === 0 && <p className="muted">No submissions yet. 暂无提交。</p>}
        {submissions.map((item) => (
          <Link to={`/submission/${item.id}`} className="history-row" key={item.id}>
            <div>
              <strong>{item.week_label}</strong>
              <span>{new Date(item.submitted_at).toLocaleString()}</span>
            </div>
            <b>{item.score} pts</b>
          </Link>
        ))}
      </div>
    </section>
  );
}

function SubmissionReceipt() {
  const { id } = useParams();
  const [submission, setSubmission] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("tianyi_submission_details")
      .select("*")
      .eq("id", id)
      .single()
      .then(({ data }) => {
        setSubmission(data);
        setLoading(false);
      });
  }, [id]);

  if (loading) return <LoadingScreen />;

  return (
    <Shell>
      <HeroHeader />
      {!submission ? (
        <section className="panel">
          <h2>Submission not available 无法查看提交</h2>
          <p className="muted">Please open this link after logging in with the same member email.</p>
        </section>
      ) : (
        <section className="panel receipt">
          <CheckCircle2 className="receipt-icon" />
          <p>Read-only submission 已锁定提交</p>
          <h2>{submission.week_label}</h2>
          <div className="score-badge large">
            <strong>{submission.score}</strong>
            <span>pts 分</span>
          </div>
          <dl>
            <div><dt>Member 会员</dt><dd>{submission.full_name}</dd></div>
            <div><dt>Buddy team 伙伴组</dt><dd>{submission.team_no || "-"}</dd></div>
            <div><dt>1-2-1</dt><dd>{submission.one_to_one}</dd></div>
            <div><dt>Training 培训</dt><dd>{submission.training}</dd></div>
            <div><dt>Referral 引荐</dt><dd>{submission.referrals}</dd></div>
            <div><dt>TYFCB</dt><dd>{money(submission.tyfcb)}</dd></div>
            <div><dt>Visitor 访客</dt><dd>{submission.visitors}</dd></div>
            <div><dt>Attendance 出席</dt><dd>{submission.attended ? "Yes 是" : "No 否"}</dd></div>
          </dl>
        </section>
      )}
    </Shell>
  );
}

function AdminPortal() {
  const [session, setSession] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [checking, setChecking] = useState(true);

  async function checkAdmin() {
    const { data: sessionData } = await supabase.auth.getSession();
    setSession(sessionData.session);
    if (!sessionData.session) {
      setIsAdmin(false);
      setChecking(false);
      return;
    }
    const { data } = await supabase.from("tianyi_admin_users").select("email").maybeSingle();
    setIsAdmin(Boolean(data));
    setChecking(false);
  }

  useEffect(() => {
    checkAdmin();
    const { data } = supabase.auth.onAuthStateChange(checkAdmin);
    return () => data.subscription.unsubscribe();
  }, []);

  if (checking) return <LoadingScreen />;

  return (
    <Shell wide>
      <header className="admin-header">
        <Link to="/" className="brand-row admin-brand">
          <div className="brand-mark">天</div>
          <div>
            <p>Admin portal 管理后台</p>
            <h1>Tianyi Game</h1>
          </div>
        </Link>
        {session && (
          <button className="ghost-button" onClick={() => supabase.auth.signOut()}>
            <LogOut /> Logout 登出
          </button>
        )}
      </header>
      {!session || !isAdmin ? <AdminLogin isDenied={Boolean(session && !isAdmin)} /> : <AdminWorkspace />}
    </Shell>
  );
}

function AdminLogin({ isDenied }) {
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [phase, setPhase] = useState("email");
  const [message, setMessage] = useState(isDenied ? "This email is not an admin. 此电邮不是管理员。" : "");
  const [busy, setBusy] = useState(false);

  async function send(event) {
    event.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithOtp({ email: normalizeEmail(email), options: { shouldCreateUser: true } });
    setBusy(false);
    if (error) setMessage(error.message);
    else {
      setPhase("otp");
      setMessage("OTP sent. 验证码已发送。");
    }
  }

  async function verify(event) {
    event.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.verifyOtp({ email: normalizeEmail(email), token: otp.trim(), type: "email" });
    setBusy(false);
    if (error) setMessage(error.message);
  }

  return (
    <section className="panel login-panel">
      <div className="section-heading">
        <ShieldCheck />
        <div>
          <h2>Admin sign in 管理员登入</h2>
          <p>Use an email seeded in `tianyi_admin_users`.</p>
        </div>
      </div>
      <form onSubmit={phase === "email" ? send : verify} className="stack">
        <Label text="Admin email 管理员电邮">
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={phase === "otp"} required />
        </Label>
        {phase === "otp" && (
          <Label text="OTP 验证码">
            <input value={otp} onChange={(e) => setOtp(e.target.value)} required />
          </Label>
        )}
        <Button disabled={busy}>{busy ? <Loader2 className="spin" /> : <Mail />} {phase === "email" ? "Send OTP 发送验证码" : "Verify 验证"}</Button>
      </form>
      {message && <p className="notice">{message}</p>}
    </section>
  );
}

function AdminWorkspace() {
  const [tab, setTab] = useState("dashboard");
  const [refreshKey, setRefreshKey] = useState(0);
  const tabs = [
    ["dashboard", "Dashboard 仪表板", BarChart3],
    ["members", "Member 会员", UsersRound],
    ["submissions", "5 Game Input 五项输入", ClipboardCheck],
    ["one_to_one", "1-2-1 Verify", Handshake],
    ["training", "Training 培训", Award],
    ["referral", "Referral 引荐", Medal],
    ["tyfcb", "TYFCB", FileImage],
    ["visitor", "Visitor 访客", UserRound],
    ["attendance", "Attendance 出席", CheckCircle2],
  ];

  return (
    <section className="admin-layout">
      <nav className="admin-tabs">
        {tabs.map(([id, label, Icon]) => (
          <button key={id} className={tab === id ? "active" : ""} onClick={() => setTab(id)}>
            <Icon /> {label}
          </button>
        ))}
      </nav>
      {tab === "dashboard" && <Dashboard refreshKey={refreshKey} />}
      {tab === "members" && <MemberManager onChanged={() => setRefreshKey((v) => v + 1)} />}
      {tab === "submissions" && <SubmissionReview />}
      {["one_to_one", "training", "referral", "tyfcb", "visitor"].includes(tab) && <VerificationQueue kind={tab} />}
      {tab === "attendance" && <AttendanceList />}
    </section>
  );
}

function Dashboard({ refreshKey }) {
  const [board, setBoard] = useState([]);
  const [stats, setStats] = useState({ members: 0, submissions: 0, tyfcb: 0 });

  useEffect(() => {
    Promise.all([
      supabase.rpc("tianyi_team_leaderboard"),
      supabase.from("tianyi_members").select("id", { count: "exact", head: true }),
      supabase.from("tianyi_submissions").select("id,tyfcb", { count: "exact" }),
    ]).then(([leaderboard, members, submissions]) => {
      setBoard(leaderboard.data || []);
      setStats({
        members: members.count || 0,
        submissions: submissions.count || 0,
        tyfcb: (submissions.data || []).reduce((sum, item) => sum + Number(item.tyfcb || 0), 0),
      });
    });
  }, [refreshKey]);

  return (
    <div className="admin-content">
      <div className="metric-grid">
        <Metric label="Members 会员" value={stats.members} />
        <Metric label="Submissions 提交" value={stats.submissions} />
        <Metric label="TYFCB" value={money(stats.tyfcb)} />
        <Metric label="Teams 伙伴组" value={board.length} />
      </div>
      <section className="panel">
        <div className="section-heading">
          <BarChart3 />
          <div><h2>Buddy ranking 伙伴组排行</h2><p>Ranked by combined team score.</p></div>
        </div>
        <div className="chart-box">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={board.slice(0, 10)}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.08)" />
              <XAxis dataKey="team_no" stroke="#9fb0ce" />
              <YAxis stroke="#9fb0ce" />
              <Tooltip contentStyle={{ background: "#101d3d", border: "1px solid rgba(255,255,255,.12)", color: "#fff" }} />
              <Bar dataKey="total_score" fill="#f5c542" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="leaderboard">
          {board.map((team) => (
            <div className="leader-row" key={team.team_id}>
              <b>#{team.rank}</b>
              <div><strong>Buddy {team.team_no}</strong><span>{team.members?.join(" & ") || "No members"}</span></div>
              <em>{team.total_score} pts</em>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function Metric({ label, value }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function MemberManager({ onChanged }) {
  const [members, setMembers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [newMember, setNewMember] = useState({ full_name: "", email: "", company: "", buddy_team_id: "" });

  async function load() {
    const [{ data: memberData }, { data: teamData }] = await Promise.all([
      supabase.from("tianyi_members").select("*, tianyi_buddy_teams(team_no,name)").order("full_name"),
      supabase.from("tianyi_buddy_teams").select("*").order("team_no"),
    ]);
    setMembers(memberData || []);
    setTeams(teamData || []);
  }

  useEffect(() => { load(); }, []);

  async function addMember(event) {
    event.preventDefault();
    await supabase.from("tianyi_members").insert({ ...newMember, email: normalizeEmail(newMember.email), buddy_team_id: newMember.buddy_team_id || null });
    setNewMember({ full_name: "", email: "", company: "", buddy_team_id: "" });
    await load();
    onChanged();
  }

  async function updateBuddy(memberId, buddyTeamId) {
    await supabase.from("tianyi_members").update({ buddy_team_id: buddyTeamId || null }).eq("id", memberId);
    await load();
    onChanged();
  }

  return (
    <div className="admin-content">
      <section className="panel">
        <div className="section-heading"><UsersRound /><div><h2>Member list 会员名单</h2><p>Add members and assign buddy teams.</p></div></div>
        <form className="member-form" onSubmit={addMember}>
          <input placeholder="Full name 姓名" value={newMember.full_name} onChange={(e) => setNewMember({ ...newMember, full_name: e.target.value })} required />
          <input placeholder="Email 电邮" type="email" value={newMember.email} onChange={(e) => setNewMember({ ...newMember, email: e.target.value })} required />
          <input placeholder="Company 公司" value={newMember.company} onChange={(e) => setNewMember({ ...newMember, company: e.target.value })} />
          <select value={newMember.buddy_team_id} onChange={(e) => setNewMember({ ...newMember, buddy_team_id: e.target.value })}>
            <option value="">No buddy team</option>
            {teams.map((team) => <option key={team.id} value={team.id}>Buddy {team.team_no}</option>)}
          </select>
          <Button><Plus /> Add 新增</Button>
        </form>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Name</th><th>Email</th><th>Company</th><th>Buddy</th></tr></thead>
            <tbody>
              {members.map((member) => (
                <tr key={member.id}>
                  <td>{member.full_name}</td>
                  <td>{member.email}</td>
                  <td>{member.company || "-"}</td>
                  <td>
                    <select value={member.buddy_team_id || ""} onChange={(e) => updateBuddy(member.id, e.target.value)}>
                      <option value="">None</option>
                      {teams.map((team) => <option key={team.id} value={team.id}>Buddy {team.team_no}</option>)}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function SubmissionReview() {
  const [items, setItems] = useState([]);
  useEffect(() => {
    supabase.from("tianyi_submission_details").select("*").order("submitted_at", { ascending: false }).then(({ data }) => setItems(data || []));
  }, []);
  return (
    <div className="admin-content">
      <section className="panel">
        <div className="section-heading"><ClipboardCheck /><div><h2>All submissions 所有提交</h2><p>Full weekly game input list.</p></div></div>
        <SubmissionTable items={items} />
      </section>
    </div>
  );
}

function VerificationQueue({ kind }) {
  const [items, setItems] = useState([]);
  const statusField = `${kind}_status`;

  async function load() {
    const { data } = await supabase
      .from("tianyi_submission_details")
      .select("*, tianyi_evidence(*)")
      .gt(kind === "tyfcb" ? "tyfcb" : kind === "one_to_one" ? "one_to_one" : kind === "referral" ? "referrals" : kind === "visitor" ? "visitors" : "training", 0)
      .order("submitted_at", { ascending: false });
    setItems(data || []);
  }

  useEffect(() => { load(); }, [kind]);

  async function setStatus(id, value) {
    await supabase.from("tianyi_submissions").update({ [statusField]: value }).eq("id", id);
    await load();
  }

  return (
    <div className="admin-content">
      <section className="panel">
        <div className="section-heading"><Eye /><div><h2>{FIELD_META[kind]?.label || kind} verification 审核</h2><p>Approve or reject proof photos.</p></div></div>
        <div className="review-list">
          {items.map((item) => (
            <ReviewCard key={item.id} item={item} kind={kind} statusField={statusField} onStatus={setStatus} />
          ))}
        </div>
      </section>
    </div>
  );
}

function ReviewCard({ item, kind, statusField, onStatus }) {
  const evidence = (item.tianyi_evidence || []).filter((row) => row.kind === kind);
  return (
    <article className="review-card">
      <div>
        <strong>{item.full_name}</strong>
        <span>{item.week_label} · Buddy {item.team_no || "-"}</span>
        <small>Status: {item[statusField]}</small>
      </div>
      <div className="proof-links">
        {evidence.map((file) => <EvidenceLink file={file} key={file.id} />)}
        {evidence.length === 0 && <span>No proof photo</span>}
      </div>
      <div className="verify-actions">
        <button onClick={() => onStatus(item.id, "approved")}><CheckCircle2 /> Approve</button>
        <button onClick={() => onStatus(item.id, "rejected")}><XCircle /> Reject</button>
      </div>
    </article>
  );
}

function EvidenceLink({ file }) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    supabase.storage.from("tianyi-evidence").createSignedUrl(file.file_path, 3600).then(({ data }) => setUrl(data?.signedUrl || ""));
  }, [file.file_path]);
  return url ? <a href={url} target="_blank" rel="noreferrer"><FileImage /> {file.file_name || "Open proof"}</a> : <span>Loading proof...</span>;
}

function AttendanceList() {
  const [items, setItems] = useState([]);
  useEffect(() => {
    supabase.from("tianyi_submission_details").select("*").eq("attended", true).order("week_id").then(({ data }) => setItems(data || []));
  }, []);
  return (
    <div className="admin-content">
      <section className="panel">
        <div className="section-heading"><CheckCircle2 /><div><h2>Attendance list 出席名单</h2><p>Weekly meeting attendance submitted by members.</p></div></div>
        <SubmissionTable items={items} />
      </section>
    </div>
  );
}

function SubmissionTable({ items }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr><th>Member</th><th>Week</th><th>Buddy</th><th>1-2-1</th><th>Training</th><th>Referral</th><th>TYFCB</th><th>Visitor</th><th>Score</th></tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td>{item.full_name}</td>
              <td>{item.week_label}</td>
              <td>{item.team_no || "-"}</td>
              <td>{item.one_to_one}</td>
              <td>{item.training}</td>
              <td>{item.referrals}</td>
              <td>{money(item.tyfcb)}</td>
              <td>{item.visitors}</td>
              <td>{item.score}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Label({ text, children }) {
  return (
    <label className="label">
      <span>{text}</span>
      {children}
    </label>
  );
}

function Button({ children, disabled }) {
  return <button className="primary-button" disabled={disabled}>{children}</button>;
}

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
