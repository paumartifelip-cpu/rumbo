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
    <div className="min-h-screen flex flex-col bg-white">
      <header className="px-6 md:px-10 py-6">
        <Logo size="md" />
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-6 pb-16">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <h1 className="text-4xl md:text-5xl font-semibold tracking-tight">
            ¿Quién eres?
          </h1>
          <p className="text-rumbo-muted mt-3">
            Elige tu perfil para continuar.
          </p>
        </motion.div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6 md:gap-8 w-full max-w-4xl">
          {profiles.map((p, i) => (
            <ProfileCard
              key={p.id}
              profile={p}
              index={i}
              onPick={() => pick(p)}
              onDelete={(e) => deleteUser(p, e)}
            />
          ))}

          <CreateCard
            index={profiles.length}
            onClick={() => setShowCreate(true)}
          />
        </div>

        <p className="text-xs text-rumbo-muted mt-12 max-w-md text-center">
          Cada perfil tiene su PIN. Si pasan 7 días sin entrar te lo pediremos
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
                Crea tu perfil
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

function ProfileCard({
  profile,
  index,
  onPick,
  onDelete,
}: {
  profile: Profile;
  index: number;
  onPick: () => void;
  onDelete: (e: React.MouseEvent) => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.08 + index * 0.05 }}
      className="flex flex-col items-center group"
    >
      <motion.button
        onClick={onPick}
        whileHover={{ scale: 1.08, y: -6 }}
        whileTap={{ scale: 0.96 }}
        transition={{ type: "spring", stiffness: 280, damping: 18 }}
        className={`relative w-32 h-32 md:w-40 md:h-40 rounded-3xl bg-gradient-to-br ${profile.color}
          flex items-center justify-center shadow-soft
          group-hover:shadow-card group-hover:ring-4 group-hover:ring-rumbo-ink/10
          transition-shadow ring-0 cursor-pointer`}
        aria-label={`Entrar como ${profile.name}`}
      >
        <span className="text-6xl md:text-7xl select-none drop-shadow-sm">
          {profile.emoji ?? profile.initials}
        </span>
        {isPinSet(profile.id) && (
          <span
            title="Protegido con PIN"
            className="absolute bottom-2 right-2 bg-white/95 rounded-full w-8 h-8 flex items-center justify-center text-sm shadow-card"
          >
            🔒
          </span>
        )}
        {profile.custom && (
          <button
            onClick={onDelete}
            className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-white border border-rumbo-line text-rumbo-muted hover:text-rose-600 hover:border-rose-200 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-sm shadow-card"
            aria-label="Borrar perfil"
          >
            ✕
          </button>
        )}
      </motion.button>
      <div className="mt-4 text-lg font-semibold text-rumbo-ink">
        {profile.name}
      </div>
      <button
        onClick={onPick}
        className="mt-2 px-5 py-1.5 rounded-full bg-rumbo-ink text-white text-sm font-medium opacity-90 hover:opacity-100 group-hover:bg-rumbo-green transition-colors"
      >
        Entrar →
      </button>
    </motion.div>
  );
}

function CreateCard({
  index,
  onClick,
}: {
  index: number;
  onClick: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.08 + index * 0.05 }}
      className="flex flex-col items-center group"
    >
      <motion.button
        onClick={onClick}
        whileHover={{ scale: 1.08, y: -6 }}
        whileTap={{ scale: 0.96 }}
        transition={{ type: "spring", stiffness: 280, damping: 18 }}
        className="relative w-32 h-32 md:w-40 md:h-40 rounded-3xl border-2 border-dashed border-rumbo-line bg-rumbo-greenSoft/30 flex items-center justify-center cursor-pointer group-hover:border-rumbo-green/50 group-hover:bg-rumbo-greenSoft/60 transition-colors"
        aria-label="Crear nuevo perfil"
      >
        <span className="text-6xl md:text-7xl text-rumbo-muted group-hover:text-rumbo-green transition-colors">
          +
        </span>
      </motion.button>
      <div className="mt-4 text-lg font-semibold text-rumbo-ink">
        Nuevo perfil
      </div>
      <button
        onClick={onClick}
        className="mt-2 px-5 py-1.5 rounded-full border border-rumbo-line text-rumbo-ink text-sm font-medium hover:bg-rumbo-ink hover:text-white transition-colors"
      >
        Crear →
      </button>
    </motion.div>
  );
}
