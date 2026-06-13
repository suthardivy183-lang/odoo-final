import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { User } from "@/lib/types";

interface AuthState {
  user: User | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<User>;
  logout: () => void;
}

const AuthContext = React.createContext<AuthState | null>(null);

function loadStoredUser(): User | null {
  try {
    const token = localStorage.getItem("token");
    const raw = localStorage.getItem("user");
    // Both must be present to count as logged in. If the token was cleared
    // (e.g. by the 401 interceptor) but a stale user remains, treat as logged
    // out — otherwise ProtectedRoute/Login bounce between each other forever.
    if (!token || !raw) {
      localStorage.removeItem("user");
      localStorage.removeItem("token");
      return null;
    }
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const qc = useQueryClient();
  const [user, setUser] = React.useState<User | null>(loadStoredUser);
  const [isLoading] = React.useState(false);

  const login = async (username: string, password: string) => {
    // Backend uses OAuth2PasswordRequestForm — must be form-encoded, not JSON
    const form = new URLSearchParams();
    form.append("username", username);
    form.append("password", password);

    const { data } = await api.post<{ access_token: string; token_type: string; user: User }>(
      "/auth/login",
      form,
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );

    localStorage.setItem("token", data.access_token);
    localStorage.setItem("user", JSON.stringify(data.user));
    setUser(data.user);
    qc.clear();
    return data.user;
  };

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
    qc.clear();
    window.location.href = "/login";
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
