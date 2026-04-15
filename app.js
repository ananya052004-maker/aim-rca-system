// ═══════════════════════════════════════════════════
// SUPABASE CONFIG  ← put your real keys here
// ═══════════════════════════════════════════════════
const SUPABASE_URL      = "https://csffomaxurybhakydrfp.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_4hYcm9rpSNibiP1WEZHx0w_aBeFZunY";
if (!window.supabaseClient) {
  window.supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY
  );
}
var supabase = window.supabaseClient;

// ═══════════════════════════════════════════════════
// GLOBAL STATE
// ═══════════════════════════════════════════════════
let incidents   = [];   // holds all rows fetched from Supabase
let currentUser = {};   // set on login
let activityLog = [];   // in-memory activity feed

// ═══════════════════════════════════════════════════
// RCA KNOWLEDGE BASE
// ═══════════════════════════════════════════════════
const rcaData = {
  "Server Failure": {
    causes: [
      { prob:"82%", level:"high",  title:"Hardware Fault",       desc:"Physical server component failure — disk, RAM, or CPU degradation detected" },
      { prob:"61%", level:"med",   title:"OS / Kernel Panic",    desc:"Critical OS-level error caused unplanned server shutdown" },
      { prob:"34%", level:"low-p", title:"Power Supply Issue",   desc:"Intermittent power delivery caused unexpected server restart" },
    ],
    history: ["3 similar server failures in past 90 days", "Pattern: failures cluster on weekday peak hours", "Last occurrence resolved via hardware replacement"],
    deps:    ["User → Load Balancer → App Server → DB Server", "Monitoring Agent → Alert System → On-call Team"],
    actions: ["Replace or hot-swap faulty hardware component", "Enable redundant power supply (UPS)", "Set up automated server health checks every 5 min", "Review and test failover / backup server configuration"],
  },
  "Network Outage": {
    causes: [
      { prob:"78%", level:"high",  title:"Router / Switch Failure", desc:"Core network device failure disrupted packet routing" },
      { prob:"55%", level:"med",   title:"BGP Route Flap",          desc:"Dynamic routing instability caused intermittent connectivity loss" },
      { prob:"28%", level:"low-p", title:"ISP-Side Issue",          desc:"Upstream provider reported service degradation in the region" },
    ],
    history: ["2 outages this month — both during maintenance windows", "Previous fix: firmware update on core switch", "Avg resolution time: 47 minutes"],
    deps:    ["Client → ISP → Core Router → Distribution Switch → Access Switch → Servers"],
    actions: ["Perform emergency firmware update on affected router", "Activate backup ISP link / SD-WAN failover", "Check and restore BGP peer sessions", "Document and review maintenance change procedure"],
  },
  "Authentication Error": {
    causes: [
      { prob:"80%", level:"high",  title:"Token / Session Expiry",  desc:"Auth tokens expired without proper refresh logic causing user lockouts" },
      { prob:"58%", level:"med",   title:"LDAP / AD Sync Failure",  desc:"Directory service out of sync — stale credentials rejected at login" },
      { prob:"25%", level:"low-p", title:"Clock Skew",              desc:"Server time drift invalidated JWT signatures across services" },
    ],
    history: ["Auth errors spike every Monday morning (batch job interference)", "Related ticket: INC-0041 — SSO misconfiguration", "Pattern: affects users in APAC region primarily"],
    deps:    ["Client App → Auth Service → LDAP/AD → Token Store → API Gateway"],
    actions: ["Rotate and reissue expired tokens immediately", "Force-sync Active Directory / LDAP replica", "Enable NTP time sync on all auth servers", "Implement silent token refresh in client SDK"],
  },
  "Database Crash": {
    causes: [
      { prob:"85%", level:"high",  title:"Disk Space Exhaustion",  desc:"Transaction logs filled the disk volume — DB engine halted writes" },
      { prob:"60%", level:"med",   title:"Memory Overflow (OOM)",  desc:"Query cache exceeded allocated RAM; OS killed the DB process" },
      { prob:"35%", level:"low-p", title:"Corrupted Index",        desc:"Index corruption on a high-traffic table triggered query executor crash" },
    ],
    history: ["DB crash pattern correlates with month-end batch reports", "Previous crash: 3 weeks ago — resolved via log purge", "Index corruption seen twice in past 6 months"],
    deps:    ["App Server → Connection Pool → Primary DB → Replica DB → Backup Storage"],
    actions: ["Clear old transaction logs and archive to cold storage", "Increase DB server RAM or tune query cache limits", "Run DBCC CHECKDB / pg_dump integrity check", "Schedule automated log rotation and disk-space alerts"],
  },
  "Security Breach": {
    causes: [
      { prob:"88%", level:"high",  title:"Credential Compromise",  desc:"Stolen or brute-forced credentials used to gain unauthorized access" },
      { prob:"65%", level:"med",   title:"Unpatched Vulnerability", desc:"Known CVE exploited on an outdated system component" },
      { prob:"40%", level:"low-p", title:"Insider Threat",         desc:"Anomalous data access pattern detected from internal account" },
    ],
    history: ["First breach event logged in this quarter", "Threat intel feed flagged IP range 3 days prior", "Similar pattern reported in industry ISAC bulletin"],
    deps:    ["Attacker → Perimeter Firewall → WAF → App Layer → Data Store"],
    actions: ["Immediately revoke compromised credentials and force password reset", "Isolate affected systems from network", "Apply emergency patches for identified CVEs", "Engage incident response team and preserve forensic logs"],
  },
  "Performance Degradation": {
    causes: [
      { prob:"72%", level:"high",  title:"Resource Saturation",    desc:"CPU or memory utilization consistently above 90% under load" },
      { prob:"50%", level:"med",   title:"Slow Database Queries",  desc:"Missing indexes or N+1 query patterns causing response time spikes" },
      { prob:"30%", level:"low-p", title:"Network Latency",        desc:"Increased latency between microservices degrading end-to-end response" },
    ],
    history: ["Degradation observed every Friday evening (traffic peaks)", "Last fix: query optimization reduced P95 by 40%", "Related to recent deployment"],
    deps:    ["CDN → Load Balancer → App Cluster → Cache Layer → Database"],
    actions: ["Scale out application tier horizontally", "Add missing DB indexes identified in slow query log", "Enable response caching at API gateway layer", "Set auto-scaling triggers at 70% CPU threshold"],
  },
  "Application Error": {
    causes: [
      { prob:"76%", level:"high",  title:"Unhandled Exception",   desc:"Null pointer or unhandled runtime exception crashing the app process" },
      { prob:"52%", level:"med",   title:"Bad Deployment",        desc:"Recent code push introduced a regression in a critical code path" },
      { prob:"28%", level:"low-p", title:"Config Mismatch",       desc:"Environment variable or feature flag misconfigured in production" },
    ],
    history: ["Error rate jumped 300% after last deployment", "Similar error seen in staging — not caught by tests", "Rollback resolved previous occurrence in 12 minutes"],
    deps:    ["User → Frontend → Backend API → Microservices → Database"],
    actions: ["Roll back to last stable deployment immediately", "Add null-checks and error boundaries to affected modules", "Review deployment checklist and CI/CD gate criteria", "Add integration tests covering the failing code path"],
  },
  "Service Interruption": {
    causes: [
      { prob:"70%", level:"high",  title:"Dependency Unavailable", desc:"A critical upstream microservice or third-party API became unreachable" },
      { prob:"48%", level:"med",   title:"Deployment Failure",     desc:"Failed rolling update left service in a partially deployed broken state" },
      { prob:"25%", level:"low-p", title:"DNS Resolution Failure", desc:"Internal DNS record change caused service discovery to fail" },
    ],
    history: ["3rd service interruption this month", "Dependency failures account for 60% of past incidents", "Avg detection time: 8 minutes via synthetic monitoring"],
    deps:    ["Client → API Gateway → Service Mesh → Upstream Services → External APIs"],
    actions: ["Implement circuit breaker pattern for upstream dependencies", "Add health-check endpoint and readiness probes", "Review and test rollback procedure for deployments", "Set up synthetic monitoring with 1-minute interval checks"],
  },
};

// ═══════════════════════════════════════════════════
// SUPABASE — fetch all incidents and normalize fields
// ═══════════════════════════════════════════════════
async function fetchIncidentsFromDB() {
  const { data, error } = await supabase
    .from("incidents")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Supabase fetch error:", error.message);
    showToast("high", "⚠ Fetch Error", error.message);
    return [];
  }

  // Map DB column names → UI field names used everywhere in render functions
  return (data || []).map(row => ({
    id:       row.incident_id || String(row.id),
    date:     row.date ? new Date(row.date).toLocaleString() : "—",
    category: row.category    || "Unknown",
    severity: row.severity    || "Low",
    desc:     row.description || "",
    team:     row.team        || "Unassigned",
    status:   row.status      || "Open",
  }));
}

// ═══════════════════════════════════════════════════
// REFRESH ALL — fetches fresh data then re-renders
// ═══════════════════════════════════════════════════
async function refreshAll() {
  incidents = await fetchIncidentsFromDB();
  renderDashboard();
  renderIncidentsTable();
  renderRCASelect();
  renderAlerts();
  renderResolution();
  updateLiveBadge();
}

// ═══════════════════════════════════════════════════
// AUTH — simple UI-only login (no Supabase Auth)
// ═══════════════════════════════════════════════════
function doLogin() {
  const u   = document.getElementById("login-user").value.trim();
  const p   = document.getElementById("login-pass").value.trim();
  const r   = document.getElementById("login-role").value;
  const err = document.getElementById("login-err");

  if (!u || !p || !r) { err.textContent = "⚠ All fields are required"; return; }
  if (p.length < 4)   { err.textContent = "⚠ Invalid credentials";     return; }

  err.textContent = "";
  const roleMap = { admin:"Administrator", analyst:"Technical Analyst", operator:"Operations Manager", support:"IT Support" };
  currentUser = { name: u.split("@")[0], role: r, roleLabel: roleMap[r] };

  document.getElementById("user-display").textContent      = currentUser.name;
  document.getElementById("user-role-display").textContent = currentUser.roleLabel;
  document.getElementById("user-avatar").textContent       = currentUser.name[0].toUpperCase();

  document.getElementById("page-login").classList.remove("active");
  document.getElementById("page-app").classList.add("active");

  refreshAll();
  addActivity("now", currentUser.name, "Logged in", "Session started — " + currentUser.roleLabel, "update");
  showToast("success", "✅ Login Successful", "Welcome back, " + currentUser.name + "!");
}

function doLogout() {
  document.getElementById("page-app").classList.remove("active");
  document.getElementById("page-login").classList.add("active");
  document.getElementById("login-pass").value = "";
  document.getElementById("login-err").textContent = "";
  document.querySelectorAll(".nav-item").forEach(n => n.classList.remove("active"));
  document.querySelector(".nav-item").classList.add("active");
  switchView("dashboard", document.querySelector(".nav-item"));
}

// ═══════════════════════════════════════════════════
// NAVIGATION
// ═══════════════════════════════════════════════════
function switchView(name, el) {
  document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
  document.querySelectorAll(".nav-item").forEach(n => n.classList.remove("active"));
  document.getElementById("view-" + name).classList.add("active");
  if (el) el.classList.add("active");
  const titles = {
    dashboard: "Dashboard", activity: "Live Activity Feed",
    incidents: "Incident Registry", report: "Report an Incident",
    rca: "Root Cause Analysis", alerts: "Alert & Severity Monitor",
    resolution: "Resolution Tracker", reports: "Analytics & Reports",
  };
  document.getElementById("topbar-title").textContent = titles[name] || name;
  if (name === "reports")    renderReports();
  if (name === "resolution") renderResolution();
  if (name === "alerts")     renderAlerts();
}

// ═══════════════════════════════════════════════════
// SUBMIT INCIDENT → saves to Supabase → shows in UI
// ═══════════════════════════════════════════════════
async function submitIncident() {
  const cat  = document.getElementById("f-category").value;
  const sev  = document.getElementById("f-severity").value;
  const team = document.getElementById("f-team").value;
  const desc = document.getElementById("f-desc").value.trim();
  const msg  = document.getElementById("form-msg");
  const btn  = document.getElementById("submit-btn");

  // Validate
  if (!cat || !sev || !team || !desc) {
    msg.style.color = "var(--red)";
    msg.textContent = "⚠ Please fill all required fields";
    return;
  }

  // Loading state
  btn.disabled    = true;
  btn.textContent = "Saving…";
  msg.textContent = "";

  const now        = new Date().toISOString();
  const incidentId = "INC-" + Math.floor(Math.random() * 9000 + 1000);

  const { error } = await supabase.from("incidents").insert([{
    incident_id: incidentId,
    category:    cat,
    severity:    sev,
    team:        team,
    description: desc,
    status:      "Open",
    date:        now,
    created_at:  now,
  }]);

  // Restore button
  btn.disabled    = false;
  btn.textContent = "Submit Incident →";

  if (error) {
    console.error("Insert error:", error.message);
    msg.style.color = "var(--red)";
    msg.textContent = "❌ Error: " + error.message;
    return;
  }

  // Success feedback
  msg.style.color = "var(--green)";
  msg.textContent = "✅ " + incidentId + " submitted!";

  // Clear form fields
  ["f-category", "f-severity", "f-team", "f-service", "f-desc"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  // Activity log + toast
  addActivity("now", currentUser.name, "Incident reported", incidentId + " — " + cat + " (" + sev + ")", "alert");
  if (sev === "Critical" || sev === "High") {
    showToast("critical", "🚨 " + sev + " Incident", incidentId + " requires immediate attention");
  } else {
    showToast("success", "✅ Incident Reported", incidentId + " submitted successfully");
  }

  // Pull fresh data from DB so the new incident shows everywhere immediately
  await refreshAll();

  // Auto-clear success message after 4s
  setTimeout(() => { if (msg) msg.textContent = ""; }, 4000);
}

// ═══════════════════════════════════════════════════
// UPDATE STATUS → persists to Supabase
// ═══════════════════════════════════════════════════
async function updateStatus(id, newStatus) {
  const { error } = await supabase
    .from("incidents")
    .update({ status: newStatus })
    .eq("incident_id", id);

  if (error) {
    console.error("Update error:", error.message);
    showToast("high", "❌ Update Failed", error.message);
    return;
  }

  addActivity("now", currentUser.name, "Status updated", id + " → " + newStatus, "update");
  if (newStatus === "Resolved") showToast("success", "✅ Incident Resolved", id + " marked as resolved");
  if (newStatus === "Closed")   showToast("success", "🔒 Incident Closed",   id + " has been closed");

  await refreshAll();
}

// ═══════════════════════════════════════════════════
// RENDER — DASHBOARD
// ═══════════════════════════════════════════════════
function renderDashboard() {
  const open     = incidents.filter(i => i.status !== "Closed" && i.status !== "Resolved").length;
  const crit     = incidents.filter(i => i.severity === "Critical" && i.status !== "Closed").length;
  const resolved = incidents.filter(i => i.status === "Resolved" || i.status === "Closed").length;

  document.getElementById("stat-open").textContent = open;
  document.getElementById("stat-crit").textContent = crit;
  document.getElementById("stat-res").textContent  = resolved;

  // Recent incidents (top 5)
  document.getElementById("dash-incidents-body").innerHTML = incidents.slice(0, 5).map(i => `
    <tr onclick="openDetail('${i.id}')" style="cursor:pointer">
      <td><span class="tag">${i.id}</span></td>
      <td style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--text2)">${i.desc.slice(0,45)}${i.desc.length > 45 ? "…" : ""}</td>
      <td>${sevBadge(i.severity)}</td>
      <td>${statusBadge(i.status)}</td>
    </tr>
  `).join("") || '<tr><td colspan="4" style="text-align:center;color:var(--text3);padding:24px">No incidents yet</td></tr>';

  // Active alerts panel
  const active = incidents.filter(i => i.status !== "Closed" && i.status !== "Resolved");
  document.getElementById("alert-count-tag").textContent = active.length + " active";
  document.getElementById("dash-alerts-body").innerHTML = active.slice(0, 6).map(i => `
    <div class="alert-item">
      <div class="alert-dot ${i.severity.toLowerCase()}"></div>
      <div class="alert-info">
        <div class="alert-title">${i.id} — ${i.category}</div>
        <div class="alert-time">${i.date}</div>
      </div>
      ${sevBadge(i.severity)}
    </div>
  `).join("") || '<div style="padding:20px;text-align:center;color:var(--text3);font-size:13px">No active alerts ✅</div>';

  // Severity bar chart
  const sevColors = { Critical:"#dc2626", High:"#ea580c", Medium:"#ca8a04", Low:"#16a34a" };
  const maxSev    = Math.max(...["Critical","High","Medium","Low"].map(s => incidents.filter(i => i.severity === s).length), 1);
  document.getElementById("severity-chart").innerHTML = ["Critical","High","Medium","Low"].map(s => {
    const c = incidents.filter(i => i.severity === s).length;
    return `<div class="chart-bar-row">
      <div class="chart-bar-label">${s}</div>
      <div class="chart-bar-track"><div class="chart-bar-fill" style="width:${c/maxSev*100}%;background:${sevColors[s]}"></div></div>
      <div class="chart-bar-val" style="color:${sevColors[s]}">${c}</div>
    </div>`;
  }).join("");

  // Status bar chart
  const statuses = ["Open","Assigned","In Progress","Resolved","Closed"];
  const sColors  = { "Open":"#2563eb","Assigned":"#7c3aed","In Progress":"#ea580c","Resolved":"#16a34a","Closed":"#8890aa" };
  const maxSt    = Math.max(...statuses.map(s => incidents.filter(i => i.status === s).length), 1);
  document.getElementById("resolution-chart").innerHTML = statuses.map(s => {
    const c = incidents.filter(i => i.status === s).length;
    return `<div class="chart-bar-row">
      <div class="chart-bar-label">${s}</div>
      <div class="chart-bar-track"><div class="chart-bar-fill" style="width:${c/maxSt*100}%;background:${sColors[s]}"></div></div>
      <div class="chart-bar-val" style="color:${sColors[s]}">${c}</div>
    </div>`;
  }).join("");
}

// ═══════════════════════════════════════════════════
// RENDER — INCIDENTS TABLE
// ═══════════════════════════════════════════════════
function renderIncidentsTable() {
  document.getElementById("incidents-body").innerHTML = incidents.map(i => `
    <tr>
      <td><span class="tag">${i.id}</span></td>
      <td style="font-family:'DM Mono',monospace;font-size:11px;color:var(--text3)">${i.date}</td>
      <td style="font-weight:500">${i.category}</td>
      <td>${sevBadge(i.severity)}</td>
      <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--text2)">${i.desc}</td>
      <td style="font-size:12px;color:var(--text2)">${i.team}</td>
      <td>${statusBadge(i.status)}</td>
      <td><button class="action-btn" onclick="openDetail('${i.id}')">Details</button></td>
    </tr>
  `).join("") || '<tr><td colspan="8" style="text-align:center;color:var(--text3);padding:40px">No incidents recorded yet</td></tr>';
}

// ═══════════════════════════════════════════════════
// RENDER — RCA SELECT DROPDOWN
// ═══════════════════════════════════════════════════
function renderRCASelect() {
  const sel = document.getElementById("rca-select");
  const cur = sel.value;
  sel.innerHTML = '<option value="">Choose an incident to analyze...</option>' +
    incidents.map(i => `<option value="${i.id}">${i.id} — ${i.category} (${i.severity})</option>`).join("");
  if (cur) sel.value = cur;
}

// ═══════════════════════════════════════════════════
// RUN RCA ANALYSIS
// ═══════════════════════════════════════════════════
function runRCA() {
  const id  = document.getElementById("rca-select").value;
  if (!id) return;
  const inc = incidents.find(i => i.id === id);
  if (!inc) return;

  const data = rcaData[inc.category] || {
    causes: [
      { prob:"75%", level:"high",  title:"Configuration Drift",    desc:"Incorrect system configuration detected in the affected component" },
      { prob:"50%", level:"med",   title:"Resource Exhaustion",    desc:"System resources exceeded safe operating thresholds" },
      { prob:"30%", level:"low-p", title:"Third-Party Dependency", desc:"External service failure cascaded into this system" },
    ],
    history: ["First occurrence of this category", "No direct historical match", "Related pattern: resource-based issues"],
    deps:    ["Client → Frontend → Backend API → Database"],
    actions: ["Review and audit system configuration", "Set up resource utilization monitoring", "Implement circuit breaker pattern", "Add automated threshold alerts"],
  };

  document.getElementById("rca-empty").style.display  = "none";
  document.getElementById("rca-result").style.display = "block";

  document.getElementById("rca-causes").innerHTML = data.causes.map(c => `
    <div class="cause-item">
      <div class="cause-prob ${c.level}">${c.prob}</div>
      <div class="cause-info"><h4>${c.title}</h4><p>${c.desc}</p></div>
    </div>
  `).join("");

  document.getElementById("rca-history").innerHTML = `
    <div style="margin-bottom:14px;padding:10px 14px;background:var(--accentlt);border-radius:8px;border:1px solid rgba(37,99,235,0.15)">
      <div style="font-size:12px;color:var(--text3);margin-bottom:2px">Analyzing</div>
      <div style="font-weight:700;color:var(--accent)">${inc.id} — ${inc.category}</div>
    </div>
    ${data.history.map(h => `<div style="display:flex;gap:10px;padding:9px 0;border-bottom:1px solid var(--border);font-size:13px;color:var(--text2)"><span style="color:var(--accent);font-weight:700">→</span>${h}</div>`).join("")}
  `;

  document.getElementById("rca-dep").innerHTML = data.deps.map(d => `
    <div style="padding:11px 16px;background:var(--bg3);border:1px solid var(--border);border-radius:9px;margin-bottom:8px;font-family:'DM Mono',monospace;font-size:12px;color:var(--text2)">${d}</div>
  `).join("");

  document.getElementById("rca-actions").innerHTML =
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">' +
    data.actions.map((a, i) => `
      <div style="padding:12px 14px;background:var(--accentlt);border:1px solid rgba(37,99,235,0.15);border-radius:9px;font-size:13px;color:var(--accent2)">
        <span style="font-family:'DM Mono',monospace;font-weight:700;color:var(--accent)">${i+1}.</span> ${a}
      </div>
    `).join("") + "</div>";

  showToast("success", "🔍 RCA Complete", "Analysis for " + id + " generated successfully");
}

// ═══════════════════════════════════════════════════
// RENDER — ALERTS
// ═══════════════════════════════════════════════════
function renderAlerts() {
  const counts = { critical:0, high:0, medium:0, low:0 };
  incidents
    .filter(i => i.status !== "Closed" && i.status !== "Resolved")
    .forEach(i => { const k = i.severity.toLowerCase(); if (k in counts) counts[k]++; });

  document.getElementById("a-crit").textContent = counts.critical;
  document.getElementById("a-high").textContent = counts.high;
  document.getElementById("a-med").textContent  = counts.medium;
  document.getElementById("a-low").textContent  = counts.low;

  const order  = ["Critical","High","Medium","Low"];
  const active = [...incidents]
    .filter(i => i.status !== "Closed" && i.status !== "Resolved")
    .sort((a, b) => order.indexOf(a.severity) - order.indexOf(b.severity));

  document.getElementById("alerts-list").innerHTML = active.length
    ? active.map(i => `
      <div class="alert-item">
        <div class="alert-dot ${i.severity.toLowerCase()}"></div>
        <div class="alert-info">
          <div class="alert-title">${i.id} — ${i.category}</div>
          <div class="alert-time">${i.date} &nbsp;·&nbsp; ${i.team}</div>
        </div>
        ${sevBadge(i.severity)}
        <button class="action-btn" onclick="updateStatus('${i.id}','Resolved')" style="margin-left:8px">Resolve</button>
      </div>
    `).join("")
    : '<div class="empty-state"><div class="empty-icon">✅</div><p>No active alerts — all systems clear!</p></div>';
}

// ═══════════════════════════════════════════════════
// RENDER — RESOLUTION TRACKER
// ═══════════════════════════════════════════════════
function renderResolution() {
  const statuses = ["Open","Assigned","In Progress","Resolved","Closed"];
  const idMap    = { "Open":"r-open","Assigned":"r-assigned","In Progress":"r-progress","Resolved":"r-resolved","Closed":"r-closed" };

  statuses.forEach(s => {
    const el = document.getElementById(idMap[s]);
    if (el) el.textContent = incidents.filter(i => i.status === s).length;
  });

  document.getElementById("resolution-body").innerHTML = incidents.map(i => `
    <tr>
      <td><span class="tag">${i.id}</span></td>
      <td style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--text2)">${i.desc.slice(0,55)}${i.desc.length > 55 ? "…" : ""}</td>
      <td>${sevBadge(i.severity)}</td>
      <td>${statusBadge(i.status)}</td>
      <td style="font-size:12px;color:var(--text2)">${i.team}</td>
      <td>
        <select onchange="updateStatus('${i.id}', this.value)"
          style="background:var(--bg3);border:1.5px solid var(--border2);border-radius:7px;padding:5px 9px;color:var(--text);font-size:12px;font-family:'DM Sans',sans-serif;outline:none;cursor:pointer;font-weight:500">
          ${statuses.map(s => `<option value="${s}" ${i.status === s ? "selected" : ""}>${s}</option>`).join("")}
        </select>
      </td>
    </tr>
  `).join("") || '<tr><td colspan="6" style="text-align:center;color:var(--text3);padding:40px">No incidents yet</td></tr>';
}

// ═══════════════════════════════════════════════════
// RENDER — REPORTS
// ═══════════════════════════════════════════════════
function renderReports() {
  const total    = incidents.length;
  const resolved = incidents.filter(i => i.status === "Resolved" || i.status === "Closed").length;
  const rate     = total ? Math.round(resolved / total * 100) : 0;

  document.getElementById("rep-total").textContent = total;
  document.getElementById("rep-rate").textContent  = rate + "%";

  const catCounts = {};
  incidents.forEach(i => { catCounts[i.category] = (catCounts[i.category] || 0) + 1; });
  const topCat = Object.entries(catCounts).sort((a, b) => b[1] - a[1])[0];
  document.getElementById("rep-top").textContent = topCat ? topCat[0].split(" ")[0] : "—";

  const catColors = ["#2563eb","#7c3aed","#16a34a","#ea580c","#ca8a04","#dc2626","#0891b2","#be185d"];
  const maxCat    = Math.max(...Object.values(catCounts), 1);
  document.getElementById("rep-category-chart").innerHTML = Object.entries(catCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([cat, cnt], i) => `
      <div class="chart-bar-row">
        <div class="chart-bar-label" style="font-size:11px;font-weight:600">${cat}</div>
        <div class="chart-bar-track"><div class="chart-bar-fill" style="width:${cnt/maxCat*100}%;background:${catColors[i % catColors.length]}"></div></div>
        <div class="chart-bar-val">${cnt}</div>
      </div>
    `).join("") || '<div style="color:var(--text3);font-size:13px;padding:16px 0">No data yet</div>';

  const sevCounts = { Critical:0, High:0, Medium:0, Low:0 };
  incidents.forEach(i => { if (i.severity in sevCounts) sevCounts[i.severity]++; });
  const sevColors = { Critical:"#dc2626", High:"#ea580c", Medium:"#ca8a04", Low:"#16a34a" };
  const maxSev    = Math.max(...Object.values(sevCounts), 1);
  document.getElementById("rep-severity-chart").innerHTML = Object.entries(sevCounts).map(([s, c]) => `
    <div class="chart-bar-row">
      <div class="chart-bar-label">${s}</div>
      <div class="chart-bar-track"><div class="chart-bar-fill" style="width:${c/maxSev*100}%;background:${sevColors[s]}"></div></div>
      <div class="chart-bar-val" style="color:${sevColors[s]}">${c}</div>
    </div>
  `).join("");
}

// ═══════════════════════════════════════════════════
// ACTIVITY FEED
// ═══════════════════════════════════════════════════
function renderActivityFeed() {
  const colorMap = { alert:"#ea580c", critical:"#dc2626", resolve:"#16a34a", assign:"#7c3aed", update:"#2563eb", escalate:"#ca8a04" };
  document.getElementById("activity-feed").innerHTML = [...activityLog].reverse().map(a => `
    <div class="activity-item">
      <div class="act-time">${a.time}</div>
      <div class="act-dot" style="background:${colorMap[a.type] || "#8890aa"}"></div>
      <div class="act-text">
        <div><strong>${a.user}</strong> <span>${a.action}</span></div>
        <div class="act-detail">${a.detail}</div>
      </div>
    </div>
  `).join("") || '<div style="text-align:center;color:var(--text3);padding:40px;font-size:13px">No activity yet</div>';
}

function addActivity(time, user, action, detail, type) {
  const now = new Date();
  const t   = time === "now"
    ? now.getHours().toString().padStart(2, "0") + ":" + now.getMinutes().toString().padStart(2, "0")
    : time;
  activityLog.push({ time: t, user, action, detail, type });
  renderActivityFeed();
  updateLiveBadge();
}

function updateLiveBadge() {
  const open = incidents.filter(i => i.status !== "Closed" && i.status !== "Resolved").length;
  document.getElementById("live-badge").textContent = open;
}

// ═══════════════════════════════════════════════════
// MODAL — incident detail popup
// ═══════════════════════════════════════════════════
function openDetail(id) {
  const inc = incidents.find(i => i.id === id);
  if (!inc) return;
  document.getElementById("modal-title").textContent = inc.id + " — Incident Detail";
  document.getElementById("modal-sub").textContent   = inc.category + "  ·  " + inc.date;
  document.getElementById("modal-body").innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px">
      <div><div class="form-label">Severity</div><div style="margin-top:7px">${sevBadge(inc.severity)}</div></div>
      <div><div class="form-label">Status</div><div style="margin-top:7px">${statusBadge(inc.status)}</div></div>
      <div style="grid-column:1/-1"><div class="form-label">Assigned Team</div><div style="margin-top:6px;font-size:14px;font-weight:600">${inc.team}</div></div>
      <div style="grid-column:1/-1"><div class="form-label">Description</div><div style="margin-top:6px;font-size:13px;color:var(--text2);line-height:1.7">${inc.desc}</div></div>
    </div>
    <div class="divider"></div>
    <div class="form-label" style="margin-bottom:10px">Update Status</div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;">
      ${["Open","Assigned","In Progress","Resolved","Closed"].map(s =>
        `<button class="action-btn ${s === "Closed" ? "danger" : ""}" onclick="updateStatus('${inc.id}','${s}');closeModal()">${s}</button>`
      ).join("")}
    </div>
  `;
  document.getElementById("modal-overlay").classList.add("open");
}

function closeModal() {
  document.getElementById("modal-overlay").classList.remove("open");
}

// ═══════════════════════════════════════════════════
// SEARCH
// ═══════════════════════════════════════════════════
function searchIncidents(q) {
  const lq       = q.toLowerCase();
  const filtered = q
    ? incidents.filter(i =>
        i.id.toLowerCase().includes(lq)       ||
        i.desc.toLowerCase().includes(lq)     ||
        i.category.toLowerCase().includes(lq) ||
        i.team.toLowerCase().includes(lq)
      )
    : incidents;

  document.getElementById("incidents-body").innerHTML = filtered.map(i => `
    <tr>
      <td><span class="tag">${i.id}</span></td>
      <td style="font-family:'DM Mono',monospace;font-size:11px;color:var(--text3)">${i.date}</td>
      <td style="font-weight:500">${i.category}</td>
      <td>${sevBadge(i.severity)}</td>
      <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--text2)">${i.desc}</td>
      <td style="font-size:12px;color:var(--text2)">${i.team}</td>
      <td>${statusBadge(i.status)}</td>
      <td><button class="action-btn" onclick="openDetail('${i.id}')">Details</button></td>
    </tr>
  `).join("") || `<tr><td colspan="8" style="text-align:center;color:var(--text3);padding:40px">No results for "${q}"</td></tr>`;
}

// ═══════════════════════════════════════════════════
// BADGE HELPERS
// ═══════════════════════════════════════════════════
function sevBadge(s) {
  const m = { Critical:"badge-critical", High:"badge-high", Medium:"badge-medium", Low:"badge-low" };
  return `<span class="badge ${m[s] || "badge-low"}"><span class="dot"></span>${s}</span>`;
}

function statusBadge(s) {
  const m = { "Open":"badge-open","Assigned":"badge-assigned","In Progress":"badge-progress","Resolved":"badge-resolved","Closed":"badge-closed","Investigating":"badge-investigating" };
  return `<span class="badge ${m[s] || "badge-closed"}">${s}</span>`;
}

// ═══════════════════════════════════════════════════
// TOAST NOTIFICATIONS
// ═══════════════════════════════════════════════════
function showToast(type, title, msg) {
  const c = document.getElementById("toast-container");
  const t = document.createElement("div");
  t.className = "toast " + type;
  t.innerHTML = `
    <div class="toast-icon">${type === "critical" ? "🚨" : type === "success" ? "✅" : "ℹ️"}</div>
    <div class="toast-content">
      <div class="toast-title">${title}</div>
      <div class="toast-msg">${msg}</div>
    </div>
    <div class="toast-close" onclick="this.parentElement.remove()">×</div>
  `;
  c.appendChild(t);
  setTimeout(() => { if (t.parentElement) t.remove(); }, 4500);
}

// ═══════════════════════════════════════════════════
// INIT — runs when page loads
// ═══════════════════════════════════════════════════
document.getElementById("modal-overlay").addEventListener("click", function(e) {
  if (e.target === this) closeModal();
});

// Pre-fill demo credentials for convenience
document.getElementById("login-user").value = "admin@vit.ac.in";
document.getElementById("login-pass").value = "admin123";
document.getElementById("login-role").value = "admin";