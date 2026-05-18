import { motion } from "motion/react";
import { AdminLayoutNew } from "../../components/AdminLayoutNew";
import {
  Shield,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  FileText,
  Lock,
  Eye,
  Clock,
  Users,
  Database,
  Key,
  Activity,
  X,
} from "lucide-react";
import { Card } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { useState, useEffect, useMemo } from "react";
import { api } from "@/lib/api";
import { formatDistanceToNow } from "date-fns";

function detailPreview(details: unknown): string {
  if (details == null) return "—";
  if (typeof details === "object" && details !== null) {
    const d = details as Record<string, unknown>;
    if (typeof d.target === "string") return d.target;
  }
  try {
    const s = JSON.stringify(details);
    return s.length > 80 ? `${s.slice(0, 77)}…` : s;
  } catch {
    return "—";
  }
}

export function HIPAACompliance() {
  const [showAllAudits, setShowAllAudits] = useState(false);
  const [auditRows, setAuditRows] = useState<any[]>([]);
  const [crisisPending, setCrisisPending] = useState(0);
  const [openErrors, setOpenErrors] = useState(0);
  const [totalUsers, setTotalUsers] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [audits, crises, errs, dash] = await Promise.all([
          api.admin.getAuditLogs({ page: 1, limit: 50 }),
          api.admin.getCrisisEvents({ status: "pending", page: 1, limit: 100 }),
          api.admin.getErrorLogs({ page: 1, limit: 100 }),
          api.admin.getStats(),
        ]);
        if (cancelled) return;
        setAuditRows(Array.isArray(audits) ? audits : []);
        setCrisisPending(Array.isArray(crises) ? crises.length : 0);
        setOpenErrors(Array.isArray(errs) ? errs.filter((e: any) => e.status === "open").length : 0);
        setTotalUsers(dash?.totalUsers ?? 0);
      } catch (e) {
        console.error(e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const complianceChecks = useMemo(() => {
    const n = auditRows.length;
    const crisisOk = crisisPending === 0 ? 1 : 0;
    const errOk = openErrors === 0 ? 1 : 0;
    return [
      {
        category: "Audit events recorded",
        passed: Math.min(n, 999),
        failed: n === 0 ? 1 : 0,
        total: Math.max(1, n),
        score: n > 0 ? 100 : 40,
      },
      {
        category: "Crisis queue (pending)",
        passed: crisisOk,
        failed: 1 - crisisOk,
        total: 1,
        score: crisisOk ? 100 : 40,
      },
      {
        category: "Open application errors",
        passed: errOk,
        failed: 1 - errOk,
        total: 1,
        score: errOk ? 100 : 60,
      },
      {
        category: "User profiles (data subjects)",
        passed: totalUsers > 0 ? 1 : 0,
        failed: totalUsers > 0 ? 0 : 1,
        total: 1,
        score: totalUsers > 0 ? 100 : 50,
      },
    ];
  }, [auditRows.length, crisisPending, openErrors, totalUsers]);

  const auditTrail = useMemo(() => {
    return auditRows.map((a) => {
      const actor = a.profiles;
      const ts = a.created_at ? new Date(a.created_at) : new Date();
      return {
        id: String(a.id),
        action: a.action || "—",
        user: actor?.full_name?.trim() || actor?.email || "System",
        resource: detailPreview(a.details),
        timestamp: formatDistanceToNow(ts, { addSuffix: true }),
        status: "success" as const,
      };
    });
  }, [auditRows]);

  const displayAudits = useMemo(
    () => (showAllAudits ? auditTrail : auditTrail.slice(0, 4)),
    [auditTrail, showAllAudits]
  );

  const stats = useMemo(() => {
    const avgScore =
      complianceChecks.length > 0
        ? Math.round(
            complianceChecks.reduce((s, c) => s + c.score, 0) / complianceChecks.length
          )
        : 0;
    const passedSum = complianceChecks.reduce((s, c) => s + c.passed, 0);
    const totalSum = complianceChecks.reduce((s, c) => s + c.total, 0);
    return [
      {
        label: "Operational score (derived)",
        value: `${avgScore}%`,
        icon: Shield,
        color: "from-green-500 to-emerald-600",
      },
      {
        label: "Checks (passed / rows)",
        value: `${passedSum}/${totalSum}`,
        icon: CheckCircle2,
        color: "from-blue-500 to-cyan-600",
      },
      {
        label: "Audit log rows (loaded)",
        value: String(auditRows.length),
        icon: FileText,
        color: "from-purple-500 to-pink-600",
      },
      {
        label: "Transport",
        value: "HTTPS",
        icon: Lock,
        color: "from-orange-500 to-amber-600",
      },
    ];
  }, [complianceChecks, auditRows.length]);

  return (
    <AdminLayoutNew>
      <div className="max-w-7xl mx-auto space-y-6">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1 className="text-4xl font-bold text-gray-900 mb-2">HIPAA Compliance</h1>
          <p className="text-gray-600">Health data compliance and audit trail</p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {stats.map((stat, index) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card className="bg-white border-gray-200 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">{stat.label}</p>
                    <p className="text-3xl font-bold text-gray-900">{stat.value}</p>
                  </div>
                  <div
                    className={`w-12 h-12 rounded-xl bg-gradient-to-br ${stat.color} flex items-center justify-center`}
                  >
                    <stat.icon className="w-6 h-6 text-white" />
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="bg-white border-gray-200 p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-6">
              Compliance Checklist
            </h3>
            <div className="space-y-4">
              {complianceChecks.map((check) => (
                <div key={check.category} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-900 font-medium">{check.category}</span>
                    <span className="text-sm text-gray-600">
                      {check.passed}/{check.total} checks passed
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-3 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          check.score === 100
                            ? "bg-gradient-to-r from-green-500 to-emerald-600"
                            : check.score >= 90
                            ? "bg-gradient-to-r from-blue-500 to-cyan-600"
                            : "bg-gradient-to-r from-yellow-500 to-orange-600"
                        }`}
                        style={{ width: `${check.score}%` }}
                      />
                    </div>
                    <span className="text-sm font-bold text-gray-900 w-12">
                      {check.score}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="bg-white border-gray-200 p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-gray-900">Audit Trail</h3>
              <Button
                variant="outline"
                className="border-gray-300 text-gray-900 hover:bg-gray-100"
                onClick={() => setShowAllAudits(!showAllAudits)}
              >
                <Eye className="w-4 h-4 mr-2" />
                {showAllAudits ? "Hide All" : "View All"}
              </Button>
            </div>
            <div className="space-y-3">
              {displayAudits.map((entry) => (
                <div
                  key={entry.id}
                  className="p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-all"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div
                        className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                          entry.status === "success"
                            ? "bg-green-100"
                            : "bg-red-100"
                        }`}
                      >
                        {entry.status === "success" ? (
                          <CheckCircle2 className="w-5 h-5 text-green-600" />
                        ) : (
                          <XCircle className="w-5 h-5 text-red-600" />
                        )}
                      </div>
                      <div>
                        <p className="text-gray-900 font-medium">{entry.action}</p>
                        <p className="text-sm text-gray-600">
                          {entry.user} • {entry.resource}
                        </p>
                      </div>
                    </div>
                    <span className="text-xs text-gray-500">{entry.timestamp}</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </motion.div>
      </div>
    </AdminLayoutNew>
  );
}