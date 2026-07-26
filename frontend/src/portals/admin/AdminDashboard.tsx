import React, { useState, useEffect, useRef } from "react";
// Skull icon added for rogue agent UX
import { ShieldAlert, ShieldCheck, Activity, FileCode2, History, RotateCcw, AlertTriangle, RefreshCw, Database, Power, CheckCircle, Skull, Zap } from "lucide-react";
import { getFleetStatus, toggleKillSwitch, getPolicy, updatePolicy, getAuditLogs, triggerReversal, getRedisState } from "../../api/sbfClient";
import { useAuth } from "../../context/AuthContext";

export const AdminDashboard: React.FC = () => {
  const { token } = useAuth();
  const [activeTab, setActiveTab] = useState<"fleet" | "policy" | "audit" | "redis">("fleet");

  // Fleet state
  const [fleetStatus, setFleetStatus] = useState<any>(null);
  const [globalAiStatus, setGlobalAiStatus] = useState<string>("ENABLED");

  // Policy state
  const [policyData, setPolicyData] = useState<any>(null);
  const [perTxCap, setPerTxCap] = useState<number>(25000);
  const [dailyCap, setDailyCap] = useState<number>(100000);
  const [requireOtpAbove, setRequireOtpAbove] = useState<number>(10000);
  const [policySaveMsg, setPolicySaveMsg] = useState("");
  const [isEditingPolicy, setIsEditingPolicy] = useState<boolean>(false);
  const isEditingPolicyRef = useRef<boolean>(false);

  // Audit state
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [reversalMsg, setReversalMsg] = useState("");

  // Redis Monitor state
  const [redisKeys, setRedisKeys] = useState<Record<string, any>>({});

  const markPolicyDirty = () => {
    isEditingPolicyRef.current = true;
    setIsEditingPolicy(true);
  };

  const loadAdminData = async () => {
    try {
      const fleet = await getFleetStatus(token || undefined);
      if (fleet && fleet.systemAiStatus) {
        setFleetStatus(fleet);
        setGlobalAiStatus(fleet.systemAiStatus);
      }

      const pol = await getPolicy(token || undefined);
      if (pol && pol.policy) {
        setPolicyData(pol.policy);
        if (!isEditingPolicyRef.current) {
          setPerTxCap(pol.policy.limits.perTransactionCap);
          setDailyCap(pol.policy.limits.dailyCap);
          setRequireOtpAbove(pol.policy.conditions.requireOtpAbove);
        }
      }

      const audit = await getAuditLogs(token || undefined);
      if (audit && audit.auditLogs) setAuditLogs(audit.auditLogs);

      const redisRes = await getRedisState(token || undefined);
      if (redisRes && redisRes.keys) setRedisKeys(redisRes.keys);
    } catch (err) {
      console.warn("Error fetching admin status", err);
    }
  };

  useEffect(() => {
    loadAdminData();
    const interval = setInterval(loadAdminData, 3000);
    return () => clearInterval(interval);
  }, [token]);

  const handleGlobalKillToggle = async () => {
    const targetStatus = globalAiStatus === "ENABLED" ? "DISABLED" : "ENABLED";
    await toggleKillSwitch("FLEET", null, targetStatus, token || undefined);
    setGlobalAiStatus(targetStatus);
    loadAdminData();
  };

  const handleResetAllSwitches = async () => {
    await toggleKillSwitch("FLEET", null, "ENABLED", token || undefined);
    await toggleKillSwitch("TYPE", "payment-agent", "ENABLED", token || undefined);
    await toggleKillSwitch("TYPE", "resource-agent", "ENABLED", token || undefined);
    await toggleKillSwitch("TYPE", "notification-agent", "ENABLED", token || undefined);
    loadAdminData();
  };

  const handleKeyToggle = async (keyName: string, currentVal: string) => {
    const nextVal = currentVal === "DISABLED" || currentVal === "REVOKED" ? "ENABLED" : "DISABLED";
    if (keyName === "system:ai") {
      await toggleKillSwitch("FLEET", null, nextVal, token || undefined);
    } else if (keyName.startsWith("agent:instance:")) {
      const instId = keyName.replace("agent:instance:", "");
      await toggleKillSwitch("INSTANCE", instId, nextVal, token || undefined);
    } else if (keyName.startsWith("agent:")) {
      const agentType = keyName.replace("agent:", "");
      await toggleKillSwitch("TYPE", agentType, nextVal, token || undefined);
    }
    loadAdminData();
  };

  const handleInstanceKill = async (instanceId: string) => {
    await toggleKillSwitch("INSTANCE", instanceId, "REVOKED", token || undefined);
    loadAdminData();
  };

  const handlePolicySave = async (e: React.FormEvent) => {
    e.preventDefault();
    setPolicySaveMsg("Deploying updated policy version to live OPA engine...");
    try {
      const res = await updatePolicy({
        perTransactionCap: perTxCap,
        dailyCap: dailyCap,
        requireOtpAbove: requireOtpAbove,
        allowedOperations: ["TRANSFER_MONEY", "SCHEDULE_TRANSFER", "REVERSE_TRANSACTION", "ADD_CARD", "BLOCK_CARD", "QUERY_BENEFICIARY"]
      }, token || undefined);
      if (res.status === "SUCCESS") {
        isEditingPolicyRef.current = false;
        setIsEditingPolicy(false);
        setPolicySaveMsg(`✅ Saved Version ${res.newVersion}! Live OPA sidecar policy updated successfully.`);
        if (res.policy) setPolicyData(res.policy);
        setTimeout(() => setPolicySaveMsg(""), 5000);
      }
    } catch (err) {
      setPolicySaveMsg("❌ Failed to update policy.");
    }
  };

  const handleReversalClick = async (txId: string) => {
    setReversalMsg(`Triggering compensating reversal for Tx ${txId}...`);
    try {
      const res = await triggerReversal(txId, "Admin Security Override Reversal", token || undefined);
      if (res.status === "REVERSED") {
        setReversalMsg(`✅ Transaction ${txId} Reversed successfully! Counter-entry: ${res.reversalTransactionId}`);
        loadAdminData();
        setTimeout(() => setReversalMsg(""), 4000);
      } else {
        setReversalMsg(`❌ ${res.reason}`);
      }
    } catch (err) {
      setReversalMsg("❌ Error calling reversal endpoint");
    }
  };

  const isKillSwitchActive = globalAiStatus === "DISABLED";
  const hasDisabledAgentTypes = Object.entries(redisKeys).some(([k, v]) => k.startsWith("agent:") && v.value === "DISABLED");
  const hasRogueAgents = fleetStatus?.activeInstances?.some((i: any) => i.isRogue && !['REVOKED','DISABLED','KILLED','KILLED_FLEET'].includes(i.status));

  return (
    <div className="space-y-6">
      
      {/* EMERGENCY KILL SWITCH CARD */}
      <div className={`card shadow-md border p-6 transition-all ${
        isKillSwitchActive || hasDisabledAgentTypes
          ? "bg-error/10 border-error text-error-content" 
          : "bg-success/10 border-success text-success-content"
      }`}>
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className={`p-3 rounded-2xl ${isKillSwitchActive || hasDisabledAgentTypes ? "bg-error text-error-content" : "bg-success text-success-content"}`}>
              {isKillSwitchActive || hasDisabledAgentTypes ? <ShieldAlert className="w-8 h-8" /> : <ShieldCheck className="w-8 h-8" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider opacity-75">EMERGENCY KILL SWITCH</span>
                <span className={`badge badge-sm font-bold ${
                  isKillSwitchActive || hasDisabledAgentTypes ? "badge-error animate-pulse" : "badge-success"
                }`}>
                  {isKillSwitchActive 
                    ? "GLOBAL HALT" 
                    : hasDisabledAgentTypes 
                      ? "PARTIAL HALT" 
                      : "ALL AI ACTIVE"}
                </span>
              </div>
              <h2 className="text-xl font-bold mt-1">
                {isKillSwitchActive 
                  ? "ALL AI AGENTS ARE BLOCKED" 
                  : hasDisabledAgentTypes 
                    ? "SPECIFIC AGENT TYPES ARE BLOCKED" 
                    : "AI AGENT FLEET IS OPERATIONAL"}
              </h2>
              <p className="text-xs opacity-80 mt-1">
                {isKillSwitchActive || hasDisabledAgentTypes
                  ? "Incoming agent requests are being rejected by Redis governance switches."
                  : "All autonomous financial agents are active and submitting governed requests to SBF."}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {(isKillSwitchActive || hasDisabledAgentTypes) && (
              <button
                onClick={handleResetAllSwitches}
                className="btn btn-sm btn-success gap-2"
              >
                <CheckCircle className="w-4 h-4" /> Re-Enable All Agents
              </button>
            )}

            <button
              onClick={handleGlobalKillToggle}
              className={`btn btn-sm ${isKillSwitchActive ? "btn-success" : "btn-error"} gap-2`}
            >
              <Power className="w-4 h-4" />
              {isKillSwitchActive ? "Turn Global Kill Switch Off" : "Activate Global Kill Switch"}
            </button>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="tabs tabs-boxed bg-base-100 p-1.5 rounded-xl border border-base-300 flex-wrap">
        <button 
          onClick={() => setActiveTab("fleet")} 
          className={`tab tab-sm font-bold gap-2 rounded-lg ${activeTab === 'fleet' ? 'tab-active btn-primary text-primary-content' : ''}`}
        >
          <Activity className="w-4 h-4" /> Agent Fleet
        </button>
        <button 
          onClick={() => setActiveTab("policy")} 
          className={`tab tab-sm font-bold gap-2 rounded-lg ${activeTab === 'policy' ? 'tab-active btn-primary text-primary-content' : ''}`}
        >
          <FileCode2 className="w-4 h-4" /> OPA Rules & Limits
        </button>
        <button 
          onClick={() => setActiveTab("audit")} 
          className={`tab tab-sm font-bold gap-2 rounded-lg ${activeTab === 'audit' ? 'tab-active btn-primary text-primary-content' : ''}`}
        >
          <History className="w-4 h-4" /> Live Audit Trail ({auditLogs.length})
        </button>
        <button 
          onClick={() => setActiveTab("redis")} 
          className={`tab tab-sm font-bold gap-2 rounded-lg ${activeTab === 'redis' ? 'tab-active btn-primary text-primary-content' : ''}`}
        >
          <Database className="w-4 h-4" /> Redis Keys ({Object.keys(redisKeys).length})
        </button>
      </div>

      {/* Fleet Manager Tab */}
      {activeTab === "fleet" && (
        <div className="card bg-base-100 border border-base-300 shadow-sm p-6 space-y-4">

          {/* ── ROGUE AGENT LIVE ALERT BANNER ─────────────────────── */}
          {hasRogueAgents && (
            <div className="alert bg-error/10 border-2 border-error text-error-content rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <Skull className="w-7 h-7 text-error shrink-0 mt-0.5 animate-pulse" />
                <div>
                  <div className="font-extrabold text-base text-error flex items-center gap-2">
                    ROGUE AGENT DETECTED — UNAUTHORIZED TRANSFERS IN PROGRESS
                    <span className="badge badge-error badge-sm animate-bounce">LIVE</span>
                  </div>
                  <p className="text-xs text-base-content/80 mt-1">
                    A misbehaving agent is currently hammering the Secure Banking Fabric with high-value unauthorized transfer attempts.
                    Use the <strong>Kill Instance</strong> button on the rogue row below (or the Global Kill Switch) to stop it instantly.
                  </p>
                </div>
              </div>
              <button
                onClick={handleGlobalKillToggle}
                className="btn btn-error btn-sm gap-2 shrink-0 self-start sm:self-auto"
              >
                <Zap className="w-4 h-4" /> Emergency Stop All
              </button>
            </div>
          )}

          <div className="flex justify-between items-center flex-wrap gap-2">
            <div>
              <h3 className="font-bold text-base">Active Agent Fleet Instances</h3>
              <p className="text-xs text-base-content/70">Instances spawned during agent executions and monitored via Redis & Audit Logs</p>
            </div>
            <span className="badge badge-outline font-mono text-xs">
              Instance & Type Controls
            </span>
          </div>

          <div className="overflow-x-auto rounded-xl border border-base-300">
            <table className="table table-sm w-full text-xs">
              <thead>
                <tr>
                  <th>Instance ID</th>
                  <th>Agent Type</th>
                  <th>Spawned At</th>
                  <th>Status</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {(!fleetStatus?.activeInstances || fleetStatus.activeInstances.length === 0) ? (
                  <tr>
                    <td colSpan={5} className="text-center py-6 text-base-content/50 italic">
                      No active instances currently running. Spawn a Rogue Agent from the User Dashboard to test governance.
                    </td>
                  </tr>
                ) : (
                  fleetStatus.activeInstances.map((inst: any) => {
                    const isRogueActive = inst.isRogue && !['REVOKED','DISABLED','KILLED','KILLED_FLEET'].includes(inst.status);
                    return (
                    <tr key={inst.instanceId} className={isRogueActive ? "bg-error/10 border-l-4 border-error" : ""}>
                      <td className={`font-mono font-bold ${isRogueActive ? "text-error" : "text-primary"}`}>
                        {isRogueActive && <Skull className="w-3.5 h-3.5 inline mr-1.5 animate-pulse" />}
                        {inst.instanceId}
                      </td>
                      <td>
                        <span className={`badge badge-sm font-mono font-bold ${
                          inst.isRogue ? "badge-error" : "badge-info"
                        }`}>
                          {inst.agentType}
                        </span>
                      </td>
                      <td className="font-mono text-base-content/70">{inst.spawnedAt}</td>
                      <td>
                        <span className={`badge badge-sm font-bold ${
                          ['REVOKED','KILLED','KILLED_FLEET'].includes(inst.status) ? 'badge-error' :
                          inst.status === 'ROGUE_ACTIVE' ? 'badge-error animate-pulse' :
                          'badge-success'
                        }`}>
                          {inst.status}
                        </span>
                      </td>
                      <td className="text-right">
                        <button
                          onClick={() => handleInstanceKill(inst.instanceId)}
                          disabled={['REVOKED','KILLED','KILLED_FLEET'].includes(inst.status)}
                          className={`btn btn-xs rounded-lg font-bold gap-1 ${
                            isRogueActive
                              ? 'btn-error'
                              : 'btn-outline btn-error'
                          }`}
                        >
                          {isRogueActive ? <><Skull className="w-3 h-3" /> Kill Rogue Now</> : "Kill Instance"}
                        </button>
                      </td>
                    </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Policy Manager Tab */}
      {activeTab === "policy" && (
        <div className="card bg-base-100 border border-base-300 shadow-sm p-6 space-y-6">
          <div className="flex justify-between items-start flex-wrap gap-2">
            <div>
              <h3 className="font-bold text-base mb-1">Live Agent Policy Manager</h3>
              <p className="text-xs text-base-content/70">
                Hot-reloaded in PostgreSQL governance database & OPA sidecar. Version: <strong className="text-primary font-mono">{policyData?.version || 1}</strong>
              </p>
            </div>
            {isEditingPolicy && (
              <span className="badge badge-warning gap-1 animate-pulse">
                <AlertTriangle className="w-3.5 h-3.5" />
                Unsaved Policy Changes
              </span>
            )}
          </div>

          <form onSubmit={handlePolicySave} className="max-w-xl space-y-5">
            <div>
              <div className="flex justify-between text-xs font-semibold mb-2">
                <span>Per-Transaction Cap:</span>
                <span className="text-primary font-mono font-bold">₹{perTxCap.toLocaleString()}</span>
              </div>
              <input
                type="range"
                min="5000"
                max="100000"
                step="5000"
                value={perTxCap}
                onChange={(e) => {
                  setPerTxCap(Number(e.target.value));
                  markPolicyDirty();
                }}
                className="range range-primary range-xs"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs font-semibold mb-2">
                <span>Daily Customer Spend Cap:</span>
                <span className="text-success font-mono font-bold">₹{dailyCap.toLocaleString()}</span>
              </div>
              <input
                type="range"
                min="25000"
                max="500000"
                step="25000"
                value={dailyCap}
                onChange={(e) => {
                  setDailyCap(Number(e.target.value));
                  markPolicyDirty();
                }}
                className="range range-success range-xs"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs font-semibold mb-2">
                <span>Require Out-of-Band OTP Above:</span>
                <span className="text-info font-mono font-bold">₹{requireOtpAbove.toLocaleString()}</span>
              </div>
              <input
                type="range"
                min="2000"
                max="50000"
                step="2000"
                value={requireOtpAbove}
                onChange={(e) => {
                  setRequireOtpAbove(Number(e.target.value));
                  markPolicyDirty();
                }}
                className="range range-info range-xs"
              />
            </div>

            {policySaveMsg && (
              <div className="alert alert-info text-xs p-3 rounded-xl font-semibold flex items-center gap-2">
                <CheckCircle className="w-4 h-4 shrink-0 text-info" />
                <span>{policySaveMsg}</span>
              </div>
            )}

            <div className="flex items-center gap-3 pt-2">
              <button
                type="submit"
                className="btn btn-sm btn-primary rounded-xl"
              >
                Save & Deploy Policy Version
              </button>
              {isEditingPolicy && (
                <button
                  type="button"
                  onClick={() => {
                    isEditingPolicyRef.current = false;
                    setIsEditingPolicy(false);
                    loadAdminData();
                  }}
                  className="btn btn-sm btn-ghost rounded-xl"
                >
                  Discard Changes
                </button>
              )}
            </div>
          </form>
        </div>
      )}

      {/* Audit Explorer Tab */}
      {activeTab === "audit" && (
        <div className="card bg-base-100 border border-base-300 shadow-sm p-6 space-y-4">
          <div className="flex justify-between items-center flex-wrap gap-2">
            <div>
              <h3 className="font-bold text-base">Live Governance Audit Explorer</h3>
              <p className="text-xs text-base-content/70">Append-only audit trail logging policy decisions, version metadata, and latency</p>
            </div>
            <span className="badge badge-outline font-mono text-xs">
              Append-Only Storage
            </span>
          </div>

          {reversalMsg && <div className="alert alert-info text-xs p-3 rounded-xl">{reversalMsg}</div>}

          <div className="overflow-x-auto rounded-xl border border-base-300">
            <table className="table table-zebra table-sm w-full text-xs">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Request ID</th>
                  <th>Instance</th>
                  <th>Operation</th>
                  <th>Decision</th>
                  <th>Reason</th>
                  <th>Latency</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-6 text-base-content/50 italic">
                      No audit entries captured yet. Run an agent query or transfer to populate audit events.
                    </td>
                  </tr>
                ) : (
                  auditLogs.map((log: any) => (
                    <tr key={log.id}>
                      <td className="font-mono text-base-content/70">{log.timestamp}</td>
                      <td className="font-mono text-primary font-bold">{log.requestId}</td>
                      <td className="font-mono">{log.agentInstance}</td>
                      <td>
                        <span className="badge badge-sm badge-ghost font-mono">
                          {log.operation}
                        </span>
                      </td>
                      <td>
                        <span className={`badge badge-sm font-bold ${
                          log.decision === 'ALLOW' ? 'badge-success' : 'badge-error'
                        }`}>
                          {log.decision}
                        </span>
                      </td>
                      <td className="max-w-[180px] truncate">{log.reasonCode}</td>
                      <td className="font-mono text-base-content/70">{log.latencyMs}ms</td>
                      <td className="text-right">
                        <button 
                          onClick={() => handleReversalClick(log.requestId)} 
                          className="btn btn-xs btn-outline btn-warning gap-1 rounded-lg"
                        >
                          <RotateCcw className="w-3 h-3" /> Reverse
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Redis State Monitor Tab */}
      {activeTab === "redis" && (
        <div className="card bg-base-100 border border-base-300 shadow-sm p-6 space-y-4">
          <div className="flex justify-between items-center flex-wrap gap-2">
            <div>
              <h3 className="font-bold text-base flex items-center gap-2">
                <Database className="w-5 h-5 text-primary" /> Runtime Governance State (Redis)
              </h3>
              <p className="text-xs text-base-content/70">
                Live inspection of global kill switches, agent revocations, daily spend accumulators, and velocity counters.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={handleResetAllSwitches} 
                className="btn btn-xs btn-success text-white rounded-lg gap-1.5"
              >
                <CheckCircle className="w-3.5 h-3.5" /> Re-Enable All Keys
              </button>
              <button 
                onClick={loadAdminData} 
                className="btn btn-xs btn-ghost border border-base-300 rounded-lg gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Refresh State
              </button>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-base-300">
            <table className="table table-zebra table-sm w-full text-xs font-mono">
              <thead>
                <tr>
                  <th>Key Name</th>
                  <th>Value</th>
                  <th>TTL (seconds)</th>
                  <th>Governance Purpose</th>
                  <th className="text-right font-sans">Toggle Switch</th>
                </tr>
              </thead>
              <tbody>
                {Object.keys(redisKeys).length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-6 text-base-content/50 italic font-sans">
                      No runtime governance keys currently active in Redis.
                    </td>
                  </tr>
                ) : (
                  Object.entries(redisKeys).map(([key, data]: [string, any]) => {
                    let category = "Runtime Cache";
                    if (key.startsWith("system:")) category = "Global Fleet Control";
                    else if (key.startsWith("agent:instance:")) category = "Instance Revocation";
                    else if (key.startsWith("agent:")) category = "Agent-Type Switch";
                    else if (key.startsWith("spend:")) category = "Daily Spend Accumulator";
                    else if (key.startsWith("velocity:")) category = "Velocity Rate Limiter";

                    const isKeyDisabled = data.value === "DISABLED" || data.value === "REVOKED";

                    return (
                      <tr key={key}>
                        <td className="font-bold text-primary">{key}</td>
                        <td>
                          <span className={`badge badge-sm font-bold ${
                            isKeyDisabled
                              ? 'badge-error'
                              : data.value === 'ENABLED'
                                ? 'badge-success'
                                : 'badge-ghost'
                          }`}>
                            {String(data.value)}
                          </span>
                        </td>
                        <td className="text-base-content/70">{data.ttl === -1 ? 'Persistent' : `${data.ttl}s`}</td>
                        <td className="font-sans text-base-content/70">{category}</td>
                        <td className="text-right font-sans">
                          {(key.startsWith("agent:") || key === "system:ai") && (
                            <button
                              onClick={() => handleKeyToggle(key, data.value)}
                              className={`btn btn-xs rounded-lg ${
                                isKeyDisabled
                                  ? "btn-success btn-outline"
                                  : "btn-error btn-outline"
                              }`}
                            >
                              {isKeyDisabled ? "Enable Key" : "Disable Key"}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
