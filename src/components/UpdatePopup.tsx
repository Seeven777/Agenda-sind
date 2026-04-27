import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function UpdatePopup() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    // O timer garante que o pop-up abra 1 segundo após o carregamento da página
    const storageKey = 'agenda-sind-update-popup-v2';
    if (localStorage.getItem(storageKey) === 'seen') return;

    const timer = setTimeout(() => {
      setIsOpen(true);
      localStorage.setItem(storageKey, 'seen');
    }, 1000);
    return () => clearTimeout(timer);
  }, []);

  const closePopup = () => {
    setIsOpen(false);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          {/* Backdrop com desfoque */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closePopup}
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
          />

          {/* Container do Modal */}
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="relative w-full max-w-2xl login-card rounded-[24px] shadow-2xl overflow-hidden"
          >
            {/* Botão Fechar Flutuante */}
            <button
              onClick={closePopup}
              className="absolute top-4 right-4 z-20 w-10 h-10 rounded-xl bg-black/35 hover:bg-black/50 backdrop-blur-md flex items-center justify-center transition-all active:scale-90"
              title="Fechar"
            >
              <X className="w-5 h-5 text-white" />
            </button>

            {/* A imagem do Pop-up */}
            <img
              src="/prancheta4.png"
              alt="Novas atualizações"
              className="w-full h-auto block"
            />
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
