import React, { useState, useEffect } from "react";
import { Send, Mail, KeyRound, CheckCircle2, AlertCircle, RefreshCw } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { initiateDirectTransfer, confirmDirectTransfer, fetchPublicUsers } from "../api/bankClient";

interface SendMoneyTabProps {
  initialRecipientAccountNo?: string;
  onSuccess?: () => void;
}

export const SendMoneyTab: React.FC<SendMoneyTabProps> = ({ initialRecipientAccountNo = "", onSuccess }) => {
  const { user, account, token, refreshMe } = useAuth();
  const [recipientAccountNo, setRecipientAccountNo] = useState(initialRecipientAccountNo);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  
  // Public Users List for quick picking
  const [usersList, setUsersList] = useState<any[]>([]);

  // OTP Verification Modal State
  const [step, setStep] = useState<"FORM" | "OTP" | "SUCCESS">("FORM");
  const [challengeId, setChallengeId] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpError, setOtpError] = useState("");
  const [txResult, setTxResult] = useState<any>(null);

  useEffect(() => {
    if (initialRecipientAccountNo) {
      setRecipientAccountNo(initialRecipientAccountNo);
    }
  }, [initialRecipientAccountNo]);

  useEffect(() => {
    if (token) {
      fetchPublicUsers(token).then((res) => {
        if (res.status === "SUCCESS" && res.users) {
          setUsersList(res.users.filter((u: any) => !u.isCurrentUser));
        }
      });
    }
  }, [token]);

  const handleInitiate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setLoading(true);
    setErrorMsg("");

    const transferAmount = parseFloat(amount);
    if (isNaN(transferAmount) || transferAmount <= 0) {
      setErrorMsg("Please enter a valid transfer amount");
      setLoading(false);
      return;
    }

    try {
      const res = await initiateDirectTransfer(token, recipientAccountNo, transferAmount, note);
      if (res.status === "OTP_REQUIRED") {
        setChallengeId(res.challengeId);
        setStep("OTP");
      } else {
        setErrorMsg(res.detail || res.message || "Failed to initiate transfer");
      }
    } catch (err) {
      setErrorMsg("Network error connecting to Secure Banking Fabric");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !challengeId) return;
    setOtpLoading(true);
    setOtpError("");

    try {
      const res = await confirmDirectTransfer(token, challengeId, otpCode);
      if (res.status === "SUCCESS") {
        setTxResult(res);
        setStep("SUCCESS");
        await refreshMe();
        if (onSuccess) onSuccess();
      } else {
        setOtpError(res.detail || res.message || "Invalid OTP code");
      }
    } catch (err) {
      setOtpError("Network error during OTP confirmation");
    } finally {
      setOtpLoading(false);
    }
  };

  const resetForm = () => {
    setRecipientAccountNo("");
    setAmount("");
    setNote("");
    setOtpCode("");
    setChallengeId("");
    setErrorMsg("");
    setOtpError("");
    setTxResult(null);
    setStep("FORM");
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      
      {/* Header Banner */}
      <div className="card bg-base-100 border border-base-300 p-5 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Send className="w-5 h-5 text-primary" /> Transfer Funds
          </h2>
          <p className="text-xs text-base-content/70 mt-0.5">
            Direct Inter-Account API Transfer protected by email OTP challenges
          </p>
        </div>
        <div className="text-right font-mono text-xs">
          <span className="text-base-content/60 block">Your Current Balance</span>
          <span className="text-base font-bold text-primary">₹{(account?.balance || 0).toLocaleString("en-IN")}</span>
        </div>
      </div>

      {step === "FORM" && (
        <div className="card bg-base-100 border border-base-300 shadow-md p-6 sm:p-8 space-y-6">
          
          {/* Quick Select Beneficiary */}
          {usersList.length > 0 && (
            <div>
              <span className="text-xs font-bold text-base-content/70 uppercase tracking-wider block mb-2 font-mono">
                Select Registered Recipient
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {usersList.map((u) => (
                  <button
                    key={u.accountNo}
                    type="button"
                    onClick={() => setRecipientAccountNo(u.accountNo)}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      recipientAccountNo === u.accountNo
                        ? "btn-primary text-primary-content font-bold border-primary shadow-sm"
                        : "bg-base-200 border-base-300 hover:bg-base-300 text-base-content"
                    }`}
                  >
                    <span className="text-xs font-bold block truncate">{u.name}</span>
                    <span className="text-[10px] opacity-75 font-mono block">Acc: {u.accountNo}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <form onSubmit={handleInitiate} className="space-y-4">
            <div>
              <label className="label text-xs font-medium pb-1">Recipient Account Number</label>
              <input
                type="text"
                placeholder="Enter 8-10 digit account number (e.g. 10001002)"
                value={recipientAccountNo}
                onChange={(e) => setRecipientAccountNo(e.target.value)}
                className="input input-bordered w-full rounded-xl text-xs font-mono focus:input-primary"
                required
              />
            </div>

            <div>
              <label className="label text-xs font-medium pb-1">Transfer Amount (INR)</label>
              <div className="relative">
                <span className="absolute left-4 top-3 text-base-content/60 font-bold">₹</span>
                <input
                  type="number"
                  placeholder="e.g. 5000"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="input input-bordered w-full rounded-xl pl-8 pr-4 text-xs font-mono focus:input-primary"
                  required
                />
              </div>
            </div>

            <div>
              <label className="label text-xs font-medium pb-1">Remarks / Note (Optional)</label>
              <input
                type="text"
                placeholder="e.g. Dinner split / Rent payment"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="input input-bordered w-full rounded-xl text-xs focus:input-primary"
              />
            </div>

            {errorMsg && (
              <div className="alert alert-error text-xs p-3 rounded-xl font-medium flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" /> {errorMsg}
              </div>
            )}

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="btn btn-primary w-full rounded-xl text-sm flex items-center justify-center gap-2"
              >
                {loading ? (
                  <span className="loading loading-spinner loading-sm"></span>
                ) : (
                  <>
                    <Mail className="w-4 h-4" /> Send OTP to Registered Email ({user?.email})
                  </>
                )}
              </button>
            </div>
          </form>

        </div>
      )}

      {/* STEP 2: OTP VERIFICATION MODAL */}
      {step === "OTP" && (
        <div className="card bg-base-100 border border-warning shadow-lg p-6 sm:p-8 space-y-6 max-w-md mx-auto">
          <div className="text-center space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-warning/10 text-warning border border-warning/30 flex items-center justify-center mx-auto">
              <KeyRound className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold">Enter OTP Sent to Email</h3>
            <p className="text-xs text-base-content/70">
              We dispatched a 6-digit verification code to <strong className="text-primary font-mono">{user?.email}</strong> via custom email server.
            </p>
          </div>

          <form onSubmit={handleConfirmOtp} className="space-y-4">
            <div>
              <label className="label text-xs font-semibold justify-center mb-1">6-Digit Verification Code</label>
              <input
                type="text"
                maxLength={6}
                placeholder="123456"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value)}
                className="input input-bordered input-warning w-full text-center text-2xl font-bold font-mono tracking-[8px] rounded-xl py-3"
                autoFocus
                required
              />
            </div>

            {otpError && (
              <div className="alert alert-error text-xs p-3 rounded-xl font-medium text-center">
                {otpError}
              </div>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setStep("FORM")}
                className="btn btn-ghost border border-base-300 w-1/3 rounded-xl text-xs"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={otpLoading || otpCode.length < 6}
                className="btn btn-warning w-2/3 rounded-xl text-xs flex items-center justify-center gap-2"
              >
                {otpLoading ? (
                  <span className="loading loading-spinner loading-xs"></span>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" /> Confirm & Send Money
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* STEP 3: SUCCESS CONFIRMATION */}
      {step === "SUCCESS" && txResult && (
        <div className="card bg-base-100 border border-success shadow-lg p-6 sm:p-8 text-center space-y-6 max-w-md mx-auto">
          <div className="w-14 h-14 rounded-full bg-success/20 text-success border border-success/40 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-8 h-8" />
          </div>

          <div>
            <h3 className="text-xl font-bold">Transfer Completed Successfully!</h3>
            <p className="text-xs text-base-content/70 mt-1">
              Emails have been dispatched to both sender and recipient inbox.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-base-200 border border-base-300 text-xs space-y-2 font-mono text-left">
            <div className="flex justify-between border-b border-base-300 pb-2">
              <span className="text-base-content/60">Transaction ID</span>
              <span className="text-primary font-bold">{txResult.transactionId}</span>
            </div>
            <div className="flex justify-between border-b border-base-300 pb-2">
              <span className="text-base-content/60">Updated Balance</span>
              <span className="text-success font-bold">₹{txResult.newBalance?.toLocaleString("en-IN")}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-base-content/60">Inngest Workflow</span>
              <span className="text-info font-semibold">DISPATCHED</span>
            </div>
          </div>

          <button
            onClick={resetForm}
            className="btn btn-primary px-6 py-2.5 rounded-xl text-xs flex items-center gap-2 mx-auto"
          >
            <RefreshCw className="w-4 h-4" /> Make Another Transfer
          </button>
        </div>
      )}

    </div>
  );
};
