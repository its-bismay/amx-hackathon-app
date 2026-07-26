import React, { useEffect, useState } from "react";
import { Shield, ArrowUpRight, ArrowDownLeft, RefreshCw, Clock, Lock, AlertTriangle, Bot, Skull, CheckCircle2 } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { fetchMyTransactions } from "../api/bankClient";
import { spawnRogueAgent } from "../api/aiPlatformClient";

export const OverviewTab: React.FC<{ onNavigateToSend: () => void }> = ({ onNavigateToSend }) => {
  const { user, account, token, refreshMe } = useAuth();
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Rogue agent state
  const [rogueSpawning, setRogueSpawning] = useState(false);
  const [rogueResult, setRogueResult] = useState<{ id: string; msg: string } | null>(null);

  const loadData = async () => {
    if (!token) return;
    setLoading(true);
    try {
      await refreshMe();
      const res = await fetchMyTransactions(token);
      if (res.status === "SUCCESS" && res.transactions) {
        setTransactions(res.transactions);
      }
    } catch (err) {
      console.warn("Failed to load transactions", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [token]);

  const handleSpawnRogue = async () => {
    setRogueSpawning(true);
    setRogueResult(null);
    try {
      const res = await spawnRogueAgent({
        customerId: user?.customerId ?? "cust_101",
        targetAccountNo: "10001002",
        attemptAmount: 999999,
        label: `ROGUE-BOT spawned by ${user?.name ?? "user"}`,
      });
      if (res.status === "SPAWNED") {
        setRogueResult({
          id: res.rogueInstanceId,
          msg: `Rogue agent ${res.rogueInstanceId} is now running! Switch to Admin Dashboard → Agent Fleet to kill it.`,
        });
      } else {
        setRogueResult({ id: "", msg: "Failed to spawn rogue agent. Is the AI Platform running on port 8000?" });
      }
    } catch (err) {
      setRogueResult({ id: "", msg: "Network error: Could not reach AI Platform on localhost:8000" });
    } finally {
      setRogueSpawning(false);
    }
  };

  return (
    <div className="space-y-6">

      {/* ─── ROGUE AGENT DEMO PANEL ─────────────────────────────────────── */}
      <div className="card bg-error/5 border-2 border-error/30 shadow-sm p-5 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2.5 bg-error/10 text-error rounded-xl shrink-0 mt-0.5">
              <Skull className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-base flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-error" />
                Governance Demo — Spawn Rogue Agent
              </h3>
              <p className="text-xs text-base-content/70 mt-1 leading-relaxed">
                Click below to launch a <strong className="text-error">misbehaving autonomous agent</strong> that
                bypasses normal orchestration and hammers the Secure Banking Fabric with{" "}
                <strong>unauthorized ₹9,99,999 transfer attempts</strong> every 2 seconds.
                Then switch to the <strong className="text-primary">Admin Dashboard → Agent Fleet</strong> to kill it
                with a single click — demonstrating real-time governance kill switches.
              </p>
            </div>
          </div>

          <button
            onClick={handleSpawnRogue}
            disabled={rogueSpawning}
            className="btn btn-error rounded-xl gap-2 text-sm shrink-0 self-start sm:self-auto"
          >
            {rogueSpawning ? (
              <span className="loading loading-spinner loading-sm"></span>
            ) : (
              <Bot className="w-4 h-4" />
            )}
            {rogueSpawning ? "Spawning..." : "Spawn Rogue Agent"}
          </button>
        </div>

        {rogueResult && (
          <div className={`alert text-xs p-3 rounded-xl font-mono font-medium flex items-start gap-2 ${
            rogueResult.id ? "alert-warning" : "alert-error"
          }`}>
            {rogueResult.id ? (
              <AlertTriangle className="w-4 h-4 shrink-0 text-warning mt-0.5" />
            ) : (
              <AlertTriangle className="w-4 h-4 shrink-0 text-error mt-0.5" />
            )}
            <div>
              {rogueResult.id && (
                <span className="text-warning font-bold block mb-0.5">
                  Instance ID: {rogueResult.id}
                </span>
              )}
              <span className="font-sans">{rogueResult.msg}</span>
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-2 text-[11px] text-base-content/60 font-mono">
          <span className="badge badge-ghost gap-1"><CheckCircle2 className="w-3 h-3 text-success" /> Registers in Redis instantly</span>
          <span className="badge badge-ghost gap-1"><CheckCircle2 className="w-3 h-3 text-success" /> Visible in Fleet & Redis Monitor tabs</span>
          <span className="badge badge-ghost gap-1"><CheckCircle2 className="w-3 h-3 text-success" /> Blockable via single Admin kill click</span>
        </div>
      </div>

      {/* ─── ACCOUNT BALANCE BANNER ─────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Main Balance Card */}
        <div className="lg:col-span-2 card bg-base-100 border border-base-300 shadow-md p-6 sm:p-8 flex flex-col justify-between">
          <div className="flex justify-between items-start mb-6">
            <div>
              <span className="badge badge-primary font-mono text-[11px] font-bold">
                AEGIS SAVINGS ACCOUNT
              </span>
              <p className="text-xs text-base-content/70 font-mono mt-2">Account No: {account?.accountNo || "10001001"}</p>
            </div>
            <button
              onClick={loadData}
              disabled={loading}
              className="btn btn-sm btn-ghost border border-base-300 rounded-xl"
              title="Refresh Account Data"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-primary" : ""}`} />
            </button>
          </div>

          <div className="mb-6">
            <span className="text-xs text-base-content/70 block mb-1">Available Liquid Balance</span>
            <div className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-primary font-mono tracking-tight flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-sans">₹</span>
              {(account?.balance || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              <span className="badge badge-success badge-sm font-sans font-semibold">
                ACTIVE
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-base-300">
            <button
              onClick={onNavigateToSend}
              className="btn btn-primary rounded-xl text-xs flex items-center gap-2"
            >
              <ArrowUpRight className="w-4 h-4" /> Send Money to Friend
            </button>
            <div className="text-xs text-base-content/70 flex items-center gap-1.5 ml-auto font-mono">
              <Lock className="w-3.5 h-3.5 text-success" /> Out-of-Band Email OTP Protection Active
            </div>
          </div>
        </div>

        {/* User Card Info */}
        <div className="card bg-base-100 border border-base-300 shadow-md p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Shield className="w-5 h-5 text-primary" />
              <h3 className="font-bold text-sm">Account Holder Details</h3>
            </div>
            <div className="space-y-3 text-xs">
              <div>
                <span className="text-base-content/60 block">Full Name</span>
                <span className="font-semibold text-sm">{user?.name}</span>
              </div>
              <div>
                <span className="text-base-content/60 block">Registered Email</span>
                <span className="font-mono text-primary">{user?.email}</span>
              </div>
              <div>
                <span className="text-base-content/60 block">Customer Reference ID</span>
                <span className="font-mono text-base-content/80">{user?.customerId}</span>
              </div>
            </div>
          </div>
          <div className="mt-4 p-3 rounded-xl bg-base-200 border border-base-300 text-[11px] text-base-content/70">
            💡 All transfers send email notifications to your registered inbox: <strong className="text-base-content font-mono">{user?.email}</strong>
          </div>
        </div>

      </div>

      {/* ─── TRANSACTION HISTORY TABLE ──────────────────────────────────── */}
      <div className="card bg-base-100 border border-base-300 shadow-md p-6 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h3 className="font-bold text-base flex items-center gap-2">
            <Clock className="w-5 h-5 text-primary" /> Transaction Ledger
          </h3>
          <span className="text-xs text-base-content/70 font-mono">Real-time PostgreSQL Database Sync</span>
        </div>

        <div className="overflow-x-auto rounded-xl border border-base-300">
          <table className="table table-zebra table-sm w-full text-xs">
            <thead>
              <tr className="text-base-content/70">
                <th>Type</th>
                <th>Counterparty</th>
                <th>Request ID</th>
                <th>Date & Time</th>
                <th className="text-right">Amount</th>
                <th className="text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              {transactions.length > 0 ? (
                transactions.map((tx) => (
                  <tr key={tx.id}>
                    <td>
                      <span
                        className={`badge badge-sm font-bold gap-1 ${
                          tx.type === "CREDIT"
                            ? "badge-success"
                            : "badge-error badge-outline"
                        }`}
                      >
                        {tx.type === "CREDIT" ? <ArrowDownLeft className="w-3 h-3" /> : <ArrowUpRight className="w-3 h-3" />}
                        {tx.type}
                      </span>
                    </td>
                    <td className="font-medium">{tx.counterparty || "Beneficiary"}</td>
                    <td className="font-mono text-base-content/70 text-[11px]">{tx.requestId}</td>
                    <td className="text-base-content/70 font-mono">{new Date(tx.createdAt).toLocaleString()}</td>
                    <td className="text-right font-mono font-bold text-xs">
                      <span className={tx.type === "CREDIT" ? "text-success" : "text-base-content"}>
                        {tx.type === "CREDIT" ? "+" : "-"}₹{tx.amount.toLocaleString("en-IN")}
                      </span>
                    </td>
                    <td className="text-center">
                      <span className="badge badge-sm badge-success font-semibold">
                        {tx.status}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-base-content/50 italic">
                    No transactions executed yet. Click "Send Money to Friend" to test live transfer with email OTP!
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
