import React, { useEffect, useState } from "react";
import { ShieldCheck, Key, UserCheck, Copy, Check, Info, ExternalLink, RefreshCw } from "lucide-react";
import { fetchDemoAccounts } from "../api/bankClient";
import { loginUser } from "../api/authClient";
import { useAuth } from "../context/AuthContext";

export const DemoAccountsTab: React.FC<{ onNavigateToTab: (tab: string) => void }> = ({ onNavigateToTab }) => {
  const { login, user: currentUser } = useAuth();
  const [demoAccounts, setDemoAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [switchLoading, setSwitchLoading] = useState<string | null>(null);

  const loadDemoAccounts = async () => {
    setLoading(true);
    try {
      const res = await fetchDemoAccounts();
      if (res.status === "SUCCESS" && res.demoAccounts) {
        setDemoAccounts(res.demoAccounts);
      }
    } catch (err) {
      console.warn("Failed to load demo accounts", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDemoAccounts();
  }, []);

  const handleCopy = (text: string, fieldId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldId);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleQuickSwitchUser = async (email: string) => {
    setSwitchLoading(email);
    try {
      const res = await loginUser(email, "demo1234");
      if (res.status === "SUCCESS" && res.token) {
        login(res.token, res.user, res.account);
        onNavigateToTab("OVERVIEW");
      }
    } catch (err) {
      console.error("Failed to switch user", err);
    } finally {
      setSwitchLoading(null);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Examiner Sandbox Notice Banner */}
      <div className="alert alert-warning shadow-none flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-5 rounded-2xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2 font-bold text-sm">
            <ShieldCheck className="w-5 h-5 shrink-0 text-warning" />
            <span>EXAMINER & TESTING SANDBOX — DEMO ACCOUNTS DIRECTORY</span>
          </div>
          <p className="text-xs leading-relaxed opacity-90">
            Use the credentials below to test multi-user transfers, out-of-band email OTP verification, database state persistence, and Inngest durable agent execution. Universal password: <code className="font-mono font-bold text-primary">demo1234</code>.
          </p>
        </div>
        <span className="badge badge-warning badge-outline font-mono text-[10px] font-bold shrink-0 uppercase">
          EVALUATION READY
        </span>
      </div>

      {/* Demo Accounts Header */}
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-base flex items-center gap-2">
          <Key className="w-4 h-4 text-primary" /> Active Demo Accounts ({demoAccounts.length})
        </h3>
        <button
          onClick={loadDemoAccounts}
          disabled={loading}
          className="btn btn-sm btn-ghost border border-base-300 rounded-xl gap-1.5 text-xs"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-primary" : ""}`} /> Refresh Balances
        </button>
      </div>

      {/* Accounts List Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {demoAccounts.map((acc) => {
          const isCurrent = currentUser?.email === acc.email;
          return (
            <div
              key={acc.email}
              className={`card bg-base-100 border p-5 shadow-sm space-y-4 transition-shadow hover:shadow-md ${
                isCurrent
                  ? "border-primary/50 ring-2 ring-primary/20"
                  : "border-base-300"
              }`}
            >
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="font-bold text-base">{acc.name}</h4>
                  <span className="text-xs text-base-content/70 font-mono">{acc.email}</span>
                </div>
                {isCurrent ? (
                  <span className="badge badge-primary badge-sm font-bold">
                    LOGGED IN
                  </span>
                ) : (
                  <span className="badge badge-ghost border border-base-300 text-[10px] font-semibold">
                    READY
                  </span>
                )}
              </div>

              {/* Account Details Box */}
              <div className="p-3.5 rounded-xl bg-base-200 border border-base-300 space-y-2 font-mono text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-base-content/60 text-[11px]">Account No:</span>
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-base-content">{acc.accountNo}</span>
                    <button
                      onClick={() => handleCopy(acc.accountNo, `acc_${acc.email}`)}
                      className="p-1 hover:text-primary text-base-content/50 transition-colors"
                      title="Copy Account Number"
                    >
                      {copiedField === `acc_${acc.email}` ? <Check className="w-3.5 h-3.5 text-success" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-base-content/60 text-[11px]">Password:</span>
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-primary">{acc.password}</span>
                    <button
                      onClick={() => handleCopy(acc.password, `pw_${acc.email}`)}
                      className="p-1 hover:text-primary text-base-content/50 transition-colors"
                      title="Copy Password"
                    >
                      {copiedField === `pw_${acc.email}` ? <Check className="w-3.5 h-3.5 text-success" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div className="flex justify-between items-center border-t border-base-300 pt-2">
                  <span className="text-base-content/60 text-[11px]">Current Balance:</span>
                  <span className="font-extrabold text-primary text-sm">₹{acc.balance.toLocaleString("en-IN")}</span>
                </div>
              </div>

              {!isCurrent ? (
                <button
                  onClick={() => handleQuickSwitchUser(acc.email)}
                  disabled={switchLoading === acc.email}
                  className="btn btn-sm btn-primary rounded-xl w-full gap-2 text-xs"
                >
                  {switchLoading === acc.email ? (
                    <span className="loading loading-spinner loading-xs"></span>
                  ) : (
                    <>
                      <UserCheck className="w-3.5 h-3.5" /> 1-Click Login as {acc.name.split(" ")[0]}
                    </>
                  )}
                </button>
              ) : (
                <div className="text-center text-xs text-primary font-bold py-1.5">
                  Active Testing Session
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Step-by-Step Test Guide */}
      <div className="card bg-base-100 border border-base-300 shadow-sm p-6 space-y-4">
        <h3 className="font-bold text-base flex items-center gap-2">
          <Info className="w-5 h-5 text-primary" /> End-to-End Examiner Verification Guide
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          
          <div className="p-4 rounded-xl bg-base-200 border border-base-300 space-y-2">
            <span className="text-primary font-bold block text-sm">1. Inter-Account Transfer & Real Email OTP</span>
            <ol className="list-decimal list-inside space-y-1.5 text-base-content/80">
              <li>Click <strong>1-Click Login as Arjun</strong> above.</li>
              <li>Go to <strong>Send Money</strong> tab and select <strong>Priya (Acc: 10001002)</strong>.</li>
              <li>Enter transfer amount (e.g. ₹5,000) and click <strong>Send OTP</strong>.</li>
              <li>Check inbox (<code className="text-primary font-mono font-bold">arjun@demo.in</code>) for the code.</li>
              <li>Submit code to confirm transfer → observe instant balance updates & email confirmation!</li>
            </ol>
          </div>

          <div className="p-4 rounded-xl bg-base-200 border border-base-300 space-y-2">
            <span className="text-primary font-bold block text-sm">2. Inngest Workflows & AI Agent Traces</span>
            <ol className="list-decimal list-inside space-y-1.5 text-base-content/80">
              <li>Open <strong>AI Autonomous Agent</strong> tab and prompt: <em>"Transfer ₹5,000 to Priya"</em>.</li>
              <li>Observe live step execution traces and OPA policy evaluation.</li>
              <li>Open Inngest Dev Server dashboard at <a href="http://localhost:8288" target="_blank" rel="noreferrer" className="text-primary underline font-mono inline-flex items-center gap-0.5">localhost:8288 <ExternalLink className="w-3 h-3" /></a></li>
              <li>View step-by-step durable function runs for <code className="text-primary font-mono">payment/transfer.completed</code>.</li>
            </ol>
          </div>

        </div>
      </div>

    </div>
  );
};
