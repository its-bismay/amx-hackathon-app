import React, { useEffect, useState } from "react";
import { Users, Send, RefreshCw } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { fetchPublicUsers } from "../api/bankClient";

export const UsersTab: React.FC<{ onSelectUserToSend: (accountNo: string) => void }> = ({ onSelectUserToSend }) => {
  const { token, user: currentUser } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const loadUsers = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetchPublicUsers(token);
      if (res.status === "SUCCESS" && res.users) {
        setUsers(res.users);
      }
    } catch (err) {
      console.warn("Failed to load users list", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, [token]);

  return (
    <div className="space-y-6">
      
      {/* Banner */}
      <div className="card bg-base-100 border border-base-300 p-5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" /> Public Bank Directory
          </h2>
          <p className="text-xs text-base-content/70 mt-0.5">
            Real-time public listing of registered bank customer accounts & current balances across the network
          </p>
        </div>
        <button
          onClick={loadUsers}
          disabled={loading}
          className="btn btn-sm btn-primary rounded-xl flex items-center gap-2 shrink-0 self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh Balances
        </button>
      </div>

      {/* Users Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {users.map((u) => (
          <div
            key={u.userId}
            className={`card bg-base-100 border p-5 shadow-sm space-y-3 transition-shadow hover:shadow-md ${
              u.isCurrentUser
                ? "border-primary/50 ring-2 ring-primary/20"
                : "border-base-300"
            }`}
          >
            <div className="flex justify-between items-start">
              <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold text-base">
                {u.name.charAt(0)}
              </div>
              {u.isCurrentUser ? (
                <span className="badge badge-primary badge-sm font-bold">
                  YOU
                </span>
              ) : (
                <span className="badge badge-success badge-sm font-semibold">
                  VERIFIED
                </span>
              )}
            </div>

            <div className="space-y-0.5">
              <h3 className="font-bold text-base">{u.name}</h3>
              <p className="text-xs text-base-content/70 font-mono">{u.email}</p>
            </div>

            <div className="p-3 rounded-xl bg-base-200 border border-base-300 flex justify-between items-center font-mono">
              <div>
                <span className="text-[10px] text-base-content/60 block uppercase">Account No</span>
                <span className="text-xs font-semibold">{u.accountNo}</span>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-base-content/60 block uppercase">Balance</span>
                {u.balance !== null && u.balance !== undefined
                  ? <span className="text-sm font-bold text-primary">₹{u.balance.toLocaleString("en-IN")}</span>
                  : <span className="text-xs font-semibold text-base-content/60 italic">Active</span>
                }
              </div>
            </div>

            {!u.isCurrentUser ? (
              <button
                onClick={() => onSelectUserToSend(u.accountNo)}
                className="btn btn-sm btn-outline btn-primary rounded-xl w-full gap-2 text-xs"
              >
                <Send className="w-3.5 h-3.5" /> Send Money to {u.name.split(" ")[0]}
              </button>
            ) : (
              <div className="text-center text-[11px] text-base-content/50 py-1.5 font-medium">
                Your Logged-In Account
              </div>
            )}
          </div>
        ))}
      </div>

    </div>
  );
};
