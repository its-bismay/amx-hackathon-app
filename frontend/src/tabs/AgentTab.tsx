import React, { useState, useEffect } from "react";
import { Bot, Send, ShieldCheck, KeyRound, Sparkles, Activity, CheckCircle2, Lock, ExternalLink } from "lucide-react";
import { sendChatMessage } from "../api/aiPlatformClient";
import { verifyOtpDirect } from "../api/sbfClient";
import { useAuth } from "../context/AuthContext";

interface TraceStep {
  step: string;
  agent: string;
  detail: string;
}

interface MessageItem {
  id: string;
  userMessage: string;
  assistantResponse: string;
  status: string;
  challengeId?: string;
  demoCode?: string;
  traces?: TraceStep[];
}

export const AgentTab: React.FC = () => {
  const { refreshMe, user } = useAuth();
  const [messages, setMessages] = useState<MessageItem[]>([
    {
      id: "init_agent",
      userMessage: "Transfer ₹5,000 to Priya",
      assistantResponse: "I have initialized the PaymentAgent. Transfer request submitted to Secure Banking Fabric for OPA governance validation.",
      status: "APPROVED",
      traces: [
        { step: "Intent Parsing", agent: "OrchestratorAgent", detail: "Parsed target: Priya, amount: 5000" },
        { step: "OPA Policy Eval", agent: "GovernanceGateway", detail: "DECISION: ALLOW (Within ₹25,000 cap)" },
        { step: "Database Update", agent: "PostgresFabric", detail: "Debited Sender ₹5,000 | Credited Priya ₹5,000" }
      ]
    }
  ]);
  const [inputMsg, setInputMsg] = useState("");
  const [loading, setLoading] = useState(false);

  // Active OTP Challenge State
  const [activeOtp, setActiveOtp] = useState<{ challengeId: string; demoCode?: string } | null>(null);
  const [otpInput, setOtpInput] = useState("");
  const [otpStatus, setOtpStatus] = useState("");
  const [otpLoading, setOtpLoading] = useState(false);

  const handleSend = async (promptText?: string) => {
    const textToSend = promptText || inputMsg;
    if (!textToSend.trim() || loading) return;

    if (!promptText) setInputMsg("");
    setLoading(true);

    try {
      const res = await sendChatMessage(textToSend);
      const newMsg: MessageItem = {
        id: res.id || `msg_${Date.now()}`,
        userMessage: textToSend,
        assistantResponse: res.assistantResponse || res.message,
        status: res.status || "APPROVED",
        challengeId: res.challengeId,
        demoCode: res.demoCode,
        traces: res.traces || []
      };

      setMessages((prev) => [...prev, newMsg]);

      if (res.status === "OTP_REQUIRED" && res.challengeId) {
        setActiveOtp({ challengeId: res.challengeId, demoCode: res.demoCode || "123456" });
      }

      await refreshMe();
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: `err_${Date.now()}`,
          userMessage: textToSend,
          assistantResponse: "Failed to communicate with AI Agent Platform.",
          status: "DENIED",
          traces: [{ step: "Network Fault", agent: "Gateway", detail: "Could not reach HTTP API endpoint" }]
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!activeOtp || !otpInput) return;
    setOtpLoading(true);
    setOtpStatus("");

    try {
      const res = await verifyOtpDirect(activeOtp.challengeId, otpInput);
      if (res.status === "SUCCESS") {
        setOtpStatus("✅ OTP Verified! Transaction Executed.");
        await refreshMe();
        setTimeout(() => {
          setActiveOtp(null);
          setOtpInput("");
          setOtpStatus("");
        }, 1500);
      } else {
        setOtpStatus(`❌ ${res.detail || "Invalid OTP code"}`);
      }
    } catch (err) {
      setOtpStatus("❌ Verification failed");
    } finally {
      setOtpLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      
      {/* Left Chat Window (2 Cols) */}
      <div className="lg:col-span-2 card bg-base-100 border border-base-300 shadow-md flex flex-col h-[550px] lg:h-[650px] overflow-hidden">
        
        {/* Chat Top Header */}
        <div className="p-3.5 border-b border-base-300 bg-base-200/50 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-primary/10 text-primary rounded-xl">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-xs leading-tight">AEGIS Autonomous Banking Agent</h3>
              <span className="text-[10px] text-base-content/60 font-mono">Inngest Durable Tracing & OPA Sidecar Governed</span>
            </div>
          </div>
          <span className="badge badge-success badge-sm font-mono font-bold">
            ONLINE
          </span>
        </div>

        {/* Message Log */}
        <div className="flex-1 p-4 overflow-y-auto space-y-4">
          {messages.map((m) => (
            <div key={m.id} className="space-y-2">
              <div className="chat chat-end">
                <div className="chat-bubble chat-bubble-primary text-xs font-medium">{m.userMessage}</div>
              </div>

              <div className="chat chat-start">
                <div
                  className={`chat-bubble text-xs ${
                    m.status === "DENIED"
                      ? "chat-bubble-error"
                      : m.status === "OTP_REQUIRED"
                      ? "chat-bubble-warning"
                      : "bg-base-200 text-base-content"
                  }`}
                >
                  {m.assistantResponse}
                </div>
              </div>

              {/* Execution Traces Box */}
              {m.traces && m.traces.length > 0 && (
                <div className="ml-10 p-3 bg-base-200 rounded-xl border border-base-300 text-xs space-y-1.5 font-mono">
                  <div className="font-bold text-primary flex items-center gap-1.5 text-[11px] font-sans">
                    <Activity className="w-3.5 h-3.5" /> Agent Execution Steps & OPA Evaluation
                  </div>
                  {m.traces.map((t, i) => (
                    <div key={i} className="flex justify-between items-start text-[11px] border-b border-base-300/60 pb-1 last:border-0 last:pb-0">
                      <span className="font-bold text-base-content">{t.step} <span className="text-primary font-normal">({t.agent})</span></span>
                      <span className="text-base-content/70 text-right truncate max-w-[200px] sm:max-w-[280px]">{t.detail}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="chat chat-start">
              <div className="chat-bubble bg-base-200 text-base-content flex items-center gap-2 text-xs">
                <span className="loading loading-spinner loading-xs text-primary"></span>
                <span>Executing multi-agent workflow & OPA policy validation...</span>
              </div>
            </div>
          )}
        </div>

        {/* Preset Prompt Shortcuts & Chat Input */}
        <div className="p-4 border-t border-base-300 space-y-3 bg-base-100">
          <div>
            <span className="text-[10px] font-bold text-base-content/60 uppercase tracking-wider block mb-1 font-mono">
              Quick Test Prompts
            </span>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => handleSend("Transfer ₹5,000 to Priya")}
                className="btn btn-xs btn-outline btn-primary rounded-lg"
              >
                Standard Transfer (₹5,000 to Priya)
              </button>
              <button
                type="button"
                onClick={() => handleSend("Transfer ₹15,000 to Rahul")}
                className="btn btn-xs btn-outline btn-warning rounded-lg"
              >
                Trigger OTP Challenge (₹15,000)
              </button>
              <button
                type="button"
                onClick={() => handleSend("Transfer ₹50,000 to Priya")}
                className="btn btn-xs btn-outline btn-error rounded-lg"
              >
                Exceed Per-Tx Cap (₹50,000)
              </button>
            </div>
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Ask agent: e.g. 'Transfer ₹5,000 to Priya'..."
              value={inputMsg}
              onChange={(e) => setInputMsg(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              className="input input-bordered flex-1 rounded-xl text-xs focus:input-primary"
            />
            <button
              onClick={() => handleSend()}
              disabled={loading}
              className="btn btn-primary rounded-xl text-xs flex items-center gap-1.5"
            >
              <Send className="w-4 h-4" /> Send
            </button>
          </div>
        </div>

      </div>

      {/* Right Sidebar: Active OTP Verification & Governance Controls */}
      <div className="space-y-6">
        
        {/* Out-Of-Band OTP Verification Box */}
        {activeOtp ? (
          <div className="card bg-base-100 border border-warning shadow-md p-5 space-y-4">
            <div className="flex items-center gap-2 text-warning font-bold text-sm">
              <KeyRound className="w-5 h-5" /> Out-of-Band OTP Challenge
            </div>
            <p className="text-xs text-base-content/70 leading-relaxed">
              Agent operation paused. Enter the 6-digit OTP code dispatched to <strong className="text-primary font-mono">{user?.email}</strong>.
            </p>

            {activeOtp.demoCode && (
              <div className="p-2.5 rounded-xl bg-warning/10 border border-warning/30 font-mono text-xs text-center">
                <span>Email OTP Code: <strong className="text-warning text-sm">{activeOtp.demoCode}</strong></span>
              </div>
            )}

            <div className="space-y-2">
              <input
                type="text"
                placeholder="123456"
                maxLength={6}
                value={otpInput}
                onChange={(e) => setOtpInput(e.target.value)}
                className="input input-bordered input-warning w-full text-center text-xl font-bold font-mono tracking-widest rounded-xl"
              />
              {otpStatus && <div className="text-xs font-semibold text-center">{otpStatus}</div>}
              <button
                onClick={handleVerifyOtp}
                disabled={otpLoading || otpInput.length < 6}
                className="btn btn-warning w-full rounded-xl text-xs flex items-center justify-center gap-2"
              >
                {otpLoading ? <span className="loading loading-spinner loading-xs"></span> : <CheckCircle2 className="w-4 h-4" />} Confirm OTP & Execute
              </button>
            </div>
          </div>
        ) : (
          <div className="card bg-base-100 border border-base-300 shadow-sm p-5 space-y-3 text-xs">
            <div className="flex items-center gap-2 text-success font-bold text-sm">
              <ShieldCheck className="w-5 h-5" /> Agent Governance Protection
            </div>
            <p className="text-base-content/70 leading-relaxed">
              AI Agents run under zero-trust bounds. Any request exceeding <strong className="text-primary font-mono">₹10,000</strong> automatically pauses agent execution and requests an Out-of-Band Email OTP.
            </p>
          </div>
        )}

        {/* Live Observability Box */}
        <div className="card bg-base-100 border border-base-300 shadow-sm p-5 space-y-3 text-xs">
          <div className="flex items-center gap-2 font-bold text-sm">
            <Activity className="w-4 h-4 text-info" /> Inngest Workflow Observability
          </div>
          <p className="text-base-content/70 leading-relaxed">
            All agent execution events (<code className="text-info font-mono">payment/transfer.completed</code>) produce durable step functions tracked on your local Inngest Dashboard.
          </p>
          <a
            href="http://localhost:8288"
            target="_blank"
            rel="noreferrer"
            className="btn btn-sm btn-outline btn-info rounded-xl w-full gap-2 text-xs"
          >
            Open Inngest Dev Server (localhost:8288) <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>

      </div>

    </div>
  );
};
