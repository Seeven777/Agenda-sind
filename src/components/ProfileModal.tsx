import React, { useState, useRef } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { User } from '../types';
import { X, Camera, Save, CheckCircle } from 'lucide-react';

interface ProfileModalProps {
  user: User;
  onClose: () => void;
  onUpdate: (updatedUser: Partial<User>) => void;
}

export function ProfileModal({ user, onClose, onUpdate }: ProfileModalProps) {
  const [name, setName] = useState(user.name || '');
  const [department, setDepartment] = useState(user.department || '');
  const [photoUrl, setPhotoUrl] = useState((user as any).photoUrl || '');
  const [saving, setSaving] = useState(false);
  const [loadingPhoto, setLoadingPhoto] = useState(false);
  const [preview, setPreview] = useState<string | null>((user as any).photoUrl || null);
  const [saved, setSaved] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoadingPhoto(true);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const base64 = ev.target?.result as string;
      setPhotoUrl(base64);
      setPreview(base64);
      setLoadingPhoto(false);
    };
    reader.onerror = () => setLoadingPhoto(false);
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const updates: Record<string, string> = {
        name: name.trim() || user.name,
        department: department.trim(),
        updatedAt: new Date().toISOString(),
      };
      if (photoUrl) updates.photoUrl = photoUrl;

      await updateDoc(doc(db, 'users', user.id), updates);
      onUpdate(updates as Partial<User>);
      setSaved(true);
      setTimeout(() => onClose(), 900);
    } catch (error) {
      console.error('Error saving profile:', error);
      alert('Erro ao salvar. Verifique sua conexão e tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      <div
        className="relative w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-fade-in"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
          <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Editar Perfil</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl flex items-center justify-center transition-colors"
            style={{ background: 'var(--bg-input)', color: 'var(--text-muted)' }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-5 overflow-y-auto max-h-[75vh]">
          {/* Avatar */}
          <div className="flex flex-col items-center gap-3">
            <div className="relative">
              <div
                className="w-24 h-24 rounded-full overflow-hidden flex items-center justify-center text-3xl font-black text-white select-none"
                style={{ background: preview ? 'transparent' : 'linear-gradient(135deg,var(--accent),#ff9a0d)' }}
              >
                {preview
                  ? <img src={preview} alt="avatar" className="w-full h-full object-cover" />
                  : (name?.charAt(0) || user.name?.charAt(0) || 'U')
                }
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={loadingPhoto}
                className="absolute bottom-0 right-0 w-8 h-8 rounded-full flex items-center justify-center shadow-lg transition-all hover:scale-110"
                style={{ background: 'var(--accent)', color: 'white' }}
              >
                {loadingPhoto
                  ? <div className="w-3 h-3 rounded-full border-2 border-white border-t-transparent animate-spin" />
                  : <Camera className="w-3.5 h-3.5" />
                }
              </button>
              <input ref={fileInputRef} type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
            </div>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Clique na câmera para alterar a foto</p>
          </div>

          {/* Name */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>Nome</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              className="dark-input"
              placeholder="Seu nome completo"
            />
          </div>

          {/* Department */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>Departamento</label>
            <input
              type="text"
              value={department}
              onChange={e => setDepartment(e.target.value)}
              className="dark-input"
              placeholder="Ex: Jurídico, Fiscalização..."
            />
          </div>

          {/* Role (read only) */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>Função</label>
            <div className="dark-input text-sm" style={{ opacity: 0.65, cursor: 'not-allowed', color: 'var(--text-secondary)' }}>{user.role}</div>
          </div>

          {/* Email (read only) */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>E-mail</label>
            <div className="dark-input text-sm truncate" style={{ opacity: 0.65, cursor: 'not-allowed', color: 'var(--text-secondary)' }}>{user.email}</div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl text-sm font-bold"
              style={{ background: 'var(--bg-input)', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)' }}
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || loadingPhoto}
              className="btn-premium flex-1 flex items-center justify-center gap-2 py-2.5 text-sm disabled:opacity-50"
            >
              {saved
                ? <><CheckCircle className="w-4 h-4" />Salvo!</>
                : saving
                  ? <><div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />Salvando...</>
                  : <><Save className="w-4 h-4" />Salvar</>
              }
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
