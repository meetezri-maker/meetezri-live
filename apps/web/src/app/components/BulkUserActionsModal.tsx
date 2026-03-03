import { motion, AnimatePresence } from "motion/react";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import {
  X,
  CheckCircle2,
  Ban,
  Mail,
  Trash2,
  Users,
  AlertTriangle,
  Download,
  UserX,
} from "lucide-react";

interface BulkUserActionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedUserCount: number;
  onAction: (action: string) => void;
}

export function BulkUserActionsModal({
  isOpen,
  onClose,
  selectedUserCount,
  onAction,
}: BulkUserActionsModalProps) {
  const actions = [
    {
      id: "activate",
      label: "Activate Accounts",
      description: "Set selected users to active status",
      icon: CheckCircle2,
      color: "text-green-600",
      bg: "bg-green-50",
      border: "border-green-200",
    },
    {
      id: "suspend",
      label: "Suspend Accounts",
      description: "Temporarily suspend selected users",
      icon: Ban,
      color: "text-red-600",
      bg: "bg-red-50",
      border: "border-red-200",
    },
    {
      id: "deactivate",
      label: "Deactivate Accounts",
      description: "Set selected users to inactive status",
      icon: UserX,
      color: "text-gray-600",
      bg: "bg-gray-50",
      border: "border-gray-200",
    },
    {
      id: "email",
      label: "Send Email",
      description: "Send a bulk email to selected users",
      icon: Mail,
      color: "text-blue-600",
      bg: "bg-blue-50",
      border: "border-blue-200",
    },
    {
      id: "export",
      label: "Export Data",
      description: "Download user data as CSV",
      icon: Download,
      color: "text-purple-600",
      bg: "bg-purple-50",
      border: "border-purple-200",
    },
    {
      id: "delete",
      label: "Delete Accounts",
      description: "Permanently delete selected users",
      icon: Trash2,
      color: "text-red-600",
      bg: "bg-red-50",
      border: "border-red-200",
      dangerous: true,
    },
  ];

  const handleActionClick = (actionId: string) => {
    if (actionId === "delete") {
      if (
        window.confirm(
          `Are you sure you want to permanently delete ${selectedUserCount} user(s)? This action cannot be undone.`
        )
      ) {
        onAction(actionId);
        onClose();
      }
    } else {
      onAction(actionId);
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 z-50"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                      <Users className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold">Bulk User Actions</h2>
                      <p className="text-sm text-muted-foreground">
                        {selectedUserCount} user{selectedUserCount !== 1 ? "s" : ""}{" "}
                        selected
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={onClose}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Actions Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {actions.map((action, index) => (
                    <motion.button
                      key={action.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      onClick={() => handleActionClick(action.id)}
                      className={`p-4 border-2 ${action.border} ${action.bg} rounded-lg text-left hover:shadow-md transition-all group ${
                        action.dangerous ? "hover:border-red-400" : "hover:border-primary"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`w-10 h-10 rounded-lg bg-white flex items-center justify-center flex-shrink-0`}>
                          <action.icon className={`w-5 h-5 ${action.color}`} />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-medium mb-1">{action.label}</h3>
                          <p className="text-sm text-muted-foreground">
                            {action.description}
                          </p>
                        </div>
                      </div>
                      {action.dangerous && (
                        <div className="flex items-center gap-2 mt-3 text-xs text-red-600">
                          <AlertTriangle className="w-3 h-3" />
                          <span>This action is permanent</span>
                        </div>
                      )}
                    </motion.button>
                  ))}
                </div>

                {/* Footer */}
                <div className="mt-6 pt-6 border-t flex justify-end gap-3">
                  <Button variant="outline" onClick={onClose}>
                    Cancel
                  </Button>
                </div>
              </div>
            </Card>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
