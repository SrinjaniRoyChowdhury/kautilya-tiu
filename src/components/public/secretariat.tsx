import { Card } from "@/components/ui/card";
import {
  CLUB_NAME,
  EVENT_EDITION,
  EVENT_NAME,
  HOST_UNIVERSITY,
  type CoreOfficer,
  type UsgDepartment,
} from "@/lib/team";

function Names({ names, className }: { names: string[]; className: string }) {
  return (
    <p className={className}>
      {names.map((name, index) => (
        <span key={`${name}-${index}`}>
          {index > 0 ? <span className="mx-3 font-serif text-[0.65em] text-gold-400">&</span> : null}
          {name}
        </span>
      ))}
    </p>
  );
}

function OfficerCard({ officer, featured = false }: { officer: CoreOfficer; featured?: boolean }) {
  return (
    <Card className={featured ? "sm:col-span-2 lg:col-span-3" : undefined}>
      <h3 className="text-xs font-semibold uppercase tracking-[0.22em] text-gold-700">{officer.role}</h3>
      <Names
        names={officer.names}
        className={`mt-3 font-serif font-semibold text-ink ${featured ? "text-4xl sm:text-5xl" : "text-2xl"}`}
      />
    </Card>
  );
}

export function SecretariatRoster({ core, usgs }: { core: CoreOfficer[]; usgs: UsgDepartment[] }) {
  const [secretaryGeneral, ...rest] = core;
  return (
    <div className="grid gap-14">
      <header className="max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-gold-700">
          {CLUB_NAME} · {HOST_UNIVERSITY}
        </p>
        <h1 className="mt-3 font-serif text-4xl font-semibold tracking-tight text-gold-gradient sm:text-6xl">
          {EVENT_NAME} {EVENT_EDITION}
        </h1>
        <p className="mt-4 max-w-xl text-base text-ink-muted">
          The Annual Model United Nations Conference of {HOST_UNIVERSITY}.
        </p>
      </header>

      <section aria-labelledby="core-heading">
        <h2 id="core-heading" className="font-serif text-2xl text-gold-700">
          Core Secretariat
        </h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {secretaryGeneral ? <OfficerCard officer={secretaryGeneral} featured /> : null}
          {rest.map((officer) => (
            <OfficerCard key={officer.id} officer={officer} />
          ))}
        </div>
      </section>

      <section aria-labelledby="usg-heading">
        <h2 id="usg-heading" className="font-serif text-2xl text-gold-700">
          Under-Secretary-General Departments
        </h2>
        <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {usgs.map((department) => (
            <li key={department.id}>
              <Card className="h-full py-5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-gold-700">USG</p>
                <p className="mt-2 font-serif text-xl text-ink">{department.title}</p>
                {department.names.length ? (
                  <Names names={department.names} className="mt-3 font-serif text-lg text-ink" />
                ) : null}
              </Card>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
