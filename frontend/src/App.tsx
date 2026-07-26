import React, { useState } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { LoginPage } from "./pages/LoginPage";
import { Dashboard } from "./pages/Dashboard";
import { BootScreen } from "./components/BootScreen";

// Only show BootScreen in production (i.e. not localhost)
const IS_PRODUCTION = !window.location.hostname.includes("localhost");

const AppContent: React.FC = () => {
  const { user, loading } = useAuth();
  const [booted, setBooted] = useState(!IS_PRODUCTION ? true : false);

  // Show warm-up screen only in production until both Render services are online
  if (!booted) {
    return <BootScreen onReady={() => setBooted(true)} />;
  }

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
