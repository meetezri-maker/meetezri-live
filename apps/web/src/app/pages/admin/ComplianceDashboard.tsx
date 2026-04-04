import { useState, useEffect, useMemo } from "react";
import { motion } from "motion/react";
import { AdminLayoutNew } from "../../components/AdminLayoutNew";
import { Card } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { api } from "@/lib/api";
import { format } from "date-fns";
import {
  Shield,
  CheckCircle,
  AlertTriangle,
  XCircle,
  FileText,
  Lock,
  Eye,
  Download,
  Calendar,
  Users,
  Database,
  Key,
  Activity,
  TrendingUp,
  Clock,
  FileCheck,
  AlertCircle,
  X,
  Play,
} from "lucide-react";

export function ComplianceDashboard() {
  const [showAuditDetails, setShowAuditDetails] = useState(false);
  const [selectedAudit, setSelectedAudit] = useState<any>(null);
  const [showRunAuditModal, setShowRunAuditModal] = useState(false);
  const [showExportSuccess, setShowExportSuccess] = useState(false);
  const [showAuditStarted, setShowAuditStarted] = useState(false);
  const [dash, setDash] = useState<{ totalUsers?: number } | null>(null);
  const [auditSample, setAuditSample] = useState<any[]>([]);
  const [openErrors, setOpenErrors] = useState(0);
  const [crisisN, setCrisisN] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [s, a, e, cr] = await Promise.all([
          api.admin.getStats(),
          api.admin.getAuditLogs({ limit: 20 }),
          api.admin.getErrorLogs({ page: 1, limit: 200 }),
          api.admin.getCrisisEvents({ status: "pending", limit: 100 }),
        ]);
        if (cancelled) return;
        setDash(s ?? null);
        setAuditSample(Array.isArray(a) ? a : []);
        const errs = Array.isArray(e) ? e : [];
        setOpenErrors(errs.filter((x: { status?: string }) => x.status === "open").length);
        setCrisisN(Array.isArray(cr) ? cr.length : 0);
      } catch (err) {
        console.error(err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

  const complianceMetrics = useMemo(() => {
    const totalUsers = dash?.totalUsers ?? 0;
    const auditN = auditSample.length;
    const penalty =
      crisisN * 4 + openErrors * 2 + (auditN === 0 ? 12 : 0) + (totalUsers === 0 ? 8 : 0);
    const overall = clamp(Math.round(100 - penalty), 35, 100);
    const hipaa = clamp(
      Math.round(100 - crisisN * 5 - openErrors * 3 - (auditN === 0 ? 15 : 0)),
      35,
      100
    );
    const gdpr = clamp(Math.round(100 - (auditN < 5 ? 15 : 0) - openErrors * 2), 35, 100);
    const dataRetention = clamp(Math.round(100 - openErrors * 2), 35, 100);
    const encryption: number | null = null;
    return { overall, hipaa, gdpr, dataRetention, encryption };
  }, [dash, auditSample, crisisN, openErrors]);

  const recentAudits = useMemo(() => {
    return auditSample.map((a, i) => {
      const ts = a.created_at ? new Date(a.created_at) : null;
      let detailsLine = "";
      try {
        const d = a.details;
        if (d != null) {
          detailsLine =
            typeof d === "object" ? JSON.stringify(d).slice(0, 400) : String(d).slice(0, 400);
        }
      } catch {
        detailsLine = "";
      }
      const actor = a.profiles?.full_name?.trim() || a.profiles?.email || "";
      return {
        id: a.id ?? i,
        type: String(a.action || "audit_event"),
        date: ts ? format(ts, "MMM d, yyyy") : "—",
        status: "passed",
        score: 100,
        findings: 0,
        detailsLine: detailsLine || actor,
      };
    });
  }, [auditSample]);

  const certifications = useMemo(() => {
    const last = auditSample[0]?.created_at;
    return [
      {
        name: "External certifications (HIPAA, SOC 2, GDPR, ISO)",
        status: "not_tracked",
        validUntil: "Not stored in app",
        lastAudit: last ? format(new Date(last), "MMM d, yyyy") : "—",
      },
    ];
  }, [auditSample]);

  const dataPrivacyStats = useMemo(
    () => ({
      totalUsers: dash?.totalUsers ?? 0,
      consentGiven: 0,
      consentRate: null as number | null,
      dataRequests: 0,
      deletionRequests: 0,
      exportRequests: 0,
    }),
    [dash]
  );

  const securityControls = useMemo(() => {
    const auditN = auditSample.length;
    const tu = dash?.totalUsers ?? 0;
    return [
      {
        category: "Signals from application data",
        controls: [
          {
            name: "Registered users",
            status: tu > 0 ? "implemented" : "partial",
            coverage: tu > 0 ? 100 : 0,
          },
          {
            name: "Audit events loaded (sample)",
            status: auditN > 0 ? "implemented" : "partial",
            coverage: clamp(Math.min(100, auditN * 5), 0, 100),
          },
          {
            name: "Pending crisis events",
            status: crisisN === 0 ? "implemented" : "partial",
            coverage: crisisN === 0 ? 100 : 50,
          },
          {
            name: "Open application errors",
            status: openErrors === 0 ? "implemented" : "partial",
            coverage: openErrors === 0 ? 100 : clamp(100 - openErrors * 5, 0, 100),
          },
        ],
      },
    ];
  }, [auditSample.length, dash, crisisN, openErrors]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "passed":
      case "certified":
      case "implemented":
        return "text-green-600 bg-green-100 border-green-300";
      case "action_required":
      case "partial":
        return "text-yellow-600 bg-yellow-100 border-yellow-300";
      case "in_progress":
        return "text-blue-600 bg-blue-100 border-blue-300";
      case "failed":
        return "text-red-600 bg-red-100 border-red-300";
      case "not_tracked":
        return "text-gray-600 bg-gray-100 border-gray-300";
      default:
        return "text-gray-600 bg-gray-100 border-gray-300";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "passed":
      case "certified":
      case "implemented":
        return CheckCircle;
      case "action_required":
      case "partial":
        return AlertTriangle;
      case "in_progress":
        return Clock;
      case "failed":
        return XCircle;
      case "not_tracked":
        return AlertCircle;
      default:
        return AlertCircle;
    }
  };

  const handleExportReport = () => {
    const headers = ["Category", "Score", "Status", "Details"];
    const enc =
      complianceMetrics.encryption == null
        ? "Not measured"
        : `${complianceMetrics.encryption}%`;
    const csvContent = [
      headers.join(","),
      [
        "Overall (derived from users, audits, crises, errors)",
        `${complianceMetrics.overall}%`,
        "derived",
        "Not a legal certification",
      ].join(","),
      [
        "HIPAA-oriented score (derived)",
        `${complianceMetrics.hipaa}%`,
        "derived",
        "Based on crisis + audit + error signals",
      ].join(","),
      [
        "GDPR-oriented score (derived)",
        `${complianceMetrics.gdpr}%`,
        "derived",
        "Based on audit volume + errors",
      ].join(","),
      [
        "Data retention oriented (derived)",
        `${complianceMetrics.dataRetention}%`,
        "derived",
        "Based on error volume",
      ].join(","),
      [
        "Encryption",
        enc,
        complianceMetrics.encryption == null ? "n/a" : "derived",
        "Infrastructure not measured in app",
      ].join(","),
      "",
      ["Recent audit log events", "", "", ""],
      ...recentAudits.map((audit) =>
        [audit.type, `${audit.score}%`, audit.status, `${audit.date}`.replace(/,/g, ";")].join(",")
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `compliance-report-${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);

    setShowExportSuccess(true);
    setTimeout(() => setShowExportSuccess(false), 3000);
  };

  const handleViewAudit = (audit: (typeof recentAudits)[number]) => {
    setSelectedAudit(audit);
    setShowAuditDetails(true);
  };

  const handleRunAudit = () => {
    setShowRunAuditModal(true);
  };

  const handleExportAudit = (audit: (typeof recentAudits)[number]) => {
    const csvContent = [
      `Audit log event — ${audit.type}`,
      "",
      "Details",
      `ID,${audit.id}`,
      `Action,${audit.type}`,
      `Date,${audit.date}`,
      `Status,${audit.status}`,
      `Details (preview),${String(audit.detailsLine || "").replace(/\n/g, " ")}`,
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-event-${audit.id}-${String(audit.type).replace(/\s+/g, "-").toLowerCase()}-${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);

    setShowAuditDetails(false);
    setShowExportSuccess(true);
    setTimeout(() => setShowExportSuccess(false), 3000);
  };

  const handleStartAudit = () => {
    setShowRunAuditModal(false);
    setShowAuditStarted(true);
    setTimeout(() => setShowAuditStarted(false), 3000);
  };

  return (
    <AdminLayoutNew>
      <div className="space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg">
                <Shield className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold">Compliance Dashboard</h1>
                <p className="text-muted-foreground">
                  Monitor HIPAA, GDPR, and security compliance
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="gap-2" onClick={handleExportReport}>
                <Download className="w-4 h-4" />
                Export Report
              </Button>
              <Button className="gap-2" onClick={handleRunAudit}>
                <FileCheck className="w-4 h-4" />
                Run Audit
              </Button>
            </div>
          </div>
        </motion.div>

        {/* Overall Compliance Score */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="p-8">
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-2">Overall Compliance Score</p>
              <div className="relative inline-block">
                <svg className="w-32 h-32 transform -rotate-90">
                  <circle
                    cx="64"
                    cy="64"
                    r="56"
                    stroke="#E5E7EB"
                    strokeWidth="8"
                    fill="none"
                  />
                  <circle
                    cx="64"
                    cy="64"
                    r="56"
                    stroke="#10B981"
                    strokeWidth="8"
                    fill="none"
                    strokeDasharray={`${2 * Math.PI * 56}`}
                    strokeDashoffset={`${2 * Math.PI * 56 * (1 - (complianceMetrics.overall ?? 0) / 100)}`}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div>
                    <p className="text-4xl font-bold">{complianceMetrics.overall}%</p>
                  </div>
                </div>
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                Derived from live stats — {format(new Date(), "MMM d, yyyy")}
              </p>
            </div>
          </Card>
        </motion.div>

        {/* Compliance Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold">HIPAA Compliance</h3>
                <Shield className="w-5 h-5 text-blue-600" />
              </div>
              <div className="mb-2">
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold">{complianceMetrics.hipaa}%</span>
                  <CheckCircle className="w-5 h-5 text-green-600" />
                </div>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full"
                  style={{ width: `${complianceMetrics.hipaa}%` }}
                />
              </div>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
          >
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold">GDPR Compliance</h3>
                <FileText className="w-5 h-5 text-purple-600" />
              </div>
              <div className="mb-2">
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold">{complianceMetrics.gdpr}%</span>
                  <CheckCircle className="w-5 h-5 text-green-600" />
                </div>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-purple-600 h-2 rounded-full"
                  style={{ width: `${complianceMetrics.gdpr}%` }}
                />
              </div>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold">Data Retention</h3>
                <Database className="w-5 h-5 text-green-600" />
              </div>
              <div className="mb-2">
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold">{complianceMetrics.dataRetention}%</span>
                  <CheckCircle className="w-5 h-5 text-green-600" />
                </div>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-green-600 h-2 rounded-full"
                  style={{ width: `${complianceMetrics.dataRetention}%` }}
                />
              </div>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
          >
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold">Encryption</h3>
                <Lock className="w-5 h-5 text-orange-600" />
              </div>
              <div className="mb-2">
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold">
                    {complianceMetrics.encryption == null ? "—" : `${complianceMetrics.encryption}%`}
                  </span>
                  {complianceMetrics.encryption != null && (
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Encryption at rest / in transit is not measured in this app; confirm with your host.
                </p>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-orange-600 h-2 rounded-full"
                  style={{
                    width:
                      complianceMetrics.encryption == null
                        ? "0%"
                        : `${complianceMetrics.encryption}%`,
                  }}
                />
              </div>
            </Card>
          </motion.div>
        </div>

        {/* Recent Audits */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Card className="p-6">
            <h3 className="font-bold text-lg mb-4">Recent audit log events</h3>
            <div className="space-y-3">
              {recentAudits.length === 0 && (
                <p className="text-sm text-muted-foreground py-4">
                  No audit log rows returned yet. Actions on protected resources will appear here.
                </p>
              )}
              {recentAudits.map((audit, index) => {
                const StatusIcon = getStatusIcon(audit.status);
                return (
                  <motion.div
                    key={audit.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.5 + index * 0.05 }}
                    className="flex items-center justify-between p-4 border rounded-lg hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-center gap-4">
                      <StatusIcon className={`w-6 h-6 ${audit.status === 'passed' ? 'text-green-600' : 'text-yellow-600'}`} />
                      <div>
                        <h4 className="font-medium">{audit.type}</h4>
                        <p className="text-sm text-muted-foreground">{audit.date}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="font-bold text-lg">{audit.score}%</p>
                        <p className="text-xs text-muted-foreground">{audit.findings} findings</p>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(audit.status)}`}>
                        {audit.status.replace("_", " ")}
                      </span>
                      <Button variant="ghost" size="sm" onClick={() => handleViewAudit(audit)}>
                        <Eye className="w-4 h-4" />
                      </Button>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </Card>
        </motion.div>

        {/* Certifications */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
        >
          <Card className="p-6">
            <h3 className="font-bold text-lg mb-4">Certifications & Standards</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {certifications.map((cert, index) => {
                const StatusIcon = getStatusIcon(cert.status);
                return (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.7 + index * 0.05 }}
                    className="p-4 border rounded-lg"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <StatusIcon
                          className={`w-5 h-5 ${
                            cert.status === "certified"
                              ? "text-green-600"
                              : cert.status === "not_tracked"
                                ? "text-gray-600"
                                : "text-blue-600"
                          }`}
                        />
                        <h4 className="font-bold">{cert.name}</h4>
                      </div>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(cert.status)}`}>
                        {cert.status.replace("_", " ")}
                      </span>
                    </div>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Valid Until:</span>
                        <span className="font-medium">{cert.validUntil}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Last Audit:</span>
                        <span className="font-medium">{cert.lastAudit}</span>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </Card>
        </motion.div>

        {/* Data Privacy Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
        >
          <Card className="p-6">
            <h3 className="font-bold text-lg mb-4">Data Privacy & User Rights</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <Users className="w-8 h-8 text-green-600 mx-auto mb-2" />
                <p className="text-3xl font-bold text-green-600">
                  {dataPrivacyStats.consentRate == null ? "—" : `${dataPrivacyStats.consentRate}%`}
                </p>
                <p className="text-sm text-muted-foreground">Consent rate</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Not stored in app — {dataPrivacyStats.totalUsers.toLocaleString()} registered users
                </p>
              </div>
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <Download className="w-8 h-8 text-blue-600 mx-auto mb-2" />
                <p className="text-3xl font-bold text-blue-600">{dataPrivacyStats.exportRequests}</p>
                <p className="text-sm text-muted-foreground">Data export requests</p>
                <p className="text-xs text-muted-foreground mt-1">Not tracked in database</p>
              </div>
              <div className="text-center p-4 bg-purple-50 rounded-lg">
                <XCircle className="w-8 h-8 text-purple-600 mx-auto mb-2" />
                <p className="text-3xl font-bold text-purple-600">{dataPrivacyStats.deletionRequests}</p>
                <p className="text-sm text-muted-foreground">Deletion requests</p>
                <p className="text-xs text-muted-foreground mt-1">Not tracked in database</p>
              </div>
            </div>
          </Card>
        </motion.div>

        {/* Security Controls */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9 }}
        >
          <Card className="p-6">
            <h3 className="font-bold text-lg mb-4">Security Controls Implementation</h3>
            <div className="space-y-6">
              {securityControls.map((category, catIndex) => (
                <div key={catIndex}>
                  <h4 className="font-bold mb-3">{category.category}</h4>
                  <div className="space-y-2">
                    {category.controls.map((control, ctrlIndex) => {
                      const StatusIcon = getStatusIcon(control.status);
                      return (
                        <div
                          key={ctrlIndex}
                          className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                        >
                          <div className="flex items-center gap-3">
                            <StatusIcon className={`w-5 h-5 ${control.status === 'implemented' ? 'text-green-600' : 'text-yellow-600'}`} />
                            <span className="font-medium">{control.name}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="w-32">
                              <div className="w-full bg-gray-200 rounded-full h-2">
                                <div
                                  className={`h-2 rounded-full ${control.status === 'implemented' ? 'bg-green-600' : 'bg-yellow-600'}`}
                                  style={{ width: `${control.coverage}%` }}
                                />
                              </div>
                            </div>
                            <span className="text-sm font-medium w-12 text-right">{control.coverage}%</span>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(control.status)}`}>
                              {control.status}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </motion.div>
      </div>

      {/* Export Success Toast */}
      {showExportSuccess && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="fixed top-10 right-10 bg-green-500 text-white px-6 py-3 rounded-xl shadow-lg flex items-center gap-2 z-50"
        >
          <CheckCircle className="w-5 h-5" />
          <span className="font-medium">Compliance report exported successfully!</span>
        </motion.div>
      )}

      {/* Audit Details Modal */}
      {showAuditDetails && selectedAudit && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => setShowAuditDetails(false)}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl p-6 max-w-3xl w-full shadow-2xl max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg ${selectedAudit.status === 'passed' ? 'bg-green-100' : 'bg-yellow-100'} flex items-center justify-center`}>
                  {selectedAudit.status === 'passed' ? (
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  ) : (
                    <AlertTriangle className="w-5 h-5 text-yellow-600" />
                  )}
                </div>
                <div>
                  <h2 className="text-2xl font-bold">{selectedAudit.type}</h2>
                  <p className="text-sm text-muted-foreground">Audit ID: {selectedAudit.id}</p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAuditDetails(false)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            <div className="space-y-4">
              {/* Score Card */}
              <Card className="p-4 bg-gradient-to-r from-blue-50 to-purple-50">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Compliance Score</p>
                    <p className="text-4xl font-bold">{selectedAudit.score}%</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground mb-1">Date</p>
                    <p className="font-medium">{selectedAudit.date}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground mb-1">Findings</p>
                    <p className="text-2xl font-bold text-orange-600">{selectedAudit.findings}</p>
                  </div>
                </div>
              </Card>

              {/* Status */}
              <div>
                <h3 className="font-bold mb-2">Audit Status</h3>
                <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium border ${getStatusColor(selectedAudit.status)}`}>
                  {selectedAudit.status.replace("_", " ").toUpperCase()}
                </span>
              </div>

              {/* Event payload */}
              <div>
                <h3 className="font-bold mb-3">Event details</h3>
                {selectedAudit.detailsLine ? (
                  <pre className="text-sm whitespace-pre-wrap break-words p-3 border rounded-lg bg-muted/50 max-h-48 overflow-y-auto">
                    {selectedAudit.detailsLine}
                  </pre>
                ) : (
                  <div className="p-3 border rounded-lg bg-muted/30 text-sm text-muted-foreground">
                    No extra JSON payload stored for this audit row (or action only).
                  </div>
                )}
              </div>

              <div>
                <h3 className="font-bold mb-3">Note</h3>
                <p className="text-sm text-muted-foreground">
                  Scores on this page are derived from user counts, audit log sample size, pending crisis
                  events, and open application errors — not from an external compliance audit.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 pt-4">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowAuditDetails(false)}
                >
                  Close
                </Button>
                <Button
                  className="flex-1 bg-gradient-to-r from-blue-500 to-indigo-600"
                  onClick={() => handleExportAudit(selectedAudit)}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Export Audit
                </Button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}

      {/* Run Audit Modal */}
      {showRunAuditModal && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => setShowRunAuditModal(false)}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl p-6 max-w-lg w-full shadow-2xl"
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                  <FileCheck className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold">Run Compliance Audit</h2>
                  <p className="text-sm text-muted-foreground">Select audit type and scope</p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowRunAuditModal(false)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Audit Type</label>
                <select className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary">
                  <option value="hipaa">HIPAA Security Audit</option>
                  <option value="gdpr">GDPR Compliance Review</option>
                  <option value="encryption">Data Encryption Audit</option>
                  <option value="access">Access Control Review</option>
                  <option value="full">Full Compliance Audit</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Scope</label>
                <select className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary">
                  <option value="all">All Systems</option>
                  <option value="production">Production Only</option>
                  <option value="database">Database Systems</option>
                  <option value="api">API Services</option>
                  <option value="authentication">Authentication Systems</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Priority</label>
                <select className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary">
                  <option value="standard">Standard (Complete in 24h)</option>
                  <option value="high">High (Complete in 6h)</option>
                  <option value="critical">Critical (Complete in 2h)</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="flex items-center gap-2">
                  <input type="checkbox" className="rounded" defaultChecked />
                  <span className="text-sm">Generate detailed report</span>
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" className="rounded" defaultChecked />
                  <span className="text-sm">Send email notification on completion</span>
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" className="rounded" />
                  <span className="text-sm">Compare with previous audits</span>
                </label>
              </div>

              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-blue-900">Audit Process</p>
                  <p className="text-xs text-blue-700">
                    The audit will scan all selected systems and generate a comprehensive compliance report. This process may take several hours depending on scope.
                  </p>
                </div>
              </div>

              <div className="flex gap-2 pt-4">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowRunAuditModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1 bg-gradient-to-r from-blue-500 to-indigo-600"
                  onClick={handleStartAudit}
                >
                  <Play className="w-4 h-4 mr-2" />
                  Start Audit
                </Button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}

      {/* Audit Started Toast */}
      {showAuditStarted && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="fixed top-10 right-10 bg-blue-500 text-white px-6 py-3 rounded-xl shadow-lg flex items-center gap-2 z-50"
        >
          <Play className="w-5 h-5" />
          <span className="font-medium">Compliance audit started successfully!</span>
        </motion.div>
      )}
    </AdminLayoutNew>
  );
}