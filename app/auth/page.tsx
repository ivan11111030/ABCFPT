"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  GoogleAuthProvider,
  signOut,
} from "firebase/auth";
import { auth } from "@/src/lib/firebase";
import { useAuth } from "@/src/lib/useAuth";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH || "/ABCFPT";

export default function AuthPage() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const user = useAuth();
  const router = useRouter();

  const isSubmitDisabled = loading || !email.trim() || !password.trim();

  useEffect(() => {
    if (user) {
      router.replace("/control");
    }
  }, [user, router]);

  const handleAuth = async () => {
    setLoading(true);
    setMessage("");

    try {
      if (mode === "login") {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
      }
    } catch (error: unknown) {
      setMessage((error as Error).message || "Unable to sign in.");
    }

    setLoading(false);
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setMessage("");

    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (error: unknown) {
      const firebaseError = error as { code?: string; message?: string };
      if (firebaseError.code === "auth/popup-blocked" || firebaseError.code === "auth/popup-closed-by-user") {
        try {
          const provider = new GoogleAuthProvider();
          await signInWithRedirect(auth, provider);
          return;
        } catch (redirectError: unknown) {
          setMessage((redirectError as Error).message || "Google sign-in failed.");
          setLoading(false);
          return;
        }
      }

      setMessage(firebaseError.message || "Google sign-in failed.");
      setLoading(false);
    }

    setLoading(false);
  };

  const handleResetPassword = async () => {
    if (!email) {
      setMessage("Enter your email to reset password.");
      return;
    }

    try {
      await sendPasswordResetEmail(auth, email);
      setMessage("Password reset email sent. Check your inbox.");
    } catch (error: unknown) {
      setMessage((error as Error).message || "Unable to send reset email.");
    }
  };

  const handleSignOut = async () => {
    await signOut(auth);
  };

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <header className="auth-brand-row">
          <div className="logo-row" aria-label="ABCF brand mark">
            <img
              className="logo-img logo-img-square"
              src={`${BASE}/logo-left.png`}
              alt="ABCF Church logo"
              width={120}
              height={120}
            />
            <img
              className="logo-img logo-img-wide"
              src={`${BASE}/logo-right.png`}
              alt="ABCF Production Team logo"
              width={180}
              height={120}
            />
          </div>
          <div className="auth-title-block">
            <h1>{mode === "login" ? "Welcome Back" : "Create Your Account"}</h1>
            <p>Manage your livestream scenes, lyrics, and camera routing.</p>
          </div>
        </header>

        <div className="panel-header">
          <p>{mode === "login" ? "Sign In" : "Register"}</p>
          <button type="button" className="button subtle" onClick={() => setMode(mode === "login" ? "register" : "login")}> 
            {mode === "login" ? "Create account" : "Sign in"}
          </button>
        </div>

        <form className="auth-form" onSubmit={(event) => {
          event.preventDefault();
          void handleAuth();
        }}>
          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              required
            />
          </label>
          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Password"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              minLength={6}
              required
            />
          </label>
          <div className="auth-actions">
            <button type="submit" className="button primary" disabled={isSubmitDisabled}>
              {loading ? "Please wait..." : mode === "login" ? "Sign In" : "Register"}
            </button>
            {mode === "login" && (
              <button type="button" className="button subtle" onClick={handleResetPassword} disabled={loading}>
                Forgot Password
              </button>
            )}
          </div>
          <button type="button" className="button secondary" onClick={handleGoogleSignIn} disabled={loading}>
            Continue with Google
          </button>
          {message ? <p className="message">{message}</p> : null}
          {user ? (
            <div className="auth-user-card">
              <p>Signed in as {user.email}</p>
              <button type="button" className="button outline" onClick={handleSignOut}>
                Sign Out
              </button>
            </div>
          ) : null}
        </form>
      </section>
    </main>
  );
}
