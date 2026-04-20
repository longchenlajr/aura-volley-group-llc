import Link from "next/link";
import Container from "@/components/Container";
import ScrollReveal from "@/components/ScrollReveal";

export const metadata = {
  title: "Join A-Town Aura",
  description:
    "Learn about A-Town Aura membership — practices, film review, tournaments, and community. Pick your plan and apply.",
};

const programCards = [
  {
    title: "Practice",
    kicker: "Weekly",
    body: "Weekly reserved sessions. Collaborative practice plans polled from the team — positional work, systems, and live gameplay.",
  },
  {
    title: "Film Review",
    kicker: "Analysis",
    body: "Game film reviewed as a team. Identify patterns, clean up weaknesses, get better with real data.",
  },
  {
    title: "Competition",
    kicker: "Tournaments",
    body: "Targeted tournaments as a team. Build chemistry playing together, not alongside strangers.",
  },
  {
    title: "Community",
    kicker: "Discord",
    body: "Discord server for communication, scheduling, and building culture beyond the court.",
  },
];

const values = [
  {
    title: "Stay Hard",
    body: "Practice hard, perform hard. No coasting.",
  },
  {
    title: "Chop Some Wood",
    body: "Put in the work. Results come from reps.",
  },
  {
    title: "Hold Each Other Accountable",
    body: "If something's off, say it.",
  },
  {
    title: "Handle Disagreements Like Adults",
    body: "No politics, no drama.",
  },
  {
    title: "Overcommunicate",
    body: "On and off the court. Reduce assumption risk.",
  },
  {
    title: "Share Your Ideas",
    body: "Someone in this group can help make it happen.",
  },
];

const plans = [
  {
    name: "Monthly",
    price: "$55",
    unit: "/month",
    perSession: "$13.75",
    sessions: "4 sessions",
    method: "Monthly auto-pay via Venmo",
    tag: "Best Value",
    description:
      "Full commit. Best rate, most stability. For the guys who are locked in every week.",
  },
  {
    name: "10-Pack",
    price: "$150",
    unit: "/10 sessions",
    perSession: "$15.00",
    sessions: "10 sessions",
    method: "Prepaid lump sum via Venmo",
    tag: null,
    description:
      "Committed but flexible. Slightly higher per session in exchange for scheduling freedom.",
  },
  {
    name: "Guest / Drop-In",
    price: "$17",
    unit: "/session",
    perSession: "$17.00",
    sessions: "1 session",
    method: "Pay per session via Venmo",
    tag: null,
    description:
      "Full flex. Highest per-session rate. For those still figuring out their commitment level.",
  },
];

export default function JoinPage() {
  return (
    <main>
      {/* Header */}
      <div className="page-header">
        <Container>
          <ScrollReveal>
            <span className="kicker kicker-bright">A-Town Aura</span>
            <h1 className="page-title mt-3">Join the Program</h1>
            <p className="page-sub mt-3">
              A competitive, self-sustaining men&apos;s volleyball program. We
              fund it together, run it together, and get better together.
            </p>
            <div className="section-rule mt-8" />
          </ScrollReveal>
        </Container>
      </div>

      {/* Mission */}
      <section className="pb-16">
        <Container>
          <ScrollReveal>
            <span className="kicker">Mission</span>
            <div className="max-w-3xl">
              <p
                className="mt-4 text-lg leading-relaxed"
                style={{ color: "var(--ink-2)" }}
              >
We started A-Town Aura because we got tired of the alternative — inflated fees nobody can explain, lineups driven by politics instead of performance, and programs that don't respect the players keeping them alive. This is the fix. Player-run, fully transparent, and built by the guys in the gym.

              </p>
              <p
                className="mt-4 text-lg leading-relaxed"
                style={{ color: "var(--ink-2)" }}
              >
                The long-term goal is self-sustainability. We&apos;re building
                toward hosting our own tournaments, growing through social media
                and sponsorships, and leveraging the diverse skills within the
                group to reduce individual costs over time. We also support
                player development — nutritional guidance, strength programming,
                and skill work — all drawn from the collective experience of the
                roster.
              </p>
            </div>
          </ScrollReveal>

          <ScrollReveal delay={100}>
            <div className="section-rule mt-10" />
          </ScrollReveal>
        </Container>
      </section>

      {/* The Program */}
      <section className="pb-16">
        <Container>
          <ScrollReveal>
            <span className="kicker">The Program</span>
          </ScrollReveal>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
            {programCards.map((c, i) => (
              <ScrollReveal key={c.title} delay={80 * (i + 1)}>
                <div className="card" style={{ cursor: "default" }}>
                  <span className="kicker kicker-bright">{c.kicker}</span>
                  <div className="card-title mt-3">{c.title}</div>
                  <p className="card-sub mt-2">{c.body}</p>
                </div>
              </ScrollReveal>
            ))}
          </div>

          <ScrollReveal delay={400}>
            <div className="section-rule mt-10" />
          </ScrollReveal>
        </Container>
      </section>

      {/* Culture & Standards */}
      <section className="pb-16">
        <Container>
          <ScrollReveal>
            <span className="kicker">Culture</span>
          </ScrollReveal>
          <div className="mt-6 flex flex-col gap-4 max-w-3xl">
            {values.map((v, i) => (
              <ScrollReveal key={v.title} delay={60 * (i + 1)}>
                <div className="join-value">
                  <div className="join-value-title">{v.title}</div>
                  <div className="join-value-body">{v.body}</div>
                </div>
              </ScrollReveal>
            ))}
          </div>

          <ScrollReveal delay={450}>
            <div className="section-rule mt-10" />
          </ScrollReveal>
        </Container>
      </section>

      {/* Membership Options */}
      <section className="pb-16">
        <Container>
          <ScrollReveal>
            <span className="kicker">Membership Options</span>
            <h2 className="page-title mt-3">Pick How You Pay</h2>
            <p className="page-sub mt-2">
              More commitment, better rate. All applications are reviewed
              before confirmation.
            </p>
          </ScrollReveal>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
            {plans.map((p, i) => (
              <ScrollReveal key={p.name} delay={100 * (i + 1)}>
                <div className="join-plan-card">
                  {p.tag && <span className="join-plan-tag">{p.tag}</span>}
                  <div className="join-plan-name">{p.name}</div>
                  <div className="join-plan-price">
                    {p.price}
                    <span className="join-plan-unit">{p.unit}</span>
                  </div>
                  <div className="section-rule mt-4" />
                  <div className="mt-4 flex flex-col gap-2">
                    <div className="join-plan-detail">
                      <span className="kicker">Per Session</span>
                      <span className="join-plan-detail-value">
                        {p.perSession}
                      </span>
                    </div>
                    <div className="join-plan-detail">
                      <span className="kicker">Sessions</span>
                      <span className="join-plan-detail-value">
                        {p.sessions}
                      </span>
                    </div>
                    <div className="join-plan-detail">
                      <span className="kicker">Payment</span>
                      <span className="join-plan-detail-value">{p.method}</span>
                    </div>
                  </div>
                  <div className="section-rule mt-4" />
                  <p className="card-sub mt-4">{p.description}</p>
                </div>
              </ScrollReveal>
            ))}
          </div>

          <ScrollReveal delay={450}>
            <div className="section-rule mt-10" />
          </ScrollReveal>
        </Container>
      </section>

      {/* How to Join — CTA */}
      <section className="pb-20">
        <Container>
          <ScrollReveal>
            <span className="kicker kicker-bright">Ready?</span>
            <h2 className="page-title mt-3">How to Join</h2>
          </ScrollReveal>

          <div className="mt-8 flex flex-col gap-4 max-w-2xl">
            <ScrollReveal delay={80}>
              <div className="join-step">
                <span className="join-step-number">1</span>
                <div>
                  <div className="join-step-title">
                    Fill out the application
                  </div>
                  <p className="card-sub mt-1">Takes 2 minutes.</p>
                </div>
              </div>
            </ScrollReveal>

            <ScrollReveal delay={160}>
              <div className="join-step">
                <span className="join-step-number">2</span>
                <div>
                  <div className="join-step-title">
                    Send your first payment via Venmo
                  </div>
                  <p className="card-sub mt-1">
                    After you register, you'll receive a Venmo request. Accept
                    it to lock in your spot{" "}
                  </p>
                </div>
              </div>
            </ScrollReveal>

            <ScrollReveal delay={240}>
              <div className="join-step">
                <span className="join-step-number">3</span>
                <div>
                  <div className="join-step-title">Join the Discord server</div>
                  <p className="card-sub mt-1">
                    Turn notifications ON. This is where scheduling, film, and
                    team communication happens. <br></br>
                    <a
                      href="https://discord.gg/SAmCXyxcE5"
                      target="_blank"
                      style={{ color: "var(--accent-solid)" }}
                    >
                      Join Discord &rarr;
                    </a>
                  </p>
                </div>
              </div>
            </ScrollReveal>
          </div>

          <ScrollReveal delay={350}>
            <div className="mt-10">
              <Link href="/atownaura/membership/apply" className="btn btn-primary">
                Apply Now &rarr;
              </Link>
            </div>
          </ScrollReveal>
        </Container>
      </section>
    </main>
  );
}
