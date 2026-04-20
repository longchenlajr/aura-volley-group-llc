"use client";

import { useState } from "react";

export default function AdminLoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      // Get CSRF token first
      const csrfRes = await fetch("/api/auth/csrf");
      const { csrfToken } = await csrfRes.json();

      // Submit credentials
      const res = await fetch("/api/auth/callback/credentials", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          csrfToken,
          password,
          redirect: "false",
        }),
        redirect: "manual",
      });

      // Auth.js returns a redirect on success (302) or error page on failure
      if (res.type === "opaqueredirect" || res.status === 302 || res.ok) {
        // Check if we actually got a session
        const sessionRes = await fetch("/api/auth/session");
        const session = await sessionRes.json();
        if (session?.user) {
          window.location.href = "/admin";
          return;
        }
      }

      setError("Invalid password.");
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="lv-admin-login">
      <form onSubmit={handleSubmit} className="lv-admin-login-card">
        <h1 className="lv-admin-login-title">Admin</h1>
        <div className="lv-field">
          <label className="lv-field-label" htmlFor="admin-pw">
            Password
          </label>
          <input
            id="admin-pw"
            className="lv-input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoFocus
          />
        </div>
        {error && <p className="lv-field-error">{error}</p>}
        <button
          type="submit"
          className="lv-btn lv-btn-primary"
          disabled={loading}
          style={{ width: "100%", height: 44 }}
        >
          {loading ? (
            <>
              <span className="lv-spinner" />
              Signing in&hellip;
            </>
          ) : (
            "Sign in"
          )}
        </button>
      </form>
    </div>
  );
}
