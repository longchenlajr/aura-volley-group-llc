"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import Container from "@/components/Container";
import ScrollReveal from "@/components/ScrollReveal";

const ENDPOINT =
  "https://script.google.com/macros/s/AKfycbx98CEYi11UMCoIjlMlaODHm8vnzYiJYRAxcSz4kaXvpk23_4MAw9TmvShdtcExp77n/exec";

const positions = [
  "Setter",
  "Outside Hitter",
  "Middle Blocker",
  "Opposite",
  "Libero/DS",
];

const experienceLevels = [
  "Beginner",
  "Intermediate",
  "Competitive",
  "Club/College+",
];

const membershipOptions = [
  { label: "Monthly — $55/month", value: "monthly" },
  { label: "10-Pack — $150/10 sessions", value: "10-pack" },
  { label: "Guest/Drop-In — $17/session", value: "drop-in" },
];

const playerStatuses = ["New Player", "Existing Member"];

type FormState = "idle" | "submitting" | "success" | "error";

export default function RegisterPage() {
  const [state, setState] = useState<FormState>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  // field state
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [venmo, setVenmo] = useState("");
  const [instagram, setInstagram] = useState("");
  const [selectedPositions, setSelectedPositions] = useState<string[]>([]);
  const [experience, setExperience] = useState("");
  const [membership, setMembership] = useState("");
  const [heardAbout, setHeardAbout] = useState("");
  const [playerStatus, setPlayerStatus] = useState("");
  const [notes, setNotes] = useState("");

  function togglePosition(pos: string) {
    setSelectedPositions((prev) =>
      prev.includes(pos) ? prev.filter((p) => p !== pos) : [...prev, pos],
    );
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setState("submitting");
    setErrorMsg("");

    const payload = {
      timestamp: new Date().toISOString(),
      name,
      email,
      phone,
      venmo: venmo.startsWith("@") ? venmo : `@${venmo}`,
      instagram: instagram
        ? instagram.startsWith("@")
          ? instagram
          : `@${instagram}`
        : "",
      positions: selectedPositions,
      experience,
      membership,
      heardAbout,
      playerStatus,
      notes,
    };

    try {
      await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: JSON.stringify(payload),
        mode: "no-cors",
      });

      setState("success");
    } catch (err) {
      setState("error");
      setErrorMsg(
        err instanceof Error
          ? err.message
          : "Something went wrong. Please try again.",
      );
    }
  }

  if (state === "success") {
    return (
      <main>
        <div className="page-header">
          <Container>
            <ScrollReveal>
              <span className="kicker kicker-bright">A-Town Aura</span>
              <h1 className="page-title mt-3">You&apos;re In</h1>
              <p className="page-sub mt-3">
                Application received. Once approved, you&apos;ll get a Venmo request — accept it to lock in your membership. In the meanwhile, be sure to join the Discord and turn notifications on.
              </p>
              <div className="mt-8 flex gap-4 flex-wrap">
                <a
                  href="https://discord.gg/SAmCXyxcE5"
                  target="_blank"
                  className="btn btn-primary"
                >
                  Join Discord &rarr;
                </a>
                <Link href="/atownaura/membership" className="btn">
                  Back to Membership Info
                </Link>
              </div>
            </ScrollReveal>
          </Container>
        </div>
      </main>
    );
  }

  return (
    <main>
      <div className="page-header">
        <Container>
          <ScrollReveal>
            <span className="kicker kicker-bright">A-Town Aura</span>
            <h1 className="page-title mt-3">Apply</h1>
            <p className="page-sub mt-3">
              Fill this out to get started. Takes about 2 minutes.
            </p>
            <div className="section-rule mt-8" />
          </ScrollReveal>
        </Container>
      </div>

      <section className="pb-20">
        <Container>
          <form onSubmit={handleSubmit} className="reg-form max-w-2xl">
            {/* Personal Info */}
            <ScrollReveal>
              <fieldset className="reg-fieldset">
                <legend className="kicker">Personal Info</legend>

                <label className="reg-label">
                  <span className="reg-label-text">
                    Full Name <span className="reg-required">*</span>
                  </span>
                  <input
                    type="text"
                    required
                    className="reg-input"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="John Smith"
                  />
                </label>

                <label className="reg-label">
                  <span className="reg-label-text">
                    Email <span className="reg-required">*</span>
                  </span>
                  <input
                    type="email"
                    required
                    className="reg-input"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="john@example.com"
                  />
                </label>

                <label className="reg-label">
                  <span className="reg-label-text">
                    Phone Number <span className="reg-required">*</span>
                  </span>
                  <input
                    type="tel"
                    required
                    className="reg-input"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="(555) 123-4567"
                  />
                </label>

                <label className="reg-label">
                  <span className="reg-label-text">
                    Venmo Handle <span className="reg-required">*</span>
                  </span>
                  <div className="reg-input-prefix-wrap">
                    <span className="reg-input-prefix">@</span>
                    <input
                      type="text"
                      required
                      className="reg-input reg-input-has-prefix"
                      value={venmo}
                      onChange={(e) =>
                        setVenmo(e.target.value.replace(/^@/, ""))
                      }
                      placeholder="username"
                    />
                  </div>
                </label>

                <label className="reg-label">
                  <span className="reg-label-text">Instagram Handle</span>
                  <div className="reg-input-prefix-wrap">
                    <span className="reg-input-prefix">@</span>
                    <input
                      type="text"
                      className="reg-input reg-input-has-prefix"
                      value={instagram}
                      onChange={(e) =>
                        setInstagram(e.target.value.replace(/^@/, ""))
                      }
                      placeholder="username"
                    />
                  </div>
                </label>
              </fieldset>
            </ScrollReveal>

            {/* Volleyball Info */}
            <ScrollReveal delay={100}>
              <fieldset className="reg-fieldset">
                <legend className="kicker">Volleyball Info</legend>

                <div className="reg-label">
                  <span className="reg-label-text">
                    Position(s) Played <span className="reg-required">*</span>
                  </span>
                  <div className="reg-checkbox-group">
                    {positions.map((pos) => (
                      <label key={pos} className="reg-checkbox">
                        <input
                          type="checkbox"
                          checked={selectedPositions.includes(pos)}
                          onChange={() => togglePosition(pos)}
                        />
                        <span className="reg-checkbox-box" />
                        <span className="reg-checkbox-label">{pos}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="reg-label">
                  <span className="reg-label-text">
                    Experience Level <span className="reg-required">*</span>
                  </span>
                  <div className="reg-radio-group">
                    {experienceLevels.map((level) => (
                      <label key={level} className="reg-radio">
                        <input
                          type="radio"
                          name="experience"
                          value={level}
                          required
                          checked={experience === level}
                          onChange={(e) => setExperience(e.target.value)}
                        />
                        <span className="reg-radio-dot" />
                        <span className="reg-checkbox-label">{level}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </fieldset>
            </ScrollReveal>

            {/* Membership */}
            <ScrollReveal delay={200}>
              <fieldset className="reg-fieldset">
                <legend className="kicker">Membership</legend>

                <div className="reg-label">
                  <span className="reg-label-text">
                    Membership Option <span className="reg-required">*</span>
                  </span>
                  <div className="reg-radio-group">
                    {membershipOptions.map((opt) => (
                      <label key={opt.value} className="reg-radio">
                        <input
                          type="radio"
                          name="membership"
                          value={opt.value}
                          required
                          checked={membership === opt.value}
                          onChange={(e) => setMembership(e.target.value)}
                        />
                        <span className="reg-radio-dot" />
                        <span className="reg-checkbox-label">{opt.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </fieldset>
            </ScrollReveal>

            {/* Other */}
            <ScrollReveal delay={300}>
              <fieldset className="reg-fieldset">
                <legend className="kicker">Other</legend>

                <label className="reg-label">
                  <span className="reg-label-text">
                    How did you hear about us?
                  </span>
                  <input
                    type="text"
                    className="reg-input"
                    value={heardAbout}
                    onChange={(e) => setHeardAbout(e.target.value)}
                    placeholder="Instagram, friend, tournament, etc."
                  />
                </label>

                <div className="reg-label">
                  <span className="reg-label-text">
                    New player or existing member?{" "}
                    <span className="reg-required">*</span>
                  </span>
                  <div className="reg-radio-group">
                    {playerStatuses.map((s) => (
                      <label key={s} className="reg-radio">
                        <input
                          type="radio"
                          name="playerStatus"
                          value={s}
                          required
                          checked={playerStatus === s}
                          onChange={(e) => setPlayerStatus(e.target.value)}
                        />
                        <span className="reg-radio-dot" />
                        <span className="reg-checkbox-label">{s}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <label className="reg-label">
                  <span className="reg-label-text">
                    Anything else we should know?
                  </span>
                  <textarea
                    className="reg-input reg-textarea"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Injuries, availability, questions, etc."
                    rows={4}
                  />
                </label>
              </fieldset>
            </ScrollReveal>

            {/* Error message */}
            {state === "error" && <div className="reg-error">{errorMsg}</div>}

            {/* Submit */}
            <ScrollReveal delay={400}>
              <button
                type="submit"
                className="btn btn-primary mt-2"
                disabled={state === "submitting"}
              >
                {state === "submitting" ? (
                  <>
                    <span className="reg-spinner" />
                    Submitting...
                  </>
                ) : (
                  "Submit Application →"
                )}
              </button>
            </ScrollReveal>
          </form>
        </Container>
      </section>
    </main>
  );
}
