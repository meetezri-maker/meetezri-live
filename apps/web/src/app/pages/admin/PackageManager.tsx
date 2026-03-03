import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { 
  Package, 
  Edit, 
  DollarSign, 
  Clock, 
  Users, 
  TrendingUp,
  Save,
  X,
  Check,
  Zap,
  Crown,
  Sparkles,
  ArrowRight
} from "lucide-react";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { AdminLayoutNew } from "../../components/AdminLayoutNew";
import { SUBSCRIPTION_PLANS } from "../../utils/subscriptionPlans";
import type { PlanTier, SubscriptionPlan } from "../../utils/subscriptionPlans";
import { api } from "../../../lib/api";

export function PackageManager() {
  const [plans, setPlans] = useState<Record<PlanTier, SubscriptionPlan>>(SUBSCRIPTION_PLANS);
  const [editingPlan, setEditingPlan] = useState<PlanTier | null>(null);
  const [editForm, setEditForm] = useState<Partial<SubscriptionPlan>>({});
  const [subscriptions, setSubscriptions] = useState<any[]>([]);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await api.billing.getAllSubscriptions();
        setSubscriptions(data || []);
      } catch (error) {
        console.error("Failed to load subscription stats:", error);
      }
    };
    load();
  }, []);

  const stats = useMemo(() => {
    if (!subscriptions.length) {
      return {
        totalSubscribers: 0,
        monthlyRevenue: 0,
        averagePerUser: 0,
        growth: 0,
      };
    }

    const activeSubs = subscriptions.filter((s) => s.status === "active");
    const totalSubscribers = activeSubs.length;
    const monthlyRevenue = activeSubs.reduce(
      (sum, s) => sum + (s.amount || 0),
      0
    );
    const averagePerUser =
      totalSubscribers > 0 ? monthlyRevenue / totalSubscribers : 0;

    return {
      totalSubscribers,
      monthlyRevenue,
      averagePerUser,
      growth: 0,
    };
  }, [subscriptions]);

  const planStats = useMemo(() => {
    const base: Record<PlanTier, { users: number; revenue: number }> = {
      trial: { users: 0, revenue: 0 },
      core: { users: 0, revenue: 0 },
      pro: { users: 0, revenue: 0 },
    };

    subscriptions.forEach((s) => {
      const planType = s.plan_type as PlanTier | undefined;
      if (!planType || !base[planType]) return;
      base[planType].users += 1;
      base[planType].revenue += s.amount || 0;
    });

    return base;
  }, [subscriptions]);

  const handleEdit = (planId: PlanTier) => {
    setEditingPlan(planId);
    setEditForm(plans[planId]);
  };

  const handleSave = () => {
    if (!editingPlan) return;
    
    setPlans({
      ...plans,
      [editingPlan]: {
        ...plans[editingPlan],
        ...editForm
      }
    });
    alert(`Saved changes to ${plans[editingPlan].displayName}`);
    setEditingPlan(null);
    setEditForm({});
  };

  const handleCancel = () => {
    setEditingPlan(null);
    setEditForm({});
  };

  return (
    <AdminLayoutNew>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Package Manager</h1>
          <p className="text-muted-foreground">
            Manage subscription plans, pricing, and pay-as-you-go rates
          </p>
        </div>

        {/* Overview Stats */}
        <div className="grid md:grid-cols-4 gap-6 mb-8">
          <Card className="p-6 bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
            <div className="flex items-center justify-between mb-2">
              <Users className="w-8 h-8 text-blue-600" />
              <TrendingUp className="w-5 h-5 text-green-600" />
            </div>
            <p className="text-sm text-muted-foreground mb-1">Total Subscribers</p>
            <p className="text-3xl font-bold text-blue-700">
              {stats.totalSubscribers.toLocaleString()}
            </p>
            <p className="text-xs text-green-600 mt-1">+{stats.growth}% this month</p>
          </Card>

          <Card className="p-6 bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
            <div className="flex items-center justify-between mb-2">
              <DollarSign className="w-8 h-8 text-green-600" />
            </div>
            <p className="text-sm text-muted-foreground mb-1">Monthly Revenue</p>
            <p className="text-3xl font-bold text-green-700">
              ${(stats.monthlyRevenue / 1000).toFixed(0)}K
            </p>
            <p className="text-xs text-muted-foreground mt-1">Recurring revenue</p>
          </Card>

          <Card className="p-6 bg-gradient-to-br from-purple-50 to-pink-50 border-purple-200">
            <div className="flex items-center justify-between mb-2">
              <Package className="w-8 h-8 text-purple-600" />
            </div>
            <p className="text-sm text-muted-foreground mb-1">Avg Per User</p>
            <p className="text-3xl font-bold text-purple-700">
              ${stats.averagePerUser}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Per month</p>
          </Card>

          <Link to="/admin/payg-transactions">
            <Card className="p-6 bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200 hover:shadow-lg transition-shadow cursor-pointer group">
              <div className="flex items-center justify-between mb-2">
                <Zap className="w-8 h-8 text-amber-600" />
                <ArrowRight className="w-5 h-5 text-amber-600 group-hover:translate-x-1 transition-transform" />
              </div>
              <p className="text-sm text-muted-foreground mb-1">PAYG Revenue</p>
              <p className="text-3xl font-bold text-amber-700">
                $12.4K
              </p>
              <p className="text-xs text-amber-600 mt-1 font-medium">
                View detailed transactions →
              </p>
            </Card>
          </Link>
        </div>

        {/* Plan Cards */}
        <div className="grid md:grid-cols-2 gap-6">
          {(Object.keys(plans) as PlanTier[]).map((planId) => {
            const plan = plans[planId];
            const isEditing = editingPlan === planId;
            const stat = planStats[planId];

            return (
              <Card 
                key={planId} 
                className={`p-6 border-2 ${
                  plan.popular 
                    ? 'border-purple-500 bg-gradient-to-br from-purple-50 to-pink-50' 
                    : 'border-border'
                }`}
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${plan.gradient} flex items-center justify-center`}>
                      {planId === 'trial' && <Sparkles className="w-6 h-6 text-white" />}
                      {planId === 'core' && <Package className="w-6 h-6 text-white" />}
                      {planId === 'pro' && <Zap className="w-6 h-6 text-white" />}
                    </div>
                    <div>
                      <h3 className="text-xl font-bold">{plan.displayName}</h3>
                      {plan.popular && (
                        <span className="text-xs bg-purple-500 text-white px-2 py-0.5 rounded-full font-semibold">
                          POPULAR
                        </span>
                      )}
                    </div>
                  </div>
                  
                  {!isEditing && (
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => handleEdit(planId)}
                    >
                      <Edit className="w-4 h-4 mr-2" />
                      Edit
                    </Button>
                  )}
                </div>

                {/* Editable Fields */}
                {isEditing ? (
                  <div className="space-y-4 mb-6">
                    {/* Price */}
                    <div>
                      <label className="block text-sm font-medium mb-2">
                        Monthly Price ($)
                      </label>
                      <input
                        type="number"
                        value={editForm.price ?? plan.price}
                        onChange={(e) => setEditForm({ ...editForm, price: Number(e.target.value) })}
                        className="w-full px-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        disabled={planId === 'trial'}
                      />
                    </div>

                    {/* Credits */}
                    <div>
                      <label className="block text-sm font-medium mb-2">
                        Minutes per Month
                      </label>
                      <input
                        type="number"
                        value={editForm.credits ?? plan.credits}
                        onChange={(e) => setEditForm({ ...editForm, credits: Number(e.target.value) })}
                        className="w-full px-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      />
                    </div>

                    {/* PAYG Rate */}
                    {planId !== 'trial' && (
                      <div>
                        <label className="block text-sm font-medium mb-2">
                          Pay-As-You-Go Rate ($ per minute)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={editForm.payAsYouGoRate ?? plan.payAsYouGoRate ?? 0}
                          onChange={(e) => setEditForm({ ...editForm, payAsYouGoRate: Number(e.target.value) })}
                          className="w-full px-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        />
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex gap-2 pt-4">
                      <Button 
                        onClick={handleSave}
                        className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
                      >
                        <Save className="w-4 h-4 mr-2" />
                        Save Changes
                      </Button>
                      <Button 
                        onClick={handleCancel}
                        variant="outline"
                        className="flex-1"
                      >
                        <X className="w-4 h-4 mr-2" />
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Display Current Values */}
                    <div className="grid grid-cols-2 gap-4 mb-6">
                      <div className="p-4 bg-background/50 rounded-lg border border-border">
                        <div className="flex items-center gap-2 mb-2">
                          <DollarSign className="w-4 h-4 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">Monthly Price</span>
                        </div>
                        <p className="text-2xl font-bold">
                          ${plan.price}
                        </p>
                      </div>

                      <div className="p-4 bg-background/50 rounded-lg border border-border">
                        <div className="flex items-center gap-2 mb-2">
                          <Clock className="w-4 h-4 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">Minutes/Month</span>
                        </div>
                        <p className="text-2xl font-bold">
                          {plan.credits}
                        </p>
                      </div>

                      {plan.payAsYouGoRate !== null && (
                        <div className="col-span-2 p-4 bg-green-50 rounded-lg border border-green-200">
                          <div className="flex items-center gap-2 mb-2">
                            <Zap className="w-4 h-4 text-green-600" />
                            <span className="text-xs text-green-700 font-medium">PAYG Rate</span>
                          </div>
                          <p className="text-2xl font-bold text-green-700">
                            ${plan.payAsYouGoRate}/min
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Statistics */}
                    <div className="p-4 bg-muted/30 rounded-lg border border-border">
                      <h4 className="font-semibold mb-3 flex items-center gap-2">
                        <Users className="w-4 h-4" />
                        Current Stats
                      </h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm text-muted-foreground">Subscribers</p>
                          <p className="text-xl font-bold">{stat.users.toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Monthly Revenue</p>
                          <p className="text-xl font-bold text-green-600">
                            ${(stat.revenue / 1000).toFixed(1)}K
                          </p>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </Card>
            );
          })}
        </div>

        {/* Info Box */}
        <Card className="p-6 mt-8 bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center flex-shrink-0">
              <Check className="w-5 h-5 text-white" />
            </div>
            <div>
              <h4 className="font-semibold text-blue-900 mb-2">Package Configuration Tips</h4>
              <ul className="text-sm text-blue-700 space-y-1">
                <li>• Higher-tier plans should have better PAYG rates to incentivize upgrades</li>
                <li>• Consider setting Pro plan PAYG rate 30-40% lower than Core</li>
                <li>• Trial users cannot purchase PAYG minutes - this encourages paid conversions</li>
                <li>• Changes take effect immediately but don't affect existing subscriptions mid-cycle</li>
              </ul>
            </div>
          </div>
        </Card>
      </div>
    </AdminLayoutNew>
  );
}
