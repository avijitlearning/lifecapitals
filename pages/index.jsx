import { useState, useEffect } from "react";

/* ─────────────────────────────────────────────────────────────────────────────
   SUPABASE CONFIG — values come from Vercel environment variables
   ───────────────────────────────────────────────────────────────────────────── */
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_KEY;

/* ─────────────────────────────────────────────────────────────────────────────
   DATA LAYER
   Falls back to localStorage when Supabase keys are not present.
   ───────────────────────────────────────────────────────────────────────────── */
const isMock = !SUPABASE_URL || SUPABASE_URL === "YOUR_SUPABASE_URL";

const db = {
  async getUser(uid) {
    if (isMock) {
      const raw = localStorage.getItem(`lc_user_${uid}`);
      return raw ? JSON.parse(raw) : null;
    }
    const res = await fetch(`${SUPABASE_URL}/rest/v1/users?user_id=eq.${uid}&select=*`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
    });
    const rows = await res.json();
    return rows[0] || null;
  },

  async saveUser(uid, name, email) {
    if (isMock) {
      localStorage.setItem(`lc_user_${uid}`, JSON.stringify({ user_id: uid, name, email }));
      return;
    }
    await fetch(`${SUPABASE_URL}/rest/v1/users`, {
      method: "POST",
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates" },
      body: JSON.stringify({ user_id: uid, name, email }),
    });
  },

  async getReflections(uid) {
    if (isMock) {
      const raw = localStorage.getItem(`lc_reflections_${uid}`);
      return raw ? JSON.parse(raw) : {};
    }
    const res = await fetch(`${SUPABASE_URL}/rest/v1/reflections?user_id=eq.${uid}&select=*`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
    });
    const rows = await res.json();
    const map  = {};
    rows.forEach(r => { map[r.date] = r.data; });
    return map;
  },

  async saveReflection(uid, date, data) {
    if (isMock) {
      const raw  = localStorage.getItem(`lc_reflections_${uid}`) || "{}";
      const all  = JSON.parse(raw);
      all[date]  = data;
      localStorage.setItem(`lc_reflections_${uid}`, JSON.stringify(all));
      return;
    }
    await fetch(`${SUPABASE_URL}/rest/v1/reflections`, {
      method: "POST",
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates" },
      body: JSON.stringify({ user_id: uid, date, data }),
    });
  },

  async sendEmail(email, name, uid) {
    if (isMock || !email) return;
    try {
      await fetch("/api/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name, uid }),
      });
    } catch (e) {
      // silently fail — email is best-effort
    }
  },
};

/* ─── helpers ───────────────────────────────────────────────────────────────── */
const genUID = () => Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10);

const getUID = () => {
  let uid = localStorage.getItem("lc_uid");
  if (!uid) { uid = genUID(); localStorage.setItem("lc_uid", uid); }
  return uid;
};

const getTodayKey  = () => new Date().toISOString().split("T")[0];
const getDayType   = (avg, sliders) => {
  if (avg > 5) return "green";
  if (sliders && Object.values(sliders).some(v => v >= 8)) return "green";
  return "gray";
};
const getWeekDates = () => {
  const today = new Date(), day = today.getDay();
  const mon   = new Date(today); mon.setDate(today.getDate() - ((day + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(mon); d.setDate(mon.getDate() + i); return d.toISOString().split("T")[0];
  });
};
const fmtDate = (s) => new Date(s + "T12:00:00").toLocaleDateString("en-IN", { weekday:"short", day:"numeric", month:"short" });
const fmtFull = (s) => new Date(s + "T12:00:00").toLocaleDateString("en-IN", { weekday:"long",  day:"numeric", month:"long",  year:"numeric" });
const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
};

/* ─── constants ─────────────────────────────────────────────────────────────── */
const CAPITALS = [
  { id:"time",         label:"Time",             icon:"⏳" },
  { id:"energy",       label:"Energy & Health",  icon:"⚡" },
  { id:"career",       label:"Career",           icon:"🧭" },
  { id:"finance",      label:"Finance",          icon:"💎" },
  { id:"inner",        label:"Inner Well-Being", icon:"🌿" },
  { id:"relationship", label:"Relationship",     icon:"🤝" },
];
const GRAY_STOPPERS  = ["Fatigue","Overload","Emotional weight","Distraction","No clarity","Other"];
const EMPTY_SLIDERS  = { time:5, energy:5, career:5, finance:5, inner:5, relationship:5 };
const EMPTY_GREEN    = { assetMoved:"", whyMoved:"", protectRepeat:"" };
const EMPTY_GRAY     = { stoppers:[], otherStopper:"", smallestMove:"" };
const EMPTY_CHECK    = { energyLevel:5, dominantEmotion:"", replenished:"" };
const EMPTY_CLOSE    = { todayCounts:"" };

/* ─── design tokens ─────────────────────────────────────────────────────────── */
const C = {
  green:"#6dbf7e", greenDim:"#4a9e5c", greenBg:"rgba(74,140,87,0.09)", greenBord:"rgba(74,140,87,0.25)",
  gray:"#999",     grayBg:"rgba(110,110,110,0.07)", grayBord:"rgba(120,120,120,0.2)",
  red:"#c97878",   redBg:"rgba(180,80,80,0.08)",    redBord:"rgba(180,80,80,0.26)",
  amber:"#c9b46e",
  text:"#e8e0d4", muted:"#888", dim:"#555",
  bg:"#0d0d0d", surface:"#131313", surface2:"#181818", border:"#222",
};

const inputSt = {
  width:"100%", background:"#0a0a0a", border:`1px solid ${C.border}`,
  borderRadius:"8px", color:C.text, padding:"13px 14px",
  fontSize:"15px", fontFamily:"'Georgia',serif", outline:"none",
  boxSizing:"border-box", lineHeight:"1.5", WebkitAppearance:"none",
};
const secBox = (type, extraBorder) => ({
  padding:"20px", borderRadius:"12px", marginBottom:"16px",
  background: type==="green" ? C.greenBg : type==="red" ? C.redBg : `${C.surface}cc`,
  border:`1px solid ${extraBorder || (type==="green" ? C.greenBord : type==="red" ? C.redBord : C.border)}`,
});
const secLabel = (type) => ({
  fontSize:"10px", letterSpacing:"2.5px", textTransform:"uppercase", marginBottom:"3px",
  color: type==="green" ? C.greenDim : type==="red" ? "#b05050" : C.dim,
});
const fieldLbl = { fontSize:"13px", color:C.muted, marginBottom:"8px", display:"block", lineHeight:"1.4" };

/* ─── atoms ─────────────────────────────────────────────────────────────────── */
function TInput({ value, onChange, placeholder, rows=1, type="text" }) {
  return rows > 1
    ? <textarea value={value} onChange={onChange} placeholder={placeholder} rows={rows} style={{ ...inputSt, resize:"vertical" }} />
    : <input type={type} value={value} onChange={onChange} placeholder={placeholder} style={inputSt} />;
}
function F({ label, children }) {
  return <div style={{ marginBottom:"18px" }}><label style={fieldLbl}>{label}</label>{children}</div>;
}
function CapSlider({ cap, value, onChange }) {
  const col = value > 5 ? C.green : value >= 4 ? C.amber : C.red;
  return (
    <div style={{ marginBottom:"28px" }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"10px" }}>
        <div style={{ display:"flex", alignItems:"center", gap:"10px" }}>
          <span style={{ fontSize:"22px", lineHeight:1 }}>{cap.icon}</span>
          <span style={{ fontSize:"15px", color:"#ccc" }}>{cap.label}</span>
        </div>
        <span style={{ fontSize:"26px", fontWeight:"bold", color:col, transition:"color 0.2s", minWidth:"36px", textAlign:"right" }}>{value}</span>
      </div>
      <div style={{ position:"relative", height:"8px", background:"#1a1a1a", borderRadius:"4px" }}>
        <div style={{ position:"absolute", left:0, top:0, height:"100%", width:`${((value-1)/9)*100}%`, background:col, borderRadius:"4px", transition:"width 0.1s, background 0.3s" }} />
        <input type="range" min="1" max="10" value={value} onChange={e => onChange(+e.target.value)}
          style={{ position:"absolute", inset:0, width:"100%", opacity:0, cursor:"pointer", height:"100%", margin:0, touchAction:"none" }} />
      </div>
      <div style={{ display:"flex", justifyContent:"space-between", marginTop:"5px" }}>
        <span style={{ fontSize:"10px", color:"#2e2e2e" }}>1 — Low</span>
        <span style={{ fontSize:"10px", color:"#2e2e2e" }}>10 — High</span>
      </div>
    </div>
  );
}
function EnergySlider({ value, onChange }) {
  const col = value > 6 ? C.green : value > 3 ? C.amber : C.red;
  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"10px" }}>
        <span style={{ fontSize:"12px", color:C.dim }}>Low</span>
        <span style={{ fontSize:"26px", fontWeight:"bold", color:col }}>{value}<span style={{ fontSize:"13px", color:C.dim, fontWeight:"normal" }}>/10</span></span>
        <span style={{ fontSize:"12px", color:C.dim }}>High</span>
      </div>
      <div style={{ position:"relative", height:"8px", background:"#1a1a1a", borderRadius:"4px" }}>
        <div style={{ position:"absolute", left:0, top:0, height:"100%", width:`${((value-1)/9)*100}%`, background:col, borderRadius:"4px", transition:"width 0.1s, background 0.3s" }} />
        <input type="range" min="1" max="10" value={value} onChange={e => onChange(+e.target.value)}
          style={{ position:"absolute", inset:0, width:"100%", opacity:0, cursor:"pointer", height:"100%", margin:0, touchAction:"none" }} />
      </div>
    </div>
  );
}
function StopperChips({ selected, onChange, otherVal, onOtherChange }) {
  const toggle = o => selected.includes(o) ? onChange(selected.filter(x=>x!==o)) : onChange([...selected, o]);
  return (
    <div>
      <div style={{ display:"flex", flexWrap:"wrap", gap:"8px" }}>
        {GRAY_STOPPERS.map(o => {
          const active = selected.includes(o);
          return (
            <button key={o} onClick={() => toggle(o)} style={{
              padding:"9px 16px", borderRadius:"20px", cursor:"pointer", fontSize:"13px",
              background: active ? "rgba(180,80,80,0.2)" : C.surface2,
              color: active ? C.red : C.muted,
              border:`1px solid ${active ? "rgba(180,80,80,0.4)" : C.border}`,
              transition:"all 0.15s", WebkitTapHighlightColor:"transparent", touchAction:"manipulation",
            }}>{o}</button>
          );
        })}
      </div>
      {selected.includes("Other") && (
        <input type="text" value={otherVal} onChange={e => onOtherChange(e.target.value)}
          placeholder="Describe…" style={{ ...inputSt, marginTop:"10px" }} />
      )}
    </div>
  );
}

/* ─── onboarding modal ──────────────────────────────────────────────────────── */
function OnboardingModal({ onSave, loading }) {
  const [name,  setName]  = useState("");
  const [email, setEmail] = useState("");
  const [err,   setErr]   = useState("");

  const submit = () => {
    if (!name.trim()) { setErr("Please enter your name."); return; }
    setErr("");
    onSave(name.trim(), email.trim());
  };

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.85)", zIndex:100, display:"flex", alignItems:"center", justifyContent:"center", padding:"20px" }}>
      <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:"16px", padding:"28px 24px", width:"100%", maxWidth:"380px" }}>
        <div style={{ fontSize:"10px", letterSpacing:"3px", color:C.dim, textTransform:"uppercase", marginBottom:"8px" }}>Welcome</div>
        <div style={{ fontSize:"22px", marginBottom:"6px" }}>Life Capitals</div>
        <div style={{ fontSize:"13px", color:C.muted, lineHeight:"1.6", marginBottom:"28px" }}>
          Your daily reflection space. We'll create a personal link for you — save it to your home screen so you can return anytime.
        </div>

        <F label="What should we call you?">
          <TInput value={name} onChange={e => setName(e.target.value)} placeholder="Your first name" />
        </F>
        <F label="Your email — optional, just for your records">
          <TInput value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" type="email" />
        </F>

        {err && <div style={{ fontSize:"12px", color:C.red, marginBottom:"14px" }}>⚠ {err}</div>}

        <button onClick={submit} disabled={loading} style={{
          width:"100%", padding:"16px", borderRadius:"10px", cursor:"pointer",
          background:C.text, color:"#111", border:"none",
          fontSize:"13px", letterSpacing:"2px", textTransform:"uppercase",
          opacity: loading ? 0.6 : 1, transition:"opacity 0.2s",
          WebkitTapHighlightColor:"transparent", touchAction:"manipulation",
        }}>
          {loading ? "Setting up…" : "Get Started"}
        </button>

        <div style={{ fontSize:"11px", color:"#3a3a3a", textAlign:"center", marginTop:"14px", lineHeight:"1.6" }}>
          No password. No account. Just your personal link.
        </div>
      </div>
    </div>
  );
}

/* ─── add to home screen modal ──────────────────────────────────────────────── */
function HomeScreenModal({ onDismiss }) {
  const [copied, setCopied] = useState(false);
  const link = typeof window !== "undefined" ? window.location.href : "";
  const isIOS     = typeof navigator !== "undefined" && /iphone|ipad|ipod/i.test(navigator.userAgent);
  const isAndroid = typeof navigator !== "undefined" && /android/i.test(navigator.userAgent);

  const copy = () => {
    navigator.clipboard?.writeText(link).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const iosSteps = [
    { n:"1", t:"Tap the Share button", d:"The box with an arrow — at the bottom of Safari" },
    { n:"2", t:'Tap "Add to Home Screen"', d:"Scroll down the share sheet to find it" },
    { n:"3", t:"Tap Add", d:"It appears on your home screen like a real app" },
  ];
  const androidSteps = [
    { n:"1", t:"Tap the three-dot menu", d:"Top right corner of Chrome" },
    { n:"2", t:'Tap "Add to Home screen"', d:'Or "Install app" if you see that instead' },
    { n:"3", t:"Tap Add", d:"It appears on your home screen like a real app" },
  ];

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.88)", zIndex:100, display:"flex", alignItems:"flex-end", justifyContent:"center" }}>
      <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:"20px 20px 0 0", padding:"24px 22px 44px", width:"100%", maxWidth:"520px" }}>

        {/* Handle */}
        <div style={{ width:"36px", height:"4px", background:"#2a2a2a", borderRadius:"2px", margin:"0 auto 22px" }} />

        <div style={{ fontSize:"10px", letterSpacing:"3px", color:C.dim, textTransform:"uppercase", marginBottom:"5px" }}>Save for Later</div>
        <div style={{ fontSize:"20px", marginBottom:"5px" }}>Add to Home Screen</div>
        <div style={{ fontSize:"13px", color:C.muted, lineHeight:"1.6", marginBottom:"22px" }}>
          Open Life Capitals like any other app — no App Store needed. Your data loads instantly every time.
        </div>

        {/* iOS steps */}
        {isIOS && (
          <div style={{ background:C.surface2, border:`1px solid ${C.border}`, borderRadius:"12px", padding:"16px", marginBottom:"16px" }}>
            <div style={{ fontSize:"10px", color:C.amber, letterSpacing:"2px", textTransform:"uppercase", marginBottom:"14px" }}>iPhone / iPad — Safari</div>
            {iosSteps.map(({ n, t, d }) => (
              <div key={n} style={{ display:"flex", gap:"12px", marginBottom:"12px", alignItems:"flex-start" }}>
                <div style={{ minWidth:"22px", height:"22px", borderRadius:"50%", background:"rgba(201,180,110,0.15)", border:`1px solid rgba(201,180,110,0.3)`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                  <span style={{ fontSize:"11px", color:C.amber, fontWeight:"bold" }}>{n}</span>
                </div>
                <div>
                  <div style={{ fontSize:"13px", color:C.text }}>{t}</div>
                  <div style={{ fontSize:"12px", color:C.dim, marginTop:"2px" }}>{d}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Android steps */}
        {isAndroid && (
          <div style={{ background:C.surface2, border:`1px solid ${C.border}`, borderRadius:"12px", padding:"16px", marginBottom:"16px" }}>
            <div style={{ fontSize:"10px", color:C.green, letterSpacing:"2px", textTransform:"uppercase", marginBottom:"14px" }}>Android — Chrome</div>
            {androidSteps.map(({ n, t, d }) => (
              <div key={n} style={{ display:"flex", gap:"12px", marginBottom:"12px", alignItems:"flex-start" }}>
                <div style={{ minWidth:"22px", height:"22px", borderRadius:"50%", background:"rgba(109,191,126,0.12)", border:`1px solid rgba(109,191,126,0.3)`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                  <span style={{ fontSize:"11px", color:C.green, fontWeight:"bold" }}>{n}</span>
                </div>
                <div>
                  <div style={{ fontSize:"13px", color:C.text }}>{t}</div>
                  <div style={{ fontSize:"12px", color:C.dim, marginTop:"2px" }}>{d}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Desktop / generic */}
        {!isIOS && !isAndroid && (
          <div style={{ background:C.surface2, border:`1px solid ${C.border}`, borderRadius:"12px", padding:"16px", marginBottom:"16px" }}>
            <div style={{ fontSize:"10px", color:C.dim, letterSpacing:"2px", textTransform:"uppercase", marginBottom:"8px" }}>Your Personal Link</div>
            <div style={{ fontSize:"12px", color:C.muted, marginBottom:"10px" }}>Bookmark this URL to return from any device.</div>
            <div style={{ background:"#0a0a0a", borderRadius:"6px", padding:"10px 12px", fontSize:"12px", color:"#555", fontFamily:"monospace", wordBreak:"break-all" }}>
              {link}
            </div>
          </div>
        )}

        <button onClick={copy} style={{
          width:"100%", padding:"14px", borderRadius:"10px", cursor:"pointer", marginBottom:"10px",
          background: copied ? C.greenBg : C.surface2,
          color: copied ? C.green : C.muted,
          border:`1px solid ${copied ? C.greenBord : C.border}`,
          fontSize:"13px", letterSpacing:"1px", touchAction:"manipulation", transition:"all 0.2s",
        }}>
          {copied ? "✓ Link Copied" : "Copy My Personal Link"}
        </button>

        <button onClick={onDismiss} style={{
          width:"100%", padding:"14px", borderRadius:"10px", cursor:"pointer",
          background:"transparent", color:C.dim, border:`1px solid ${C.border}`,
          fontSize:"13px", letterSpacing:"1px", touchAction:"manipulation",
        }}>
          Done
        </button>
      </div>
    </div>
  );
}

/* ─── weekly analytics ──────────────────────────────────────────────────────── */
function getWeeklyPatterns(history) {
  const entries = getWeekDates().map(d => history[d]).filter(Boolean);
  if (!entries.length) return null;
  const totals = {};
  CAPITALS.forEach(c => { totals[c.id] = { sum:0, count:0 }; });
  entries.forEach(e => CAPITALS.forEach(c => { totals[c.id].sum += e.sliders[c.id]||0; totals[c.id].count++; }));
  const avgs = CAPITALS.map(c => ({ ...c, avg: totals[c.id].count ? totals[c.id].sum/totals[c.id].count : 0 })).sort((a,b)=>b.avg-a.avg);
  return {
    capitalAvgs: avgs, greenAsset: avgs[0], neglectedAsset: avgs[avgs.length-1],
    greenDays: entries.filter(e => getDayType(e.avg,e.sliders)==="green").length,
    grayDays:  entries.filter(e => getDayType(e.avg,e.sliders)==="gray").length,
    totalDays: entries.length,
  };
}

/* ─── weekly panel ──────────────────────────────────────────────────────────── */
function WeeklyPanel({ history }) {
  const p = getWeeklyPatterns(history);
  if (!p) return (
    <div style={{ padding:"60px 16px", textAlign:"center", color:"#333", fontSize:"14px" }}>
      No data this week yet.<br /><span style={{ fontSize:"12px", marginTop:"8px", display:"block" }}>Complete a reflection to start tracking.</span>
    </div>
  );
  return (
    <div style={{ padding:"20px 16px 100px" }}>
      <div style={{ fontSize:"10px", letterSpacing:"2.5px", color:C.dim, textTransform:"uppercase", marginBottom:"20px" }}>Weekly Pattern Awareness</div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:"10px", marginBottom:"16px" }}>
        {[
          { label:"Green Days", val:p.greenDays, col:C.green, bg:C.greenBg, bord:C.greenBord },
          { label:"Gray Days",  val:p.grayDays,  col:C.gray,  bg:C.grayBg,  bord:C.grayBord  },
          { label:"Logged",     val:p.totalDays, col:C.amber, bg:"rgba(201,180,110,0.07)", bord:"rgba(201,180,110,0.22)" },
        ].map(({ label, val, col, bg, bord }) => (
          <div key={label} style={{ background:bg, border:`1px solid ${bord}`, borderRadius:"12px", padding:"14px 10px", textAlign:"center" }}>
            <div style={{ fontSize:"28px", fontWeight:"bold", color:col }}>{val}</div>
            <div style={{ fontSize:"10px", color:C.dim, marginTop:"3px" }}>{label}</div>
          </div>
        ))}
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"10px", marginBottom:"16px" }}>
        <div style={{ background:C.greenBg, border:`1px solid ${C.greenBord}`, borderRadius:"12px", padding:"16px" }}>
          <div style={{ fontSize:"10px", color:C.greenDim, letterSpacing:"2px", textTransform:"uppercase", marginBottom:"8px" }}>Most Green</div>
          <div style={{ fontSize:"22px" }}>{p.greenAsset.icon}</div>
          <div style={{ fontSize:"13px", color:"#ccc", marginTop:"4px" }}>{p.greenAsset.label}</div>
          <div style={{ fontSize:"22px", fontWeight:"bold", color:C.green, marginTop:"2px" }}>{p.greenAsset.avg.toFixed(1)}</div>
        </div>
        <div style={{ background:C.redBg, border:`1px solid ${C.redBord}`, borderRadius:"12px", padding:"16px" }}>
          <div style={{ fontSize:"10px", color:"#b05050", letterSpacing:"2px", textTransform:"uppercase", marginBottom:"8px" }}>Most Neglected</div>
          <div style={{ fontSize:"22px" }}>{p.neglectedAsset.icon}</div>
          <div style={{ fontSize:"13px", color:"#ccc", marginTop:"4px" }}>{p.neglectedAsset.label}</div>
          <div style={{ fontSize:"22px", fontWeight:"bold", color:C.red, marginTop:"2px" }}>{p.neglectedAsset.avg.toFixed(1)}</div>
        </div>
      </div>
      <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:"12px", padding:"18px" }}>
        <div style={{ fontSize:"10px", color:C.dim, letterSpacing:"2px", textTransform:"uppercase", marginBottom:"18px" }}>All Capitals — Weekly Avg</div>
        {p.capitalAvgs.map(cap => {
          const col = cap.avg > 5 ? C.green : cap.avg >= 4 ? C.amber : C.red;
          return (
            <div key={cap.id} style={{ marginBottom:"18px" }}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:"7px" }}>
                <span style={{ fontSize:"14px", color:C.muted }}>{cap.icon} {cap.label}</span>
                <span style={{ fontSize:"14px", fontWeight:"bold", color:col }}>{cap.avg.toFixed(1)}</span>
              </div>
              <div style={{ height:"6px", background:"#1a1a1a", borderRadius:"3px" }}>
                <div style={{ height:"100%", width:`${((cap.avg-1)/9)*100}%`, background:col, borderRadius:"3px" }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── history detail ────────────────────────────────────────────────────────── */
function HistoryDetail({ entry, date, onBack }) {
  const isGreen = getDayType(entry.avg, entry.sliders) === "green";
  const NoteRow = ({ label, value }) => !value ? null : (
    <div style={{ marginBottom:"14px" }}>
      <div style={{ fontSize:"10px", color:C.dim, letterSpacing:"2px", textTransform:"uppercase", marginBottom:"4px" }}>{label}</div>
      <div style={{ fontSize:"14px", color:C.muted, lineHeight:"1.7" }}>{value}</div>
    </div>
  );
  return (
    <div style={{ padding:"20px 16px 100px" }}>
      <button onClick={onBack} style={{ background:"transparent", border:"none", color:C.dim, fontSize:"13px", cursor:"pointer", padding:"0 0 20px", display:"flex", alignItems:"center", gap:"6px", touchAction:"manipulation" }}>← Back</button>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"24px", padding:"18px", background: isGreen ? C.greenBg : C.grayBg, border:`1px solid ${isGreen ? C.greenBord : C.grayBord}`, borderRadius:"12px" }}>
        <div>
          <div style={{ fontSize:"11px", color:C.dim, letterSpacing:"1.5px", textTransform:"uppercase", marginBottom:"5px" }}>{fmtDate(date)}</div>
          <div style={{ fontSize:"20px", color: isGreen ? C.green : C.gray }}>{isGreen ? "🟢 Green Day" : "⬜ Gray Day"}</div>
        </div>
        <div style={{ textAlign:"right" }}>
          <div style={{ fontSize:"36px", fontWeight:"bold", color: isGreen ? C.green : "#666" }}>{entry.avg.toFixed(1)}</div>
          <div style={{ fontSize:"11px", color:"#444" }}>avg / 10</div>
        </div>
      </div>
      <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:"12px", padding:"18px", marginBottom:"16px" }}>
        {CAPITALS.map(cap => {
          const val = entry.sliders[cap.id];
          const col = val > 5 ? C.green : val >= 4 ? C.amber : C.red;
          return (
            <div key={cap.id} style={{ marginBottom:"16px" }}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:"7px" }}>
                <span style={{ fontSize:"14px", color:C.muted }}>{cap.icon} {cap.label}</span>
                <span style={{ fontSize:"15px", fontWeight:"bold", color:col }}>{val}</span>
              </div>
              <div style={{ height:"5px", background:"#1a1a1a", borderRadius:"3px" }}>
                <div style={{ height:"100%", width:`${((val-1)/9)*100}%`, background:col, borderRadius:"3px" }} />
              </div>
            </div>
          );
        })}
      </div>
      {isGreen && entry.green && (entry.green.assetMoved||entry.green.whyMoved||entry.green.protectRepeat) && (
        <div style={{ ...secBox("green"), marginBottom:"16px" }}>
          <div style={secLabel("green")}>🟢 Green Day Reflection</div>
          <div style={{ height:"12px" }} />
          <NoteRow label="Asset that moved most" value={entry.green.assetMoved} />
          <NoteRow label="What allowed it" value={entry.green.whyMoved} />
          <NoteRow label="Protect or repeat" value={entry.green.protectRepeat} />
        </div>
      )}
      {!isGreen && entry.gray && (entry.gray.stoppers?.length||entry.gray.smallestMove) && (
        <div style={{ ...secBox("red"), marginBottom:"16px" }}>
          <div style={secLabel("red")}>⬜ Gray Day Reflection</div>
          <div style={{ height:"12px" }} />
          {entry.gray.stoppers?.length > 0 && <NoteRow label="What stopped movement" value={[...entry.gray.stoppers.filter(s=>s!=="Other"), entry.gray.otherStopper].filter(Boolean).join(", ")} />}
          <NoteRow label="Smallest move for tomorrow" value={entry.gray.smallestMove} />
        </div>
      )}
      {entry.check && (
        <div style={{ ...secBox("neutral"), marginBottom:"16px" }}>
          <div style={secLabel("neutral")}>⚡ Energy & Emotion</div>
          <div style={{ height:"12px" }} />
          <div style={{ display:"flex", gap:"6px", marginBottom:"12px", flexWrap:"wrap" }}>
            {Array.from({length:10},(_,i)=>i+1).map(n=>(
              <div key={n} style={{ width:"18px", height:"18px", borderRadius:"50%", background: n<=entry.check.energyLevel ? C.green : "#1e1e1e" }} />
            ))}
            <span style={{ fontSize:"13px", color:C.green, marginLeft:"4px", alignSelf:"center" }}>{entry.check.energyLevel}/10</span>
          </div>
          <NoteRow label="Dominant emotion" value={entry.check.dominantEmotion} />
          <NoteRow label="What replenished me" value={entry.check.replenished} />
        </div>
      )}
      {entry.close?.todayCounts && (
        <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:"12px", padding:"18px" }}>
          <div style={{ fontSize:"10px", color:C.dim, letterSpacing:"2px", textTransform:"uppercase", marginBottom:"8px" }}>Today counts because…</div>
          <div style={{ fontSize:"15px", color:C.muted, fontStyle:"italic", lineHeight:"1.7" }}>"{entry.close.todayCounts}"</div>
        </div>
      )}
    </div>
  );
}

/* ─── history list ──────────────────────────────────────────────────────────── */
function HistoryList({ history, onSelect }) {
  const entries = Object.entries(history).sort((a,b) => b[0].localeCompare(a[0]));
  if (!entries.length) return (
    <div style={{ padding:"60px 16px", textAlign:"center", color:"#333", fontSize:"14px" }}>
      No reflections yet.<br /><span style={{ fontSize:"12px", marginTop:"8px", display:"block" }}>Save today's reflection to start your log.</span>
    </div>
  );
  return (
    <div style={{ padding:"20px 16px 100px" }}>
      <div style={{ fontSize:"10px", letterSpacing:"2.5px", color:C.dim, textTransform:"uppercase", marginBottom:"20px" }}>Past Reflections</div>
      <div style={{ display:"flex", flexDirection:"column", gap:"10px" }}>
        {entries.map(([date, entry]) => {
          const isGreen = getDayType(entry.avg, entry.sliders) === "green";
          return (
            <button key={date} onClick={() => onSelect(date)} style={{
              background:C.surface, border:`1px solid ${C.border}`, borderRadius:"12px",
              padding:"16px 18px", cursor:"pointer", textAlign:"left",
              display:"flex", alignItems:"center", justifyContent:"space-between",
              WebkitTapHighlightColor:"transparent", touchAction:"manipulation",
            }}>
              <div style={{ display:"flex", alignItems:"center", gap:"14px" }}>
                <span style={{ fontSize:"20px" }}>{isGreen ? "🟢" : "⬜"}</span>
                <div>
                  <div style={{ fontSize:"15px", color:"#ccc" }}>{fmtDate(date)}</div>
                  <div style={{ fontSize:"12px", color: isGreen ? C.greenDim : "#666", marginTop:"2px" }}>
                    {isGreen ? "Green Day" : "Gray Day"}{entry.close?.todayCounts ? " · has close" : ""}
                  </div>
                </div>
              </div>
              <div style={{ textAlign:"right" }}>
                <div style={{ fontSize:"22px", fontWeight:"bold", color: isGreen ? C.green : "#555" }}>{entry.avg.toFixed(1)}</div>
                <div style={{ fontSize:"10px", color:"#333" }}>avg</div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ─── today view ────────────────────────────────────────────────────────────── */
function TodayView({ history, setHistory, uid, userName }) {
  const today = getTodayKey();
  const existing = history[today];

  const [sliders, setSliders] = useState(existing?.sliders || { ...EMPTY_SLIDERS });
  const [green,   setGreenS]  = useState(existing?.green   || { ...EMPTY_GREEN });
  const [gray,    setGrayS]   = useState(existing?.gray    || { ...EMPTY_GRAY  });
  const [check,   setCheckS]  = useState(existing?.check   || { ...EMPTY_CHECK });
  const [close,   setCloseS]  = useState(existing?.close   || { ...EMPTY_CLOSE });
  const [saved,   setSaved]   = useState(!!existing);
  const [errors,  setErrors]  = useState({});
  const [saving,  setSaving]  = useState(false);

  const avg     = Object.values(sliders).reduce((a,b)=>a+b,0)/6;
  const isGreen = getDayType(avg, sliders) === "green";

  const dirty = () => { setSaved(false); setErrors({}); };
  const setG  = k => v => { setGreenS(p=>({...p,[k]:v})); dirty(); };
  const setGr = k => v => { setGrayS(p=>({...p,[k]:v}));  dirty(); };
  const setCh = k => v => { setCheckS(p=>({...p,[k]:v})); dirty(); };
  const setCl = k => v => { setCloseS(p=>({...p,[k]:v})); dirty(); };

  const handleSave = async () => {
    const errs = {};
    if (!isGreen) {
      if (!gray.stoppers.length)     errs.stoppers     = true;
      if (!gray.smallestMove.trim()) errs.smallestMove = true;
    }
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setErrors({}); setSaving(true);
    const entry = { sliders, avg:parseFloat(avg.toFixed(2)), green:isGreen?green:null, gray:isGreen?null:gray, check, close, savedAt:new Date().toISOString() };
    await db.saveReflection(uid, today, entry);
    const next = { ...history, [today]: entry };
    setHistory(next);
    setSaved(true); setSaving(false);
  };

  return (
    <div style={{ padding:"16px 16px 120px" }}>
      <div style={{ marginBottom:"20px" }}>
        <div style={{ fontSize:"13px", color:C.dim }}>{greeting()},</div>
        <div style={{ fontSize:"22px", color:C.text, marginTop:"2px" }}>{userName} ✦</div>
      </div>

      <div style={{
        display:"flex", alignItems:"center", justifyContent:"space-between",
        marginBottom:"24px", padding:"18px",
        background: isGreen ? C.greenBg : C.grayBg,
        border:`1px solid ${isGreen ? C.greenBord : C.grayBord}`,
        borderRadius:"12px", transition:"all 0.5s",
      }}>
        <div>
          <div style={{ fontSize:"10px", color:C.dim, letterSpacing:"1.5px", textTransform:"uppercase", marginBottom:"5px" }}>{fmtFull(today)}</div>
          <div style={{ fontSize:"20px", color: isGreen ? C.green : C.gray, transition:"color 0.4s" }}>{isGreen ? "🟢 Green Day" : "⬜ Gray Day"}</div>
          <div style={{ fontSize:"11px", color:"#444", marginTop:"3px" }}>{isGreen ? "avg > 5 or one capital ≥ 8" : "avg ≤ 5 and no capital ≥ 8"}</div>
        </div>
        <div style={{ textAlign:"right" }}>
          <div style={{ fontSize:"40px", fontWeight:"bold", lineHeight:1, color: isGreen ? C.green : "#666", transition:"color 0.4s" }}>{avg.toFixed(1)}</div>
          <div style={{ fontSize:"11px", color:"#444", marginTop:"3px" }}>avg / 10</div>
        </div>
      </div>

      <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:"12px", padding:"20px", marginBottom:"16px" }}>
        <div style={{ fontSize:"10px", letterSpacing:"2.5px", color:C.dim, textTransform:"uppercase", marginBottom:"20px" }}>Rate Your Capitals</div>
        {CAPITALS.map(cap => (
          <CapSlider key={cap.id} cap={cap} value={sliders[cap.id]}
            onChange={v => { setSliders(s=>({...s,[cap.id]:v})); dirty(); }} />
        ))}
      </div>

      {isGreen && (
        <div style={secBox("green")}>
          <div style={secLabel("green")}>🟢 Green Day Reflection</div>
          <div style={{ fontSize:"11px", color:"#3d6647", marginBottom:"18px" }}>Optional — answer briefly</div>
          <F label="Which asset moved the most today?">
            <TInput value={green.assetMoved} onChange={e=>setG("assetMoved")(e.target.value)} placeholder="e.g. Career, Inner Well-Being…" />
          </F>
          <F label="What allowed that movement to happen?">
            <TInput value={green.whyMoved} onChange={e=>setG("whyMoved")(e.target.value)} placeholder="e.g. I was well-rested, had clear priorities…" />
          </F>
          <F label="What should I protect or repeat tomorrow?">
            <TInput value={green.protectRepeat} onChange={e=>setG("protectRepeat")(e.target.value)} placeholder="e.g. Morning reading, no phone before noon…" />
          </F>
        </div>
      )}

      {!isGreen && (
        <div style={{ ...secBox("red"), border:`1px solid ${(errors.stoppers||errors.smallestMove) ? "rgba(200,80,80,0.55)" : C.redBord}` }}>
          <div style={{ display:"flex", alignItems:"center", gap:"8px", marginBottom:"3px", flexWrap:"wrap" }}>
            <div style={secLabel("red")}>⬜ Gray Day Reflection</div>
            <span style={{ fontSize:"10px", background:"rgba(180,80,80,0.18)", color:C.red, padding:"2px 9px", borderRadius:"10px", fontFamily:"sans-serif" }}>Required</span>
          </div>
          <div style={{ fontSize:"12px", color:"#7a4a4a", marginBottom:"18px" }}>Gray days are information, not failure.</div>
          <F label="What stopped movement today? (select all that apply)">
            <StopperChips selected={gray.stoppers} onChange={setGr("stoppers")} otherVal={gray.otherStopper} onOtherChange={setGr("otherStopper")} />
            {errors.stoppers && <div style={{ fontSize:"12px", color:C.red, marginTop:"8px" }}>⚠ Select at least one.</div>}
          </F>
          <F label="Smallest movement I can plan for tomorrow? (5–15 min is enough)">
            <TInput value={gray.smallestMove} onChange={e=>setGr("smallestMove")(e.target.value)} placeholder="e.g. 10 min of journaling before work…" />
            {errors.smallestMove && <div style={{ fontSize:"12px", color:C.red, marginTop:"8px" }}>⚠ Describe your smallest step.</div>}
          </F>
        </div>
      )}

      <div style={secBox("neutral")}>
        <div style={secLabel("neutral")}>⚡ Energy & Emotion Check</div>
        <div style={{ height:"14px" }} />
        <F label="Energy level today">
          <EnergySlider value={check.energyLevel} onChange={setCh("energyLevel")} />
        </F>
        <F label="Dominant emotion today">
          <TInput value={check.dominantEmotion} onChange={e=>setCh("dominantEmotion")(e.target.value)} placeholder="e.g. Calm, Anxious, Grateful, Restless…" />
        </F>
        <F label="What replenished me today (even slightly)?">
          <TInput value={check.replenished} onChange={e=>setCh("replenished")(e.target.value)} placeholder="e.g. A walk, a good conversation, music…" />
        </F>
      </div>

      <div style={{ ...secBox("neutral"), marginBottom:"24px" }}>
        <div style={secLabel("neutral")}>🌙 One Gentle Close</div>
        <div style={{ fontSize:"12px", color:C.dim, margin:"6px 0 14px" }}>Complete one sentence:</div>
        <div style={{ fontSize:"13px", color:C.muted, marginBottom:"8px" }}>Today counts because…</div>
        <TInput value={close.todayCounts} onChange={e=>setCl("todayCounts")(e.target.value)} placeholder="I showed up. I noticed. I kept going." />
      </div>

      <button onClick={handleSave} disabled={saving} style={{
        width:"100%", padding:"18px", borderRadius:"10px", cursor:"pointer",
        background: saved ? "transparent" : isGreen ? "rgba(74,140,87,0.16)" : C.text,
        color: saved ? "#444" : isGreen ? C.green : "#111",
        border:`1px solid ${saved ? "#2a2a2a" : isGreen ? "rgba(74,140,87,0.45)" : C.text}`,
        fontSize:"13px", letterSpacing:"3px", textTransform:"uppercase",
        transition:"all 0.3s", opacity: saving ? 0.6 : 1,
        WebkitTapHighlightColor:"transparent", touchAction:"manipulation",
      }}>
        {saving ? "Saving…" : saved ? "✓ Reflection Saved" : "Save Today's Reflection"}
      </button>
    </div>
  );
}

/* ─── root ──────────────────────────────────────────────────────────────────── */
export default function App() {
  const [view,           setView]           = useState("today");
  const [history,        setHistory]        = useState({});
  const [activeDay,      setActiveDay]      = useState(null);
  const [user,           setUser]           = useState(null);
  const [loading,        setLoading]        = useState(true);
  const [onboarding,     setOnboarding]     = useState(false);
  const [savingUser,     setSavingUser]     = useState(false);
  const [showHomeScreen, setShowHomeScreen] = useState(false);

  useEffect(() => {
    (async () => {
      const uid      = getUID();
      const userData = await db.getUser(uid);
      if (userData) {
        setUser({ ...userData, uid });
        const reflections = await db.getReflections(uid);
        setHistory(reflections);
        const dismissed = sessionStorage.getItem("lc_hs_dismissed");
        if (!dismissed) setShowHomeScreen(true);
      } else {
        setOnboarding(true);
      }
      setLoading(false);
    })();
  }, []);

  const handleOnboard = async (name, email) => {
    setSavingUser(true);
    const uid = getUID();
    await db.saveUser(uid, name, email);
    db.sendEmail(email, name, uid).catch(() => {}); // fire and forget
    setUser({ name, email, uid });
    setOnboarding(false);
    setShowHomeScreen(true);
    setSavingUser(false);
  };

  const tabs = [
    { id:"today",   icon:"✦", label:"Today"   },
    { id:"history", icon:"◷", label:"History" },
    { id:"weekly",  icon:"◈", label:"Weekly"  },
  ];

  if (loading) return (
    <div style={{ minHeight:"100vh", background:C.bg, display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div style={{ fontSize:"13px", color:C.dim, letterSpacing:"2px" }}>Loading…</div>
    </div>
  );

  return (
    <div style={{ minHeight:"100vh", background:C.bg, fontFamily:"'Georgia','Times New Roman',serif", color:C.text, maxWidth:"520px", margin:"0 auto", position:"relative" }}>

      {onboarding && <OnboardingModal onSave={handleOnboard} loading={savingUser} />}
      {showHomeScreen && <HomeScreenModal onDismiss={() => { setShowHomeScreen(false); sessionStorage.setItem("lc_hs_dismissed","1"); }} />}

      {/* Sticky header */}
      <div style={{ position:"sticky", top:0, zIndex:20, background:`${C.surface}f0`, borderBottom:`1px solid ${C.border}`, backdropFilter:"blur(10px)", padding:"14px 18px 12px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <div>
          <div style={{ fontSize:"9px", letterSpacing:"3px", color:"#3a3a3a", textTransform:"uppercase" }}>Daily Reflection</div>
          <div style={{ fontSize:"20px", fontWeight:"normal", letterSpacing:"-0.3px", marginTop:"1px" }}>Life Capitals</div>
        </div>
        <div style={{ display:"flex", gap:"8px", alignItems:"center" }}>
          {view === "history" && activeDay && (
            <button onClick={() => setActiveDay(null)} style={{ background:"transparent", border:`1px solid ${C.border}`, borderRadius:"20px", color:C.dim, fontSize:"12px", padding:"6px 14px", cursor:"pointer", touchAction:"manipulation" }}>
              ← Back
            </button>
          )}
          <button onClick={() => setShowHomeScreen(true)} title="Save to home screen" style={{
            background:"transparent", border:`1px solid ${C.border}`, borderRadius:"20px",
            color:C.dim, fontSize:"16px", padding:"5px 10px", cursor:"pointer",
            touchAction:"manipulation", lineHeight:1,
          }}>
            📲
          </button>
        </div>
      </div>

      {/* Content */}
      <div>
        {view === "today" && user && (
          <TodayView history={history} setHistory={setHistory} uid={user.uid} userName={user.name} />
        )}
        {view === "history" && !activeDay && <HistoryList history={history} onSelect={setActiveDay} />}
        {view === "history" && activeDay && history[activeDay] && (
          <HistoryDetail entry={history[activeDay]} date={activeDay} onBack={() => setActiveDay(null)} />
        )}
        {view === "weekly" && <WeeklyPanel history={history} />}
      </div>

      {/* Bottom tab bar */}
      <div style={{
        position:"fixed", bottom:0, left:"50%", transform:"translateX(-50%)",
        width:"100%", maxWidth:"520px",
        background:`${C.surface}f5`, borderTop:`1px solid ${C.border}`,
        backdropFilter:"blur(12px)", display:"flex", zIndex:30,
        paddingBottom:"env(safe-area-inset-bottom, 0px)",
      }}>
        {tabs.map(({ id, icon, label }) => {
          const active = view === id;
          return (
            <button key={id} onClick={() => { setView(id); setActiveDay(null); }} style={{
              flex:1, padding:"12px 0 10px", background:"transparent", border:"none", cursor:"pointer",
              display:"flex", flexDirection:"column", alignItems:"center", gap:"3px",
              WebkitTapHighlightColor:"transparent", touchAction:"manipulation",
            }}>
              <span style={{ fontSize:"18px", opacity: active ? 1 : 0.35, transition:"opacity 0.2s" }}>{icon}</span>
              <span style={{ fontSize:"10px", letterSpacing:"1.5px", textTransform:"uppercase", color: active ? C.text : C.dim, transition:"color 0.2s" }}>{label}</span>
              {active && <div style={{ width:"16px", height:"2px", background:C.text, borderRadius:"1px", marginTop:"1px" }} />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
