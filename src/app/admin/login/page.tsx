"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminLoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await signIn("credentials", {
      password,
      redirect: false,
    });

    if (res?.error) {
      setError("Invalid password.");
      setLoading(false);
    } else {
      router.push("/admin");
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
