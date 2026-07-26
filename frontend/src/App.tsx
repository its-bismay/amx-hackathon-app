import React from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { LoginPage } from "./pages/LoginPage";
import { Dashboard } from "./pages/Dashboard";

const AppContent: React.FC = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-base-200 flex flex-col items-center justify-center text-base-content font-sans p-4">
        <span className="loading loading-spinner loading-lg text-primary mb-4"></span>
        <p className="text-xs font-mono text-base-content/70 tracking-wider">CONNECTING TO SECURE BANKING FABRIC...</p>
      </div>
    );
  }

  return user ? <Dashboard /> : <LoginPage />;
};

export function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
