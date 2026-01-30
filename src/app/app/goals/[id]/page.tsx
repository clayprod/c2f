'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { DatePicker } from '@/components/ui/date-picker';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { useMembers } from '@/hooks/useMembers';
import { parseDateOnly } from '@/lib/date';
import { useAccountContext } from '@/hooks/useAccountContext';
import { useRealtimeCashflowUpdates } from '@/hooks/useRealtimeCashflowUpdates';

const categoryColors = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1',
  '#a855f7', '#f43f5e', '#14b8a6', '#64748b',
];

const categoryIcons = [
  '🏠', '🚗', '🍕', '🛒', '💊', '📚', '🎬', '✈️', '💇', '🏥',
  '💼', '🎁', '📱', '⚡', '💧', '🔥', '🎯', '💰', '💳', '📈',
  '🏦', '💎', '🎨', '🎭', '🎪', '🏆', '⭐', '🌟', '💫', '🔐',
  '🛠️', '📊', '📋', '✂️', '🧹', '🍽️', '☕', '🍺', '🎮', '🎸',
];

interface Goal {
  id: string;
  name: string;
  description?: string;
  target_amount_cents: number;
  current_amount_cents: number;
  target_date?: string;
  status: string;
  priority: string;
  icon: string;
  color: string;
  image_url?: string;
  image_position?: string;
  notes?: string;
  include_in_plan?: boolean;
  contribution_frequency?: string | null;
  monthly_contribution_cents?: number | null;
  contribution_count?: number | null;
  plan_entries?: Array<{ entry_month: string; amount_cents: number; description?: string | null }>;
}

export default function EditGoalPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isDraggingImage, setIsDraggingImage] = useState(false);
  const { toast } = useToast();
  const { members, loading: loadingMembers } = useMembers();
  const { context: accountContext, activeAccountId } = useAccountContext();
  const ownerId = activeAccountId || accountContext?.currentUserId || null;
  const [assignedTo, setAssignedTo] = useState<string>('');
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    target_amount_cents: '',
    current_amount_cents: '0',
    target_date: '',
    status: 'active',
    priority: 'medium',
    icon: '🎯',
    color: '#3b82f6',
    image_url: '',
    image_position: 'center',
    notes: '',
    include_in_plan: true,
    contribution_frequency: 'monthly',
    monthly_contribution_cents: '',
    contribution_count: '',
    start_date: '',
  });
  const [useCustomPlan, setUseCustomPlan] = useState(false);
  const [planEntries, setPlanEntries] = useState<Array<{ month: string; amount: string }>>([
    { month: '', amount: '' },
  ]);
  const [loadingGoal, setLoadingGoal] = useState(true);

  const processImageFile = async (file: File) => {
    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        variant: "destructive",
        title: "Tipo de arquivo inválido",
        description: "Por favor, selecione um arquivo de imagem",
      });
      return;
    }

    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      toast({
        variant: "destructive",
        title: "Imagem muito grande",
        description: "O tamanho máximo permitido é 10MB",
      });
      return;
    }

    try {
      setUploadingImage(true);
      const formDataToUpload = new FormData();
      formDataToUpload.append('file', file);
      formDataToUpload.append('folder', 'goals');
      formDataToUpload.append('public', 'false');

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formDataToUpload,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao fazer upload da imagem');
      }

      const result = await response.json();
      setFormData({ ...formData, image_url: result.url });

      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erro ao fazer upload da imagem",
        description: error.message || "Ocorreu um erro ao tentar fazer upload da imagem",
      });
    } finally {
      setUploadingImage(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processImageFile(file);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.types.includes('Files')) {
      setIsDragging(true);
      e.dataTransfer.dropEffect = 'copy';
    }
  };

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.types.includes('Files')) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    // Only set dragging to false if we're leaving the drop zone entirely
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;
    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
      setIsDragging(false);
    }
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    if (!file.type.startsWith('image/')) {
      toast({
        variant: "destructive",
        title: "Tipo de arquivo inválido",
        description: "Por favor, selecione um arquivo de imagem",
      });
      return;
    }

    await processImageFile(file);
  };

  const handleRemoveImage = () => {
    setFormData({ ...formData, image_url: '', image_position: 'center' });
    setImagePreview(null);
  };

  const handleImageMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!imagePreview && !formData.image_url) return;
    setIsDraggingImage(true);
    e.preventDefault();
  };

  const handleImageMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDraggingImage || (!imagePreview && !formData.image_url)) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    
    // Clamp values between 0 and 100
    const clampedX = Math.max(0, Math.min(100, x));
    const clampedY = Math.max(0, Math.min(100, y));
    
    const position = `${Math.round(clampedX)}% ${Math.round(clampedY)}%`;
    setFormData({ ...formData, image_position: position });
  };

  const handleImageMouseUp = () => {
    setIsDraggingImage(false);
  };

  // Convert old position format to percentage if needed
  const getImagePosition = () => {
    const pos = formData.image_position || 'center';
    // If it's already in percentage format, return it
    if (pos.includes('%')) {
      return pos;
    }
    // Convert old format to percentage
    const positionMap: Record<string, string> = {
      'top left': '0% 0%',
      'top center': '50% 0%',
      'top right': '100% 0%',
      'center left': '0% 50%',
      'center': '50% 50%',
      'center right': '100% 50%',
      'bottom left': '0% 100%',
      'bottom center': '50% 100%',
      'bottom right': '100% 100%',
    };
    return positionMap[pos] || '50% 50%';
  };

  useEffect(() => {
    fetchGoal();
  }, []);

  useRealtimeCashflowUpdates({
    ownerId,
    onRefresh: () => {
      fetchGoal();
    },
    tables: ['goals', 'goal_contributions'],
    events: ['INSERT', 'UPDATE', 'DELETE'],
  });

  const fetchGoal = async () => {
    try {
      setLoadingGoal(true);
      const response = await fetch(`/api/goals/${params.id}`);
      const result = await response.json();
      if (result.data) {
        const goal = result.data as Goal;
        // Convert old position format to percentage if needed
        let imagePosition = goal.image_position || 'center';
        if (imagePosition && !imagePosition.includes('%')) {
          const positionMap: Record<string, string> = {
            'top left': '0% 0%',
            'top center': '50% 0%',
            'top right': '100% 0%',
            'center left': '0% 50%',
            'center': '50% 50%',
            'center right': '100% 50%',
            'bottom left': '0% 100%',
            'bottom center': '50% 100%',
            'bottom right': '100% 100%',
          };
          imagePosition = positionMap[imagePosition] || '50% 50%';
        }
        setFormData({
          name: goal.name,
          description: goal.description || '',
          target_amount_cents: (goal.target_amount_cents / 100).toString(),
          current_amount_cents: (goal.current_amount_cents / 100).toString(),
          target_date: goal.target_date || '',
          status: goal.status,
          priority: goal.priority,
          icon: goal.icon,
          color: goal.color,
          image_url: goal.image_url || '',
          image_position: imagePosition,
          notes: goal.notes || '',
          include_in_plan: goal.include_in_plan ?? true,
          contribution_frequency: goal.contribution_frequency || 'monthly',
          monthly_contribution_cents: goal.monthly_contribution_cents
            ? (goal.monthly_contribution_cents / 100).toString()
            : '',
          contribution_count: goal.contribution_count?.toString() || '',
          start_date: goal.target_date || '',
        });
        if (goal.image_url) {
          setImagePreview(goal.image_url);
        }
        if (goal.plan_entries && goal.plan_entries.length > 0) {
          setUseCustomPlan(true);
          setPlanEntries(
            goal.plan_entries.map((entry) => ({
              month: entry.entry_month?.slice(0, 7),
              amount: ((entry.amount_cents || 0) / 100).toString(),
            }))
          );
        }
      }
    } catch (error) {
      console.error('Error fetching goal:', error);
      toast({
        variant: "destructive",
        title: "Erro ao carregar objetivo",
        description: "Ocorreu um erro ao tentar carregar os dados do objetivo",
      });
    } finally {
      setLoadingGoal(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const cleanedPlanEntries = planEntries
        .map((entry) => ({
          month: entry.month,
          amount: parseFloat(entry.amount),
        }))
        .filter((entry) => entry.month && !Number.isNaN(entry.amount) && entry.amount > 0);

      if (useCustomPlan && cleanedPlanEntries.length === 0) {
        toast({
          variant: "destructive",
          title: "Plano personalizado incompleto",
          description: "Adicione ao menos um mês com valor válido.",
        });
        setLoading(false);
        return;
      }

      const payload: any = {
        name: formData.name,
        target_amount_cents: Math.round(parseFloat(formData.target_amount_cents) * 100),
        current_amount_cents: Math.round(parseFloat(formData.current_amount_cents || '0') * 100),
        status: formData.status,
        priority: formData.priority,
        icon: formData.icon,
        color: formData.color,
        include_in_plan: formData.include_in_plan || useCustomPlan,
        contribution_frequency: !useCustomPlan && formData.include_in_plan && formData.contribution_frequency
          ? formData.contribution_frequency
          : undefined,
        monthly_contribution_cents: formData.monthly_contribution_cents
          ? Math.round(parseFloat(formData.monthly_contribution_cents) * 100)
          : undefined,
        contribution_count: !useCustomPlan && formData.include_in_plan && formData.contribution_count
          ? parseInt(formData.contribution_count)
          : undefined,
        start_date: !useCustomPlan && formData.include_in_plan && formData.start_date
          ? formData.start_date
          : undefined,
        plan_entries: useCustomPlan
          ? cleanedPlanEntries.map((entry) => ({
              month: entry.month,
              amount_cents: Math.round(entry.amount * 100),
            }))
          : undefined,
      };

      // Only include optional fields if they have values
      if (formData.description && formData.description.trim()) {
        payload.description = formData.description;
      }
      if (formData.target_date && formData.target_date.trim()) {
        payload.target_date = formData.target_date;
      }
      if (formData.image_url && formData.image_url.trim()) {
        payload.image_url = formData.image_url;
      }
      if (formData.image_position && formData.image_position.trim()) {
        payload.image_position = formData.image_position;
      }
      if (formData.notes && formData.notes.trim()) {
        payload.notes = formData.notes;
      }
      if (assignedTo) {
        payload.assigned_to = assignedTo;
      }

      console.log('Sending payload:', JSON.stringify(payload, null, 2));
      const response = await fetch(`/api/goals/${params.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json();
        console.error('Error response:', JSON.stringify(error, null, 2));
        const errorMessage = error.details 
          ? `Erro de validação: ${JSON.stringify(error.details)}`
          : error.error || 'Erro ao atualizar objetivo';
        throw new Error(errorMessage);
      }

      const result = await response.json();
      
      // Check if there's a warning about image not being saved
      if (result.warning) {
        toast({
          variant: "default",
          title: "Objetivo salvo",
          description: result.warning,
        });
      } else {
        toast({
          variant: "default",
          title: "Objetivo atualizado",
          description: "O objetivo foi atualizado com sucesso",
        });
      }

      router.push('/app/goals');
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erro ao atualizar objetivo",
        description: error.message || "Ocorreu um erro ao tentar atualizar o objetivo",
      });
    } finally {
      setLoading(false);
    }
  };

  if (loadingGoal) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/app/goals" className="text-muted-foreground hover:text-foreground">
          <i className='bx bx-arrow-back text-xl'></i>
        </Link>
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-bold">Editar Objetivo</h1>
          <p className="text-muted-foreground">Atualize as informações do seu objetivo</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="glass-card p-6 space-y-6">
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium mb-2">Nome do Objetivo *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-3 rounded-xl bg-muted/50 border border-border focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="Ex: Viagem para Europa"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Meta (R$) *</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={formData.target_amount_cents}
              onChange={(e) => setFormData({ ...formData, target_amount_cents: e.target.value })}
              className="w-full px-4 py-3 rounded-xl bg-muted/50 border border-border focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="0.00"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Valor Inicial (R$)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={formData.current_amount_cents}
              onChange={(e) => setFormData({ ...formData, current_amount_cents: e.target.value })}
              className="w-full px-4 py-3 rounded-xl bg-muted/50 border border-border focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="0.00"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Data Objetivo</label>
            <DatePicker
              date={parseDateOnly(formData.target_date)}
              setDate={(date) => {
                if (date) {
                  const formattedDate = format(date, 'yyyy-MM-dd');
                  setFormData({ ...formData, target_date: formattedDate });
                }
              }}
              placeholder="Selecione a data objetivo"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Prioridade</label>
            <select
              value={formData.priority}
              onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
              className="w-full px-4 py-3 rounded-xl bg-muted/50 border border-border focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="low">Baixa</option>
              <option value="medium">Média</option>
              <option value="high">Alta</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Status</label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              className="w-full px-4 py-3 rounded-xl bg-muted/50 border border-border focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="active">Ativo</option>
              <option value="completed">Concluído</option>
              <option value="paused">Pausado</option>
              <option value="cancelled">Cancelado</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Cor</label>
          <div className="flex flex-wrap gap-2 mt-2">
            {categoryColors.map((color) => (
              <button
                key={color}
                type="button"
                className={`w-10 h-10 rounded-lg border-2 transition-all ${
                  formData.color === color ? 'border-foreground scale-110' : 'border-transparent'
                }`}
                style={{ backgroundColor: color }}
                onClick={() => setFormData({ ...formData, color })}
              />
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Ícone</label>
          <div className="flex flex-wrap gap-2 mt-2 max-h-32 overflow-y-auto">
            {categoryIcons.map((icon) => (
              <button
                key={icon}
                type="button"
                className={`w-8 h-8 rounded border-2 text-lg transition-transform ${
                  formData.icon === icon ? 'border-foreground scale-110' : 'border-muted'
                }`}
                onClick={() => setFormData({ ...formData, icon })}
              >
                {icon}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Imagem de Capa</label>
          <div className="space-y-3">
            {imagePreview || formData.image_url ? (
              <div className="space-y-3">
                <div 
                  className="relative overflow-hidden rounded-xl border border-border cursor-move select-none"
                  style={{ height: '192px' }}
                  onMouseDown={handleImageMouseDown}
                  onMouseMove={handleImageMouseMove}
                  onMouseUp={handleImageMouseUp}
                  onMouseLeave={handleImageMouseUp}
                >
                  <img
                    src={imagePreview || formData.image_url || ''}
                    alt="Preview"
                    className="w-full h-full object-cover transition-all pointer-events-none"
                    style={{ objectPosition: getImagePosition() }}
                    draggable={false}
                  />
                  <button
                    type="button"
                    onClick={handleRemoveImage}
                    className="absolute top-2 right-2 bg-destructive text-destructive-foreground p-2 rounded-full hover:bg-destructive/90 transition-colors z-10"
                    disabled={uploadingImage}
                  >
                    <i className='bx bx-x text-lg'></i>
                  </button>
                  {isDraggingImage && (
                    <div className="absolute inset-0 bg-primary/10 border-2 border-primary border-dashed flex items-center justify-center z-0">
                      <div className="text-primary text-sm font-medium">
                        <i className='bx bx-move text-2xl'></i>
                        <p className="mt-1">Arraste para ajustar</p>
                      </div>
                    </div>
                  )}
                </div>
                <div className="text-xs text-muted-foreground text-center">
                  Clique e arraste na imagem para ajustar a posição
                </div>
              </div>
            ) : (
              <div
                onDragEnter={handleDragEnter}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-xl cursor-pointer transition-all duration-200 ${
                  isDragging
                    ? 'border-primary bg-primary/20 scale-[1.02] shadow-lg shadow-primary/20'
                    : 'border-border hover:border-primary/60 hover:bg-muted/30 bg-muted/20'
                }`}
              >
                <label className="flex flex-col items-center justify-center pt-5 pb-6 w-full h-full cursor-pointer">
                  <div className="flex flex-col items-center justify-center">
                    <i className={`bx bx-image-add text-4xl mb-2 transition-all ${isDragging ? 'text-primary scale-110' : 'text-muted-foreground'}`}></i>
                    <p className="text-sm mb-1 transition-colors">
                      <span className={`font-semibold ${isDragging ? 'text-primary' : 'text-foreground'}`}>Clique para fazer upload</span>
                      <span className="text-muted-foreground"> ou </span>
                      <span className={`font-semibold ${isDragging ? 'text-primary' : 'text-foreground'}`}>arraste e solte</span>
                    </p>
                    <p className="text-xs text-muted-foreground">PNG, JPG, GIF ou WEBP (máx. 10MB)</p>
                  </div>
                  <input
                    type="file"
                    className="hidden"
                    accept="image/*"
                    onChange={handleImageUpload}
                    disabled={uploadingImage}
                  />
                </label>
              </div>
            )}
            {uploadingImage && (
              <div className="text-sm text-muted-foreground text-center">
                <i className='bx bx-loader-alt bx-spin'></i> Fazendo upload...
              </div>
            )}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Descrição</label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            className="w-full px-4 py-3 rounded-xl bg-muted/50 border border-border focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            rows={3}
            placeholder="Descreva seu objetivo..."
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Notas</label>
          <textarea
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            className="w-full px-4 py-3 rounded-xl bg-muted/50 border border-border focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            rows={2}
            placeholder="Notas adicionais..."
          />
        </div>

        {/* Responsible Person */}
        {members.length > 1 && (
          <div>
            <label className="block text-sm font-medium mb-2">Responsável</label>
            <Select
              value={assignedTo}
              onValueChange={setAssignedTo}
              disabled={loadingMembers}
            >
              <SelectTrigger className="w-full bg-muted/50 border border-border focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary">
                <SelectValue placeholder="Selecione o responsável" />
              </SelectTrigger>
              <SelectContent>
                {members.map((member) => (
                  <SelectItem key={member.id} value={member.id}>
                    <div className="flex items-center gap-2">
                      {member.avatarUrl ? (
                        <img
                          src={member.avatarUrl}
                          alt={member.fullName || 'Avatar'}
                          className="w-5 h-5 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs">
                          {(member.fullName || member.email)[0].toUpperCase()}
                        </div>
                      )}
                      <span>{member.fullName || member.email}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">
              Quem é responsável por este objetivo?
            </p>
          </div>
        )}

        <div className="border-t pt-6 space-y-4">
          <div className="flex items-center gap-3">
            <Checkbox
              id="include_in_plan"
              checked={formData.include_in_plan}
              onCheckedChange={(checked) => setFormData({ ...formData, include_in_plan: checked === true })}
              disabled={useCustomPlan}
            />
            <label htmlFor="include_in_plan" className="text-sm font-medium cursor-pointer">
              Incluir no orçamento e projeções
            </label>
          </div>

          {formData.include_in_plan && (
            <div className="grid md:grid-cols-2 gap-4 pl-6 border-l-2 border-primary/30">
              <div className="md:col-span-2 flex items-center gap-3">
                <Checkbox
                  id="use_custom_plan"
                  checked={useCustomPlan}
                  onCheckedChange={(checked) => {
                    const enabled = checked === true;
                    setUseCustomPlan(enabled);
                    if (enabled) {
                      setFormData((prev) => ({ ...prev, include_in_plan: true }));
                    }
                  }}
                />
                <label htmlFor="use_custom_plan" className="text-sm font-medium cursor-pointer">
                  Usar plano personalizado de aportes
                </label>
              </div>

              {useCustomPlan && (
                <div className="md:col-span-2 space-y-3">
                  {planEntries.map((entry, index) => (
                    <div key={index} className="grid md:grid-cols-3 gap-3 items-end">
                      <div>
                        <label className="block text-sm font-medium mb-2">Mês</label>
                        <input
                          type="month"
                          value={entry.month}
                          onChange={(e) => {
                            const value = e.target.value;
                            setPlanEntries((prev) =>
                              prev.map((item, idx) => idx === index ? { ...item, month: value } : item)
                            );
                          }}
                          className="w-full px-4 py-2 rounded-xl bg-muted/50 border border-border focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-2">Valor (R$)</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={entry.amount}
                          onChange={(e) => {
                            const value = e.target.value;
                            setPlanEntries((prev) =>
                              prev.map((item, idx) => idx === index ? { ...item, amount: value } : item)
                            );
                          }}
                          className="w-full px-4 py-2 rounded-xl bg-muted/50 border border-border focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                          placeholder="0.00"
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() => setPlanEntries((prev) => [...prev, { month: '', amount: '' }])}
                        >
                          + Adicionar
                        </button>
                        {planEntries.length > 1 && (
                          <button
                            type="button"
                            className="btn-secondary"
                            onClick={() => setPlanEntries((prev) => prev.filter((_, idx) => idx !== index))}
                          >
                            Remover
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {!useCustomPlan && (
                <>
                  <div>
                    <label className="block text-sm font-medium mb-2">Frequência de Aporte *</label>
                    <Select
                      value={formData.contribution_frequency}
                      onValueChange={(value) => setFormData({ ...formData, contribution_frequency: value })}
                      required={formData.include_in_plan}
                    >
                      <SelectTrigger className="w-full bg-muted/50 border border-border focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary">
                        <SelectValue placeholder="Selecione a frequência" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="daily">Diário</SelectItem>
                        <SelectItem value="weekly">Semanal</SelectItem>
                        <SelectItem value="biweekly">Quinzenal</SelectItem>
                        <SelectItem value="monthly">Mensal</SelectItem>
                        <SelectItem value="quarterly">Trimestral</SelectItem>
                        <SelectItem value="yearly">Anual</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Valor Mensal do Aporte (R$)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.monthly_contribution_cents}
                      onChange={(e) => setFormData({ ...formData, monthly_contribution_cents: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl bg-muted/50 border border-border focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                      placeholder="0.00"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Valor mensal calculado automaticamente baseado na frequência, ou defina manualmente
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Mês Inicial dos Aportes</label>
                    <input
                      type="month"
                      value={formData.start_date ? formData.start_date.substring(0, 7) : ''}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (value) {
                          setFormData({ ...formData, start_date: `${value}-01` });
                        } else {
                          setFormData({ ...formData, start_date: '' });
                        }
                      }}
                      className="w-full px-4 py-3 rounded-xl bg-muted/50 border border-border focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Mês em que se iniciam os aportes no orçamento
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Número de Aportes</label>
                    <input
                      type="number"
                      min="1"
                      value={formData.contribution_count}
                      onChange={(e) => setFormData({ ...formData, contribution_count: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl bg-muted/50 border border-border focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                      placeholder="Deixe vazio para contínuo"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Quantidade total de aportes. Deixe vazio para aportes contínuos.
                    </p>
                  </div>
                </>
              )}
            </div>
          )}
          </div>

        <div className="flex gap-4">
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Salvando...' : 'Atualizar Objetivo'}
          </button>
          <Link href="/app/goals" className="btn-secondary">
            Cancelar
          </Link>
        </div>
      </form>
    </div>
  );
}
