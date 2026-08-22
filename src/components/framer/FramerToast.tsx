import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  title: string;
  description?: string;
}

interface FramerToastProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export const FramerToast: React.FC<FramerToastProps> = ({ toasts, onDismiss }) => {
  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none">
      <AnimatePresence>
        {toasts.map((t) => {
          return (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 20, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.85, transition: { duration: 0.15 } }}
              transition={{ type: 'spring', stiffness: 450, damping: 28 }}
              className={`p-4 rounded-2xl shadow-2xl border flex items-start gap-3 pointer-events-auto backdrop-blur-xl ${
                t.type === 'success'
                  ? 'bg-slate-900/95 text-white border-emerald-500/40 shadow-emerald-950/30'
                  : t.type === 'error'
                  ? 'bg-slate-900/95 text-white border-rose-500/40 shadow-rose-950/30'
                  : 'bg-slate-900/95 text-white border-blue-500/40 shadow-blue-950/30'
              }`}
            >
              <div className="shrink-0 mt-0.5">
                {t.type === 'success' && <CheckCircle2 className="w-5 h-5 text-[#10B981]" />}
                {t.type === 'error' && <AlertTriangle className="w-5 h-5 text-[#F43F5E]" />}
                {t.type === 'info' && <Info className="w-5 h-5 text-[#38BDF8]" />}
              </div>

              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold text-white">{t.title}</div>
                {t.description && (
                  <div className="text-[11px] text-slate-300 mt-0.5 leading-snug">
                    {t.description}
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => onDismiss(t.id)}
                className="shrink-0 p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
};
