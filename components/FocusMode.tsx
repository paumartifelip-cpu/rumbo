import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Task } from "@/lib/types";
import { useRumbo } from "@/lib/store";
import { cn } from "@/lib/utils";

interface FocusModeProps {
  tasks: Task[];
  onExit: () => void;
}

const DEFAULT_TIME = 25 * 60; // 25 minutes in seconds

export function FocusMode({ tasks, onExit }: FocusModeProps) {
  const { toggleTask } = useRumbo();
  
  // Local state
  const [timeLeft, setTimeLeft] = useState(DEFAULT_TIME);
  const [isRunning, setIsRunning] = useState(false);

  // We only care about the very first task (the top priority one)
  const currentTask = tasks.length > 0 ? tasks[0] : null;

  // Format time (MM:SS)
  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const timeString = `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;

  // Timer logic
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isRunning && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    } else if (timeLeft === 0) {
      setIsRunning(false);
      // Optional: Play a sound or notify when time's up
    }
    return () => clearInterval(interval);
  }, [isRunning, timeLeft]);

  // Handle Complete
  const handleComplete = useCallback(() => {
    if (currentTask) {
      toggleTask(currentTask.id);
      // Reset timer for the next task
      setTimeLeft(DEFAULT_TIME);
      setIsRunning(false);
    }
  }, [currentTask, toggleTask]);

  // If no more tasks, automatically exit or show completion state
  if (!currentTask) {
    return (
      <motion.div 
        initial={{ opacity: 0 }} 
        animate={{ opacity: 1 }} 
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-slate-900 flex flex-col items-center justify-center p-6 text-white"
      >
        <div className="text-6xl mb-6">🎉</div>
        <h1 className="text-3xl font-bold mb-2 text-center">¡Todas las tareas completadas!</h1>
        <p className="text-slate-400 mb-8 text-center max-w-md">
          Has despejado tu plan de acción. Tómate un merecido descanso.
        </p>
        <button 
          onClick={onExit}
          className="bg-white text-slate-900 px-8 py-3 rounded-2xl font-bold text-lg hover:bg-slate-100 transition-colors shadow-xl"
        >
          Volver al Inicio
        </button>
      </motion.div>
    );
  }

  // SVG parameters for the circular progress
  const radius = 120;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (timeLeft / DEFAULT_TIME) * circumference;

  const isDistraction = (currentTask.ai_priority_score ?? 100) < 30;

  return (
    <AnimatePresence>
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 1.05 }}
        className="fixed inset-0 z-50 bg-slate-900 flex flex-col p-6 overflow-hidden"
      >
        {/* Top Header */}
        <div className="flex justify-between items-center w-full max-w-4xl mx-auto">
          <button 
            onClick={onExit}
            className="text-slate-400 hover:text-white px-4 py-2 rounded-xl transition-colors font-medium flex items-center gap-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
            Salir de Focus
          </button>
          <div className="flex gap-2">
            <button 
              onClick={() => setTimeLeft((prev) => Math.min(prev + 5 * 60, 60 * 60))}
              className="w-10 h-10 rounded-full bg-slate-800 text-slate-300 flex items-center justify-center hover:bg-slate-700 transition-colors"
              title="+5 Minutos"
            >
              +5
            </button>
            <button 
              onClick={() => setTimeLeft((prev) => Math.max(prev - 5 * 60, 0))}
              className="w-10 h-10 rounded-full bg-slate-800 text-slate-300 flex items-center justify-center hover:bg-slate-700 transition-colors"
              title="-5 Minutos"
            >
              -5
            </button>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col items-center justify-center w-full max-w-4xl mx-auto">
          
          {/* Timer Visual */}
          <div className="relative mb-12">
            <svg width="300" height="300" className="transform -rotate-90 drop-shadow-2xl">
              <circle
                cx="150"
                cy="150"
                r={radius}
                className="stroke-slate-800"
                strokeWidth="12"
                fill="none"
              />
              <motion.circle
                cx="150"
                cy="150"
                r={radius}
                className={cn(
                  "transition-colors duration-500",
                  timeLeft === 0 ? "stroke-red-500" : isRunning ? "stroke-emerald-400" : "stroke-emerald-600"
                )}
                strokeWidth="12"
                fill="none"
                strokeDasharray={circumference}
                animate={{ strokeDashoffset }}
                transition={{ duration: 0.5, ease: "linear" }}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-5xl font-black text-white tracking-tighter tabular-nums drop-shadow-md">
                {timeString}
              </span>
              <span className="text-slate-400 text-sm font-medium mt-1">
                {isRunning ? "EN PROGRESO" : "PAUSADO"}
              </span>
            </div>
          </div>

          {/* Task Info */}
          <div className="w-full max-w-2xl text-center space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-800 text-slate-300 text-sm font-semibold mb-2">
              <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              TAREA PRIORITARIA
            </div>
            <motion.h2 
              key={currentTask.id}
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="text-4xl md:text-5xl font-bold text-white leading-tight"
            >
              {currentTask.title}
            </motion.h2>
            {currentTask.description && (
              <p className="text-xl text-slate-400 mt-4 max-w-xl mx-auto line-clamp-2">
                {currentTask.description}
              </p>
            )}
          </div>

          {/* Controls */}
          <div className="mt-16 flex flex-col sm:flex-row items-center gap-4">
            <button
              onClick={() => setIsRunning(!isRunning)}
              className={cn(
                "w-48 py-4 rounded-2xl font-bold text-lg transition-all shadow-lg active:scale-95",
                isRunning 
                  ? "bg-slate-800 text-white hover:bg-slate-700" 
                  : "bg-emerald-500 text-slate-900 hover:bg-emerald-400"
              )}
            >
              {isRunning ? "Pausar" : "Empezar"}
            </button>
            <button
              onClick={handleComplete}
              className="w-48 py-4 rounded-2xl font-bold text-lg bg-white text-slate-900 hover:bg-slate-100 transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2 group"
            >
              <span>✅</span> 
              <span>Completar</span>
            </button>
          </div>

        </div>
      </motion.div>
    </AnimatePresence>
  );
}
