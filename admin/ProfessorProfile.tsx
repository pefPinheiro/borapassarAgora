import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Teacher } from '../types';
import TiptapEditor from './TiptapEditor';

const ProfessorProfile: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [profile, setProfile] = useState<any>(null);
    const [teacherData, setTeacherData] = useState<Partial<Teacher>>({});
    const [disciplinas, setDisciplinas] = useState<any[]>([]);
    const [uploading, setUploading] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    const bannerInputRef = useRef<HTMLInputElement>(null);
    const avatarInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        fetchData();
        fetchDisciplinas();
    }, []);

    const fetchDisciplinas = async () => {
        const { data } = await supabase.from('disciplinas').select('id, name').eq('status', 'Ativo');
        if (data) setDisciplinas(data);
    };

    const fetchData = async () => {
        setLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // 1. Fetch Profile
            const { data: profData } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', user.id)
                .single();
            setProfile(profData);

            // 2. Fetch Teacher associated record
            const { data: tData } = await supabase
                .from('teachers')
                .select('*')
                .eq('linked_profile_id', user.id)
                .maybeSingle();

            if (tData) {
                setTeacherData(tData);
            } else {
                // If not linked, maybe create a draft? Or just wait for admin.
                // For now let's assume if they are a teacher they should have a record.
                setTeacherData({
                    name: profData?.full_name || '',
                    avatar_url: profData?.avatar_url || '',
                    description: '',
                    ad_images: [],
                    linked_profile_id: user.id,
                    status: 'Ativo'
                });
            }
        } catch (e) {
            console.error('Error fetching professor profile:', e);
        } finally {
            setLoading(false);
        }
    };

    const handleFileUpload = async (file: File, folder: string) => {
        setUploading(true);
        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
            const filePath = `${folder}/${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('public')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('public')
                .getPublicUrl(filePath);

            return publicUrl;
        } catch (e: any) {
            setMessage({ type: 'error', text: 'Erro no upload: ' + e.message });
            return null;
        } finally {
            setUploading(false);
        }
    };

    const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const url = await handleFileUpload(file, 'professors/avatars');
            if (url) setTeacherData(prev => ({ ...prev, avatar_url: url }));
        }
    };

    const handleBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const url = await handleFileUpload(file, 'professors/ads');
            if (url) {
                setTeacherData(prev => ({
                    ...prev,
                    ad_images: [url, ...(prev.ad_images || []).slice(0, 4)] // Keep first as banner, others as gallery
                }));
            }
        }
    };

    const handleSave = async () => {
        setSaving(true);
        setMessage(null);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const payload = {
                ...teacherData,
                linked_profile_id: user.id,
                updated_at: new Date().toISOString()
            };

            const { error } = await supabase
                .from('teachers')
                .upsert(payload, { onConflict: 'linked_profile_id' });

            if (error) throw error;

            // Also update profile avatar if changed
            if (teacherData.avatar_url && teacherData.avatar_url !== profile?.avatar_url) {
                await supabase.from('profiles').update({ avatar_url: teacherData.avatar_url }).eq('id', user.id);
            }

            setMessage({ type: 'success', text: 'Perfil atualizado com sucesso!' });
            fetchData();
        } catch (e: any) {
            setMessage({ type: 'error', text: 'Erro ao salvar: ' + e.message });
        } finally {
            setSaving(false);
        }
    };

    if (loading) return (
        <div className="h-96 flex items-center justify-center">
            <div className="size-12 border-4 border-slate-100 border-t-[#137fec] rounded-full animate-spin"></div>
        </div>
    );

    const mainBanner = teacherData.ad_images && teacherData.ad_images.length > 0 ? teacherData.ad_images[0] : null;

    return (
        <div className="max-w-6xl mx-auto pb-20 animate-in fade-in duration-700">
            {/* Header / Brand Zone */}
            <div className="relative mb-32">
                {/* Banner Hero */}
                <div className="relative h-64 md:h-80 w-full rounded-[48px] overflow-hidden bg-slate-900 shadow-2xl group">
                    {mainBanner ? (
                        <img src={mainBanner} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110 opacity-60" alt="Banner" />
                    ) : (
                        <div className="w-full h-full bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center text-slate-700">
                            <span className="material-symbols-outlined text-8xl opacity-10">landscape</span>
                        </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex items-end p-12">
                        <div className="space-y-1">
                            <h1 className="text-4xl font-black text-white uppercase tracking-tighter">Meu Painel Docente</h1>
                            <p className="text-slate-300 font-medium">Personalize sua presença na plataforma Bora Passar.</p>
                        </div>
                    </div>
                    <button 
                        onClick={() => bannerInputRef.current?.click()}
                        className="absolute top-6 right-6 px-6 py-3 bg-white/10 backdrop-blur-md border border-white/20 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-white hover:text-slate-900 transition-all shadow-xl"
                    >
                        {uploading ? 'Processando...' : 'Trocar Banner'}
                    </button>
                    <input type="file" ref={bannerInputRef} className="hidden" accept="image/*" onChange={handleBannerUpload} />
                </div>

                {/* Profile Float Card */}
                <div className="absolute -bottom-20 left-12 flex items-end gap-6">
                    <div className="relative group">
                        <div className="size-40 rounded-[48px] border-[8px] border-white bg-white shadow-2xl overflow-hidden">
                            <img src={teacherData.avatar_url || 'https://picsum.photos/400/400'} className="w-full h-full object-cover" alt="Avatar" />
                        </div>
                        <button 
                            onClick={() => avatarInputRef.current?.click()}
                            className="absolute bottom-2 right-2 size-10 bg-[#137fec] text-white rounded-2xl flex items-center justify-center shadow-lg hover:scale-110 active:scale-95 transition-all"
                        >
                            <span className="material-symbols-outlined text-lg">photo_camera</span>
                        </button>
                        <input type="file" ref={avatarInputRef} className="hidden" accept="image/*" onChange={handleAvatarUpload} />
                    </div>
                    <div className="pb-4">
                        <h2 className="text-3xl font-black text-slate-900 uppercase tracking-tight">{teacherData.name || profile?.full_name}</h2>
                        <div className="flex gap-2 mt-1">
                            <span className="px-3 py-1 bg-[#137fec]/10 text-[#137fec] rounded-full text-[9px] font-black uppercase tracking-widest">Professor Especialista</span>
                            <span className="px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full text-[9px] font-black uppercase tracking-widest">{teacherData.status}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Form Area */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                <div className="lg:col-span-8 space-y-8">
                    {message && (
                        <div className={`p-4 rounded-[24px] flex items-center gap-3 text-xs font-black uppercase tracking-widest animate-in slide-in-from-top-2 ${message.type === 'success' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-red-50 text-red-600 border border-red-100'}`}>
                            <span className="material-symbols-outlined">{message.type === 'success' ? 'verified' : 'report'}</span>
                            {message.text}
                        </div>
                    )}

                    <div className="bg-white rounded-[48px] border border-slate-200 shadow-sm p-10 space-y-8">
                        <div className="flex items-center gap-4 mb-2 pb-6 border-b border-slate-50">
                            <div className="size-12 bg-blue-50 text-blue-500 rounded-2xl flex items-center justify-center">
                                <span className="material-symbols-outlined">history_edu</span>
                            </div>
                            <div>
                                <h3 className="text-sm font-black uppercase tracking-widest text-slate-800">Biografia & Formação</h3>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Conte sua história para seus alunos</p>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Apresentação Profissional (Bio)</label>
                            <TiptapEditor 
                                content={teacherData.description || ''}
                                onChange={v => setTeacherData(prev => ({ ...prev, description: v }))}
                                minHeight="400px"
                                placeholder="Conte sobre sua jornada, aprovações, especializações e metodologia..."
                            />
                        </div>

                        <div className="pt-8 border-t border-slate-50 flex justify-end">
                            <button 
                                onClick={handleSave}
                                disabled={saving}
                                className="px-12 py-4 bg-[#111418] text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-2xl shadow-slate-900/40 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50"
                            >
                                {saving ? 'Salvando...' : 'Salvar Alterações'}
                            </button>
                        </div>
                    </div>
                </div>

                <div className="lg:col-span-4 space-y-8">
                    <div className="bg-slate-900 rounded-[48px] p-10 text-white shadow-2xl space-y-8">
                        <div>
                            <h3 className="text-xs font-black uppercase tracking-widest text-blue-400 mb-2">Poder do Professor</h3>
                            <p className="text-sm font-medium text-slate-400 leading-relaxed">Seu perfil é o seu cartão de visitas. Imagens de alta qualidade e uma bio inspiradora aumentam o engajamento dos alunos com seu conteúdo.</p>
                        </div>

                        <div className="space-y-4">
                            <div className="flex items-center gap-3 p-4 bg-white/5 rounded-2xl border border-white/5">
                                <span className="material-symbols-outlined text-blue-500">check_circle</span>
                                <span className="text-xs font-bold">Autoridade Acadêmica</span>
                            </div>
                            <div className="flex items-center gap-3 p-4 bg-white/5 rounded-2xl border border-white/5">
                                <span className="material-symbols-outlined text-blue-500">check_circle</span>
                                <span className="text-xs font-bold">Identidade Visual</span>
                            </div>
                            <div className="flex items-center gap-3 p-4 bg-white/5 rounded-2xl border border-white/5">
                                <span className="material-symbols-outlined text-blue-500">check_circle</span>
                                <span className="text-xs font-bold">Conexão Aluno-Professor</span>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-[48px] border border-slate-200 p-10 space-y-6">
                        <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Minha Galeria</h3>
                        <div className="grid grid-cols-2 gap-4">
                            {(teacherData.ad_images || []).map((img, i) => (
                                <div key={i} className="aspect-square rounded-3xl overflow-hidden border-4 border-slate-50 shadow-sm relative group">
                                    <img src={img} className="w-full h-full object-cover" alt={`Galeira ${i}`} />
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                        <button 
                                            onClick={() => setTeacherData(prev => ({ ...prev, ad_images: prev.ad_images?.filter(x => x !== img) }))}
                                            className="size-8 bg-red-500 text-white rounded-full flex items-center justify-center"
                                        >
                                            <span className="material-symbols-outlined text-[20px]">close</span>
                                        </button>
                                    </div>
                                </div>
                            ))}
                            <button 
                                onClick={() => bannerInputRef.current?.click()}
                                className="aspect-square rounded-3xl border-2 border-dashed border-slate-100 flex flex-col items-center justify-center text-slate-300 hover:border-blue-200 hover:text-blue-400 transition-all"
                            >
                                <span className="material-symbols-outlined">add_photo_alternate</span>
                            </button>
                        </div>
                    </div>

                    <div className="bg-white rounded-[48px] border border-slate-200 p-10 space-y-6">
                        <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-slate-400 text-sm">menu_book</span>
                            <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Suas Disciplinas</h3>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {(teacherData.disciplines_ids || []).map(dId => {
                                const dName = disciplinas.find(d => d.id === dId)?.name || 'Disciplina';
                                return (
                                    <span key={dId} className="px-3 py-1.5 bg-slate-50 text-slate-600 border border-slate-100 rounded-xl text-[10px] font-bold uppercase tracking-wider">
                                        {dName}
                                    </span>
                                );
                            })}
                            {(teacherData.disciplines_ids || []).length === 0 && (
                                <p className="text-[10px] text-slate-400 italic">Nenhuma disciplina vinculada pelo administrador.</p>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ProfessorProfile;
