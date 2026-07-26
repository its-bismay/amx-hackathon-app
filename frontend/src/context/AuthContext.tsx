import React, { createContext, useContext, useState, useEffect } from "react";
import { fetchMe } from "../api/authClient";

interface UserProfile {
  id: string;
  email: string;
  customerId: string;
  name: string;
  phone?: string;
  role?: string;
}

interface UserAccount {
  id?: string;
  accountNo: string;
  balance: number;
  type: string;
  currency: string;
}

interface AuthContextType {
  user: UserProfile | null;
  account: UserAccount | null;
  token: string | null;
  login: (token: string, user: UserProfile, account: UserAccount) => void;
  logout: () => void;
  refreshMe: () => Promise<void>;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(localStorage.getItem("aegis_token"));
  const [user, setUser] = useState<UserProfile | null>(() => {
    const saved = localStorage.getItem("aegis_user");
    return saved ? JSON.parse(saved) : null;
  });
  const [account, setAccount] = useState<UserAccount | null>(() => {
    const saved = localStorage.getItem("aegis_account");
    return saved ? JSON.parse(saved) : null;
  });
  const [loading, setLoading] = useState(true);

  const login = (newToken: string, newUser: UserProfile, newAccount: UserAccount) => {
    setToken(newToken);
    setUser(newUser);
    setAccount(newAccount);
    localStorage.setItem("aegis_token", newToken);
    localStorage.setItem("aegis_user", JSON.stringify(newUser));
    localStorage.setItem("aegis_account", JSON.stringify(newAccount));
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    setAccount(null);
    localStorage.removeItem("aegis_token");
    localStorage.removeItem("aegis_user");
    localStorage.removeItem("aegis_account");
  };

  const refreshMe = async () => {
    if (!token) return;
    try {
      const res = await fetchMe(token);
      if (res.status === "SUCCESS" && res.user) {
        setUser(res.user);
        if (res.accounts && res.accounts.length > 0) {
          setAccount(res.accounts[0]);
          localStorage.setItem("aegis_account", JSON.stringify(res.accounts[0]));
        }
        localStorage.setItem("aegis_user", JSON.stringify(res.user));
      } else {
        logout();
      }
    } catch (err) {
      console.warn("Failed to refresh user profile", err);
    }
  };

  useEffect(() => {
    if (token) {
      refreshMe().finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, account, token, login, logout, refreshMe, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
