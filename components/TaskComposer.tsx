"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useRumbo } from "@/lib/store";

export function TaskComposer() {
  const { addTask } = useRumbo();
  const [text, setText] = useState("");
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

  function submit() {
    const t = text.trim();
    if (!t) return;
    addTask({ title: t });
    setText("");
    inputRef.current?.focus();
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  return (
    <div className="card p-3">
      <div className="flex items-end gap-2">
        <textarea
          ref={inputRef}
          rows={1}
          className="flex-1 resize-none bg-transparent outline-none px-2 py-2 text-base placeholder:text-rumbo-muted"
          placeholder="¿Qué tienes que hacer? Dilo o escríbelo. La IA lo interpreta."
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          style={{ minHeight: 44, maxHeight: 200 }}
        />
        {supported && (
          <button
            onClick={toggleMic}
            className={`btn ${
              listening
                ? "bg-rose-100 text-rose-600"
                : "bg-slate-100 text-rumbo-ink hover:bg-slate-200"
            } w-10 h-10 p-0 rounded-full`}
            title={listening ? "Detener" : "Dictar"}
            aria-label={listening ? "Detener dictado" : "Dictar tarea"}
          >
            {listening ? (
              <motion.span
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 1, repeat: Infinity }}
              >
                ⏹
              </motion.span>
            ) : (
              "🎙"
            )}
          </button>
        )}
        <button
          onClick={submit}
          disabled={!text.trim()}
          className="btn-primary h-10"
        >
          Añadir
        </button>
      </div>
      {listening && (
        <div className="text-xs text-rose-600 mt-1 px-2">
          Escuchando… habla con normalidad.
        </div>
      )}
      {!supported && (
        <div className="text-[11px] text-rumbo-muted mt-1 px-2">
          El dictado por voz funciona en Chrome y Safari.
        </div>
      )}
    </div>
  );
}
