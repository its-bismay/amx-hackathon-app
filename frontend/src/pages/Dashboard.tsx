import React, { useState, useEffect } from "react";
import { Shield, Home, Send, Users, Bot, Settings, LogOut, Lock, Sun, Moon, Key, FlaskConical } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { OverviewTab } from "../tabs/OverviewTab";
import { SendMoneyTab } from "../tabs/SendMoneyTab";
import { UsersTab } from "../tabs/UsersTab";
import { AgentTab } from "../tabs/AgentTab";
import { AdminDashboard } from "../portals/admin/AdminDashboard";
import { DemoAccountsTab } from "../tabs/DemoAccountsTab";

export const Dashboard: React.FC = () => {
  const { user, account, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<"OVERVIEW" | "SEND" | "USERS" | "AGENT" | "ADMIN" | "DEMO">("OVERVIEW");
  const [selectedRecipientAccountNo, setSelectedRecipientAccountNo] = useState("");
  
  // DaisyUI Theme State: corporate (light) vs synthwave (dark)
  const [theme, setTheme] = useState<string>(() => {
    const saved = localStorage.getItem("aegis_theme");
    return saved === "synthwave" ? "synthwave" : "corporate";
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("aegis_theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "corporate" ? "synthwave" : "corporate"));
  };

  const handleSelectUserToSend = (accountNo: string) => {
    setSelectedRecipientAccountNo(accountNo);
    setActiveTab("SEND");
  };

  return (
    <div className="min-h-screen bg-base-200 text-base-content flex flex-col font-sans transition-colors duration-200">
      
      {/* Top Banner Notice for Testing & Evaluation */}
      <div className="bg-info/10 text-info-content border-b border-info/20 px-4 py-2 text-center text-xs font-mono font-medium flex flex-wrap items-center justify-center gap-2">
        <FlaskConical className="w-4 h-4 text-info shrink-0" />
        <span>EVALUATION & TEST MODE — Live Postgres DB, Out-of-Band Email OTP & Inngest Observability Active</span>
        <button
          onClick={() => setActiveTab("DEMO")}
          className="btn btn-xs btn-link text-info p-0 h-auto font-bold underline"
        >
          View Demo Accounts & Credentials →
        </button>
      </div>

      {/* Top Header */}
      <header className="navbar bg-base-100 border-b border-base-300 px-4 sm:px-6 sticky top-0 z-30 shadow-sm">
        <div className="flex-1 items-center gap-3">
          <div className="p-2 bg-primary/10 text-primary rounded-xl">
            <Shield className="w-6 h-6 stroke-[2.5]" />
          </div>
          <div>
            <h1 className="font-extrabold text-sm tracking-wider">AEGIS PRIVATE BANKING</h1>
            <span className="text-[10px] text-base-content/60 font-mono block">SECURE GOVERNANCE PLATFORM</span>
          </div>
        </div>

        {/* Header Right Actions */}
        <div className="flex items-center gap-3">
          
          {/* Light / Dark Mode Switch (Corporate vs Synthwave) */}
          <button
            onClick={toggleTheme}
            className="btn btn-sm btn-ghost gap-2 border border-base-300 rounded-xl"
            title={`Switch to ${theme === 'corporate' ? 'Synthwave (Dark)' : 'Corporate (Light)'} mode`}
          >
            {theme === "corporate" ? (
              <>
                <Moon className="w-4 h-4 text-secondary" />
                <span className="hidden sm:inline text-xs font-medium">Synthwave</span>
              </>
            ) : (
              <>
                <Sun className="w-4 h-4 text-warning" />
                <span className="hidden sm:inline text-xs font-medium">Corporate</span>
              </>
            )}
          </button>

          <div className="hidden sm:flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-base-200 border border-base-300 font-mono text-xs">
            <div className="w-2 h-2 rounded-full bg-success animate-pulse"></div>
            <div>
              <span className="text-base-content/60 block text-[10px]">{user?.name}</span>
              <span className="text-primary font-bold">₹{(account?.balance || 0).toLocaleString("en-IN")}</span>
            </div>
          </div>

          <button
            onClick={logout}
            className="btn btn-sm btn-ghost border border-base-300 text-error hover:bg-error/10 rounded-xl text-xs font-semibold gap-1.5"
            title="Log out session"
          >
            <LogOut className="w-4 h-4" /> <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </header>

      {/* Main Workspace with Sidebar & Content */}
      <div className="flex-1 flex max-w-7xl w-full mx-auto p-4 sm:p-6 gap-6">
        
        {/* Navigation Sidebar */}
        <aside className="w-64 shrink-0 hidden md:flex flex-col justify-between p-4 rounded-2xl bg-base-100 border border-base-300 shadow-sm">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-base-content/50 uppercase tracking-widest px-3 block mb-2 font-mono">
              NAVIGATION MENU
            </span>

            {[
              { id: "OVERVIEW", label: "Overview & Accounts", icon: Home },
              { id: "SEND", label: "Send Money (OTP)", icon: Send },
              { id: "USERS", label: "Public Network Users", icon: Users },
              { id: "AGENT", label: "AI Autonomous Agent", icon: Bot, badge: "AI", badgeColor: "badge-primary" },
              { id: "DEMO", label: "Testing Credentials", icon: Key, badge: "SANDBOX", badgeColor: "badge-secondary" },
              // Admin tab — only injected for ADMIN role users
              ...(user?.role === "ADMIN" ? [{ id: "ADMIN", label: "Security & Admin", icon: Settings, badge: "ADMIN", badgeColor: "badge-error" }] : [])
            ].map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    if (item.id !== "SEND") setSelectedRecipientAccountNo("");
                    setActiveTab(item.id as any);
                  }}
                  className={`w-full px-3.5 py-2.5 rounded-xl text-xs font-medium flex items-center justify-between transition-all ${
                    isActive
                      ? "btn btn-primary btn-sm justify-between rounded-xl font-bold"
                      : item.id === "ADMIN"
                        ? "btn btn-ghost btn-sm justify-between text-error hover:bg-error/10 rounded-xl"
                        : "btn btn-ghost btn-sm justify-between text-base-content/80 hover:bg-base-200 rounded-xl"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </div>
                  {item.badge && (
                    <span className={`badge badge-xs font-bold ${isActive ? 'badge-outline text-primary-content' : item.badgeColor}`}>
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Bottom Sidebar Box */}
          <div className="p-3.5 rounded-xl bg-base-200 border border-base-300 space-y-1.5 text-xs">
            <div className="flex items-center gap-1.5 text-success font-semibold text-[11px]">
              <Lock className="w-3.5 h-3.5" /> Out-of-Band Email OTP
            </div>
            <p className="text-[11px] text-base-content/70 leading-normal">
              OTPs are sent directly to <strong className="text-primary font-mono">{user?.email}</strong> via custom HTTP mail server.
            </p>
          </div>
        </aside>

        {/* Mobile Navigation Tabs */}
        <div className="md:hidden flex overflow-x-auto gap-1.5 p-1.5 bg-base-100 rounded-xl border border-base-300 w-full mb-4 shrink-0 shadow-sm">
          {[
            { id: "OVERVIEW", label: "Overview" },
            { id: "SEND", label: "Send" },
            { id: "USERS", label: "Users" },
            { id: "AGENT", label: "AI Agent" },
            { id: "DEMO", label: "Sandbox" },
            ...(user?.role === "ADMIN" ? [{ id: "ADMIN", label: "Admin" }] : [])
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`btn btn-xs rounded-lg whitespace-nowrap ${
                activeTab === tab.id ? "btn-primary" : "btn-ghost"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content Display Area */}
        <main className="flex-1 overflow-x-hidden min-w-0">
          {activeTab === "OVERVIEW" && <OverviewTab onNavigateToSend={() => setActiveTab("SEND")} />}
          {activeTab === "SEND" && (
            <SendMoneyTab
              initialRecipientAccountNo={selectedRecipientAccountNo}
              onSuccess={() => setSelectedRecipientAccountNo("")}
            />
          )}
          {activeTab === "USERS" && <UsersTab onSelectUserToSend={handleSelectUserToSend} />}
          {activeTab === "AGENT" && <AgentTab />}
          {activeTab === "DEMO" && <DemoAccountsTab onNavigateToTab={(tab: string) => setActiveTab(tab as any)} />}
          {activeTab === "ADMIN" && (
            user?.role === "ADMIN"
              ? <AdminDashboard />
              : (
                <div className="card bg-base-100 border border-base-300 shadow-md p-12 text-center flex flex-col items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-error/10 border border-error/30 flex items-center justify-center">
                    <Settings className="w-8 h-8 text-error" />
                  </div>
                  <h2 className="text-xl font-bold text-error">Access Denied</h2>
                  <p className="text-sm text-base-content/70 max-w-xs">You do not have administrator privileges. This panel requires ADMIN role access.</p>
                </div>
              )
          )}
        </main>

      </div>
    </div>
  );
};
