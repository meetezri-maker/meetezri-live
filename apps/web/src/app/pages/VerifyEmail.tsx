import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Mail, ArrowRight, CheckCircle2 } from "lucide-react";
import { motion } from "motion/react";
import { Link } from "react-router-dom";
import { PublicNav } from "../components/PublicNav";

export function VerifyEmail() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-purple-50/30 to-white relative overflow-hidden">
      <PublicNav />
      
      <div className="relative z-10 max-w-md mx-auto px-4 py-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Card className="p-8 text-center shadow-2xl backdrop-blur-sm bg-white/90">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 200, damping: 20, delay: 0.2 }}
              className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6"
            >
              <Mail className="w-10 h-10 text-primary" />
            </motion.div>
            
            <h1 className="text-2xl font-bold mb-4">Check your email</h1>
            <p className="text-muted-foreground mb-8">
              We've sent a verification link to your email address. Please click the link to verify your account and get started.
            </p>
            
            <div className="space-y-4">
              <div className="p-4 bg-green-50 rounded-lg flex items-start gap-3 text-left">
                <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-green-800">
                  <p className="font-semibold mb-1">Next steps:</p>
                  <ul className="list-disc pl-4 space-y-1">
                    <li>Open the email from MeetEzri</li>
                    <li>Click the verification link</li>
                    <li>Return here to log in</li>
                  </ul>
                </div>
              </div>

              <Link to="/login">
                <Button className="w-full group">
                  Back to Login
                  <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                </Button>
              </Link>
              
              <p className="text-xs text-muted-foreground mt-6">
                Didn't receive the email? Check your spam folder or <Link to="/signup" className="text-primary hover:underline">try signing up again</Link> with a different email.
              </p>
            </div>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
