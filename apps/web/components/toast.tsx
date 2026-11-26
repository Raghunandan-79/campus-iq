"use client";

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { CheckCircle2, Info } from "lucide-react";
import { clsx } from "clsx";

type Toast = { id: number; message: string; kind: "info" | "success" };

const ToastContext = createContext<(message: string, kind?: Toast["kind"]) => void>(() => {});

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(0);

  const toast = useCallback((message: string, kind: Toast["kind"] = "info") => {
    const id = ++idRef.current;
    setToasts((t) => [...t, { id, message, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500);
  }, []);

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-80 flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={clsx(
              "pointer-events-auto flex items-start gap-2.5 rounded-lg border px-4 py-3 text-sm shadow-lg",
              t.kind === "success"
                ? "border-green-200 bg-green-50 text-green-900"
                : "border-border bg-white text-foreground",
            )}
          >
            {t.kind === "success" ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
            ) : (
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
            )}
            <span>{t.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
