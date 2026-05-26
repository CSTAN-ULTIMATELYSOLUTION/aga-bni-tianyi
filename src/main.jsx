import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Link, Navigate, Route, Routes, useLocation, useNavigate, useParams } from "react-router-dom";
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
import { EVIDENCE_BUCKET, supabase } from "./lib/supabase";
import {
  DEMO_BOARD,
  DEMO_MEMBER,
  DEMO_MEMBERS,
  DEMO_SUBMISSIONS,
  FIELD_META,
  WEEKS,
  ADMIN_EMAILS,
  activeSubmission,
  calcScore,
  canSubmitWeek,
  currentSubmissionWeeks,
  money,
  normalizeEmail,
  tierPoints,
} from "./lib/game";
import {
  beliefs,
  differenceCards,
  faqs,
  joinSteps,
  memberProfiles,
  moments,
  serviceCategories,
  siteStats,
} from "./lib/website";
import "./styles.css";

const isLocalPreview = () => ["localhost", "127.0.0.1"].includes(window.location.hostname);
const MAX_EVIDENCE_BYTES = 5 * 1024 * 1024;
const ADMIN_TOKEN_KEY = "tianyi-admin-token";

function todayLabel() {
  return new Date().toLocaleDateString("en-MY", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/website" replace />} />
        <Route path="/website" element={<WebsitePage />} />
        <Route path="/members" element={<MembersPage />} />
        <Route path="/catalog" element={<CatalogPage />} />
        <Route path="/game" element={<GamePage />} />
        <Route path="/game/weeklyupdate" element={<WeeklyUpdatePage />} />
        <Route path="/game/submission/:id" element={<SubmissionReceipt />} />
        <Route path="/submission/:id" element={<NavigateToGameSubmission />} />
        <Route path="/admin" element={<AdminPortal />} />
        <Route path="*" element={<Navigate to="/website" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

function NavigateToGameSubmission() {
  const { id } = useParams();
  return <Navigate to={`/game/submission/${id}`} replace />;
}

function Shell({ children, wide = false }) {
  const { pathname } = useLocation();
  const showSiteNav = pathname === "/website";

  return (
    <main className={wide ? "shell shell-wide" : "shell"}>
      {showSiteNav && <SiteNav />}
      {children}
      <FeatureBanner />
      <FooterBanner />
    </main>
  );
}

function SiteNav() {
  const links = [
    ["/website", "Home"],
    ["/website#story", "Our Story"],
    ["/members", "The Crew"],
    ["/catalog", "What We Do"],
    ["/website#moments", "Moments"],
  ];
  return (
    <nav className="site-nav" aria-label="Primary">
      <Link className="nav-brand" to="/website">
        <span>天一</span>
        <b>Tian Yi Chapter</b>
      </Link>
      {links.map(([to, label]) => (
        <Link key={to} to={to}>
          {label}
        </Link>
      ))}
      <Link className="nav-cta" to="/website#join">Pull Up a Chair</Link>
    </nav>
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
      <span>TIAN YI OneSystem</span>
      <a href="https://agaventures.ai" target="_blank" rel="noreferrer">
        Supported by AGA Ventures
      </a>
    </footer>
  );
}

function WebsitePage() {
  return (
    <Shell wide>
      <header className="website-hero">
        <div className="ghost-kanji">天一</div>
        <div className="hero-kicker">BNI Klang Region</div>
        <h1>
          We're not <em>just</em> a business club.
          <span>我们是天一。</span>
        </h1>
        <p>A warm, high-trust chapter where referrals, accountability, and real friendship move in the same rhythm.</p>
        <div className="hero-actions">
          <Link className="primary-link" to="/members">
            <UsersRound /> Meet The Crew
          </Link>
          <Link className="secondary-link" to="/catalog">
            <ClipboardCheck /> Explore Services
          </Link>
        </div>
        <div className="snapshot-strip" aria-label="Tian Yi moments">
          {["Weekly energy", "Trusted referrals", "Warm introductions"].map((item, index) => (
            <article className="polaroid" key={item}>
              <div className={`photo-block photo-${index + 1}`}></div>
              <span>{item}</span>
            </article>
          ))}
        </div>
      </header>

      <section className="stat-band" aria-label="Chapter stats">
        {siteStats.map(([value, label, zh]) => (
          <div key={label}>
            <strong>{value}</strong>
            <span>{label}</span>
            <small>{zh}</small>
          </div>
        ))}
      </section>

      <section className="section-band">
        <div className="section-title">
          <span>Why Tian Yi</span>
          <h2>What makes us different</h2>
        </div>
        <div className="feature-grid">
          {differenceCards.map(([title, body, zh]) => (
            <article className="feature-card" key={title}>
              <strong>{title}</strong>
              <p>{body}</p>
              <small>{zh}</small>
            </article>
          ))}
        </div>
      </section>

      <section id="story" className="story-section">
        <div>
          <span className="section-label">Our Story</span>
          <h2>One chapter, one rhythm, one sky.</h2>
          <p>
            Tian Yi is built for business owners who believe trust is earned through repeated action. We meet, learn,
            visit, refer, and follow up with the consistency that turns a room of professionals into a chapter.
          </p>
        </div>
        <div className="belief-list">
          {beliefs.map(([title, body]) => (
            <article key={title}>
              <strong>{title}</strong>
              <span>{body}</span>
            </article>
          ))}
        </div>
      </section>

      <section id="moments" className="section-band">
        <div className="section-title">
          <span>Moments</span>
          <h2>Business feels warmer when people remember the room.</h2>
        </div>
        <div className="moments-grid">
          <article className="moment-feature">
            <span>{moments[0].tag}</span>
            <h3>{moments[0].title}</h3>
            <p>{moments[0].date}</p>
            <small>{moments[0].body}</small>
          </article>
          {moments.slice(1).map(([title, body]) => (
            <article className="moment-card" key={title}>
              <strong>{title}</strong>
              <span>{body}</span>
            </article>
          ))}
        </div>
      </section>

      <section id="join" className="join-section">
        <div className="section-title">
          <span>Pull Up a Chair</span>
          <h2>Visit first. Feel the room. Then decide.</h2>
        </div>
        <div className="join-steps">
          {joinSteps.map(([title, body], index) => (
            <article key={title}>
              <b>{String(index + 1).padStart(2, "0")}</b>
              <strong>{title}</strong>
              <span>{body}</span>
            </article>
          ))}
        </div>
        <div className="faq-list">
          {faqs.map(([question, answer]) => (
            <details key={question}>
              <summary>{question}</summary>
              <p>{answer}</p>
            </details>
          ))}
        </div>
      </section>
    </Shell>
  );
}

function MembersPage() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [selected, setSelected] = useState(memberProfiles[0]);
  const [tab, setTab] = useState("about");
  const categories = useMemo(() => ["All", ...new Set(memberProfiles.map((item) => item.category))], []);
  const filtered = memberProfiles.filter((member) => {
    const haystack = `${member.name} ${member.role} ${member.company} ${member.category} ${member.services.join(" ")}`.toLowerCase();
    return (category === "All" || member.category === category) && haystack.includes(query.toLowerCase());
  });

  return (
    <Shell wide>
      <section className="directory-head">
        <span className="section-label">The Crew</span>
        <h1>Member profiles, services, and contact paths.</h1>
        <p>会员资料、服务范围与联系方向。Final 84-member list can replace this starter content directly.</p>
        <div className="directory-tools">
          <Label text="Search members">
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name, company, service..." />
          </Label>
          <Label text="Category">
            <select value={category} onChange={(event) => setCategory(event.target.value)}>
              {categories.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </Label>
        </div>
      </section>

      <section className="member-directory">
        <div className="public-member-grid">
          {filtered.map((member, index) => (
            <button
              className="public-member-card"
              key={member.name}
              onClick={() => {
                setSelected(member);
                setTab("about");
              }}
            >
              <span className={`avatar-chip avatar-${(index % 5) + 1}`}>{member.name.split(" ").map((word) => word[0]).join("")}</span>
              <strong>{member.name}</strong>
              <small>{member.role}</small>
              <p>{member.company}</p>
              <em>{member.category}</em>
            </button>
          ))}
        </div>
        {selected && (
          <aside className="member-drawer">
            <button className="icon-button drawer-close" aria-label="Close member profile" onClick={() => setSelected(null)}>
              <X />
            </button>
            <span className="section-label">{selected.category}</span>
            <h2>{selected.name}</h2>
            <p>{selected.role} · {selected.company}</p>
            <blockquote>{selected.quote}</blockquote>
            <div className="drawer-tabs">
              {["about", "catalog", "connect"].map((item) => (
                <button className={tab === item ? "active" : ""} key={item} onClick={() => setTab(item)}>
                  {item}
                </button>
              ))}
            </div>
            {tab === "about" && <p className="drawer-copy">{selected.bio}</p>}
            {tab === "catalog" && (
              <div className="service-pill-list">
                {selected.services.map((service) => <span key={service}>{service}</span>)}
              </div>
            )}
            {tab === "connect" && (
              <div className="connect-box">
                <Mail />
                <div>
                  <strong>{selected.contact}</strong>
                  <span>Replace with verified member email/phone before public launch.</span>
                </div>
              </div>
            )}
          </aside>
        )}
      </section>
    </Shell>
  );
}

function CatalogPage() {
  const [query, setQuery] = useState("");
  const filtered = serviceCategories.filter((category) => {
    const haystack = `${category.name} ${category.zh} ${category.services.join(" ")}`.toLowerCase();
    return haystack.includes(query.toLowerCase());
  });

  return (
    <Shell wide>
      <section className="directory-head">
        <span className="section-label">What We Do</span>
        <h1>Services and products from Tian Yi members.</h1>
        <p>Use this as the public catalog structure. Final member-specific listings can be plugged in once provided.</p>
        <div className="directory-tools single">
          <Label text="Search catalog">
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search service, product, or category..." />
          </Label>
        </div>
      </section>

      <section className="catalog-accordion">
        {filtered.map((category, index) => (
          <details key={category.name} open={index < 3}>
            <summary>
              <span>
                <strong>{category.name}</strong>
                <small>{category.zh}</small>
              </span>
              <ChevronRight />
            </summary>
            <div className="service-pill-list">
              {category.services.map((service) => <span key={service}>{service}</span>)}
            </div>
          </details>
        ))}
      </section>
    </Shell>
  );
}

function GamePage() {
  return (
    <Shell wide>
      <HeroHeader eyebrow="Internal BNI Tian Yi" title="TIAN YI OneSystem" sub="Rules, leaderboard, and weekly update access for members." />
      <section className="game-layout">
      <div className="panel stack">
        <div className="section-heading">
          <Medal />
          <div>
            <h2>游戏规则 Game logic</h2>
            <p>Points are calculated from weekly activities and admin-verified attendance.</p>
          </div>
        </div>
        <div className="score-rule-list">
          <div><strong>1-2-1</strong><span>1 pt each, max 2</span></div>
          <div><strong>Training</strong><span>5 pts each</span></div>
          <div><strong>Referral</strong><span>5 pts each</span></div>
          <div><strong>TYFCB</strong><span>1 / 3 / 6 / 9 / 12 pts by amount tier</span></div>
          <div><strong>Visitor</strong><span>10 pts each, 25 pts when joined</span></div>
          <div><strong>Full attendance</strong><span>3 bonus pts when activity and attendance conditions are met</span></div>
        </div>
        <Link className="primary-link" to="/game/weeklyupdate">
          <Upload /> 提交每周更新 Submit weekly update
        </Link>
      </div>
      <GameLeaderboard />
      </section>
    </Shell>
  );
}

function GameLeaderboard() {
  const [rows, setRows] = useState(DEMO_BOARD);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isLocalPreview()) return;
    setLoading(true);
    supabase.rpc("team_leaderboard")
      .then(({ data }) => {
        if (data?.length) setRows(data);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <section className="panel stack">
      <div className="section-heading">
        <BarChart3 />
        <div>
          <h2>Leaderboard 排行榜</h2>
          <p>Ranking is by buddy pair, not individual member.</p>
        </div>
      </div>
      <div className="leaderboard">
        {loading && <p className="muted">Loading leaderboard...</p>}
        {rows.map((team, index) => (
          <div className="leader-row" key={team.team_id || team.team_no || team.name}>
            <div>
              <em>#{index + 1}</em>
              <strong>{team.name || `Team ${team.team_no}`}</strong>
              <span>{team.member_a_name || team.member_one || "Member A"} + {team.member_b_name || team.member_two || "Member B"}</span>
            </div>
            <b>{team.total_score || team.score || 0} pts</b>
          </div>
        ))}
      </div>
    </section>
  );
}

function WeeklyUpdatePage() {
  const [session, setSession] = useState(null);
  const [member, setMember] = useState(null);
  const [checkedAccess, setCheckedAccess] = useState(null);
  const [demoMember] = useState(() => isLocalPreview() && sessionStorage.getItem("tianyi-demo-member") === "1");
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
      {checkedAccess ? (
        <WeeklyDesk
          member={checkedAccess.member}
          initialWeek={checkedAccess.week}
          verifiedEmail={checkedAccess.email}
          onExit={() => setCheckedAccess(null)}
        />
      ) : !session || !member ? (
        <MemberCheckLogin onVerified={setCheckedAccess} />
      ) : (
        <WeeklyDesk member={member} />
      )}
    </Shell>
  );
}

async function linkAndLoadMember(setMember) {
  const { data, error } = await supabase.rpc("link_current_user");
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

function HeroHeader({
  eyebrow = "BNI Klang Region",
  title = "TIAN YI OneSystem",
  sub = "Weekly accountability portal 每周活动提交系统",
}) {
  return (
    <header className="hero">
      <div className="brand-row">
        <div className="brand-mark">天</div>
        <div>
          <p>{eyebrow}</p>
          <h1>{title}</h1>
        </div>
      </div>
      <div className="hero-copy">
        <p>{sub}</p>
        <span>Today {todayLabel()}</span>
      </div>
    </header>
  );
}

function MemberCheckLogin({ onVerified }) {
  const [form, setForm] = useState({ email: "" });
  const [weeks, setWeeks] = useState([]);
  const [selectedWeek, setSelectedWeek] = useState(null);
  const [memberOptions, setMemberOptions] = useState([]);
  const [memberSearch, setMemberSearch] = useState("");
  const [selectedMember, setSelectedMember] = useState(null);
  const [membersLoading, setMembersLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let mounted = true;
    const availableWeeks = currentSubmissionWeeks();
    setWeeks(availableWeeks);
    setSelectedWeek(availableWeeks[0]);
    supabase
      .from("members")
      .select("id,full_name,company")
      .order("full_name")
      .then(({ data, error }) => {
        if (!mounted) return;
        if (error) {
          setMessage("Unable to load member list. Please refresh and try again. 无法载入会员名单，请刷新。");
          setMemberOptions(isLocalPreview() ? DEMO_MEMBERS.map(({ id, full_name, company }) => ({ id, full_name, company })) : []);
        } else {
          setMemberOptions(data || []);
        }
        setMembersLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const filteredMemberOptions = memberOptions.filter((member) =>
    [member.full_name, member.company].filter(Boolean).join(" ").toLowerCase().includes(memberSearch.toLowerCase())
  );
  const showMemberOptions = memberSearch.trim().length > 0;

  async function checkMemberPair(event) {
    event.preventDefault();
    if (!selectedWeek) {
      setMessage("Please select a week first. 请先选择周次。");
      return;
    }
    if (!selectedMember) {
      setMessage("Please select your name from the member list first. 请先从会员名单选择姓名。");
      return;
    }
    setBusy(true);
    setMessage("");
    const { data, error } = await supabase.rpc("check_member_pair", {
      p_member_id: selectedMember.id,
      p_email: normalizeEmail(form.email),
    });
    const match = data?.[0];
    if (error || !match) {
      setMessage("Member not found. Please check name and email. 找不到会员，请确认姓名和电邮。");
      setBusy(false);
      return;
    }
    onVerified({
      member: {
        id: match.member_id,
        member_id: match.member_id,
        full_name: match.full_name,
        email: match.email,
        buddy_team_id: match.buddy_team_id,
        team_no: match.team_no,
      },
      week: selectedWeek,
      email: normalizeEmail(form.email),
    });
    setBusy(false);
  }

  return (
    <section className="panel login-panel">
      <div className="section-heading">
        <Search />
        <div>
          <h2>Find your member record 查找会员资料</h2>
          <p>Select the week, choose your name, and enter your registered email to start.</p>
        </div>
      </div>

      <form onSubmit={checkMemberPair} className="stack">
        <div className="week-grid compact">
          {weeks.map((week) => (
            <button
              className={selectedWeek?.id === week.id ? "week-card selected" : "week-card"}
              key={week.id}
              type="button"
              onClick={() => setSelectedWeek(week)}
            >
              <div>
                <strong>{week.label}</strong>
                <span>{selectedWeek?.id === week.id ? "Selected 已选择" : "Tap to select 点击选择"}</span>
              </div>
              {selectedWeek?.id === week.id ? <CheckCircle2 /> : <ChevronRight />}
            </button>
          ))}
        </div>
        <div className="member-picker">
          <Label text="Search and select full name 搜索并选择姓名">
            <input
              value={memberSearch}
              onChange={(e) => {
                setMemberSearch(e.target.value);
                setSelectedMember(null);
              }}
              placeholder="Type your name or company..."
              disabled={membersLoading}
              required={!selectedMember}
            />
          </Label>
          {showMemberOptions && (
            <div className="member-option-list">
              {membersLoading && <p className="muted">Loading members 载入会员名单...</p>}
              {!membersLoading && filteredMemberOptions.length === 0 && <p className="muted">No member found. 找不到会员。</p>}
              {!membersLoading && filteredMemberOptions.slice(0, 12).map((member) => (
                <button
                  className={selectedMember?.id === member.id ? "member-option selected" : "member-option"}
                  key={member.id}
                  type="button"
                  onClick={() => {
                    setSelectedMember(member);
                    setMemberSearch(member.full_name);
                    setMessage("");
                  }}
                >
                  <strong>{member.full_name}</strong>
                  {member.company && <span>{member.company}</span>}
                </button>
              ))}
            </div>
          )}
        </div>
        <Label text="Registered email 注册电邮">
          <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
        </Label>
        <Button disabled={busy || membersLoading || !selectedMember || !selectedWeek}>
          {busy ? <Loader2 className="spin" /> : <ShieldCheck />}
          Check and start 开始填写
        </Button>
      </form>
      {message && <p className="notice">{message}</p>}
    </section>
  );
}

function WeeklyDesk({ member, demo = false, initialWeek = null, verifiedEmail = "", onExit }) {
  const [weeks, setWeeks] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [selectedWeek, setSelectedWeek] = useState(null);
  const [loading, setLoading] = useState(true);
  const memberId = member.id || member.member_id;

  async function load() {
    setLoading(true);
    if (demo) {
      setWeeks(currentSubmissionWeeks());
      setSubmissions(DEMO_SUBMISSIONS.filter((item) => item.member_id === member.id));
      setLoading(false);
      return;
    }
    const available = currentSubmissionWeeks();
    const historyRequest = verifiedEmail
      ? supabase.rpc("member_submission_history", { p_member_id: memberId, p_email: verifiedEmail })
      : supabase.from("submission_details").select("*").eq("member_id", memberId).order("submitted_at", { ascending: false });
    const [{ data: dbWeeks }, { data: subs }] = await Promise.all([
      supabase.from("weeks").select("*").in("id", available.map((week) => week.id)).order("id", { ascending: false }),
      historyRequest,
    ]);
    setWeeks(dbWeeks?.length ? dbWeeks : available);
    setSubmissions(subs || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [memberId, demo]);

  if (loading) return <LoadingScreen />;
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
          if (onExit) {
            onExit();
            return;
          }
          supabase.auth.signOut();
        }} aria-label="Sign out">
          <LogOut />
        </button>
      </div>

      {initialWeek && !selectedWeek ? (
        <WeeklyPreSubmitScreen
          week={initialWeek}
          submissions={submissions}
          onStart={() => setSelectedWeek(initialWeek)}
          onBack={onExit}
          demo={demo}
        />
      ) : !selectedWeek ? (
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
              const submitted = !canSubmitWeek(submissions, week.id);
              return (
                <button key={week.id} className="week-card" disabled={submitted && !demo} onClick={() => setSelectedWeek(week)}>
                  <div>
                    <strong>{week.label}</strong>
                    <span>{submitted && !demo ? "已提交 Submitted" : "可提交 Open"}</span>
                  </div>
                  {submitted ? <CheckCircle2 /> : <ChevronRight />}
                </button>
              );
            })}
          </div>
          <SubmissionHistory submissions={submissions} />
        </>
      ) : (
        <WeeklyForm member={member} week={selectedWeek} verifiedEmail={verifiedEmail} onCancel={() => setSelectedWeek(null)} onSubmitted={load} demo={demo} />
      )}
    </section>
  );
}

function WeeklyPreSubmitScreen({ week, submissions, onStart, onBack, demo = false }) {
  const existingSubmission = activeSubmission(submissions).find((item) => Number(item.week_id) === Number(week.id));

  return (
    <>
      <section className="panel pre-submit-panel">
        <div className="section-heading">
          {existingSubmission && !demo ? <XCircle /> : <CheckCircle2 />}
          <div>
            <h2>Review before submit 提交前确认</h2>
            <p>{week.label}</p>
          </div>
        </div>

        {existingSubmission && !demo ? (
          <div className="submission-lock">
            <strong>This week has already been submitted 本周已提交</strong>
            <span>Members cannot enter the form again unless admin archives the previous submission.</span>
            <Link to={`/game/submission/${existingSubmission.id}`} className="primary-link">
              <Eye />
              View submission 查看提交
            </Link>
          </div>
        ) : (
          <div className="submission-ready">
            <strong>No active submission found 可以开始填写</strong>
            <span>Please review your past submissions below before starting this week.</span>
            <button type="button" className="primary-button" onClick={onStart}>
              <ClipboardCheck />
              Start weekly update 开始填写
            </button>
          </div>
        )}

        <button type="button" className="ghost-button" onClick={onBack}>
          Back to member check 返回会员验证
        </button>
      </section>
      <SubmissionHistory submissions={submissions} />
    </>
  );
}

function WeeklyForm({ member, week, verifiedEmail = "", onCancel, onSubmitted, demo = false }) {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    one_to_one: 0,
    training: 0,
    referrals: 0,
    tyfcb: "",
    visitors: 0,
  });
  const [files, setFiles] = useState({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const score = calcScore(form);
  const evidenceKinds = Object.keys(FIELD_META);
  const requiredEvidenceKinds = evidenceKinds.filter((kind) => {
    if (kind === "referral") return Number(form.referrals) > 0;
    if (kind === "visitor") return Number(form.visitors) > 0;
    return Number(form[kind]) > 0;
  });
  const activeTyfcbTier = [30000, 20000, 10000, 1000, 100].find((amount) => Number(form.tyfcb) >= amount);
  const hasProof = (kind) => Array.from(files[kind] || []).length > 0;

  async function submit(event) {
    event.preventDefault();
    setError("");
    if (demo) {
      setError("Preview mode only. Real submission requires member/email check. 预览模式不会提交。");
      return;
    }
    const selectedFiles = Object.values(files).flatMap((list) => Array.from(list || []));
    const invalidFile = selectedFiles.find((file) => !file.type.startsWith("image/") || file.size > MAX_EVIDENCE_BYTES);
    if (invalidFile) {
      setError("Proof photos must be images under 5MB. 证明照片必须是 5MB 以下的图片。");
      return;
    }
    const missingProofKind = requiredEvidenceKinds.find((kind) => !hasProof(kind));
    if (missingProofKind) {
      setError(`${FIELD_META[missingProofKind].label} requires at least one proof image. ${FIELD_META[missingProofKind].zh} 需要上传至少一张证明照片。`);
      return;
    }
    setBusy(true);
    const memberId = member.id || member.member_id;
    const emailForCheck = verifiedEmail || member.email;
    const payload = {
      p_member_id: memberId,
      p_email: emailForCheck,
      p_week_id: week.id,
      p_one_to_one: Number(form.one_to_one) || 0,
      p_training: Number(form.training) || 0,
      p_referrals: Number(form.referrals) || 0,
      p_tyfcb: Number(form.tyfcb) || 0,
      p_visitors: Number(form.visitors) || 0,
    };
    const { data, error: insertError } = await supabase.rpc("submit_weekly_update", payload);
    const submission = data?.[0];

    if (insertError || !submission) {
      setError(insertError?.message?.includes("already submitted") ? "This week was already submitted. 本周已经提交。" : insertError?.message || "Unable to submit. 无法提交。");
      setBusy(false);
      return;
    }

    const evidenceRows = [];
    for (const kind of evidenceKinds) {
      for (const file of Array.from(files[kind] || [])) {
        const safeName = file.name.replace(/[^a-z0-9._-]/gi, "-").toLowerCase();
        const path = `${memberId}/${submission.id}/${kind}-${Date.now()}-${safeName}`;
        const { error: uploadError } = await supabase.storage.from(EVIDENCE_BUCKET).upload(path, file);
        if (uploadError) {
          setError(uploadError.message);
          setBusy(false);
          return;
        }
        evidenceRows.push({ submission_id: submission.id, kind, file_path: path, file_name: file.name });
      }
    }
    for (const row of evidenceRows) {
      const { error: evidenceError } = await supabase.rpc("add_submission_evidence", {
        p_submission_id: row.submission_id,
        p_member_id: memberId,
        p_email: emailForCheck,
        p_kind: row.kind,
        p_file_path: row.file_path,
        p_file_name: row.file_name,
      });
      if (evidenceError) {
        setError(evidenceError.message);
        setBusy(false);
        return;
      }
    }

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
        adminEmails: ADMIN_EMAILS,
      }),
    }).catch(() => {});

    setBusy(false);
    await onSubmitted();
    navigate(`/game/submission/${submission.id}`);
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

      <ActivitySection title="1-2-1" sub="1 pt each, max 2 每次1分" kind="one_to_one" showProof={Number(form.one_to_one) > 0} files={files} setFiles={setFiles}>
        <ActivityStepper icon={<Handshake />} title="1-2-1" sub="1 pt each, max 2 每次1分" value={form.one_to_one} max={2} onChange={(value) => setForm({ ...form, one_to_one: value })} />
      </ActivitySection>
      <ActivitySection title="Training 培训" sub="5 pts each 每次5分" kind="training" showProof={Number(form.training) > 0} files={files} setFiles={setFiles}>
        <ActivityStepper title="Training 培训" sub="5 pts each 每次5分" value={form.training} max={50} onChange={(value) => setForm({ ...form, training: value })} />
      </ActivitySection>
      <ActivitySection title="Referral 引荐" sub="5 pts each 每个5分" kind="referral" showProof={Number(form.referrals) > 0} files={files} setFiles={setFiles}>
        <ActivityStepper title="Referral 引荐" sub="5 pts each 每个5分" value={form.referrals} max={50} onChange={(value) => setForm({ ...form, referrals: value })} />
      </ActivitySection>
      <ActivitySection title="TYFCB 引荐成交额" sub="Upload proof when amount is entered 输入金额后需上传证明" kind="tyfcb" showProof={Number(form.tyfcb) > 0} files={files} setFiles={setFiles}>
        <Label text="TYFCB 引荐成交额 RM">
          <input type="number" min="0" value={form.tyfcb} onChange={(e) => setForm({ ...form, tyfcb: e.target.value })} placeholder="5000" />
        </Label>
        <div className="tier-row">
          {[100, 1000, 10000, 20000, 30000].map((amount) => (
            <span key={amount} className={activeTyfcbTier === amount ? "active" : ""}>
              RM{amount >= 1000 ? `${amount / 1000}k` : amount}
            </span>
          ))}
          <strong>{tierPoints(Number(form.tyfcb) || 0)} pts</strong>
        </div>
      </ActivitySection>
      <ActivitySection title="Visitor 访客" sub="10 pts each 每位10分" kind="visitor" showProof={Number(form.visitors) > 0} files={files} setFiles={setFiles}>
        <ActivityStepper title="Visitor 访客" sub="10 pts each 每位10分" value={form.visitors} max={50} onChange={(value) => setForm({ ...form, visitors: value })} />
      </ActivitySection>
      <div className="notice">
        出席与访客加入由管理员确认。Attendance and visitor joined are confirmed by admin.
      </div>

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

function ActivitySection({ title, sub, kind, showProof, files, setFiles, children }) {
  const selectedFiles = Array.from(files[kind] || []);
  const selectedCount = selectedFiles.length;
  const [previewFile, setPreviewFile] = useState(null);
  const inputId = `${kind}-proof-input`;
  const clearFiles = () => setFiles({ ...files, [kind]: null });
  const addFiles = (fileList) => {
    const nextFiles = [...selectedFiles, ...Array.from(fileList || [])];
    setFiles({ ...files, [kind]: nextFiles.length ? nextFiles : null });
  };
  const removeFile = (indexToRemove) => {
    const nextFiles = selectedFiles.filter((_file, index) => index !== indexToRemove);
    setFiles({ ...files, [kind]: nextFiles.length ? nextFiles : null });
  };
  return (
    <section className="activity-section">
      <div>
        <strong>{title}</strong>
        <span>{sub}</span>
      </div>
      {children}
      {showProof && (
        <div className={selectedCount ? "inline-proof ready" : "inline-proof"}>
          <div>
            <span className="proof-label">{FIELD_META[kind].label} proof image 证明照片</span>
            <input
              id={inputId}
              className="visually-hidden-file"
              key={`${kind}-${selectedCount}`}
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => addFiles(e.target.files)}
            />
            <label className="upload-file-button" htmlFor={inputId}>
              <Upload /> {selectedCount ? "Add more images 继续上传" : "Upload file 上传照片"}
            </label>
          </div>
          <small>{selectedCount ? `${selectedCount} image(s) selected, ready to submit 已上传，可提交` : "Required before submit 提交前必须上传"}</small>
          {selectedCount > 0 && (
            <div className="proof-file-list">
              {selectedFiles.map((file, index) => (
                <div className="proof-file-row" key={`${file.name}-${file.size}-${index}`}>
                  <FileImage />
                  <span>{file.name}</span>
                  <button className="proof-view-button" type="button" onClick={() => setPreviewFile(file)}>View</button>
                  <button className="proof-cancel-button" type="button" onClick={() => removeFile(index)}>Cancel</button>
                </div>
              ))}
              <button className="proof-clear-button" type="button" onClick={clearFiles}>
                <X /> Remove all
              </button>
            </div>
          )}
        </div>
      )}
      {previewFile && <ProofPreviewModal file={previewFile} onClose={() => setPreviewFile(null)} />}
    </section>
  );
}

function ProofPreviewModal({ file, onClose }) {
  const [url, setUrl] = useState("");

  useEffect(() => {
    const nextUrl = URL.createObjectURL(file);
    setUrl(nextUrl);
    return () => URL.revokeObjectURL(nextUrl);
  }, [file]);

  return (
    <div className="detail-backdrop" role="dialog" aria-modal="true">
      <section className="detail-panel proof-preview-modal">
        <button className="icon-button detail-close" type="button" onClick={onClose} aria-label="Close proof preview">
          <X />
        </button>
        <p>Proof preview 证明预览</p>
        <h2>{file.name}</h2>
        {url && <img src={url} alt={file.name} />}
        <button className="primary-button" type="button" onClick={onClose}>
          Confirm 确认
        </button>
      </section>
    </div>
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
          <Link to={`/game/submission/${item.id}`} className="history-row" key={item.id}>
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
      .rpc("submission_receipt", { p_submission_id: id })
      .then(({ data }) => {
        setSubmission(data?.[0] || null);
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
          <p>Successful submit 提交成功</p>
          <h2>{submission.week_label}</h2>
          <p className="muted">This read-only page is available from your confirmation email link.</p>
          {submission.status === "archived" && (
            <div className="notice">
              此提交已归档，可重新提交。This submission was archived; please submit again.
              <Link to="/game/weeklyupdate"> 前往提交 Go to weekly update</Link>
            </div>
          )}
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
  const [adminSession, setAdminSession] = useState(null);
  const [demoAdmin] = useState(() => isLocalPreview() && sessionStorage.getItem("tianyi-demo-admin") === "1");
  const [checking, setChecking] = useState(true);
  const adminName = demoAdmin ? "Demo admin" : adminSession?.email;

  async function checkAdmin() {
    const token = localStorage.getItem(ADMIN_TOKEN_KEY);
    if (!token) {
      setAdminSession(null);
      setChecking(false);
      return;
    }
    const { data } = await supabase.rpc("admin_check_session", { p_token: token });
    const sessionRow = data?.[0];
    if (sessionRow) setAdminSession({ ...sessionRow, token });
    else {
      localStorage.removeItem(ADMIN_TOKEN_KEY);
      setAdminSession(null);
    }
    setChecking(false);
  }

  useEffect(() => {
    checkAdmin();
  }, []);

  if (checking) return <LoadingScreen />;

  return (
    <Shell wide>
      <header className="admin-header">
        <Link to="/website" className="brand-row admin-brand">
          <div className="brand-mark">天</div>
          <div>
            <p>Admin portal 管理后台</p>
            <h1>Tianyi Game</h1>
          </div>
        </Link>
        {(adminSession || demoAdmin) && (
          <div className="admin-session-box">
            <div>
              <span>Signed in as</span>
              <strong>{adminName}</strong>
            </div>
            <button className="ghost-button" onClick={async () => {
              if (demoAdmin) {
                sessionStorage.removeItem("tianyi-demo-admin");
                window.location.reload();
                return;
              }
              try {
                await supabase.rpc("admin_logout", { p_token: adminSession.token });
              } catch {
                // Local logout should still clear stale sessions if the network request fails.
              }
              localStorage.removeItem(ADMIN_TOKEN_KEY);
              setAdminSession(null);
            }}>
              <LogOut /> Logout 登出
            </button>
          </div>
        )}
      </header>
      {demoAdmin ? (
        <AdminWorkspace demo />
      ) : !adminSession ? (
        <AdminLogin onSignedIn={setAdminSession} />
      ) : (
        <AdminWorkspace adminToken={adminSession.token} />
      )}
    </Shell>
  );
}

function AdminLogin({ onSignedIn }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function signIn(event) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const { data, error } = await supabase.rpc("admin_login", {
      p_email: normalizeEmail(email),
      p_password: password,
    });
    setBusy(false);
    const sessionRow = data?.[0];
    if (error || !sessionRow?.token) {
      setMessage(error?.message || "Invalid admin email or password.");
      return;
    }
    localStorage.setItem(ADMIN_TOKEN_KEY, sessionRow.token);
    onSignedIn(sessionRow);
  }

  return (
    <section className="admin-login-wrap">
      <div className="admin-login-visual">
        <div className="brand-mark">天</div>
        <div>
          <p>TIAN YI OneSystem</p>
          <h2>管理后台</h2>
          <span>Admin Portal</span>
        </div>
      </div>
      <div className="panel login-panel admin-login-card">
        <div className="section-heading">
          <ShieldCheck />
          <div>
            <h2>管理员登入 Admin sign in</h2>
            <p>Use the TianYi admin email and password.</p>
          </div>
        </div>
        <form onSubmit={signIn} className="stack">
          <Label text="Admin email 管理员电邮">
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </Label>
          <Label text="Password 密码">
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </Label>
          <Button disabled={busy}>{busy ? <Loader2 className="spin" /> : <ShieldCheck />} 登入 Sign in</Button>
        </form>
        {message && <p className="notice">{message}</p>}
      </div>
    </section>
  );
}

function AdminWorkspace({ demo = false, adminToken = "" }) {
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
        {tab === "dashboard" && <Dashboard refreshKey={refreshKey} demo={demo} adminToken={adminToken} />}
        {tab === "members" && <MemberManager onChanged={() => setRefreshKey((v) => v + 1)} demo={demo} adminToken={adminToken} />}
        {tab === "submissions" && <SubmissionReview demo={demo} adminToken={adminToken} />}
        {["one_to_one", "training", "referral", "tyfcb", "visitor"].includes(tab) && <VerificationQueue kind={tab} demo={demo} adminToken={adminToken} />}
        {tab === "attendance" && <AttendanceList demo={demo} adminToken={adminToken} />}
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

function Dashboard({ refreshKey, demo = false, adminToken = "" }) {
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
    supabase.rpc("admin_dashboard", { p_token: adminToken }).then(({ data }) => {
      setBoard(data?.leaderboard || []);
      setStats(data?.stats || { members: 0, submissions: 0, tyfcb: 0 });
    });
  }, [refreshKey, demo, adminToken]);

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

function MemberManager({ onChanged, demo = false, adminToken = "" }) {
  const [members, setMembers] = useState([]);
  const [memberScores, setMemberScores] = useState({});
  const [newMember, setNewMember] = useState({ full_name: "", email: "", company: "", phone: "" });
  const [searchTerm, setSearchTerm] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [editingMember, setEditingMember] = useState(null);
  const [memberView, setMemberView] = useState("list");

  async function load() {
    if (demo) {
      setMembers(DEMO_MEMBERS);
      setMemberScores(buildMemberScores(DEMO_SUBMISSIONS));
      return;
    }
    const [{ data: memberData }, { data: submissionData }] = await Promise.all([
      supabase.rpc("admin_members", { p_token: adminToken }),
      supabase.rpc("admin_submissions", { p_token: adminToken }),
    ]);
    setMembers(memberData || []);
    setMemberScores(buildMemberScores(submissionData || []));
  }

  useEffect(() => { load(); }, [adminToken]);

  async function addMember(event) {
    event.preventDefault();
    if (demo) {
      const member = {
        ...newMember,
        id: window.crypto?.randomUUID?.() || `demo-member-${Date.now()}`,
        email: normalizeEmail(newMember.email),
      };
      setMembers((current) => [...current, member].sort((a, b) => a.full_name.localeCompare(b.full_name)));
      setNewMember({ full_name: "", email: "", company: "", phone: "" });
      setIsAdding(false);
      onChanged();
      return;
    }
    await supabase.rpc("admin_add_member", {
      p_token: adminToken,
      p_full_name: newMember.full_name,
      p_email: normalizeEmail(newMember.email),
      p_company: newMember.company,
      p_phone: newMember.phone,
    });
    setNewMember({ full_name: "", email: "", company: "", phone: "" });
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
    await supabase.rpc("admin_assign_buddy_pair", {
      p_token: adminToken,
      p_member_id: memberId,
      p_buddy_member_id: buddyMemberId || null,
    });
    await load();
    onChanged();
  }

  async function updateMember(event) {
    event.preventDefault();
    if (!editingMember) return;
    const nextMember = {
      ...editingMember,
      email: normalizeEmail(editingMember.email),
      phone: editingMember.phone || "",
      company: editingMember.company || "",
    };
    if (demo) {
      setMembers((current) => current.map((member) => member.id === nextMember.id ? nextMember : member).sort((a, b) => a.full_name.localeCompare(b.full_name)));
      setEditingMember(null);
      onChanged();
      return;
    }
    await supabase.rpc("admin_update_member", {
      p_token: adminToken,
      p_member_id: nextMember.id,
      p_full_name: nextMember.full_name,
      p_email: nextMember.email,
      p_phone: nextMember.phone,
      p_company: nextMember.company,
    });
    setEditingMember(null);
    await load();
    onChanged();
  }

  const normalizedSearch = searchTerm.trim().toLowerCase();
  const filteredMembers = normalizedSearch
    ? members.filter((member) => [member.full_name, member.email, member.phone, member.company, member.buddy?.full_name].filter(Boolean).join(" ").toLowerCase().includes(normalizedSearch))
    : members;
  const groupedPairs = Object.values(filteredMembers.reduce((groups, member) => {
    const key = member.buddy_team_id || `unpaired-${member.id}`;
    groups[key] ||= {
      id: key,
      teamNo: member.buddy_teams?.team_no || null,
      name: member.buddy_teams?.name || "Unpaired",
      members: [],
    };
    groups[key].members.push(member);
    return groups;
  }, {})).sort((a, b) => (a.teamNo || 9999) - (b.teamNo || 9999));

  return (
    <div className="admin-content">
      <section className="panel">
        <div className="section-heading"><UsersRound /><div><h2>Member list 会员名单</h2><p>Add members and assign buddy teams.</p></div></div>
        <div className="member-toolbar">
          <Label text="Search member 搜索会员">
            <input placeholder="Name, email, phone, company or buddy" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </Label>
          <button className="primary-button" type="button" onClick={() => setIsAdding(true)}>
            <Plus /> Add 新增
          </button>
        </div>
        <div className="drawer-tabs member-view-tabs">
          <button type="button" className={memberView === "list" ? "active" : ""} onClick={() => setMemberView("list")}>List</button>
          <button type="button" className={memberView === "pairs" ? "active" : ""} onClick={() => setMemberView("pairs")}>Buddy groups</button>
        </div>
        {memberView === "list" ? (
          <>
            <div className="table-wrap member-table-wrap">
              <table>
                <thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Company</th><th>Buddy pair</th><th>Buddy member</th><th>Edit</th></tr></thead>
                <tbody>
                  {filteredMembers.map((member) => (
                    <tr key={member.id}>
                      <td>{member.full_name}</td>
                      <td>{member.email}</td>
                      <td>{member.phone || "-"}</td>
                      <td>{member.company || "-"}</td>
                      <td>{member.buddy_teams?.team_no ? `Pair ${member.buddy_teams.team_no}` : "-"}</td>
                      <td>
                        <select value={member.buddy_member_id || ""} onChange={(e) => updateBuddy(member.id, e.target.value)}>
                          <option value="">None</option>
                          {members.filter((option) => option.id !== member.id).map((option) => <option key={option.id} value={option.id}>{option.full_name}</option>)}
                        </select>
                      </td>
                      <td>
                        <button className="table-action-button" type="button" onClick={() => setEditingMember({ ...member })}>Edit</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="member-card-list">
              {filteredMembers.map((member) => (
                <MemberAdminCard key={member.id} member={member} members={members} updateBuddy={updateBuddy} onEdit={() => setEditingMember({ ...member })} />
              ))}
            </div>
          </>
        ) : (
          <div className="buddy-group-list">
            {groupedPairs.map((group) => (
              <BuddyGroupCard
                key={group.id}
                group={group}
                memberScores={memberScores}
              />
            ))}
          </div>
        )}
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
            <Label text="Phone 电话">
              <input type="tel" value={newMember.phone} onChange={(e) => setNewMember({ ...newMember, phone: e.target.value })} />
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
      {editingMember && (
        <div className="detail-backdrop" role="dialog" aria-modal="true">
          <form className="detail-panel modal-form" onSubmit={updateMember}>
            <button className="icon-button detail-close" type="button" onClick={() => setEditingMember(null)} aria-label="Close edit member">
              <X />
            </button>
            <p>Edit member 编辑会员</p>
            <h2>{editingMember.full_name}</h2>
            <Label text="Full name 姓名">
              <input value={editingMember.full_name} onChange={(e) => setEditingMember({ ...editingMember, full_name: e.target.value })} required />
            </Label>
            <Label text="Email 电邮">
              <input type="email" value={editingMember.email} onChange={(e) => setEditingMember({ ...editingMember, email: e.target.value })} required />
            </Label>
            <Label text="Phone 电话">
              <input type="tel" value={editingMember.phone || ""} onChange={(e) => setEditingMember({ ...editingMember, phone: e.target.value })} />
            </Label>
            <Label text="Company 公司">
              <input value={editingMember.company || ""} onChange={(e) => setEditingMember({ ...editingMember, company: e.target.value })} />
            </Label>
            <div className="button-row">
              <button className="ghost-button" type="button" onClick={() => setEditingMember(null)}>Cancel 取消</button>
              <Button>Save 保存</Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function buildMemberScores(submissions) {
  return submissions.reduce((scores, submission) => {
    if (submission.status === "archived") return scores;
    const current = scores[submission.member_id] || { score: 0, submissions: 0, tyfcb: 0 };
    const submittedAt = submission.submitted_at ? new Date(submission.submitted_at).getTime() : 0;
    const isLatest = submittedAt >= Number(current.latestSubmittedAt || 0);
    scores[submission.member_id] = {
      score: current.score + Number(submission.score || 0),
      submissions: current.submissions + 1,
      tyfcb: current.tyfcb + Number(submission.tyfcb || 0),
      latestStatus: isLatest ? (submission.status || "active") : current.latestStatus,
      latestSubmittedAt: Math.max(Number(current.latestSubmittedAt || 0), submittedAt),
    };
    return scores;
  }, {});
}

function BuddyGroupCard({ group, memberScores }) {
  const teamScore = group.members.reduce((total, member) => total + Number(memberScores[member.id]?.score || 0), 0);
  const teamSubmissions = group.members.reduce((total, member) => total + Number(memberScores[member.id]?.submissions || 0), 0);

  return (
    <article className="buddy-group-card">
      <div className="buddy-group-header">
        <div>
          <h3>{group.teamNo ? `Buddy Pair ${group.teamNo}` : "Unpaired"}</h3>
          <span>{group.members.length} member(s) · {teamSubmissions} submission(s)</span>
        </div>
        <strong>{teamScore} pts</strong>
      </div>
      <div className="buddy-member-list">
        {group.members.map((member) => (
          <BuddyMiniRow key={member.id} member={member} scoreSummary={memberScores[member.id]} />
        ))}
      </div>
    </article>
  );
}

function BuddyMiniRow({ member, scoreSummary }) {
  const statusText = memberGameStatus(scoreSummary);
  return (
    <div className="buddy-mini-row">
      <div>
        <strong>{member.full_name}</strong>
        <span>{statusText}</span>
      </div>
      <b>{scoreSummary?.score || 0} pts</b>
    </div>
  );
}

function memberGameStatus(scoreSummary) {
  if (!scoreSummary?.submissions) return "No submission 未提交";
  if (scoreSummary.latestStatus === "active") return "Submitted 已提交";
  return `${String(scoreSummary.latestStatus || "Submitted").replace(/^./, (char) => char.toUpperCase())} 已提交`;
}

function MemberAdminCard({ member, members, updateBuddy, compact = false, scoreSummary = null, onEdit }) {
  return (
    <article className={compact ? "member-list-card compact-member-card" : "member-list-card"}>
      <div>
        <strong>{member.full_name}</strong>
        <span>{member.email}</span>
        {member.phone && <span>{member.phone}</span>}
      </div>
      <dl>
        <div><dt>Company 公司</dt><dd>{member.company || "-"}</dd></div>
        <div><dt>Buddy pair 伙伴组</dt><dd>{member.buddy_teams?.team_no || "-"}</dd></div>
        <div><dt>Buddy partner 伙伴</dt><dd>{member.buddy?.full_name || "None"}</dd></div>
        {scoreSummary && <div><dt>Game input score 分数</dt><dd>{scoreSummary.score || 0} pts</dd></div>}
        {scoreSummary && <div><dt>Submissions 提交</dt><dd>{scoreSummary.submissions || 0}</dd></div>}
      </dl>
      <Label text="Link buddy member 绑定伙伴会员">
        <select value={member.buddy_member_id || ""} onChange={(e) => updateBuddy(member.id, e.target.value)}>
          <option value="">None</option>
          {members.filter((option) => option.id !== member.id).map((option) => <option key={option.id} value={option.id}>{option.full_name}</option>)}
        </select>
      </Label>
      {onEdit && <button className="ghost-button" type="button" onClick={onEdit}>Edit 编辑</button>}
    </article>
  );
}

function SubmissionReview({ demo = false, adminToken = "" }) {
  const [items, setItems] = useState([]);
  useEffect(() => {
    if (demo) {
      setItems(DEMO_SUBMISSIONS);
      return;
    }
    supabase.rpc("admin_submissions", { p_token: adminToken }).then(({ data }) => setItems(data || []));
  }, [demo, adminToken]);
  return (
    <div className="admin-content">
      <section className="panel">
        <div className="section-heading"><ClipboardCheck /><div><h2>All submissions 所有提交</h2><p>Full weekly game input list.</p></div></div>
        <SubmissionTable items={items} />
      </section>
    </div>
  );
}

function VerificationQueue({ kind, demo = false, adminToken = "" }) {
  const [items, setItems] = useState([]);
  const [reviewing, setReviewing] = useState(null);
  const statusField = `${kind}_status`;

  async function load() {
    if (demo) {
      const field = kind === "tyfcb" ? "tyfcb" : kind === "one_to_one" ? "one_to_one" : kind === "referral" ? "referrals" : kind === "visitor" ? "visitors" : "training";
      setItems(DEMO_SUBMISSIONS.filter((item) => Number(item[field]) > 0));
      return;
    }
    const { data } = await supabase.rpc("admin_verification_queue", { p_token: adminToken, p_kind: kind });
    setItems(data || []);
  }

  useEffect(() => { load(); }, [kind, adminToken]);

  async function setStatus(id, value) {
    if (demo) {
      setItems((current) => current.map((item) => item.id === id ? { ...item, [statusField]: value } : item));
      return;
    }
    await supabase.rpc("admin_update_submission", {
      p_token: adminToken,
      p_submission_id: id,
      p_field: statusField,
      p_value: value,
    });
    await load();
  }

  async function rejectWithReason(item, reason) {
    if (!item) return;
    if (demo) {
      setItems((current) => current.filter((row) => row.id !== item.id));
      return;
    }
    await supabase.rpc("admin_reject_submission", {
      p_token: adminToken,
      p_submission_id: item.id,
      p_field: statusField,
      p_reason: reason,
    });
    await fetch("/api/rejection-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: item.email,
        name: item.full_name,
        week: item.week_label,
        kind: FIELD_META[kind]?.label || kind,
        reason,
        origin: window.location.origin,
      }),
    }).catch(() => {});
    await load();
  }

  async function updateVisitorJoined(id, value) {
    const nextValue = Math.max(0, Math.min(20, Number(value) || 0));
    if (demo) {
      setItems((current) => current.map((item) => item.id === id ? { ...item, visitor_joined: nextValue } : item));
      return;
    }
    await supabase.rpc("admin_update_visitor_joined", { p_token: adminToken, p_submission_id: id, p_value: nextValue });
    await load();
  }

  return (
    <div className="admin-content">
      <section className="panel">
        <div className="section-heading"><Eye /><div><h2>{FIELD_META[kind]?.label || kind} verification 审核</h2><p>Approve or reject proof photos.</p></div></div>
        <div className="review-list">
          {items.map((item) => (
            <ReviewCard key={item.id} item={item} kind={kind} statusField={statusField} onReview={() => setReviewing(item)} />
          ))}
        </div>
      </section>
      {reviewing && (
        <ReviewModal
          item={reviewing}
          kind={kind}
          statusField={statusField}
          onClose={() => setReviewing(null)}
          onApprove={setStatus}
          onReject={rejectWithReason}
          onVisitorJoined={updateVisitorJoined}
        />
      )}
    </div>
  );
}

function ReviewModal({ item, kind, statusField, onClose, onApprove, onReject, onVisitorJoined }) {
  const evidence = (item.evidence || []).filter((row) => row.kind === kind);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [confirmAction, setConfirmAction] = useState("");
  const [busy, setBusy] = useState(false);
  const [visitorJoined, setVisitorJoined] = useState(item.visitor_joined || 0);

  function requestReject() {
    if (reason.trim().length < 3) {
      setError("Please enter a clear rejection reason. 请输入拒绝原因。");
      return;
    }
    setError("");
    setConfirmAction("reject");
  }

  async function confirmDecision() {
    setBusy(true);
    if (confirmAction === "approve") {
      await onApprove(item.id, "approved");
    }
    if (confirmAction === "reject") {
      await onReject(item, reason.trim());
    }
    setBusy(false);
    onClose();
  }

  return createPortal(
    <div className="detail-backdrop" role="dialog" aria-modal="true">
      <section className="detail-panel review-modal">
        <button className="icon-button detail-close" type="button" onClick={onClose} aria-label="Close review">
          <X />
        </button>
        <p>Review submission 审核提交</p>
        <h2>{item.full_name}</h2>
        <span>{item.week_label}</span>
        <dl>
          <div><dt>Buddy 伙伴组</dt><dd>{item.team_no || "-"}</dd></div>
          <div><dt>Status 状态</dt><dd>{item[statusField]}</dd></div>
          <div><dt>{FIELD_META[kind]?.label || kind}</dt><dd>{verificationValue(item, kind)}</dd></div>
        </dl>
        {kind === "visitor" && (
          <Label text="访客加入 Visitor joined">
            <input
              type="number"
              min="0"
              max="20"
              value={visitorJoined}
              onChange={(event) => {
                setVisitorJoined(event.target.value);
                onVisitorJoined(item.id, event.target.value);
              }}
            />
          </Label>
        )}
        <div className="proof-links">
          {evidence.map((file) => <EvidenceLink file={file} key={file.id} />)}
          {evidence.length === 0 && <span>Optional proof not uploaded</span>}
        </div>
        <Label text="Reject reason 给会员的拒绝原因">
          <textarea value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Example: Proof photo is unclear or does not match this week." />
        </Label>
        {error && <p className="error">{error}</p>}
        {confirmAction && (
          <div className={confirmAction === "approve" ? "confirm-box approve" : "confirm-box reject"}>
            <strong>{confirmAction === "approve" ? "Confirm approve? 确认批准？" : "Confirm reject? 确认拒绝？"}</strong>
            <span>{confirmAction === "approve" ? "This will approve this game input and affect the score." : "This will reject the input and email the reason to the member."}</span>
          </div>
        )}
        <div className="button-row">
          {confirmAction ? (
            <>
              <button className="ghost-button" type="button" onClick={() => setConfirmAction("")}>Back 返回</button>
              <button className={confirmAction === "approve" ? "primary-button" : "danger-button"} type="button" disabled={busy} onClick={confirmDecision}>
                {busy ? <Loader2 className="spin" /> : confirmAction === "approve" ? <CheckCircle2 /> : <XCircle />}
                {confirmAction === "approve" ? "Confirm approve 确认批准" : "Confirm reject 确认拒绝"}
              </button>
            </>
          ) : (
            <>
              <button className="danger-button" type="button" onClick={requestReject}><XCircle /> Reject 拒绝</button>
              <button className="primary-button" type="button" onClick={() => setConfirmAction("approve")}><CheckCircle2 /> Approve 批准</button>
            </>
          )}
        </div>
      </section>
    </div>,
    document.body
  );
}

function verificationValue(item, kind) {
  if (kind === "tyfcb") return money(item.tyfcb);
  if (kind === "referral") return item.referrals || 0;
  if (kind === "visitor") return item.visitors || 0;
  return item[kind] || 0;
}

function ReviewCard({ item, kind, statusField, onReview }) {
  const evidence = (item.evidence || []).filter((row) => row.kind === kind);
  return (
    <article className="review-card">
      <div>
        <strong>{item.full_name}</strong>
        <span>{item.week_label} · Buddy {item.team_no || "-"}</span>
        <small>Status: {item[statusField]}</small>
      </div>
      <div className="proof-links">
        {evidence.map((file) => <EvidenceLink file={file} key={file.id} />)}
        {evidence.length === 0 && <span>Optional proof not uploaded</span>}
      </div>
      <div className="verify-actions">
        <button type="button" onClick={onReview}><Eye /> Review 审核</button>
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
    supabase.storage.from(EVIDENCE_BUCKET).createSignedUrl(file.file_path, 3600).then(({ data }) => setUrl(data?.signedUrl || ""));
  }, [file.file_path]);
  if (file.file_path?.startsWith("demo/")) return <span><FileImage /> {file.file_name || "Demo proof"}</span>;
  return url ? <a href={url} target="_blank" rel="noreferrer"><FileImage /> {file.file_name || "Open proof"}</a> : <span>Loading proof...</span>;
}

function AttendanceList({ demo = false, adminToken = "" }) {
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
    const { data } = await supabase.rpc("admin_attendance_snapshot", {
      p_token: adminToken,
      p_week_id: selectedWeekId,
    });
    setWeeks(data?.weeks?.length ? data.weeks : WEEKS);
    setMembers(data?.members || []);
    setAttendanceIds(data?.attendance || []);
  }

  useEffect(() => { load(); }, [demo, selectedWeekId, adminToken]);

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
    await supabase.rpc("admin_save_attendance", {
      p_token: adminToken,
      p_week_id: Number(selectedWeekId),
      p_member_ids: draftIds,
    });
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
            <tr><th>Member</th><th>Week</th><th>Status</th><th>Buddy</th><th>1-2-1</th><th>Training</th><th>Referral</th><th>TYFCB</th><th>Visitor</th><th>Score</th></tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="clickable-row" onClick={() => setSelected(item)}>
                <td>{item.full_name}</td>
                <td>{item.week_label}</td>
                <td>{submissionReviewStatus(item)}</td>
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
              <span>{item.week_label} · {submissionReviewStatus(item)}</span>
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

function submissionReviewStatus(item) {
  if (item.status === "archived") return "Archived";
  const submittedStatuses = [
    Number(item.one_to_one || 0) > 0 ? item.one_to_one_status : null,
    Number(item.training || 0) > 0 ? item.training_status : null,
    Number(item.referrals || 0) > 0 ? item.referral_status : null,
    Number(item.tyfcb || 0) > 0 ? item.tyfcb_status : null,
    Number(item.visitors || 0) > 0 ? item.visitor_status : null,
  ].filter(Boolean);
  if (submittedStatuses.some((status) => status === "rejected")) return "Rejected";
  if (submittedStatuses.length > 0 && submittedStatuses.every((status) => status === "approved")) return "Approved";
  return "Submitted";
}

function SubmissionDetail({ item, onClose }) {
  return createPortal(
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
          <div><dt>Status 状态</dt><dd>{submissionReviewStatus(item)}</dd></div>
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
    </div>,
    document.body
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
