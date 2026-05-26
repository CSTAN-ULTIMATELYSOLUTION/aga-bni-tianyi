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
  Menu,
  Medal,
  Plus,
  Search,
  ShieldCheck,
  Upload,
  UserRound,
  UsersRound,
  X,
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
  DEMO_BOARD,
  DEMO_MEMBER,
  DEMO_MEMBERS,
  DEMO_SUBMISSIONS,
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

const isLocalPreview = () => ["localhost", "127.0.0.1"].includes(window.location.hostname);

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
      <FeatureBanner />
      <FooterBanner />
    </main>
  );
}

function FeatureBanner() {
  const items = [
    "AI websites AI 网站",
    "Automation workflows 自动化流程",
    "CRM dashboards 客户管理仪表板",
    "Lead capture systems 询盘系统",
    "Custom business portals 企业专属系统",
  ];
  return (
    <section className="feature-banner" aria-label="AGA Ventures services">
      <div className="feature-track">
        {[...items, ...items].map((item, index) => (
          <span key={`${item}-${index}`}>{item}</span>
        ))}
      </div>
    </section>
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
  const [demoMember, setDemoMember] = useState(() => isLocalPreview() && sessionStorage.getItem("tianyi-demo-member") === "1");
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

  if (demoMember) {
    return (
      <Shell>
        <HeroHeader />
        <WeeklyDesk member={DEMO_MEMBER} demo />
      </Shell>
    );
  }

  return (
    <Shell>
      <HeroHeader />
      {!session || !member ? (
        <MemberOtpLogin onDemo={() => {
          sessionStorage.setItem("tianyi-demo-member", "1");
          setDemoMember(true);
        }} />
      ) : (
        <WeeklyDesk member={member} />
      )}
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

function MemberOtpLogin({ onDemo }) {
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
          {isLocalPreview() && (
            <button className="ghost-button" type="button" onClick={onDemo}>
              <Eye /> Preview as member 会员预览
            </button>
          )}
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

function WeeklyDesk({ member, demo = false }) {
  const [weeks, setWeeks] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [selectedWeek, setSelectedWeek] = useState(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    if (demo) {
      setWeeks(currentSubmissionWeeks());
      setSubmissions(DEMO_SUBMISSIONS.filter((item) => item.member_id === member.id));
      setLoading(false);
      return;
    }
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
  }, [member.id, demo]);

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
        <button className="icon-button" onClick={() => {
          if (demo) {
            sessionStorage.removeItem("tianyi-demo-member");
            window.location.reload();
            return;
          }
          supabase.auth.signOut();
        }} aria-label="Sign out">
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
                <button key={week.id} className="week-card" disabled={submitted && !demo} onClick={() => setSelectedWeek(week)}>
                  <div>
                    <strong>{week.label}</strong>
                    <span>{submitted && !demo ? "Submitted 已提交" : "Open for preview 可预览"}</span>
                  </div>
                  {submitted ? <CheckCircle2 /> : <ChevronRight />}
                </button>
              );
            })}
          </div>
          <SubmissionHistory submissions={submissions} />
        </>
      ) : (
        <WeeklyForm member={member} week={selectedWeek} onCancel={() => setSelectedWeek(null)} onSubmitted={load} demo={demo} />
      )}
    </section>
  );
}

function WeeklyForm({ member, week, onCancel, onSubmitted, demo = false }) {
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
    if (demo) {
      setError("Preview mode only. Real submission requires OTP login. 预览模式不会提交。");
      return;
    }
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
    if (id?.startsWith("demo-")) {
      setSubmission(DEMO_SUBMISSIONS.find((item) => item.id === id));
      setLoading(false);
      return;
    }
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
  const [demoAdmin, setDemoAdmin] = useState(() => isLocalPreview() && sessionStorage.getItem("tianyi-demo-admin") === "1");
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
        {(session || demoAdmin) && (
          <button className="ghost-button" onClick={() => {
            if (demoAdmin) {
              sessionStorage.removeItem("tianyi-demo-admin");
              window.location.reload();
              return;
            }
            supabase.auth.signOut();
          }}>
            <LogOut /> Logout 登出
          </button>
        )}
      </header>
      {demoAdmin ? (
        <AdminWorkspace demo />
      ) : !session || !isAdmin ? (
        <AdminLogin isDenied={Boolean(session && !isAdmin)} onDemo={() => {
          sessionStorage.setItem("tianyi-demo-admin", "1");
          setDemoAdmin(true);
        }} />
      ) : (
        <AdminWorkspace />
      )}
    </Shell>
  );
}

function AdminLogin({ isDenied, onDemo }) {
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
        {isLocalPreview() && (
          <button className="ghost-button" type="button" onClick={onDemo}>
            <Eye /> Preview admin 管理预览
          </button>
        )}
      </form>
      {message && <p className="notice">{message}</p>}
    </section>
  );
}

function AdminWorkspace({ demo = false }) {
  const [tab, setTab] = useState("dashboard");
  const [menuOpen, setMenuOpen] = useState(false);
  const [showAd, setShowAd] = useState(false);
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

  useEffect(() => {
    const timer = window.setInterval(() => setShowAd(true), 5 * 60 * 1000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <>
      <section className="admin-layout">
        <button className="admin-menu-button" onClick={() => setMenuOpen((open) => !open)}>
          {menuOpen ? <X /> : <Menu />}
          Menu 菜单
        </button>
        <nav className={menuOpen ? "admin-tabs open" : "admin-tabs"}>
          {tabs.map(([id, label, Icon]) => (
            <button key={id} className={tab === id ? "active" : ""} onClick={() => { setTab(id); setMenuOpen(false); }}>
              <Icon /> {label}
            </button>
          ))}
        </nav>
        {tab === "dashboard" && <Dashboard refreshKey={refreshKey} demo={demo} />}
        {tab === "members" && <MemberManager onChanged={() => setRefreshKey((v) => v + 1)} demo={demo} />}
        {tab === "submissions" && <SubmissionReview demo={demo} />}
        {["one_to_one", "training", "referral", "tyfcb", "visitor"].includes(tab) && <VerificationQueue kind={tab} demo={demo} />}
        {tab === "attendance" && <AttendanceList demo={demo} />}
      </section>
      {showAd && <AgaAdPopup onClose={() => setShowAd(false)} />}
    </>
  );
}

function AgaAdPopup({ onClose }) {
  const features = [
    "AI websites AI 网站",
    "Business portals 企业系统",
    "Automation workflows 自动化流程",
    "CRM dashboards 客户管理仪表板",
  ];
  return (
    <div className="aga-ad-backdrop" role="dialog" aria-modal="true">
      <section className="aga-ad-panel">
        <button className="icon-button detail-close" onClick={onClose} aria-label="Close AGA showcase">
          <X />
        </button>
        <div className="aga-ad-brand">
          <span>AGA VENTURES SDN BHD</span>
          <h2>Build faster business systems 打造更快的企业系统</h2>
          <p>Custom websites, portals, dashboards, automation, and AI tools for growing teams.</p>
        </div>
        <div className="aga-ad-grid">
          {features.map((feature) => <strong key={feature}>{feature}</strong>)}
        </div>
        <a className="aga-ad-link" href="https://agaventures.ai" target="_blank" rel="noreferrer">
          Visit agaventures.ai
        </a>
      </section>
    </div>
  );
}

function Dashboard({ refreshKey, demo = false }) {
  const [board, setBoard] = useState([]);
  const [stats, setStats] = useState({ members: 0, submissions: 0, tyfcb: 0 });

  useEffect(() => {
    if (demo) {
      setBoard(DEMO_BOARD);
      setStats({
        members: DEMO_MEMBERS.length,
        submissions: DEMO_SUBMISSIONS.length,
        tyfcb: DEMO_SUBMISSIONS.reduce((sum, item) => sum + Number(item.tyfcb || 0), 0),
      });
      return;
    }
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
  }, [refreshKey, demo]);

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

function MemberManager({ onChanged, demo = false }) {
  const [members, setMembers] = useState([]);
  const [newMember, setNewMember] = useState({ full_name: "", email: "", company: "" });
  const [searchTerm, setSearchTerm] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  async function load() {
    if (demo) {
      setMembers(DEMO_MEMBERS);
      return;
    }
    const { data: memberData } = await supabase.from("tianyi_members").select("*, buddy:tianyi_members!tianyi_members_buddy_member_id_fkey(id,full_name,email)").order("full_name");
    setMembers(memberData || []);
  }

  useEffect(() => { load(); }, []);

  async function addMember(event) {
    event.preventDefault();
    if (demo) {
      const member = {
        ...newMember,
        id: window.crypto?.randomUUID?.() || `demo-member-${Date.now()}`,
        email: normalizeEmail(newMember.email),
      };
      setMembers((current) => [...current, member].sort((a, b) => a.full_name.localeCompare(b.full_name)));
      setNewMember({ full_name: "", email: "", company: "" });
      setIsAdding(false);
      onChanged();
      return;
    }
    await supabase.from("tianyi_members").insert({ ...newMember, email: normalizeEmail(newMember.email) });
    setNewMember({ full_name: "", email: "", company: "" });
    setIsAdding(false);
    await load();
    onChanged();
  }

  async function updateBuddy(memberId, buddyMemberId) {
    if (demo) {
      setMembers((current) => current.map((member) => {
        if (member.id === memberId) {
          const buddy = current.find((item) => item.id === buddyMemberId);
          return { ...member, buddy_member_id: buddyMemberId || null, buddy };
        }
        if (buddyMemberId && member.id === buddyMemberId) {
          const source = current.find((item) => item.id === memberId);
          return { ...member, buddy_member_id: memberId, buddy: source };
        }
        return member;
      }));
      return;
    }
    await supabase.from("tianyi_members").update({ buddy_member_id: buddyMemberId || null }).eq("id", memberId);
    if (buddyMemberId) await supabase.from("tianyi_members").update({ buddy_member_id: memberId }).eq("id", buddyMemberId);
    await load();
    onChanged();
  }

  const normalizedSearch = searchTerm.trim().toLowerCase();
  const filteredMembers = normalizedSearch
    ? members.filter((member) => [member.full_name, member.email, member.company, member.buddy?.full_name].filter(Boolean).join(" ").toLowerCase().includes(normalizedSearch))
    : members;

  return (
    <div className="admin-content">
      <section className="panel">
        <div className="section-heading"><UsersRound /><div><h2>Member list 会员名单</h2><p>Add members and assign buddy teams.</p></div></div>
        <div className="member-toolbar">
          <Label text="Search member 搜索会员">
            <input placeholder="Name, email, company or buddy" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </Label>
          <button className="primary-button" type="button" onClick={() => setIsAdding(true)}>
            <Plus /> Add 新增
          </button>
        </div>
        <div className="table-wrap member-table-wrap">
          <table>
            <thead><tr><th>Name</th><th>Email</th><th>Company</th><th>Buddy member</th></tr></thead>
            <tbody>
              {filteredMembers.map((member) => (
                <tr key={member.id}>
                  <td>{member.full_name}</td>
                  <td>{member.email}</td>
                  <td>{member.company || "-"}</td>
                  <td>
                    <select value={member.buddy_member_id || ""} onChange={(e) => updateBuddy(member.id, e.target.value)}>
                      <option value="">None</option>
                      {members.filter((option) => option.id !== member.id).map((option) => <option key={option.id} value={option.id}>{option.full_name}</option>)}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="member-card-list">
          {filteredMembers.map((member) => (
            <article className="member-list-card" key={member.id}>
              <div>
                <strong>{member.full_name}</strong>
                <span>{member.email}</span>
              </div>
              <dl>
                <div><dt>Company 公司</dt><dd>{member.company || "-"}</dd></div>
                <div><dt>Buddy partner 伙伴</dt><dd>{member.buddy?.full_name || "None"}</dd></div>
              </dl>
              <Label text="Link buddy member 绑定伙伴会员">
                <select value={member.buddy_member_id || ""} onChange={(e) => updateBuddy(member.id, e.target.value)}>
                  <option value="">None</option>
                  {members.filter((option) => option.id !== member.id).map((option) => <option key={option.id} value={option.id}>{option.full_name}</option>)}
                </select>
              </Label>
            </article>
          ))}
        </div>
        {filteredMembers.length === 0 && <p className="muted empty-state">No members found. 找不到会员。</p>}
      </section>
      {isAdding && (
        <div className="detail-backdrop" role="dialog" aria-modal="true">
          <form className="detail-panel modal-form" onSubmit={addMember}>
            <button className="icon-button detail-close" type="button" onClick={() => setIsAdding(false)} aria-label="Close add member">
              <X />
            </button>
            <p>Add member 新增会员</p>
            <h2>Member profile 会员资料</h2>
            <Label text="Full name 姓名">
              <input value={newMember.full_name} onChange={(e) => setNewMember({ ...newMember, full_name: e.target.value })} required />
            </Label>
            <Label text="Email 电邮">
              <input type="email" value={newMember.email} onChange={(e) => setNewMember({ ...newMember, email: e.target.value })} required />
            </Label>
            <Label text="Company 公司">
              <input value={newMember.company} onChange={(e) => setNewMember({ ...newMember, company: e.target.value })} />
            </Label>
            <div className="button-row">
              <button className="ghost-button" type="button" onClick={() => setIsAdding(false)}>Cancel 取消</button>
              <Button><Plus /> Add 新增</Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function SubmissionReview({ demo = false }) {
  const [items, setItems] = useState([]);
  useEffect(() => {
    if (demo) {
      setItems(DEMO_SUBMISSIONS);
      return;
    }
    supabase.from("tianyi_submission_details").select("*").order("submitted_at", { ascending: false }).then(({ data }) => setItems(data || []));
  }, [demo]);
  return (
    <div className="admin-content">
      <section className="panel">
        <div className="section-heading"><ClipboardCheck /><div><h2>All submissions 所有提交</h2><p>Full weekly game input list.</p></div></div>
        <SubmissionTable items={items} />
      </section>
    </div>
  );
}

function VerificationQueue({ kind, demo = false }) {
  const [items, setItems] = useState([]);
  const [rejecting, setRejecting] = useState(null);
  const statusField = `${kind}_status`;

  async function load() {
    if (demo) {
      const field = kind === "tyfcb" ? "tyfcb" : kind === "one_to_one" ? "one_to_one" : kind === "referral" ? "referrals" : kind === "visitor" ? "visitors" : "training";
      setItems(DEMO_SUBMISSIONS.filter((item) => Number(item[field]) > 0));
      return;
    }
    const { data } = await supabase
      .from("tianyi_submission_details")
      .select("*, tianyi_evidence(*)")
      .gt(kind === "tyfcb" ? "tyfcb" : kind === "one_to_one" ? "one_to_one" : kind === "referral" ? "referrals" : kind === "visitor" ? "visitors" : "training", 0)
      .order("submitted_at", { ascending: false });
    setItems(data || []);
  }

  useEffect(() => { load(); }, [kind]);

  async function setStatus(id, value) {
    if (demo) {
      setItems((current) => current.map((item) => item.id === id ? { ...item, [statusField]: value } : item));
      return;
    }
    await supabase.from("tianyi_submissions").update({ [statusField]: value }).eq("id", id);
    await load();
  }

  async function rejectWithReason(reason) {
    if (!rejecting) return;
    if (demo) {
      setItems((current) => current.map((item) => item.id === rejecting.id ? { ...item, [statusField]: "rejected", [`${kind}_admin_note`]: reason } : item));
      setRejecting(null);
      return;
    }
    await supabase.from("tianyi_submissions").update({ [statusField]: "rejected", admin_note: reason }).eq("id", rejecting.id);
    await fetch("/api/rejection-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: rejecting.email,
        name: rejecting.full_name,
        week: rejecting.week_label,
        kind: FIELD_META[kind]?.label || kind,
        reason,
        origin: window.location.origin,
      }),
    }).catch(() => {});
    setRejecting(null);
    await load();
  }

  return (
    <div className="admin-content">
      <section className="panel">
        <div className="section-heading"><Eye /><div><h2>{FIELD_META[kind]?.label || kind} verification 审核</h2><p>Approve or reject proof photos.</p></div></div>
        <div className="review-list">
          {items.map((item) => (
            <ReviewCard key={item.id} item={item} kind={kind} statusField={statusField} onStatus={setStatus} onReject={() => setRejecting(item)} />
          ))}
        </div>
      </section>
      {rejecting && <RejectModal item={rejecting} kind={kind} onCancel={() => setRejecting(null)} onConfirm={rejectWithReason} />}
    </div>
  );
}

function RejectModal({ item, kind, onCancel, onConfirm }) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");

  function submit(event) {
    event.preventDefault();
    if (reason.trim().length < 3) {
      setError("Please enter a clear rejection reason. 请输入拒绝原因。");
      return;
    }
    onConfirm(reason.trim());
  }

  return (
    <div className="detail-backdrop" role="dialog" aria-modal="true">
      <form className="detail-panel modal-form" onSubmit={submit}>
        <button className="icon-button detail-close" type="button" onClick={onCancel} aria-label="Close reject reason">
          <X />
        </button>
        <p>Reject confirmation 拒绝确认</p>
        <h2>{FIELD_META[kind]?.label || kind} proof for {item.full_name}</h2>
        <span>{item.week_label}</span>
        <Label text="Reason to member 给会员的原因">
          <textarea value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Example: Proof photo is unclear or does not match this week." required />
        </Label>
        <p className="notice">This reason will be sent to the member email. 此原因会发送到会员电邮。</p>
        {error && <p className="error">{error}</p>}
        <div className="button-row">
          <button className="ghost-button" type="button" onClick={onCancel}>Cancel 取消</button>
          <button className="danger-button" type="submit"><XCircle /> Confirm reject 确认拒绝</button>
        </div>
      </form>
    </div>
  );
}

function ReviewCard({ item, kind, statusField, onStatus, onReject }) {
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
        <button onClick={onReject}><XCircle /> Reject</button>
      </div>
    </article>
  );
}

function EvidenceLink({ file }) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    if (file.file_path?.startsWith("demo/")) {
      setUrl("");
      return;
    }
    supabase.storage.from("tianyi-evidence").createSignedUrl(file.file_path, 3600).then(({ data }) => setUrl(data?.signedUrl || ""));
  }, [file.file_path]);
  if (file.file_path?.startsWith("demo/")) return <span><FileImage /> {file.file_name || "Demo proof"}</span>;
  return url ? <a href={url} target="_blank" rel="noreferrer"><FileImage /> {file.file_name || "Open proof"}</a> : <span>Loading proof...</span>;
}

function AttendanceList({ demo = false }) {
  const [members, setMembers] = useState([]);
  const [weeks, setWeeks] = useState(WEEKS);
  const [selectedWeekId, setSelectedWeekId] = useState(WEEKS[0]?.id || 1);
  const [attendanceIds, setAttendanceIds] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [draftIds, setDraftIds] = useState([]);

  async function load() {
    if (demo) {
      setWeeks(WEEKS);
      setMembers(DEMO_MEMBERS);
      setAttendanceIds(DEMO_SUBMISSIONS.filter((item) => item.week_id === Number(selectedWeekId) && item.attended).map((item) => item.member_id));
      return;
    }
    const [{ data: weekRows }, { data: memberRows }, { data: attendanceRows }] = await Promise.all([
      supabase.from("tianyi_weeks").select("*").order("id"),
      supabase.from("tianyi_members").select("id,full_name,email,company").order("full_name"),
      supabase.from("tianyi_attendance").select("member_id").eq("week_id", selectedWeekId).eq("attended", true),
    ]);
    setWeeks(weekRows?.length ? weekRows : WEEKS);
    setMembers(memberRows || []);
    setAttendanceIds((attendanceRows || []).map((row) => row.member_id));
  }

  useEffect(() => { load(); }, [demo, selectedWeekId]);

  function openAttendanceModal() {
    setDraftIds(attendanceIds);
    setIsModalOpen(true);
  }

  function toggleDraft(memberId) {
    setDraftIds((current) => current.includes(memberId) ? current.filter((id) => id !== memberId) : [...current, memberId]);
  }

  async function saveAttendance(event) {
    event.preventDefault();
    if (demo) {
      setAttendanceIds(draftIds);
      setIsModalOpen(false);
      return;
    }
    const removed = attendanceIds.filter((id) => !draftIds.includes(id));
    const addedRows = draftIds.map((memberId) => ({ week_id: Number(selectedWeekId), member_id: memberId, attended: true }));
    if (removed.length) {
      await supabase.from("tianyi_attendance").delete().eq("week_id", selectedWeekId).in("member_id", removed);
    }
    if (addedRows.length) {
      await supabase.from("tianyi_attendance").upsert(addedRows, { onConflict: "week_id,member_id" });
    }
    setIsModalOpen(false);
    await load();
  }

  const selectedWeek = weeks.find((week) => Number(week.id) === Number(selectedWeekId)) || weeks[0];
  const attendedMembers = members.filter((member) => attendanceIds.includes(member.id));
  const absentMembers = members.filter((member) => !attendanceIds.includes(member.id));
  const ratio = members.length ? Math.round((attendedMembers.length / members.length) * 100) : 0;
  const normalizedSearch = searchTerm.trim().toLowerCase();
  const modalMembers = normalizedSearch
    ? members.filter((member) => [member.full_name, member.email, member.company].filter(Boolean).join(" ").toLowerCase().includes(normalizedSearch))
    : members;

  return (
    <div className="admin-content">
      <section className="panel">
        <div className="section-heading"><CheckCircle2 /><div><h2>Attendance list 出席名单</h2><p>Weekly meeting attendance by week.</p></div></div>
        <div className="attendance-toolbar">
          <Label text="Week 周次">
            <select value={selectedWeekId} onChange={(event) => setSelectedWeekId(Number(event.target.value))}>
              {weeks.map((week) => <option key={week.id} value={week.id}>{week.label}</option>)}
            </select>
          </Label>
          <button className="primary-button" type="button" onClick={openAttendanceModal}>
            <ClipboardCheck /> Mark attendance 点名
          </button>
        </div>
        <div className="metric-grid attendance-metrics">
          <Metric label="Attendance ratio 出席率" value={`${ratio}%`} />
          <Metric label="Attended 已出席" value={attendedMembers.length} />
          <Metric label="Did not attend 未出席" value={absentMembers.length} />
          <Metric label="Total members 总会员" value={members.length} />
        </div>
        <div className="attendance-columns">
          <AttendanceGroup title="Did not attend 未出席" members={absentMembers} empty="All members attended. 全员出席。" />
          <AttendanceGroup title="Already attended 已出席" members={attendedMembers} empty="No attendance marked yet. 暂无出席记录。" />
        </div>
      </section>
      {isModalOpen && (
        <div className="detail-backdrop" role="dialog" aria-modal="true">
          <form className="detail-panel attendance-modal" onSubmit={saveAttendance}>
            <button className="icon-button detail-close" type="button" onClick={() => setIsModalOpen(false)} aria-label="Close attendance">
              <X />
            </button>
            <p>Attendance 点名</p>
            <h2>{selectedWeek?.label}</h2>
            <Label text="Search member 搜索会员">
              <input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Name, email or company" />
            </Label>
            <div className="attendance-check-list">
              {modalMembers.map((member) => (
                <label className="attendance-check-row" key={member.id}>
                  <input type="checkbox" checked={draftIds.includes(member.id)} onChange={() => toggleDraft(member.id)} />
                  <span>
                    <strong>{member.full_name}</strong>
                    <small>{member.email}</small>
                  </span>
                </label>
              ))}
            </div>
            <div className="button-row">
              <button className="ghost-button" type="button" onClick={() => setIsModalOpen(false)}>Cancel 取消</button>
              <Button><CheckCircle2 /> Save attendance 保存</Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function AttendanceGroup({ title, members, empty }) {
  return (
    <section className="attendance-group">
      <h3>{title}</h3>
      <div className="attendance-member-list">
        {members.length === 0 && <p className="muted">{empty}</p>}
        {members.map((member) => (
          <article key={member.id}>
            <strong>{member.full_name}</strong>
            <span>{member.email}</span>
          </article>
        ))}
      </div>
    </section>
  );
}

function SubmissionTable({ items }) {
  const [selected, setSelected] = useState(null);
  return (
    <>
      <div className="table-wrap submission-table-wrap">
        <table>
          <thead>
            <tr><th>Member</th><th>Week</th><th>Buddy</th><th>1-2-1</th><th>Training</th><th>Referral</th><th>TYFCB</th><th>Visitor</th><th>Score</th></tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="clickable-row" onClick={() => setSelected(item)}>
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
      <div className="submission-card-list">
        {items.map((item) => (
          <button className="submission-card" key={item.id} onClick={() => setSelected(item)}>
            <div>
              <strong>{item.full_name}</strong>
              <span>{item.week_label}</span>
            </div>
            <div className="submission-card-score">{item.score} pts</div>
            <dl>
              <div><dt>Buddy</dt><dd>{item.team_no || "-"}</dd></div>
              <div><dt>1-2-1</dt><dd>{item.one_to_one}</dd></div>
              <div><dt>Training</dt><dd>{item.training}</dd></div>
              <div><dt>Referral</dt><dd>{item.referrals}</dd></div>
              <div><dt>TYFCB</dt><dd>{money(item.tyfcb)}</dd></div>
              <div><dt>Visitor</dt><dd>{item.visitors}</dd></div>
            </dl>
          </button>
        ))}
      </div>
      {selected && <SubmissionDetail item={selected} onClose={() => setSelected(null)} />}
    </>
  );
}

function SubmissionDetail({ item, onClose }) {
  return (
    <div className="detail-backdrop" role="dialog" aria-modal="true">
      <section className="detail-panel">
        <button className="icon-button detail-close" onClick={onClose} aria-label="Close details">
          <X />
        </button>
        <p>Submission details 提交详情</p>
        <h2>{item.full_name}</h2>
        <span>{item.week_label}</span>
        <div className="score-badge large">
          <strong>{item.score}</strong>
          <span>pts 分</span>
        </div>
        <dl>
          <div><dt>Email 电邮</dt><dd>{item.email || "-"}</dd></div>
          <div><dt>Buddy team 伙伴组</dt><dd>{item.team_no || "-"}</dd></div>
          <div><dt>1-2-1</dt><dd>{item.one_to_one}</dd></div>
          <div><dt>Training 培训</dt><dd>{item.training}</dd></div>
          <div><dt>Referral 引荐</dt><dd>{item.referrals}</dd></div>
          <div><dt>TYFCB</dt><dd>{money(item.tyfcb)}</dd></div>
          <div><dt>Visitor 访客</dt><dd>{item.visitors}</dd></div>
          <div><dt>Visitor joined 访客加入</dt><dd>{item.visitor_joined || 0}</dd></div>
          <div><dt>Attendance 出席</dt><dd>{item.attended ? "Yes 是" : "No 否"}</dd></div>
          <div><dt>Submitted 提交时间</dt><dd>{item.submitted_at ? new Date(item.submitted_at).toLocaleString() : "-"}</dd></div>
        </dl>
      </section>
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
