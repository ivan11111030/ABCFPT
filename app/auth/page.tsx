"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
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
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const isSubmitDisabled = loading || !email.trim() || !password.trim();

  useEffect(() => {
    // Handle redirect result from Firebase auth (e.g., after returning from Google sign-in)
    const handleRedirectResult = async () => {
      try {
        const result = await getRedirectResult(auth);
        if (result?.user) {
          // User successfully authenticated and returned from Firebase redirect
          // The useAuth hook will detect the user change and redirect
          console.log("Redirect auth successful:", result.user.email);
          setMessage("");
        }
      } catch (error: unknown) {
        const firebaseError = error as { code?: string; message?: string };
        console.error("Redirect result error:", firebaseError);
        if (firebaseError.code !== "auth/no-redirect-client-id") {
          setMessage(firebaseError.message || "Google sign-in redirect failed.");
        }
      }
      setLoading(false);
    };
    
    void handleRedirectResult();
  }, []);

  useEffect(() => {
    if (authLoading) return; // Wait for auth to load
    
    if (user) {
      // User is authenticated, redirect to control page
      router.replace("/control");
    }
  }, [user, authLoading, router]);

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
      // Try popup first (faster, no page reload)
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (error: unknown) {
      const firebaseError = error as { code?: string; message?: string };
      
      // If popup blocked or COOP issue, fallback to redirect
      if (
        firebaseError.code === "auth/popup-blocked"
        || firebaseError.code === "auth/popup-closed-by-user"
        || firebaseError.message?.includes("closed")
      ) {
        try {
          const provider = new GoogleAuthProvider();
          await signInWithRedirect(auth, provider);
          // Page will redirect, no need to continue
          return;
        } catch (redirectError: unknown) {
          const redirectErr = redirectError as { message?: string };
          setMessage(redirectErr.message || "Google sign-in failed. Please try again.");
          setLoading(false);
          return;
        }
      }
      
      // Show other errors
      setMessage(firebaseError.message || "Google sign-in failed. Please try again.");
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
          <label htmlFor="email">
            Email
            <input
              id="email"
              name="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              required
            />
          </label>
          <label htmlFor="password">
            Password
            <input
              id="password"
              name="password"
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
