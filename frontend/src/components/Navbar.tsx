import React from "react";
import { Shield, User, Lock } from "lucide-react";

interface NavbarProps {
  currentPortal: "user" | "admin";
  onSwitchPortal: (portal: "user" | "admin") => void;
}

export const Navbar: React.FC<NavbarProps> = ({ currentPortal, onSwitchPortal }) => {
  return (
    <div className="navbar bg-base-100 border-b border-base-300 px-4 sm:px-6 shadow-sm">
      <div className="flex-1 gap-3">
        <div className="p-2 bg-primary/10 text-primary rounded-xl">
          <Shield className="w-5 h-5" />
        </div>
        <div>
          <h1 className="font-bold text-base leading-tight">AEGIS Banking</h1>
          <p className="text-[11px] text-base-content/60 font-medium hidden sm:block">Enterprise AI Agent Governance Infrastructure</p>
        </div>
      </div>

      <div className="flex-none gap-2">
        <div className="join bg-base-200 p-1 rounded-xl">
          <button
            onClick={() => onSwitchPortal("user")}
            className={`join-item btn btn-xs sm:btn-sm rounded-lg border-0 gap-1.5 ${currentPortal === 'user' ? 'btn-primary' : 'btn-ghost'}`}
          >
            <User className="w-3.5 h-3.5" /> <span className="hidden xs:inline">User Portal</span>
          </button>
          <button
            onClick={() => onSwitchPortal("admin")}
            className={`join-item btn btn-xs sm:btn-sm rounded-lg border-0 gap-1.5 ${currentPortal === 'admin' ? 'btn-secondary' : 'btn-ghost'}`}
          >
            <Lock className="w-3.5 h-3.5" /> <span className="hidden xs:inline">Admin Dashboard</span>
          </button>
        </div>
      </div>
    </div>
  );
};
