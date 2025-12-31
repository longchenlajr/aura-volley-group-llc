import Container from "./Container";

export default function PageHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="pt-14 pb-10">
      <Container>
        <div className="max-w-2xl">
          <h1 className="text-3xl sm:text-4xl font-medium tracking-tight text-white/90">
            {title}
          </h1>
          {subtitle ? (
            <p className="mt-3 text-sm leading-7 text-white/60">{subtitle}</p>
          ) : null}
        </div>
      </Container>
    </div>
  );
}
