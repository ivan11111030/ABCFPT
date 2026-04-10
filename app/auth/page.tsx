"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
} from "firebase/auth";
import { auth } from "@/src/lib/firebase";
import { useAuth } from "@/src/lib/useAuth";

export default function AuthPage() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const user = useAuth();
  const router = useRouter();

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
      setMessage((error as Error).message || "Google sign-in failed.");
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
        <div className="panel-header">
          <p>{mode === "login" ? "Sign In" : "Create Account"}</p>
          <button type="button" className="button subtle" onClick={() => setMode(mode === "login" ? "register" : "login")}> 
            {mode === "login" ? "Create account" : "Sign in"}
          </button>
        </div>

        <div className="auth-form">
          <label>
            Email
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" />
          </label>
          <label>
            Password
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Password" />
          </label>
          <div className="auth-actions">
            <button type="button" className="button primary" onClick={handleAuth} disabled={loading}>
              {mode === "login" ? "Sign In" : "Register"}
            </button>
            {mode === "login" && (
              <button type="button" className="button subtle" onClick={handleResetPassword} disabled={loading}>
                Forgot Password
              </button>
            )}
          </div>
          <button type="button" className="button secondary" onClick={handleGoogleSignIn} disabled={loading}>
            Sign in with Google
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
        </div>
      </section>
    </main>
  );
}
