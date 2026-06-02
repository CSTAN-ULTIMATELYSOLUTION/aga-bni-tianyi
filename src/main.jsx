import React, { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Link, Navigate, Route, Routes, useLocation, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
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
  Trash2,
  Upload,
  UserRound,
  UsersRound,
  X,
  XCircle,
} from "lucide-react";
import { EVIDENCE_BUCKET, supabase } from "./lib/supabase";
import {
  DEMO_BOARD,
  DEMO_MEMBER,
  DEMO_MEMBERS,
  DEMO_SUBMISSIONS,
  FIELD_META,
  WEEKS,
  ADMIN_EMAILS,
  EVIDENCE_ACCEPT,
  MAX_EVIDENCE_BYTES,
  activeSubmission,
  calcScore,
  canSubmitWeek,
  currentSubmissionWeeks,
  money,
  normalizeEmail,
  tierPoints,
  validateEvidenceFile,
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
const ADMIN_TOKEN_KEY = "tianyi-admin-token";
const MEMBER_ACCESS_KEY = "tianyi-member-access";
const AGA_AD_DISMISSED_KEY = "aga-ad-dismissed";
const AGA_WEBSITE_URL = "https://agaventures.ai";
const TYFCB_GOAL = 7000000;
const REVIEWER_OPTIONS = ["PeiXuan", "Krision", "Alicia"];

function todayLabel() {
  return new Date().toLocaleDateString("en-MY", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function weekCountdownParts(now = new Date()) {
  const nextOrCurrent = WEEKS.find((week) => now.getTime() <= new Date(`${week.ends_on}T23:59:59`).getTime());

  if (!nextOrCurrent) {
    return {
      week: null,
      mode: "ended",
      parts: { days: "00", hours: "00", minutes: "00", seconds: "00" },
    };
  }

  const start = new Date(`${nextOrCurrent.starts_on}T00:00:00`);
  const end = new Date(`${nextOrCurrent.ends_on}T23:59:59`);
  const target = now.getTime() < start.getTime() ? start : end;
  const diff = Math.max(0, target.getTime() - now.getTime());
  const dayMs = 24 * 60 * 60 * 1000;
  const hourMs = 60 * 60 * 1000;
  const minuteMs = 60 * 1000;
  const days = Math.floor(diff / dayMs);
  const hours = Math.floor((diff % dayMs) / hourMs);
  const minutes = Math.floor((diff % hourMs) / minuteMs);
  const seconds = Math.floor((diff % minuteMs) / 1000);
  const pad = (value) => String(value).padStart(2, "0");

  return {
    week: nextOrCurrent,
    mode: now.getTime() < start.getTime() ? "starts" : "ends",
    parts: {
      days: pad(days),
      hours: pad(hours),
      minutes: pad(minutes),
      seconds: pad(seconds),
    },
  };
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
      <SponsorCTA />
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
          <a key={`${item}-${index}`} href={AGA_WEBSITE_URL} target="_blank" rel="noreferrer">{item}</a>
        ))}
      </div>
    </section>
  );
}

function SponsorCTA() {
  return (
    <section className="sponsor-cta" aria-label="AGA Ventures sponsor">
      <div className="sponsor-mark">AGA</div>
      <div>
        <span>Sponsored and built by AGA Ventures Sdn Bhd</span>
        <strong>Build a system like Tian Yi OneSystem</strong>
        <p>Business portals · CRM dashboards · Automation workflows · AI websites</p>
      </div>
      <a href={AGA_WEBSITE_URL} target="_blank" rel="noreferrer">
        Visit AGA Ventures
        <ChevronRight />
      </a>
    </section>
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
      <HeroHeader eyebrow="Internal BNI Tian Yi" title="TIAN YI OneSystem" sub="会员每周提交入口、游戏规则与伙伴组排行榜。Weekly submission access, game rules, and buddy ranking." />
      <section className="game-layout">
        <div className="game-main-stack">
          <div className="panel stack">
            <div className="section-heading">
              <Medal />
              <div>
                <h2>游戏规则 Game Rules</h2>
                <p>分数以会员每周提交为基础，并在管理员审核通过后计入排行榜。Points count only after weekly submissions are reviewed and approved by admin.</p>
              </div>
            </div>
            <div className="score-rule-list">
              <div>
                <strong>1-2-1 <small>一对一</small></strong>
                <span>每次 1 分，每周最多 2 分，需上传照片。<br />1 point each, max 2 per week. Photo required.</span>
              </div>
              <div>
                <strong>Training <small>培训</small></strong>
                <span>每次 5 分，每月最多 2 次，需上传证明。<br />5 points each, max 2 per month. Proof required.</span>
              </div>
              <div>
                <strong>Referral <small>引荐</small></strong>
                <span>每个有效引荐 5 分，需截屏 BNI App，截图需显示 3 个 mark 或以上。<br />5 points each. BNI App screenshot required with 3 marks and above.</span>
              </div>
              <div>
                <strong>TYFCB <small>引荐成交额</small></strong>
                <span>
                  RM100-999: 1 分；RM1k-9,999: 3 分；RM10k-19,999: 6 分；RM20k-29,999: 9 分；RM30k 以上: 12 分。需上传 TYFC 证明。
                  <br />
                  Tiered by amount. TYFC proof required.
                </span>
              </div>
              <div>
                <strong>Visitor <small>访客</small></strong>
                <span>每位访客 10 分，需上传照片；线下 Visitor 必须有 LVH/VH 在场。成功加入额外 25 分，由管理员加分。<br />10 points per visitor. Photo required. Offline Visitor must have LVH/VH present. +25 points if joined, admin confirmed.</span>
              </div>
            </div>
            <div className="score-extra-note">
              <strong>团队加分计算 <small>Team Bonus Calculation</small></strong>
              <p>团队加分只计入伙伴组排行榜，不计入个人提交分数。Month 1: Week 1-4 · Month 2: Week 5-end.</p>
              <div className="team-bonus-rule-list">
                <div>
                  <span>每月一次：伙伴两人当月都完成五项并通过审核<br />Monthly: both buddies complete all five approved sections</span>
                  <b>+3 pts</b>
                </div>
                <div>
                  <span>每月一次：伙伴组当月累计 2 位 Visitor<br />Monthly: buddy team reaches 2 approved Visitors</span>
                  <b>+5 pts</b>
                </div>
                <div>
                  <span>每月一次：伙伴组当月累计 4 位或以上 Visitor，团队只拿 +10，不再另外拿 +5<br />Monthly: 4+ approved Visitors earns +10 only, no extra +5</span>
                  <b>+10 pts</b>
                </div>
                <div>
                  <span>每 2 个星期：一位伙伴 Referral、Visitor、TYFCB 都为 0；另一位有 1 Visitor 或 3 Referral<br />2-week rescue: one buddy empty, the other carries Visitor or Referrals</span>
                  <b>+5 pts</b>
                </div>
              </div>
            </div>
            <Link className="primary-link" to="/game/weeklyupdate">
              <Upload /> 提交每周记录 Submit weekly update
            </Link>
          </div>
          <TopFiveAwardCard />
        </div>
        <GameLeaderboard />
      </section>
    </Shell>
  );
}

function TopFiveAwardCard() {
  return (
    <section className="top-award-card">
      <div>
        <Award />
        <span>Top 5 Winner Award 前五名奖励</span>
      </div>
      <h2>前五名伙伴组 Top 5 Buddy Pairs</h2>
      <p>活动结束时，排行榜前五名伙伴组将获得优胜奖励。At the end of the campaign, the top 5 buddy pairs qualify for the winner award.</p>
      <div className="award-prize-row">
        <strong>TOP 5</strong>
        <span>以伙伴组总分排名 Ranked by combined buddy score</span>
      </div>
    </section>
  );
}

function GameLeaderboard() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    setError("");
    supabase.rpc("team_leaderboard")
      .then(({ data, error }) => {
        if (error) {
          console.warn("[leaderboard] real data unavailable", error);
          setError("Unable to load real leaderboard data. 无法加载真实排行榜数据。");
          setRows([]);
          return;
        }
        setRows(data?.length ? data : []);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <section className="panel stack">
      <div className="section-heading">
        <BarChart3 />
        <div>
          <h2>伙伴组排名 Buddy Ranking</h2>
          <p>排行榜以两人伙伴组总分计算，不以个人排名。Leaderboard is ranked by combined buddy-pair score.</p>
        </div>
      </div>
      <div className="leaderboard">
        {loading && <p className="muted">Loading leaderboard...</p>}
        {!loading && error && <p className="error">{error}</p>}
        {!loading && rows.length === 0 && <p className="muted">No leaderboard data yet. 暂无排行榜数据。</p>}
        {rows.slice(0, 10).map((team, index) => {
          const isPremium = index < 5;
          const isCompact = index >= 5;
          const memberScore = Number(team.member_score ?? team.total_score ?? team.score ?? 0);
          const teamBonusPoints = Number(team.team_bonus_points || 0);
          const totalScore = Number(team.total_score || team.score || 0);
          const bonusAwards = Array.isArray(team.team_bonus_awards) ? team.team_bonus_awards : [];
          const teamName = team.team_name || team.name || `Team ${team.team_no}`;
          const memberNames = Array.isArray(team.members) && team.members.length ? team.members.join(" + ") : `${team.member_a_name || team.member_one || "会员 A Member A"} + ${team.member_b_name || team.member_two || "会员 B Member B"}`;
          return (
          <div className={`${isPremium ? "leader-row premium-leader" : "leader-row"} ${isCompact ? "compact-leader" : ""}`} key={team.team_id || team.team_no || team.name}>
            <div>
              <span className="leader-rank">#{index + 1}</span>
              <strong>{teamName}</strong>
              {isCompact && <span className="compact-member-names">{memberNames}</span>}
              {!isCompact && <span className="leader-member-names">{memberNames}</span>}
              {!isCompact && <span className="leader-score-breakdown">Member {memberScore} · Team bonus +{teamBonusPoints} · Final {totalScore}</span>}
              {!isCompact && bonusAwards.length > 0 && (
                <span className="leader-bonus-awards">
                  {bonusAwards.map((award) => `${teamBonusShortLabel(award.bonus_type)} ${teamBonusPeriodLabel(award.period_key)} +${award.points}`).join(" · ")}
                </span>
              )}
            </div>
            <b>{totalScore} pts</b>
          </div>
          );
        })}
      </div>
    </section>
  );
}

function WeeklyUpdatePage() {
  const [session, setSession] = useState(null);
  const [member, setMember] = useState(null);
  const [checkedAccess, setCheckedAccess] = useState(() => loadStoredMemberAccess());
  const [demoMember] = useState(() => isLocalPreview() && sessionStorage.getItem("tianyi-demo-member") === "1");
  const [loading, setLoading] = useState(true);

  const handleVerifiedAccess = (access) => {
    storeMemberAccess(access);
    setCheckedAccess(access);
  };

  const clearVerifiedAccess = () => {
    sessionStorage.removeItem(MEMBER_ACCESS_KEY);
    setCheckedAccess(null);
  };

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
        <GameRouteBackLink />
        <WeekCountdownCard />
        <WeeklyDesk member={DEMO_MEMBER} demo />
      </Shell>
    );
  }

  return (
    <Shell>
      <HeroHeader />
      <GameRouteBackLink />
      <WeekCountdownCard />
      {checkedAccess ? (
        <WeeklyDesk
          member={checkedAccess.member}
          initialWeek={checkedAccess.week}
          verifiedEmail={checkedAccess.email}
          onExit={clearVerifiedAccess}
        />
      ) : !session || !member ? (
        <MemberCheckLogin onVerified={handleVerifiedAccess} />
      ) : (
        <WeeklyDesk member={member} />
      )}
    </Shell>
  );
}

function GameRouteBackLink() {
  return (
    <Link className="game-route-back-link" to="/game">
      <ArrowLeft />
      <span>Back to Game 返回游戏规则</span>
    </Link>
  );
}

function loadStoredMemberAccess() {
  try {
    const raw = sessionStorage.getItem(MEMBER_ACCESS_KEY);
    if (!raw) return null;
    const access = JSON.parse(raw);
    if (!access?.member?.id || !access?.email || !access?.week?.id) return null;
    return access;
  } catch {
    sessionStorage.removeItem(MEMBER_ACCESS_KEY);
    return null;
  }
}

function storeMemberAccess(access) {
  if (!access?.member?.id || !access?.email || !access?.week?.id) return;
  sessionStorage.setItem(MEMBER_ACCESS_KEY, JSON.stringify(access));
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
          <h1>{title}<sup className="tm-mark">TM</sup></h1>
        </div>
      </div>
      <div className="hero-copy">
        <p>{sub}</p>
      </div>
    </header>
  );
}

function WeekCountdownCard() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const countdown = weekCountdownParts(now);

  if (!countdown.week) {
    return (
      <section className="week-countdown-card">
        <p>Game countdown 活动倒数</p>
        <h2>Game period ended 活动周期已结束</h2>
      </section>
    );
  }

  const actionLabel = countdown.mode === "starts" ? "starts in 即将开始" : "ends in 剩余时间";
  const units = [
    ["days", "Days 天"],
    ["hours", "Hours 时"],
    ["minutes", "Min 分"],
    ["seconds", "Sec 秒"],
  ];

  return (
    <section className="week-countdown-card">
      <div className="countdown-topline">
        <p>Game countdown 活动倒数</p>
        <span className="today-pill">Today {todayLabel()}</span>
      </div>
      <div className="countdown-title">
        <h2>{countdown.week.label}</h2>
        <span>{actionLabel}</span>
      </div>
      <div className="countdown-grid" aria-label={`${countdown.week.label} ${actionLabel}`}>
        {units.map(([key, label]) => (
          <div key={key}>
            <strong>{countdown.parts[key]}</strong>
            <small>{label}</small>
          </div>
        ))}
      </div>
    </section>
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
          <h2>Step 1: Find your member record 第一步：查找会员资料</h2>
          <p>Select the week, choose your name, and enter your registered email to start.</p>
        </div>
      </div>

      <form onSubmit={checkMemberPair} className="stack">
        <div className="week-entry-note">
          <strong>Week entry limit 周次填写限制</strong>
          <span>Only this week and last week can be submitted. 只允许填写本周和上周的记录。</span>
        </div>
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
          <small className="field-remark">If you do not have a registered email, please contact CGC Admin. 如果没有注册电邮，请联系 CGC Admin。</small>
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
  const [teamTotalPoints, setTeamTotalPoints] = useState(0);
  const [selectedWeek, setSelectedWeek] = useState(null);
  const [loading, setLoading] = useState(true);
  const memberId = member.id || member.member_id;

  async function load() {
    setLoading(true);
    if (demo) {
      setWeeks(currentSubmissionWeeks());
      setSubmissions(DEMO_SUBMISSIONS.filter((item) => item.member_id === member.id));
      const demoTeam = DEMO_BOARD.find((team) => Number(team.team_no) === Number(member.team_no || member.buddy_teams?.team_no || 7));
      setTeamTotalPoints(Number(demoTeam?.total_score || 0));
      setLoading(false);
      return;
    }
    const available = currentSubmissionWeeks();
    const historyRequest = verifiedEmail
      ? supabase.rpc("member_submission_history", { p_member_id: memberId, p_email: verifiedEmail })
      : supabase.from("submission_details").select("*").eq("member_id", memberId).order("submitted_at", { ascending: false });
    const [{ data: dbWeeks }, { data: subs }, { data: leaderboard }] = await Promise.all([
      supabase.from("weeks").select("*").in("id", available.map((week) => week.id)).order("id", { ascending: false }),
      historyRequest,
      supabase.rpc("team_leaderboard"),
    ]);
    setWeeks(dbWeeks?.length ? dbWeeks : available);
    setSubmissions(subs || []);
    const memberTeamNo = Number(member.team_no || member.buddy_teams?.team_no || 0);
    const memberTeamId = member.buddy_team_id || member.team_id || "";
    const teamRow = (leaderboard || []).find((team) =>
      (memberTeamId && String(team.team_id) === String(memberTeamId)) ||
      (memberTeamNo && Number(team.team_no) === memberTeamNo)
    );
    setTeamTotalPoints(Number(teamRow?.total_score || 0));
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
          teamTotalPoints={teamTotalPoints}
          onStart={() => setSelectedWeek(initialWeek)}
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
              const editable = submitted && isWeekEditableWindow(week);
              return (
                <button key={week.id} className="week-card" disabled={submitted && !editable && !demo} onClick={() => setSelectedWeek(week)}>
                  <div>
                    <strong>{week.label}</strong>
                    <span>{submitted && editable ? "可编辑 Editable" : submitted && !demo ? "已锁定 Locked" : "可提交 Open"}</span>
                  </div>
                  {submitted ? <CheckCircle2 /> : <ChevronRight />}
                </button>
              );
            })}
          </div>
          <SubmissionHistory submissions={submissions} />
        </>
      ) : (
        <WeeklyForm
          member={member}
          week={selectedWeek}
          existingSubmission={activeSubmission(submissions).find((item) => Number(item.week_id) === Number(selectedWeek.id))}
          submissions={submissions}
          teamTotalPoints={teamTotalPoints}
          verifiedEmail={verifiedEmail}
          onCancel={() => setSelectedWeek(null)}
          onSubmitted={load}
          demo={demo}
        />
      )}
    </section>
  );
}

function WeeklyPreSubmitScreen({ week, submissions, teamTotalPoints = 0, onStart, demo = false }) {
  const existingSubmission = activeSubmission(submissions).find((item) => Number(item.week_id) === Number(week.id));
  const existingEditable = Boolean(existingSubmission && isWeekEditableWindow(week));
  const existingLocked = Boolean(existingSubmission && !existingEditable && !demo);
  const existingStatus = existingSubmission ? submissionReviewStatus(existingSubmission) : "Open";
  const isApproved = existingStatus === "Approved";
  const memberPoints = activeSubmission(submissions).reduce((total, item) => total + Number(item.score || 0), 0);
  const pairPoints = Math.max(Number(teamTotalPoints || 0), memberPoints);
  const buddyPoints = Math.max(pairPoints - memberPoints, 0);
  const partnerReminder = buddyPoints > 0
    ? "Your buddy partner has record too. 伙伴也已有记录。"
    : "Please remind your buddy partner to submit too. 也请提醒你的伙伴提交。";

  return (
    <>
      <section className="panel pre-submit-panel">
        <div className="section-heading">
          {existingLocked ? <XCircle /> : <CheckCircle2 />}
          <div>
            <h2>Review before submit 提交前确认</h2>
            <p>{week.label}</p>
          </div>
        </div>

        <div className="member-score-mini">
          <div>
            <span>Your points 你的分数</span>
            <strong>{memberPoints}</strong>
          </div>
          <div>
            <span>Buddy points 伙伴分数</span>
            <strong>{buddyPoints}</strong>
          </div>
          <div>
            <span>Total points 总分</span>
            <strong>{pairPoints}</strong>
          </div>
        </div>

        {existingLocked ? (
          <div className="submission-lock">
            <strong>This week is locked 本周已锁定</strong>
            <span>This record can no longer be edited after the week closes.</span>
            <Link to={`/game/submission/${existingSubmission.id}`} className="primary-link">
              <Eye />
              View submission 查看提交
            </Link>
          </div>
        ) : isApproved ? (
          <div className="submission-ready great">
            <strong>You are Great! 你很棒！</strong>
            <span>Your submission is approved and your score has been recorded. {partnerReminder}</span>
            <Link to={`/game/submission/${existingSubmission.id}`} className="primary-link">
              <Eye />
              View approved record 查看已批准记录
            </Link>
          </div>
        ) : existingSubmission ? (
          <div className="submission-ready review">
            <strong>Already submitted, under review 已提交，审核中</strong>
            <span>Your score will be recorded after admin approval. {partnerReminder}</span>
            <button type="button" className="primary-button" disabled>
              <ClipboardCheck />
              Submitted, waiting review 已提交，等待审核
            </button>
            <Link to={`/game/submission/${existingSubmission.id}`} className="ghost-button">
              <Eye />
              View submission 查看提交
            </Link>
          </div>
        ) : (
          <div className="submission-ready">
            <strong>Please input this week 请填写本周记录</strong>
            <span>No submission has been found for this week. {partnerReminder}</span>
            <button type="button" className="primary-button" onClick={onStart}>
              <ClipboardCheck />
              Start weekly update 开始填写
            </button>
          </div>
        )}
      </section>
      <SubmissionHistory submissions={submissions} currentWeek={week} onEditCurrent={onStart} />
    </>
  );
}

function WeeklyForm({ member, week, existingSubmission = null, submissions = [], teamTotalPoints = 0, verifiedEmail = "", onCancel, onSubmitted, demo = false }) {
  const navigate = useNavigate();
  const [zeroConfirm, setZeroConfirm] = useState(null);
  const [existingEvidenceRows, setExistingEvidenceRows] = useState(() => (
    Array.isArray(existingSubmission?.evidence) ? existingSubmission.evidence : []
  ));
  const existingEvidenceFor = (kind) => existingEvidenceRows.filter((file) => file.kind === kind);
  const [form, setForm] = useState(() => ({
    one_to_one: Number(existingSubmission?.one_to_one || 0),
    training: Number(existingSubmission?.training || 0),
    referrals: Number(existingSubmission?.referrals || 0),
    visitors: Number(existingSubmission?.visitors || 0),
  }));
  const [tyfcbRows, setTyfcbRows] = useState(() => (
    existingSubmission?.tyfcb
      ? [{ id: "tyfcb-1", amount: String(existingSubmission.tyfcb), files: [], existingEvidence: existingEvidenceFor("tyfcb") }]
      : []
  ));
  const [files, setFiles] = useState({});
  const [busy, setBusy] = useState(false);
  const [deletingEvidenceId, setDeletingEvidenceId] = useState("");
  const [error, setError] = useState("");

  const tyfcbTotal = tyfcbRows.reduce((total, row) => total + (Number(row.amount) || 0), 0);
  const score = calcScore({ ...form, tyfcb: tyfcbTotal });
  const evidenceKinds = Object.keys(FIELD_META);
  const requiredEvidenceKinds = evidenceKinds.filter((kind) => {
    if (kind === "tyfcb") return false;
    if (kind === "referral") return Number(form.referrals) > 0;
    if (kind === "visitor") return Number(form.visitors) > 0;
    return Number(form[kind]) > 0;
  });
  const storedEvidenceFor = (kind) => existingEvidenceFor(kind).filter((file) => Boolean(file.file_path));
  const hasValidSelectedProof = (kind) => Array.from(files[kind] || []).some((file) => validateEvidenceFile(file).valid);
  const hasProof = (kind) => hasValidSelectedProof(kind) || storedEvidenceFor(kind).length > 0;

  function proofLabel(kind, index = null) {
    const base = FIELD_META[kind]?.label || kind;
    return kind === "tyfcb" && index !== null ? `${base} record ${index + 1}` : base;
  }

  function logProofFile(section, file, validation, extra = {}) {
    console.info("[weekly proof file]", {
      section,
      fileName: file?.name,
      fileType: file?.type || "",
      fileSize: file?.size || 0,
      validation,
      ...extra,
    });
  }

  function validateSelectedFiles(kind, fileList, index = null) {
    const section = proofLabel(kind, index);
    const validFiles = [];
    let firstError = "";
    for (const file of Array.from(fileList || [])) {
      const validation = validateEvidenceFile(file, MAX_EVIDENCE_BYTES);
      logProofFile(section, file, validation);
      if (validation.valid) {
        validFiles.push(file);
      } else if (!firstError) {
        firstError = `${section}: ${validation.message}`;
      }
    }
    if (firstError) setError(firstError);
    return validFiles;
  }

  function validateAllSelectedFiles() {
    const sectionFiles = evidenceKinds.flatMap((kind) => (
      Array.from(files[kind] || []).map((file) => ({ kind, file, section: proofLabel(kind) }))
    ));
    const tyfcbFilesWithLabels = tyfcbRows.flatMap((row, rowIndex) => (
      Array.from(row.files || []).map((file) => ({ kind: "tyfcb", file, section: proofLabel("tyfcb", rowIndex) }))
    ));
    for (const item of [...sectionFiles, ...tyfcbFilesWithLabels]) {
      const validation = validateEvidenceFile(item.file, MAX_EVIDENCE_BYTES);
      logProofFile(item.section, item.file, validation, { stage: "submit-validation" });
      if (!validation.valid) return `${item.section}: ${validation.message}`;
    }
    return "";
  }

  async function cleanupUploadedEvidence(rows) {
    const paths = rows.map((row) => row.file_path).filter(Boolean);
    if (!paths.length) return;
    const { error: cleanupError } = await supabase.storage.from(EVIDENCE_BUCKET).remove(paths);
    if (cleanupError) {
      console.warn("[weekly proof cleanup failed]", { paths, error: cleanupError });
    }
  }

  async function uploadEvidenceFile({ file, kind, section, path, fileName }) {
    const validation = validateEvidenceFile(file, MAX_EVIDENCE_BYTES);
    logProofFile(section, file, validation, { stage: "before-upload", path });
    if (!validation.valid) throw new Error(`${section}: ${validation.message}`);

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(EVIDENCE_BUCKET)
      .upload(path, file, { contentType: validation.mimeType, upsert: false });
    const { data: publicData } = supabase.storage.from(EVIDENCE_BUCKET).getPublicUrl(path);
    const { data: signedData, error: signedUrlError } = await supabase.storage.from(EVIDENCE_BUCKET).createSignedUrl(path, 3600);

    console.info("[weekly proof upload result]", {
      section,
      kind,
      path,
      fileName,
      uploadData,
      uploadError,
      publicUrl: publicData?.publicUrl || "",
      signedUrl: signedData?.signedUrl || "",
      signedUrlError,
    });

    if (uploadError) throw new Error(`${section}: Upload failed - ${uploadError.message}`);
    if (signedUrlError || !signedData?.signedUrl) {
      await supabase.storage.from(EVIDENCE_BUCKET).remove([path]);
      throw new Error(`${section}: Upload succeeded but proof image URL could not be created.`);
    }
    return { kind, file_path: path, file_name: fileName, signed_url: signedData?.signedUrl || "" };
  }

  async function deleteExistingEvidence(file) {
    if (!file?.id || demo) return;
    setError("");
    setDeletingEvidenceId(file.id);
    if (file.file_path && !file.file_path.startsWith("demo/")) {
      const { error: storageDeleteError } = await supabase.storage.from(EVIDENCE_BUCKET).remove([file.file_path]);
      if (storageDeleteError) {
        setError(storageDeleteError.message || "Unable to delete proof image file. 无法删除证明照片文件。");
        setDeletingEvidenceId("");
        return;
      }
    }
    const { error: deleteError } = await supabase.rpc("delete_submission_evidence", {
      p_evidence_id: file.id,
      p_member_id: member.id || member.member_id,
      p_email: verifiedEmail || member.email,
    });
    if (deleteError) {
      setError(deleteError.message || "Unable to delete proof image. 无法删除证明照片。");
      setDeletingEvidenceId("");
      return;
    }
    setExistingEvidenceRows((current) => current.filter((item) => item.id !== file.id));
    setTyfcbRows((current) => current.map((row) => ({
      ...row,
      existingEvidence: (row.existingEvidence || []).filter((item) => item.id !== file.id),
    })));
    setDeletingEvidenceId("");
  }

  function updateActivityValue(kind, value) {
    setForm((current) => {
      if (kind === "referral") return { ...current, referrals: value };
      if (kind === "visitor") return { ...current, visitors: value };
      return { ...current, [kind]: value };
    });
  }

  function requestActivityValue(kind, value) {
    const nextValue = Number(value) || 0;
    const currentValue = kind === "referral" ? Number(form.referrals || 0) : Number(form[kind] || 0);
    const relatedFiles = existingEvidenceFor(kind);
    const selectedFiles = Array.from(files[kind] || []);
    if (nextValue === 0 && currentValue > 0 && (relatedFiles.length > 0 || selectedFiles.length > 0)) {
      setZeroConfirm({
        kind,
        value: nextValue,
        label: FIELD_META[kind]?.label || kind,
        files: relatedFiles,
        selectedCount: selectedFiles.length,
      });
      return;
    }
    updateActivityValue(kind, nextValue);
  }

  async function confirmZeroActivity() {
    if (!zeroConfirm) return;
    setError("");
    for (const file of zeroConfirm.files) {
      await deleteExistingEvidence(file);
    }
    setFiles((current) => ({ ...current, [zeroConfirm.kind]: null }));
    updateActivityValue(zeroConfirm.kind, zeroConfirm.value);
    setZeroConfirm(null);
  }

  async function submit(event) {
    event.preventDefault();
    setError("");
    if (demo) {
      setError("Preview mode only. Real submission requires member/email check. 预览模式不会提交。");
      return;
    }
    const invalidFileMessage = validateAllSelectedFiles();
    if (invalidFileMessage) {
      setError(invalidFileMessage);
      return;
    }
    const invalidTyfcbRow = tyfcbRows.find((row) => {
      const hasTyfcbProof = Array.from(row.files || []).some((file) => validateEvidenceFile(file).valid) || (row.existingEvidence || []).some((file) => Boolean(file.file_path));
      return (Number(row.amount) > 0 && !hasTyfcbProof) || (Number(row.amount) <= 0 && row.files?.length);
    });
    if (invalidTyfcbRow) {
      setError("Each TYFCB record needs both an amount and at least one proof image. 每一笔 TYFCB 都需要金额和证明照片。");
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
    const memberPoints = activeSubmission(submissions).reduce((total, item) => total + Number(item.score || 0), 0);
    const pairPoints = Math.max(Number(teamTotalPoints || 0), memberPoints);
    const buddyScore = Math.max(pairPoints - memberPoints, 0);
    const buddySubmitted = buddyScore > 0;
    const payload = {
      p_member_id: memberId,
      p_email: emailForCheck,
      p_week_id: week.id,
      p_one_to_one: Number(form.one_to_one) || 0,
      p_training: Number(form.training) || 0,
      p_referrals: Number(form.referrals) || 0,
      p_tyfcb: tyfcbTotal,
      p_visitors: Number(form.visitors) || 0,
    };
    const pendingEvidenceRows = [];
    try {
      for (const kind of evidenceKinds) {
        for (const file of Array.from(files[kind] || [])) {
          const safeName = file.name.replace(/[^a-z0-9._-]/gi, "-").toLowerCase();
          const path = `${memberId}/${week.id}/${kind}-${Date.now()}-${window.crypto.randomUUID()}-${safeName}`;
          pendingEvidenceRows.push(await uploadEvidenceFile({
            file,
            kind,
            section: proofLabel(kind),
            path,
            fileName: file.name,
          }));
        }
      }
      for (const [rowIndex, row] of tyfcbRows.entries()) {
        if (Number(row.amount) <= 0) continue;
        for (const file of Array.from(row.files || [])) {
          const safeName = file.name.replace(/[^a-z0-9._-]/gi, "-").toLowerCase();
          const path = `${memberId}/${week.id}/tyfcb-${rowIndex + 1}-${Date.now()}-${window.crypto.randomUUID()}-${safeName}`;
          pendingEvidenceRows.push(await uploadEvidenceFile({
            file,
            kind: "tyfcb",
            section: proofLabel("tyfcb", rowIndex),
            path,
            fileName: `${money(row.amount)} - ${file.name}`,
          }));
        }
      }
    } catch (uploadError) {
      await cleanupUploadedEvidence(pendingEvidenceRows);
      setError(uploadError.message || "Unable to upload proof image. 无法上传证明照片。");
      setBusy(false);
      return;
    }
    console.info("[weekly submit payload]", {
      payload,
      uploadedEvidence: pendingEvidenceRows.map((row) => ({
        kind: row.kind,
        file_path: row.file_path,
        file_name: row.file_name,
        signed_url: row.signed_url,
      })),
      existingEvidence: existingEvidenceRows.map((row) => ({
        kind: row.kind,
        file_path: row.file_path,
        file_name: row.file_name,
      })),
    });
    const { data, error: insertError } = await supabase.rpc("submit_weekly_update", payload);
    const submission = data?.[0];

    if (insertError || !submission) {
      await cleanupUploadedEvidence(pendingEvidenceRows);
      setError(insertError?.message?.includes("already submitted") ? "This week was already submitted. 本周已经提交。" : insertError?.message || "Unable to submit. 无法提交。");
      setBusy(false);
      return;
    }

    const linkedEvidencePaths = [];
    for (const row of pendingEvidenceRows) {
      const { error: evidenceError } = await supabase.rpc("add_submission_evidence", {
        p_submission_id: submission.id,
        p_member_id: memberId,
        p_email: emailForCheck,
        p_kind: row.kind,
        p_file_path: row.file_path,
        p_file_name: row.file_name,
      });
      if (evidenceError) {
        await cleanupUploadedEvidence(pendingEvidenceRows.filter((item) => !linkedEvidencePaths.includes(item.file_path)));
        setError(`${FIELD_META[row.kind]?.label || row.kind}: ${evidenceError.message}`);
        setBusy(false);
        return;
      }
      linkedEvidencePaths.push(row.file_path);
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
        reviewerOwner: member.reviewer_owner || "",
        buddyScore,
        buddySubmitted,
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

      <ActivitySection title="1-2-1" sub="1 pt each, max 2 每次1分" kind="one_to_one" showProof={Number(form.one_to_one) > 0} files={files} setFiles={setFiles} validateFiles={validateSelectedFiles} existingEvidence={existingEvidenceFor("one_to_one")} onDeleteEvidence={deleteExistingEvidence} deletingEvidenceId={deletingEvidenceId}>
        <ActivityStepper icon={<Handshake />} title="1-2-1" sub="1 pt each, max 2 每次1分" value={form.one_to_one} max={2} onChange={(value) => requestActivityValue("one_to_one", value)} />
      </ActivitySection>
      <ActivitySection title="Training 培训" sub="5 pts each 每次5分" kind="training" showProof={Number(form.training) > 0} files={files} setFiles={setFiles} validateFiles={validateSelectedFiles} existingEvidence={existingEvidenceFor("training")} onDeleteEvidence={deleteExistingEvidence} deletingEvidenceId={deletingEvidenceId}>
        <ActivityStepper title="Training 培训" sub="5 pts each 每次5分" value={form.training} max={50} onChange={(value) => requestActivityValue("training", value)} />
      </ActivitySection>
      <ActivitySection title="Referral 引荐" sub="5 pts each 每个5分" kind="referral" showProof={Number(form.referrals) > 0} files={files} setFiles={setFiles} validateFiles={validateSelectedFiles} existingEvidence={existingEvidenceFor("referral")} onDeleteEvidence={deleteExistingEvidence} deletingEvidenceId={deletingEvidenceId}>
        <ActivityStepper title="Referral 引荐" sub="5 pts each 每个5分" value={form.referrals} max={50} onChange={(value) => requestActivityValue("referral", value)} />
      </ActivitySection>
      <section className="activity-section">
        <div>
          <strong>TYFCB 引荐成交额</strong>
          <span>Each amount requires its own proof image 每笔金额需上传对应证明</span>
        </div>
        <TyfcbRecordList rows={tyfcbRows} onChange={setTyfcbRows} validateFiles={validateSelectedFiles} onDeleteEvidence={deleteExistingEvidence} deletingEvidenceId={deletingEvidenceId} />
      </section>
      <ActivitySection title="Visitor 访客" sub="10 pts each; offline visitor needs LVH/VH present 每位10分；线下需 LVH/VH 在场" kind="visitor" showProof={Number(form.visitors) > 0} files={files} setFiles={setFiles} validateFiles={validateSelectedFiles} existingEvidence={existingEvidenceFor("visitor")} onDeleteEvidence={deleteExistingEvidence} deletingEvidenceId={deletingEvidenceId}>
        <ActivityStepper title="Visitor 访客" sub="10 pts each 每位10分" value={form.visitors} max={50} onChange={(value) => requestActivityValue("visitor", value)} />
      </ActivitySection>

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
      {zeroConfirm && (
        <ZeroActivityConfirm
          item={zeroConfirm}
          busy={Boolean(deletingEvidenceId)}
          onCancel={() => setZeroConfirm(null)}
          onConfirm={confirmZeroActivity}
        />
      )}
    </form>
  );
}

function ZeroActivityConfirm({ item, busy, onCancel, onConfirm }) {
  const totalFiles = Number(item.files?.length || 0) + Number(item.selectedCount || 0);
  return createPortal(
    <div className="detail-backdrop" role="dialog" aria-modal="true">
      <section className="detail-panel proof-delete-warning">
        <button className="icon-button detail-close" type="button" onClick={onCancel} aria-label="Cancel proof delete warning">
          <X />
        </button>
        <p>Confirm change 确认更改</p>
        <h2>Set {item.label} to 0?</h2>
        <div className="confirm-box reject">
          <strong>This will delete {totalFiles} proof image(s). 这会删除 {totalFiles} 张证明照片。</strong>
          <span>If the activity is reduced to 0, the uploaded proof images for this section are no longer needed and will be removed.</span>
        </div>
        <div className="button-row">
          <button className="ghost-button" type="button" onClick={onCancel}>Cancel 取消</button>
          <button className="danger-button" type="button" disabled={busy} onClick={onConfirm}>
            {busy ? <Loader2 className="spin" /> : <Trash2 />}
            Confirm delete 确认删除
          </button>
        </div>
      </section>
    </div>,
    document.body
  );
}

function ActivitySection({ title, sub, kind, showProof, files, setFiles, validateFiles, existingEvidence = [], onDeleteEvidence, deletingEvidenceId = "", children }) {
  const selectedFiles = Array.from(files[kind] || []);
  const selectedCount = selectedFiles.length;
  const existingCount = existingEvidence.length;
  const proofCount = selectedCount + existingCount;
  const [previewFile, setPreviewFile] = useState(null);
  const inputId = `${kind}-proof-input`;
  const clearFiles = () => setFiles({ ...files, [kind]: null });
  const addFiles = (fileList) => {
    const uploadableFiles = validateFiles ? validateFiles(kind, fileList) : Array.from(fileList || []);
    const nextFiles = [...selectedFiles, ...uploadableFiles];
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
        <div className={proofCount ? "inline-proof ready" : "inline-proof"}>
          <div>
            <span className="proof-label">{FIELD_META[kind].label} proof image 证明照片</span>
            <input
              id={inputId}
              className="visually-hidden-file"
              key={`${kind}-${selectedCount}`}
              type="file"
              accept={EVIDENCE_ACCEPT}
              multiple
              onChange={(e) => addFiles(e.target.files)}
            />
            <label className="upload-file-button" htmlFor={inputId}>
              <Upload /> {proofCount ? "Add more images 继续上传" : "Upload file 上传照片"}
            </label>
          </div>
          <small>{proofCount ? `${proofCount} proof image(s) saved 已有证明照片` : "Required before submit 提交前必须上传"}</small>
          <ExistingProofList evidence={existingEvidence} onDelete={onDeleteEvidence} deletingEvidenceId={deletingEvidenceId} />
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

function ExistingProofList({ evidence = [], onDelete, deletingEvidenceId = "" }) {
  if (!evidence.length) return null;
  return (
    <div className="existing-proof-grid">
      {evidence.map((file) => (
        <ExistingProofCard
          file={file}
          key={file.id || file.file_path}
          onDelete={onDelete}
          deleting={deletingEvidenceId === file.id}
        />
      ))}
    </div>
  );
}

function ExistingProofCard({ file, onDelete, deleting = false }) {
  const [url, setUrl] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);

  useEffect(() => {
    if (!file.file_path || file.file_path.startsWith("demo/")) {
      setUrl("");
      return;
    }
    let mounted = true;
    supabase.storage
      .from(EVIDENCE_BUCKET)
      .createSignedUrl(file.file_path, 3600)
      .then(({ data }) => {
        if (mounted) setUrl(data?.signedUrl || "");
      });
    return () => {
      mounted = false;
    };
  }, [file.file_path]);

  if (file.file_path?.startsWith("demo/")) {
    return (
      <div className="existing-proof-card">
        <FileImage />
        <span>{file.file_name || "Saved proof image 已保存证明"}</span>
        <div className="existing-proof-actions">
          <button type="button" onClick={() => setPreviewOpen(true)}><Eye /> View 查看</button>
          {onDelete && <button type="button" onClick={() => onDelete(file)} disabled={deleting}><Trash2 /> Delete 删除</button>}
        </div>
        {previewOpen && <ExistingProofPreview file={file} url={url} onClose={() => setPreviewOpen(false)} />}
      </div>
    );
  }

  return (
    <div className="existing-proof-card">
      {url ? <img src={url} alt={file.file_name || "Saved proof image"} /> : <FileImage />}
      <span>{file.file_name || "Saved proof image 已保存证明"}</span>
      <div className="existing-proof-actions">
        <button type="button" onClick={() => setPreviewOpen(true)} disabled={!url}><Eye /> View 查看</button>
        {onDelete && <button type="button" onClick={() => onDelete(file)} disabled={deleting}><Trash2 /> {deleting ? "Deleting 删除中" : "Delete 删除"}</button>}
      </div>
      {previewOpen && <ExistingProofPreview file={file} url={url} onClose={() => setPreviewOpen(false)} />}
    </div>
  );
}

function ExistingProofPreview({ file, url, onClose }) {
  return createPortal(
    <div className="detail-backdrop" role="dialog" aria-modal="true">
      <section className="detail-panel proof-preview-modal">
        <button className="icon-button detail-close" type="button" onClick={onClose} aria-label="Close proof preview">
          <X />
        </button>
        <p>Saved proof image 已保存证明照片</p>
        <h2>{file.file_name || "Proof image"}</h2>
        {url ? <img src={url} alt={file.file_name || "Proof image"} /> : <FileImage />}
        <button className="primary-button" type="button" onClick={onClose}>
          Close 关闭
        </button>
      </section>
    </div>,
    document.body
  );
}

function TyfcbRecordList({ rows, onChange, validateFiles, onDeleteEvidence, deletingEvidenceId = "" }) {
  const [previewFile, setPreviewFile] = useState(null);
  const updateRow = (id, next) => onChange(rows.map((row) => row.id === id ? { ...row, ...next } : row));
  const addRow = () => onChange([...rows, { id: `tyfcb-${Date.now()}`, amount: "", files: [] }]);
  const removeRow = (id) => onChange(rows.filter((row) => row.id !== id));
  const addFiles = (id, fileList) => {
    const row = rows.find((item) => item.id === id);
    const rowIndex = rows.findIndex((item) => item.id === id);
    const uploadableFiles = validateFiles ? validateFiles("tyfcb", fileList, rowIndex) : Array.from(fileList || []);
    updateRow(id, { files: [...(row?.files || []), ...uploadableFiles] });
  };
  const removeFile = (id, indexToRemove) => {
    const row = rows.find((item) => item.id === id);
    updateRow(id, { files: (row?.files || []).filter((_file, index) => index !== indexToRemove) });
  };

  return (
    <div className="tyfcb-record-list">
      {rows.map((row, rowIndex) => {
        const selectedFiles = Array.from(row.files || []);
        const existingEvidence = Array.isArray(row.existingEvidence) ? row.existingEvidence : [];
        const proofCount = selectedFiles.length + existingEvidence.length;
        const ready = Number(row.amount) > 0 && proofCount > 0;
        const inputId = `${row.id}-proof-input`;
        return (
          <article className={ready ? "tyfcb-record ready" : "tyfcb-record"} key={row.id}>
            <div className="tyfcb-record-head">
              <strong>Record {rowIndex + 1} 记录{rowIndex + 1}</strong>
              <button type="button" onClick={() => removeRow(row.id)}>Remove 删除</button>
            </div>
            <Label text="Amount 金额">
              <input
                type="number"
                min="0"
                step="0.01"
                value={row.amount}
                onChange={(event) => updateRow(row.id, { amount: event.target.value })}
                placeholder="5000.00"
              />
            </Label>
            <TyfcbTierRow amount={Number(row.amount) || 0} />
            <div className={ready ? "inline-proof ready" : "inline-proof"}>
              <span className="proof-label">TYFCB proof image 证明照片</span>
              <input
                id={inputId}
                className="visually-hidden-file"
                key={`${row.id}-${selectedFiles.length}`}
                type="file"
                accept={EVIDENCE_ACCEPT}
                multiple
                onChange={(event) => addFiles(row.id, event.target.files)}
              />
              <label className="upload-file-button" htmlFor={inputId}>
                <Upload /> {proofCount ? "Add more images 继续上传" : "Upload file 上传照片"}
              </label>
              <small>{ready ? `${proofCount} proof image(s) saved 已有证明照片` : "Amount and proof are required 金额和证明都必填"}</small>
              <ExistingProofList evidence={existingEvidence} onDelete={onDeleteEvidence} deletingEvidenceId={deletingEvidenceId} />
              {selectedFiles.length > 0 && (
                <div className="proof-file-list">
                  {selectedFiles.map((file, fileIndex) => (
                    <div className="proof-file-row" key={`${file.name}-${file.size}-${fileIndex}`}>
                      <FileImage />
                      <span>{file.name}</span>
                      <button className="proof-view-button" type="button" onClick={() => setPreviewFile(file)}>View</button>
                      <button className="proof-cancel-button" type="button" onClick={() => removeFile(row.id, fileIndex)}>Cancel</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </article>
        );
      })}
      <button className="ghost-button tyfcb-add-button" type="button" onClick={addRow}>
        <Plus /> Add TYFCB record 新增成交记录
      </button>
      {previewFile && <ProofPreviewModal file={previewFile} onClose={() => setPreviewFile(null)} />}
    </div>
  );
}

function TyfcbTierRow({ amount }) {
  const activeTier = [30000, 20000, 10000, 1000, 100].find((tierAmount) => amount >= tierAmount);

  return (
    <div className="tyfcb-tier-panel">
      <div className="tyfcb-tier-summary">
        <span>Amount 金额</span>
        <strong>{money(amount)}</strong>
        <em>{tierPoints(amount)} pts</em>
      </div>
      <div className="tier-row" aria-label="TYFCB amount tier">
        {[100, 1000, 10000, 20000, 30000].map((tierAmount) => (
          <span key={tierAmount} className={activeTier === tierAmount ? "active" : ""}>
            {money(tierAmount)}
          </span>
        ))}
      </div>
    </div>
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

function SubmissionHistory({ submissions, currentWeek = null, onEditCurrent = null }) {
  const [selected, setSelected] = useState(null);
  const currentSubmission = currentWeek
    ? activeSubmission(submissions).find((item) => Number(item.week_id) === Number(currentWeek.id))
    : null;
  void currentSubmission;
  const rows = submissions;

  return (
    <section className="panel compact">
      <div className="section-heading small">
        <Award />
        <div>
          <h2>Your submissions 你的提交</h2>
          <p>{rows.length} records 记录</p>
        </div>
      </div>
      <div className="history-list">
        {rows.length === 0 && <p className="muted">No submissions yet. 暂无提交。</p>}
        {rows.map((item) => {
          const content = (
            <>
              <div>
                <strong>{item.week_label}</strong>
                <span>{item.status_label || new Date(item.submitted_at).toLocaleString()}</span>
              </div>
              <div className="history-row-side">
                <span className={`status-tag ${statusTagClass(item)}`}>{submissionStatusLabel(item)}</span>
                <b>{recordedScore(item)} pts</b>
              </div>
            </>
          );

          return (
            <button
              className={item.isPlaceholder ? "history-row current-record" : "history-row"}
              key={item.id}
              type="button"
              onClick={() => setSelected(item)}
            >
              {content}
            </button>
          );
        })}
      </div>
      {selected && (
        <SubmissionHistorySheet
          item={selected}
          currentWeek={currentWeek}
          onClose={() => setSelected(null)}
          onEditCurrent={onEditCurrent}
        />
      )}
    </section>
  );
}

function recordedScore(item) {
  if (item.isPlaceholder) return 0;
  return Number(item.score || 0);
}

function submissionStatusLabel(item) {
  if (item.isPlaceholder) return "Open 可填写";
  const status = submissionReviewStatus(item);
  if (status === "Approved") return "Approved 已批准";
  if (status === "Rejected") return "Rejected 已拒绝";
  if (status === "Archived") return "Archived 已归档";
  return "Submitted 已提交";
}

function statusTagClass(item) {
  const status = item.isPlaceholder ? "open" : submissionReviewStatus(item).toLowerCase();
  return `status-${status}`;
}

function isWeekEditableWindow(week) {
  if (!week?.ends_on) return false;
  const lockDate = new Date(`${week.ends_on}T23:59:59`);
  lockDate.setDate(lockDate.getDate() + 14);
  return new Date() <= lockDate;
}

function isWithinWeek(item, currentWeek) {
  const startsOn = item.starts_on || currentWeek?.starts_on;
  const endsOn = item.ends_on || currentWeek?.ends_on;
  if (!startsOn || !endsOn) return false;
  void startsOn;
  return isWeekEditableWindow({ ends_on: endsOn });
}

function SubmissionHistorySheet({ item, currentWeek, onClose, onEditCurrent }) {
  const canOpenCurrent = Number(item.week_id) === Number(currentWeek?.id);
  const editableThisWeek = isWithinWeek(item, currentWeek);
  const canEditCurrent = canOpenCurrent && editableThisWeek;
  const sectionStatus = (value, status) => (Number(value || 0) <= 0 ? "auto-approved" : status);
  const details = [
    { label: "1-2-1", value: item.one_to_one || 0, points: Math.min(Number(item.one_to_one || 0), 2), status: sectionStatus(item.one_to_one, item.one_to_one_status) },
    { label: "Training 培训", value: item.training || 0, points: Number(item.training || 0) * 5, status: sectionStatus(item.training, item.training_status) },
    { label: "Referral 引荐", value: item.referrals || 0, points: Number(item.referrals || 0) * 5, status: sectionStatus(item.referrals, item.referral_status) },
    { label: "TYFCB", value: money(item.tyfcb || 0), points: tierPoints(Number(item.tyfcb || 0)), status: sectionStatus(item.tyfcb, item.tyfcb_status) },
    { label: "Visitor 访客", value: item.visitors || 0, points: Number(item.visitors || 0) * 10, status: sectionStatus(item.visitors, item.visitor_status) },
  ];
  const expectedScore = details.reduce((total, detail) => total + Number(detail.points || 0), 0);

  return createPortal(
    <div className="sheet-backdrop" role="dialog" aria-modal="true" onClick={onClose}>
      <section className="bottom-sheet" onClick={(event) => event.stopPropagation()}>
        <button className="sheet-handle" type="button" onClick={onClose} aria-label="Close record" />
        <div className="sheet-title-row">
          <div>
            <p>Submission record 提交记录</p>
            <h2>{item.week_label}</h2>
          </div>
          <div className="sheet-tag-stack">
            <span className={`status-tag ${statusTagClass(item)}`}>{submissionStatusLabel(item)}</span>
            <span className={editableThisWeek ? "status-tag status-open" : "status-tag status-archived"}>
              {editableThisWeek ? "Editable 可编辑" : "View only 仅查看"}
            </span>
          </div>
        </div>
        <div className="sheet-score-row">
          <div>
            <span>Recorded score 已记录分数</span>
            <strong>{recordedScore(item)} pts</strong>
          </div>
          <div>
            <span>Expected score 预计分数</span>
            <strong>{expectedScore} pts</strong>
          </div>
        </div>
        <div className="sheet-detail-list">
          {details.map((detail) => (
            <div key={detail.label}>
              <span>{detail.label}</span>
              <strong>{detail.value} <small>| {detail.points} pts</small></strong>
              {detail.status && <em className={`status-dot status-${detail.status}`}>{detail.status}</em>}
            </div>
          ))}
        </div>
        {canOpenCurrent && (
          <button className="primary-button" type="button" onClick={() => {
            onClose();
            if (canEditCurrent) onEditCurrent?.();
          }} disabled={!canEditCurrent}>
            <ClipboardCheck />
            {canEditCurrent ? "Edit current record 编辑本周记录" : "Current record locked 本周记录已锁定"}
          </button>
        )}
        {!item.isPlaceholder && (
          <Link className="ghost-button" to={`/game/submission/${item.id}`}>
            <Eye />
            View full receipt 查看详情
          </Link>
        )}
      </section>
    </div>,
    document.body
  );
}

function receiptReviewStatus(submission, statusField, rawValue) {
  if (Number(rawValue || 0) <= 0) return "auto-approved";
  return submission[statusField] || (submission.status === "archived" ? "archived" : "recorded");
}

function receiptApprovedPoints(submission, statusField, potentialPoints) {
  const status = submission[statusField];
  if (!status) return potentialPoints;
  return status === "approved" ? potentialPoints : 0;
}

function receiptScoreRows(submission) {
  const activityRows = [
    {
      label: "1-2-1",
      value: submission.one_to_one || 0,
      rawValue: Number(submission.one_to_one || 0),
      statusField: "one_to_one_status",
      potentialPoints: Math.min(Number(submission.one_to_one || 0), 2),
    },
    {
      label: "Training 培训",
      value: submission.training || 0,
      rawValue: Number(submission.training || 0),
      statusField: "training_status",
      potentialPoints: Number(submission.training || 0) * 5,
    },
    {
      label: "Referral 引荐",
      value: submission.referrals || 0,
      rawValue: Number(submission.referrals || 0),
      statusField: "referral_status",
      potentialPoints: Number(submission.referrals || 0) * 5,
    },
    {
      label: "TYFCB",
      value: money(submission.tyfcb),
      rawValue: Number(submission.tyfcb || 0),
      statusField: "tyfcb_status",
      potentialPoints: tierPoints(Number(submission.tyfcb || 0)),
    },
    {
      label: "Visitor 访客",
      value: `${submission.visitors || 0} visitor(s) · joined ${submission.visitor_joined || 0}`,
      rawValue: Number(submission.visitors || 0),
      statusField: "visitor_status",
      potentialPoints: (Number(submission.visitors || 0) * 10) + (Number(submission.visitor_joined || 0) * 25),
    },
  ].map((row) => ({
    ...row,
    status: receiptReviewStatus(submission, row.statusField, row.rawValue),
    points: receiptApprovedPoints(submission, row.statusField, row.potentialPoints),
  }));

  const bonusRows = [
    {
      label: "Monthly all-five bonus 每月五项加分",
      value: "System bonus",
      status: Number(submission.monthly_completion_bonus_points || 0) > 0 ? "approved" : "recorded",
      points: Number(submission.monthly_completion_bonus_points || 0),
    },
    {
      label: "Admin add-on 管理员加分",
      value: submission.admin_bonus_note || "Manual adjustment",
      status: Number(submission.admin_bonus_points || 0) > 0 ? "approved" : "recorded",
      points: Number(submission.admin_bonus_points || 0),
    },
  ].filter((row) => row.points > 0 || row.value !== "System bonus");

  const subtotal = [...activityRows, ...bonusRows].reduce((total, row) => total + Number(row.points || 0), 0);
  const remaining = Number(submission.score || 0) - subtotal;
  const adjustmentRows = remaining !== 0
    ? [{
        label: "Other recorded adjustment 其他已记录调整",
        value: "From saved score",
        status: "recorded",
        points: remaining,
      }]
    : [];

  return [...activityRows, ...bonusRows, ...adjustmentRows];
}

function approvalAdminLabel(submission) {
  if (submission.approved_by) return submission.approved_by;
  if (submission.reviewer_owner) return submission.reviewer_owner;
  return "Pending admin approval 待管理员批准";
}

function receiptOverallStatus(scoreRows, submission) {
  if (submission.status === "archived") {
    return {
      tone: "archived",
      label: "Archived 已归档",
      value: "This submission was archived 此提交已归档",
      detail: "",
    };
  }
  const submittedRows = scoreRows.filter((row) => row.rawValue === undefined || Number(row.rawValue || 0) > 0);
  const rejectedRows = submittedRows.filter((row) => row.status === "rejected");
  const pendingRows = submittedRows.filter((row) => row.status === "pending");
  const approvedRows = submittedRows.filter((row) => row.status === "approved");

  if (rejectedRows.length > 0) {
    return {
      tone: "rejected",
      label: "Rejected by 拒绝管理员",
      value: approvalAdminLabel(submission),
      detail: `${rejectedRows.length} rejected section(s) 已拒绝项目`,
    };
  }
  if (pendingRows.length > 0) {
    return {
      tone: "pending",
      label: "Pending approval 待审核",
      value: submission.reviewer_owner || "Waiting for admin review 等待管理员审核",
      detail: `${pendingRows.length} pending section(s) 待审核项目`,
    };
  }
  if (approvedRows.length > 0) {
    return {
      tone: "approved",
      label: "Approved by 批准管理员",
      value: approvalAdminLabel(submission),
      detail: `${approvedRows.length} approved section(s) 已批准项目`,
    };
  }
  return {
    tone: "approved",
    label: "Auto-approved 自动通过",
    value: "No submitted activity 无提交项目",
    detail: "",
  };
}

function receiptFiveSectionRecords(submission) {
  return [
    { label: "1-2-1", value: submission.one_to_one || 0 },
    { label: "Training 培训", value: submission.training || 0 },
    { label: "Referral 引荐", value: submission.referrals || 0 },
    { label: "TYFCB 引荐成交额", value: money(submission.tyfcb) },
    { label: "Visitor 访客", value: submission.visitors || 0 },
  ];
}

function SubmissionReceiptCard({ submission }) {
  const scoreRows = receiptScoreRows(submission);
  const scoreTotal = scoreRows.reduce((total, row) => total + Number(row.points || 0), 0);
  const approvalStatus = receiptOverallStatus(scoreRows, submission);
  const submittedRecords = receiptFiveSectionRecords(submission);

  return (
    <section className="panel receipt">
      <div className="receipt-top-row">
        <Link to="/game/weeklyupdate" className="receipt-back-link" aria-label="Back to member dashboard">
          <ChevronRight />
          <span>Member dashboard</span>
          <small>返回会员面板</small>
        </Link>
        <CheckCircle2 className="receipt-icon" />
      </div>
      <p>Successful submit 提交成功</p>
      <h2>{submission.week_label}</h2>
      <p className="muted">This read-only page is available from your confirmation email link.</p>
      {submission.status === "archived" && (
        <div className="notice">
          此提交已归档，可重新提交。This submission was archived; please submit again.
          <Link to="/game/weeklyupdate"> 前往提交 Go to weekly update</Link>
        </div>
      )}
      <div className={`receipt-approval ${approvalStatus.tone}`}>
        <span>{approvalStatus.label}</span>
        <strong>{approvalStatus.value}</strong>
        {approvalStatus.detail && <small>{approvalStatus.detail}</small>}
      </div>
      <div className="score-badge large">
        <strong>{submission.score}</strong>
        <span>pts 分</span>
      </div>
      <div className="receipt-score-breakdown">
        <div className="receipt-breakdown-head">
          <strong>Score breakdown 分数明细</strong>
          <span>{scoreTotal} pts</span>
        </div>
        {scoreRows.map((row) => (
          <div className="receipt-score-row" key={row.label}>
            <div>
              <strong>{row.label}</strong>
              <span>{row.value}</span>
            </div>
            <em className={`status-dot status-${row.status}`}>{row.status}</em>
            <b>{row.points} pts</b>
          </div>
        ))}
        <p className="field-remark">Buddy team bonus points are shown on the leaderboard only. 伙伴组团队加分只显示在排行榜，不计入个人收据。</p>
      </div>
      <section className="receipt-record-summary">
        <div className="receipt-record-head">
          <span>Member 会员</span>
          <strong>{submission.full_name}</strong>
        </div>
        <div className="receipt-record-grid" aria-label="Five section submitted records 五项提交记录">
          {submittedRecords.map((record) => (
            <div key={record.label}>
              <span>{record.label}</span>
              <strong>{record.value}</strong>
            </div>
          ))}
        </div>
      </section>
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
        <SubmissionReceiptCard submission={submission} />
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
            <span>TIAN YI OneSystem control center</span>
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
  const [adDismissed, setAdDismissed] = useState(() =>
    window.localStorage.getItem(AGA_AD_DISMISSED_KEY) === "true" ||
    window.sessionStorage.getItem(AGA_AD_DISMISSED_KEY) === "true"
  );
  const [refreshKey, setRefreshKey] = useState(0);
  const tabs = [
    ["dashboard", "Dashboard 仪表板", BarChart3],
    ["members", "Member 会员", UsersRound],
    ["submissions", "Submissions 提交", ClipboardCheck],
    ["logs", "Logs 记录", FileImage],
  ];

  useEffect(() => {
    if (adDismissed) return undefined;
    const timer = window.setInterval(() => setShowAd(true), 5 * 60 * 1000);
    return () => window.clearInterval(timer);
  }, [adDismissed]);

  const dismissAd = useCallback(() => {
    window.localStorage.setItem(AGA_AD_DISMISSED_KEY, "true");
    window.sessionStorage.setItem(AGA_AD_DISMISSED_KEY, "true");
    setAdDismissed(true);
    setShowAd(false);
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
        {tab === "logs" && <ActionLogs demo={demo} adminToken={adminToken} />}
      </section>
      {showAd && <AgaAdPopup onClose={dismissAd} />}
    </>
  );
}

function AgaAdPopup({ onClose }) {
  const features = [
    { title: "AI websites", zh: "AI 网站" },
    { title: "Business portals", zh: "企业系统" },
    { title: "Automation workflows", zh: "自动化流程" },
    { title: "CRM dashboards", zh: "客户管理仪表板" },
  ];

  useEffect(() => {
    const closeOnEscape = (event) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  return (
    <div className="aga-ad-backdrop" role="dialog" aria-modal="true" onClick={onClose}>
      <section className="aga-ad-panel" onClick={(event) => event.stopPropagation()}>
        <button className="icon-button detail-close" type="button" onClick={onClose} aria-label="Close AGA showcase">
          <X />
        </button>
        <div className="aga-ad-hero">
          <div className="aga-ad-mark">AGA</div>
          <div>
            <span>AGA VENTURES SDN BHD</span>
            <h2>Build faster business systems</h2>
            <p>打造更快的企业系统</p>
          </div>
        </div>
        <div className="aga-ad-content">
          <p>Custom websites, secure portals, dashboards, automation, and AI tools for growing teams.</p>
          <div className="aga-ad-grid">
            {features.map((feature) => (
              <strong key={feature.title}>
                <span>{feature.title}</span>
                <small>{feature.zh}</small>
              </strong>
            ))}
          </div>
          <div className="aga-ad-actions">
            <a className="aga-ad-link" href={AGA_WEBSITE_URL} target="_blank" rel="noreferrer">
              Visit agaventures.ai
            </a>
            <button className="aga-ad-disable" type="button" onClick={onClose}>
              Don't show again 不再显示
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

function Dashboard({ refreshKey, demo = false, adminToken = "" }) {
  const [board, setBoard] = useState([]);
  const [stats, setStats] = useState({ members: 0, submissions: 0, pending_submissions: 0, weekly_missing_submissions: [], tyfcb: 0 });
  const tyfcbTotal = Number(stats.tyfcb || 0);
  const tyfcbProgress = TYFCB_GOAL ? Math.min(100, Math.round((tyfcbTotal / TYFCB_GOAL) * 100)) : 0;
  const totalSubmissions = Number(stats.submissions || 0);
  const pendingSubmissions = Number(stats.pending_submissions || 0);
  const weeklyMissingSubmissions = Array.isArray(stats.weekly_missing_submissions) ? stats.weekly_missing_submissions : [];

  useEffect(() => {
    if (demo) {
      const activeMembers = DEMO_MEMBERS.length;
      setBoard(DEMO_BOARD);
      setStats({
        members: activeMembers,
        submissions: DEMO_SUBMISSIONS.length,
        pending_submissions: DEMO_SUBMISSIONS.filter((item) => submissionReviewStatus(item) === "Pending").length,
        weekly_missing_submissions: WEEKS.map((week) => {
          const submittedMembers = new Set(
            DEMO_SUBMISSIONS
              .filter((item) => Number(item.week_id) === Number(week.id) && item.status !== "archived")
              .map((item) => item.member_id)
          ).size;
          return {
            week_id: week.id,
            label: week.label,
            starts_on: week.starts_on,
            ends_on: week.ends_on,
            submitted_members: submittedMembers,
            missing_members: Math.max(0, activeMembers - submittedMembers),
          };
        }),
        tyfcb: DEMO_SUBMISSIONS.reduce((sum, item) => sum + Number(item.tyfcb || 0), 0),
      });
      return;
    }
    supabase.rpc("admin_dashboard", { p_token: adminToken }).then(({ data }) => {
      setBoard(data?.leaderboard || []);
      setStats(data?.stats || { members: 0, submissions: 0, tyfcb: 0 });
    });
  }, [refreshKey, demo, adminToken]);

  const topTeams = board.slice(0, 5);
  const winner = topTeams[0];
  const runnerUp = topTeams[1];
  const winningGap = winner ? Number(winner.total_score || 0) - Number(runnerUp?.total_score || 0) : 0;
  const maxScore = Math.max(1, ...topTeams.map((team) => Number(team.total_score || 0)));

  return (
    <div className="admin-content">
      <div className="metric-grid">
        <Metric label="Members 会员" value={stats.members} detail="Weekly not submitted below 每周未提交见下方" />
        <Metric
          label="Total submissions 总提交"
          value={totalSubmissions}
          detail={`Pending ${pendingSubmissions} 待审核 ${pendingSubmissions}`}
        />
        <Metric
          label="TYFCB"
          value={money(tyfcbTotal)}
          detail={`${money(tyfcbTotal)} / ${money(TYFCB_GOAL)}`}
          progress={tyfcbProgress}
        />
        <Metric label="Teams 伙伴组" value={board.length} />
      </div>
      <WeeklyMissingSubmissions rows={weeklyMissingSubmissions} />
      <section className="panel winning-dashboard">
        <div className="section-heading">
          <Award />
          <div><h2>Winning now 当前领先</h2><p>Live buddy-pair ranking by approved score.</p></div>
        </div>
        {winner ? (
          <div className="winner-spotlight">
            <div>
              <span className="winner-kicker">#1 Leader 领先伙伴组</span>
              <h3>Buddy {winner.team_no}</h3>
              <p>{winner.members?.join(" & ") || "No members"}</p>
            </div>
            <strong>{winner.total_score || 0} pts</strong>
            <small>{winningGap > 0 ? `${winningGap} pts ahead of #2 领先第二名 ${winningGap} 分` : "Tied with #2 与第二名同分"}</small>
          </div>
        ) : (
          <p className="empty-state">No ranking yet. 暂无排行。</p>
        )}
        <div className="winner-board">
          {topTeams.map((team) => {
            const score = Number(team.total_score || 0);
            const width = Math.max(5, Math.round((score / maxScore) * 100));
            return (
              <article className={Number(team.rank) === 1 ? "winner-row first" : "winner-row"} key={team.team_id || team.team_no}>
                <div className="winner-rank">#{team.rank}</div>
                <div className="winner-info">
                  <strong>Buddy {team.team_no}</strong>
                  <span>{team.members?.join(" & ") || "No members"}</span>
                  <div className="winner-progress"><i style={{ width: `${width}%` }} /></div>
                  <small>{team.submission_count || 0} submission(s) · {money(team.total_tyfcb || 0)} TYFCB</small>
                </div>
                <b>{score} pts</b>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function WeeklyMissingSubmissions({ rows }) {
  return (
    <section className="panel weekly-missing-panel">
      <div className="section-heading compact-heading">
        <ClipboardCheck />
        <div>
          <h3>Weekly not submitted 每周未提交</h3>
          <p>Active members without an active submission for each week. 每周未提交的活跃会员人数。</p>
        </div>
      </div>
      {rows.length ? (
        <div className="weekly-missing-grid">
          {rows.map((week) => (
            <div className="weekly-missing-chip" key={week.week_id}>
              <span>Week {week.week_id}</span>
              <strong>{Number(week.missing_members || 0)}</strong>
              <small>not submitted 未提交</small>
            </div>
          ))}
        </div>
      ) : (
        <p className="empty-state">No weekly submission data yet. 暂无每周提交数据。</p>
      )}
    </section>
  );
}

function Metric({ label, value, detail = "", progress = null }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
      {detail && <small>{detail}</small>}
      {typeof progress === "number" && (
        <div className="metric-progress" aria-label={`${label} progress ${progress}%`}>
          <span style={{ width: `${progress}%` }} />
        </div>
      )}
    </div>
  );
}

function MemberManager({ onChanged, demo = false, adminToken = "" }) {
  const [members, setMembers] = useState([]);
  const [memberScores, setMemberScores] = useState({});
  const [memberSubmissions, setMemberSubmissions] = useState([]);
  const [teamBoard, setTeamBoard] = useState([]);
  const [newMember, setNewMember] = useState({ full_name: "", email: "", company: "", phone: "", reviewer_owner: "" });
  const [searchTerm, setSearchTerm] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [editingMember, setEditingMember] = useState(null);
  const [editMemberTab, setEditMemberTab] = useState("info");
  const [memberView, setMemberView] = useState("list");

  async function load() {
    if (demo) {
      setMembers(DEMO_MEMBERS);
      setMemberScores(buildMemberScores(DEMO_SUBMISSIONS));
      setMemberSubmissions(DEMO_SUBMISSIONS);
      setTeamBoard(DEMO_BOARD);
      return;
    }
    const [{ data: memberData }, { data: submissionData }, { data: leaderboardData }] = await Promise.all([
      supabase.rpc("admin_members", { p_token: adminToken }),
      supabase.rpc("admin_submissions", { p_token: adminToken }),
      supabase.rpc("team_leaderboard"),
    ]);
    setMembers(memberData || []);
    setMemberScores(buildMemberScores(submissionData || []));
    setMemberSubmissions(submissionData || []);
    setTeamBoard(leaderboardData || []);
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
      setNewMember({ full_name: "", email: "", company: "", phone: "", reviewer_owner: "" });
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
      p_reviewer_owner: newMember.reviewer_owner || null,
    });
    setNewMember({ full_name: "", email: "", company: "", phone: "", reviewer_owner: "" });
    setIsAdding(false);
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
      reviewer_owner: editingMember.reviewer_owner || "",
    };
    if (demo) {
      setMembers((current) => current.map((member) => {
        if (member.id === nextMember.id) {
          const buddy = current.find((item) => item.id === nextMember.buddy_member_id);
          return { ...nextMember, buddy: buddy || null };
        }
        if (member.buddy_member_id === nextMember.id && member.id !== nextMember.buddy_member_id) {
          return { ...member, buddy_member_id: null, buddy: null };
        }
        if (nextMember.buddy_member_id && member.id === nextMember.buddy_member_id) {
          return { ...member, buddy_member_id: nextMember.id, buddy: nextMember };
        }
        return member;
      }).sort((a, b) => a.full_name.localeCompare(b.full_name)));
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
      p_reviewer_owner: nextMember.reviewer_owner || null,
    });
    await supabase.rpc("admin_assign_buddy_pair", {
      p_token: adminToken,
      p_member_id: nextMember.id,
      p_buddy_member_id: nextMember.buddy_member_id || null,
    });
    setEditingMember(null);
    await load();
    onChanged();
  }

  function openMemberEditor(member) {
    setEditingMember({ ...member });
    setEditMemberTab("info");
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
  const teamBoardById = new Map(teamBoard.map((team) => [String(team.team_id || ""), team]));
  const teamBoardByNo = new Map(teamBoard.map((team) => [String(team.team_no || ""), team]));
  const editingMemberSubmissions = editingMember
    ? memberSubmissions
      .filter((submission) => submission.member_id === editingMember.id)
      .sort((a, b) => new Date(b.submitted_at || 0).getTime() - new Date(a.submitted_at || 0).getTime())
    : [];

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
                <thead><tr><th>Name</th><th>Email</th><th>Company</th><th>Reviewer</th><th>Buddy pair</th><th>Edit</th></tr></thead>
                <tbody>
                  {filteredMembers.map((member) => (
                    <tr key={member.id}>
                      <td>{member.full_name}</td>
                      <td>{member.email}</td>
                      <td>{member.company || "-"}</td>
                      <td>{member.reviewer_owner || "-"}</td>
                      <td>{member.buddy_teams?.team_no ? `Pair ${member.buddy_teams.team_no}` : "-"}</td>
                      <td>
                        <button className="table-action-button" type="button" onClick={() => openMemberEditor(member)}>Edit</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="member-card-list">
              {filteredMembers.map((member) => (
                <MemberAdminCard key={member.id} member={member} onEdit={() => openMemberEditor(member)} />
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
                teamBoardRow={teamBoardById.get(String(group.id)) || teamBoardByNo.get(String(group.teamNo || ""))}
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
            <Label text="Submission reviewer 提交负责人">
              <select value={newMember.reviewer_owner || ""} onChange={(e) => setNewMember({ ...newMember, reviewer_owner: e.target.value })}>
                <option value="">Unassigned 未分配</option>
                {REVIEWER_OPTIONS.map((name) => <option key={name} value={name}>{name}</option>)}
              </select>
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
            <div className="drawer-tabs modal-tabs">
              <button type="button" className={editMemberTab === "info" ? "active" : ""} onClick={() => setEditMemberTab("info")}>Info 资料</button>
              <button type="button" className={editMemberTab === "submissions" ? "active" : ""} onClick={() => setEditMemberTab("submissions")}>Submissions 提交</button>
            </div>
            {editMemberTab === "info" ? (
              <>
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
                <Label text="Submission reviewer 提交负责人">
                  <select value={editingMember.reviewer_owner || ""} onChange={(e) => setEditingMember({ ...editingMember, reviewer_owner: e.target.value })}>
                    <option value="">Unassigned 未分配</option>
                    {REVIEWER_OPTIONS.map((name) => <option key={name} value={name}>{name}</option>)}
                  </select>
                </Label>
                <Label text="Buddy member 伙伴会员">
                  <select className="buddy-select" value={editingMember.buddy_member_id || ""} onChange={(e) => setEditingMember({ ...editingMember, buddy_member_id: e.target.value })}>
                    <option value="">None 未分配</option>
                    {members.filter((option) => option.id !== editingMember.id).map((option) => <option key={option.id} value={option.id}>{option.full_name}</option>)}
                  </select>
                </Label>
                <div className="button-row">
                  <button className="ghost-button" type="button" onClick={() => setEditingMember(null)}>Cancel 取消</button>
                  <Button>Save 保存</Button>
                </div>
              </>
            ) : (
              <MemberSubmissionHistory submissions={editingMemberSubmissions} />
            )}
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

function MemberSubmissionHistory({ submissions }) {
  if (submissions.length === 0) {
    return <p className="empty-state">No submissions for this member yet. 此会员暂无提交。</p>;
  }

  return (
    <div className="member-submission-history">
      {submissions.map((submission) => (
        <article className="member-submission-row" key={submission.id}>
          <div className="member-submission-row-head">
            <div>
              <strong>{submission.week_label}</strong>
              <span>{submission.submitted_at ? new Date(submission.submitted_at).toLocaleString() : "No submit time"}</span>
            </div>
            <div className="member-submission-badges">
              <em className={`status-pill ${submissionReviewStatus(submission).toLowerCase()}`}>{submissionReviewStatus(submission)}</em>
              <b>{submission.score || 0} pts</b>
            </div>
          </div>
          <dl>
            <div><dt>1-2-1</dt><dd>{submission.one_to_one || 0}</dd></div>
            <div><dt>Training</dt><dd>{submission.training || 0}</dd></div>
            <div><dt>Referral</dt><dd>{submission.referrals || 0}</dd></div>
            <div><dt>TYFCB</dt><dd>{money(submission.tyfcb || 0)}</dd></div>
            <div><dt>Visitor</dt><dd>{submission.visitors || 0}</dd></div>
          </dl>
        </article>
      ))}
    </div>
  );
}

function BuddyGroupCard({ group, memberScores, teamBoardRow = null }) {
  const memberScore = group.members.reduce((total, member) => total + Number(memberScores[member.id]?.score || 0), 0);
  const teamBonusPoints = Number(teamBoardRow?.team_bonus_points || 0);
  const teamScore = Number(teamBoardRow?.total_score ?? memberScore + teamBonusPoints);
  const bonusAwards = Array.isArray(teamBoardRow?.team_bonus_awards) ? teamBoardRow.team_bonus_awards : [];
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
      {teamBonusPoints > 0 && (
        <div className="buddy-team-bonus-strip">
          <div>
            <span>Member {memberScore} pts · Team bonus +{teamBonusPoints} · Final {teamScore} pts</span>
            {bonusAwards.length > 0 && (
              <small>{bonusAwards.map((award) => `${teamBonusShortLabel(award.bonus_type)} ${teamBonusPeriodLabel(award.period_key)} +${award.points}`).join(" · ")}</small>
            )}
          </div>
          <b>+{teamBonusPoints}</b>
        </div>
      )}
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

function MemberAdminCard({ member, compact = false, scoreSummary = null, onEdit }) {
  return (
    <article className={compact ? "member-list-card compact-member-card" : "member-list-card"}>
      <div>
        <strong>{member.full_name}</strong>
        <span>{member.email}</span>
        {member.phone && <span>{member.phone}</span>}
      </div>
      <dl>
        <div><dt>Company 公司</dt><dd>{member.company || "-"}</dd></div>
        <div><dt>Reviewer 负责人</dt><dd>{member.reviewer_owner || "-"}</dd></div>
        <div><dt>Buddy pair 伙伴组</dt><dd>{member.buddy_teams?.team_no || "-"}</dd></div>
        <div><dt>Buddy partner 伙伴</dt><dd>{member.buddy?.full_name || "None"}</dd></div>
        {scoreSummary && <div><dt>Game input score 分数</dt><dd>{scoreSummary.score || 0} pts</dd></div>}
        {scoreSummary && <div><dt>Submissions 提交</dt><dd>{scoreSummary.submissions || 0}</dd></div>}
      </dl>
      {onEdit && <button className="ghost-button" type="button" onClick={onEdit}>Edit 编辑</button>}
    </article>
  );
}

function SubmissionReview({ demo = false, adminToken = "" }) {
  const [items, setItems] = useState([]);
  const [reviewerFilter, setReviewerFilter] = useState("all");
  const [submissionSearch, setSubmissionSearch] = useState("");
  const [buddyFilter, setBuddyFilter] = useState("all");
  function load() {
    if (demo) {
      setItems(DEMO_SUBMISSIONS);
      return;
    }
    supabase.rpc("admin_submissions", { p_token: adminToken }).then(({ data }) => setItems(data || []));
  }

  useEffect(() => {
    load();
  }, [demo, adminToken]);

  const reviewerTabs = [
    { id: "all", label: "All", match: "" },
    { id: "peixuan", label: "PeiXuan", match: "peixuan" },
    { id: "krision", label: "Krision", match: "krision" },
    { id: "alicia", label: "Alicia", match: "alicia" },
  ];
  const selectedReviewer = reviewerTabs.find((tab) => tab.id === reviewerFilter) || reviewerTabs[0];
  const reviewerFilteredItems = selectedReviewer.id === "all"
    ? items
    : items.filter((item) => String(item.reviewer_owner || "").toLowerCase() === selectedReviewer.match);
  const buddyOptions = Array.from(new Set(items.map((item) => item.team_no).filter((teamNo) => teamNo !== null && typeof teamNo !== "undefined" && teamNo !== "")))
    .sort((a, b) => Number(a) - Number(b));
  const normalizedSearch = submissionSearch.trim().toLowerCase();
  const filteredItems = reviewerFilteredItems.filter((item) => {
    const matchesMember = !normalizedSearch || [item.full_name, item.email].filter(Boolean).join(" ").toLowerCase().includes(normalizedSearch);
    const matchesBuddy = buddyFilter === "all" || String(item.team_no || "") === buddyFilter;
    return matchesMember && matchesBuddy;
  });
  const activeFilterCount = Number(Boolean(normalizedSearch)) + Number(buddyFilter !== "all");

  return (
    <div className="admin-content">
      <section className="panel">
        <div className="section-heading">
          <ClipboardCheck />
          <div>
            <h2>{selectedReviewer.id === "all" ? "All submissions 所有提交" : `${selectedReviewer.label} submissions 提交`}</h2>
            <p>Full weekly game input list.</p>
          </div>
        </div>
        <div className="submission-filter-bar">
          <Label text="Search member 搜索会员">
            <input
              type="search"
              value={submissionSearch}
              onChange={(event) => setSubmissionSearch(event.target.value)}
              placeholder="Name or email 名字或电邮"
            />
          </Label>
          <Label text="Buddy group 伙伴组">
            <select value={buddyFilter} onChange={(event) => setBuddyFilter(event.target.value)}>
              <option value="all">All buddy groups 全部伙伴组</option>
              {buddyOptions.map((teamNo) => (
                <option key={teamNo} value={String(teamNo)}>Buddy {teamNo}</option>
              ))}
            </select>
          </Label>
          {activeFilterCount > 0 && (
            <button className="ghost-button" type="button" onClick={() => { setSubmissionSearch(""); setBuddyFilter("all"); }}>
              Clear filters 清除筛选
            </button>
          )}
        </div>
        <p className="filter-summary">
          Showing {filteredItems.length} of {reviewerFilteredItems.length} submission(s). 显示 {filteredItems.length} / {reviewerFilteredItems.length} 个提交。
        </p>
        <div className="reviewer-tabs" role="tablist" aria-label="Submission reviewer filters">
          {reviewerTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={reviewerFilter === tab.id ? "active" : ""}
              onClick={() => setReviewerFilter(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <SubmissionTable items={filteredItems} demo={demo} adminToken={adminToken} onUpdated={load} emptyLabel={selectedReviewer.id === "all" ? "No submissions yet. 暂无提交。" : `No submissions for ${selectedReviewer.label} yet. 暂无 ${selectedReviewer.label} 提交。`} />
      </section>
    </div>
  );
}

function ActionLogs({ demo = false, adminToken = "" }) {
  const [logs, setLogs] = useState([]);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [datePreset, setDatePreset] = useState("");

  function load() {
    if (demo) {
      setLogs([
        {
          id: "demo-log-1",
          actor_type: "admin",
          actor_email: "admin@agaventures.ai",
          action: "admin_approve",
          member_name: "Tianyi Demo Member",
          week_label: "Week 1 (02/06 - 08/06)",
          details: { field: "one_to_one_status", status: "approved" },
          created_at: new Date().toISOString(),
        },
        {
          id: "demo-log-2",
          actor_type: "member",
          actor_email: DEMO_MEMBER.email,
          action: "member_submit",
          member_name: DEMO_MEMBER.full_name,
          week_label: "Week 1 (02/06 - 08/06)",
          details: { one_to_one: 2, training: 1, referrals: 3, tyfcb: 12000, visitors: 1 },
          created_at: new Date(Date.now() - 1000 * 60 * 20).toISOString(),
        },
      ]);
      return;
    }
    supabase
      .rpc("admin_action_logs", { p_token: adminToken, p_limit: 300 })
      .then(({ data }) => setLogs(data || []))
      .catch(() => setLogs([]));
  }

  useEffect(() => { load(); }, [demo, adminToken]);

  function formatDateInput(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function applyDatePreset(preset) {
    const today = new Date();
    const start = new Date(today);
    const end = new Date(today);
    if (preset === "yesterday") {
      start.setDate(today.getDate() - 1);
      end.setDate(today.getDate() - 1);
    }
    if (preset === "week") {
      const day = today.getDay();
      const mondayOffset = day === 0 ? -6 : 1 - day;
      start.setDate(today.getDate() + mondayOffset);
    }
    setDatePreset(preset);
    setDateFrom(formatDateInput(start));
    setDateTo(formatDateInput(end));
  }

  const filteredLogs = logs.filter((log) => {
    const createdAt = log.created_at ? new Date(log.created_at).getTime() : 0;
    const fromTime = dateFrom ? new Date(`${dateFrom}T00:00:00`).getTime() : null;
    const toTime = dateTo ? new Date(`${dateTo}T23:59:59`).getTime() : null;
    if (fromTime && createdAt < fromTime) return false;
    if (toTime && createdAt > toTime) return false;
    return true;
  });

  return (
    <div className="admin-content">
      <section className="panel">
        <div className="section-heading">
          <FileImage />
          <div>
            <h2>Action logs 操作记录</h2>
            <p>Member submissions, admin reviews, rejects, approvals, edits, and bonus changes.</p>
          </div>
        </div>
        <div className="action-log-toolbar">
          <div className="date-preset-group" aria-label="Quick date filters">
            <button className={datePreset === "today" ? "active" : ""} type="button" onClick={() => applyDatePreset("today")}>
              Today 今天
            </button>
            <button className={datePreset === "yesterday" ? "active" : ""} type="button" onClick={() => applyDatePreset("yesterday")}>
              Yesterday 昨天
            </button>
            <button className={datePreset === "week" ? "active" : ""} type="button" onClick={() => applyDatePreset("week")}>
              This week 本周
            </button>
          </div>
          <Label text="From date 开始日期">
            <input type="date" value={dateFrom} onChange={(event) => { setDatePreset(""); setDateFrom(event.target.value); }} />
          </Label>
          <Label text="To date 结束日期">
            <input type="date" value={dateTo} onChange={(event) => { setDatePreset(""); setDateTo(event.target.value); }} />
          </Label>
          {(dateFrom || dateTo) && (
            <button className="ghost-button" type="button" onClick={() => { setDatePreset(""); setDateFrom(""); setDateTo(""); }}>
              Clear dates 清除日期
            </button>
          )}
        </div>
        <p className="filter-summary">
          Showing {filteredLogs.length} of {logs.length} log(s). 显示 {filteredLogs.length} / {logs.length} 条记录。
        </p>
        {filteredLogs.length === 0 ? (
          <p className="empty-state">No action logs yet. 暂无操作记录。</p>
        ) : (
          <div className="action-log-list">
            {filteredLogs.map((log) => (
              <article className="action-log-row" key={log.id}>
                <div className="action-log-icon">{log.actor_type === "admin" ? "A" : "M"}</div>
                <div>
                  <strong>{actionLogLabel(log.action)}</strong>
                  <span>{log.member_name || log.member_email || "No member"} · {log.week_label || "No week"}</span>
                  <small>{actionLogDetail(log)}</small>
                </div>
                <aside>
                  <b>{log.actor_email || log.actor_type}</b>
                  <span>{log.created_at ? new Date(log.created_at).toLocaleString() : "-"}</span>
                </aside>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function actionLogLabel(action) {
  const labels = {
    member_submit: "Member submitted 会员提交",
    member_update_submission: "Member updated submission 会员更新提交",
    admin_approve: "Approved 已批准",
    admin_reject: "Rejected 已拒绝",
    admin_reject_status: "Marked rejected 标记拒绝",
    admin_set_pending: "Set pending 改为待审核",
    admin_update_visitor_joined: "Visitor joined updated 更新访客加入",
    admin_bonus_points: "Admin bonus updated 管理员加分",
    admin_add_member: "Member added 新增会员",
    admin_update_member: "Member edited 编辑会员",
    admin_assign_buddy_pair: "Buddy pair assigned 分配伙伴组",
    admin_clear_buddy_pair: "Buddy pair cleared 清除伙伴组",
    admin_finalize_approved: "Final approved 最终批准",
    admin_finalize_rejected: "Final rejected 最终拒绝",
    email_member_submission: "Submission email sent 提交邮件已发送",
    email_admin_submission: "Admin notification email sent 管理员通知邮件已发送",
    email_member_rejection: "Rejection email sent 拒绝通知邮件已发送",
  };
  return labels[action] || String(action || "Action").replaceAll("_", " ");
}

function actionLogDetail(log) {
  const details = log.details || {};
  if (Array.isArray(details.rejected_sections) && details.rejected_sections.length) {
    return `${details.status || "sent"} · ${details.recipient || "no recipient"} · ${details.rejected_sections.length} rejected section(s)`;
  }
  if (details.review_status) return `Final status 最终状态: ${details.review_status}`;
  if (details.reason) return `Reason 原因: ${details.reason}`;
  if (details.recipient || details.status || details.subject) {
    return `${details.status || "sent"} · ${details.recipient || "no recipient"}${details.subject ? ` · ${details.subject}` : ""}`;
  }
  if (details.field && details.status) return `${details.field} -> ${details.status}`;
  if (typeof details.bonus_points !== "undefined") return `Bonus 加分: ${details.bonus_points} pts${details.note ? ` · ${details.note}` : ""}`;
  if (typeof details.visitor_joined !== "undefined") return `Visitor joined 访客加入: ${details.visitor_joined}`;
  const activityParts = ["one_to_one", "training", "referrals", "tyfcb", "visitors"]
    .filter((key) => typeof details[key] !== "undefined")
    .map((key) => `${key}: ${details[key]}`);
  if (activityParts.length) return activityParts.join(" · ");
  if (details.member_email) return details.member_email;
  if (details.team_no) return `Buddy team 伙伴组 ${details.team_no}`;
  return "Recorded by system 系统记录";
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
        submissionId: item.id,
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
  const [previewOpen, setPreviewOpen] = useState(false);
  useEffect(() => {
    if (file.file_path?.startsWith("demo/")) {
      setUrl("");
      return;
    }
    supabase.storage.from(EVIDENCE_BUCKET).createSignedUrl(file.file_path, 3600).then(({ data }) => setUrl(data?.signedUrl || ""));
  }, [file.file_path]);
  const label = file.file_name || "Open proof";
  if (file.file_path?.startsWith("demo/")) {
    return (
      <span className="proof-preview-link">
        <FileImage /> {label}
        <button type="button" onClick={() => setPreviewOpen(true)}><Eye /> View 查看</button>
        {previewOpen && <ExistingProofPreview file={file} url={url} onClose={() => setPreviewOpen(false)} />}
      </span>
    );
  }
  if (!url) return <span>Loading proof...</span>;
  return (
    <span className="proof-preview-link">
      <FileImage /> {label}
      <button type="button" onClick={() => setPreviewOpen(true)}><Eye /> View 查看</button>
      {previewOpen && <ExistingProofPreview file={file} url={url} onClose={() => setPreviewOpen(false)} />}
    </span>
  );
}

function SubmissionTable({ items, demo = false, adminToken = "", onUpdated, emptyLabel = "No submissions yet. 暂无提交。" }) {
  const [selected, setSelected] = useState(null);
  if (items.length === 0) {
    return <p className="empty-state">{emptyLabel}</p>;
  }
  const statusOrder = ["Submitted", "Approving", "Approved", "Rejected", "Archived"];
  const groupedItems = statusOrder
    .map((status) => ({
      status,
      items: items.filter((item) => submissionReviewStatus(item) === status),
    }))
    .filter((group) => group.items.length > 0);

  return (
    <>
      <div className="submission-status-groups">
        {groupedItems.map((group) => (
          <section className="submission-status-group" key={group.status}>
            <div className="submission-status-heading">
              <strong>{group.status}</strong>
              <span>{group.items.length} record(s)</span>
            </div>
            <div className="table-wrap submission-table-wrap">
              <table>
                <thead>
                  <tr><th>Member</th><th>Status</th><th>Week</th><th>Buddy</th><th>1-2-1</th><th>Training</th><th>Referral</th><th>TYFCB</th><th>Visitor</th><th>Score</th></tr>
                </thead>
                <tbody>
                  {group.items.map((item) => (
                    <tr key={item.id} className="clickable-row" onClick={() => setSelected(item)}>
                      <td>{item.full_name}</td>
                      <td><span className={`status-pill ${submissionReviewStatus(item).toLowerCase()}`}>{submissionReviewStatus(item)}</span></td>
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
              {group.items.map((item) => (
                <button className="submission-card" key={item.id} onClick={() => setSelected(item)}>
                  <div>
                    <strong>{item.full_name}</strong>
                    <span>{item.week_label} · {group.status}</span>
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
          </section>
        ))}
      </div>
      {selected && <SubmissionDetail item={selected} demo={demo} adminToken={adminToken} onSaved={onUpdated} onClose={() => setSelected(null)} />}
    </>
  );
}

function submissionReviewStatus(item) {
  if (item.status === "archived") return "Archived";
  if (item.review_status === "approved") return "Approved";
  if (item.review_status === "rejected") return "Rejected";
  if (item.review_status === "reviewing") return "Approving";
  if (item.review_status === "submitted") return "Submitted";
  const submittedStatuses = [
    Number(item.one_to_one || 0) > 0 ? item.one_to_one_status : null,
    Number(item.training || 0) > 0 ? item.training_status : null,
    Number(item.referrals || 0) > 0 ? item.referral_status : null,
    Number(item.tyfcb || 0) > 0 ? item.tyfcb_status : null,
    Number(item.visitors || 0) > 0 ? item.visitor_status : null,
  ].filter(Boolean);
  if (submittedStatuses.length > 0 && submittedStatuses.every((status) => status === "approved")) return "Approved";
  if (submittedStatuses.some((status) => status === "approved" || status === "rejected")) return "Approving";
  return "Submitted";
}

const REVIEW_SECTIONS = [
  { kind: "one_to_one", label: "1-2-1", zh: "一对一", valueKey: "one_to_one", statusField: "one_to_one_status" },
  { kind: "training", label: "Training", zh: "培训", valueKey: "training", statusField: "training_status" },
  { kind: "referral", label: "Referral", zh: "引荐", valueKey: "referrals", statusField: "referral_status" },
  { kind: "tyfcb", label: "TYFCB", zh: "引荐成交额", valueKey: "tyfcb", statusField: "tyfcb_status" },
  { kind: "visitor", label: "Visitor", zh: "访客", valueKey: "visitors", statusField: "visitor_status" },
];

const TEAM_BONUS_OPTIONS = [
  {
    type: "all_five_buddy_monthly",
    label: "All-five buddy monthly 全勤团队加分",
    description: "Both buddies complete 1-2-1, Referral, Training, TYFCB, and Visitor in the same month. 伙伴两人当月五项都通过审核。",
    points: 3,
  },
  {
    type: "monthly_visitor_2",
    label: "Monthly 2 Visitors 月度来宾加分",
    description: "Buddy team reaches 2 approved Visitors in the campaign month. 伙伴组当月累计 2 位已批准 Visitor。",
    points: 5,
  },
  {
    type: "monthly_visitor_4",
    label: "Monthly 4 Visitors 月度来宾高阶加分",
    description: "Buddy team reaches 4 approved Visitors in the campaign month. Highest Visitor tier only. 伙伴组当月累计 4 位 Visitor，只取最高不叠加。",
    points: 10,
  },
  {
    type: "rescue_teammate",
    label: "Rescue teammate 逆风翻盘",
    description: "Previous two weeks: one buddy has 0 Referral, 0 Visitor, and 0 TYFCB; the other has 1 Visitor or 3 Referrals. 前两周一位队友 Referral、Visitor、TYFCB 都为 0，另一位有 1 Visitor 或 3 Referral。",
    points: 5,
  },
];

function sectionPointValue(item, kind) {
  if (kind === "one_to_one") return Math.min(Number(item.one_to_one || 0), 2);
  if (kind === "training") return Number(item.training || 0) * 5;
  if (kind === "referral") return Number(item.referrals || 0) * 5;
  if (kind === "tyfcb") return tierPoints(Number(item.tyfcb || 0));
  if (kind === "visitor") return (Number(item.visitors || 0) * 10) + (Number(item.visitor_joined || 0) * 25);
  return 0;
}

function sectionDisplayValue(item, kind) {
  if (kind === "tyfcb") return money(item.tyfcb);
  if (kind === "visitor") return `${item.visitors || 0} visitor(s) · joined ${item.visitor_joined || 0}`;
  if (kind === "referral") return item.referrals || 0;
  return item[kind] || 0;
}

function submissionSectionRows(item, statusOverrides = {}) {
  return REVIEW_SECTIONS.map((section) => {
    const status = statusOverrides[section.statusField] || item[section.statusField] || "pending";
    const rawValue = Number(item[section.valueKey] || 0);
    const evidence = (item.evidence || []).filter((row) => row.kind === section.kind);
    return {
      ...section,
      status,
      rawValue,
      displayValue: sectionDisplayValue(item, section.kind),
      points: status === "approved" ? sectionPointValue(item, section.kind) : 0,
      potentialPoints: sectionPointValue(item, section.kind),
      evidence,
      needsReview: rawValue > 0,
    };
  });
}

function teamBonusLabel(type) {
  return TEAM_BONUS_OPTIONS.find((option) => option.type === type)?.label || type;
}

function teamBonusShortLabel(type) {
  if (type === "all_five_buddy_monthly") return "All-five";
  if (type === "monthly_visitor_2") return "Visitor 2";
  if (type === "monthly_visitor_4") return "Visitor 4";
  if (type === "rescue_teammate") return "Rescue";
  return type;
}

function teamBonusPeriodLabel(periodKey = "") {
  if (periodKey === "month-1") return "M1";
  if (periodKey === "month-2") return "M2";
  if (String(periodKey).startsWith("rescue-")) return String(periodKey).replace("rescue-", "W");
  return String(periodKey || "");
}

function teamBonusNotQualifiedReason(option, submission, sectionRows) {
  if (option.type === "all_five_buddy_monthly") {
    const missingApprovedSections = sectionRows
      .filter((row) => !row.needsReview || row.status !== "approved")
      .map((row) => row.label);
    if (missingApprovedSections.length > 0) {
      return `This submission still needs approved ${missingApprovedSections.join(", ")}. 此提交还有项目未通过。`;
    }
    return "This member is complete, but the buddy pair has not both completed all five approved sections in the month. 本人已完成，但伙伴两人当月五项未同时达成。";
  }

  if (option.type === "monthly_visitor_2") {
    if (Number(submission.visitors || 0) <= 0 || submission.visitor_status !== "approved") {
      return "This submission has no approved Visitor yet. 此提交还没有已批准 Visitor。";
    }
    return "The buddy team has not reached 2 approved Visitors in this campaign month. 伙伴组当月 Visitor 未达到 2 位。";
  }

  if (option.type === "monthly_visitor_4") {
    return "The buddy team has not reached 4 approved Visitors in this campaign month. 伙伴组当月 Visitor 未达到 4 位。";
  }

  if (option.type === "rescue_teammate") {
    return "The previous two-week rescue condition was not met. 前两周逆风翻盘条件未达成。";
  }

  return "Rule condition has not been met yet. 条件尚未达成。";
}

function SubmissionDetail({ item, demo = false, adminToken = "", onSaved, onClose }) {
  const [bonusPoints, setBonusPoints] = useState(item.admin_bonus_points || 0);
  const [bonusNote, setBonusNote] = useState(item.admin_bonus_note || "");
  const [logsExpanded, setLogsExpanded] = useState(false);
  const [savingBonus, setSavingBonus] = useState(false);
  const [bonusMessage, setBonusMessage] = useState("");
  const [statusOverrides, setStatusOverrides] = useState({});
  const [reasons, setReasons] = useState({});
  const [rejectReasonField, setRejectReasonField] = useState("");
  const [confirmReview, setConfirmReview] = useState(null);
  const [reviewBusy, setReviewBusy] = useState(false);
  const [reviewMessage, setReviewMessage] = useState("");
  const [reviewMessageField, setReviewMessageField] = useState("");
  const [confirmCorrectionEmail, setConfirmCorrectionEmail] = useState(false);
  const [sendingCorrectionEmail, setSendingCorrectionEmail] = useState(false);
  const [finalizingReview, setFinalizingReview] = useState(false);
  const [finalReviewStatus, setFinalReviewStatus] = useState(item.review_status || "submitted");
  const [correctionEmailMessage, setCorrectionEmailMessage] = useState("");
  const [correctionEmailSentAt, setCorrectionEmailSentAt] = useState("");
  const mergedItem = { ...item, ...statusOverrides, admin_bonus_points: bonusPoints, review_status: finalReviewStatus };
  const sectionRows = submissionSectionRows(mergedItem, statusOverrides);
  const submittedSectionRows = sectionRows.filter((row) => row.needsReview);
  const approvedSectionPoints = sectionRows.reduce((total, row) => total + row.points, 0);
  const allFiveSubmitted = sectionRows.every((row) => row.needsReview);
  const monthlyBonus = Number(item.monthly_completion_bonus_points || 0);
  const calculatedScore = finalReviewStatus === "approved" ? approvedSectionPoints + Number(bonusPoints || 0) + monthlyBonus : 0;
  const teamBonusAwards = Array.isArray(item.team_bonus_awards) ? item.team_bonus_awards : [];
  const teamBonusTotal = teamBonusAwards.reduce((total, award) => total + Number(award.points || 0), 0);
  const relatedLogs = Array.isArray(item.action_logs) ? item.action_logs : [];
  const currentReviewStatus = submissionReviewStatus(mergedItem);
  const latestCorrectionEmailLog = relatedLogs.find((log) => log.action === "email_member_rejection");
  const rejectedSectionRows = submittedSectionRows.filter((row) => row.status === "rejected");
  const pendingSectionRows = submittedSectionRows.filter((row) => row.status === "pending");
  const allSubmittedSectionsApproved = submittedSectionRows.length > 0 && submittedSectionRows.every((row) => row.status === "approved");
  const approvedSectionLabels = submittedSectionRows
    .filter((row) => row.status === "approved")
    .map((row) => `${row.label} ${row.zh}`);
  const rejectedCorrections = rejectedSectionRows.map((row) => {
    const loggedReason = relatedLogs.find((log) =>
      log.action === "admin_reject_status" &&
      log.details?.field === row.statusField &&
      log.details?.reason
    )?.details?.reason;
    return {
      kind: row.kind,
      field: row.statusField,
      label: `${row.label} ${row.zh}`,
      reason: String(reasons[row.statusField] || loggedReason || "").trim(),
    };
  });
  const missingCorrectionReasons = rejectedCorrections.filter((section) => !section.reason);
  const latestEmailTime = correctionEmailSentAt
    ? new Date(correctionEmailSentAt).getTime()
    : latestCorrectionEmailLog?.created_at
      ? new Date(latestCorrectionEmailLog.created_at).getTime()
      : 0;
  const approvalFinalActionBlocked = pendingSectionRows.length > 0;

  async function saveBonus(event) {
    event.preventDefault();
    setSavingBonus(true);
    setBonusMessage("");
    const nextBonus = Math.max(0, Number(bonusPoints) || 0);
    if (!demo) {
      await supabase.rpc("admin_update_submission_bonus", {
        p_token: adminToken,
        p_submission_id: item.id,
        p_bonus_points: nextBonus,
        p_bonus_note: bonusNote,
      });
    }
    setSavingBonus(false);
    setBonusMessage("Admin points saved. 管理员加分已保存。");
    onSaved?.();
  }

  function requestReview(row, value) {
    if (value === "approved" && row.evidence.length === 0) {
      setReviewMessage("Cannot approve without proof image. 此项目没有证明照片，不能批准。");
      setReviewMessageField(row.statusField);
      setConfirmReview(null);
      return;
    }
    if (value === "rejected" && rejectReasonField !== row.statusField) {
      setRejectReasonField(row.statusField);
      setReviewMessage("");
      setReviewMessageField("");
      setConfirmReview(null);
      return;
    }
    if (value === "rejected" && String(reasons[row.statusField] || "").trim().length < 3) {
      setReviewMessage("Please enter rejection reason first. 请先输入拒绝原因。");
      setReviewMessageField(row.statusField);
      return;
    }
    if (value === "approved") setRejectReasonField("");
    setReviewMessage("");
    setReviewMessageField("");
    setConfirmReview({ row, value });
  }

  async function confirmSectionReview() {
    if (!confirmReview) return;
    const { row, value } = confirmReview;
    const reason = String(reasons[row.statusField] || "").trim();
    setReviewBusy(true);
    if (!demo) {
      await supabase.rpc("admin_review_submission_section", {
        p_token: adminToken,
        p_submission_id: item.id,
        p_field: row.statusField,
        p_value: value,
        p_reason: value === "rejected" ? reason : null,
      });
    }
    setStatusOverrides((current) => ({ ...current, [row.statusField]: value }));
    setConfirmReview(null);
    setRejectReasonField("");
    setFinalReviewStatus("reviewing");
    setReviewBusy(false);
    setReviewMessage(value === "approved" ? "Section approved. 已批准此项目。" : "Section rejected. 已拒绝此项目。");
    setReviewMessageField(row.statusField);
    setCorrectionEmailMessage(value === "rejected" ? "Rejected section saved. Use final action to send one correction email. 已保存拒绝项目，请使用最终操作发送一次修正通知。" : "");
    if (value === "rejected") setConfirmCorrectionEmail(false);
    onSaved?.();
  }

  async function finalizeApprovedReview() {
    if (approvalFinalActionBlocked || !allSubmittedSectionsApproved) return;
    setFinalizingReview(true);
    setCorrectionEmailMessage("");
    try {
      if (!demo) {
        const { error } = await supabase.rpc("admin_finalize_submission_review", {
          p_token: adminToken,
          p_submission_id: item.id,
          p_value: "approved",
        });
        if (error) throw error;
      }
      setFinalReviewStatus("approved");
      setCorrectionEmailMessage("Submission finalized as approved. 已完成最终批准。");
      onSaved?.();
    } catch (error) {
      setCorrectionEmailMessage(`Final approval failed. 最终批准失败。 ${error.message || ""}`);
    } finally {
      setFinalizingReview(false);
    }
  }

  async function sendCorrectionEmail() {
    if (rejectedCorrections.length === 0) return;
    if (missingCorrectionReasons.length > 0) {
      setCorrectionEmailMessage("Every rejected section needs a reason before sending. 每个拒绝项目都需要原因。");
      setConfirmCorrectionEmail(false);
      return;
    }
    if (!confirmCorrectionEmail) {
      setConfirmCorrectionEmail(true);
      setCorrectionEmailMessage("");
      return;
    }
    setSendingCorrectionEmail(true);
    setCorrectionEmailMessage("");
    try {
      if (!demo) {
        const response = await fetch("/api/rejection-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: item.email,
            name: item.full_name,
            submissionId: item.id,
            week: item.week_label,
            rejectedSections: rejectedCorrections,
            approvedSections: approvedSectionLabels,
            origin: window.location.origin,
          }),
        });
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(errorText || "Unable to send correction email.");
        }
      }
      const sentAt = new Date().toISOString();
      if (!demo) {
        const { error } = await supabase.rpc("admin_finalize_submission_review", {
          p_token: adminToken,
          p_submission_id: item.id,
          p_value: "rejected",
        });
        if (error) throw error;
      }
      setCorrectionEmailSentAt(sentAt);
      setFinalReviewStatus("rejected");
      setConfirmCorrectionEmail(false);
      setCorrectionEmailMessage("Correction email sent and submission finalized as rejected. 修正通知已发送，并已完成最终拒绝。");
      onSaved?.();
    } catch (error) {
      setCorrectionEmailMessage(`Correction email failed. Please retry. 修正通知发送失败，请重试。 ${error.message || ""}`);
    } finally {
      setSendingCorrectionEmail(false);
    }
  }

  return createPortal(
    <div className="detail-backdrop" role="dialog" aria-modal="true">
      <section className="detail-panel submission-review-panel">
        <button className="icon-button detail-close" onClick={onClose} aria-label="Close details">
          <X />
        </button>
        <div className="submission-review-head">
          <div>
            <p>Submission details 提交详情</p>
            <h2>{item.full_name}</h2>
            <span>{item.week_label}</span>
          </div>
          <div className="score-badge large">
            <strong>{calculatedScore}</strong>
            <span>pts 分</span>
          </div>
        </div>

        <dl className="submission-summary-grid">
          <div><dt>Email 电邮</dt><dd>{item.email || "-"}</dd></div>
          <div><dt>Status 状态</dt><dd><span className={`status-pill ${currentReviewStatus.toLowerCase()}`}>{currentReviewStatus}</span></dd></div>
          <div><dt>Buddy team 伙伴组</dt><dd>{item.team_no || "-"}</dd></div>
          <div><dt>Submitted 提交时间</dt><dd>{item.submitted_at ? new Date(item.submitted_at).toLocaleString() : "-"}</dd></div>
        </dl>

        <div className="score-breakdown">
          <div><span>Approved section pts 已批准项目分</span><strong>{approvedSectionPoints}</strong></div>
          <div><span>Member monthly bonus 个人月加分</span><strong>{monthlyBonus}</strong></div>
          <div><span>Admin add-on 管理员加分</span><strong>{Number(bonusPoints || 0)}</strong></div>
          <div><span>Buddy team bonus 排行榜团队加分</span><strong>{teamBonusTotal}</strong></div>
        </div>

        <section className="team-bonus-panel">
          <div className="section-heading compact-heading">
            <Award />
            <div>
              <h3>Buddy team bonus 团队加分</h3>
              <p>Calculated at buddy-group level after final approval. 团队加分会在最终批准后，于伙伴组排行榜计算。</p>
            </div>
          </div>
          <p className="field-remark">
            Current buddy team bonus total: +{teamBonusTotal} pts. Full rule status belongs to the buddy group, not this individual submission.
            目前团队加分：+{teamBonusTotal} 分。完整规则状态归伙伴组，不归个人提交。
          </p>
        </section>

        <section className="section-review-list">
          <div className="section-heading compact-heading">
            <ShieldCheck />
            <div>
              <h3>Section review 分项审核</h3>
              <p>Only submitted sections above 0 need approval. 任一项目被拒绝，整体状态显示 Rejected。</p>
            </div>
          </div>
          {submittedSectionRows.length === 0 ? (
            <p className="empty-state">All five sections are 0. No approval needed. 五项全为 0，无需审核。</p>
          ) : (
            submittedSectionRows.map((row) => {
              const isConfirmingRow = confirmReview?.row?.statusField === row.statusField;
              const isRejectingRow = rejectReasonField === row.statusField || (isConfirmingRow && confirmReview.value === "rejected");
              const rowMessage = reviewMessage && reviewMessageField === row.statusField ? reviewMessage : "";
              return (
                <article className={`section-review-card ${row.status} ${isConfirmingRow ? "reviewing" : ""}`} key={row.kind}>
                  <div className="section-review-title">
                    <div>
                      <strong>{row.label} <small>{row.zh}</small></strong>
                      <span>{row.displayValue} · {row.points}/{row.potentialPoints} pts</span>
                    </div>
                    <em className={`status-pill ${row.status}`}>{row.status}</em>
                  </div>
                  <div className="proof-links">
                    {row.evidence.map((file) => <EvidenceLink file={file} key={file.id} />)}
                    {row.evidence.length === 0 && (
                      <span className={row.status === "approved" ? "missing-proof-alert" : ""}>
                        {row.status === "approved" ? "Approved without proof image 已批准但没有证明照片" : "No proof uploaded 暂无证明"}
                      </span>
                    )}
                  </div>
                  {isRejectingRow && (
                    <Label text="Reject reason 拒绝原因">
                      <input
                        value={reasons[row.statusField] || ""}
                        onChange={(event) => setReasons((current) => ({ ...current, [row.statusField]: event.target.value }))}
                        placeholder="Required when rejecting"
                      />
                    </Label>
                  )}
                  {rowMessage && <p className="section-review-message">{rowMessage}</p>}
                  {isConfirmingRow ? (
                    <div className={confirmReview.value === "approved" ? "confirm-box approve inline-confirm-box" : "confirm-box reject inline-confirm-box"}>
                      <strong>{confirmReview.value === "approved" ? "Confirm approve? 确认批准？" : "Confirm reject? 确认拒绝？"}</strong>
                      <span>{row.label} {row.zh} · {confirmReview.value === "approved" ? "Section will be marked approved. Final approval still required." : "Section will be marked rejected. Final correction email still required."}</span>
                      <div className="button-row">
                        <button className="ghost-button" type="button" onClick={() => setConfirmReview(null)}>Cancel 取消</button>
                        <button className={confirmReview.value === "approved" ? "primary-button" : "danger-button"} type="button" disabled={reviewBusy} onClick={confirmSectionReview}>
                          {reviewBusy ? <Loader2 className="spin" /> : confirmReview.value === "approved" ? <CheckCircle2 /> : <XCircle />}
                          Confirm 确认
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="section-review-actions">
                      <button className="danger-button" type="button" onClick={() => requestReview(row, "rejected")}><XCircle /> Reject 拒绝</button>
                      <button className="primary-button" type="button" onClick={() => requestReview(row, "approved")}><CheckCircle2 /> Approve 批准</button>
                    </div>
                  )}
                </article>
              );
            })
          )}
        </section>

        <section className="correction-email-panel">
          <div>
            <strong>Final review submit 最终审核提交</strong>
            <span>
              {rejectedSectionRows.length > 0
                ? "Rejected section(s) found. Finalize and send one compiled correction email."
                : approvalFinalActionBlocked
                ? "Finish all section reviews first. 请先完成所有分项审核。"
                  : "All submitted section(s) are approved. Finalize approval to count the score."}
            </span>
            {rejectedSectionRows.length > 0 && (
              <small>
                {rejectedCorrections.map((section) => `${section.label}: ${section.reason || "Missing reason"}`).join(" · ")}
              </small>
            )}
          </div>
          {rejectedSectionRows.length > 0 ? (
            <>
              {confirmCorrectionEmail && (
                <div className="confirm-box reject inline-confirm-box">
                  <strong>Finalize rejected and send email? 确认最终拒绝并发送修正通知？</strong>
                  <span>This sends one email with all rejected sections, then marks this submission as Rejected. 将一次性发送所有拒绝项目，然后标记为最终拒绝。</span>
                </div>
              )}
              <button className="danger-button" type="button" disabled={sendingCorrectionEmail || missingCorrectionReasons.length > 0} onClick={sendCorrectionEmail}>
                {sendingCorrectionEmail ? <Loader2 className="spin" /> : <Mail />}
                {latestEmailTime || finalReviewStatus === "rejected" ? "Resend correction email 重新发送修正通知" : "Finalize & send correction email 完成并发送修正通知"}
              </button>
              {missingCorrectionReasons.length > 0 && (
                <p className="section-review-message">Some rejected sections have no reason. 部分拒绝项目没有原因。</p>
              )}
            </>
          ) : (
            <button className="primary-button" type="button" disabled={approvalFinalActionBlocked || !allSubmittedSectionsApproved || finalizingReview} onClick={finalizeApprovedReview}>
              {finalizingReview ? <Loader2 className="spin" /> : <CheckCircle2 />}
              Finalize approval 完成批准
            </button>
          )}
          {correctionEmailMessage && <p className="notice">{correctionEmailMessage}</p>}
        </section>

        {allFiveSubmitted && (
          <p className="field-remark">
            New rule: all-five bonus is now awarded to the buddy team when both buddies qualify. 新规则：全勤加分归伙伴组排行榜。
          </p>
        )}

        <form className="admin-bonus-panel" onSubmit={saveBonus}>
          <Label text="Admin add-on pts 管理员加分">
            <input type="number" min="0" value={bonusPoints} onChange={(event) => setBonusPoints(event.target.value)} />
          </Label>
          <Label text="Admin note 备注">
            <input value={bonusNote} onChange={(event) => setBonusNote(event.target.value)} placeholder="Reason or remark" />
          </Label>
          <button className="primary-button" type="submit" disabled={savingBonus}>
            {savingBonus ? <Loader2 className="spin" /> : <Plus />}
            Save admin pts 保存加分
          </button>
          {bonusMessage && <p className="notice">{bonusMessage}</p>}
        </form>

        <section className="related-log-panel">
          <button className="related-log-toggle" type="button" onClick={() => setLogsExpanded((expanded) => !expanded)}>
            <span>Related logs 相关操作记录</span>
            <b>{relatedLogs.length} record(s)</b>
            <ChevronRight className={logsExpanded ? "open" : ""} />
          </button>
          {logsExpanded && (
            relatedLogs.length ? (
              <div className="action-log-list compact-action-log-list">
                {relatedLogs.map((log) => (
                  <article className="action-log-row" key={log.id}>
                    <div className="action-log-icon">{log.actor_type === "admin" ? "A" : "M"}</div>
                    <div>
                      <strong>{actionLogLabel(log.action)}</strong>
                      <span>{log.member_name || log.member_email || "No member"} · {log.week_label || "No week"}</span>
                      <small>{actionLogDetail(log)}</small>
                    </div>
                    <aside>
                      <b>{log.actor_email || log.actor_type}</b>
                      <span>{log.created_at ? new Date(log.created_at).toLocaleString() : "-"}</span>
                    </aside>
                  </article>
                ))}
              </div>
            ) : (
              <p className="empty-state">No related logs for this submission yet. 此提交暂无相关操作记录。</p>
            )
          )}
        </section>
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
