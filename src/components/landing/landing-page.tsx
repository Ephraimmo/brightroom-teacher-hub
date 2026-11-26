import { Link } from "@tanstack/react-router";
import {
  BookOpenCheck,
  Building2,
  ClipboardCheck,
  GraduationCap,
  HeartHandshake,
  Mail,
  MapPin,
  MessageCircle,
  MonitorSmartphone,
  PenLine,
  Phone,
  ShieldCheck,
  Users,
  Wifi,
  type LucideIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { CONTACT, hasContact, type SiteContact } from "@/config/site";

const audiences: { icon: LucideIcon; title: string; text: string }[] = [
  {
    icon: Building2,
    title: "Schools and tutoring centres",
    text: "Register learners, organise classes and subjects, and see attendance and results across the school.",
  },
  {
    icon: PenLine,
    title: "Teachers",
    text: "Teach the learners in front of you and those at home in the same lesson, then set and mark work in one place.",
  },
  {
    icon: GraduationCap,
    title: "Learners",
    text: "Join lessons, open notes, hand in homework and write tests from a phone, tablet or computer.",
  },
  {
    icon: HeartHandshake,
    title: "Parents and guardians",
    text: "Follow each child's attendance, homework and results, and manage each child's subscription separately.",
  },
];

const features: { icon: LucideIcon; title: string; text: string }[] = [
  {
    icon: MonitorSmartphone,
    title: "Hybrid live lessons",
    text: "One lesson for the classroom and for learners joining online, with one room microphone so nobody hears echo.",
  },
  {
    icon: PenLine,
    title: "Shared whiteboard",
    text: "Teachers write on the board or on an uploaded question paper, and learners see it as it happens.",
  },
  {
    icon: ClipboardCheck,
    title: "Homework, tests and results",
    text: "Set work, collect submissions, run timed tests that save as learners go, and publish results when ready.",
  },
  {
    icon: Users,
    title: "A subscription per child",
    text: "Each child has their own plan and payment history. Paying for one child never changes another child's access.",
  },
  {
    icon: Wifi,
    title: "Designed for South African connections",
    text: "Light pages and a data-saver mode for lessons, so learners on mobile data can still take part.",
  },
  {
    icon: ShieldCheck,
    title: "Private by design",
    text: "Each school's records are kept apart, parents only see their own children, and consent is recorded under POPIA.",
  },
];

const steps = [
  {
    title: "The school joins",
    text: "We set up the school, its classes and subjects, and invite its teachers.",
  },
  {
    title: "Learners are added",
    text: "The school registers learners and gives each family a code to link to their child.",
  },
  {
    title: "Families link and choose a plan",
    text: "Parents link each child with their code and choose a plan for each one.",
  },
];

const plans = [
  { name: "Monthly", text: "Pay month by month for one learner." },
  { name: "Term", text: "Cover one school term for one learner." },
  { name: "Annual", text: "Cover the whole school year for one learner." },
  { name: "Schools", text: "A package for the whole school, arranged with us." },
];

function whatsappHref(number: string) {
  return `https://wa.me/${number.replace(/\D/g, "")}`;
}

export function LandingPage({ contact = CONTACT }: { contact?: SiteContact | null }) {
  const showContact = hasContact(contact);

  const navLinks = [
    { href: "#features", label: "Features" },
    { href: "#how-it-works", label: "How it works" },
    { href: "#plans", label: "Plans" },
    ...(showContact ? [{ href: "#contact", label: "Contact" }] : []),
  ];

  const schoolCta = showContact ? (
    <Button variant="outline" size="lg" asChild>
      <a href="#contact">Register your school</a>
    </Button>
  ) : (
    <Button variant="outline" size="lg" asChild>
      <Link to="/auth" search={{ mode: "sign-up" }}>
        Register your school
      </Link>
    </Button>
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link
            to="/"
            className="flex items-center gap-2.5 font-bold"
            aria-label="LearnBridge home"
          >
            <span className="grid size-8 place-items-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
              <GraduationCap className="size-[18px]" aria-hidden="true" />
            </span>
            LearnBridge
          </Link>
          <nav aria-label="Page sections" className="hidden items-center gap-6 md:flex">
            {navLinks.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="text-sm font-medium text-muted-foreground hover:text-foreground"
              >
                {l.label}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild>
              <Link to="/auth">Sign in</Link>
            </Button>
            <Button size="sm" asChild>
              <Link to="/auth" search={{ mode: "sign-up" }}>
                Create account
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <main>
        <section className="bg-sidebar text-sidebar-foreground">
          <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 md:py-24 lg:grid-cols-[1.2fr_1fr] lg:items-center">
            <div>
              <p className="mb-4 inline-flex items-center gap-2 rounded-full bg-sidebar-accent px-3 py-1 text-xs font-semibold text-sidebar-accent-foreground">
                <span className="size-2 rounded-full bg-sidebar-primary" aria-hidden="true" />
                In development · pilot schools and families welcome
              </p>
              <h1 className="text-4xl font-bold leading-tight sm:text-5xl">
                One lesson, in the classroom and online.
              </h1>
              <p className="mt-5 max-w-xl text-base leading-relaxed text-sidebar-foreground/80 sm:text-lg">
                LearnBridge brings schools, teachers, learners and parents together: live hybrid
                lessons, homework, tests and results, with a separate subscription for every child.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button
                  size="lg"
                  className="bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary/90"
                  asChild
                >
                  <Link to="/auth" search={{ mode: "sign-up" }}>
                    Create a family account
                  </Link>
                </Button>
                <div className="[&_a]:border-sidebar-border [&_a]:bg-transparent [&_a]:text-sidebar-foreground [&_a:hover]:bg-sidebar-accent">
                  {schoolCta}
                </div>
              </div>
              <p className="mt-5 text-sm text-sidebar-foreground/75">
                Already have an account?{" "}
                <Link
                  to="/auth"
                  className="font-semibold text-sidebar-primary underline-offset-4 hover:underline"
                >
                  Sign in
                </Link>
              </p>
            </div>
            <ul className="grid gap-3 sm:grid-cols-2" aria-label="Who LearnBridge is for">
              {audiences.map(({ icon: Icon, title }) => (
                <li
                  key={title}
                  className="flex items-center gap-3 rounded-lg border border-sidebar-border bg-sidebar-accent p-4"
                >
                  <Icon className="size-5 shrink-0 text-sidebar-primary" aria-hidden="true" />
                  <span className="text-sm font-semibold">{title}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section aria-labelledby="audiences-title" className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <h2 id="audiences-title" className="text-2xl font-bold sm:text-3xl">
            Everyone in one place
          </h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {audiences.map(({ icon: Icon, title, text }) => (
              <article key={title} className="rounded-lg border bg-card p-5">
                <Icon className="size-6 text-primary" aria-hidden="true" />
                <h3 className="mt-3 text-base font-semibold">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{text}</p>
              </article>
            ))}
          </div>
        </section>

        <section
          id="features"
          aria-labelledby="features-title"
          className="scroll-mt-20 bg-muted/60"
        >
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
            <h2 id="features-title" className="text-2xl font-bold sm:text-3xl">
              What LearnBridge is built to do
            </h2>
            <p className="mt-3 max-w-2xl text-muted-foreground">
              LearnBridge is being built and tested with pilot schools. These are the features it is
              designed around.
            </p>
            <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {features.map(({ icon: Icon, title, text }) => (
                <article key={title} className="rounded-lg border bg-card p-5">
                  <span className="grid size-10 place-items-center rounded-lg bg-secondary text-primary">
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                  <h3 className="mt-4 text-base font-semibold">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section
          id="how-it-works"
          aria-labelledby="how-title"
          className="mx-auto max-w-6xl scroll-mt-20 px-4 py-16 sm:px-6"
        >
          <h2 id="how-title" className="text-2xl font-bold sm:text-3xl">
            How it works
          </h2>
          <ol className="mt-8 grid gap-4 md:grid-cols-3">
            {steps.map((step, i) => (
              <li key={step.title} className="rounded-lg border bg-card p-5">
                <span className="grid size-8 place-items-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                  {i + 1}
                </span>
                <h3 className="mt-4 text-base font-semibold">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.text}</p>
              </li>
            ))}
          </ol>
        </section>

        <section id="plans" aria-labelledby="plans-title" className="scroll-mt-20 bg-muted/60">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
            <h2 id="plans-title" className="text-2xl font-bold sm:text-3xl">
              Plans
            </h2>
            <p className="mt-3 max-w-2xl text-muted-foreground">
              Every plan is for one learner, so each child has their own subscription. Prices will
              be published before launch.
            </p>
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {plans.map((plan) => (
                <article key={plan.name} className="flex flex-col rounded-lg border bg-card p-5">
                  <h3 className="text-lg font-semibold">{plan.name}</h3>
                  <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">
                    {plan.text}
                  </p>
                  <p className="mt-4 text-sm font-semibold text-primary">Pricing coming soon</p>
                </article>
              ))}
            </div>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild>
                <Link to="/auth" search={{ mode: "sign-up" }}>
                  Create an account
                </Link>
              </Button>
              {showContact ? (
                <Button variant="outline" asChild>
                  <a href="#contact">Ask about school packages</a>
                </Button>
              ) : null}
            </div>
          </div>
        </section>

        {showContact ? <ContactSection contact={contact} /> : null}
      </main>

      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p className="flex items-center gap-2">
            <BookOpenCheck className="size-4" aria-hidden="true" />© {new Date().getFullYear()}{" "}
            LearnBridge
          </p>
          <nav aria-label="Footer" className="flex flex-wrap gap-5">
            <Link to="/auth" className="hover:text-foreground">
              Sign in
            </Link>
            <Link to="/auth" search={{ mode: "sign-up" }} className="hover:text-foreground">
              Create account
            </Link>
            {showContact ? (
              <a href="#contact" className="hover:text-foreground">
                Contact
              </a>
            ) : null}
          </nav>
        </div>
      </footer>
    </div>
  );
}

function ContactSection({ contact }: { contact: SiteContact }) {
  const items: { icon: LucideIcon; label: string; value: string; href?: string }[] = [];
  if (contact.email) {
    items.push({
      icon: Mail,
      label: "Email",
      value: contact.email,
      href: `mailto:${contact.email}`,
    });
  }
  if (contact.phone) {
    items.push({
      icon: Phone,
      label: "Phone",
      value: contact.phone,
      href: `tel:${contact.phone.replace(/[^\d+]/g, "")}`,
    });
  }
  if (contact.whatsapp) {
    items.push({
      icon: MessageCircle,
      label: "WhatsApp",
      value: "Message us on WhatsApp",
      href: whatsappHref(contact.whatsapp),
    });
  }
  if (contact.location) {
    items.push({ icon: MapPin, label: "Where we are", value: contact.location });
  }

  return (
    <section
      id="contact"
      aria-labelledby="contact-title"
      className="mx-auto max-w-6xl scroll-mt-20 px-4 py-16 sm:px-6"
    >
      <h2 id="contact-title" className="text-2xl font-bold sm:text-3xl">
        Talk to us
      </h2>
      <p className="mt-3 max-w-2xl text-muted-foreground">
        Want LearnBridge for your school, or to join the pilot? Get in touch and we'll set it up
        with you.
      </p>
      <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {items.map(({ icon: Icon, label, value, href }) => (
          <li key={label} className="rounded-lg border bg-card p-5">
            <Icon className="size-5 text-primary" aria-hidden="true" />
            <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {label}
            </p>
            {href ? (
              <a
                href={href}
                className="mt-1 block break-words font-semibold text-foreground underline-offset-4 hover:underline"
                {...(href.startsWith("https://")
                  ? { target: "_blank", rel: "noopener noreferrer" }
                  : {})}
              >
                {value}
              </a>
            ) : (
              <p className="mt-1 font-semibold">{value}</p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
