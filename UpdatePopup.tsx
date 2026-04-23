import React, { useState, useEffect } from 'react';
import { X, CheckCircle2, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import prancheta4 from '../assets/prancheta4.png';

export function UpdatePopup() {
    const [isOpen, setIsOpen] = useState(false);
    // Versão da atualização para controlar se o usuário já viu este pop-up específico
    const UPDATE_VERSION = 'v1_prancheta4';

    useEffect(() => {
        const hasSeenUpdate = localStorage.getItem(`seen_update_${UPDATE_VERSION}`);
        if (!hasSeenUpdate) {
            // Delay de 1.5s para não sobrecarregar o usuário assim que o app abre
            const timer = setTimeout(() => setIsOpen(true), 1500);
            return () => clearTimeout(timer);
        }
    }, []);

    const closePopup = () => {
        setIsOpen(false);
        localStorage.setItem(`seen_update_${UPDATE_VERSION}`, 'true');
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
                        className="relative w-full max-w-lg bg-white dark:bg-gray-900 rounded-[2rem] shadow-2xl overflow-hidden border border-white/10"
                    >
                        {/* Botão Fechar Flutuante */}
                        <button
                            onClick={closePopup}
                            className="absolute top-4 right-4 z-20 w-10 h-10 rounded-full bg-black/20 hover:bg-black/40 backdrop-blur-md flex items-center justify-center transition-all active:scale-90"
                        >
                            <X className="w-5 h-5 text-white" />
                        </button>

                        {/* Banner da Atualização */}
                        <div className="relative w-full aspect-[16/10] bg-gray-100 dark:bg-gray-800">
                            <img
                                src={prancheta4}
                                alt="Novas Atualizações"
                                className="w-full h-full object-cover"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-gray-900/80 to-transparent" />
                            <div className="absolute bottom-6 left-6 right-6">
                                <div className="flex items-center gap-2 mb-1">
                                    <Sparkles className="w-5 h-5 text-orange-400 fill-orange-400" />
                                    <span className="text-orange-400 font-bold text-xs uppercase tracking-widest">Nova Versão</span>
                                </div>
                                <h2 className="text-3xl font-black text-white leading-tight">
                                    Atualizamos sua <br />Agenda Sind!
                                </h2>
                            </div>
                        </div>

                        {/* Lista de Novidades */}
                        <div className="p-8">
                            <div className="space-y-4 mb-8">
                                {[
                                    "Novo Assistente de Voz para criação rápida",
                                    "Sistema de permissões para diretoria",
                                    "Melhorias na visualização do calendário",
                                    "Notificações push 24h e 1h antes"
                                ].map((item, i) => (
                                    <div key={i} className="flex items-center gap-3">
                                        <div className="w-6 h-6 rounded-full bg-orange-500/10 flex items-center justify-center flex-shrink-0">
                                            <CheckCircle2 className="w-4 h-4 text-orange-500" />
                                        </div>
                                        <p className="text-gray-600 dark:text-gray-300 font-medium">{item}</p>
                                    </div>
                                ))}
                            </div>

                            <button
                                onClick={closePopup}
                                className="w-full py-4 rounded-2xl bg-[#ff6f0f] hover:bg-[#e6640d] text-white font-bold text-lg transition-all active:scale-[0.98] shadow-lg shadow-orange-500/30"
                            >
                                Acessar Novas Funções
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}