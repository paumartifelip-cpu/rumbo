"use client";

import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Logo } from "@/components/Logo";
import { PinModal } from "@/components/PinModal";
import { useRumbo } from "@/lib/store";
import { PROFILES, Profile } from "@/lib/profiles";
import {
  checkPin,
  isPinSet,
  markVerified,
  needsPinPrompt,
  setPin,
} from "@/lib/pin";

export default function LoginPage() {
  const router = useRouter();
  const { signIn, profile } = useRumbo();
  const [pendingProfile, setPendingProfile] = useState<Profile | null>(null);
  const [pinMode, setPinMode] = useState<"enter" | "create">("enter");

  useEffect(() => {
    if (profile) router.replace("/today");
  }, [profile, router]);

  function pick(p: Profile) {
    if (!isPinSet(p.id)) {
      setPendingProfile(p);
      setPinMode("create");
      return;
    }
    if (needsPinPrompt(p.id)) {
      setPendingProfile(p);
      setPinMode("enter");
      return;
    }
    enter(p);
  }

  function enter(p: Profile) {
    markVerified(p.id);
    signIn(p.id);
    router.push("/today");
  }

  function handlePinSuccess(pin: string) {
    if (!pendingProfile) return;
    if (pinMode === "create") {
      setPin(pendingProfile.id, pin);
    } else {
      markVerified(pendingProfile.id);
    }
    enter(pendingProfile);
    setPendingProfile(null);
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="px-6 md:px-10 py-6 flex items-center justify-between">
        <Logo size="md" />
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-6 pb-16">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-10"
        >
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">
            ¿Quién eres?
          </h1>
          <p className="text-rumbo-muted mt-2">
            Elige tu sesión para continuar.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-xl">
          {PROFILES.map((p, i) => (
            <motion.button
              key={p.id}
              onClick={() => pick(p)}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.05 }}
              whileHover={{ y: -3 }}
              whileTap={{ scale: 0.98 }}
              className="card p-6 text-left hover:shadow-soft transition-shadow"
            >
              <div
                className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${p.color} flex items-center justify-center text-2xl font-semibold text-white shadow-soft`}
              >
                {p.initials}
              </div>
              <div className="mt-4 text-xl font-semibold flex items-center gap-2">
                {p.name}
                {isPinSet(p.id) && (
                  <span title="Protegido con PIN" className="text-rumbo-muted text-base">
                    🔒
                  </span>
                )}
              </div>
              <div className="text-sm text-rumbo-muted">{p.email}</div>
              <div className="mt-4 text-sm text-rumbo-ink/70">
                Entrar como {p.name} →
              </div>
            </motion.button>
          ))}
        </div>

        <p className="text-xs text-rumbo-muted mt-10 max-w-md text-center">
          Cada sesión tiene su PIN. Si pasan 7 días sin entrar te lo pediremos
          de nuevo. Mientras lo uses a menudo, entrarás directo.
        </p>
      </main>

      {pendingProfile && (
        <PinModal
          profile={pendingProfile}
          mode={pinMode}
          onSuccess={handlePinSuccess}
          onCancel={() => setPendingProfile(null)}
          verify={(pin) => checkPin(pendingProfile.id, pin)}
        />
      )}
    </div>
  );
}
