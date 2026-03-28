// ============================================================
// pages/AdminPage.tsx — Admin analytics dashboard
// Password: value of ADMIN_PASSWORD env var (default: admin123)
// ============================================================

import React, { useState, useEffect, useCallback } from 'react';

// ── Types ─────────────────────────────────────────────────────

interface Stats {
  overview: {
    totalPageViews: number;
    todayPageViews: number;
    uniqueSessions: number;
    todayUniqueSessions: number;
    totalClicks: number;
    todayClicks: number;
    totalApiRequests: number;
    todayApiRequests: number;
    avgResponseTime: number;
    errorRate: number;
  };
  applications: {
    total: number;
    approvals: number;
    declines: number;
    refers: number;
    approvalRate: number;
  };
  topPages: { path: string; count: number }[];
  topClicks: { element: string; count: number }[];
  dailyTrend: { date: string; pageViews: number; applications: number; apiRequests: number }[];
  recentActivity: { type: string; description: string; session: string; timestamp: string }[];
}

// ── Inline SVG chart components ───────────────────────────────

function LineChart({ data, keys, colors }: {
  data: { date: string; [key: string]: number | string }[];
  keys: string[];
  colors: string[];
}) {
  const W = 500, H = 160, PAD = { top: 10, right: 10, bottom: 30, left: 40 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  const allVals = data.flatMap(d => keys.map(k => d[k] as number));
  const maxVal = Math.max(...allVals, 1);

  const xStep = innerW / Math.max(data.length - 1, 1);

  const toX = (i: number) => PAD.left + i * xStep;
  const toY = (v: number) => PAD.top + innerH - (v / maxVal) * innerH;

  const pathFor = (key: string) =>
    data
      .map((d, i) => `${i === 0 ? 'M' : 'L'} ${toX(i)} ${toY(d[key] as number)}`)
      .join(' ');

  // Y-axis labels
  const yLabels = [0, Math.round(maxVal / 2), maxVal];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 160 }}>
      {/* Grid lines */}
      {yLabels.map(v => (
        <line
          key={v}
          x1={PAD.left} y1={toY(v)}
          x2={W - PAD.right} y2={toY(v)}
          stroke="#f0f0f0" strokeWidth={1}
        />
      ))}

      {/* Y-axis labels */}
      {yLabels.map(v => (
        <text key={v} x={PAD.left - 4} y={toY(v) + 4} textAnchor="end" fontSize={9} fill="#9ca3af">
          {v}
        </text>
      ))}

      {/* X-axis labels */}
      {data.map((d, i) => (
        <text
          key={i}
          x={toX(i)}
          y={H - 4}
          textAnchor="middle"
          fontSize={8}
          fill="#9ca3af"
        >
          {String(d.date).split(',')[0]}
        </text>
      ))}

      {/* Lines */}
      {keys.map((key, ki) => (
        <polyline
          key={key}
          points={data.map((d, i) => `${toX(i)},${toY(d[key] as number)}`).join(' ')}
          fill="none"
          stroke={colors[ki]}
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      ))}

      {/* Dots */}
      {keys.map((key, ki) =>
        data.map((d, i) => (
          <circle
            key={`${key}-${i}`}
            cx={toX(i)}
            cy={toY(d[key] as number)}
            r={3}
            fill={colors[ki]}
          />
        )),
      )}
    </svg>
  );
}

function HBarChart({ items, color }: { items: { label: string; count: number }[]; color: string }) {
  const max = Math.max(...items.map(i => i.count), 1);
  return (
    <div className="space-y-2">
      {items.map(item => (
        <div key={item.label}>
          <div className="flex justify-between text-xs text-gray-500 mb-0.5">
            <span className="truncate max-w-[160px]" title={item.label}>{item.label}</span>
            <span className="font-semibold text-gray-700 ml-2">{item.count}</span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${(item.count / max) * 100}%`, backgroundColor: color }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function DonutChart({ slices }: {
  slices: { label: string; value: number; color: string }[];
}) {
  const total = slices.reduce((s, x) => s + x.value, 0);
  if (total === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-gray-400 text-sm">No data yet</div>
    );
  }

  const R = 50, cx = 70, cy = 65, strokeW = 18;
  const circumference = 2 * Math.PI * R;

  let offset = 0;
  const arcs = slices.map(s => {
    const pct = s.value / total;
    const dash = pct * circumference;
    const arc = { ...s, dash, offset, pct };
    offset += dash;
    return arc;
  });

  return (
    <div className="flex items-center gap-4">
      <svg width={140} height={130} viewBox="0 0 140 130">
        {arcs.map((arc, i) => (
          <circle
            key={i}
            cx={cx} cy={cy} r={R}
            fill="none"
            stroke={arc.color}
            strokeWidth={strokeW}
            strokeDasharray={`${arc.dash} ${circumference - arc.dash}`}
            strokeDashoffset={-arc.offset + circumference * 0.25}
            style={{ transition: 'stroke-dasharray 0.5s' }}
          />
        ))}
        <text x={cx} y={cy - 6} textAnchor="middle" fontSize={18} fontWeight="bold" fill="#111827">
          {total}
        </text>
        <text x={cx} y={cy + 10} textAnchor="middle" fontSize={9} fill="#6b7280">
          total
        </text>
      </svg>
      <div className="space-y-2">
        {arcs.map(arc => (
          <div key={arc.label} className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: arc.color }} />
            <span className="text-xs text-gray-600">
              {arc.label}
              <span className="font-semibold text-gray-900 ml-1">{arc.value}</span>
              <span className="text-gray-400 ml-1">({Math.round(arc.pct * 100)}%)</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Stat card ─────────────────────────────────────────────────

function StatCard({
  label, value, sub, icon, accent,
}: {
  label: string;
  value: string | number;
  sub: string;
  icon: React.ReactNode;
  accent: string;
}) {
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
      <div className="flex items-start justify-between mb-3">
        <div className={`p-2 rounded-xl ${accent}`}>{icon}</div>
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-sm font-medium text-gray-700 mt-0.5">{label}</p>
      <p className="text-xs text-gray-400 mt-0.5">{sub}</p>
    </div>
  );
}

// ── Login screen ──────────────────────────────────────────────

function LoginScreen({ onLogin }: { onLogin: (token: string) => void }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // Try backend first; fall back to client-side check when backend is offline.
    // The stats API is still protected server-side with the same password.
    const FALLBACK_PASSWORD = 'admin123';
    const clientSideLogin = () => {
      if (password === FALLBACK_PASSWORD) {
        sessionStorage.setItem('_admin_token', password);
        onLogin(password);
      } else {
        setError('Invalid password.');
      }
    };

    try {
      const res = await fetch('/v1/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      // 5xx means the backend/proxy is down — fall back to client-side check
      if (res.status >= 500) {
        clientSideLogin();
        return;
      }
      if (res.ok) {
        const { token } = await res.json();
        sessionStorage.setItem('_admin_token', token);
        onLogin(token);
        return;
      }
      setError('Invalid password. Try again.');
    } catch {
      // Network error (no proxy at all) — fall back to client-side check
      clientSideLogin();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center">
      <div className="bg-white rounded-3xl shadow-2xl p-10 w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-indigo-600 rounded-2xl mb-4">
            <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Admin Portal</h1>
          <p className="text-sm text-gray-500 mt-1">Enter your admin password to continue</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50 text-sm"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
        <p className="text-center text-xs text-gray-400 mt-6">
          Default password: <code className="bg-gray-100 px-1 rounded">admin123</code>
          <br />Set <code className="bg-gray-100 px-1 rounded">ADMIN_PASSWORD</code> env var to change it.
        </p>
      </div>
    </div>
  );
}

// ── Activity type badge ───────────────────────────────────────

function ActivityBadge({ type }: { type: string }) {
  const map: Record<string, { label: string; className: string }> = {
    page_view: { label: 'view', className: 'bg-blue-100 text-blue-700' },
    application: { label: 'app', className: 'bg-green-100 text-green-700' },
    click: { label: 'click', className: 'bg-purple-100 text-purple-700' },
  };
  const cfg = map[type] ?? { label: type, className: 'bg-gray-100 text-gray-600' };
  return (
    <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold ${cfg.className}`}>
      {cfg.label}
    </span>
  );
}

// ── Main dashboard ────────────────────────────────────────────

function Dashboard({ token, onLogout }: { token: string; onLogout: () => void }) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const emptyStats: Stats = {
    overview: { totalPageViews: 0, todayPageViews: 0, uniqueSessions: 0, todayUniqueSessions: 0, totalClicks: 0, todayClicks: 0, totalApiRequests: 0, todayApiRequests: 0, avgResponseTime: 0, errorRate: 0 },
    applications: { total: 0, approvals: 0, declines: 0, refers: 0, approvalRate: 0 },
    topPages: [], topClicks: [],
    dailyTrend: Array.from({ length: 7 }, (_, i) => {
      const d = new Date(); d.setDate(d.getDate() - (6 - i));
      return { date: d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }), pageViews: 0, applications: 0, apiRequests: 0 };
    }),
    recentActivity: [],
  };

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/v1/admin/stats', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) {
        onLogout();
        return;
      }
      // Backend offline (502/503/504) — show empty dashboard with a soft warning
      if (res.status >= 500) {
        setStats(emptyStats);
        setError('backend-offline');
        setLoading(false);
        return;
      }
      if (!res.ok) throw new Error('Failed to load stats');
      setStats(await res.json());
      setLastRefresh(new Date());
      setError('');
    } catch {
      // Network error — same as backend offline
      setStats(emptyStats);
      setError('backend-offline');
    } finally {
      setLoading(false);
    }
  }, [token, onLogout]);

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 30_000); // auto-refresh every 30s
    return () => clearInterval(interval);
  }, [fetchStats]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Loading dashboard…</p>
        </div>
      </div>
    );
  }

  if (!stats) return null;

  const { overview, applications, topPages, topClicks, dailyTrend, recentActivity } = stats;
  const backendOffline = error === 'backend-offline';

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top nav */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div>
              <h1 className="font-bold text-gray-900 text-sm">Admin Portal</h1>
              <p className="text-[10px] text-gray-400">Analytics Dashboard</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <p className="text-xs text-gray-400">
              Last updated {lastRefresh.toLocaleTimeString()}
            </p>
            <button
              onClick={fetchStats}
              className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
              title="Refresh"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
            <button
              onClick={onLogout}
              className="text-xs text-gray-500 hover:text-red-600 transition-colors px-2 py-1 rounded"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">

        {/* ── Backend offline banner ─────────────────────────── */}
        {backendOffline && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4 flex items-center gap-3">
            <svg className="w-5 h-5 text-amber-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
            <div>
              <p className="text-sm font-medium text-amber-800">Backend server is offline</p>
              <p className="text-xs text-amber-600">Start the backend with <code className="bg-amber-100 px-1 rounded">npm run dev</code> from the project root to see live stats. Showing zero values for now.</p>
            </div>
            <button onClick={fetchStats} className="ml-auto text-xs px-3 py-1.5 bg-amber-200 hover:bg-amber-300 text-amber-800 rounded-lg transition-colors whitespace-nowrap">
              Retry
            </button>
          </div>
        )}

        {/* ── Overview stat cards ────────────────────────────── */}
        <section>
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Overview</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard
              label="Page Views"
              value={overview.totalPageViews.toLocaleString()}
              sub={`${overview.todayPageViews} today`}
              accent="bg-blue-50"
              icon={<svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>}
            />
            <StatCard
              label="Unique Sessions"
              value={overview.uniqueSessions.toLocaleString()}
              sub={`${overview.todayUniqueSessions} today`}
              accent="bg-purple-50"
              icon={<svg className="w-5 h-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>}
            />
            <StatCard
              label="Button Clicks"
              value={overview.totalClicks.toLocaleString()}
              sub={`${overview.todayClicks} today`}
              accent="bg-pink-50"
              icon={<svg className="w-5 h-5 text-pink-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5" /></svg>}
            />
            <StatCard
              label="API Requests"
              value={overview.totalApiRequests.toLocaleString()}
              sub={`${overview.todayApiRequests} today · ${overview.avgResponseTime}ms avg`}
              accent="bg-green-50"
              icon={<svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>}
            />
          </div>
        </section>

        {/* ── Application stats + error rate ────────────────── */}
        <section>
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Applications & Health</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard
              label="Applications"
              value={applications.total.toLocaleString()}
              sub="Total submitted"
              accent="bg-indigo-50"
              icon={<svg className="w-5 h-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>}
            />
            <StatCard
              label="Approval Rate"
              value={`${applications.approvalRate}%`}
              sub={`${applications.approvals} approved`}
              accent="bg-emerald-50"
              icon={<svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
            />
            <StatCard
              label="Decline Rate"
              value={applications.total > 0 ? `${Math.round((applications.declines / applications.total) * 100)}%` : '0%'}
              sub={`${applications.declines} declined`}
              accent="bg-red-50"
              icon={<svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
            />
            <StatCard
              label="API Error Rate"
              value={`${overview.errorRate}%`}
              sub={`Avg ${overview.avgResponseTime}ms response`}
              accent={overview.errorRate > 5 ? 'bg-red-50' : 'bg-gray-50'}
              icon={<svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
            />
          </div>
        </section>

        {/* ── 7-day trend line chart ─────────────────────────── */}
        <section className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-1">
            <h2 className="font-semibold text-gray-900">7-Day Traffic Trend</h2>
            <div className="flex items-center gap-4 text-xs text-gray-500">
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-0.5 rounded bg-blue-500 inline-block" />Page Views</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-0.5 rounded bg-emerald-500 inline-block" />Applications</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-0.5 rounded bg-purple-400 inline-block" />API Calls</span>
            </div>
          </div>
          <LineChart
            data={dailyTrend}
            keys={['pageViews', 'applications', 'apiRequests']}
            colors={['#3b82f6', '#10b981', '#a78bfa']}
          />
        </section>

        {/* ── Decision donut + top pages ─────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <h2 className="font-semibold text-gray-900 mb-4">Application Decisions</h2>
            <DonutChart
              slices={[
                { label: 'Approved', value: applications.approvals, color: '#10b981' },
                { label: 'Declined', value: applications.declines, color: '#ef4444' },
                { label: 'Referred', value: applications.refers, color: '#f59e0b' },
              ]}
            />
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <h2 className="font-semibold text-gray-900 mb-4">Top Pages</h2>
            {topPages.length === 0 ? (
              <p className="text-sm text-gray-400">No page views recorded yet.</p>
            ) : (
              <HBarChart
                items={topPages.map(p => ({ label: p.path, count: p.count }))}
                color="#6366f1"
              />
            )}
          </div>
        </div>

        {/* ── Top clicks + recent activity ───────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <h2 className="font-semibold text-gray-900 mb-4">Top Button Clicks</h2>
            {topClicks.length === 0 ? (
              <p className="text-sm text-gray-400">No click events recorded yet.</p>
            ) : (
              <HBarChart
                items={topClicks.map(c => ({ label: c.element, count: c.count }))}
                color="#ec4899"
              />
            )}
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <h2 className="font-semibold text-gray-900 mb-4">Recent Activity</h2>
            {recentActivity.length === 0 ? (
              <p className="text-sm text-gray-400">No activity yet. Use the marketplace to generate data.</p>
            ) : (
              <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
                {recentActivity.map((item, i) => (
                  <div key={i} className="flex items-start gap-2.5">
                    <ActivityBadge type={item.type} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-700 truncate">{item.description}</p>
                      <p className="text-[10px] text-gray-400">
                        session …{item.session} · {new Date(item.timestamp).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </main>
    </div>
  );
}

// ── Page entry point ──────────────────────────────────────────

export default function AdminPage() {
  const [token, setToken] = useState<string | null>(
    () => sessionStorage.getItem('_admin_token'),
  );

  const handleLogout = () => {
    sessionStorage.removeItem('_admin_token');
    setToken(null);
  };

  if (!token) {
    return <LoginScreen onLogin={setToken} />;
  }

  return <Dashboard token={token} onLogout={handleLogout} />;
}
