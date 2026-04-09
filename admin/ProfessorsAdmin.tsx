import React, { useState, useEffect, useRef, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { Teacher, Disciplina } from '../types';
import TiptapEditor from './TiptapEditor';

const ProfessorsAdmin: React.FC = () => {
    const [view, setView] = useState<'list' | 'form'>('list');
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [professors, setProfessors] = useState<Teacher[]>([]);
    const [disciplinas, setDisciplinas] = useState<Disciplina[]>([]);
    
    // Form State
    const [editingProfessor, setEditingProfessor] = useState<Teacher | null>(null);
    const [formData, setFormData] = useState<Partial<Teacher>>({
        name: '',
        description: '',
        status: 'Ativo',
        disciplines_ids: [],
        ad_images: [],
        avatar_url: '',
        corporate_email: '',
        linked_profile_id: ''
    });

    const [corporatePrefix, setCorporatePrefix] = useState('');
    const [profiles, setProfiles] = useState<any[]>([]);
    const [searchingProfile, setSearchingProfile] = useState(false);

    const avatarInputRef = useRef<HTMLInputElement>(null);
    const adImagesInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        fetchProfessors();
        fetchDisciplinas();
        fetchProfiles();
    }, []);

    const fetchProfiles = async () => {
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('id, full_name, email, role, avatar_url')
                .order('full_name');
            if (error) throw error;
            setProfiles(data || []);
        } catch (e) {
            console.error('Error fetching profiles:', e);
        }
    };

    const fetchProfessors = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase.from('teachers').select('*').order('created_at', { ascending: false });
            if (error) throw error;
            setProfessors(data || []);
        } catch (e: any) {
            alert('Erro ao carregar professores: ' + e.message);
        } finally {
            setLoading(false);
        }
    };

    const fetchDisciplinas = async () => {
        try {
            const { data, error } = await supabase.from('disciplinas').select('*').eq('status', 'Ativo').order('name');
            if (error) throw error;
            setDisciplinas(data || []);
        } catch (e: any) {
            console.error(e);
        }
    };

    const handleOpenForm = (prof?: Teacher) => {
        if (prof) {
            setEditingProfessor(prof);
            setFormData(prof);
        } else {
            setEditingProfessor(null);
            setFormData({
                name: '',
                description: '',
                status: 'Ativo',
                disciplines_ids: [],
                ad_images: [],
                avatar_url: '',
                corporate_email: '',
                linked_profile_id: ''
            });
        }
        setView('form');
    };

    const handleProfileLink = async (profileId: string) => {
        const selected = profiles.find(p => p.id === profileId);
        if (!selected) return;

        setFormData(prev => ({
            ...prev,
            linked_profile_id: profileId,
            name: prev.name || selected.full_name,
            avatar_url: prev.avatar_url || selected.avatar_url,
            corporate_email: selected.email
        }));

        // Automatically update the profile role to teacher if needed
        try {
            const { error } = await supabase
                .from('profiles')
                .update({ 
                    role: 'teacher',
                    allowed_modules: ['apostilas', 'simulados', 'cadernos', 'questoes'],
                    status: 'active'
                })
                .eq('id', profileId);
            if (error) throw error;
        } catch (e) {
            console.error('Error updating profile role:', e);
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
            alert('Erro no upload: ' + e.message);
            return null;
        } finally {
            setUploading(false);
        }
    };

    const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const url = await handleFileUpload(file, 'professors/avatars');
            if (url) setFormData({ ...formData, avatar_url: url });
        }
    };

    const handleAdImagesUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (files) {
            for (let i = 0; i < files.length; i++) {
                const url = await handleFileUpload(files[i], 'professors/ads');
                if (url) {
                    setFormData(prev => ({
                        ...prev,
                        ad_images: [...(prev.ad_images || []), url]
                    }));
                }
            }
        }
    };

    const removeAdImage = (url: string) => {
        setFormData({
            ...formData,
            ad_images: formData.ad_images?.filter(img => img !== url)
        });
    };

    const toggleDisciplina = (id: string) => {
        const current = formData.disciplines_ids || [];
        if (current.includes(id)) {
            setFormData({ ...formData, disciplines_ids: current.filter(dId => dId !== id) });
        } else {
            setFormData({ ...formData, disciplines_ids: [...current, id] });
        }
    };

    const handleSubmit = async () => {
        if (!formData.name) {
            alert('O nome do professor é obrigatório.');
            return;
        }

        setLoading(true);
        try {
            const payload = {
                ...formData,
                updated_at: new Date().toISOString()
            };

            if (editingProfessor) {
                const { error } = await supabase.from('teachers').update(payload).eq('id', editingProfessor.id);
                if (error) throw error;
                alert('Professor atualizado com sucesso!');
            } else {
                const { error } = await supabase.from('teachers').insert(payload);
                if (error) throw error;
                alert('Professor cadastrado com sucesso!');
            }

            fetchProfessors();
            setView('list');
        } catch (e: any) {
            alert('Erro ao salvar: ' + e.message);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm('Excluir este professor permanentemente?')) return;
        try {
            const { error } = await supabase.from('teachers').delete().eq('id', id);
            if (error) throw error;
            fetchProfessors();
        } catch (e: any) {
            alert('Erro ao excluir: ' + e.message);
        }
    };

    // Filter Logic
    const [searchTerm, setSearchTerm] = useState('');
    const filteredProfessors = professors.filter(p => 
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        p.description?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (view === 'form') {
        return (
            <div className="flex flex-col gap-8 pb-20 animate-in slide-in-from-right duration-500">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button onClick={() => setView('list')} className="size-12 flex items-center justify-center bg-white border border-slate-200 rounded-2xl text-slate-400 hover:text-slate-900 transition-all shadow-sm">
                            <span className="material-symbols-outlined">arrow_back</span>
                        </button>
                        <div>
                            <h2 className="text-3xl font-black text-[#111418] tracking-tight">{editingProfessor ? 'Editando Professor' : 'Novo Professor'}</h2>
                            <p className="text-sm text-slate-500 font-medium italic">Registre informações e fotos para propaganda e perfil público.</p>
                        </div>
                    </div>
                    <div className="flex gap-4">
                        <button onClick={() => setView('list')} className="px-8 py-3 bg-white border border-slate-200 rounded-2xl font-black text-[10px] uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-all">Cancelar</button>
                        <button onClick={handleSubmit} disabled={loading} className="px-10 py-3 bg-[#137fec] text-white rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-2xl shadow-blue-500/20 hover:bg-blue-600 transition-all active:scale-95 disabled:opacity-50">
                            {loading ? 'Processando...' : 'Salvar Professor'}
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
                    <div className="xl:col-span-8 space-y-6">
                        {/* Geral Card */}
                        <div className="bg-white rounded-[40px] border border-slate-200 shadow-sm p-10 space-y-8">
                            <div className="flex items-center gap-4 mb-2 border-b border-slate-50 pb-6">
                                <div className="size-10 bg-blue-50 text-blue-500 rounded-xl flex items-center justify-center">
                                    <span className="material-symbols-outlined">person</span>
                                </div>
                                <h3 className="text-sm font-black uppercase tracking-widest text-slate-800">Dados Básicos</h3>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Nome Completo</label>
                                    <input
                                        type="text"
                                        value={formData.name}
                                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                                        placeholder="Ex: Prof. Ricardo Pinheiro"
                                        className="w-full h-14 px-6 bg-slate-50 border border-slate-100 rounded-2xl text-lg font-black text-[#111418] outline-none focus:ring-4 focus:ring-blue-50 transition-all"
                                    />
                                </div>
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Status de Exibição</label>
                                    <select
                                        value={formData.status}
                                        onChange={e => setFormData({ ...formData, status: e.target.value as 'Ativo' | 'Inativo' })}
                                        className="w-full h-14 px-6 bg-slate-50 border border-slate-100 rounded-2xl outline-none font-black text-xs text-[#111418]"
                                    >
                                        <option value="Ativo">Publicado / Ativo</option>
                                        <option value="Inativo">Rascunho / Inativo</option>
                                    </select>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Bio / Descrição Profissional</label>
                                <TiptapEditor
                                    content={formData.description || ''}
                                    onChange={v => setFormData({ ...formData, description: v })}
                                    minHeight="300px"
                                    placeholder="Conte sobre a experiência do professor, formação e especialidades..."
                                />
                            </div>
                        </div>

                        {/* Acesso & E-mail Corporativo Card */}
                        <div className="bg-white rounded-[40px] border border-slate-200 shadow-sm p-10 space-y-8">
                            <div className="flex items-center gap-4 mb-2 border-b border-slate-50 pb-6">
                                <div className="size-10 bg-indigo-50 text-indigo-500 rounded-xl flex items-center justify-center">
                                    <span className="material-symbols-outlined">key</span>
                                </div>
                                <h3 className="text-sm font-black uppercase tracking-widest text-slate-800">Perfil de Acesso & Vinculação</h3>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div className="space-y-4">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Vincular Colaborador</label>
                                        <div className="relative group">
                                            <div className="absolute inset-y-0 left-0 pl-6 flex items-center pointer-events-none text-slate-400 group-focus-within:text-blue-500 transition-colors">
                                                <span className="material-symbols-outlined">person_add</span>
                                            </div>
                                            <select
                                                value={formData.linked_profile_id || ''}
                                                onChange={(e) => handleProfileLink(e.target.value)}
                                                className="w-full h-14 pl-14 pr-6 bg-slate-50 border border-slate-100 rounded-2xl outline-none text-sm font-bold text-[#111418] focus:border-blue-500 focus:bg-white transition-all appearance-none"
                                            >
                                                <option value="">Selecione um colaborador registrado...</option>
                                                {profiles.map(p => (
                                                    <option key={p.id} value={p.id}>{p.full_name} ({p.email})</option>
                                                ))}
                                            </select>
                                            <div className="absolute inset-y-0 right-0 pr-6 flex items-center pointer-events-none text-slate-400">
                                                <span className="material-symbols-outlined">unfold_more</span>
                                            </div>
                                        </div>
                                        <p className="text-[9px] text-slate-400 font-bold italic pl-1">Selecione o perfil do colaborador que será associado a este professor.</p>
                                    </div>

                                    <div className="space-y-4">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Status do Perfil vinculado</label>
                                        {formData.linked_profile_id ? (
                                            <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center justify-between animate-in fade-in duration-300">
                                                <div className="flex items-center gap-3">
                                                    <div className="size-10 rounded-full overflow-hidden border-2 border-white shadow-sm ring-1 ring-emerald-200">
                                                        <img src={profiles.find(p => p.id === formData.linked_profile_id)?.avatar_url || 'https://picsum.photos/50/50'} className="size-full object-cover" />
                                                    </div>
                                                    <div>
                                                        <p className="text-xs font-black text-emerald-900 leading-none mb-1">
                                                            {profiles.find(p => p.id === formData.linked_profile_id)?.full_name}
                                                        </p>
                                                        <p className="text-[9px] font-black uppercase tracking-widest text-emerald-600/60 leading-none">PERFIL VINCULADO</p>
                                                    </div>
                                                </div>
                                                <span className="material-symbols-outlined text-emerald-500">verified</span>
                                            </div>
                                        ) : (
                                            <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-between opacity-50">
                                                <div className="flex items-center gap-3">
                                                    <div className="size-10 bg-slate-200 rounded-full flex items-center justify-center text-slate-400">
                                                        <span className="material-symbols-outlined text-[20px]">link_off</span>
                                                    </div>
                                                    <p className="text-xs font-black text-slate-400 leading-none italic">Nenhum perfil vinculado ainda</p>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="p-8 bg-[#111418] rounded-[32px] text-white border border-slate-800 shadow-2xl space-y-4">
                                    <div className="flex items-center gap-3">
                                        <div className="size-8 bg-blue-500/20 text-blue-400 rounded-lg flex items-center justify-center">
                                            <span className="material-symbols-outlined text-[20px]">shield_person</span>
                                        </div>
                                        <h4 className="text-xs font-black uppercase tracking-widest">Informações de Acesso</h4>
                                    </div>
                                    <p className="text-xs text-slate-400 font-medium leading-relaxed">
                                        Ao vincular o colaborador, o sistema atualizará automaticamente o perfil dele para o cargo de <span className="text-blue-400 font-bold underline">Professor</span> e concederá acesso total à Gestão de Conteúdo (Apostilas, Simulados, Cadernos e Questões).
                                    </p>
                                </div>
                            </div>

                        {/* Propaganda Card */}
                        <div className="bg-white rounded-[40px] border border-slate-200 shadow-sm p-10 space-y-8">
                            <div className="flex items-center gap-4 mb-2 border-b border-slate-50 pb-6">
                                <div className="size-10 bg-amber-50 text-amber-500 rounded-xl flex items-center justify-center">
                                    <span className="material-symbols-outlined">campaign</span>
                                </div>
                                <h3 className="text-sm font-black uppercase tracking-widest text-slate-800">Materiais para Propaganda</h3>
                            </div>

                            <div className="space-y-6">
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    {formData.ad_images?.map((img, i) => (
                                        <div key={i} className="group relative aspect-square rounded-[32px] overflow-hidden border-4 border-slate-50 shadow-sm">
                                            <img src={img} className="w-full h-full object-cover" alt={`Ad ${i}`} />
                                            <button 
                                                onClick={() => removeAdImage(img)}
                                                className="absolute top-2 right-2 size-8 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all shadow-lg"
                                            >
                                                <span className="material-symbols-outlined text-[18px]">close</span>
                                            </button>
                                        </div>
                                    ))}
                                    <button 
                                        onClick={() => adImagesInputRef.current?.click()}
                                        disabled={uploading}
                                        className="aspect-square rounded-[32px] border-4 border-dashed border-slate-100 flex flex-col items-center justify-center gap-2 text-slate-300 hover:border-blue-200 hover:text-blue-400 hover:bg-blue-50 transition-all group"
                                    >
                                        <span className="material-symbols-outlined text-3xl group-hover:scale-110 transition-transform">add_photo_alternate</span>
                                        <span className="text-[10px] font-black uppercase tracking-widest">{uploading ? 'Enviando...' : 'Adicionar Foto'}</span>
                                    </button>
                                </div>
                                <input type="file" ref={adImagesInputRef} className="hidden" multiple accept="image/*" onChange={handleAdImagesUpload} />
                                <p className="text-[10px] font-bold text-slate-400 italic text-center">As fotos registradas aqui poderão ser selecionadas em modelos de Landing Page e Banners de propaganda.</p>
                            </div>
                        </div>
                    </div>

                    <div className="xl:col-span-4 space-y-6">
                        {/* Perfil Sidebar Card */}
                        <div className="bg-[#111418] rounded-[40px] p-8 text-white shadow-2xl sticky top-8 space-y-8">
                            <div className="text-center group relative">
                                <div 
                                    className="size-48 rounded-[60px] mx-auto border-4 border-white/10 shadow-2xl overflow-hidden cursor-pointer bg-slate-800"
                                    onClick={() => avatarInputRef.current?.click()}
                                >
                                    {formData.avatar_url ? (
                                        <img src={formData.avatar_url} className="w-full h-full object-cover" alt="Avatar" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-slate-600">
                                            <span className="material-symbols-outlined text-6xl">account_circle</span>
                                        </div>
                                    )}
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                        <span className="material-symbols-outlined text-white text-3xl">upload</span>
                                    </div>
                                </div>
                                <input type="file" ref={avatarInputRef} className="hidden" accept="image/*" onChange={handleAvatarUpload} />
                                <h4 className="mt-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Avatar Oficial</h4>
                            </div>

                            <div className="space-y-4">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-1 block">Disciplinas Ministradas</label>
                                <div className="bg-white/5 rounded-3xl border border-white/10 p-4 max-h-80 overflow-y-auto no-scrollbar space-y-2">
                                    {disciplinas.length === 0 && <p className="text-[10px] text-slate-600 italic text-center py-4">Nenhuma disciplina cadastrada.</p>}
                                    {disciplinas.map(d => (
                                        <label key={d.id} className={`flex items-center gap-3 p-3 rounded-2xl cursor-pointer transition-all ${formData.disciplines_ids?.includes(d.id) ? 'bg-blue-600/20 text-blue-400' : 'text-slate-400 hover:bg-white/10'}`}>
                                            <input 
                                                type="checkbox" 
                                                className="hidden" 
                                                checked={formData.disciplines_ids?.includes(d.id)}
                                                onChange={() => toggleDisciplina(d.id)}
                                            />
                                            <span className="material-symbols-outlined text-[20px]">{formData.disciplines_ids?.includes(d.id) ? 'check_box' : 'check_box_outline_blank'}</span>
                                            <span className="text-xs font-bold">{d.name}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-8 pb-10 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-[#111418] text-4xl font-black tracking-tighter">Corpo Docente</h2>
                    <p className="text-slate-500 font-medium">Gestão de professores, especialidades e materiais promocionais.</p>
                </div>
                <button
                    onClick={() => handleOpenForm()}
                    className="flex items-center gap-3 px-8 py-4 bg-[#137fec] text-white rounded-[20px] font-black text-xs uppercase tracking-widest shadow-2xl shadow-blue-500/20 hover:bg-blue-600 transition-all active:scale-95"
                >
                    <span className="material-symbols-outlined">person_add</span>
                    Cadastrar Professor
                </button>
            </div>

            <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4 items-center">
                <div className="flex-1 flex items-center gap-3 bg-slate-50 border border-slate-100 rounded-[20px] px-6 py-3 w-full">
                    <span className="material-symbols-outlined text-slate-300">search</span>
                    <input
                        type="text"
                        placeholder="Buscar por nome ou descrição..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="bg-transparent border-none outline-none text-sm font-bold w-full"
                    />
                </div>
                <div className="flex items-center gap-3">
                    <div className="px-5 py-3 bg-blue-50 text-blue-600 rounded-2xl text-[10px] font-black uppercase tracking-widest">
                        {professors.length} Professores
                    </div>
                    <button onClick={fetchProfessors} className="size-12 rounded-2xl bg-slate-100 text-slate-400 hover:text-blue-500 transition-all flex items-center justify-center">
                        <span className="material-symbols-outlined">sync</span>
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {filteredProfessors.map(p => (
                    <div key={p.id} className="group bg-white rounded-[40px] border border-slate-200 overflow-hidden shadow-sm hover:shadow-2xl hover:shadow-blue-500/10 transition-all duration-500 flex flex-col pt-10 px-8 pb-8 relative">
                        <div className="absolute top-6 right-8">
                            <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border ${p.status === 'Ativo' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-slate-50 text-slate-400 border-slate-100'}`}>
                                {p.status === 'Ativo' ? 'Ativo' : 'Rascunho'}
                            </span>
                        </div>

                        <div className="flex flex-col items-center text-center space-y-4">
                            <div className="size-28 rounded-[40px] border-4 border-slate-50 shadow-lg overflow-hidden shrink-0">
                                <img src={p.avatar_url || 'https://picsum.photos/200/200?random=' + p.id} className="w-full h-full object-cover" alt={p.name} />
                            </div>
                            <div>
                                <h3 className="text-xl font-black text-slate-900 group-hover:text-blue-600 transition-colors">{p.name}</h3>
                                <div className="flex flex-wrap justify-center gap-1.5 mt-2">
                                    {(p.disciplines_ids || []).slice(0, 3).map(dId => (
                                        <span key={dId} className="px-2.5 py-1 bg-slate-100 text-[8px] font-black text-slate-400 uppercase tracking-widest rounded-lg">
                                            {disciplinas.find(d => d.id === dId)?.name || 'Disciplina'}
                                        </span>
                                    ))}
                                    {(p.disciplines_ids || []).length > 3 && (
                                        <span className="px-2.5 py-1 bg-blue-50 text-[8px] font-black text-blue-400 uppercase tracking-widest rounded-lg">
                                            +{p.disciplines_ids.length - 3}
                                        </span>
                                    )}
                                </div>
                            </div>
                            <div className="text-xs text-slate-500 line-clamp-3 font-medium h-12 overflow-hidden" dangerouslySetInnerHTML={{ __html: p.description?.replace(/<[^>]*>?/gm, '') || '' }} />
                        </div>

                        <div className="mt-8 pt-6 border-t border-slate-50 flex items-center justify-between">
                            <div className="flex -space-x-3 overflow-hidden">
                                {(p.ad_images || []).slice(0, 4).map((img, i) => (
                                    <div key={i} className="inline-block size-8 rounded-lg ring-4 ring-white overflow-hidden bg-slate-100">
                                        <img className="w-full h-full object-cover" src={img} alt="" />
                                    </div>
                                ))}
                                {(p.ad_images || []).length > 4 && (
                                    <div className="size-8 rounded-lg ring-4 ring-white bg-slate-900 flex items-center justify-center text-[10px] font-black text-white">
                                        +{p.ad_images.length - 4}
                                    </div>
                                )}
                            </div>

                            <div className="flex gap-2">
                                <button
                                    onClick={() => handleOpenForm(p)}
                                    className="size-10 flex items-center justify-center bg-slate-50 text-slate-400 hover:bg-blue-50 hover:text-blue-600 rounded-xl transition-all"
                                    title="Editar Perfil"
                                >
                                    <span className="material-symbols-outlined text-[20px]">edit_note</span>
                                </button>
                                <button
                                    onClick={() => handleDelete(p.id)}
                                    className="size-10 flex items-center justify-center bg-slate-50 text-slate-400 hover:bg-red-50 hover:text-red-500 rounded-xl transition-all"
                                    title="Remover"
                                >
                                    <span className="material-symbols-outlined text-[20px]">delete_sweep</span>
                                </button>
                            </div>
                        </div>
                    </div>
                ))}

                {filteredProfessors.length === 0 && (
                    <div className="col-span-full py-32 flex flex-col items-center justify-center text-slate-300 gap-4">
                        <span className="material-symbols-outlined text-7xl">person_off</span>
                        <p className="font-bold text-sm italic">Nenhum professor encontrado nesta seleção.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ProfessorsAdmin;
