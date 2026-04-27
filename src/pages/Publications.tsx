import React, { useMemo, useState, useEffect } from 'react';
import { addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, updateDoc } from 'firebase/firestore';
import {
  AlertTriangle,
  Calendar,
  CheckCircle,
  Clock,
  ChevronDown,
  ChevronUp,
  Edit,
  ExternalLink,
  Facebook,
  FileText,
  Globe2,
  Instagram,
  Image as ImageIcon,
  Images,
  Mail,
  MessageCircle,
  Newspaper,
  Paperclip,
  Plus,
  Send,
  Trash2,
  Upload,
  Video,
  X,
  XCircle
} from 'lucide-react';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { canApprovePublications } from '../lib/permissions';
import { PublicationApproval, PublicationChannel, PublicationMedia, PublicationMediaType, PublicationStatus, Priority } from '../types';

type PublicationFormData = {
  title: string;
  channel: PublicationChannel;
  priority: Priority;
  requestedPublishDate: string;
  requestedPublishTime: string;
  objective: string;
  targetAudience: string;
  content: string;
  driveUrl: string;
  notes: string;
};

type MediaDraft = PublicationMedia & {
  id: string;
  file?: File;
  isLocal?: boolean;
  thumbnailUrl?: string;
};

const emptyForm: PublicationFormData = {
  title: '',
  channel: 'instagram',
  priority: 'media',
  requestedPublishDate: '',
  requestedPublishTime: '',
  objective: '',
  targetAudience: '',
  content: '',
  driveUrl: '',
  notes: '',
};

const maxMediaItems = 20;
const maxInlineMediaBytes = 140 * 1024;
const maxInlineDocumentBytes = 850 * 1024;

const statusConfig: Record<PublicationStatus, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  rascunho: { label: 'Rascunho', color: '#94a3b8', bg: 'rgba(148,163,184,0.12)', icon: FileText },
  em_revisao: { label: 'Em revisão', color: '#f59e0b', bg: 'rgba(245,158,11,0.14)', icon: Clock },
  aprovado: { label: 'Aprovado', color: '#22c55e', bg: 'rgba(34,197,94,0.14)', icon: CheckCircle },
  reprovado: { label: 'Reprovado', color: '#ef4444', bg: 'rgba(239,68,68,0.14)', icon: XCircle },
  enviado: { label: 'Enviado', color: '#3b82f6', bg: 'rgba(59,130,246,0.14)', icon: Send },
};

const channelConfig: Record<PublicationChannel, { label: string; color: string; icon: React.ElementType }> = {
  instagram: { label: 'Instagram', color: '#e879f9', icon: Instagram },
  facebook: { label: 'Facebook', color: '#60a5fa', icon: Facebook },
  site: { label: 'Site', color: '#22c55e', icon: Globe2 },
  whatsapp: { label: 'WhatsApp', color: '#25d366', icon: MessageCircle },
  email: { label: 'E-mail', color: '#f59e0b', icon: Mail },
  imprensa: { label: 'Imprensa', color: '#a855f7', icon: Newspaper },
  outro: { label: 'Outro', color: '#94a3b8', icon: FileText },
};

const priorityConfig: Record<Priority, { label: string; color: string; bg: string }> = {
  alta: { label: 'Alta', color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
  media: { label: 'Média', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  baixa: { label: 'Baixa', color: '#10b981', bg: 'rgba(16,185,129,0.12)' },
};

function formatDate(date?: string, time?: string) {
  if (!date) return 'Sem data sugerida';
  const [year, month, day] = date.split('-').map(Number);
  if (!year || !month || !day) return 'Sem data sugerida';
  const dateObj = new Date(year, month - 1, day, 12, 0, 0);
  return `${dateObj.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}${time ? ` às ${time}` : ''}`;
}

function inferMediaType(value: string): PublicationMediaType {
  const cleanValue = value.toLowerCase().split('?')[0];
  if (/\.(mp4|mov|webm|m4v|avi)$/.test(cleanValue)) return 'video';
  return 'image';
}

function sanitizeFileName(name: string) {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 90);
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

async function compressImageFile(file: File): Promise<string> {
  const source = await fileToDataUrl(file);
  const image = await loadImage(source);
  const maxSide = 900;
  const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
  let width = Math.max(1, Math.round(image.width * scale));
  let height = Math.max(1, Math.round(image.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return source;

  ctx.drawImage(image, 0, 0, width, height);
  const qualities = [0.72, 0.58, 0.44, 0.32, 0.22];
  for (const quality of qualities) {
    const dataUrl = canvas.toDataURL('image/jpeg', quality);
    if (dataUrl.length <= maxInlineMediaBytes) return dataUrl;
  }

  return canvas.toDataURL('image/jpeg', 0.16);
}

function getTextBytes(value: string) {
  return new Blob([value]).size;
}

function cleanForFirestore<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => cleanForFirestore(item)).filter((item) => item !== undefined) as T;
  }

  if (value && typeof value === 'object') {
    const cleaned: Record<string, unknown> = {};
    Object.entries(value as Record<string, unknown>).forEach(([key, item]) => {
      if (item === undefined) return;
      cleaned[key] = cleanForFirestore(item);
    });
    return cleaned as T;
  }

  return value;
}

function getMediaDisplayUrl(media?: PublicationMedia) {
  return media?.thumbnailUrl || media?.url || '';
}

function getLinkName(url: string) {
  try {
    const parsed = new URL(url);
    const name = parsed.pathname.split('/').filter(Boolean).pop();
    return name || parsed.hostname || 'Link de mídia';
  } catch {
    return url.split('/').pop()?.split('?')[0] || 'Link de mídia';
  }
}

function normalizePublication(id: string, data: Partial<PublicationApproval>): PublicationApproval {
  return {
    id,
    title: data.title || 'Publicação sem título',
    channel: data.channel || 'instagram',
    status: data.status || 'rascunho',
    content: data.content || '',
    priority: data.priority || 'media',
    createdBy: data.createdBy || '',
    creatorName: data.creatorName || 'Agenda Sind',
    createdAt: data.createdAt || new Date(0).toISOString(),
    updatedAt: data.updatedAt || data.createdAt || new Date(0).toISOString(),
    requestedPublishDate: data.requestedPublishDate || '',
    requestedPublishTime: data.requestedPublishTime || '',
    objective: data.objective || '',
    targetAudience: data.targetAudience || '',
    driveUrl: data.driveUrl || '',
    notes: data.notes || '',
    media: Array.isArray(data.media) ? data.media.filter((item) => item && item.url) : [],
    rejectionReason: data.rejectionReason || '',
    publicationUrl: data.publicationUrl || '',
    submittedAt: data.submittedAt,
    approvedBy: data.approvedBy,
    approvedByName: data.approvedByName,
    approvedAt: data.approvedAt,
    sentBy: data.sentBy,
    sentByName: data.sentByName,
    sentAt: data.sentAt,
  };
}

export function Publications() {
  const { user } = useAuth();
  const [publications, setPublications] = useState<PublicationApproval[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<PublicationFormData>(emptyForm);
  const [mediaDrafts, setMediaDrafts] = useState<MediaDraft[]>([]);
  const [mediaUrl, setMediaUrl] = useState('');
  const [thumbnailUrl, setThumbnailUrl] = useState('');
  const [mediaUrlType, setMediaUrlType] = useState<PublicationMediaType>('image');
  const [submittingStatus, setSubmittingStatus] = useState<PublicationStatus | null>(null);
  const [activeStatus, setActiveStatus] = useState<PublicationStatus | 'todos'>('todos');
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [actionDialog, setActionDialog] = useState<{ type: 'reject' | 'sent'; publication: PublicationApproval } | null>(null);
  const [actionDialogText, setActionDialogText] = useState('');

  const canApprove = canApprovePublications(user);

  useEffect(() => {
    const q = query(collection(db, 'publications'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setPublications(snapshot.docs.map((item) => normalizePublication(item.id, item.data() as Partial<PublicationApproval>)));
        setPermissionError(null);
        setLoading(false);
      },
      (error) => {
        setLoading(false);
        console.error('Erro ao carregar publicações:', error);
        setPermissionError('Não foi possível carregar as publicações. Verifique se as regras do Firestore já foram publicadas.');
      }
    );

    return () => unsubscribe();
  }, []);

  const counts = useMemo(() => {
    return publications.reduce<Record<PublicationStatus, number>>(
      (acc, publication) => {
        acc[publication.status] = (acc[publication.status] || 0) + 1;
        return acc;
      },
      { rascunho: 0, em_revisao: 0, aprovado: 0, reprovado: 0, enviado: 0 }
    );
  }, [publications]);

  const filteredPublications = useMemo(() => {
    if (activeStatus === 'todos') return publications;
    return publications.filter((publication) => publication.status === activeStatus);
  }, [publications, activeStatus]);

  const needsAttention = counts.em_revisao + counts.aprovado;

  const updateForm = (field: keyof PublicationFormData, value: string) => {
    setFormData((current) => ({ ...current, [field]: value }));
  };

  const addFiles = (files: FileList | null) => {
    if (!files) return;

    const availableSlots = maxMediaItems - mediaDrafts.length;
    const skippedVideos = Array.from(files).filter((file) => file.type.startsWith('video/')).length;
    const selectedFiles = Array.from(files)
      .filter((file) => file.type.startsWith('image/'))
      .slice(0, Math.max(availableSlots, 0));

    if (skippedVideos > 0) {
      alert('Para manter o app gratuito, vídeos devem ser adicionados por link externo. Cole o link no campo ao lado e selecione "Vídeo".');
    }

    if (selectedFiles.length === 0) return;

    const drafts = selectedFiles.map((file) => ({
      id: `${file.name}-${file.lastModified}-${crypto.randomUUID()}`,
      type: file.type.startsWith('video/') ? 'video' as PublicationMediaType : 'image' as PublicationMediaType,
      name: file.name,
      url: URL.createObjectURL(file),
      file,
      isLocal: true,
      note: '',
      originalSize: file.size,
      storedAsPreview: true,
    }));

    setMediaDrafts((current) => [...current, ...drafts]);
  };

  const addMediaLink = () => {
    const url = mediaUrl.trim();
    if (!url || mediaDrafts.length >= maxMediaItems) return;

    setMediaDrafts((current) => [
      ...current,
      {
        id: `${url}-${Date.now()}`,
        type: mediaUrlType || inferMediaType(url),
        name: getLinkName(url),
        url,
        thumbnailUrl: thumbnailUrl.trim() || undefined,
        note: '',
      },
    ]);
    setMediaUrl('');
  };

  const updateMediaDraftNote = (id: string, note: string) => {
    setMediaDrafts((current) => current.map((media) => media.id === id ? { ...media, note } : media));
  };

  const removeMediaDraft = (id: string) => {
    setMediaDrafts((current) => {
      const item = current.find((media) => media.id === id);
      if (item?.isLocal) URL.revokeObjectURL(item.url);
      return current.filter((media) => media.id !== id);
    });
  };

  const uploadMediaDrafts = async (): Promise<PublicationMedia[]> => {
    if (!user) return [];

    const uploadedMedia: PublicationMedia[] = [];
    let inlineBytes = getTextBytes(formData.title + formData.content + formData.notes);
    for (const media of mediaDrafts) {
      if (!media.file) {
        uploadedMedia.push(cleanForFirestore({
          type: media.type,
          name: media.name,
          url: media.url,
          thumbnailUrl: media.thumbnailUrl,
          originalSize: media.originalSize,
          storedAsPreview: media.storedAsPreview,
          note: media.note || ''
        }));
        continue;
      }

      if (media.type !== 'image') {
        throw new Error('Vídeos devem ser adicionados por link externo.');
      }

      const dataUrl = await compressImageFile(media.file);
      const dataUrlBytes = getTextBytes(dataUrl);

      if (inlineBytes + dataUrlBytes > maxInlineDocumentBytes) {
        throw new Error('O card ficou grande demais para o Firestore. Mantenha os arquivos completos no Drive e deixe no app apenas as capas/prévias necessárias.');
      }

      inlineBytes += dataUrlBytes;
      uploadedMedia.push(cleanForFirestore({
        type: media.type,
        name: sanitizeFileName(media.name),
        url: dataUrl,
        note: media.note || '',
        originalSize: media.originalSize || media.file.size,
        storedAsPreview: true,
      }));
    }

    return uploadedMedia;
  };

  const resetForm = () => {
    mediaDrafts.forEach((media) => {
      if (media.isLocal) URL.revokeObjectURL(media.url);
    });
    setFormData(emptyForm);
    setMediaDrafts([]);
    setMediaUrl('');
    setThumbnailUrl('');
    setMediaUrlType('image');
    setEditingId(null);
    setShowForm(false);
    setSubmittingStatus(null);
  };

  const handleEdit = (publication: PublicationApproval) => {
    setFormData({
      title: publication.title,
      channel: publication.channel,
      priority: publication.priority,
      requestedPublishDate: publication.requestedPublishDate || '',
      requestedPublishTime: publication.requestedPublishTime || '',
      objective: publication.objective || '',
      targetAudience: publication.targetAudience || '',
      content: publication.content,
      driveUrl: publication.driveUrl || '',
      notes: publication.notes || '',
    });
    setMediaDrafts(publication.media?.map(m => ({ ...m, id: crypto.randomUUID() })) || []);
    setEditingId(publication.id);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const createPublication = async (status: PublicationStatus) => {
    if (!user || !formData.title.trim() || (!formData.content.trim() && mediaDrafts.length === 0)) return;

    setSubmittingStatus(status);
    try {
      const now = new Date().toISOString();
      const media = await uploadMediaDrafts();
      const payload = cleanForFirestore({
        title: formData.title.trim(),
        channel: formData.channel,
        priority: formData.priority,
        requestedPublishDate: formData.requestedPublishDate,
        requestedPublishTime: formData.requestedPublishTime,
        objective: formData.objective.trim(),
        targetAudience: formData.targetAudience.trim(),
        content: formData.content.trim() || 'Mídia enviada para aprovação.',
        driveUrl: formData.driveUrl.trim(),
        notes: formData.notes.trim(),
        media,
        status,
        updatedAt: now,
        ...(status === 'em_revisao' ? { submittedAt: now } : {}),
      });

      if (editingId) {
        await updateDoc(doc(db, 'publications', editingId), payload);
      } else {
        await addDoc(collection(db, 'publications'), { ...payload, createdBy: user.uid, creatorName: user.name, createdAt: now });
      }
      resetForm();
    } catch (error) {
      console.error('Erro ao criar publicação:', error);
      alert(error instanceof Error ? error.message : 'Não foi possível salvar a publicação. Verifique as permissões do Firestore e tente novamente.');
      setSubmittingStatus(null);
    }
  };

  const sendDraftToReview = async (publication: PublicationApproval) => {
    await updatePublication(publication, {
      status: 'em_revisao',
      submittedAt: new Date().toISOString(),
      rejectionReason: '',
    });
  };

  const approvePublication = async (publication: PublicationApproval) => {
    if (!user) return;
    await updatePublication(publication, {
      status: 'aprovado',
      approvedBy: user.uid,
      approvedByName: user.name,
      approvedAt: new Date().toISOString(),
      rejectionReason: '',
    });
  };

  const rejectPublication = (publication: PublicationApproval) => {
    setActionDialog({ type: 'reject', publication });
    setActionDialogText(publication.rejectionReason || '');
  };

  const markAsSent = (publication: PublicationApproval) => {
    setActionDialog({ type: 'sent', publication });
    setActionDialogText(publication.publicationUrl || '');
  };

  const confirmActionDialog = async () => {
    if (!actionDialog) return;

    if (actionDialog.type === 'reject') {
      const updated = await updatePublication(actionDialog.publication, {
        status: 'reprovado',
        rejectionReason: actionDialogText.trim() || 'Ajustes solicitados pela aprovação.',
      });
      if (updated) setActionDialog(null);
      return;
    }

    if (!user) return;
    const updated = await updatePublication(actionDialog.publication, {
      status: 'enviado',
      publicationUrl: actionDialogText.trim(),
      sentBy: user.uid,
      sentByName: user.name,
      sentAt: new Date().toISOString(),
    });
    if (updated) setActionDialog(null);
  };

  const updateSlideNote = async (publication: PublicationApproval, mediaIndex: number, note: string) => {
    const media = [...(publication.media || [])];
    if (!media[mediaIndex]) return;

    media[mediaIndex] = { ...media[mediaIndex], note };
    await updatePublication(publication, { media });
  };

  const updatePublication = async (publication: PublicationApproval, updates: Partial<PublicationApproval>) => {
    setActionLoadingId(publication.id);
    try {
      await updateDoc(doc(db, 'publications', publication.id), {
        ...cleanForFirestore(updates),
        updatedAt: new Date().toISOString(),
      });
      return true;
    } catch (error) {
      console.error('Erro ao atualizar publicação:', error);
      alert('Não foi possível atualizar a publicação. Verifique as permissões e tente novamente.');
      return false;
    } finally {
      setActionLoadingId(null);
    }
  };

  const removePublication = async (publication: PublicationApproval) => {
    const confirmed = window.confirm(`Excluir a publicação "${publication.title}"?`);
    if (!confirmed) return;

    setActionLoadingId(publication.id);
    try {
      await deleteDoc(doc(db, 'publications', publication.id));
    } catch (error) {
      console.error('Erro ao excluir publicação:', error);
      alert('Não foi possível excluir a publicação. Verifique as permissões e tente novamente.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const clearPublicationMedia = async (publication: PublicationApproval) => {
    const confirmed = window.confirm(`Remover as imagens salvas no app da publicação "${publication.title}"? O card continuará com texto, status e link do Drive.`);
    if (!confirmed) return;

    await updatePublication(publication, { media: [] });
  };

  const isOwner = (publication: PublicationApproval) => publication.createdBy === user?.uid;
  const canRemove = (publication: PublicationApproval) => {
    return isOwner(publication) || canApprove;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="w-10 h-10 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 pb-24 lg:pb-6">
      {permissionError && (
        <div className="p-4 rounded-xl flex items-start gap-3" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#ef4444' }}>
          <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold">Permissão pendente no Firebase</p>
            <p className="text-xs mt-1">{permissionError}</p>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-xl sm:text-3xl font-black tracking-tight" style={{ color: 'var(--text-primary)' }}>
            Publicações
          </h1>
          <p className="text-xs sm:text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            Aprovação, revisão e envio de conteúdos institucionais
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="btn-premium inline-flex items-center justify-center gap-2 min-h-[48px]"
        >
          <Plus className="w-4 h-4" />
          Nova publicação
        </button>
      </div>

      <div className="grid grid-cols-4 gap-2 sm:gap-3">
        <SummaryCard icon={Clock} label="Aguardando revisão" value={counts.em_revisao} color="#f59e0b" />
        <SummaryCard icon={CheckCircle} label="Aprovadas para envio" value={counts.aprovado} color="#22c55e" />
        <SummaryCard icon={Send} label="Enviadas" value={counts.enviado} color="#3b82f6" />
        <SummaryCard icon={AlertTriangle} label="Pedem atenção" value={needsAttention} color="var(--accent)" />
      </div>

      {showForm && (
        <div className="dark-card p-4 sm:p-6">
          <div className="flex items-start justify-between gap-4 mb-5">
            <div>
              <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{editingId ? 'Editar publicação' : 'Nova publicação'}</h2>
              <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
                Registre o texto, canal e prazo para aprovação.
              </p>
            </div>
            <button
              onClick={resetForm}
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: 'var(--bg-input)', color: 'var(--text-muted)' }}
              title="Fechar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2">
                <Field label="Título da Publicação *">
                  <input
                    value={formData.title}
                    onChange={(event) => updateForm('title', event.target.value)}
                    className="dark-input"
                    placeholder="Ex: Comunicado sobre convenção coletiva"
                  />
                </Field>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-2">
                <Field label="Canal">
                  <select value={formData.channel} onChange={(event) => updateForm('channel', event.target.value)} className="dark-input">
                    {Object.entries(channelConfig).map(([key, config]) => (
                      <option key={key} value={key}>{config.label}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Prioridade">
                  <select value={formData.priority} onChange={(event) => updateForm('priority', event.target.value)} className="dark-input">
                    <option value="alta">Alta</option>
                    <option value="media">Média</option>
                    <option value="baixa">Baixa</option>
                  </select>
                </Field>
                <Field label="Link do Drive">
                  <input
                    value={formData.driveUrl}
                    onChange={(event) => updateForm('driveUrl', event.target.value)}
                    className="dark-input"
                    placeholder="Link da pasta/slides"
                  />
                </Field>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <Field label="Objetivo / Público">
                <input
                  value={formData.objective}
                  onChange={(event) => updateForm('objective', event.target.value)}
                  className="dark-input"
                  placeholder="O que e para quem?"
                />
              </Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Data Prevista">
                  <input
                    type="date"
                    value={formData.requestedPublishDate}
                    onChange={(event) => updateForm('requestedPublishDate', event.target.value)}
                    className="dark-input"
                  />
                </Field>
                <Field label="Hora">
                  <input
                    type="time"
                    value={formData.requestedPublishTime}
                    onChange={(event) => updateForm('requestedPublishTime', event.target.value)}
                    className="dark-input"
                  />
                </Field>
              </div>
              <Field label="Observações">
                <input
                  value={formData.notes}
                  onChange={(event) => updateForm('notes', event.target.value)}
                  className="dark-input"
                  placeholder="Observações internas..."
                />
              </Field>
            </div>

            <div>
              <Field label="Texto da publicação *">
                <textarea
                  value={formData.content}
                  onChange={(event) => updateForm('content', event.target.value)}
                  className="dark-input min-h-40 resize-none"
                  placeholder="Cole ou escreva aqui o texto que será revisado e aprovado."
                />
              </Field>
            </div>

            <div className="p-4 rounded-xl" style={{ background: 'var(--bg-input)', border: '1px solid var(--border-subtle)' }}>
              <div className="flex flex-col lg:flex-row lg:items-end gap-3">
                <div className="flex-1">
                  <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>
                    Imagens e links de vídeos
                  </p>
                  <label
                    className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold cursor-pointer transition-all"
                    style={{ background: 'var(--accent-soft)', color: 'var(--accent)', border: '1px solid var(--border-color)' }}
                  >
                    <Upload className="w-4 h-4" />
                    Escolher imagens
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={(event) => {
                        addFiles(event.target.files);
                        event.target.value = '';
                      }}
                    />
                  </label>
                </div>

                <div className="flex flex-col gap-3 flex-[2]">
                  <div className="flex flex-col sm:flex-row gap-2">
                    <select
                      value={mediaUrlType}
                      onChange={(event) => setMediaUrlType(event.target.value as PublicationMediaType)}
                      className="dark-input sm:w-36"
                      aria-label="Tipo de mídia"
                    >
                      <option value="image">Imagem</option>
                      <option value="video">Vídeo</option>
                    </select>
                    <input
                      value={mediaUrl}
                      onChange={(event) => setMediaUrl(event.target.value)}
                      className="dark-input flex-1"
                      placeholder="Link da mídia (Instagram, YouTube, etc.)"
                    />
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      value={thumbnailUrl}
                      onChange={(event) => setThumbnailUrl(event.target.value)}
                      className="dark-input flex-1"
                      placeholder="Link da miniatura de pré-visualização (opcional)"
                    />
                    <button
                      type="button"
                      onClick={addMediaLink}
                      disabled={!mediaUrl.trim() || mediaDrafts.length >= maxMediaItems}
                      className="px-4 py-3 rounded-xl text-sm font-bold disabled:opacity-50 whitespace-nowrap"
                      style={{ background: 'var(--bg-card)', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)' }}
                    >
                      Adicionar link
                    </button>
                  </div>
                </div>
              </div>

              {mediaDrafts.length > 0 && (
                <div className="mt-4">
                  <MediaGalleryV2
                    channel={formData.channel}
                    content={formData.content}
                    creatorName={user?.name || 'Agenda Sind'}
                    media={mediaDrafts}
                    onNoteChange={updateMediaDraftNote}
                    onRemove={removeMediaDraft}
                  />
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row justify-end gap-3 mt-5">
            <button
              onClick={() => createPublication('rascunho')}
              disabled={!formData.title.trim() || (!formData.content.trim() && mediaDrafts.length === 0) || submittingStatus !== null}
              className="px-5 py-3.5 sm:py-3 rounded-xl text-sm font-bold disabled:opacity-50 min-h-[48px]"
              style={{ background: 'var(--bg-input)', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)' }}
            >
              {submittingStatus === 'rascunho' ? 'Salvando...' : editingId ? 'Salvar alterações' : 'Salvar rascunho'}
            </button>
            <button
              onClick={() => createPublication('em_revisao')}
              disabled={!formData.title.trim() || (!formData.content.trim() && mediaDrafts.length === 0) || submittingStatus !== null}
              className="btn-premium disabled:opacity-50 min-h-[48px] justify-center"
            >
              <Send className="w-4 h-4" />
              {submittingStatus === 'em_revisao' ? 'Enviando...' : editingId ? 'Salvar e Enviar' : 'Enviar para aprovação'}
            </button>
          </div>
        </div>
      )}

      <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 sm:mx-0 sm:px-0 sm:flex-wrap sm:overflow-visible">
        <FilterButton active={activeStatus === 'todos'} label="Todos" count={publications.length} onClick={() => setActiveStatus('todos')} />
        {Object.entries(statusConfig).map(([status, config]) => (
          <FilterButton
            key={status}
            active={activeStatus === status}
            label={config.label}
            count={counts[status as PublicationStatus]}
            color={config.color}
            onClick={() => setActiveStatus(status as PublicationStatus)}
          />
        ))}
      </div>

      <div className="space-y-2.5 sm:space-y-3">
        {filteredPublications.length === 0 ? (
          <div className="dark-card empty-state">
            <div className="empty-state-icon">
              <FileText className="w-7 h-7" style={{ color: 'var(--accent)' }} />
            </div>
            <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Nenhuma publicação por aqui</p>
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Crie uma solicitação ou altere o filtro selecionado.</p>
          </div>
        ) : (
          filteredPublications.map((publication) => (
            <PublicationCard
              key={publication.id}
              publication={publication}
              canApprove={canApprove}
              canRemove={canRemove(publication)}
              isOwner={isOwner(publication)}
              loading={actionLoadingId === publication.id}
              onSendDraft={() => sendDraftToReview(publication)}
              onApprove={() => approvePublication(publication)}
              onEdit={() => handleEdit(publication)}
              onReject={() => rejectPublication(publication)}
              onMarkSent={() => markAsSent(publication)}
              onRemove={() => removePublication(publication)}
              onClearMedia={() => clearPublicationMedia(publication)}
              onUpdateSlideNote={(mediaIndex, note) => updateSlideNote(publication, mediaIndex, note)}
            />
          ))
        )}
      </div>

      {actionDialog && (
        <ActionDialog
          dialog={actionDialog}
          value={actionDialogText}
          loading={actionLoadingId === actionDialog.publication.id}
          onChange={setActionDialogText}
          onClose={() => setActionDialog(null)}
          onConfirm={confirmActionDialog}
        />
      )}
    </div>
  );
}

function SummaryCard({ icon: Icon, label, value, color }: { icon: React.ElementType; label: string; value: number; color: string }) {
  return (
    <div className="dark-card p-2.5 sm:p-4">
      <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl flex items-center justify-center mb-2 sm:mb-3" style={{ background: `${color}22` }}>
        <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" style={{ color }} />
      </div>
      <p className="text-lg sm:text-2xl font-black" style={{ color: 'var(--text-primary)' }}>{value}</p>
      <p className="text-[9px] sm:text-xs leading-tight" style={{ color: 'var(--text-muted)' }}>{label}</p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>
        {label}
      </span>
      {children}
    </label>
  );
}

function FilterButton({
  active,
  label,
  count,
  color = 'var(--accent)',
  onClick,
}: {
  active: boolean;
  label: string;
  count: number;
  color?: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 flex-shrink-0 min-h-[40px]"
      style={{
        background: active ? color : 'var(--bg-card)',
        color: active ? 'white' : 'var(--text-secondary)',
        border: active ? '1px solid transparent' : '1px solid var(--border-subtle)',
      }}
    >
      {label}
      <span className="px-2 py-0.5 rounded-lg text-[11px]" style={{ background: active ? 'rgba(255,255,255,0.18)' : 'var(--bg-input)' }}>
        {count}
      </span>
    </button>
  );
}

function PublicationCard({
  publication,
  canApprove,
  canRemove,
  isOwner,
  loading,
  onSendDraft,
  onApprove,
  onEdit,
  onReject,
  onMarkSent,
  onRemove,
  onClearMedia,
  onUpdateSlideNote,
}: {
  publication: PublicationApproval;
  canApprove: boolean;
  canRemove: boolean;
  isOwner: boolean;
  loading: boolean;
  onSendDraft: () => void;
  onApprove: () => void;
  onEdit: () => void;
  onReject: () => void;
  onMarkSent: () => void;
  onRemove: () => void;
  onClearMedia: () => void;
  onUpdateSlideNote: (mediaIndex: number, note: string) => void;
}) {
  const status = statusConfig[publication.status];
  const StatusIcon = status.icon;
  const channel = channelConfig[publication.channel] || channelConfig.outro;
  const ChannelIcon = channel.icon;
  const priority = priorityConfig[publication.priority];
  const canEditCard = canApprove || (isOwner && ['rascunho', 'reprovado'].includes(publication.status));
  const [showMobileDetails, setShowMobileDetails] = useState(false);

  return (
    <>
      <div className="sm:hidden dark-card overflow-hidden border-l-4" style={{ borderLeftColor: status.color }}>
        <div className="relative h-36 bg-[var(--bg-input)]">
          {publication.media && publication.media[0] ? (
            <img
              src={getMediaDisplayUrl(publication.media[0])}
              className="w-full h-full object-cover"
              alt={publication.title}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-[var(--text-muted)]">
              <ImageIcon className="w-9 h-9 opacity-25" />
            </div>
          )}
          <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/70 to-transparent" />
          <div className="absolute left-3 right-3 bottom-3 flex items-center justify-between gap-2">
            <span className="px-2.5 py-1.5 rounded-lg text-[10px] font-black flex items-center gap-1.5 backdrop-blur-md" style={{ background: 'rgba(0,0,0,0.55)', color: 'white' }}>
              <StatusIcon className="w-3.5 h-3.5" />
              {status.label}
            </span>
            <span className="px-2.5 py-1.5 rounded-lg text-[10px] font-black flex items-center gap-1.5 backdrop-blur-md" style={{ background: 'rgba(0,0,0,0.55)', color: 'white' }}>
              <ChannelIcon className="w-3.5 h-3.5" />
              {channel.label}
            </span>
          </div>
        </div>

        <div className="p-4 space-y-3">
          <div>
            <h2 className="text-base font-black leading-tight line-clamp-2" style={{ color: 'var(--text-primary)' }}>
              {publication.title}
            </h2>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-[11px]" style={{ color: 'var(--text-muted)' }}>
              <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> {formatDate(publication.requestedPublishDate, publication.requestedPublishTime)}</span>
              <span className="px-2 py-1 rounded-lg text-[10px] font-bold" style={{ background: priority.bg, color: priority.color }}>{priority.label}</span>
            </div>
          </div>

          {isOwner && publication.status === 'reprovado' && (
            <div className="p-3 rounded-xl bg-orange-500/10 border border-orange-500/30 flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-orange-500 flex-shrink-0" />
              <div>
                <p className="text-xs font-bold text-orange-500">Ação necessária</p>
                <p className="text-[11px] text-orange-600/80">O revisor solicitou alterações.</p>
              </div>
            </div>
          )}

          {(publication.notes || publication.rejectionReason) && (
            <div className="p-3 rounded-xl text-xs border border-dashed" style={{ background: 'rgba(245,158,11,0.05)', borderColor: 'rgba(245,158,11,0.3)' }}>
              <p className="font-bold uppercase tracking-tighter text-[9px] mb-1.5 flex items-center gap-1" style={{ color: '#f59e0b' }}>
                <MessageCircle className="w-3 h-3" /> Comentários
              </p>
              <p className="text-[var(--text-secondary)] leading-normal italic">
                {publication.rejectionReason || publication.notes}
              </p>
            </div>
          )}

          <button
            type="button"
            onClick={() => setShowMobileDetails((current) => !current)}
            className="w-full min-h-[42px] rounded-xl inline-flex items-center justify-center gap-2 text-xs font-bold"
            style={{ background: 'var(--bg-input)', color: 'var(--accent)', border: '1px solid var(--border-subtle)' }}
          >
            {showMobileDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            {showMobileDetails ? 'Ocultar detalhes' : 'Ver detalhes do card'}
          </button>

          {showMobileDetails && (
            <div className="space-y-2">
              {(publication.objective || publication.targetAudience) && (
                <div className="grid grid-cols-1 gap-2">
                  {publication.objective && (
                    <div className="p-3 rounded-xl bg-[var(--bg-input)] border border-[var(--border-subtle)]">
                      <p className="text-[9px] font-black uppercase tracking-wider text-[var(--text-muted)] mb-1">Objetivo</p>
                      <p className="text-xs text-[var(--text-secondary)] leading-relaxed">{publication.objective}</p>
                    </div>
                  )}
                  {publication.targetAudience && (
                    <div className="p-3 rounded-xl bg-[var(--bg-input)] border border-[var(--border-subtle)]">
                      <p className="text-[9px] font-black uppercase tracking-wider text-[var(--text-muted)] mb-1">Público</p>
                      <p className="text-xs text-[var(--text-secondary)] leading-relaxed">{publication.targetAudience}</p>
                    </div>
                  )}
                </div>
              )}

              {publication.content && (
                <div className="p-3 rounded-xl bg-[var(--bg-input)] border border-[var(--border-subtle)]">
                  <p className="text-[9px] font-black uppercase tracking-wider text-[var(--text-muted)] mb-1">Legenda</p>
                  <p className="text-xs leading-relaxed text-[var(--text-primary)] whitespace-pre-wrap">{publication.content}</p>
                </div>
              )}

              {publication.publicationUrl && (
                <a
                  href={publication.publicationUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold bg-[var(--accent-soft)] text-[var(--accent)] border border-[var(--border-color)]"
                >
                  <Globe2 className="w-3.5 h-3.5" />
                  Ver Publicado
                </a>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-2.5 pt-3 border-t border-[var(--border-subtle)]">
            {publication.driveUrl && (
              <a
                href={publication.driveUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="col-span-2 flex items-center justify-center gap-2 px-3 py-3 rounded-xl text-xs font-bold bg-[#ff6f0f] text-white min-h-[48px]"
              >
                <ExternalLink className="w-4 h-4" />
                Ver Slides
              </a>
            )}
            {canEditCard && publication.status !== 'enviado' && (
              <ActionButton icon={Edit} label="Editar Card" loading={loading} onClick={onEdit} tone="muted" />
            )}
            {(publication.status === 'rascunho' || publication.status === 'reprovado') && isOwner && (
              <ActionButton icon={Send} label="Solicitar Revisão" loading={loading} onClick={onSendDraft} tone="accent" />
            )}
            {publication.status === 'em_revisao' && canApprove && (
              <>
                <ActionButton icon={CheckCircle} label="Aprovar" loading={loading} onClick={onApprove} tone="success" />
                <ActionButton icon={XCircle} label="Ajustes" loading={loading} onClick={onReject} tone="danger" />
              </>
            )}
            {publication.status === 'aprovado' && canApprove && (
              <ActionButton icon={Send} label="Postar" loading={loading} onClick={onMarkSent} tone="info" />
            )}
            {canApprove && publication.media && publication.media.length > 0 && (publication.status === 'aprovado' || publication.status === 'enviado') && (
              <ActionButton icon={Trash2} label="Limpar imagens" loading={loading} onClick={onClearMedia} tone="muted" />
            )}
            {canRemove && <ActionButton icon={X} label="Excluir" loading={loading} onClick={onRemove} tone="muted" />}
          </div>
        </div>
      </div>

      <div className="hidden sm:block dark-card p-4 hover:border-[var(--accent)] transition-all border-l-4" style={{ borderLeftColor: status.color }}>
      <div className="flex flex-wrap lg:flex-nowrap gap-3 sm:gap-5">
        {/* Capa Compacta */}
        <div className="w-20 h-20 sm:w-full sm:h-auto lg:w-48 shrink-0 sm:aspect-video lg:aspect-square relative rounded-lg sm:rounded-xl overflow-hidden border border-[var(--border-subtle)] bg-[var(--bg-input)] shadow-inner">
          {publication.media && publication.media[0] ? (
            <img
              src={getMediaDisplayUrl(publication.media[0])}
              className="w-full h-full object-cover"
              alt={publication.title}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-[var(--text-muted)]">
              <ImageIcon className="w-8 h-8 opacity-20" />
            </div>
          )}
          <div className="hidden sm:block absolute top-2 left-2 px-2 py-1 rounded-md text-[9px] font-black uppercase text-white bg-black/50 backdrop-blur-md border border-white/10">
            CAPA
          </div>
        </div>

        {/* Conteúdo Principal */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mb-2 sm:mb-3">
            <span className="px-2 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1" style={{ background: status.bg, color: status.color }}>
              <StatusIcon className="w-3.5 h-3.5" />
              {status.label}
            </span>
            <span className="px-2 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1" style={{ background: 'var(--bg-input)', color: channel.color }}>
              <ChannelIcon className="w-3.5 h-3.5" />
              {channel.label}
            </span>
            <span className="hidden sm:inline-flex px-2 py-1 rounded-lg text-[10px] font-bold" style={{ background: priority.bg, color: priority.color }}>
              {priority.label}
            </span>
          </div>

          <h2 className="text-sm sm:text-base font-black leading-tight line-clamp-2 sm:truncate" style={{ color: 'var(--text-primary)' }}>
            {publication.title}
          </h2>

          <div className="flex flex-wrap items-center gap-x-2 sm:gap-x-3 gap-y-1 mt-1.5 mb-2 sm:mb-4 text-[10px] sm:text-[11px]" style={{ color: 'var(--text-muted)' }}>
            <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {formatDate(publication.requestedPublishDate, publication.requestedPublishTime)}</span>
            <span className="hidden sm:flex items-center gap-1"><FileText className="w-3 h-3" /> {publication.creatorName}</span>
          </div>

          {/* Alerta de Notificação para o Criador (quando reprovado) */}
          {isOwner && publication.status === 'reprovado' && (
            <div className="mb-4 p-3 rounded-xl bg-orange-500/10 border border-orange-500/30 flex items-center gap-3 animate-pulse">
              <AlertTriangle className="w-5 h-5 text-orange-500" />
              <div>
                <p className="text-xs font-bold text-orange-500">Ação necessária!</p>
                <p className="text-[10px] text-orange-600/80">O revisor solicitou alterações para você.</p>
              </div>
            </div>
          )}

          {/* Grid de Informações Estratégicas */}
          <div className="hidden sm:grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
            {publication.objective && (
              <div className="p-2.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-input)]/30">
                <p className="text-[9px] font-black uppercase tracking-wider text-[var(--text-muted)] mb-1">Objetivo</p>
                <p className="text-xs text-[var(--text-secondary)] line-clamp-2 leading-relaxed">{publication.objective}</p>
              </div>
            )}
            {publication.targetAudience && (
              <div className="p-2.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-input)]/30">
                <p className="text-[9px] font-black uppercase tracking-wider text-[var(--text-muted)] mb-1">Público-Alvo</p>
                <p className="text-xs text-[var(--text-secondary)] line-clamp-2 leading-relaxed">{publication.targetAudience}</p>
              </div>
            )}
          </div>

          {/* Conteúdo/Legenda da Publicação */}
          <div className="hidden sm:block mb-4">
            <p className="text-[9px] font-black uppercase tracking-wider text-[var(--text-muted)] mb-2">Texto da Legenda / Conteúdo:</p>
            <div className="p-3 rounded-xl bg-[var(--bg-input)] border border-[var(--border-subtle)]">
              <p className="text-xs leading-relaxed text-[var(--text-primary)] whitespace-pre-wrap line-clamp-4">
                {publication.content}
              </p>
            </div>
          </div>

          {/* Feedback de Alterações (Comentários do Revisor) */}
          {(publication.notes || publication.rejectionReason) && (
            <div className="p-3 rounded-xl mb-4 text-xs border border-dashed" style={{ background: 'rgba(245,158,11,0.05)', borderColor: 'rgba(245,158,11,0.3)' }}>
              <p className="font-bold uppercase tracking-tighter text-[9px] mb-1.5 flex items-center gap-1" style={{ color: '#f59e0b' }}>
                <MessageCircle className="w-3 h-3" /> Comentários do Revisor:
              </p>
              <p className="text-[var(--text-secondary)] leading-normal italic">
                {publication.rejectionReason || publication.notes}
              </p>
            </div>
          )}

          <div className="hidden sm:flex flex-wrap gap-3 items-center pt-2 border-t border-[var(--border-subtle)]">
            {publication.publicationUrl && (
              <a
                href={publication.publicationUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-[var(--accent-soft)] text-[var(--accent)] border border-[var(--border-color)] hover:brightness-110 active:scale-95"
              >
                <Globe2 className="w-3.5 h-3.5" />
                Ver Publicado
              </a>
            )}
          </div>
        </div>

        {/* Ações Compactas */}
        <div className="grid grid-cols-2 sm:flex lg:flex-col justify-start lg:justify-end gap-2.5 sm:gap-2 border-t lg:border-t-0 lg:border-l border-[var(--border-subtle)] pt-3 lg:pt-0 lg:pl-5 shrink-0 basis-full lg:basis-auto w-full lg:w-48">
          {publication.driveUrl && (
            <a
              href={publication.driveUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="col-span-2 sm:col-span-1 flex items-center justify-center gap-2 px-3 sm:px-4 py-3 rounded-xl text-xs sm:text-sm font-bold bg-[#ff6f0f] text-white hover:brightness-110 transition-all shadow-lg shadow-orange-900/20 min-h-[46px] w-full sm:w-auto lg:w-full"
            >
              <ExternalLink className="w-4 h-4" />
              Ver Slides
            </a>
          )}

          {canEditCard && publication.status !== 'enviado' && (
            <ActionButton icon={Edit} label="Editar Card" loading={loading} onClick={onEdit} tone="muted" />
          )}

          {(publication.status === 'rascunho' || publication.status === 'reprovado') && isOwner && (
            <ActionButton icon={Send} label="Solicitar Revisão" loading={loading} onClick={onSendDraft} tone="accent" />
          )}
          {publication.status === 'em_revisao' && canApprove && (
            <>
              <ActionButton icon={CheckCircle} label="Aprovar" loading={loading} onClick={onApprove} tone="success" />
              <ActionButton icon={XCircle} label="Ajustes" loading={loading} onClick={onReject} tone="danger" />
            </>
          )}
          {publication.status === 'aprovado' && canApprove && (
            <ActionButton icon={Send} label="Postar" loading={loading} onClick={onMarkSent} tone="info" />
          )}
          {canApprove && publication.media && publication.media.length > 0 && (publication.status === 'aprovado' || publication.status === 'enviado') && (
            <ActionButton icon={Trash2} label="Limpar imagens" loading={loading} onClick={onClearMedia} tone="muted" />
          )}
          {canRemove && <ActionButton icon={X} label="Excluir" loading={loading} onClick={onRemove} tone="muted" />}
        </div>
      </div>
    </div>
    </>
  );
}

function Meta({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 text-sm min-w-0" style={{ color: 'var(--text-muted)' }}>
      <Icon className="w-4 h-4 flex-shrink-0" />
      <div className="min-w-0">
        <p className="text-[10px] uppercase font-bold tracking-wider">{label}</p>
        <p className="truncate" style={{ color: 'var(--text-secondary)' }}>{value}</p>
      </div>
    </div>
  );
}

function SmallBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-3 rounded-xl" style={{ background: 'var(--bg-input)' }}>
      <p className="text-[10px] uppercase font-bold tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>{label}</p>
      <p className="text-sm line-clamp-3" style={{ color: 'var(--text-secondary)' }}>{value}</p>
    </div>
  );
}

function MediaGalleryV2({
  channel,
  content,
  creatorName,
  media,
  canAnnotate = false,
  onNoteChange,
  onRemove,
  onSaveNote,
}: {
  channel: PublicationChannel;
  content: string;
  creatorName: string;
  media: PublicationMedia[];
  canAnnotate?: boolean;
  onNoteChange?: (id: string, note: string) => void;
  onRemove?: (id: string) => void;
  onSaveNote?: (mediaIndex: number, note: string) => void;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {media.map((item, index) => {
        const mediaId = 'id' in item ? String((item as MediaDraft).id) : `${item.url}-${index}`;

        return (
          <div key={mediaId} className="overflow-hidden rounded-xl" style={{ background: 'var(--bg-input)', border: '1px solid var(--border-subtle)' }}>
            <SlidePreview
              channel={channel}
              content={content}
              creatorName={creatorName}
              index={index}
              item={item}
              total={media.length}
              onRemove={onRemove ? () => onRemove(mediaId) : undefined}
            />
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 p-3 text-xs font-bold"
              style={{ color: 'var(--text-secondary)' }}
            >
              {item.type === 'video'
                ? <Video className="w-4 h-4 flex-shrink-0" style={{ color: '#3b82f6' }} />
                : <ImageIcon className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--accent)' }} />
              }
              <span className="truncate">{item.name}</span>
              <Paperclip className="w-3.5 h-3.5 ml-auto flex-shrink-0" />
            </a>
            <SlideNoteBox
              canAnnotate={canAnnotate}
              mediaId={mediaId}
              note={item.note || ''}
              slideNumber={index + 1}
              onNoteChange={onNoteChange}
              onSaveNote={onSaveNote ? (note) => onSaveNote(index, note) : undefined}
            />
          </div>
        );
      })}
    </div>
  );
}

function SocialPreview({ publication }: { publication: PublicationApproval }) {
  const firstMedia = publication.media?.[0];

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: 'var(--bg-input)', border: '1px solid var(--border-subtle)' }}>
      <div className="px-4 py-3 flex items-center gap-3" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
        <div className="w-10 h-10 rounded-full flex items-center justify-center font-black text-white" style={{ background: 'linear-gradient(135deg,var(--accent),#ff9a0d)' }}>
          S
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold truncate" style={{ color: 'var(--text-primary)' }}>{publication.creatorName || 'SindPetShop-SP'}</p>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{channelConfig[publication.channel]?.label || 'Publicação'}</p>
        </div>
      </div>

      {firstMedia ? (
        <SlidePreview
          channel={publication.channel}
          content={publication.content}
          creatorName={publication.creatorName}
          index={0}
          item={firstMedia}
          total={publication.media?.length || 1}
        />
      ) : null}

      <div className="p-4">
        <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--text-secondary)' }}>
          {publication.content}
        </p>
      </div>
    </div>
  );
}

function SlidePreview({
  channel,
  content,
  creatorName,
  index,
  item,
  total,
  onRemove,
}: {
  channel: PublicationChannel;
  content: string;
  creatorName: string;
  index: number;
  item: PublicationMedia;
  total: number;
  onRemove?: () => void;
}) {
  const isFeedLike = channel === 'instagram' || channel === 'facebook';
  const aspectClass = channel === 'instagram' ? 'aspect-square' : channel === 'whatsapp' ? 'aspect-[4/3]' : 'aspect-video';
  const wrapperStyle = channel === 'whatsapp'
    ? { background: '#0b3b34' }
    : channel === 'site'
      ? { background: '#f8fafc' }
      : { background: 'var(--bg-primary)' };

  const thumbnailUrl = item.thumbnailUrl;
  const isVideoWithThumbnail = item.type === 'video' && thumbnailUrl;

  return (
    <div className={`${aspectClass} relative overflow-hidden`} style={wrapperStyle}>
      {item.type === 'video' && !thumbnailUrl ? (
        <video src={item.url} controls className="w-full h-full object-contain" />
      ) : (
        <>
          <img
            src={thumbnailUrl || item.url}
            alt={item.name}
            className={`w-full h-full ${isFeedLike ? 'object-cover' : 'object-contain'}`}
            loading="lazy"
          />
          {isVideoWithThumbnail && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/20">
              <div className="w-12 h-12 rounded-full bg-white/30 backdrop-blur-sm flex items-center justify-center shadow-lg">
                <Video className="w-6 h-6 text-white" />
              </div>
            </div>
          )}
        </>
      )}
      <div className="absolute top-3 left-3 px-2.5 py-1 rounded-full text-[11px] font-black" style={{ background: 'rgba(0,0,0,0.72)', color: 'white' }}>
        Slide {index + 1}/{total}
      </div>
      {channel === 'whatsapp' && (
        <div className="absolute left-3 right-3 bottom-3 rounded-xl px-3 py-2 text-xs" style={{ background: '#dcf8c6', color: '#1f2937' }}>
          <strong>{creatorName}:</strong> {content.slice(0, 90)}{content.length > 90 ? '...' : ''}
        </div>
      )}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="absolute top-2 right-2 w-9 h-9 rounded-xl flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.72)', color: 'white' }}
          title="Remover mídia"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

function SlideNoteBox({
  canAnnotate,
  mediaId,
  note,
  slideNumber,
  onNoteChange,
  onSaveNote,
}: {
  canAnnotate: boolean;
  mediaId: string;
  note: string;
  slideNumber: number;
  onNoteChange?: (id: string, note: string) => void;
  onSaveNote?: (note: string) => void;
}) {
  const [draftNote, setDraftNote] = useState(note);

  useEffect(() => {
    setDraftNote(note);
  }, [note]);

  if (onNoteChange) {
    return (
      <div className="p-3" style={{ borderTop: '1px solid var(--border-subtle)' }}>
        <label className="block text-[10px] uppercase font-bold tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>
          Anotação do slide {slideNumber}
        </label>
        <textarea
          value={note}
          onChange={(event) => onNoteChange(mediaId, event.target.value)}
          rows={2}
          className="dark-input resize-none"
          placeholder="Ex: trocar imagem, ajustar legenda deste slide..."
        />
      </div>
    );
  }

  if (!canAnnotate && !note) return null;

  return (
    <div className="p-3 space-y-2" style={{ borderTop: '1px solid var(--border-subtle)' }}>
      <label className="block text-[10px] uppercase font-bold tracking-wider" style={{ color: 'var(--text-muted)' }}>
        Anotação do slide {slideNumber}
      </label>
      {canAnnotate ? (
        <>
          <textarea
            value={draftNote}
            onChange={(event) => setDraftNote(event.target.value)}
            rows={2}
            className="dark-input resize-none"
            placeholder="Anote a alteração apenas deste slide"
          />
          <button
            type="button"
            onClick={() => onSaveNote?.(draftNote)}
            className="px-3 py-2 rounded-lg text-xs font-bold"
            style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
          >
            Salvar anotação
          </button>
        </>
      ) : (
        <p className="text-sm whitespace-pre-wrap" style={{ color: 'var(--text-secondary)' }}>{note}</p>
      )}
    </div>
  );
}

function ActionDialog({
  dialog,
  value,
  loading,
  onChange,
  onClose,
  onConfirm,
}: {
  dialog: { type: 'reject' | 'sent'; publication: PublicationApproval };
  value: string;
  loading: boolean;
  onChange: (value: string) => void;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const isReject = dialog.type === 'reject';
  const Icon = isReject ? XCircle : Send;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={loading ? undefined : onClose} />
      <form
        className="relative w-full max-w-lg dark-card p-5 sm:p-6 space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          onConfirm();
        }}
      >
        <div className="flex items-start gap-3">
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: isReject ? 'rgba(239,68,68,0.14)' : 'rgba(59,130,246,0.14)' }}
          >
            <Icon className="w-5 h-5" style={{ color: isReject ? '#ef4444' : '#3b82f6' }} />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-black" style={{ color: 'var(--text-primary)' }}>
              {isReject ? 'Reprovar publicação' : 'Registrar envio'}
            </h2>
            <p className="text-sm mt-1 line-clamp-2" style={{ color: 'var(--text-muted)' }}>
              {dialog.publication.title}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="w-9 h-9 rounded-xl flex items-center justify-center disabled:opacity-50"
            style={{ background: 'var(--bg-input)', color: 'var(--text-muted)' }}
            title="Fechar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {isReject ? (
          <Field label="Motivo da reprovação">
            <textarea
              value={value}
              onChange={(event) => onChange(event.target.value)}
              rows={4}
              className="dark-input resize-none"
              placeholder="Ex: corrigir o texto do slide 2 e trocar a imagem do slide 1"
              autoFocus
            />
          </Field>
        ) : (
          <Field label="Link da publicação enviada">
            <input
              value={value}
              onChange={(event) => onChange(event.target.value)}
              className="dark-input"
              placeholder="https://..."
              autoFocus
            />
          </Field>
        )}

        <div className="flex flex-col sm:flex-row justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-3 rounded-xl text-sm font-bold disabled:opacity-50"
            style={{ background: 'var(--bg-input)', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)' }}
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50"
            style={{ background: isReject ? '#ef4444' : '#3b82f6', color: 'white' }}
          >
            {isReject ? <XCircle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
            {loading ? 'Salvando...' : isReject ? 'Reprovar' : 'Marcar como enviado'}
          </button>
        </div>
      </form>
    </div>
  );
}

function ActionButton({
  icon: Icon,
  label,
  loading,
  onClick,
  tone,
}: {
  icon: React.ElementType;
  label: string;
  loading: boolean;
  onClick: () => void;
  tone: 'accent' | 'success' | 'danger' | 'info' | 'muted';
}) {
  const styles = {
    accent: { background: 'var(--accent)', color: 'white', border: '1px solid var(--accent)' },
    success: { background: '#22c55e', color: 'white', border: '1px solid #22c55e' },
    danger: { background: 'rgba(239,68,68,0.12)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.22)' },
    info: { background: '#3b82f6', color: 'white', border: '1px solid #3b82f6' },
    muted: { background: 'var(--bg-input)', color: 'var(--text-muted)', border: '1px solid var(--border-subtle)' },
  }[tone];

  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="px-3 sm:px-4 py-3 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-60 w-full sm:w-auto lg:w-full min-h-[46px] whitespace-nowrap"
      style={styles}
    >
      {loading ? <Clock className="w-4 h-4 animate-spin" /> : <Icon className="w-4 h-4" />}
      {label}
    </button>
  );
}
