import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useLocation } from 'react-router-dom';

const formatPhone = (value: string) => {
    return value
        .replace(/\D/g, '')
        .replace(/^(\d{2})(\d)/g, '($1) $2')
        .replace(/(\d)(\d{4})$/, '$1-$2')
        .slice(0, 15);
};

const formatCPF = (value: string) => {
    return value
        .replace(/\D/g, '')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d{1,2})/, '$1-$2')
        .replace(/(-\d{2})\d+?$/, '$1');
};

interface Experience {
    id: string;
    role: string;
    company: string;
    period: string;
    description: string;
}

interface Certificate {
    id: string;
    title: string;
    institution: string;
    year: string;
    url?: string;
}

interface ProfileData {
    full_name: string;
    email: string;
    phone: string;
    is_whatsapp: boolean;
    cpf: string;
    birth_date: string;
    education_level: string;
    study_area: string;
    bio: string;
    avatar_url: string;

    experiences: Experience[];
    certificates: Certificate[];
    role?: string;
}

const ProfileConfig: React.FC = () => {
    const location = useLocation();
    const isStudent = location.pathname.includes('/aluno/');

    const [activeSection, setActiveSection] = useState<'pessoal' | 'profissional' | 'experiencia' | 'seguranca'>('pessoal');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    const [profile, setProfile] = useState<ProfileData>({
        full_name: '',
        email: '',
        phone: '',
        is_whatsapp: false,
        cpf: '',
        birth_date: '',
        education_level: 'Superior Completo',
        study_area: '',
        bio: '',
        avatar_url: '',

        experiences: [],
        certificates: [],
        role: 'student'
    });

    const [passwords, setPasswords] = useState({
        current: '',
        new: '',
        confirm: ''
    });

    const [isResettingPassword, setIsResettingPassword] = useState(false);
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    // Temp state for new items
    const [newExp, setNewExp] = useState<Partial<Experience>>({});
    const [newCert, setNewCert] = useState<Partial<Certificate>>({});

    useEffect(() => {
        fetchProfile();
    }, []);

    const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setSaving(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const fileExt = file.name.split('.').pop();
            const fileName = `${user.id}-${Math.random()}.${fileExt}`;
            const filePath = fileName;

            const { error: uploadError } = await supabase.storage
                .from('avatars')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('avatars')
                .getPublicUrl(filePath);

            setProfile(prev => ({ ...prev, avatar_url: publicUrl }));
            setMessage({ type: 'success', text: 'Imagem carregada! Não esqueça de salvar as alterações.' });
        } catch (err: any) {
            console.error('Error uploading avatar:', err);
            setMessage({ type: 'error', text: 'Erro ao carregar imagem.' });
        } finally {
            setSaving(false);
        }
    };

    const fetchProfile = async () => {
        setLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data: profileData, error } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('id', user.id)
                    .single();

                if (error && error.code !== 'PGRST116') throw error;

                if (profileData) {
                    setProfile({
                        full_name: profileData.full_name || '',
                        email: user.email || '',
                        phone: profileData.phone || '',
                        is_whatsapp: profileData.is_whatsapp || false,
                        cpf: profileData.cpf || '',
                        birth_date: profileData.birth_date || '',
                        education_level: profileData.education_level || 'Superior Completo',
                        study_area: profileData.study_area || '',
                        bio: profileData.bio || '',
                        avatar_url: profileData.avatar_url || '',
                        experiences: profileData.experiences || [],
                        certificates: profileData.certificates || [],
                        role: profileData.role || (isStudent ? 'student' : 'admin')
                    });
                } else {
                    setProfile(prev => ({ ...prev, email: user.email || '', role: 'student' }));
                }
            }
        } catch (e: any) {
            // Se o erro for 406 (Not Acceptable) ou PGRST116, significa que nenhum perfil foi encontrado
            // Nesse caso, apenas permitimos que o usuário crie um novo (estado inicial já está setado)
            if (e.code === 'PGRST116' || e.message?.includes('406')) {
                console.log('Perfil não encontrado, permitindo criação.');
            } else {
                console.error('Error fetching profile:', e);
            }
        } finally {
            setLoading(false);
        }
    };

    const handleSaveProfile = async () => {
        setSaving(true);
        setMessage(null);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { error } = await supabase
                .from('profiles')
                .upsert({
                    id: user.id,
                    full_name: profile.full_name,
                    phone: profile.phone,
                    is_whatsapp: profile.is_whatsapp,
                    cpf: profile.cpf,
                    birth_date: profile.birth_date,
                    education_level: profile.education_level,
                    study_area: profile.study_area,
                    bio: profile.bio,
                    avatar_url: profile.avatar_url,
                    experiences: profile.experiences,
                    certificates: profile.certificates,
                    role: profile.role,
                    updated_at: new Date().toISOString()
                });

            if (error) throw error;
            setMessage({ type: 'success', text: 'Perfil atualizado com sucesso!' });
        } catch (e: any) {
            console.error('Error saving profile:', e);
            setMessage({ type: 'error', text: e.message || 'Erro ao atualizar perfil.' });
        } finally {
            setSaving(false);
        }
    };

    const handleUpdatePassword = async () => {
        if (passwords.new !== passwords.confirm) {
            alert('A nova senha e a confirmação não coincidem.');
            return;
        }

        setSaving(true);
        try {
            const { error } = await supabase.auth.updateUser({ password: passwords.new });
            if (error) throw error;
            alert('Senha atualizada com sucesso!');
            setIsResettingPassword(false);
            setPasswords({ current: '', new: '', confirm: '' });
        } catch (e: any) {
            alert(e.message || 'Erro ao atualizar senha.');
        } finally {
            setSaving(false);
        }
    };

    // Experience Management
    const addExperience = () => {
        if (!newExp.role || !newExp.company) return;
        const exp: Experience = {
            id: Math.random().toString(36).substr(2, 9),
            role: newExp.role,
            company: newExp.company,
            period: newExp.period || '',
            description: newExp.description || ''
        };
        setProfile(prev => ({ ...prev, experiences: [...prev.experiences, exp] }));
        setNewExp({});
    };

    const removeExperience = (id: string) => {
        setProfile(prev => ({ ...prev, experiences: prev.experiences.filter(e => e.id !== id) }));
    };

    // Certificate Management
    const addCertificate = () => {
        if (!newCert.title || !newCert.institution) return;
        const cert: Certificate = {
            id: Math.random().toString(36).substr(2, 9),
            title: newCert.title,
            institution: newCert.institution,
            year: newCert.year || '',
            url: newCert.url || ''
        };
        setProfile(prev => ({ ...prev, certificates: [...prev.certificates, cert] }));
        setNewCert({});
    };

    const removeCertificate = (id: string) => {
        setProfile(prev => ({ ...prev, certificates: prev.certificates.filter(c => c.id !== id) }));
    };

    const sections = [
        { id: 'pessoal', label: 'Dados Pessoais', icon: 'person' },
        { id: 'profissional', label: 'Sobre Mim', icon: 'history_edu' },
        ...(isStudent ? [] : [{ id: 'experiencia', label: 'Currículo', icon: 'work_history' }]),
        { id: 'seguranca', label: 'Segurança', icon: 'lock' },
    ];

    if (loading) return (
        <div className="flex h-96 items-center justify-center">
            <div className="size-12 border-4 border-slate-100 border-t-blue-600 rounded-full animate-spin"></div>
        </div>
    );

    return (
        <div className="max-w-5xl mx-auto flex flex-col lg:flex-row gap-8 pb-20 animate-in fade-in duration-500">
            {/* Sidebar de Navegação */}
            <div className="w-full lg:w-72 shrink-0 space-y-4">
                <div className="bg-white rounded-[32px] border border-slate-200 p-6 shadow-sm">
                    <div className="flex flex-col items-center text-center mb-8">
                        <div className="relative group">
                            <div className="size-24 rounded-[32px] overflow-hidden border-4 border-slate-50 shadow-inner mb-4 bg-slate-100 flex items-center justify-center relative">
                                <img src={profile.avatar_url || '/bora_passar_logo.png'} alt="Perfil" className={`size-full ${profile.avatar_url ? 'object-cover' : 'object-contain p-4 opacity-80'}`} />
                            </div>
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className="absolute bottom-2 right-0 size-8 bg-slate-900 text-white rounded-xl flex items-center justify-center hover:scale-110 transition-all shadow-lg active:scale-95"
                            >
                                <span className="material-symbols-outlined text-sm">photo_camera</span>
                            </button>
                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleAvatarUpload}
                                accept="image/*"
                                className="hidden"
                            />
                        </div>
                        <h3 className="font-black text-slate-900 uppercase tracking-tight line-clamp-1">{profile.full_name || 'Usuário'}</h3>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest line-clamp-1">{profile.email}</p>
                    </div>

                    <div className="space-y-1">
                        {sections.map(section => (
                            <button
                                key={section.id}
                                onClick={() => setActiveSection(section.id as any)}
                                className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all ${activeSection === section.id
                                    ? 'bg-slate-900 text-white shadow-lg'
                                    : 'text-slate-400 hover:bg-slate-50 hover:text-slate-600'
                                    }`}
                            >
                                <span className="material-symbols-outlined text-[18px]">{section.icon}</span>
                                {section.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Área de Conteúdo */}
            <div className="flex-1">
                <div className="bg-white rounded-[40px] border border-slate-200 shadow-sm p-8 md:p-10 min-h-[600px] flex flex-col">
                    {message && (
                        <div className={`mb-8 p-4 rounded-2xl flex items-center gap-3 text-xs font-black uppercase tracking-widest animate-in slide-in-from-top-2 ${message.type === 'success' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                            <span className="material-symbols-outlined">{message.type === 'success' ? 'check_circle' : 'report'}</span>
                            {message.text}
                        </div>
                    )}

                    <div className="flex-1">
                        {activeSection === 'pessoal' && (
                            <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
                                <div>
                                    <h2 className="text-2xl font-black text-slate-900 uppercase">Dados Pessoais</h2>
                                    <div className="h-1 w-10 bg-[#ff3b9a] rounded-full mt-2"></div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Nome Completo</label>
                                        <input type="text" value={profile.full_name} onChange={(e) => setProfile({ ...profile, full_name: e.target.value })} className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none focus:border-slate-900 focus:bg-white transition-all" />
                                    </div>
                                    <div className="space-y-2 opacity-60">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">E-mail (Não Alterável)</label>
                                        <input type="email" value={profile.email} readOnly className="w-full h-12 px-4 bg-slate-100 border border-slate-200 rounded-2xl font-bold cursor-not-allowed outline-none" />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">WhatsApp / Telefone</label>
                                        <div className="flex flex-col gap-2">
                                            <input
                                                type="text"
                                                value={profile.phone}
                                                onChange={(e) => setProfile({ ...profile, phone: formatPhone(e.target.value) })}
                                                placeholder="(00) 00000-0000"
                                                maxLength={15}
                                                className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none focus:border-slate-900 focus:bg-white transition-all"
                                            />
                                            <label className="flex items-center gap-2 cursor-pointer pl-1">
                                                <input
                                                    type="checkbox"
                                                    checked={profile.is_whatsapp}
                                                    onChange={(e) => setProfile({ ...profile, is_whatsapp: e.target.checked })}
                                                    className="size-4 rounded border-slate-300 text-slate-900 focus:ring-offset-0 focus:ring-0"
                                                />
                                                <span className="text-xs font-bold text-slate-600">Este número é WhatsApp</span>
                                            </label>
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">CPF</label>
                                        <input
                                            type="text"
                                            value={profile.cpf}
                                            onChange={(e) => setProfile({ ...profile, cpf: formatCPF(e.target.value) })}
                                            placeholder="000.000.000-00"
                                            maxLength={14}
                                            className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none focus:border-slate-900 focus:bg-white transition-all"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Data de Nascimento</label>
                                        <input type="date" value={profile.birth_date} onChange={(e) => setProfile({ ...profile, birth_date: e.target.value })} className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none focus:border-slate-900 focus:bg-white transition-all" />
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeSection === 'profissional' && (
                            <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
                                <div>
                                    <h2 className="text-2xl font-black text-slate-900 uppercase">Perfil Acadêmico</h2>
                                    <div className="h-1 w-10 bg-[#137fec] rounded-full mt-2"></div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Escolaridade</label>
                                        <select value={profile.education_level} onChange={(e) => setProfile({ ...profile, education_level: e.target.value })} className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none focus:border-slate-900 transition-all appearance-none">
                                            <option>Ensino Médio</option>
                                            <option>Ensino Superior Incompleto</option>
                                            <option>Ensino Superior Completo</option>
                                            <option>Pós-Graduação</option>
                                        </select>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Foco / Área de Estudo</label>
                                        <input type="text" value={profile.study_area} onChange={(e) => setProfile({ ...profile, study_area: e.target.value })} placeholder="Ex: Carreiras Policiais" className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none focus:border-slate-900 transition-all" />
                                    </div>
                                    <div className="md:col-span-2 space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Sua Biografia / Objetivos</label>
                                        <textarea
                                            value={profile.bio}
                                            onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
                                            rows={4}
                                            className="w-full p-6 bg-slate-50 border border-slate-200 rounded-[32px] font-medium outline-none focus:border-slate-900 transition-all resize-none"
                                            placeholder="Conte um pouco sobre seus objetivos..."
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeSection === 'experiencia' && (
                            <div className="space-y-10 animate-in fade-in slide-in-from-right-4 duration-300">
                                <div>
                                    <h2 className="text-2xl font-black text-slate-900 uppercase">Experiências & Formação</h2>
                                    <div className="h-1 w-10 bg-amber-500 rounded-full mt-2"></div>
                                </div>

                                {/* Experiências */}
                                <div className="space-y-6">
                                    <h3 className="text-sm font-black text-slate-600 uppercase tracking-widest border-b pb-2">Experiência Profissional</h3>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-6 rounded-[32px] border border-slate-100">
                                        <input placeholder="Cargo (Ex: Policial Civil)" value={newExp.role || ''} onChange={e => setNewExp({ ...newExp, role: e.target.value })} className="px-4 py-3 rounded-xl border-none font-bold text-sm text-slate-700 outline-none" />
                                        <input placeholder="Instituição/Empresa" value={newExp.company || ''} onChange={e => setNewExp({ ...newExp, company: e.target.value })} className="px-4 py-3 rounded-xl border-none font-bold text-sm text-slate-700 outline-none" />
                                        <input placeholder="Período (Ex: 2018 - Atual)" value={newExp.period || ''} onChange={e => setNewExp({ ...newExp, period: e.target.value })} className="px-4 py-3 rounded-xl border-none font-bold text-sm text-slate-700 outline-none" />
                                        <button onClick={addExperience} className="bg-slate-900 text-white rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-800 transition-all">Adicionar</button>
                                        <textarea placeholder="Breve descrição das atividades..." value={newExp.description || ''} onChange={e => setNewExp({ ...newExp, description: e.target.value })} className="md:col-span-2 px-4 py-3 rounded-xl border-none font-medium text-sm text-slate-600 outline-none resize-none h-20" />
                                    </div>

                                    <div className="space-y-3">
                                        {profile.experiences.map(exp => (
                                            <div key={exp.id} className="flex justify-between items-start bg-white border border-slate-100 p-6 rounded-2xl shadow-sm hover:shadow-md transition-all group">
                                                <div>
                                                    <h4 className="font-black text-slate-800">{exp.role}</h4>
                                                    <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">{exp.company} • {exp.period}</p>
                                                    {exp.description && <p className="text-sm text-slate-600 mt-2 leading-relaxed">{exp.description}</p>}
                                                </div>
                                                <button onClick={() => removeExperience(exp.id)} className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 p-2"><span className="material-symbols-outlined">delete</span></button>
                                            </div>
                                        ))}
                                        {profile.experiences.length === 0 && <p className="text-xs text-slate-400 italic text-center py-4">Nenhuma experiência adicionada.</p>}
                                    </div>
                                </div>

                                {/* Cursos/Certificados */}
                                <div className="space-y-6 pt-4">
                                    <h3 className="text-sm font-black text-slate-600 uppercase tracking-widest border-b pb-2">Cursos & Certificados</h3>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-6 rounded-[32px] border border-slate-100">
                                        <input placeholder="Nome do Curso/Certificado" value={newCert.title || ''} onChange={e => setNewCert({ ...newCert, title: e.target.value })} className="px-4 py-3 rounded-xl border-none font-bold text-sm text-slate-700 outline-none" />
                                        <input placeholder="Instituição Emissora" value={newCert.institution || ''} onChange={e => setNewCert({ ...newCert, institution: e.target.value })} className="px-4 py-3 rounded-xl border-none font-bold text-sm text-slate-700 outline-none" />
                                        <input placeholder="Ano de Conclusão" value={newCert.year || ''} onChange={e => setNewCert({ ...newCert, year: e.target.value })} className="px-4 py-3 rounded-xl border-none font-bold text-sm text-slate-700 outline-none" />
                                        <button onClick={addCertificate} className="bg-slate-900 text-white rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-800 transition-all">Adicionar</button>
                                    </div>

                                    <div className="space-y-3">
                                        {profile.certificates.map(cert => (
                                            <div key={cert.id} className="flex justify-between items-center bg-white border border-slate-100 p-4 rounded-2xl shadow-sm hover:shadow-md transition-all group">
                                                <div className="flex items-center gap-4">
                                                    <div className="size-10 bg-blue-50 text-blue-500 rounded-xl flex items-center justify-center shrink-0">
                                                        <span className="material-symbols-outlined">workspace_premium</span>
                                                    </div>
                                                    <div>
                                                        <h4 className="font-bold text-slate-800 text-sm">{cert.title}</h4>
                                                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{cert.institution} • {cert.year}</p>
                                                    </div>
                                                </div>
                                                <button onClick={() => removeCertificate(cert.id)} className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 p-2"><span className="material-symbols-outlined">delete</span></button>
                                            </div>
                                        ))}
                                        {profile.certificates.length === 0 && <p className="text-xs text-slate-400 italic text-center py-4">Nenhum certificado adicionado.</p>}
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeSection === 'seguranca' && (
                            <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
                                <div>
                                    <h2 className="text-2xl font-black text-slate-900 uppercase">Segurança</h2>
                                    <div className="h-1 w-10 bg-slate-900 rounded-full mt-2"></div>
                                </div>
                                <div className="p-10 border-2 border-dashed border-slate-100 rounded-[40px] flex flex-col items-center justify-center text-center space-y-6">
                                    <div className="size-20 bg-slate-50 text-slate-300 rounded-[32px] flex items-center justify-center">
                                        <span className="material-symbols-outlined text-4xl">lock_reset</span>
                                    </div>
                                    <div>
                                        <h4 className="font-black text-slate-900 uppercase tracking-tight">Alterar Senha</h4>
                                        <p className="text-sm text-slate-400 max-w-md mx-auto">Recomendamos trocar sua senha periodicamente para manter sua conta segura.</p>
                                    </div>
                                    <button onClick={() => setIsResettingPassword(true)} className="px-10 py-4 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-slate-900/20 hover:scale-105 transition-all">Trocar senha agora</button>
                                </div>
                            </div>
                        )}
                    </div>

                    {activeSection !== 'seguranca' && (
                        <div className="mt-12 pt-8 border-t border-slate-100 flex justify-end gap-3">
                            <button onClick={fetchProfile} className="px-8 py-3 bg-slate-100 text-slate-600 rounded-2xl font-bold text-sm hover:bg-slate-200 transition-all">Descartar</button>
                            <button onClick={handleSaveProfile} disabled={saving} className="px-10 py-3 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-slate-900/20 hover:scale-105 active:scale-95 transition-all disabled:opacity-50">{saving ? 'Salvando...' : 'Salvar Alterações'}</button>
                        </div>
                    )}
                </div>
            </div>

            {/* Modal Redefinir Senha */}
            {isResettingPassword && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsResettingPassword(false)}></div>
                    <div className="relative bg-white w-full max-w-md rounded-[40px] shadow-2xl p-10 animate-in zoom-in-95 duration-200">
                        <div className="text-center space-y-4 mb-8">
                            <div className="size-16 bg-slate-100 text-slate-900 rounded-2xl flex items-center justify-center mx-auto">
                                <span className="material-symbols-outlined text-3xl">password</span>
                            </div>
                            <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Nova Senha</h3>
                            <p className="text-sm text-slate-400 font-medium">Crie uma senha forte com pelo menos 8 caracteres.</p>
                        </div>

                        <div className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Nova Senha</label>
                                <input type="password" value={passwords.new} onChange={e => setPasswords({ ...passwords, new: e.target.value })} placeholder="••••••••" className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none focus:border-slate-900" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Confirmar Nova Senha</label>
                                <input type="password" value={passwords.confirm} onChange={e => setPasswords({ ...passwords, confirm: e.target.value })} placeholder="••••••••" className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none focus:border-slate-900" />
                            </div>

                            <div className="flex gap-3 pt-4">
                                <button onClick={() => { setIsResettingPassword(false); setPasswords({ current: '', new: '', confirm: '' }); }} className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-bold hover:bg-slate-200 transition-all uppercase tracking-widest text-[10px]">Cancelar</button>
                                <button onClick={handleUpdatePassword} disabled={saving} className="flex-1 py-4 bg-slate-900 text-white rounded-2xl font-black shadow-xl shadow-slate-900/20 hover:scale-105 transition-all uppercase tracking-widest text-[10px] disabled:opacity-50">{saving ? 'Aguarde...' : 'Redefinir'}</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProfileConfig;
