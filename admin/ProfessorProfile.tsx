import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Teacher } from '../types';
import TiptapEditor from './TiptapEditor';

interface ProfessorProfileProps {
    isDashboard?: boolean;
}

const ProfessorProfile: React.FC<ProfessorProfileProps> = ({ isDashboard = false }) => {
    const [viewMode, setViewMode] = useState<'preview' | 'edit'>('preview');
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
                    ad_images: [url, ...(prev.ad_images || []).slice(0, 4)]
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

            // Verificação manual para evitar erro de UNIQUE constraint se ela não existir no BD
            const { data: existing } = await supabase
                .from('teachers')
                .select('id')
                .eq('linked_profile_id', user.id)
                .maybeSingle();

            let saveError;
            if (existing) {
                // Remove ID do payload se existir para evitar confusão no update
                const { id, ...updatePayload } = payload;
                const { error } = await supabase
                    .from('teachers')
                    .update(updatePayload)
                    .eq('id', existing.id);
                saveError = error;
            } else {
                const { error } = await supabase
                    .from('teachers')
                    .insert(payload);
                saveError = error;
            }

            if (saveError) throw saveError;

            // Também atualiza o avatar no perfil se foi alterado
            if (teacherData.avatar_url && teacherData.avatar_url !== profile?.avatar_url) {
                await supabase.from('profiles').update({ avatar_url: teacherData.avatar_url }).eq('id', user.id);
            }

            setMessage({ type: 'success', text: 'Perfil atualizado com sucesso!' });
            
            // Recarrega e volta para o modo preview após um pequeno delay para o usuário ver a mensagem
            setTimeout(() => {
                fetchData();
                setViewMode('preview');
            }, 1000);
        } catch (e: any) {
            console.error('Save error:', e);
            setMessage({ type: 'error', text: 'Erro ao salvar: ' + (e.message || 'Erro desconhecido no banco de dados.') });
        } finally {
            setSaving(false);
        }
    };

    if (loading) return (
        <div className="h-[600px] flex items-center justify-center">
            <div className="size-12 border-4 border-slate-100 border-t-[#137fec] rounded-full animate-spin"></div>
        </div>
    );

    const mainBanner = teacherData.ad_images && teacherData.ad_images.length > 0 ? teacherData.ad_images[0] : null;

    const bioContentClass = `
        professor-bio-content
        prose prose-slate prose-lg max-w-none 
        text-slate-700 font-medium leading-relaxed
        prose-headings:text-slate-900 prose-headings:font-black prose-headings:uppercase prose-headings:tracking-tighter
        prose-h2:text-3xl prose-h2:border-b prose-h2:border-slate-100 prose-h2:pb-4 prose-h2:mt-12
        prose-h3:text-xl prose-h3:text-[#137fec]
        prose-p:mb-6
        prose-li:marker:text-[#137fec] prose-li:mb-2
        prose-strong:text-slate-900 prose-strong:font-black
        prose-blockquote:border-l-4 prose-blockquote:border-[#137fec] prose-blockquote:bg-blue-50/50 prose-blockquote:p-8 prose-blockquote:rounded-r-3xl prose-blockquote:italic prose-blockquote:text-lg prose-blockquote:text-slate-600
        prose-img:rounded-[40px] prose-img:shadow-2xl
    `;

    if (viewMode === 'preview') {
        return (
            <div className="max-w-6xl mx-auto pb-20 animate-in fade-in zoom-in-95 duration-700">
                {/* Visual Section */}
                <div className="relative group">
                    <div className="h-[450px] w-full rounded-[60px] overflow-hidden bg-slate-900 shadow-2xl relative">
                        {mainBanner ? (
                            <img src={mainBanner} className="w-full h-full object-cover opacity-60" alt="Banner" />
                        ) : (
                            <div className="w-full h-full bg-gradient-to-br from-slate-800 to-indigo-950 flex items-center justify-center">
                                <span className="material-symbols-outlined text-[120px] text-white/5 font-thin tracking-widest uppercase italic">BORA PASSAR</span>
                            </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
                        
                        {/* Status Overlay */}
                        <div className="absolute top-8 left-8">
                             <div className="px-5 py-2 bg-white/10 backdrop-blur-md border border-white/20 rounded-full flex items-center gap-2">
                                <div className="size-2 rounded-full bg-emerald-400 animate-pulse" />
                                <span className="text-[10px] font-black text-white uppercase tracking-[0.2em]">Perfil Público Ativado</span>
                             </div>
                        </div>

                        {/* Top Actions - Only visible if not in Dashboard */}
                        {!isDashboard && (
                            <div className="absolute top-8 right-8 flex gap-3">
                                <button 
                                    onClick={() => setViewMode('edit')}
                                    className="px-8 py-4 bg-white text-slate-900 rounded-[24px] font-black text-xs uppercase tracking-widest shadow-2xl hover:scale-110 active:scale-95 transition-all flex items-center gap-3"
                                >
                                    <span className="material-symbols-outlined text-[20px]">edit</span>
                                    Editar Minha Bio
                                </button>
                            </div>
                        )}

                        {/* Text Overlay */}
                        <div className="absolute bottom-16 left-16 right-16 flex flex-col md:flex-row items-end gap-10">
                            <div className="size-48 rounded-[56px] border-[10px] border-white/10 backdrop-blur-2xl overflow-hidden shadow-2xl shrink-0 group-hover:scale-105 transition-transform duration-700">
                                <img src={teacherData.avatar_url || 'https://picsum.photos/400/400'} className="w-full h-full object-cover" alt="Avatar" />
                            </div>
                            <div className="flex-1 pb-4">
                                <div className="flex flex-wrap gap-2 mb-4">
                                    {(teacherData.disciplines_ids || []).map(dId => (
                                        <span key={dId} className="px-3 py-1 bg-[#137fec] text-white rounded-lg text-[9px] font-black uppercase tracking-widest">
                                            {disciplinas.find(d => d.id === dId)?.name || 'Disciplina'}
                                        </span>
                                    ))}
                                </div>
                                <h1 className="text-6xl font-black text-white uppercase tracking-tighter leading-none mb-2">{teacherData.name || profile?.full_name}</h1>
                                <p className="text-blue-400 text-lg font-bold tracking-tight italic opacity-80">Professor(a) Especialista da Plataforma Bora Passar</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Content Area */}
                <div className="mt-16 px-6 space-y-20">
                    {/* Bio Section */}
                    <div className="max-w-4xl mx-auto space-y-10">
                        <style>{`
                            .professor-bio-content h2 { 
                                font-size: 2.25rem; 
                                line-height: 2.5rem; 
                                font-weight: 900; 
                                text-transform: uppercase; 
                                letter-spacing: -0.05em; 
                                margin-top: 4rem; 
                                border-bottom: 2px solid #f1f5f9; 
                                padding-bottom: 1.5rem;
                                color: #0f172a;
                                font-style: italic;
                            }
                            .professor-bio-content h3 { 
                                font-size: 1.5rem; 
                                font-weight: 900; 
                                color: #137fec; 
                                margin-top: 3rem;
                                text-transform: uppercase;
                                letter-spacing: -0.02em;
                            }
                            .professor-bio-content p { margin-bottom: 1.75rem; line-height: 1.8; font-size: 1.125rem; }
                            .professor-bio-content ul { list-style-type: none; padding-left: 0.5rem; margin-bottom: 2.5rem; }
                            .professor-bio-content ul li { position: relative; padding-left: 2rem; margin-bottom: 1rem; font-size: 1.1rem; }
                            .professor-bio-content ul li::before { 
                                content: "✓"; 
                                color: #137fec; 
                                font-weight: 900; 
                                position: absolute; 
                                left: 0; 
                                font-size: 1.2rem;
                            }
                            .professor-bio-content blockquote { 
                                border-left: 8px solid #137fec; 
                                background: linear-gradient(to right, #f0f9ff, #ffffff); 
                                padding: 3rem; 
                                border-radius: 0 40px 40px 0; 
                                font-style: italic; 
                                color: #334155;
                                margin: 3rem 0;
                                position: relative;
                            }
                            .professor-bio-content blockquote::after {
                                content: '"';
                                position: absolute;
                                top: -20px;
                                right: 30px;
                                font-size: 8rem;
                                color: #137fec;
                                opacity: 0.1;
                                font-family: serif;
                            }
                            .professor-bio-content strong { color: #0f172a; font-weight: 900; }
                            .professor-bio-content hr { border: 0; border-top: 4px solid #f8fafc; margin: 4rem 0; }
                        `}</style>
                        <h3 className="text-sm font-black text-slate-400 uppercase tracking-[0.4em] flex items-center gap-4">
                            <span className="w-10 h-[2px] bg-[#137fec]" />
                            Perfil do Professor
                        </h3>
                        <div 
                            className={bioContentClass}
                            dangerouslySetInnerHTML={{ __html: teacherData.description || '<p class="text-slate-400 italic">Nenhuma biografia cadastrada.</p>' }}
                        />
                    </div>

                    {/* Bottom Info Cards: Stylized & Colorful */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Expertise Card */}
                        <div className="relative overflow-hidden bg-gradient-to-br from-[#137fec] to-[#0d59a8] rounded-[60px] p-12 text-white shadow-2xl group">
                            <div className="absolute top-[-10%] right-[-10%] size-64 bg-white/10 rounded-full blur-[80px]" />
                            <div className="relative z-10 space-y-8">
                                <div className="flex items-center gap-4">
                                    <div className="size-14 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center">
                                        <span className="material-symbols-outlined text-3xl">school</span>
                                    </div>
                                    <h4 className="text-xl font-black uppercase tracking-tighter italic">Áreas de Especialidade</h4>
                                </div>
                                <div className="flex flex-wrap gap-3">
                                    {disciplinas.filter(d => teacherData.disciplines_ids?.includes(d.id)).map(d => (
                                        <div key={d.id} className="px-6 py-3 bg-white/20 backdrop-blur-xl border border-white/20 rounded-2xl flex items-center gap-3 hover:bg-white hover:text-[#137fec] transition-all duration-500 cursor-default">
                                            <span className="material-symbols-outlined text-sm">check_circle</span>
                                            <span className="font-black text-xs uppercase tracking-widest">{d.name}</span>
                                        </div>
                                    ))}
                                    {(!teacherData.disciplines_ids || teacherData.disciplines_ids.length === 0) && (
                                        <p className="text-white/60 italic font-medium">Aguardando definição de disciplinas...</p>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Contact Card */}
                        <div className="group relative bg-slate-900 rounded-[60px] p-12 text-white shadow-2xl overflow-hidden">
                            <div className="absolute bottom-[-10%] left-[-10%] size-64 bg-[#137fec]/20 rounded-full blur-[80px]" />
                            <div className="relative z-10 space-y-8">
                                <div className="flex items-center gap-4">
                                    <div className="size-14 bg-blue-500/20 rounded-2xl flex items-center justify-center text-blue-400">
                                        <span className="material-symbols-outlined text-3xl">alternate_email</span>
                                    </div>
                                    <h4 className="text-xl font-black uppercase tracking-tighter italic text-blue-400">Contato Direto</h4>
                                </div>
                                <div className="space-y-2">
                                    <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.3em]">Email Corporativo</p>
                                    <p className="text-2xl md:text-3xl font-black tracking-tight hover:text-[#137fec] transition-colors">{teacherData.corporate_email || profile?.email}</p>
                                </div>
                                <div className="pt-4 border-t border-white/5 flex items-center gap-3">
                                    <div className="size-2 rounded-full bg-emerald-400" />
                                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Docente Oficial Verificado</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Gallery Section - Full Width at bottom if exists */}
                    {(teacherData.ad_images || []).length > 1 && (
                        <div className="space-y-8 pb-10">
                            <h3 className="text-sm font-black text-slate-400 uppercase tracking-[0.3em] flex items-center gap-4">
                                <span className="size-2 bg-[#137fec] rounded-full" />
                                Galeria de Mídia
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                                {(teacherData.ad_images || []).slice(1).map((img, i) => (
                                    <div key={i} className="aspect-square rounded-[48px] overflow-hidden shadow-xl hover:scale-105 transition-all duration-700 cursor-zoom-in">
                                        <img src={img} className="w-full h-full object-cover" alt={`Mídia ${i}`} />
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto pb-20 animate-in slide-in-from-right duration-500">
            {/* Form Header */}
            <div className="flex items-center justify-between mb-12">
                <div className="flex items-center gap-6">
                    <button 
                        onClick={() => setViewMode('preview')}
                        className="size-14 flex items-center justify-center bg-white border border-slate-200 rounded-2xl text-slate-400 hover:text-slate-900 transition-all"
                    >
                        <span className="material-symbols-outlined">arrow_back</span>
                    </button>
                    <div>
                        <h2 className="text-3xl font-black text-slate-900 tracking-tighter">Editando Meu Perfil</h2>
                        <p className="text-sm text-slate-500 font-bold uppercase tracking-widest opacity-60 italic">Mode de personalização avançada</p>
                    </div>
                </div>
                <div className="flex gap-4">
                    <button onClick={() => setViewMode('preview')} className="px-8 py-3 bg-white border border-slate-200 rounded-2xl font-black text-[10px] uppercase tracking-widest text-slate-400">Cancelar</button>
                    <button 
                        onClick={handleSave} 
                        disabled={saving}
                        className="px-10 py-3 bg-[#137fec] text-white rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-2xl shadow-blue-500/20 active:scale-95 disabled:opacity-50"
                    >
                        {saving ? 'Gravando...' : 'Salvar Alterações'}
                    </button>
                </div>
            </div>

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
                            <h3 className="text-sm font-black uppercase tracking-widest text-slate-800">Apresentação & Bio</h3>
                        </div>

                        <div className="space-y-4">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Biografia Profissional</label>
                            <TiptapEditor 
                                content={teacherData.description || ''}
                                onChange={v => setTeacherData(prev => ({ ...prev, description: v }))}
                                minHeight="400px"
                                placeholder="Descreva sua formação, conquistas e método de ensino..."
                            />
                        </div>
                    </div>
                </div>

                <div className="lg:col-span-4 space-y-8">
                    {/* Media Management */}
                    <div className="bg-white rounded-[48px] border border-slate-200 p-10 space-y-8">
                        <div className="text-center group relative">
                            <div 
                                className="size-32 rounded-[40px] mx-auto border-4 border-slate-50 shadow-xl overflow-hidden cursor-pointer relative"
                                onClick={() => avatarInputRef.current?.click()}
                            >
                                <img src={teacherData.avatar_url || 'https://picsum.photos/400/400'} className="w-full h-full object-cover" />
                                <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
                                    <span className="material-symbols-outlined text-white">upload</span>
                                </div>
                            </div>
                            <input type="file" ref={avatarInputRef} className="hidden" accept="image/*" onChange={handleAvatarUpload} />
                            <h4 className="mt-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Foto de Perfil</h4>
                        </div>

                        <div className="space-y-4">
                            <button 
                                onClick={() => bannerInputRef.current?.click()}
                                className="w-full h-14 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-[#137fec] transition-all"
                            >
                                <span className="material-symbols-outlined text-[18px]">panorama</span>
                                Trocar Banner Herói
                            </button>
                            <input type="file" ref={bannerInputRef} className="hidden" accept="image/*" onChange={handleBannerUpload} />
                        </div>

                        <div className="pt-6 border-t border-slate-50">
                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Galeria Auxiliar</h4>
                            <div className="grid grid-cols-2 gap-3">
                                {(teacherData.ad_images || []).map((img, i) => (
                                    <div key={i} className="aspect-square rounded-2xl overflow-hidden border-2 border-slate-50 relative group">
                                        <img src={img} className="w-full h-full object-cover" />
                                        <button 
                                            onClick={() => setTeacherData(prev => ({ ...prev, ad_images: prev.ad_images?.filter(x => x !== img) }))}
                                            className="absolute top-1 right-1 size-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all scale-75"
                                        >
                                            <span className="material-symbols-outlined text-[14px]">close</span>
                                        </button>
                                    </div>
                                ))}
                                <button 
                                    onClick={() => bannerInputRef.current?.click()}
                                    className="aspect-square rounded-2xl border-2 border-dashed border-slate-100 flex items-center justify-center text-slate-300 hover:text-blue-500"
                                >
                                    <span className="material-symbols-outlined">add</span>
                                </button>
                            </div>
                        </div>
                    </div>
                    
                    {/* Read-only disciplines during edit */}
                    <div className="bg-slate-50 rounded-[40px] p-8 space-y-4">
                         <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Disciplinas Atuais</h4>
                         <div className="flex flex-wrap gap-2">
                            {(teacherData.disciplines_ids || []).map(dId => (
                                <span key={dId} className="px-3 py-1.5 bg-white border border-slate-100 rounded-xl text-[10px] font-bold text-slate-600 uppercase">
                                    {disciplinas.find(d => d.id === dId)?.name}
                                </span>
                            ))}
                         </div>
                         <p className="text-[9px] text-slate-400 italic">Vínculos de disciplina são gerenciados apenas pelo Super Admin.</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ProfessorProfile;
