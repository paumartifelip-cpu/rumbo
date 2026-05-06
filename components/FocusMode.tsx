import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Task } from "@/lib/types";
import { useRumbo } from "@/lib/store";
import { cn } from "@/lib/utils";

interface FocusModeProps {
  tasks: Task[];
  onExit: () => void;
}

const PRESETS = [
  { label: "15m", value: 15 * 60 },
  { label: "25m", value: 25 * 60 },
  { label: "50m", value: 50 * 60 },
  { label: "90m", value: 90 * 60 },
];

export function FocusMode({ tasks, onExit }: FocusModeProps) {
  const { toggleTask } = useRumbo();
  
  // Local state
  const [totalTime, setTotalTime] = useState(PRESETS[1].value);
  const [timeLeft, setTimeLeft] = useState(PRESETS[1].value);
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
      setTimeLeft(totalTime);
      setIsRunning(false);
    }
  }, [currentTask, toggleTask, totalTime]);

  const setPreset = (seconds: number) => {
    setTotalTime(seconds);
    setTimeLeft(seconds);
    setIsRunning(false);
  };

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

  const progressPercent = totalTime > 0 ? ((totalTime - timeLeft) / totalTime) * 100 : 0;

  return (
    <AnimatePresence>
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 1.05 }}
        className="fixed inset-0 z-50 bg-slate-900 flex flex-col p-6 overflow-hidden"
      >
        {/* Top Header */}
        <div className="flex justify-between items-center w-full max-w-4xl mx-auto mb-8">
          <button 
            onClick={onExit}
            className="text-slate-400 hover:text-white px-4 py-2 rounded-xl transition-colors font-medium flex items-center gap-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
            Salir de Focus
          </button>
          
          {/* Quick Presets */}
          <div className="flex bg-slate-800 p-1 rounded-full shadow-inner">
            {PRESETS.map((preset) => (
              <button
                key={preset.value}
                onClick={() => setPreset(preset.value)}
                className={cn(
                  "px-4 py-1.5 text-sm font-bold rounded-full transition-colors",
                  totalTime === preset.value
                    ? "bg-emerald-500 text-slate-900 shadow-md"
                    : "text-slate-400 hover:text-white hover:bg-slate-700"
                )}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col items-center justify-center w-full max-w-4xl mx-auto relative">
          
          {/* Task Info */}
          <div className="w-full text-center space-y-4 mb-20">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-800 text-slate-300 text-sm font-semibold mb-2 shadow-sm border border-slate-700">
              <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              ENFOQUE TOTAL
            </div>
            <motion.h2 
              key={currentTask.id}
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="text-4xl md:text-5xl font-black text-white leading-tight max-w-3xl mx-auto"
            >
              {currentTask.title}
            </motion.h2>
            {currentTask.description && (
              <p className="text-xl text-slate-400 mt-4 max-w-2xl mx-auto leading-relaxed">
                {currentTask.description}
              </p>
            )}
          </div>

          {/* The Walking Path Visualizer */}
          <div className="w-full max-w-2xl relative mb-16 pt-12 pb-6 px-4">
            {/* The person and flag */}
            <motion.div 
              className="absolute top-0 -ml-4 text-5xl z-10"
              animate={{ left: `${progressPercent}%` }}
              transition={{ ease: "linear", duration: 1 }}
            >
              🚶‍♂️
            </motion.div>
            
            <div className="absolute top-2 right-0 -mr-6 text-4xl z-10">
              🏁
            </div>
            
            {/* The path background */}
            <div className="w-full h-6 bg-slate-800 rounded-full shadow-inner overflow-hidden border border-slate-700 relative">
              {/* The progress fill */}
              <motion.div 
                className={cn(
                  "h-full rounded-full transition-colors",
                  timeLeft === 0 ? "bg-red-500" : isRunning ? "bg-emerald-500" : "bg-emerald-700"
                )}
                animate={{ width: `${progressPercent}%` }}
                transition={{ ease: "linear", duration: 1 }}
              />
              
              {/* Path texture (dashed line overlay) */}
              <div className="absolute inset-0 pointer-events-none opacity-20 bg-[repeating-linear-gradient(45deg,transparent,transparent_10px,#000_10px,#000_20px)] mix-blend-overlay"></div>
            </div>

            {/* Time display */}
            <div className="absolute -bottom-8 left-0 right-0 flex justify-between px-2 text-slate-400 font-bold">
              <span>{Math.floor(totalTime / 60)}m</span>
              <span className="text-3xl text-white font-black drop-shadow-md tabular-nums -mt-2">{timeString}</span>
              <span>0m</span>
            </div>
          </div>

          {/* Controls */}
          <div className="flex flex-col sm:flex-row items-center gap-4 mt-8">
            <button
              onClick={() => setIsRunning(!isRunning)}
              className={cn(
                "w-48 py-4 rounded-2xl font-bold text-xl transition-all shadow-lg active:scale-95",
                isRunning 
                  ? "bg-slate-800 text-white hover:bg-slate-700 border border-slate-600" 
                  : "bg-emerald-500 text-slate-900 hover:bg-emerald-400"
              )}
            >
              {isRunning ? "Pausar" : "Empezar camino"}
            </button>
            <button
              onClick={handleComplete}
              className="w-48 py-4 rounded-2xl font-bold text-xl bg-white text-slate-900 hover:bg-slate-100 transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2 group"
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
