import { useCallback, useEffect, useState } from "react";
import { AdminLayoutNew } from "../../components/AdminLayoutNew";
import { Card } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { StatsCard } from "../../components/StatsCard";
import { motion } from "motion/react";
import { Download, TrendingUp, Users, Clock, Activity } from "lucide-react";
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { api } from "../../../lib/api";
import { datesForPreset, downloadTextFile } from "@/lib/adminAnalytics";

export function ReportsAnalytics() {
  const [dash, setDash] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const { dateFrom, dateTo } = datesForPreset("30d");
      setDash(await api.admin.getStats({ chartPeriod: "month", dateFrom, dateTo }));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const userGrowth = dash?.userGrowth || [];
  const userData = userGrowth.map((r: { month: string; users: number }) => ({
    month: r.month,
    users: r.users,
  }));

  const sessionActivity = dash?.sessionActivity || [];
  const engagementData = sessionActivity.map((r: { day: string; sessions: number }, i: number) => ({
    week: r.day || `Day ${i + 1}`,
    engagement: r.sessions,
  }));

  const featureLines =
    (dash?.featureUsage || [])
      .slice(0, 6)
      .map((f: { feature: string; usage: number }) => `${f.feature}: ${f.usage}% relative`)
      .join("\n") || "—";

  const avatarLines =
    (dash?.avatarDistribution || [])
      .map((a: { name: string; value: number }) => `${a.name}: ${a.value}%`)
      .join("\n") || "—";

  const buildReport = (reportName: string) => {
    const d = dash;
    const header = `EZRI — ${reportName}
Generated: ${new Date().toLocaleString()}

`;
    if (reportName === "User Activity Report") {
      return (
        header +
        `SUMMARY
Total users (profiles): ${d?.totalUsers ?? 0}
Total sessions: ${d?.totalSessions ?? 0}
Avg session length (min): ${d?.avgSessionLength ?? 0}

FEATURE USAGE (relative %)
${featureLines}

SESSION ACTIVITY (selected window)
${sessionActivity.map((x: { day: string; sessions: number }) => `${x.day}: ${x.sessions} sessions`).join("\n")}
`
      );
    }
    if (reportName === "Financial Report") {
      return (
        header +
        `Revenue (cash, last 30 days): $${(d?.revenue ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}

REVENUE BY PERIOD
${(d?.revenueData || [])
  .map((x: { month: string; revenue: number }) => `${x.month}: $${x.revenue}`)
  .join("\n")}
`
      );
    }
    if (reportName === "Crisis Intervention Report") {
      return (
        header +
        `Pending crisis events: ${d?.crisisAlerts ?? 0}
(Export detailed crisis logs from Crisis dashboards.)

Platform health is summarized elsewhere; this report uses live admin stats only.
`
      );
    }
    return (
      header +
      `SESSION ANALYTICS
Total sessions: ${d?.totalSessions ?? 0}
Avg duration (min): ${d?.avgSessionLength ?? 0}

AVATAR / COMPANION (profile selected_avatar distribution)
${avatarLines}

HOURLY DISTRIBUTION (label: sessions in range)
${(d?.hourlyActivity || [])
  .map((h: { hour: string; sessions: number }) => `${h.hour}: ${h.sessions}`)
  .join("\n")}
`
    );
  };

  const handleDownload = (reportName: string) => {
    const text = buildReport(reportName);
    downloadTextFile(
      `${reportName.replace(/\s+/g, "_")}_${new Date().toISOString().slice(0, 10)}.txt`,
      text
    );
  };

  const exportAll = () => {
    const names = [
      "User Activity Report",
      "Financial Report",
      "Crisis Intervention Report",
      "Session Analytics Report",
    ];
    const combined = names.map((n) => buildReport(n)).join("\n\n---\n\n");
    downloadTextFile(`all-reports_${new Date().toISOString().slice(0, 10)}.txt`, combined);
  };

  const avgEng =
    dash?.featureUsage?.length > 0
      ? Math.round(
          dash.featureUsage.reduce((s: number, x: { usage: number }) => s + x.usage, 0) /
            dash.featureUsage.length
        )
      : 0;

  return (
    <AdminLayoutNew>
      <div className="space-y-6">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="text-3xl font-bold mb-2">Reports & Analytics</h1>
              <p className="text-muted-foreground">
                Data-driven exports from live admin stats (text reports; open in Excel or print to PDF from your
                viewer).
              </p>
            </div>
            <Button className="gap-2 shrink-0" onClick={exportAll} disabled={isLoading || !dash}>
              <Download className="w-4 h-4" />
              Export all reports
            </Button>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatsCard
            title="Revenue (cash, range)"
            value={`$${(dash?.revenue ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            change="live"
            changeType="positive"
            icon={TrendingUp}
            color="success"
            delay={0}
          />
          <StatsCard
            title="Total users"
            value={(dash?.totalUsers ?? 0).toLocaleString()}
            change="profiles"
            changeType="positive"
            icon={Users}
            color="primary"
            delay={0.1}
          />
          <StatsCard
            title="Avg session time"
            value={`${dash?.avgSessionLength ?? 0} min`}
            change="all sessions"
            changeType="positive"
            icon={Clock}
            color="secondary"
            delay={0.2}
          />
          <StatsCard
            title="Avg feature usage"
            value={`${avgEng}%`}
            change="relative"
            changeType="positive"
            icon={Activity}
            color="accent"
            delay={0.3}
          />
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
          >
            <Card className="p-6">
              <h2 className="text-xl font-bold mb-2">User growth</h2>
              <p className="text-sm text-muted-foreground mb-4">Cumulative profiles by period (admin stats series)</p>
              <ResponsiveContainer width="100%" height={320}>
                <AreaChart
                  data={userData.length ? userData : [{ month: "—", users: 0 }]}
                  margin={{ top: 8, right: 12, left: 8, bottom: 8 }}
                >
                  <defs>
                    <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#9b87f5" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#9b87f5" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis
                    dataKey="month"
                    stroke="#6b7280"
                    tick={{ fontSize: 11 }}
                    angle={-40}
                    textAnchor="end"
                    height={68}
                    interval="preserveStartEnd"
                    minTickGap={28}
                  />
                  <YAxis
                    stroke="#6b7280"
                    tick={{ fontSize: 11 }}
                    width={48}
                    domain={[0, "auto"]}
                    tickMargin={8}
                  />
                  <Tooltip />
                  <Area
                    type="monotone"
                    dataKey="users"
                    stroke="#9b87f5"
                    fillOpacity={1}
                    fill="url(#colorUsers)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5 }}
          >
            <Card className="p-6">
              <h2 className="text-xl font-bold mb-2">Talk it out by day (current window)</h2>
              <p className="text-sm text-muted-foreground mb-4">
                Daily session counts — labels angle automatically; hover for exact dates.
              </p>
              <ResponsiveContainer width="100%" height={320}>
                <LineChart
                  data={engagementData.length ? engagementData : [{ week: "—", engagement: 0 }]}
                  margin={{ top: 8, right: 12, left: 8, bottom: 4 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis
                    dataKey="week"
                    stroke="#6b7280"
                    tick={{ fontSize: 10 }}
                    angle={-55}
                    textAnchor="end"
                    height={78}
                    interval="preserveStartEnd"
                    minTickGap={32}
                  />
                  <YAxis
                    stroke="#6b7280"
                    tick={{ fontSize: 11 }}
                    width={44}
                    domain={[0, "auto"]}
                    tickMargin={10}
                  />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="engagement"
                    stroke="#7c3aed"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 5 }}
                    name="Talk it out"
                  />
                </LineChart>
              </ResponsiveContainer>
            </Card>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
        >
          <Card className="p-6">
            <h2 className="text-xl font-bold mb-4">Available reports</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Downloads are UTF-8 text summaries built from the same live metrics as the admin dashboard. Use your
              browser&apos;s print dialog if you need a PDF.
            </p>
            <div className="grid md:grid-cols-2 gap-4">
              {[
                { name: "User Activity Report", description: "Detailed user engagement metrics" },
                { name: "Financial Report", description: "Revenue and subscription data" },
                { name: "Crisis Intervention Report", description: "Crisis events and response times" },
                { name: "Session Analytics Report", description: "AI session metrics and trends" },
              ].map((report, index) => (
                <div
                  key={index}
                  className="p-4 border border-gray-200 rounded-lg hover:border-primary transition-colors"
                >
                  <h3 className="font-bold mb-1">{report.name}</h3>
                  <p className="text-sm text-muted-foreground mb-3">{report.description}</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    disabled={!dash}
                    onClick={() => handleDownload(report.name)}
                  >
                    <Download className="w-4 h-4" />
                    Download report
                  </Button>
                </div>
              ))}
            </div>
          </Card>
        </motion.div>
      </div>
    </AdminLayoutNew>
  );
}
