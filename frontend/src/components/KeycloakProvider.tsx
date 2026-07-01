"use client";

import Keycloak from "keycloak-js";
import { createContext, useContext, useEffect, useState, useRef } from "react";

const KC_URL = process.env.NEXT_PUBLIC_KEYCLOAK_URL ?? "http://localhost:8080";
const KC_REALM = process.env.NEXT_PUBLIC_KEYCLOAK_REALM ?? "architect";
const KC_CLIENT_ID = process.env.NEXT_PUBLIC_KEYCLOAK_CLIENT_ID ?? "frontend";

export interface KcUser {
  name: string;
  email: string;
  username: string;
}

interface KcContext {
  user: KcUser | null;
  logout: () => void;
}

const KcCtx = createContext<KcContext>({ user: null, logout: () => {} });

function setTokenCookie(token: string) {
  document.cookie = `kc_token=${encodeURIComponent(token)}; path=/; SameSite=Lax`;
}

function clearTokenCookie() {
  document.cookie = "kc_token=; path=/; max-age=0; SameSite=Lax";
}

export function KeycloakProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<KcUser | null>(null);
  const [ready, setReady] = useState(false);
  const kcRef = useRef<Keycloak | null>(null);

  useEffect(() => {
    const kc = new Keycloak({ url: KC_URL, realm: KC_REALM, clientId: KC_CLIENT_ID });
    kcRef.current = kc;

    kc.init({ onLoad: "login-required", pkceMethod: "S256" })
      .then((authenticated) => {
        if (authenticated && kc.tokenParsed && kc.token) {
          const p = kc.tokenParsed as Record<string, string>;
          setUser({
            name: p["name"] ?? p["preferred_username"] ?? "User",
            email: p["email"] ?? "",
            username: p["preferred_username"] ?? "",
          });
          setTokenCookie(kc.token);
        }
        setReady(true);
      })
      .catch(() => setReady(true));

    // Refresh the token (and cookie) before it expires
    kc.onTokenExpired = () => {
      kc.updateToken(30)
        .then((refreshed) => {
          if (refreshed && kc.token) setTokenCookie(kc.token);
        })
        .catch(() => {
          clearTokenCookie();
          kc.login();
        });
    };
  }, []);

  function logout() {
    clearTokenCookie();
    kcRef.current?.logout({ redirectUri: window.location.origin });
  }

  if (!ready) {
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-950">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-700 border-t-indigo-500" />
          <p className="text-sm text-zinc-500">Connecting to Keycloak...</p>
        </div>
      </div>
    );
  }

  return <KcCtx.Provider value={{ user, logout }}>{children}</KcCtx.Provider>;
}

export const useKeycloak = () => useContext(KcCtx);
