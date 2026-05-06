"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useRumbo } from "@/lib/store";

export function TaskComposer() {
  const { addTask } = useRumbo();
  const [text, setText] = useState("");
  const [recurrence, setRecurrence] = useState<"" | "diaria" | "semanal" | "mensual">("");
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(false);
  const recRef = useRef<any>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const SR =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;
    setSupported(Boolean(SR));
  }, []);

  function toggleMic() {
    if (typeof window === "undefined") return;
    const SR =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;
    if (!SR) return;

    if (listening) {
      recRef.current?.stop();
      return;
    }

    const r = new SR();
    r.lang = "es-ES";
    r.interimResults = true;
    r.continuous = true;
    let finalText = text ? text + " " : "";
    r.onresult = (e: any) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const transcript = e.results[i][0].transcript;
        if (e.results[i].isFinal) finalText += transcript + " ";
        else interim += transcript;
      }
      setText((finalText + interim).trim());
    };
    r.onend = () => {
      setListening(false);
      recRef.current = null;
    };
    r.onerror = () => {
      setListening(false);
      recRef.current = null;
    };
    r.start();
    recRef.current = r;
    setListening(true);
  }

  function submit(forcedText?: string) {
    const t = (forcedText ?? text).trim();
    if (!t) return;
    addTask({ title: t, ...(recurrence ? { recurrence } : {}) });
    setText("");
    setRecurrence("");
    inputRef.current?.focus();
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  // Ref to hold the latest text for the unmount/onend handler
  const textRef = useRef(text);
  useEffect(() => {
    textRef.current = text;
  }, [text]);

  // Handle auto-submit when listening stops
  useEffect(() => {
    if (!listening && textRef.current.trim().length > 0) {
      // Small delay to allow the user to see the final text before it disappears
      const timer = setTimeout(() => {
        if (textRef.current.trim()) {
          submit(textRef.current);
        }
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [listening]);

  return (
    <motion.div 
      className="card p-4 shadow-sm"
      initial={{ y: -10, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
    >
      <div className="flex items-center gap-3">
        <textarea
          ref={inputRef}
          rows={1}
          className="flex-1 resize-none bg-slate-50 rounded-xl outline-none px-4 py-3.5 text-lg transition-all focus:bg-white focus:ring-2 focus:ring-emerald-200 placeholder:text-slate-400"
          placeholder="¿Qué tienes que hacer? Escríbelo o díctalo..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          style={{ minHeight: 52, maxHeight: 200 }}
        />
        <select
          className="bg-slate-100 text-sm text-slate-700 font-semibold rounded-xl px-3 h-[52px] outline-none border-0 transition-colors hover:bg-slate-200 cursor-pointer"
          value={recurrence}
          onChange={(e) => setRecurrence(e.target.value as any)}
          title="Hábito recurrente"
        >
          <option value="">Una vez</option>
          <option value="diaria">Diaria</option>
          <option value="semanal">Semanal</option>
          <option value="mensual">Mensual</option>
        </select>
        {supported && (
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={toggleMic}
            className={`flex items-center justify-center w-[52px] h-[52px] rounded-xl transition-colors shadow-sm ${
              listening
                ? "bg-rose-500 text-white shadow-rose-200"
                : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300"
            }`}
            title={listening ? "Detener" : "Dictar"}
            aria-label={listening ? "Detener dictado" : "Dictar tarea"}
          >
            {listening ? (
              <motion.div
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 1, repeat: Infinity }}
                className="w-4 h-4 rounded-sm bg-white"
              />
            ) : (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"></path>
                <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                <line x1="12" y1="19" x2="12" y2="22"></line>
              </svg>
            )}
          </motion.button>
        )}
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => submit()}
          disabled={!text.trim()}
          className="bg-slate-900 text-white font-bold h-[52px] px-6 rounded-xl shadow-sm hover:bg-slate-800 disabled:opacity-50 disabled:hover:bg-slate-900 transition-all"
        >
          Añadir
        </motion.button>
      </div>
      {listening && (
        <motion.div 
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="text-sm font-medium text-rose-600 mt-3 px-2 flex items-center gap-2"
        >
          <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
          Escuchando... (se añadirá automáticamente al terminar)
        </motion.div>
      )}
      {!supported && (
        <div className="text-[11px] text-slate-400 mt-2 px-2">
          El dictado por voz funciona en Chrome y Safari.
        </div>
      )}
    </motion.div>
  );
}
