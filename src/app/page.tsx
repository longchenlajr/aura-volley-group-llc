import Image from "next/image";
import Container from "@/components/Container";
import { drops } from "@/content/drops";
import LandingActions from "@/components/LandingActions";

export default function Home() {
  const drop = drops[0];

  return (
    <main className="landing">
      <section className="landing-grid">
        {/* TOP (kicker) */}
        {/* <div className="landing-top">
          <Container>
            <div className="flex justify-center">
              <div className="landing-kicker">Aura Volley Group LLC</div>
            </div>
          </Container>
        </div> */}

        {/* CENTER (logo + headline + actions) */}
        <div className="landing-center">
          <Container>
            <div className="flex flex-col items-center text-center">
              {/* logo */}
              <div className="mt-0 relative">
                {" "}
                {/* was mt-2 */}
                <div
                  className="absolute inset-0 -z-10"
                  style={{
                    filter: "blur(32px)",
                    background:
                      "radial-gradient(circle at 50% 50%, rgba(160,120,255,0.20), transparent 60%)",
                    transform: "scale(1.35)",
                  }}
                />
                <Image
                  src="/img/logo1.png"
                  alt="Aura Volley Group"
                  width={1536 / 7}
                  height={1024 / 7}
                  priority
                />
              </div>

              {/* headline */}
              <h1
                className="mt-6"
                style={{
                  fontFamily: '"EastmanGrotesque", system-ui, sans-serif',
                  fontSize: "clamp(2.0rem, 4vw, 3.0rem)",
                  fontWeight: 500,
                  letterSpacing: "-0.02em",
                }}
              >
                Form before noise.
              </h1>

              <p
                className="mt-5 landing-muted max-w-xl"
                style={{
                  fontFamily: '"EastmanGrotesque", system-ui, sans-serif',
                  fontSize: "1.02rem",
                  lineHeight: 1.7,
                }}
              >
                Volleyball essentials, reduced to their core.
              </p>

              {/* actions */}
              <div className="mt-8">
                <LandingActions
                  dropName={drop.name}
                  dropHref={`/drops/${drop.slug}`}
                />
              </div>

              {/* divider */}
              <div className="mt-10 w-full max-w-3xl">
                <div
                  style={{
                    height: 1,
                    background:
                      "linear-gradient(to right, transparent, rgba(0,0,0,0.14), transparent)",
                  }}
                />
              </div>
            </div>
          </Container>
        </div>

        {/* BOTTOM (footer pinned) */}
        <div className="landing-bottom">
          <Container>
            <div className="landing-footer">
              © {new Date().getFullYear()} Aura Volley Group LLC
            </div>
          </Container>
        </div>
      </section>
    </main>
  );
}
