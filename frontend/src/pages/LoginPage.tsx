import React, { useState } from "react";
import { Shield, ArrowRight, UserPlus, LogIn, CheckCircle, KeyRound } from "lucide-react";
import { loginUser, registerUser } from "../api/authClient";
import { useAuth } from "../context/AuthContext";

export const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState("admin118@amx.in");
  const [password, setPassword] = useState("12345678");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");

    try {
      if (isRegister) {
        const res = await registerUser(name, email, phone, password);
        if (res.status === "SUCCESS" && res.token) {
          login(res.token, res.user, res.account);
        } else {
          setErrorMsg(res.detail || res.message || "Registration failed");
        }
      } else {
        const res = await loginUser(email, password);
        if (res.status === "SUCCESS" && res.token) {
          login(res.token, res.user, res.account);
        } else {
          setErrorMsg(res.detail || res.message || "Invalid credentials");
        }
      }
    } catch (err: any) {
      setErrorMsg("Network error connecting to Secure Banking Fabric");
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = (demoEmail: string, demoPw: string = "demo1234") => {
    setEmail(demoEmail);
    setPassword(demoPw);
  };

  return (
    <div className="min-h-screen bg-base-200 flex items-center justify-center p-4 sm:p-6 font-sans">
      <div className="card lg:card-side bg-base-100 shadow-xl border border-base-300 max-w-4xl w-full overflow-hidden">
        
        {/* Left Side: Branding Banner & Examiner Notice */}
        <div className="lg:w-1/2 p-6 sm:p-8 flex flex-col justify-between bg-base-200 border-b lg:border-b-0 lg:border-r border-base-300">
          <div>
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2.5 bg-primary/10 text-primary rounded-xl">
                <Shield className="w-6 h-6 stroke-[2.5]" />
              </div>
              <div>
                <h1 className="text-xl font-extrabold tracking-wide">AEGIS BANK</h1>
                <p className="text-xs text-primary font-medium">PRIVATE DIGITAL BANKING & AI GOVERNANCE</p>
              </div>
            </div>

            <h2 className="text-lg font-bold mb-2 leading-tight">
              Enterprise Zero-Trust AI Agent Platform
            </h2>
            <p className="text-base-content/70 text-xs leading-relaxed mb-4">
              Equipped with OPA policy evaluation, Redis Kill Switches, and Inngest durable agent workflow tracing.
            </p>

            {/* TESTER / EXAMINER CREDENTIAL NOTICE */}
            <div className="alert alert-warning text-xs shadow-none p-4 rounded-xl space-y-2 mb-4">
              <div className="font-bold flex items-center gap-2 text-sm">
                <KeyRound className="w-4 h-4" /> Root Admin Credentials for Testers
              </div>
              <p className="text-[11px] leading-normal opacity-90">
                Use the dedicated Root Admin account below to access the <strong>Security Control Center</strong>, <strong>Redis Kill Switches</strong>, and <strong>OPA Audit Explorer</strong>:
              </p>
              <div className="bg-base-100 p-2.5 rounded-lg border border-warning/30 font-mono text-[11px] space-y-1 text-base-content">
                <div><span className="opacity-70">Admin Email:</span> <strong className="text-primary font-bold">admin118@amx.in</strong></div>
                <div><span className="opacity-70">Admin Pass:</span> <strong className="text-primary font-bold">12345678</strong></div>
              </div>
            </div>

            <div className="space-y-2 text-xs text-base-content/80">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-success" /> Full Admin Kill Switch & Governance Control
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-success" /> ₹1,000,000 Initial Admin Balance
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-success" /> Real Out-of-band email OTP verification
              </div>
            </div>
          </div>

          {/* Quick Demo Login Preset Buttons */}
          <div className="mt-6 pt-4 border-t border-base-300">
            <span className="text-[11px] font-bold text-base-content/60 uppercase tracking-wider block mb-2 font-mono">
              Quick Preset Accounts
            </span>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => handleQuickLogin("admin118@amx.in", "12345678")}
                className={`btn btn-xs rounded-lg font-mono ${
                  email === "admin118@amx.in" ? "btn-primary" : "btn-outline btn-primary"
                }`}
              >
                👑 ROOT ADMIN
              </button>
              {[
                { name: "Arjun", email: "arjun@demo.in" },
                { name: "Priya", email: "priya@demo.in" },
                { name: "Rahul", email: "rahul@demo.in" },
              ].map((u) => (
                <button
                  key={u.email}
                  type="button"
                  onClick={() => handleQuickLogin(u.email, "demo1234")}
                  className={`btn btn-xs rounded-lg ${
                    email === u.email ? "btn-secondary" : "btn-ghost border border-base-300"
                  }`}
                >
                  {u.name}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right Side: Auth Form */}
        <div className="lg:w-1/2 p-6 sm:p-8 flex flex-col justify-center bg-base-100">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold flex items-center gap-2">
              {isRegister ? <UserPlus className="w-5 h-5 text-primary" /> : <LogIn className="w-5 h-5 text-primary" />}
              {isRegister ? "Create Account" : "Bank & Admin Portal Login"}
            </h3>
            <button
              type="button"
              onClick={() => {
                setIsRegister(!isRegister);
                setErrorMsg("");
              }}
              className="btn btn-xs btn-link text-primary p-0 h-auto font-semibold"
            >
              {isRegister ? "Already registered? Login" : "Need account? Sign Up"}
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {isRegister && (
              <div>
                <label className="label text-xs font-medium pb-1">Full Name</label>
                <input
                  type="text"
                  placeholder="e.g. Bismay B"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="input input-bordered w-full rounded-xl text-sm focus:input-primary"
                  required
                />
              </div>
            )}

            <div>
              <label className="label text-xs font-medium pb-1">Email Address</label>
              <input
                type="email"
                placeholder="admin118@amx.in or your.email@gmail.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input input-bordered w-full rounded-xl text-sm font-mono focus:input-primary"
                required
              />
            </div>

            {isRegister && (
              <div>
                <label className="label text-xs font-medium pb-1">Phone Number</label>
                <input
                  type="tel"
                  placeholder="9876543210"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="input input-bordered w-full rounded-xl text-sm font-mono focus:input-primary"
                  required
                />
              </div>
            )}

            <div>
              <label className="label text-xs font-medium pb-1">Password</label>
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input input-bordered w-full rounded-xl text-sm focus:input-primary"
                required
              />
            </div>

            {errorMsg && (
              <div className="alert alert-error text-xs p-3 rounded-xl font-medium">
                {errorMsg}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary w-full rounded-xl text-sm mt-2 flex items-center justify-center gap-2"
            >
              {loading ? (
                <span className="loading loading-spinner loading-sm"></span>
              ) : (
                <>
                  {isRegister ? "Open Bank Account" : "Access Banking Portal"}
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-4 p-3 rounded-xl bg-base-200 border border-base-300 text-[11px] text-base-content/70 text-center space-y-1">
            <div>Root Admin Login: <code className="text-primary font-mono font-bold">admin118@amx.in</code> / <code className="text-primary font-mono font-bold">12345678</code></div>
            <div>User Demo Password: <code className="font-mono">demo1234</code></div>
          </div>
        </div>

      </div>
    </div>
  );
};
