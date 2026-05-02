"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Profile } from "@/lib/profiles";

type Mode = "enter" | "create";

export function PinModal({
  profile,
  mode,
  onSuccess,
  onCancel,
  verify,
}: {
  profile: Profile;
  mode: Mode;
  onSuccess: (pin: string) => void;
  onCancel: () => void;
  verify?: (pin: string) => boolean;
}) {
  const [step, setStep] = useState<"first" | "confirm">("first");
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [shake, setShake] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, [step, mode]);

  const current = step === "first" ? pin : confirmPin;
  const setCurrent = step === "first" ? setPin : setConfirmPin;

  function handleChange(v: string) {
    const cleaned = v.replace(/\D/g, "").slice(0, 4);
    setCurrent(cleaned);
    setError(null);

    if (cleaned.length === 4) {
      setTimeout(() => submit(cleaned), 80);
    }
  }

  function submit(value: string) {
    if (mode === "enter") {
      if (verify && verify(value)) {
        onSuccess(value);
      } else {
        setError("PIN incorrecto");
        setShake(true);
        setPin("");
        setTimeout(() => {
          setShake(false);
          inputRef.current?.focus();
        }, 400);
      }
      return;
    }

    // create mode
    if (step === "first") {
      setStep("confirm");
      return;
    }

    if (value !== pin) {
      setError("Los PINs no coinciden");
      setShake(true);
      setConfirmPin("");
      setTimeout(() => {
        setShake(false);
        inputRef.current?.focus();
      }, 400);
      return;
    }

    onSuccess(pin);
  }

  const heading =
    mode === "enter"
      ? `Hola ${profile.name}`
      : step === "first"
      ? "Crea tu PIN"
      : "Repite tu PIN";

  const subtitle =
    mode === "enter"
      ? "Introduce tu PIN de 4 dígitos para entrar"
      : step === "first"
      ? "Te lo pediremos cuando pase tiempo sin entrar"
      : "Para confirmar que es el correcto";

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center px-4"
        onClick={onCancel}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 12 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-white rounded-3xl shadow-xl p-8 w-full max-w-sm"
        >
          <div className="flex flex-col items-center text-center">
            <div
              className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${profile.color} flex items-center justify-center text-2xl font-semibold text-white shadow-soft mb-4`}
            >
              {profile.initials}
            </div>
            <h2 className="text-xl font-semibold tracking-tight">{heading}</h2>
            <p className="text-sm text-rumbo-muted mt-1">{subtitle}</p>

            <motion.div
              animate={shake ? { x: [-8, 8, -6, 6, -3, 3, 0] } : {}}
              transition={{ duration: 0.4 }}
              className="mt-6 relative"
            >
              <div className="flex gap-3">
                {[0, 1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className={`w-12 h-14 rounded-xl border-2 flex items-center justify-center text-2xl font-semibold transition-colors ${
                      i < current.length
                        ? "border-rumbo-ink bg-rumbo-ink/5"
                        : "border-rumbo-line bg-white"
                    }`}
                  >
                    {i < current.length ? "•" : ""}
                  </div>
                ))}
              </div>
              <input
                ref={inputRef}
                type="tel"
                inputMode="numeric"
                pattern="[0-9]*"
                value={current}
                onChange={(e) => handleChange(e.target.value)}
                className="absolute inset-0 opacity-0 cursor-pointer"
                autoFocus
              />
            </motion.div>

            {error && (
              <div className="text-rose-600 text-sm mt-4 font-medium">
                {error}
              </div>
            )}

            <button
              onClick={onCancel}
              className="text-sm text-rumbo-muted hover:text-rumbo-ink mt-6"
            >
              Cancelar
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
