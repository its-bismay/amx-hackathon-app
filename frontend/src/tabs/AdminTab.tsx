import React, { useEffect, useState } from "react";
import { Shield, Radio, AlertOctagon, Sliders, FileText, Cpu, RefreshCw } from "lucide-react";
import { getFleetStatus, toggleKillSwitch, getPolicy, updatePolicy, getAuditLogs, getBankOverview } from "../api/sbfClient";
import { getGeminiPoolStatus } from "../api/aiPlatformClient";

export const AdminTab: React.FC = () => {
  const [fleet, setFleet] = useState<any[]>([]);
  const [policy, setPolicy] = useState<any>({
    perTransactionCap: 10000,
    dailyCap: 50000,
    requireOtpAbove: 10000,
    allowedOperations: ["TRANSFER", "CARD_AUTH"]
  });
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [geminiPool, setGeminiPool] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  const loadAdminData = async () => {
    setLoading(true);
    try {
      const [fData, pData, aData, gData] = await Promise.all([
        getFleetStatus(),
        getPolicy(),
        getAuditLogs(),
        getGeminiPoolStatus()
      ]);
      if (fData.agents) setFleet(fData.agents);
      if (pData.policy) setPolicy(pData.policy);
      if (aData.logs) setAuditLogs(aData.logs);
      if (gData.pool) setGeminiPool(gData.pool);
    } catch (err) {
      console.warn("Failed to load admin data", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAdminData();
  }, []);

  const handleKillSwitch = async (level: "FLEET" | "TYPE" | "INSTANCE", target: string | null, status: string) => {
    try {
      const res = await toggleKillSwitch(level, target, status);
      setMsg(res.message || "Kill switch status updated");
      loadAdminData();
    } catch (err) {
      setMsg("Failed to toggle kill switch");
    }
  };

  const handleSavePolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await updatePolicy(policy);
      setMsg(res.message || "Policy updated successfully");
    } catch (err) {
      setMsg("Failed to update policy");
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Top Banner */}
      <div className="p-6 rounded-3xl bg-glass-card border border-amber-500/20 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Shield className="w-5 h-5 text-amber-400" /> SBF Security Governance & Administration
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Real-time OPA Policy engine control, Agent fleet kill switches, and transaction velocity rules
          </p>
        </div>
        <button
          onClick={loadAdminData}
          disabled={loading}
          className="btn-gold px-4 py-2 rounded-xl text-xs flex items-center gap-2"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh Telemetry
        </button>
      </div>

      {msg && (
        <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs font-mono text-amber-300 text-center">
          {msg}
        </div>
      )}

      {/* Global Kill Switches */}
      <div className="grid grid-cols-1 gap-6">
        <div className="p-6 rounded-3xl bg-glass-card border border-amber-500/20 space-y-4">
          <h3 className="font-bold text-white text-sm flex items-center gap-2">
            <AlertOctagon className="w-4 h-4 text-red-400" /> Fleet-Wide Kill Switches
          </h3>

          <div className="space-y-3">
            <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800 flex items-center justify-between">
              <div>
                <span className="font-bold text-white text-xs block">GLOBAL FLEET KILL SWITCH</span>
                <span className="text-[11px] text-slate-400">Instantly freeze all AI agents across the bank</span>
              </div>
              <button
                onClick={() => handleKillSwitch("FLEET", null, "ACTIVE")}
                className="px-3 py-1.5 rounded-xl bg-red-500/20 border border-red-500/40 text-red-300 font-bold text-xs hover:bg-red-500/40 transition-colors"
              >
                FREEZE ALL FLEET
              </button>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800 flex items-center justify-between">
              <div>
                <span className="font-bold text-white text-xs block">CLEAR KILL SWITCHES</span>
                <span className="text-[11px] text-slate-400">Restore normal agent orchestration status</span>
              </div>
              <button
                onClick={() => handleKillSwitch("FLEET", null, "INACTIVE")}
                className="px-3 py-1.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-bold text-xs hover:bg-emerald-500/40 transition-colors"
              >
                UNFREEZE ALL
              </button>
            </div>
          </div>
        </div>

      </div>

      {/* OPA Policy Configurator */}
      <div className="p-6 rounded-3xl bg-glass-card border border-amber-500/20 space-y-4">
        <h3 className="font-bold text-white text-sm flex items-center gap-2">
          <Sliders className="w-4 h-4 text-amber-400" /> Open Policy Agent (OPA) Rule Configuration
        </h3>

        <form onSubmit={handleSavePolicy} className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Per-Transaction Cap (INR)</label>
            <input
              type="number"
              value={policy.perTransactionCap}
              onChange={(e) => setPolicy({ ...policy, perTransactionCap: parseFloat(e.target.value) })}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-white"
            />
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">Require Email OTP Above (INR)</label>
            <input
              type="number"
              value={policy.requireOtpAbove}
              onChange={(e) => setPolicy({ ...policy, requireOtpAbove: parseFloat(e.target.value) })}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-white"
            />
          </div>

          <div className="flex items-end">
            <button type="submit" className="w-full btn-gold py-2 rounded-xl text-xs">
              Save Policy Rules
            </button>
          </div>
        </form>
      </div>

    </div>
  );
};
