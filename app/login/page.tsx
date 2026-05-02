"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Logo } from "@/components/Logo";
import { PinModal } from "@/components/PinModal";
import { useRumbo } from "@/lib/store";
import {
  Profile,
  addCustomProfile,
  getAllProfiles,
  removeCustomProfile,
} from "@/lib/profiles";
import {
  checkPin,
  clearPin,
  isPinSet,
  markVerified,
  needsPinPrompt,
  setPin,
} from "@/lib/pin";

export default function LoginPage() {
  const router = useRouter();
  const { signIn, profile } = useRumbo();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [pendingProfile, setPendingProfile] = useState<Profile | null>(null);
  const [pinMode, setPinMode] = useState<"enter" | "create">("enter");
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");

  useEffect(() => {
    if (profile) router.replace("/today");
  }, [profile, router]);

  useEffect(() => {
    setProfiles(getAllProfiles());
  }, []);

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

  function createUser() {
    const name = newName.trim();
    if (!name) return;
    const created = addCustomProfile(name);
    setProfiles(getAllProfiles());
    setNewName("");
    setShowCreate(false);
    // Drop straight into PIN creation for the new user.
    setPendingProfile(created);
    setPinMode("create");
  }

  function deleteUser(p: Profile, e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm(`¿Borrar el usuario "${p.name}"? Sus datos locales se mantienen.`)) return;
    removeCustomProfile(p.id);
    clearPin(p.id);
    setProfiles(getAllProfiles());
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
          {profiles.map((p, i) => (
            <motion.button
              key={p.id}
              onClick={() => pick(p)}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.05 }}
              whileHover={{ y: -3 }}
              whileTap={{ scale: 0.98 }}
              className="card p-6 text-left hover:shadow-soft transition-shadow group relative"
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
              {p.email && (
                <div className="text-sm text-rumbo-muted">{p.email}</div>
              )}
              <div className="mt-4 text-sm text-rumbo-ink/70">
                Entrar como {p.name} →
              </div>
              {p.custom && (
                <button
                  onClick={(e) => deleteUser(p, e)}
                  className="absolute top-3 right-3 w-7 h-7 rounded-full bg-white border border-rumbo-line text-rumbo-muted hover:text-rose-600 hover:border-rose-200 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-sm"
                  aria-label="Borrar usuario"
                >
                  ✕
                </button>
              )}
            </motion.button>
          ))}

          <motion.button
            onClick={() => setShowCreate(true)}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + profiles.length * 0.05 }}
            whileHover={{ y: -3 }}
            whileTap={{ scale: 0.98 }}
            className="card p-6 text-left border-2 border-dashed border-rumbo-line hover:border-rumbo-ink/30 hover:shadow-soft transition-all flex flex-col items-start justify-center min-h-[200px]"
          >
            <div className="w-16 h-16 rounded-2xl bg-rumbo-ink/5 border border-rumbo-line flex items-center justify-center text-3xl text-rumbo-muted">
              +
            </div>
            <div className="mt-4 text-xl font-semibold">Nuevo usuario</div>
            <div className="text-sm text-rumbo-muted mt-1">
              Crea tu propio perfil con nombre y PIN.
            </div>
          </motion.button>
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

      <AnimatePresence>
        {showCreate && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center px-4"
            onClick={() => setShowCreate(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 12 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-3xl shadow-xl p-8 w-full max-w-sm"
            >
              <h2 className="text-xl font-semibold tracking-tight">
                Crea tu usuario
              </h2>
              <p className="text-sm text-rumbo-muted mt-1">
                Solo tu nombre. Después elegirás un PIN de 4 dígitos.
              </p>
              <input
                autoFocus
                className="input mt-5 w-full"
                placeholder="Tu nombre"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") createUser();
                  if (e.key === "Escape") setShowCreate(false);
                }}
                maxLength={24}
              />
              <div className="flex gap-2 mt-5 justify-end">
                <button
                  className="btn-ghost"
                  onClick={() => setShowCreate(false)}
                >
                  Cancelar
                </button>
                <button
                  className="btn-primary"
                  onClick={createUser}
                  disabled={!newName.trim()}
                >
                  Crear y poner PIN →
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
