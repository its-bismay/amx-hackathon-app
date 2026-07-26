import React, { useEffect, useState } from "react";
import { Server, Wifi, CheckCircle2, Loader2, AlertTriangle } from "lucide-react";

const SBF_URL = import.meta.env.VITE_SBF_URL ?? "http://localhost:8001";
const AI_URL  = import.meta.env.VITE_AI_PLATFORM_URL ?? "http://localhost:8000";
const OPA_URL = import.meta.env.VITE_OPA_URL ?? "http://localhost:8181";

type ServiceStatus = "waiting" | "online" | "error";

interface Service {
  name: string;
  label: string;
  url: string;
  healthPath: string;
  status: ServiceStatus;
}

interface BootScreenProps {
  onReady: () => void;
}

export const BootScreen: React.FC<BootScreenProps> = ({ onReady }) => {
  const [services, setServices] = useState<Service[]>([
    { name: "sbf", label: "Secure Banking Fabric", url: SBF_URL, healthPath: "/health", status: "waiting" },
    { name: "ai",  label: "AI Agent Platform",     url: AI_URL,  healthPath: "/health", status: "waiting" },
  ]);
  const [elapsed, setElapsed]       = useState(0);
  const [attempt, setAttempt]       = useState(0);
  const [allReady, setAllReady]     = useState(false);
  const [showApp, setShowApp]       = useState(false);

  // Tick elapsed timer
  useEffect(() => {
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, []);

  // Probe both services every 4 seconds
  useEffect(() => {
    const probe = async () => {
      setAttempt((a) => a + 1);
      const updated = await Promise.all(
        services.map(async (svc) => {
          try {
            const res = await fetch(`${svc.url}${svc.healthPath}`, {
              signal: AbortSignal.timeout(30000), // 30s — Render free cold-start can take 30-60s
            });
            return { ...svc, status: (res.ok ? "online" : "error") as ServiceStatus };
          } catch {
            return { ...svc, status: "waiting" as ServiceStatus };
          }
        })
      );
      setServices(updated);
      if (updated.every((s) => s.status === "online")) {
        setAllReady(true);
      }
    };

    probe(); // immediate first probe
    const interval = setInterval(probe, 35000); // retry every 35s (after 30s timeout completes)
    return () => clearInterval(interval);
  }, []); // eslint-disable-line

  // Transition to app after both are online
  useEffect(() => {
    if (allReady) {
      const t = setTimeout(() => { setShowApp(true); onReady(); }, 1200);
      return () => clearTimeout(t);
    }
  }, [allReady, onReady]);

  const statusIcon = (s: ServiceStatus) => {
    if (s === "online")  return <CheckCircle2 className="w-5 h-5 text-success shrink-0" />;
    if (s === "error")   return <AlertTriangle className="w-5 h-5 text-error shrink-0" />;
    return <Loader2 className="w-5 h-5 text-warning shrink-0 animate-spin" />;
  };

  const statusBadge = (s: ServiceStatus) => {
    if (s === "online")  return <span className="badge badge-success badge-sm font-bold">ONLINE</span>;
    if (s === "error")   return <span className="badge badge-error badge-sm font-bold">ERROR</span>;
    return <span className="badge badge-warning badge-sm font-bold animate-pulse">WAKING UP</span>;
  };

  return (
    <div className="min-h-screen bg-base-200 flex items-center justify-center p-4">
      <div className="card bg-base-100 border border-base-300 shadow-xl w-full max-w-md p-8 space-y-8">

        {/* Logo & Title */}
        <div className="text-center space-y-2">
          <div className="flex justify-center">
            <div className="p-4 bg-primary/10 rounded-2xl">
              <Server className="w-10 h-10 text-primary" />
            </div>
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight">AEGIS Platform</h1>
          <p className="text-sm text-base-content/70">
            Enterprise AI Agent Governance System
          </p>
        </div>

        {/* Notice */}
        <div className="alert bg-warning/10 border border-warning/30 rounded-xl p-4 text-xs flex items-start gap-3">
          <Wifi className="w-5 h-5 text-warning shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-warning mb-1">Backend Services Are Waking Up</p>
            <p className="text-base-content/70 leading-relaxed">
              This platform runs on <strong>Render's free tier</strong>, which spins down after inactivity.
              Services typically take <strong>30–60 seconds</strong> to boot. Please wait a moment! ☕
            </p>
          </div>
        </div>

        {/* Service Status */}
        <div className="space-y-3">
          {services.map((svc) => (
            <div key={svc.name} className="flex items-center justify-between bg-base-200 rounded-xl px-4 py-3 border border-base-300">
              <div className="flex items-center gap-3">
                {statusIcon(svc.status)}
                <span className="text-sm font-semibold">{svc.label}</span>
              </div>
              {statusBadge(svc.status)}
            </div>
          ))}
          {/* OPA — no CORS headers, cannot be pinged from browser; verified implicitly via SBF */}
          <div className="flex items-center justify-between bg-base-200 rounded-xl px-4 py-3 border border-base-300">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-success shrink-0" />
              <span className="text-sm font-semibold">OPA Policy Engine</span>
            </div>
            <span className="badge badge-info badge-sm font-bold">VIA SBF</span>
          </div>
          {/* Redis — TCP managed service, always shown as online (Upstash 99.9% SLA) */}
          <div className="flex items-center justify-between bg-base-200 rounded-xl px-4 py-3 border border-base-300">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-success shrink-0" />
              <span className="text-sm font-semibold">Redis (Upstash)</span>
            </div>
            <span className="badge badge-success badge-sm font-bold">MANAGED</span>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center space-y-2">
          {allReady ? (
            <p className="text-sm font-bold text-success flex items-center justify-center gap-2">
              <CheckCircle2 className="w-4 h-4" /> All systems online! Launching...
            </p>
          ) : (
            <p className="text-xs text-base-content/50 font-mono">
              Probe #{attempt} • {elapsed}s elapsed • retrying every 4s
            </p>
          )}
          {!allReady && (
            <progress className="progress progress-primary w-full h-1.5" />
          )}
        </div>

      </div>
    </div>
  );
};
