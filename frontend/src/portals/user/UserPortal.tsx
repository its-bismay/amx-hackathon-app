import React, { useState, useEffect } from "react";
import { Send, Shield, Lock, CreditCard, AlertTriangle, UserCheck } from "lucide-react";
import { sendChatMessage } from "../../api/aiPlatformClient";
import { verifyOtpDirect, addCardDirect, getCardsDirect, getBankOverview } from "../../api/sbfClient";

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

export const UserPortal: React.FC = () => {
  const [messages, setMessages] = useState<MessageItem[]>([
    {
      id: "msg_init",
      userMessage: "Hello AI Assistant",
      assistantResponse: "Welcome to Governance Banking AI. How can I assist with your accounts today?",
      status: "APPROVED",
      traces: [
        { step: "Session Established", agent: "OrchestratorAgent", detail: "Authenticated customer cust_101" }
      ]
    }
  ]);
  const [inputMsg, setInputMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [cards, setCards] = useState<any[]>([]);

  // OTP Modal state
  const [activeOtpChallenge, setActiveOtpChallenge] = useState<{ challengeId: string; demoCode?: string } | null>(null);
  const [otpCodeInput, setOtpCodeInput] = useState("");
  const [otpStatusMsg, setOtpStatusMsg] = useState("");

  // Card Modal state
  const [showCardModal, setShowCardModal] = useState(false);
  const [cardPan, setCardPan] = useState("");
  const [cardExpMonth, setCardExpMonth] = useState("12");
  const [cardExpYear, setCardExpYear] = useState("2028");
  const [cardCvv, setCardCvv] = useState("");
  const [cardResMsg, setCardResMsg] = useState("");

  const loadData = async () => {
    try {
      const overview = await getBankOverview();
      if (overview.accounts) setAccounts(overview.accounts);
      const cardsData = await getCardsDirect();
      if (cardsData.cards) setCards(cardsData.cards);
    } catch (e) {
      console.warn("SBF backend loading error", e);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMsg.trim() || loading) return;

    const userText = inputMsg;
    setInputMsg("");
    setLoading(true);

    try {
      const res = await sendChatMessage(userText);
      const newMsg: MessageItem = {
        id: res.id || `msg_${Date.now()}`,
        userMessage: userText,
        assistantResponse: res.assistantResponse || res.message,
        status: res.status || "APPROVED",
        challengeId: res.challengeId,
        demoCode: res.demoCode,
        traces: res.traces || []
      };

      setMessages((prev) => [...prev, newMsg]);

      if (res.status === "OTP_REQUIRED" && res.challengeId) {
        setActiveOtpChallenge({ challengeId: res.challengeId, demoCode: res.demoCode || "123456" });
      }
      
      // Refresh balances
      loadData();
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: `msg_err_${Date.now()}`,
          userMessage: userText,
          assistantResponse: "Error connecting to AI Platform backend.",
          status: "DENIED",
          traces: [{ step: "Network Error", agent: "Gateway", detail: "Could not reach port 8000" }]
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleOtpVerify = async () => {
    if (!activeOtpChallenge || !otpCodeInput) return;
    try {
      const res = await verifyOtpDirect(activeOtpChallenge.challengeId, otpCodeInput);
      if (res.status === "SUCCESS") {
        setOtpStatusMsg("✅ OTP Verified! Payment executed successfully.");
        setTimeout(() => {
          setActiveOtpChallenge(null);
          setOtpCodeInput("");
          setOtpStatusMsg("");
          loadData();
        }, 1500);
      } else {
        setOtpStatusMsg(`❌ Invalid OTP Code (${res.code})`);
      }
    } catch (err) {
      setOtpStatusMsg("❌ Failed to verify OTP");
    }
  };

  const handleAddCardSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCardResMsg("Tokenizing card directly with Secure Banking Fabric...");
    try {
      const res = await addCardDirect(cardPan, parseInt(cardExpMonth), parseInt(cardExpYear), cardCvv);
      if (res.status === "SUCCESS") {
        setCardResMsg(`✅ Card Tokenized! Token: ${res.cardToken} (Last 4: ${res.last4})`);
        loadData();
        setTimeout(() => {
          setShowCardModal(false);
          setCardPan("");
          setCardCvv("");
          setCardResMsg("");
        }, 2000);
      } else {
        setCardResMsg(`❌ ${res.error}`);
      }
    } catch (err) {
      setCardResMsg("❌ Error connecting to SBF");
    }
  };

  return (
    <div className="space-y-6">
      {/* Account Balances Header */}
      <div className="stats stats-vertical sm:stats-horizontal shadow bg-base-100 border border-base-300 w-full">
        {accounts.length > 0 ? (
          accounts.map((acc) => (
            <div key={acc.id} className="stat">
              <div className="stat-figure text-primary">
                <Shield className="w-7 h-7" />
              </div>
              <div className="stat-title capitalize">{acc.type} Account ({acc.accountNo})</div>
              <div className="stat-value text-primary text-2xl sm:text-3xl">₹{acc.balance.toLocaleString('en-IN')}</div>
              <div className="stat-desc font-semibold text-success">Status: {acc.status}</div>
            </div>
          ))
        ) : (
          <div className="stat">
            <div className="stat-title">Salary Account (10001001)</div>
            <div className="stat-value text-primary text-2xl sm:text-3xl">₹1,50,000</div>
            <div className="stat-desc">Governed Account Scope</div>
          </div>
        )}
      </div>

      {/* Main Grid: Chat & Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chat Area (2 cols) */}
        <div className="lg:col-span-2 card bg-base-100 shadow-md border border-base-300 flex flex-col h-[600px] overflow-hidden">
          <div className="p-4 border-b border-base-300 flex items-center justify-between bg-base-200/50">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-success animate-pulse"></div>
              <h2 className="font-semibold text-sm">Autonomous AI Banking Assistant</h2>
            </div>
            <span className="badge badge-outline text-xs">Governed by SBF Gateway</span>
          </div>

          {/* Messages */}
          <div className="flex-1 p-4 overflow-y-auto space-y-4">
            {messages.map((m) => (
              <div key={m.id} className="space-y-2">
                <div className="chat chat-end">
                  <div className="chat-bubble chat-bubble-primary text-xs font-medium">{m.userMessage}</div>
                </div>
                <div className="chat chat-start">
                  <div className={`chat-bubble text-xs ${m.status === 'DENIED' ? 'chat-bubble-error' : m.status === 'OTP_REQUIRED' ? 'chat-bubble-warning' : 'bg-base-200 text-base-content'}`}>
                    {m.assistantResponse}
                  </div>
                </div>

                {/* Live Execution Trace Strip */}
                {m.traces && m.traces.length > 0 && (
                  <div className="ml-10 p-3 bg-base-200 rounded-xl border border-base-300 text-xs space-y-1">
                    <div className="font-semibold text-base-content/70 flex items-center gap-1.5 text-[11px]">
                      <UserCheck className="w-3.5 h-3.5 text-primary" /> Live Agent Execution Trace
                    </div>
                    {m.traces.map((t, idx) => (
                      <div key={idx} className="flex items-start justify-between text-base-content/80 text-[11px]">
                        <span className="font-medium text-primary">[{t.agent}] {t.step}:</span>
                        <span className="truncate max-w-[240px] text-right font-mono">{t.detail}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {loading && (
              <div className="chat chat-start">
                <div className="chat-bubble bg-base-200 flex items-center gap-2 text-xs">
                  <span className="loading loading-dots loading-xs"></span>
                  <span>Orchestrating agents & querying SBF OPA Policy...</span>
                </div>
              </div>
            )}
          </div>

          {/* Prompt Buttons & Input */}
          <div className="p-4 border-t border-base-300 space-y-2 bg-base-100">
            <div className="flex flex-wrap gap-1.5">
              <button 
                type="button"
                onClick={() => setInputMsg("Transfer ₹5000 to Rahul")}
                className="btn btn-xs btn-outline btn-primary rounded-lg"
              >
                Standard (₹5,000)
              </button>
              <button 
                type="button"
                onClick={() => setInputMsg("Transfer ₹15000 to Rahul")}
                className="btn btn-xs btn-outline btn-warning rounded-lg"
              >
                Trigger Out-of-Band OTP (₹15,000)
              </button>
              <button 
                type="button"
                onClick={() => setInputMsg("Transfer ₹30000 from Escrow Account to Rahul")}
                className="btn btn-xs btn-outline btn-error rounded-lg"
              >
                Adversarial Excluded Account (Escrow)
              </button>
            </div>
            <form onSubmit={handleSend} className="flex gap-2">
              <input
                type="text"
                placeholder="Ask AI agent (e.g. 'Transfer ₹5000 to Rahul')..."
                value={inputMsg}
                onChange={(e) => setInputMsg(e.target.value)}
                className="input input-bordered flex-1 rounded-xl text-xs focus:input-primary"
              />
              <button type="submit" disabled={loading} className="btn btn-sm btn-primary rounded-xl">
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>

        {/* Sidebar Cards & Direct Actions */}
        <div className="space-y-6">
          <div className="card bg-base-100 shadow-md border border-base-300 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-secondary" /> User Cards (Direct SBF)
              </h3>
              <button 
                onClick={() => setShowCardModal(true)} 
                className="btn btn-xs btn-secondary rounded-lg"
              >
                + Add Card
              </button>
            </div>
            <p className="text-xs text-base-content/70">
              Cards are tokenized directly with SBF. AI agents only ever see the token, never raw PAN/CVV.
            </p>
            <div className="space-y-2">
              {cards.map((c) => (
                <div key={c.id} className="p-3 bg-base-200 rounded-xl space-y-1 border border-base-300">
                  <div className="flex justify-between text-xs font-semibold">
                    <span>{c.network}</span>
                    <span className="badge badge-accent badge-xs">{c.status}</span>
                  </div>
                  <div className="font-mono text-xs tracking-wider">•••• •••• •••• {c.last4}</div>
                  <div className="text-[10px] opacity-70 font-mono">Token: {c.token}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="alert alert-info text-xs p-4 rounded-2xl space-y-1 shadow-none">
            <h4 className="font-semibold text-xs flex items-center gap-1.5">
              <Lock className="w-4 h-4" /> Out-of-Band Security Guarantee
            </h4>
            <p className="text-xs leading-relaxed opacity-90">
              When an agent operation triggers an OTP threshold, the OTP challenge is submitted <strong>directly from your browser to the SBF</strong>. The AI Platform or agent never processes your OTP code.
            </p>
          </div>
        </div>
      </div>

      {/* Out-of-Band OTP Challenge Modal */}
      {activeOtpChallenge && (
        <div className="modal modal-open">
          <div className="modal-box rounded-2xl border border-warning">
            <h3 className="font-bold text-base text-warning flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" /> Out-Of-Band OTP Verification
            </h3>
            <p className="text-xs text-base-content/70 mb-2">
              Out-of-band verification required. An OTP has been dispatched to your email address.
            </p>
            <div className="alert alert-warning text-xs font-mono mb-4 py-2">
              <span>Email OTP Sandbox Code: <strong>{activeOtpChallenge.demoCode}</strong></span>
            </div>
            <input
              type="text"
              placeholder="Enter 6-digit OTP"
              value={otpCodeInput}
              onChange={(e) => setOtpCodeInput(e.target.value)}
              className="input input-bordered w-full rounded-xl mb-4 font-mono text-center tracking-widest text-lg"
            />
            {otpStatusMsg && <div className="text-xs font-semibold mb-2">{otpStatusMsg}</div>}
            <div className="modal-action">
              <button 
                onClick={() => setActiveOtpChallenge(null)} 
                className="btn btn-sm btn-ghost rounded-xl"
              >
                Cancel
              </button>
              <button 
                onClick={handleOtpVerify} 
                className="btn btn-sm btn-warning rounded-xl"
              >
                Verify & Execute
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Card Direct Modal */}
      {showCardModal && (
        <div className="modal modal-open">
          <div className="modal-box rounded-2xl">
            <h3 className="font-bold text-base mb-2">Tokenize New Card</h3>
            <form onSubmit={handleAddCardSubmit} className="space-y-3">
              <div>
                <label className="label text-xs">Card Number (PAN)</label>
                <input
                  type="text"
                  placeholder="4532 0152 4892 1234"
                  value={cardPan}
                  onChange={(e) => setCardPan(e.target.value)}
                  className="input input-bordered w-full rounded-xl text-xs"
                  required
                />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="label text-xs">Exp Month</label>
                  <input
                    type="number"
                    value={cardExpMonth}
                    onChange={(e) => setCardExpMonth(e.target.value)}
                    className="input input-bordered w-full rounded-xl text-xs"
                  />
                </div>
                <div>
                  <label className="label text-xs">Exp Year</label>
                  <input
                    type="number"
                    value={cardExpYear}
                    onChange={(e) => setCardExpYear(e.target.value)}
                    className="input input-bordered w-full rounded-xl text-xs"
                  />
                </div>
                <div>
                  <label className="label text-xs">CVV</label>
                  <input
                    type="password"
                    placeholder="123"
                    value={cardCvv}
                    onChange={(e) => setCardCvv(e.target.value)}
                    className="input input-bordered w-full rounded-xl text-xs"
                    required
                  />
                </div>
              </div>
              {cardResMsg && <div className="text-xs font-semibold">{cardResMsg}</div>}
              <div className="modal-action">
                <button type="button" onClick={() => setShowCardModal(false)} className="btn btn-sm btn-ghost rounded-xl">Cancel</button>
                <button type="submit" className="btn btn-sm btn-secondary rounded-xl">Tokenize Card</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
