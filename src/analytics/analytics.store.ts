// ============================================================
// analytics/analytics.store.ts — In-memory analytics store
// Works without any DB setup. For production, swap with
// PostgreSQL inserts using the pg client already in deps.
// ============================================================

const MAX_EVENTS = 10_000; // cap to prevent memory bloat

// ── Types ─────────────────────────────────────────────────────

interface PageViewEvent {
  path: string;
  sessionId: string;
  referrer?: string;
  timestamp: Date;
}

interface ApiRequestEvent {
  method: string;
  path: string;
  statusCode: number;
  duration: number;
  timestamp: Date;
}

interface ApplicationEvent {
  applicationId: string;
  eventType: 'submitted' | 'approved' | 'declined' | 'referred';
  timestamp: Date;
}

interface ClickEvent {
  element: string;
  page: string;
  sessionId: string;
  timestamp: Date;
}

// ── Store ─────────────────────────────────────────────────────

class AnalyticsStore {
  private pageViews: PageViewEvent[] = [];
  private apiRequests: ApiRequestEvent[] = [];
  private applicationEvents: ApplicationEvent[] = [];
  private clickEvents: ClickEvent[] = [];

  // ── Write methods ──────────────────────────────────────────

  recordPageView(path: string, sessionId: string, referrer?: string): void {
    this.pageViews.push({ path, sessionId, referrer, timestamp: new Date() });
    if (this.pageViews.length > MAX_EVENTS) this.pageViews.shift();
  }

  recordApiRequest(method: string, path: string, statusCode: number, duration: number): void {
    this.apiRequests.push({ method, path, statusCode, duration, timestamp: new Date() });
    if (this.apiRequests.length > MAX_EVENTS) this.apiRequests.shift();
  }

  recordApplicationEvent(
    applicationId: string,
    eventType: ApplicationEvent['eventType'],
  ): void {
    this.applicationEvents.push({ applicationId, eventType, timestamp: new Date() });
    if (this.applicationEvents.length > MAX_EVENTS) this.applicationEvents.shift();
  }

  recordClickEvent(element: string, page: string, sessionId: string): void {
    this.clickEvents.push({ element, page, sessionId, timestamp: new Date() });
    if (this.clickEvents.length > MAX_EVENTS) this.clickEvents.shift();
  }

  // ── Read / aggregate ───────────────────────────────────────

  getStats() {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // ── Overview ──────────────────────────────────────────────
    const totalPageViews = this.pageViews.length;
    const todayPageViews = this.pageViews.filter(e => e.timestamp >= today).length;
    const uniqueSessions = new Set(this.pageViews.map(e => e.sessionId)).size;
    const todayUniqueSessions = new Set(
      this.pageViews.filter(e => e.timestamp >= today).map(e => e.sessionId),
    ).size;

    const totalClicks = this.clickEvents.length;
    const todayClicks = this.clickEvents.filter(e => e.timestamp >= today).length;

    const totalApiRequests = this.apiRequests.length;
    const todayApiRequests = this.apiRequests.filter(r => r.timestamp >= today).length;

    const avgResponseTime =
      this.apiRequests.length > 0
        ? Math.round(
            this.apiRequests.reduce((s, r) => s + r.duration, 0) / this.apiRequests.length,
          )
        : 0;

    const errorRequests = this.apiRequests.filter(r => r.statusCode >= 400).length;
    const errorRate =
      totalApiRequests > 0 ? Math.round((errorRequests / totalApiRequests) * 100) : 0;

    // ── Applications ──────────────────────────────────────────
    const submissions = this.applicationEvents.filter(e => e.eventType === 'submitted');
    const approvals = this.applicationEvents.filter(e => e.eventType === 'approved').length;
    const declines = this.applicationEvents.filter(e => e.eventType === 'declined').length;
    const refers = this.applicationEvents.filter(e => e.eventType === 'referred').length;
    const totalApplications = submissions.length;
    const approvalRate =
      totalApplications > 0 ? Math.round((approvals / totalApplications) * 100) : 0;

    // ── Top pages ─────────────────────────────────────────────
    const pageCounts: Record<string, number> = {};
    for (const e of this.pageViews) {
      pageCounts[e.path] = (pageCounts[e.path] || 0) + 1;
    }
    const topPages = Object.entries(pageCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 6)
      .map(([path, count]) => ({ path, count }));

    // ── Top clicks ────────────────────────────────────────────
    const clickCounts: Record<string, number> = {};
    for (const e of this.clickEvents) {
      clickCounts[e.element] = (clickCounts[e.element] || 0) + 1;
    }
    const topClicks = Object.entries(clickCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 6)
      .map(([element, count]) => ({ element, count }));

    // ── 7-day daily trend ─────────────────────────────────────
    const dailyTrend = [];
    for (let i = 6; i >= 0; i--) {
      const day = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
      const nextDay = new Date(day.getTime() + 24 * 60 * 60 * 1000);
      const label = day.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
      dailyTrend.push({
        date: label,
        pageViews: this.pageViews.filter(e => e.timestamp >= day && e.timestamp < nextDay).length,
        applications: this.applicationEvents.filter(
          e => e.timestamp >= day && e.timestamp < nextDay && e.eventType === 'submitted',
        ).length,
        apiRequests: this.apiRequests.filter(r => r.timestamp >= day && r.timestamp < nextDay).length,
      });
    }

    // ── Recent activity ───────────────────────────────────────
    const recentActivity = [
      ...this.pageViews.slice(-20).map(e => ({
        type: 'page_view' as const,
        description: `Page view: ${e.path}`,
        session: e.sessionId.slice(-8),
        timestamp: e.timestamp.toISOString(),
      })),
      ...this.applicationEvents.slice(-20).map(e => ({
        type: 'application' as const,
        description: `Application ${e.eventType}: ${e.applicationId}`,
        session: e.applicationId.slice(-8),
        timestamp: e.timestamp.toISOString(),
      })),
      ...this.clickEvents.slice(-20).map(e => ({
        type: 'click' as const,
        description: `Click: ${e.element} on ${e.page}`,
        session: e.sessionId.slice(-8),
        timestamp: e.timestamp.toISOString(),
      })),
    ]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 15);

    return {
      overview: {
        totalPageViews,
        todayPageViews,
        uniqueSessions,
        todayUniqueSessions,
        totalClicks,
        todayClicks,
        totalApiRequests,
        todayApiRequests,
        avgResponseTime,
        errorRate,
      },
      applications: {
        total: totalApplications,
        approvals,
        declines,
        refers,
        approvalRate,
      },
      topPages,
      topClicks,
      dailyTrend,
      recentActivity,
    };
  }
}

// Singleton — shared across all route handlers in the same process
export const analyticsStore = new AnalyticsStore();
