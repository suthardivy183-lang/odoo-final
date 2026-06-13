import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { User } from "@/lib/types";

interface AuthState {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = React.createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const qc = useQueryClient();
  const hasToken = !!localStorage.getItem("token");

  const { data: user, isLoading } = useQuery({
    queryKey: ["me"],
    queryFn: async () => (await api.get<User>("/auth/me")).data,
    enabled: hasToken,
    retry: false,
  });

  const login = async (email: string, password: string) => {
    const { data } = await api.post<{ access_token: string }>("/auth/login", { email, password });
    localStorage.setItem("token", data.access_token);
    await qc.invalidateQueries({ queryKey: ["me"] });
  };

  const logout = () => {
    localStorage.removeItem("token");
    qc.clear();
    window.location.href = "/login";
  };

  return (
    <AuthContext.Provider value={{ user: user ?? null, isLoading: hasToken && isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
