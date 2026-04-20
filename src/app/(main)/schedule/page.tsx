"use client";

import Container from "@/components/Container";
import ScrollReveal from "@/components/ScrollReveal";
import { events, getEventStatus } from "@/content/events";

export default function SchedulePage() {
  const upcoming = events
    .filter((e) => getEventStatus(e) === "upcoming")
    .sort((a, b) => a.date.localeCompare(b.date));
  const completed = events
    .filter((e) => getEventStatus(e) === "completed")
    .sort((a, b) => b.date.localeCompare(a.date));

  return (
    <main>
      <div className="page-header">
        <Container>
          <ScrollReveal>
            <span className="kicker kicker-bright">A-Town Aura</span>
            <h1 className="page-title mt-3">Schedule</h1>
            <p className="page-sub mt-3">
              Practice dates, tournament schedule, and team events for the
              current season.
            </p>
            <div className="section-rule mt-8" />
          </ScrollReveal>
        </Container>
      </div>

      {upcoming.length > 0 && (
        <section className="pb-12">
          <Container>
            <ScrollReveal>
              <span className="kicker">Upcoming</span>
            </ScrollReveal>
            <div className="mt-4 flex flex-col gap-4">
              {upcoming.map((evt, i) => {
                const d = new Date(evt.date + "T00:00:00");
                const month = d.toLocaleString("en-US", { month: "short" });
                const day = d.getDate();

                return (
                  <ScrollReveal key={evt.id} delay={i * 80}>
                    <div className="event-card">
                      <div className="event-date-block">
                        <div className="event-date-month">{month}</div>
                        <div className="event-date-day">{day}</div>
                      </div>
                      <div>
                        <div className="card-title">{evt.name}</div>
                        <div className="card-sub mt-1">{evt.location}</div>
                        <div
                          className="card-sub mt-2"
                          style={{ fontSize: "0.85rem" }}
                        >
                          {evt.description}
                        </div>
                      </div>
                      <div className="event-badge upcoming">
                        <span className="dot" />
                        Upcoming
                      </div>
                    </div>
                  </ScrollReveal>
                );
              })}
            </div>
          </Container>
        </section>
      )}

      {completed.length > 0 && (
        <section className="pb-20">
          <Container>
            <ScrollReveal>
              <div className="section-rule" />
              <span className="kicker mt-8 block">Past Events</span>
            </ScrollReveal>
            <div className="mt-4 flex flex-col gap-4">
              {completed.map((evt, i) => {
                const d = new Date(evt.date + "T00:00:00");
                const month = d.toLocaleString("en-US", { month: "short" });
                const day = d.getDate();

                return (
                  <ScrollReveal key={evt.id} delay={i * 80}>
                    <div className="event-card" style={{ opacity: 0.7 }}>
                      <div className="event-date-block">
                        <div
                          className="event-date-month"
                          style={{ color: "var(--muted)" }}
                        >
                          {month}
                        </div>
                        <div className="event-date-day">{day}</div>
                      </div>
                      <div>
                        <div className="card-title">{evt.name}</div>
                        <div className="card-sub mt-1">{evt.location}</div>
                        <div
                          className="card-sub mt-2"
                          style={{ fontSize: "0.85rem" }}
                        >
                          {evt.description}
                        </div>
                      </div>
                      <div className="event-badge completed">Completed</div>
                    </div>
                  </ScrollReveal>
                );
              })}
            </div>
          </Container>
        </section>
      )}
    </main>
  );
}
