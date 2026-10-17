"use client";

import { useState, type FormEvent } from "react";
import Image from "next/image";
import ConsultCityField from "@/components/home/ConsultCityField";
import ConsultDateField from "@/components/home/ConsultDateField";
import Reveal from "@/components/ui/Reveal";
import { useT } from "@/i18n";

const CONTACT_EMAIL = "wesalplatform.gaza@gmail.com";

const TOPICS = ["hall", "planning", "services", "issue", "other"] as const;
const CITIES = ["gazaStrip", "north", "gaza", "middle", "south"] as const;

type TopicId = (typeof TOPICS)[number];

function FieldLabel({ label, id }: { label: string; id?: string }) {
  return (
    <span id={id} className="mb-2 block text-sm font-semibold text-[var(--wesal-text)]">
      {label}
    </span>
  );
}

export default function ConsultSection() {
  const t = useT();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [topic, setTopic] = useState<TopicId>("planning");
  const [date, setDate] = useState("");
  const [city, setCity] = useState("gazaStrip");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    const trimmedMessage = message.trim();
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail);

    if (!trimmedName || !emailOk || !trimmedMessage) {
      setError(t("home.consult.error"));
      return;
    }

    setError("");
    const cityLabel = t(`home.consult.city.${city}`);
    const topicLabel = t(`home.consult.topic.${topic}`);
    const body = [
      `${t("home.consult.name")}: ${trimmedName}`,
      `${t("home.consult.email")}: ${trimmedEmail}`,
      `${t("home.consult.topicLabel")}: ${topicLabel}`,
      date ? `${t("home.consult.date")}: ${date}` : "",
      `${t("home.consult.city")}: ${cityLabel}`,
      "",
      trimmedMessage,
    ]
      .filter(Boolean)
      .join("\n");

    window.location.href = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(topicLabel)}&body=${encodeURIComponent(body)}`;
  }

  return (
    <section
      id="consult"
      className="consult-section relative scroll-mt-20 py-10 sm:py-14"
      aria-labelledby="consult-heading"
    >
      <h2 id="consult-heading" className="sr-only">
        {t("home.consult.topicLabel")}
      </h2>
      <div className="container-wesal">
        <Reveal>
          <div className="consult-layout">
            <form className="consult-form" onSubmit={onSubmit} noValidate>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <FieldLabel label={t("home.consult.name")} />
                  <input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder={t("home.consult.namePlaceholder")}
                    autoComplete="name"
                    required
                    className="consult-input"
                  />
                </label>
                <label className="block">
                  <FieldLabel label={t("home.consult.email")} />
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="example@email.com"
                    autoComplete="email"
                    dir="ltr"
                    required
                    className="consult-input text-left"
                  />
                </label>
              </div>

              <fieldset className="mt-6">
                <legend className="mb-3 text-sm font-semibold text-[var(--wesal-text)]">
                  {t("home.consult.topicLabel")}
                </legend>
                <div className="consult-topics">
                  {TOPICS.map((id) => (
                    <button
                      key={id}
                      type="button"
                      className={topic === id ? "consult-chip is-active" : "consult-chip"}
                      aria-pressed={topic === id}
                      onClick={() => setTopic(id)}
                    >
                      {t(`home.consult.topic.${id}`)}
                    </button>
                  ))}
                </div>
              </fieldset>

              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <FieldLabel label={t("home.consult.date")} />
                  <ConsultDateField value={date} onChange={setDate} />
                </label>
                <div className="block">
                  <FieldLabel id="consult-city-label" label={t("home.consult.city")} />
                  <ConsultCityField
                    labelId="consult-city-label"
                    value={city}
                    options={CITIES.map((id) => ({
                      id,
                      label: t(`home.consult.city.${id}`),
                    }))}
                    onChange={setCity}
                  />
                </div>
              </div>

              <label className="mt-6 block">
                <FieldLabel label={t("home.consult.message")} />
                <textarea
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  placeholder={t("home.consult.messagePlaceholder")}
                  required
                  rows={5}
                  className="consult-input min-h-32 resize-y"
                />
              </label>

              {error ? (
                <p className="mt-3 text-sm text-[var(--wesal-maroon-dark)]" role="alert">
                  {error}
                </p>
              ) : null}

              <button type="submit" className="consult-submit">
                {t("home.consult.submit")}
                <span aria-hidden="true">▶</span>
              </button>
            </form>

            <aside className="consult-aside">
              <Image
                src="/home/consult-still.jpg"
                alt={t("home.consult.imageAlt")}
                width={1152}
                height={864}
                className="consult-photo"
              />
              <p className="mt-5 text-center text-sm leading-7 text-[var(--wesal-text)]/80">
                {t("home.consult.promise")}
              </p>
              <ul className="mt-6 space-y-5">
                <li className="consult-point">
                  <span className="consult-point-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none">
                      <rect x="4" y="5" width="16" height="14" rx="2" stroke="currentColor" strokeWidth="1.6" />
                      <path d="M8 3.5v3M16 3.5v3M4 9.5h16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                    </svg>
                  </span>
                  <div>
                    <p className="font-bold text-[var(--wesal-text)]">{t("home.consult.point1.title")}</p>
                    <p className="mt-1 text-sm leading-6 text-[var(--wesal-muted)]">
                      {t("home.consult.point1.desc")}
                    </p>
                  </div>
                </li>
                <li className="consult-point">
                  <span className="consult-point-icon consult-point-icon--rose" aria-hidden="true">
                    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none">
                      <circle cx="12" cy="12" r="7.5" stroke="currentColor" strokeWidth="1.6" />
                      <path d="M12 8.5V12l2.5 1.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                    </svg>
                  </span>
                  <div>
                    <p className="font-bold text-[var(--wesal-text)]">{t("home.consult.point2.title")}</p>
                    <p className="mt-1 text-sm leading-6 text-[var(--wesal-muted)]">
                      {t("home.consult.point2.desc")}
                    </p>
                  </div>
                </li>
                <li className="consult-point">
                  <span className="consult-point-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none">
                      <path
                        d="M12 21s6-5.2 6-10a6 6 0 1 0-12 0c0 4.8 6 10 6 10Z"
                        stroke="currentColor"
                        strokeWidth="1.6"
                      />
                      <circle cx="12" cy="11" r="1.8" stroke="currentColor" strokeWidth="1.6" />
                    </svg>
                  </span>
                  <div>
                    <p className="font-bold text-[var(--wesal-text)]">{t("home.consult.point3.title")}</p>
                    <p className="mt-1 text-sm leading-6 text-[var(--wesal-muted)]">
                      {t("home.consult.point3.desc")}
                    </p>
                  </div>
                </li>
              </ul>
            </aside>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
