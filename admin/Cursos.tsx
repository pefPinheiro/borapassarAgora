import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Apostila, Disciplina, Simulado, Profile, Assunto } from '../types';
import TiptapEditor from './TiptapEditor';

interface Banca {
    id: string;
    name: string;
    sigla: string;
}

interface CourseDb {
    id: string;
    title: string;
    description: string;
    area: string;
    cargo: string;
    banca_id: string;
    banner_url: string;
    video_url: string;
    video_type: 'url' | 'upload';
    price_base: number;
    price_offer: number;
    discount_type: 'valor' | 'porcentagem';
    discount_value: number;
    access_days: number;
    coupon_name: string;
    status: 'Ativo' | 'Rascunho';
    state?: string;
    is_notice_open?: boolean;
    test_date?: string;
    created_at: string;
    bancas?: { name: string };
    lp_model?: string;
    lp_style?: string;
    lp_config?: any;
    pix_discount?: number;
    commission_percentage?: number;
    investor_percentage?: number;
    coupons_json?: { name: string, discount_type: 'valor' | 'porcentagem', discount_value: number }[];
    lp_images?: string[];
}

interface MaterialItem {
    id?: string;
    title: string;
    url: string;
    type: 'link' | 'pdf' | 'image' | 'video';
    position: number;
}

interface CourseNotice {
    id: string;
    title: string;
    content: string;
    created_at: string;
}

const Cursos: React.FC = () => {
    const [view, setView] = useState<'list' | 'form' | 'notice'>('list');
    const [activeTab, setActiveTab] = useState<'geral' | 'apostilas' | 'simulados' | 'materiais' | 'financeiro' | 'landing'>('geral');
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [courses, setCourses] = useState<CourseDb[]>([]);

    // Form State
    const [editingCourse, setEditingCourse] = useState<CourseDb | null>(null);
    const [promoConfig, setPromoConfig] = useState({ isActive: false, title: '' });
    const [formData, setFormData] = useState<Partial<CourseDb>>({
        title: '', description: '', area: '', cargo: '', banca_id: '',
        video_type: 'url', video_url: '', price_base: 0, price_offer: 0,
        discount_type: 'valor', discount_value: 0, access_days: 365,
        status: 'Ativo', coupon_name: '', banner_url: '',
        lp_model: 'standard', lp_style: 'style-blue',
        state: 'Nacional',
        is_notice_open: false,
        test_date: '',
        pix_discount: 0,
        commission_percentage: 50,
        coupons_json: [],
        lp_images: []
    });

    // Content States
    const [selectedApostilas, setSelectedApostilas] = useState<{ id: string, position: number }[]>([]);
    const [selectedSimulados, setSelectedSimulados] = useState<{ id: string, position: number, release_days: number }[]>([]);
    const [materials, setMaterials] = useState<MaterialItem[]>([]);

    // Aux Lists
    const [allApostilas, setAllApostilas] = useState<Apostila[]>([]);
    const [allSimulados, setAllSimulados] = useState<Simulado[]>([]);
    const [bancas, setBancas] = useState<Banca[]>([]);
    const [disciplinas, setDisciplinas] = useState<Disciplina[]>([]);
    const [assuntos, setAssuntos] = useState<Assunto[]>([]);

    // Filters
    const [apostilaSearch, setApostilaSearch] = useState('');
    const [apostilaFilterDisc, setApostilaFilterDisc] = useState('');
    const [apostilaFilterSubject, setApostilaFilterSubject] = useState('');
    const [simuladoSearch, setSimuladoSearch] = useState('');

    // Notice Management
    const [selectedCourseForNotice, setSelectedCourseForNotice] = useState<CourseDb | null>(null);
    const [courseNotices, setCourseNotices] = useState<CourseNotice[]>([]);
    const [noticeData, setNoticeData] = useState({ title: '', content: '' });

    const [filterSearch, setFilterSearch] = useState('');
    const [filterArea, setFilterArea] = useState('');

    const [lpSelectionModalOpen, setLpSelectionModalOpen] = useState(false);
    const [selectedCourseForLP, setSelectedCourseForLP] = useState<CourseDb | null>(null);

    const [totalActiveQuotas, setTotalActiveQuotas] = useState(0);
    const [totalGeneralCommissionReceivers, setTotalGeneralCommissionReceivers] = useState(0);

    const bannerInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        fetchCourses();
        fetchAuxData();
    }, []);

    const fetchCourses = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase.from('courses').select('*, bancas(name)').order('created_at', { ascending: false });
            if (error) {
                console.error('Error fetching courses:', error);
                // Try simpler fetch if relation fails
                const { data: retryData, error: retryError } = await supabase.from('courses').select('*').order('created_at', { ascending: false });
                if (retryError) {
                    alert('Erro ao carregar cursos: ' + retryError.message);
                    return;
                }
                setCourses(retryData || []);
                return;
            }
            setCourses(data || []);
        } catch (error: any) {
            console.error('Unexpected error fetching courses:', error);
            alert('Erro inesperado: ' + error.message);
        } finally { setLoading(false); }
    };

    const fetchAuxData = async () => {
        // Fetch Apostilas
        try {
            const { data, error } = await supabase.from('apostilas').select('*, disciplinas(name), assuntos(name)').order('title');
            if (error) console.error('Error fetching apostilas:', error);
            else setAllApostilas(data || []);
        } catch (e) { console.error(e); }

        // Fetch Bancas
        try {
            const { data, error } = await supabase.from('bancas').select('id, name, sigla').order('name');
            if (error) console.error('Error fetching bancas:', error);
            else setBancas(data as Banca[] || []);
        } catch (e) { console.error(e); }

        // Fetch Disciplinas
        try {
            const { data, error } = await supabase.from('disciplinas').select('*').eq('status', 'Ativo').order('name');
            if (error) console.error('Error fetching disciplinas:', error);
            else setDisciplinas(data || []);
        } catch (e) { console.error(e); }

        // Fetch Assuntos
        try {
            // Only fetching active subjects
            const { data, error } = await supabase.from('assuntos').select('*').eq('status', 'Ativo').order('name');
            if (error) console.error('Error fetching assuntos:', error);
            else setAssuntos(data || []);
        } catch (e) { console.error(e); }

        // Fetch Simulados
        try {
            // Try fetching with relation
            const { data, error } = await supabase.from('simulados').select('*, bancas(name)').order('title');
            if (error) {
                console.warn('Error fetching simulados with bancas relation, retrying without:', error);
                const { data: retryData } = await supabase.from('simulados').select('*').order('title');
                setAllSimulados(retryData || []);
            }
            else {
                setAllSimulados(data || []);
            }
        } catch (e) { console.error(e); }

        // Fetch Total Active Quotas for Preview
        try {
            const { data } = await supabase.from('investor_quotas').select('quantity').eq('status', 'active');
            const total = data?.reduce((acc, curr) => acc + (curr.quantity || 0), 0) || 0;
            setTotalActiveQuotas(total);
        } catch (e) { console.error(e); }

        // Fetch Count of General Commission Receivers
        try {
            const { count } = await supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('receive_general_commission', true);
            setTotalGeneralCommissionReceivers(count || 0);
        } catch (e) { console.error('Error fetching general commission receivers:', e); }
    };

    const handleOpenForm = async (course?: CourseDb) => {
        if (course) {
            const promoObj = (course.coupons_json || []).find(c => c.name.startsWith('__PROMO__'));
            setPromoConfig({ isActive: !!promoObj, title: promoObj ? promoObj.name.replace('__PROMO__', '') : '' });
            
            const filteredCoupons = (course.coupons_json || []).filter(c => !c.name.startsWith('__PROMO__'));
            
            setEditingCourse(course);
            setFormData({ ...course, coupons_json: filteredCoupons });

            const [aps, sims, mats] = await Promise.all([
                supabase.from('course_items').select('apostila_id, position').eq('course_id', course.id).order('position'),
                supabase.from('course_simulados').select('simulado_id, position, release_days').eq('course_id', course.id).order('position'),
                supabase.from('course_materials').select('*').eq('course_id', course.id).order('position')
            ]);

            setSelectedApostilas(aps.data?.map(a => ({ id: a.apostila_id, position: a.position })) || []);
            setSelectedSimulados(sims.data?.map(s => ({ id: s.simulado_id, position: s.position, release_days: s.release_days })) || []);
            setMaterials(mats.data || []);
        } else {
            setPromoConfig({ isActive: false, title: '' });
            setEditingCourse(null);
            setFormData({
                title: '', description: '', area: '', cargo: '', banca_id: '',
                video_type: 'url', video_url: '', price_base: 0, price_offer: 0,
                discount_type: 'valor', discount_value: 0, access_days: 365,
                status: 'Ativo', coupon_name: '', banner_url: '',
                lp_model: 'standard', lp_style: 'style-blue',
                state: 'Nacional',
                is_notice_open: false,
                test_date: '',
                commission_percentage: 50
            });
            setSelectedApostilas([]);
            setSelectedSimulados([]);
            setMaterials([]);
        }
        setView('form');
        setActiveTab('geral');
    };

    const handleSubmit = async () => {
        setLoading(true);
        try {
            const { id, created_at, bancas, lp_config, ...cleanData } = formData as any;
            
            // Handle Promo Serializing
            const validCoupons = (cleanData.coupons_json || []).filter((c: any) => !c.name.startsWith('__PROMO__'));
            if (promoConfig.isActive && promoConfig.title) {
                validCoupons.push({ name: `__PROMO__${promoConfig.title}`, discount_type: 'valor', discount_value: 0 });
            }
            cleanData.coupons_json = validCoupons;

            const payload = { ...cleanData, updated_at: new Date().toISOString() };
            if (!payload.banca_id) delete payload.banca_id;
            if (payload.test_date === '') payload.test_date = null;

            let courseId = editingCourse?.id;
            if (editingCourse) {
                const { error: updateError } = await supabase.from('courses').update(payload).eq('id', courseId as string);
                if (updateError) throw updateError;
            } else {
                const { data, error: insertError } = await supabase.from('courses').insert(payload).select().single();
                if (insertError) throw insertError;
                courseId = data.id;
            }

            await Promise.all([
                supabase.from('course_items').delete().eq('course_id', courseId as string),
                supabase.from('course_simulados').delete().eq('course_id', courseId as string),
                supabase.from('course_materials').delete().eq('course_id', courseId as string)
            ]);

            const insertPromises = [];
            if (selectedApostilas.length > 0) {
                insertPromises.push(supabase.from('course_items').insert(selectedApostilas.map((a, i) => ({ course_id: courseId, apostila_id: a.id, position: i }))));
            }
            if (selectedSimulados.length > 0) {
                insertPromises.push(supabase.from('course_simulados').insert(selectedSimulados.map((s, i) => ({ course_id: courseId, simulado_id: s.id, position: i, release_days: s.release_days }))));
            }
            if (materials.length > 0) {
                insertPromises.push(supabase.from('course_materials').insert(materials.map((m, i) => ({ course_id: courseId, title: m.title, url: m.url, type: m.type, position: i }))));
            }

            if (insertPromises.length > 0) {
                const results = await Promise.all(insertPromises);
                const firstError = results.find(r => r.error);
                if (firstError) throw firstError.error;
            }

            alert('Curso salvo com sucesso!');
            fetchCourses();
            setView('list');
        } catch (e: any) {
            console.error('Submit error:', e);
            alert(`Erro ao salvar o curso: ${e.message || 'Erro desconhecido'}`);
        } finally { setLoading(false); }
    };

    const handleDeleteCourse = async (id: string) => {
        if (!window.confirm("Deseja EXCLUIR DEFINITIVAMENTE este curso?")) return;
        setLoading(true);
        try {
            const { error } = await supabase.from('courses').delete().eq('id', id);
            if (error) throw error;
            alert('Curso excluído com sucesso.');
            fetchCourses();
        } catch (e) {
            console.error(e);
            alert('Erro ao excluir curso.');
        } finally { setLoading(false); }
    };

    const handleDuplicate = async (course: CourseDb) => {
        if (!window.confirm(`Duplicar o curso "${course.title}"?`)) return;
        setLoading(true);
        try {
            const { id, created_at, bancas, ...rest } = course;
            const { data: newCourse, error } = await supabase.from('courses').insert({
                ...rest,
                title: `${course.title} (Cópia)`,
                status: 'Rascunho'
            }).select().single();
            if (error) throw error;

            const [aps, sims, mats] = await Promise.all([
                supabase.from('course_items').select('apostila_id, position').eq('course_id', id),
                supabase.from('course_simulados').select('simulado_id, position, release_days').eq('course_id', id),
                supabase.from('course_materials').select('*').eq('course_id', id)
            ]);

            if (aps.data) await supabase.from('course_items').insert(aps.data.map(i => ({ ...i, course_id: newCourse.id })));
            if (sims.data) await supabase.from('course_simulados').insert(sims.data.map(i => ({ ...i, course_id: newCourse.id })));
            if (mats.data) await supabase.from('course_materials').insert(mats.data.map(i => ({ title: i.title, url: i.url, type: i.type, position: i.position, course_id: newCourse.id })));

            alert('Curso duplicado!');
            fetchCourses();
        } catch (e) {
            console.error(e);
            alert('Erro ao duplicar curso.');
        } finally { setLoading(false); }
    };

    const handleOpenNotice = async (course: CourseDb) => {
        setLoading(true);
        setSelectedCourseForNotice(course);
        setNoticeData({ title: '', content: '' });
        try {
            const { data } = await supabase.from('course_notices').select('*').eq('course_id', course.id).order('created_at', { ascending: false });
            setCourseNotices(data || []);
        } finally {
            setLoading(false);
            setView('notice');
        }
    };

    const handleSendNotice = async () => {
        if (!noticeData.content) {
            alert('A mensagem é obrigatória.');
            return;
        }
        setLoading(true);
        try {
            const { data, error } = await supabase.from('course_notices').insert({
                course_id: selectedCourseForNotice?.id,
                title: noticeData.title,
                content: noticeData.content
            }).select().single();
            if (error) throw error;
            setCourseNotices([data, ...courseNotices]);
            setNoticeData({ title: '', content: '' });
            alert('Aviso enviado!');
        } catch (e) {
            console.error(e);
            alert('Erro ao enviar aviso.');
        } finally { setLoading(false); }
    };

    const toggleStatus = async (course: CourseDb) => {
        const newStatus = course.status === 'Ativo' ? 'Rascunho' : 'Ativo';
        try {
            const { error } = await supabase.from('courses').update({ status: newStatus }).eq('id', course.id);
            if (error) throw error;
            fetchCourses();
        } catch (e) {
            console.error(e);
            alert('Erro ao alterar status do curso.');
        }
    };

    const handlePreview = (course: CourseDb) => {
        window.open(`/curso/lp/${course.id}`, '_blank');
    };

    const filteredCourses = courses.filter(c => {
        const matchesSearch = c.title.toLowerCase().includes(filterSearch.toLowerCase()) ||
            c.area.toLowerCase().includes(filterSearch.toLowerCase()) ||
            c.cargo.toLowerCase().includes(filterSearch.toLowerCase());
        const matchesArea = !filterArea || c.area === filterArea;
        return matchesSearch && matchesArea;
    });

    const areas = useMemo(() => {
        const set = new Set(courses.map(c => c.area).filter(Boolean));
        return Array.from(set);
    }, [courses]);

    const handleDeleteNotice = async (id: string) => {
        if (!window.confirm("Excluir este aviso?")) return;
        await supabase.from('course_notices').delete().eq('id', id);
        setCourseNotices(courseNotices.filter(n => n.id !== id));
    };

    const handleFileUpload = async (file: File, folder: string) => {
        setUploading(true);
        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
            const filePath = `${folder}/${fileName}`;
            const { error: uploadError } = await supabase.storage.from('public').upload(filePath, file);
            if (uploadError) throw uploadError;
            const { data: { publicUrl } } = supabase.storage.from('public').getPublicUrl(filePath);
            return publicUrl;
        } catch (e) {
            console.error(e);
            alert('Erro ao fazer upload do arquivo.');
            return null;
        } finally {
            setUploading(false);
        }
    };

    const handleBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const url = await handleFileUpload(file, 'banners');
            if (url) setFormData({ ...formData, banner_url: url });
        }
    };

    const handleMaterialUpload = async (idx: number, e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const url = await handleFileUpload(file, 'materials');
            if (url) updateMaterial(idx, 'url', url);
        }
    };

    const addMaterial = () => {
        setMaterials([...materials, { title: '', url: '', type: 'link', position: materials.length }]);
    };
    const updateMaterial = (idx: number, field: keyof MaterialItem, val: string) => {
        const newMats = [...materials];
        newMats[idx] = { ...newMats[idx], [field]: val };
        setMaterials(newMats);
    };
    const removeMaterial = (idx: number) => setMaterials(materials.filter((_, i) => i !== idx));

    const handlePricingChange = (field: string, val: any) => {
        const next = { ...formData, [field]: val };
        const base = Number(next.price_base) || 0;
        const disc = Number(next.discount_value) || 0;
        if (next.discount_type === 'valor') next.price_offer = Math.max(0, base - disc);
        else next.price_offer = Math.max(0, base * (1 - disc / 100));
        setFormData(next);
    };

    const moveApostila = (idx: number, dir: 'up' | 'down') => {
        const next = dir === 'up' ? idx - 1 : idx + 1;
        if (next < 0 || next >= selectedApostilas.length) return;
        const newArr = [...selectedApostilas];
        [newArr[idx], newArr[next]] = [newArr[next], newArr[idx]];
        setSelectedApostilas(newArr);
    };

    const moveSimulado = (idx: number, dir: 'up' | 'down') => {
        const next = dir === 'up' ? idx - 1 : idx + 1;
        if (next < 0 || next >= selectedSimulados.length) return;
        const newArr = [...selectedSimulados];
        [newArr[idx], newArr[next]] = [newArr[next], newArr[idx]];
        setSelectedSimulados(newArr);
    };

    const [isMediaModalOpen, setIsMediaModalOpen] = useState(false);
    const [mediaFolder, setMediaFolder] = useState('banners');
    const [mediaFiles, setMediaFiles] = useState<{ name: string, url: string }[]>([]);
    const [loadingMedia, setLoadingMedia] = useState(false);

    const fetchMediaFiles = async (folder: string) => {
        setLoadingMedia(true);
        try {
            const { data, error } = await supabase.storage.from('public').list(folder, {
                limit: 100,
                sortBy: { column: 'name', order: 'desc' },
            });

            if (error) {
                console.error('Error listing files:', error);
                alert(`Erro ao listar arquivos: ${error.message}`);
                throw error;
            }

            const filesWithUrls = (data || []).map(file => {
                const { data: { publicUrl } } = supabase.storage.from('public').getPublicUrl(`${folder}/${file.name}`);
                return { name: file.name, url: publicUrl };
            });

            setMediaFiles(filesWithUrls);
        } catch (e: any) {
            console.error('fetchMediaFiles error:', e);
            alert(`Erro na biblioteca: ${e.message || 'Erro desconhecido'}`);
        } finally {
            setLoadingMedia(false);
        }
    };

    useEffect(() => {
        if (isMediaModalOpen) {
            fetchMediaFiles(mediaFolder);
        }
    }, [isMediaModalOpen, mediaFolder]);

    const handleDeleteMedia = async (fileName: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!confirm('Deseja realmente excluir este arquivo permanentemente da biblioteca?')) return;
        
        try {
            const { error } = await supabase.storage.from('public').remove([`${mediaFolder}/${fileName}`]);
            if (error) throw error;
            fetchMediaFiles(mediaFolder);
        } catch (e) {
            console.error(e);
            alert('Erro ao excluir arquivo');
        }
    };

    const handleSelectMedia = (url: string) => {
        if (mediaFolder === 'banners') setFormData({ ...formData, banner_url: url });
        else if (mediaFolder === 'videos') setFormData({ ...formData, video_url: url });
        else if (mediaFolder === 'lp_images') setFormData({ ...formData, lp_images: [...(formData.lp_images || []), url] });
        setIsMediaModalOpen(false);
    };

    const MediaLibraryModalContent = () => (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-6 animate-in fade-in duration-300">
            <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-md" onClick={() => setIsMediaModalOpen(false)}></div>
            <div className="relative w-full max-w-4xl bg-white rounded-[40px] shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
                <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                    <div>
                        <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter">Biblioteca de Mídia</h3>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Pasta: {mediaFolder}</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={() => fetchMediaFiles(mediaFolder)} className="size-10 rounded-full hover:bg-slate-200 flex items-center justify-center transition-all text-slate-400" title="Atualizar">
                            <span className="material-symbols-outlined">sync</span>
                        </button>
                        <button onClick={() => setIsMediaModalOpen(false)} className="size-10 rounded-full hover:bg-slate-200 flex items-center justify-center transition-all text-slate-400">
                            <span className="material-symbols-outlined">close</span>
                        </button>
                    </div>
                </div>

                <div className="p-6 bg-white border-b border-slate-100 flex gap-3 overflow-x-auto">
                    {['banners', 'videos', 'lp_images', 'materials'].map(folder => (
                        <button 
                            key={folder}
                            onClick={() => { setMediaFolder(folder); fetchMediaFiles(folder); }}
                            className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${mediaFolder === folder ? 'bg-blue-600 text-white shadow-lg' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}
                        >
                            {folder.replace('_', ' ')}
                        </button>
                    ))}
                </div>

                <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                    {loadingMedia ? (
                        <div className="py-20 text-center">
                            <div className="size-10 border-4 border-slate-100 border-t-blue-500 rounded-full animate-spin mx-auto mb-4"></div>
                            <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Carregando arquivos...</p>
                        </div>
                    ) : mediaFiles.length === 0 ? (
                        <div className="py-20 text-center opacity-30 italic">
                            <span className="material-symbols-outlined text-5xl block mb-4 text-slate-300">folder_open</span>
                            <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Nenhum arquivo encontrado nesta pasta.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
                            {mediaFiles.map((file, i) => (
                                <div 
                                    key={i} 
                                    className="group relative aspect-square rounded-3xl overflow-hidden border border-slate-100 bg-slate-50 cursor-pointer hover:border-blue-500 hover:shadow-2xl transition-all duration-300"
                                >
                                    {mediaFolder === 'videos' || file.name.endsWith('.pdf') ? (
                                        <div className="w-full h-full flex flex-col items-center justify-center gap-3 p-4" onClick={() => handleSelectMedia(file.url)}>
                                            <div className="size-14 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-500 transition-colors">
                                                <span className="material-symbols-outlined text-3xl">{mediaFolder === 'videos' ? 'movie' : 'description'}</span>
                                            </div>
                                            <p className="text-[9px] font-black uppercase px-2 text-center truncate w-full text-slate-400">{file.name}</p>
                                        </div>
                                    ) : (
                                        <img src={file.url} onClick={() => handleSelectMedia(file.url)} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                                    )}
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-4">
                                        <div onClick={() => handleSelectMedia(file.url)} className="size-12 bg-white rounded-full flex items-center justify-center text-blue-600 shadow-2xl transform scale-50 group-hover:scale-100 transition-transform duration-300">
                                            <span className="material-symbols-outlined font-black">add</span>
                                        </div>
                                        <button 
                                            onClick={(e) => handleDeleteMedia(file.name, e)}
                                            className="size-10 bg-red-500 text-white rounded-full flex items-center justify-center shadow-xl transform scale-50 group-hover:scale-100 transition-transform duration-300 delay-75 hover:bg-red-600"
                                            title="Excluir da Biblioteca"
                                        >
                                            <span className="material-symbols-outlined text-xl">delete</span>
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );

    if (view === 'notice') return (
        <>
            <div className="flex flex-col gap-8 max-w-4xl mx-auto py-10 animate-in fade-in">
                <div className="flex items-center gap-4">
                    <button onClick={() => setView('list')} className="p-3 bg-white border border-slate-200 rounded-xl text-slate-400 hover:text-slate-600 transition-all"><span className="material-symbols-outlined">arrow_back</span></button>
                    <div>
                        <h2 className="text-2xl font-black">Central de Avisos: {selectedCourseForNotice?.title}</h2>
                        <p className="text-sm font-medium text-slate-500 uppercase tracking-widest">Envie comunicados para os matriculados</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                    <div className="bg-white p-8 rounded-[32px] border border-slate-200 shadow-sm space-y-6 flex flex-col h-fit">
                        <h3 className="text-sm font-black uppercase tracking-widest text-[#111418] border-b border-slate-100 pb-4">Novo Comunicado</h3>
                        <div className="space-y-4">
                            <input type="text" placeholder="Título do Aviso..." value={noticeData.title} onChange={e => setNoticeData({ ...noticeData, title: e.target.value })} className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-xl font-bold" />
                            <TiptapEditor
                                content={noticeData.content}
                                onChange={v => setNoticeData({ ...noticeData, content: v })}
                                placeholder="Escreva seu comunicado aqui... (Suporta imagens, vídeos, links)"
                                minHeight="300px"
                            />
                            <button onClick={handleSendNotice} disabled={loading} className="w-full h-14 bg-amber-500 text-white rounded-2xl font-black text-lg shadow-lg hover:bg-amber-600 transition-all active:scale-95 disabled:opacity-50">
                                {loading ? 'Enviando...' : 'Enviar Agora'}
                            </button>
                        </div>
                    </div>

                    <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                        <h3 className="text-sm font-black uppercase tracking-widest text-[#111418] mb-4">Avisos Enviados</h3>
                        {courseNotices.length === 0 ? (
                            <div className="py-20 text-center opacity-30 italic"><span className="material-symbols-outlined text-4xl block mb-2">history</span>Nenhum aviso enviado.</div>
                        ) : courseNotices.map(n => (
                            <div key={n.id} className="p-5 bg-white rounded-2xl border border-slate-100 shadow-sm group relative">
                                <button onClick={() => handleDeleteNotice(n.id)} className="absolute top-4 right-4 p-1 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"><span className="material-symbols-outlined text-[18px]">delete</span></button>
                                <span className="text-[10px] font-black text-slate-400 uppercase">{new Date(n.created_at).toLocaleDateString()}</span>
                                {n.title && <h4 className="text-sm font-black text-[#111418] mt-1">{n.title}</h4>}
                                <p className="text-xs text-slate-600 mt-2">{n.content}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
            {isMediaModalOpen && <MediaLibraryModalContent />}
        </>
    );

    if (view === 'form') return (
        <>
            <div className="flex flex-col gap-6 pb-20 animate-in slide-in-from-right duration-500">
                <div className="flex items-center justify-between">
                    <button onClick={() => setView('list')} className="size-10 flex items-center justify-center bg-white border border-slate-200 rounded-xl text-slate-400"><span className="material-symbols-outlined">arrow_back</span></button>
                    <div className="flex-1 ml-4">
                        <h3 className="text-xl font-black text-slate-800">{editingCourse ? 'Editar Curso' : 'Novo Curso'}</h3>
                    </div>
                    <div className="flex gap-2">
                        <button type="button" onClick={() => setView('list')} className="px-6 py-2.5 bg-slate-100 text-slate-600 rounded-[18px] text-[10px] font-black uppercase">Cancelar</button>
                        <button type="button" onClick={handleSubmit} disabled={loading} className="px-8 py-2.5 bg-[#137fec] text-white rounded-[18px] text-[10px] font-black uppercase shadow-lg shadow-blue-100">Salvar Curso</button>
                    </div>
                </div>

                <div className="bg-white rounded-[32px] border border-slate-200 shadow-sm flex flex-col md:flex-row overflow-hidden min-h-[750px]">
                    <div className="w-full md:w-64 bg-slate-50 border-r border-slate-200 p-6 space-y-2">
                        {[{ id: 'geral', label: 'Inf. Gerais', icon: 'info' }, { id: 'apostilas', label: 'Apostilas', icon: 'auto_stories' }, { id: 'simulados', label: 'Simulados', icon: 'quiz' }, { id: 'materiais', label: 'Materiais Extra', icon: 'attachment' }, { id: 'financeiro', label: 'Financeiro', icon: 'payments' }, { id: 'landing', label: 'Página de Vendas', icon: 'auto_awesome' }].map(tab => (
                            <button type="button" key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-black transition-all ${activeTab === tab.id ? 'bg-[#137fec] text-white' : 'text-slate-500 hover:bg-slate-200'}`}>
                                <span className="material-symbols-outlined text-[20px]">{tab.icon}</span>{tab.label}
                            </button>
                        ))}
                    </div>

                    <div className="flex-1 p-10 overflow-y-auto max-h-[800px] custom-scrollbar">
                        {/* Tab Content Rendering Logic */}
                        {activeTab === 'geral' && (
                            <div className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                                <div className="space-y-2 md:col-span-8">
                                    <input type="text" value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} className="w-full h-14 px-6 bg-slate-50 border border-slate-200 rounded-2xl font-bold" />
                                </div>
                                <div className="space-y-2 md:col-span-12">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Banner do Curso</label>
                                    <div className="flex gap-4 items-center">
                                        <input
                                            type="text"
                                            value={formData.banner_url}
                                            onChange={e => setFormData({ ...formData, banner_url: e.target.value })}
                                            className="flex-1 h-14 px-6 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm text-slate-600"
                                            placeholder="https://..."
                                        />
                                        <div className="relative">
                                            <input type="file" id="banner-upload" className="hidden" onChange={handleBannerUpload} />
                                            <label htmlFor="banner-upload" className="h-14 px-6 bg-slate-900 text-white rounded-2xl flex items-center gap-2 font-black text-[10px] uppercase tracking-widest cursor-pointer hover:bg-blue-600 transition-all">
                                                <span className="material-symbols-outlined">upload</span>
                                                {uploading ? 'Enviando...' : 'Upload'}
                                            </label>
                                            <button 
                                                type="button"
                                                onClick={() => { setMediaFolder('banners'); fetchMediaFiles('banners'); setIsMediaModalOpen(true); }}
                                                className="h-14 px-6 bg-white border border-slate-200 text-slate-500 rounded-2xl flex items-center gap-2 font-black text-[10px] uppercase tracking-widest hover:bg-slate-50 transition-all ml-2"
                                            >
                                                <span className="material-symbols-outlined">collections</span>
                                                Biblioteca
                                            </button>
                                        </div>
                                    </div>
                                </div>
                                <div className="space-y-2 md:col-span-4">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Área de Atuação</label>
                                    <input type="text" value={formData.area} onChange={e => setFormData({ ...formData, area: e.target.value })} className="w-full h-14 px-5 bg-slate-50 border border-slate-200 rounded-2xl font-bold" placeholder="Ex: Policial, Administrativa" />
                                </div>
                                <div className="space-y-2 md:col-span-4">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Estado (UF)</label>
                                    <select value={formData.state} onChange={e => setFormData({ ...formData, state: e.target.value })} className="w-full h-14 px-5 bg-slate-50 border border-slate-200 rounded-2xl font-bold">
                                        <option value="Nacional">Nacional</option>
                                        {["AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"].map(uf => <option key={uf} value={uf}>{uf}</option>)}
                                    </select>
                                </div>

                                <div className="space-y-2 md:col-span-12 pt-4">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1 mb-2 block flex items-center gap-2">
                                        <span className="material-symbols-outlined text-[16px]">collections</span>
                                        Galeria de Imagens da Landing Page
                                    </label>
                                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                                        <label className="aspect-square rounded-[32px] border-2 border-dashed border-slate-200 flex flex-col items-center justify-center gap-3 cursor-pointer hover:bg-white hover:border-blue-400 hover:text-blue-500 transition-all text-slate-300 group">
                                            <input 
                                                type="file" 
                                                className="hidden" 
                                                multiple
                                                onChange={async (e) => {
                                                    const files = Array.from(e.target.files || []);
                                                    if (files.length > 0) {
                                                        setUploading(true);
                                                        const newUrls: string[] = [];
                                                        for (const file of files) {
                                                            const url = await handleFileUpload(file, 'lp_images');
                                                            if (url) newUrls.push(url);
                                                        }
                                                        setFormData(prev => ({ ...prev, lp_images: [...(prev.lp_images || []), ...newUrls] }));
                                                        setUploading(false);
                                                    }
                                                }}
                                            />
                                            <div className="size-12 bg-slate-50 rounded-2xl flex items-center justify-center group-hover:bg-blue-50 transition-colors">
                                                <span className="material-symbols-outlined text-3xl">{uploading ? 'sync' : 'add_photo_alternate'}</span>
                                            </div>
                                            <span className="text-[9px] font-black uppercase tracking-widest">{uploading ? 'Enviando...' : 'Upload'}</span>
                                        </label>

                                        <button 
                                            type="button"
                                            onClick={() => { setMediaFolder('lp_images'); fetchMediaFiles('lp_images'); setIsMediaModalOpen(true); }}
                                            className="aspect-square rounded-[32px] border-2 border-slate-100 flex flex-col items-center justify-center gap-3 cursor-pointer hover:bg-white hover:border-blue-400 hover:text-blue-500 transition-all text-slate-300 group"
                                        >
                                            <div className="size-12 bg-slate-50 rounded-2xl flex items-center justify-center group-hover:bg-blue-50 transition-colors">
                                                <span className="material-symbols-outlined text-3xl">collections</span>
                                            </div>
                                            <span className="text-[9px] font-black uppercase tracking-widest">Biblioteca</span>
                                        </button>

                                        {(formData.lp_images || []).map((url, idx) => (
                                            <div key={idx} className="relative group aspect-square rounded-3xl overflow-hidden border border-slate-200 bg-slate-100 shadow-sm transition-all hover:shadow-md">
                                                <img src={url} className="w-full h-full object-cover" />
                                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                    <button 
                                                        type="button"
                                                        onClick={() => {
                                                            const newImages = [...(formData.lp_images || [])];
                                                            newImages.splice(idx, 1);
                                                            setFormData({ ...formData, lp_images: newImages });
                                                        }}
                                                        className="size-10 bg-white text-red-500 rounded-2xl flex items-center justify-center shadow-xl transform scale-75 group-hover:scale-100 transition-all"
                                                    >
                                                        <span className="material-symbols-outlined">delete</span>
                                                    </button>
                                                </div>
                                                <div className="absolute top-2 left-2 bg-black/50 backdrop-blur-md text-white text-[8px] font-black px-2 py-1 rounded-lg">
                                                    IMG {idx + 1}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    <p className="text-[10px] text-slate-400 font-bold italic mt-4 flex items-center gap-2">
                                        <span className="material-symbols-outlined text-[14px]">info</span>
                                        Dica: Estas imagens serão utilizadas para ilustrar o conteúdo da sua Landing Page Profissional.
                                    </p>
                                </div>

                                <div className="space-y-2 md:col-span-4">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Banca Examinadora</label>
                                    <select value={formData.banca_id || ''} onChange={e => setFormData({ ...formData, banca_id: e.target.value })} className="w-full h-14 px-5 bg-slate-50 border border-slate-200 rounded-2xl font-bold">
                                        <option value="">Todas as Bancas</option>
                                        {bancas.map(b => (
                                            <option key={b.id} value={b.id}>{b.sigla || b.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="space-y-2 md:col-span-4">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tempo de Acesso (Dias)</label>
                                    <input type="number" value={formData.access_days} onChange={e => setFormData({ ...formData, access_days: Number(e.target.value) })} className="w-full h-14 px-5 bg-slate-50 border border-slate-200 rounded-2xl font-bold" />
                                </div>

                                {/* Edital / Data da Prova Section */}
                                <div className="md:col-span-12 bg-slate-50 p-6 rounded-2xl border border-slate-200 flex flex-col md:flex-row gap-8 items-center">
                                    <div className="flex items-center gap-4">
                                        <div className="relative inline-block w-12 h-6 transition duration-200 ease-in-out">
                                            <input
                                                type="checkbox"
                                                id="notice_toggle"
                                                checked={formData.is_notice_open || false}
                                                onChange={e => setFormData({ ...formData, is_notice_open: e.target.checked })}
                                                className="peer absolute w-12 h-6 opacity-0 z-10 cursor-pointer"
                                            />
                                            <label htmlFor="notice_toggle" className={`block overflow-hidden h-6 rounded-full bg-gray-300 cursor-pointer transition-colors duration-200 ${formData.is_notice_open ? 'bg-amber-400' : ''}`}></label>
                                            <div className={`absolute left-0 top-0 w-6 h-6 bg-white rounded-full shadow transition-transform duration-200 ${formData.is_notice_open ? 'translate-x-full' : 'translate-x-0'}`}></div>
                                        </div>
                                        <label htmlFor="notice_toggle" className="text-sm font-black text-slate-700 uppercase tracking-wide cursor-pointer select-none">
                                            Edital Publicado
                                        </label>
                                    </div>

                                    {formData.is_notice_open && (
                                        <div className="flex-1 w-full animate-in fade-in slide-in-from-left-4 duration-300 flex items-center gap-4">
                                            <span className="hidden md:block h-8 w-px bg-slate-200"></span>
                                            <div className="flex-1">
                                                <label className="text-[10px] font-black text-amber-600 uppercase tracking-widest pl-1 mb-1 block">Data da Prova</label>
                                                <input
                                                    type="date"
                                                    value={formData.test_date || ''}
                                                    onChange={e => setFormData({ ...formData, test_date: e.target.value })}
                                                    className="w-full h-12 px-4 bg-white border border-amber-200 rounded-xl font-bold text-slate-800 focus:ring-2 focus:ring-amber-200 outline-none"
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Descrição Detalhada</label>
                                <TiptapEditor
                                    content={formData.description || ''}
                                    onChange={v => setFormData({ ...formData, description: v })}
                                    placeholder="Descreva o curso..."
                                    minHeight="250px"
                                />
                            </div>
                        </div>
                    )}

                    {activeTab === 'apostilas' && (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                            <div className="space-y-4">
                                <div className="flex gap-2 flex-wrap">
                                    <input type="text" placeholder="Filtrar por nome..." value={apostilaSearch} onChange={e => setApostilaSearch(e.target.value)} className="flex-1 h-10 px-4 bg-slate-100 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-[#137fec]/20 transition-all min-w-[200px]" />
                                    <select value={apostilaFilterDisc} onChange={e => setApostilaFilterDisc(e.target.value)} className="h-10 px-4 bg-slate-100 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-[#137fec]/20 transition-all text-slate-600">
                                        <option value="">Todas as Disciplinas</option>
                                        {disciplinas.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                                    </select>
                                    <select value={apostilaFilterSubject} onChange={e => setApostilaFilterSubject(e.target.value)} className="h-10 px-4 bg-slate-100 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-[#137fec]/20 transition-all text-slate-600">
                                        <option value="">Todos os Assuntos</option>
                                        {assuntos
                                            .filter(a => !apostilaFilterDisc || a.disciplina_id === apostilaFilterDisc)
                                            .map(a => <option key={a.id} value={a.id}>{a.name}</option>)
                                        }
                                    </select>
                                </div>
                                <div className="max-h-[500px] overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                                    {allApostilas.filter(a => {
                                        const matchesSearch = a.title.toLowerCase().includes(apostilaSearch.toLowerCase());
                                        const matchesDisc = !apostilaFilterDisc || a.disciplina_id === apostilaFilterDisc;
                                        const matchesSubj = !apostilaFilterSubject || a.assunto_id === apostilaFilterSubject;
                                        return matchesSearch && matchesDisc && matchesSubj;
                                    }).map(a => (
                                        <div key={a.id} onClick={() => setSelectedApostilas(prev => prev.some(sa => sa.id === a.id) ? prev.filter(sa => sa.id !== a.id) : [...prev, { id: a.id, position: prev.length }])} className={`p-4 rounded-2xl border cursor-pointer transition-all flex items-center justify-between ${selectedApostilas.some(sa => sa.id === a.id) ? 'bg-blue-50 border-blue-200' : 'bg-white border-slate-100 hover:border-blue-300'}`}>
                                            <div>
                                                <p className="text-xs font-black text-slate-700">{a.title}</p>
                                                <p className="text-[9px] font-bold text-slate-400 uppercase mt-0.5">{a.disciplinas?.name || 'Sem Disciplina'}</p>
                                            </div>
                                            <span className={`material-symbols-outlined text-[18px] ${selectedApostilas.some(sa => sa.id === a.id) ? 'text-blue-500' : 'text-slate-300'}`}>{selectedApostilas.some(sa => sa.id === a.id) ? 'check_circle' : 'add_circle'}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div className="bg-slate-50 p-6 rounded-3xl border border-slate-200 h-fit space-y-2">
                                {selectedApostilas.map((sel, idx) => (
                                    <div key={sel.id} className="bg-white p-3 rounded-xl border border-slate-100 flex items-center justify-between gap-3 shadow-sm">
                                        <span className="text-[11px] font-black truncate">{idx + 1}. {allApostilas.find(a => a.id === sel.id)?.title}</span>
                                        <button type="button" className="material-symbols-outlined text-slate-300 hover:text-red-500" onClick={() => setSelectedApostilas(selectedApostilas.filter(s => s.id !== sel.id))}>close</button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {activeTab === 'simulados' && (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                            <div className="space-y-4">
                                <input type="text" placeholder="Buscar..." value={simuladoSearch} onChange={e => setSimuladoSearch(e.target.value)} className="w-full h-10 px-4 bg-slate-100 rounded-xl text-xs font-bold" />
                                <div className="max-h-[500px] overflow-y-auto space-y-2 pr-2">
                                    {allSimulados.filter(s => s.title.toLowerCase().includes(simuladoSearch.toLowerCase())).map(s => (
                                        <div key={s.id} onClick={() => setSelectedSimulados(prev => prev.some(ss => ss.id === s.id) ? prev.filter(ss => ss.id !== s.id) : [...prev, { id: s.id, position: prev.length, release_days: 0 }])} className={`p-4 rounded-2xl border cursor-pointer transition-all flex items-center justify-between ${selectedSimulados.some(ss => ss.id === s.id) ? 'bg-indigo-50 border-indigo-200' : 'bg-white border-slate-100'}`}>
                                            <p className="text-xs font-bold">{s.title}</p>
                                            <span className={`material-symbols-outlined text-[18px] ${selectedSimulados.some(ss => ss.id === s.id) ? 'text-indigo-500' : 'text-slate-300'}`}>{selectedSimulados.some(ss => ss.id === s.id) ? 'check_circle' : 'add_circle'}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div className="bg-white p-6 rounded-3xl border border-slate-200 space-y-3 h-fit">
                                {selectedSimulados.map((sel, idx) => (
                                    <div key={sel.id} className="p-3 bg-slate-50 rounded-2xl flex justify-between items-center">
                                        <span className="text-[10px] font-black truncate">{allSimulados.find(sim => sim.id === sel.id)?.title}</span>
                                        <input type="number" value={sel.release_days} onChange={e => setSelectedSimulados(selectedSimulados.map(s => s.id === sel.id ? { ...s, release_days: Number(e.target.value) } : s))} className="w-12 h-6 text-center text-[10px] font-black bg-white rounded border border-slate-200" />
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {activeTab === 'materiais' && (
                        <div className="space-y-6">
                            <button type="button" onClick={addMaterial} className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest"><span className="material-symbols-outlined">add</span> Novo Material</button>
                            <div className="space-y-4">
                                {materials.map((m, idx) => (
                                    <div key={idx} className="p-6 bg-white rounded-3xl border border-slate-200 shadow-sm flex flex-col gap-4">
                                        <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                                            <span className="text-xs font-black text-slate-800">Material {idx + 1}</span>
                                            <button type="button" onClick={() => removeMaterial(idx)} className="text-slate-300 hover:text-red-500"><span className="material-symbols-outlined">delete</span></button>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <input type="text" value={m.title} onChange={e => updateMaterial(idx, 'title', e.target.value)} placeholder="Título..." className="h-11 px-4 bg-slate-50 border border-slate-200 rounded-xl" />
                                            <select value={m.type} onChange={e => updateMaterial(idx, 'type', e.target.value as any)} className="h-11 px-4 bg-slate-50 border border-slate-200 rounded-xl font-bold">
                                                <option value="link">🌐 Link Externo</option>
                                                <option value="pdf">📄 Arquivo PDF</option>
                                                <option value="video">🎬 Vídeo Aula</option>
                                                <option value="audio">🎧 Áudio / Podcast</option>
                                                <option value="image">🖼️ Imagem / Mapa</option>
                                            </select>
                                        </div>
                                        <div className="flex flex-col gap-3">
                                            <div className="flex items-center gap-3">
                                                <input type="text" value={m.url} onChange={e => updateMaterial(idx, 'url', e.target.value)} placeholder="URL do arquivo ou link externo..." className="flex-1 h-11 px-4 bg-slate-50 border border-slate-200 rounded-xl" />
                                                <div className="relative">
                                                    <input type="file" id={`upload-${idx}`} className="hidden" onChange={e => handleMaterialUpload(idx, e)} />
                                                    <label htmlFor={`upload-${idx}`} className="flex items-center gap-2 px-4 h-11 bg-blue-50 text-blue-600 rounded-xl cursor-pointer hover:bg-blue-100 transition-all font-black text-[10px] uppercase tracking-widest">
                                                        <span className="material-symbols-outlined text-[18px]">upload</span>
                                                        {uploading ? 'Enviando...' : 'Upload'}
                                                    </label>
                                                </div>
                                            </div>
                                            {m.url && m.url.includes('supabase.co') && (
                                                <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-lg text-[9px] font-black uppercase w-fit">
                                                    <span className="material-symbols-outlined text-[14px]">verified</span> Arquivo Hospedado
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {activeTab === 'landing' && (
                        <div className="space-y-8">
                            <div className="bg-blue-50 p-6 rounded-[30px] border border-blue-100 flex items-center gap-4">
                                <div className="size-12 bg-blue-500 text-white rounded-2xl flex items-center justify-center">
                                    <span className="material-symbols-outlined">auto_awesome</span>
                                </div>
                                <div>
                                    <h4 className="text-sm font-black text-blue-900">Personalização da Página de Vendas</h4>
                                    <p className="text-xs font-medium text-blue-700">Escolha o modelo visual que melhor se adapta ao público deste curso.</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                                {[
                                    { id: 'elite_gold', label: 'Elite Gold (High Impact)', color: '#facc15', category: 'Premium' },
                                    { id: 'premium', label: 'Premium Impacto (Clean)', color: '#137fec', category: 'Premium' }
                                ].map(model => (
                                    <button
                                        key={model.id}
                                        type="button"
                                        onClick={() => setFormData({ ...formData, lp_model: model.id })}
                                        className={`p-6 rounded-[32px] border-2 transition-all flex flex-col items-center gap-4 text-center relative group ${formData.lp_model === model.id ? 'bg-white border-blue-500 shadow-xl' : 'bg-slate-50 border-transparent grayscale opacity-60 hover:opacity-100 hover:grayscale-0'}`}
                                    >
                                        <div className="size-14 rounded-2xl flex items-center justify-center shadow-lg transform group-hover:scale-110 transition-transform" style={{ backgroundColor: model.color }}>
                                            <span className="material-symbols-outlined text-white text-3xl">dashboard_customize</span>
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{model.category}</p>
                                            <span className="text-xs font-black uppercase tracking-tighter leading-tight">{model.label}</span>
                                        </div>
                                        {formData.lp_model === model.id && (
                                            <div className="absolute top-4 right-4 text-blue-500">
                                                <span className="material-symbols-outlined">check_circle</span>
                                            </div>
                                        )}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {activeTab === 'financeiro' && (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            {/* Coluna Esquerda: Escura (Configuração de Preço e Ganhos) */}
                            <div className="bg-[#111827] p-10 rounded-[40px] text-white shadow-2xl space-y-10">
                                <section className="space-y-6">
                                    <h3 className="text-[10px] font-black uppercase text-slate-500 tracking-[0.2em]">Configuração de Preço</h3>
                                    
                                    <div className="space-y-4">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black uppercase text-slate-400">Preço de Tabela (R$)</label>
                                            <input 
                                                type="number" 
                                                step="0.01" 
                                                value={formData.price_base} 
                                                onChange={e => handlePricingChange('price_base', e.target.value)} 
                                                className="w-full h-14 bg-white/5 border border-white/10 rounded-2xl px-6 font-black text-xl text-slate-300 outline-none focus:border-blue-500/50 transition-all" 
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black uppercase text-slate-400">Desconto Fixo (R$)</label>
                                            <input 
                                                type="number" 
                                                step="0.01" 
                                                value={formData.discount_value} 
                                                onChange={e => handlePricingChange('discount_value', e.target.value)} 
                                                className="w-full h-14 bg-white/5 border border-white/10 rounded-2xl px-6 font-black text-xl text-slate-300 outline-none focus:border-red-500/50 transition-all" 
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black uppercase text-slate-400">Preço Calculado (R$)</label>
                                            <div className="relative">
                                                <input
                                                    type="number"
                                                    value={formData.price_offer}
                                                    readOnly
                                                    className="w-full h-14 bg-white/10 border border-white/20 rounded-2xl px-6 font-black text-2xl text-emerald-400 outline-none"
                                                />
                                                <div className="absolute top-1/2 right-4 -translate-y-1/2">
                                                    <span className="px-3 py-1 bg-emerald-500/20 text-emerald-400 rounded-lg text-[9px] font-black uppercase tracking-widest border border-emerald-500/30">Calculado</span>
                                                </div>
                                            </div>
                                            <p className="text-[10px] text-slate-500 font-bold italic">O preço com desconto é gerado automaticamente.</p>
                                        </div>

                                        {/* PROMOÇÃO SECTION */}
                                        <div className="pt-6 border-t border-white/10 space-y-4">
                                            <div className="flex items-center justify-between">
                                                <h4 className="text-[10px] font-black text-rose-400 uppercase tracking-widest flex items-center gap-2"><span className="material-symbols-outlined text-[16px]">campaign</span> Oferta / Promoção Ativa</h4>
                                                <div className="relative inline-block w-10 h-5 transition duration-200 ease-in-out">
                                                    <input
                                                        type="checkbox"
                                                        id="promo_toggle"
                                                        checked={promoConfig.isActive}
                                                        onChange={e => setPromoConfig({ ...promoConfig, isActive: e.target.checked })}
                                                        className="peer absolute w-10 h-5 opacity-0 z-10 cursor-pointer"
                                                    />
                                                    <label htmlFor="promo_toggle" className={`block overflow-hidden h-5 rounded-full bg-slate-700 cursor-pointer transition-colors duration-200 ${promoConfig.isActive ? 'bg-rose-500' : ''}`}></label>
                                                    <div className={`absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${promoConfig.isActive ? 'translate-x-5' : 'translate-x-0'}`}></div>
                                                </div>
                                            </div>
                                            
                                            {promoConfig.isActive && (
                                                <div className="space-y-2 animate-in fade-in zoom-in-95">
                                                    <label className="text-[10px] font-black uppercase text-slate-400">Título da Promoção (Ex: Black Friday, Dia das Mães)</label>
                                                    <input 
                                                        type="text" 
                                                        value={promoConfig.title} 
                                                        onChange={e => setPromoConfig({ ...promoConfig, title: e.target.value })} 
                                                        className="w-full h-12 bg-rose-500/10 border border-rose-500/30 rounded-xl px-4 font-bold text-sm text-rose-100 outline-none focus:border-rose-400 transition-all placeholder:text-rose-500/30" 
                                                        placeholder="Natal, Relâmpago..."
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </section>

                                <section className="pt-10 border-t border-white/5 space-y-6">
                                    <div className="flex items-center gap-3">
                                        <span className="material-symbols-outlined text-emerald-400">analytics</span>
                                        <h3 className="text-[10px] font-black uppercase text-slate-500 tracking-[0.2em]">Simulação de Ganhos (Por Venda)</h3>
                                    </div>

                                    <div className="grid grid-cols-2 gap-8">
                                        <div className="space-y-1">
                                            <p className="text-[9px] font-black text-slate-500 uppercase">Por Apostila</p>
                                            <p className="text-3xl font-black text-[#00c58e]">
                                                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                                                    selectedApostilas.length > 0 ? (formData.price_offer! * (formData.commission_percentage || 50) / 100) / (selectedApostilas.length + (totalGeneralCommissionReceivers > 0 ? 1 : 0)) : 0
                                                )}
                                            </p>
                                            <p className="text-[8px] text-slate-600 font-bold uppercase italic">Considerando {selectedApostilas.length} apostilas + Part. Geral.</p>
                                        </div>
                                        <div className="space-y-1 border-l border-white/5 pl-8">
                                            <p className="text-[9px] font-black text-slate-500 uppercase">Por Cota (Investidor)</p>
                                            <p className="text-3xl font-black text-blue-400">
                                                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                                                    totalActiveQuotas > 0 ? (formData.price_offer! * (formData.investor_percentage || 10) / 100) / totalActiveQuotas : 0
                                                )}
                                            </p>
                                            <p className="text-[8px] text-slate-600 font-bold uppercase italic">baseado em {totalActiveQuotas} cotas ativas no sistema.</p>
                                        </div>
                                    </div>
                                </section>
                            </div>

                            {/* Coluna Direita: Branca (Cupons, Descontos e Taxas) */}
                            <div className="space-y-8 py-4">
                                <section className="space-y-6">
                                    <div className="flex justify-between items-center">
                                        <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">Cupom & Promoção</h3>
                                        <button 
                                            type="button" 
                                            onClick={() => setFormData({...formData, coupons_json: [...(formData.coupons_json || []), {name: '', discount_type: 'porcentagem', discount_value: 0}]})} 
                                            className="px-3 py-1.5 bg-blue-50 text-blue-600 border border-blue-100 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-blue-100 transition-all"
                                        >
                                            + Adicionar
                                        </button>
                                    </div>

                                    <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                                        {(!formData.coupons_json || formData.coupons_json.length === 0) ? (
                                            <div className="p-6 bg-slate-50 border border-slate-100 rounded-[24px]">
                                                <p className="text-[10px] font-black text-slate-400 uppercase text-center tracking-widest">Nenhum cupom cadastrado</p>
                                            </div>
                                        ) : (
                                            formData.coupons_json.map((c, idx) => (
                                                <div key={idx} className="bg-white border border-slate-200 rounded-3xl p-5 space-y-4 shadow-sm relative group">
                                                    <button 
                                                        type="button" 
                                                        onClick={() => setFormData({...formData, coupons_json: (formData.coupons_json || []).filter((_, i) => i !== idx)})} 
                                                        className="absolute top-3 right-3 size-6 bg-slate-50 text-slate-400 hover:text-red-500 rounded-full flex items-center justify-center transition-all opacity-0 group-hover:opacity-100"
                                                    >
                                                        <span className="material-symbols-outlined text-sm">close</span>
                                                    </button>
                                                    <div className="space-y-1">
                                                        <label className="text-[8px] font-black uppercase text-slate-400 ml-1">Nome do Cupom</label>
                                                        <input 
                                                            type="text" 
                                                            value={c.name} 
                                                            onChange={e => {
                                                                const next = [...(formData.coupons_json || [])];
                                                                next[idx].name = e.target.value.toUpperCase();
                                                                setFormData({...formData, coupons_json: next});
                                                            }} 
                                                            className="w-full h-12 bg-slate-50 border border-slate-100 rounded-2xl px-5 text-sm font-black uppercase text-slate-700 outline-none focus:border-blue-500/50" 
                                                            placeholder="EX: BORA10" 
                                                        />
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-4">
                                                        <div className="space-y-1">
                                                            <label className="text-[8px] font-black uppercase text-slate-400 ml-1">Tipo</label>
                                                            <select 
                                                                value={c.discount_type} 
                                                                onChange={e => {
                                                                    const next = [...(formData.coupons_json || [])];
                                                                    next[idx].discount_type = e.target.value as any;
                                                                    setFormData({...formData, coupons_json: next});
                                                                }} 
                                                                className="w-full h-11 bg-slate-50 border border-slate-100 rounded-[14px] px-4 text-[10px] font-black text-slate-600 outline-none appearance-none"
                                                            >
                                                                <option value="porcentagem">PORCENTAGEM (%)</option>
                                                                <option value="valor">R$ FIXO (VALOR)</option>
                                                            </select>
                                                        </div>
                                                        <div className="space-y-1">
                                                            <label className="text-[8px] font-black uppercase text-slate-400 ml-1">Valor do Desconto</label>
                                                            <input 
                                                                type="number" 
                                                                value={c.discount_value} 
                                                                onChange={e => {
                                                                    const next = [...(formData.coupons_json || [])];
                                                                    next[idx].discount_value = Number(e.target.value);
                                                                    setFormData({...formData, coupons_json: next});
                                                                }} 
                                                                className="w-full h-11 bg-slate-50 border border-slate-100 rounded-[14px] px-4 text-[10px] font-black text-slate-700 outline-none" 
                                                                placeholder="0" 
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>

                                    <div className="space-y-2 mt-8">
                                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] ml-1">Desconto no Pix (%)</label>
                                        <input 
                                            type="number" 
                                            value={formData.pix_discount} 
                                            onChange={e => setFormData({...formData, pix_discount: Number(e.target.value)})} 
                                            className="w-full h-14 bg-slate-50 border border-slate-100 rounded-[20px] px-6 text-sm font-black text-slate-700 outline-none" 
                                        />
                                    </div>
                                </section>

                                <section className="space-y-6 pt-6">
                                    <div className="bg-amber-50/50 border border-amber-100 rounded-[32px] p-8 space-y-4">
                                        <div className="flex items-center gap-3">
                                            <span className="material-symbols-outlined text-amber-500 text-lg">payments</span>
                                            <h4 className="text-[9px] font-black uppercase text-amber-700 tracking-[0.2em]">Porcentagem de Rateio / Comissão (%)</h4>
                                        </div>
                                        <input 
                                            type="number" 
                                            value={formData.commission_percentage} 
                                            onChange={e => setFormData({...formData, commission_percentage: Number(e.target.value)})} 
                                            className="w-full h-14 bg-white border border-amber-200 rounded-[20px] px-6 text-xl font-black text-amber-900 outline-none focus:ring-4 focus:ring-amber-500/10" 
                                        />
                                        <p className="text-[8px] text-amber-600 font-bold leading-tight">
                                            Porcentagem do valor total da venda que será destinada ao pote de comissões (Autores + Colaboradores).<br />O restante fica para a plataforma/empresa.
                                        </p>
                                    </div>

                                    <div className="bg-purple-50/50 border border-purple-100 rounded-[32px] p-8 space-y-4">
                                        <div className="flex items-center gap-3">
                                            <span className="material-symbols-outlined text-purple-400 text-lg">volunteer_activism</span>
                                            <h4 className="text-[9px] font-black uppercase text-purple-700 tracking-[0.2em]">Porcentagem para Investidores (%)</h4>
                                        </div>
                                        <input 
                                            type="number" 
                                            value={formData.investor_percentage || 0} 
                                            onChange={e => setFormData({...formData, investor_percentage: Number(e.target.value)})} 
                                            className="w-full h-14 bg-white border border-purple-200 rounded-[20px] px-6 text-xl font-black text-purple-900 outline-none focus:ring-4 focus:ring-purple-500/10" 
                                        />
                                        <p className="text-[8px] text-purple-500 font-bold leading-tight">
                                            Parte do valor da venda destinada ao fundo de Investidores (Cotistas).<br />Este valor é separado antes ou em conjunto com a comissão de autores.
                                        </p>
                                    </div>
                                </section>
                            </div>
                        </div>
                    )}

                    {activeTab === 'landing' && (
                        <div className="space-y-10 animate-in fade-in duration-500">
                            <section className="bg-slate-50 p-8 rounded-[32px] border border-slate-200 space-y-6">
                                <div className="flex items-center gap-3">
                                    <div className="size-10 bg-blue-500 text-white rounded-xl flex items-center justify-center">
                                        <span className="material-symbols-outlined">play_circle</span>
                                    </div>
                                    <div>
                                        <h4 className="text-sm font-black text-slate-800 uppercase tracking-tighter">Vídeo de Apresentação</h4>
                                        <p className="text-[10px] text-slate-400 font-bold uppercase">Aparece no topo da sua Landing Page</p>
                                    </div>
                                </div>
                                <div className="flex flex-col md:flex-row gap-4 items-center">
                                    <select 
                                        value={formData.video_type || 'url'} 
                                        onChange={e => setFormData({ ...formData, video_type: e.target.value as any })}
                                        className="w-full md:w-64 h-14 px-6 bg-white border border-slate-200 rounded-2xl font-black text-[10px] uppercase tracking-widest"
                                    >
                                        <option value="url">Link Externo (YT/Vimeo)</option>
                                        <option value="upload">Upload / Biblioteca</option>
                                    </select>
                                    <div className="flex-1 w-full flex gap-3">
                                        <input
                                            type="text"
                                            value={formData.video_url}
                                            onChange={e => setFormData({ ...formData, video_url: e.target.value })}
                                            className="flex-1 h-14 px-6 bg-white border border-slate-200 rounded-2xl font-bold text-sm text-slate-600"
                                            placeholder={formData.video_type === 'url' ? "https://youtube.com/watch?v=..." : "https://..."}
                                        />
                                        {formData.video_type === 'upload' && (
                                            <button 
                                                type="button"
                                                onClick={() => { setMediaFolder('videos'); fetchMediaFiles('videos'); setIsMediaModalOpen(true); }}
                                                className="h-14 px-6 bg-slate-900 text-white rounded-2xl flex items-center gap-2 font-black text-[10px] uppercase tracking-widest hover:bg-blue-600 transition-all shadow-lg"
                                            >
                                                <span className="material-symbols-outlined">collections</span>
                                                Biblioteca
                                            </button>
                                        )}
                                </div>
                                </div>
                                {formData.video_url && (
                                    <div className="mt-6 rounded-[24px] overflow-hidden border border-slate-200 bg-black shadow-2xl animate-in fade-in zoom-in-95 duration-500">
                                        {(formData.video_url.includes('youtube.com') || formData.video_url.includes('youtu.be')) ? (
                                            <iframe 
                                                className="w-full aspect-video"
                                                src={formData.video_url.includes('v=') ? `https://www.youtube.com/embed/${formData.video_url.split('v=')[1].split('&')[0]}` : `https://www.youtube.com/embed/${formData.video_url.split('/').pop()}`}
                                                title="Preview do Vídeo"
                                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                                                allowFullScreen
                                            ></iframe>
                                        ) : (
                                            <video 
                                                className="w-full aspect-video" 
                                                src={formData.video_url} 
                                                controls 
                                                poster={formData.banner_url}
                                            >
                                                Seu navegador não suporta a tag de vídeo.
                                            </video>
                                        )}
                                    </div>
                                )}
                            </section>

                        </div>
                    )}
                    </div>
                </div>
            </div>
                {isMediaModalOpen && <MediaLibraryModalContent />}
            </>
        );

    return (
        <div className="flex flex-col gap-8 pb-10 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-[#111418] text-4xl font-black tracking-tighter">Gestão de Cursos</h2>
                    <p className="text-slate-500 font-medium">Configure as vitrines e conteúdos dos cursos ofertados.</p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={fetchCourses}
                        className="p-3 bg-white border border-slate-200 text-slate-400 rounded-xl hover:text-blue-500 transition-all active:scale-95"
                    >
                        <span className="material-symbols-outlined">sync</span>
                    </button>
                    <button
                        onClick={() => handleOpenForm()}
                        className="flex items-center gap-3 px-8 py-4 bg-[#137fec] text-white rounded-[20px] font-black text-xs uppercase tracking-widest shadow-2xl shadow-blue-500/20 hover:bg-blue-600 transition-all active:scale-95"
                    >
                        <span className="material-symbols-outlined">add_circle</span>
                        Novo Curso
                    </button>
                </div>
            </div>

            <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center gap-3 bg-slate-50 border border-slate-100 rounded-[20px] px-6 py-3 transition-all">
                    <span className="material-symbols-outlined text-slate-300">search</span>
                    <input
                        type="text"
                        placeholder="Buscar por título, área ou cargo..."
                        value={filterSearch}
                        onChange={e => setFilterSearch(e.target.value)}
                        className="bg-transparent border-none outline-none text-sm font-bold w-full"
                    />
                </div>
                <select
                    value={filterArea}
                    onChange={e => setFilterArea(e.target.value)}
                    className="h-14 px-6 bg-slate-50 border border-slate-100 rounded-[20px] text-sm font-bold text-slate-500 outline-none appearance-none"
                >
                    <option value="">Todas as Áreas</option>
                    {areas.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
            </div>

            <div className="bg-white rounded-[40px] border border-slate-200 shadow-xl shadow-slate-200/20 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50/50 border-b border-slate-100 text-[#64748b] text-[10px] font-black uppercase tracking-[0.2em]">
                                <th className="px-10 py-6">Curso / Metadata</th>
                                <th className="px-10 py-6">Banca & Info</th>
                                <th className="px-10 py-6 text-center">Status</th>
                                <th className="px-10 py-6 text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {loading ? (
                                <tr>
                                    <td colSpan={4} className="py-20 text-center">
                                        <div className="size-8 border-4 border-slate-100 border-t-blue-500 rounded-full animate-spin mx-auto mb-4"></div>
                                        <p className="text-xs font-black text-slate-300 uppercase tracking-widest">Sincronizando...</p>
                                    </td>
                                </tr>
                            ) : filteredCourses.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="py-20 text-center text-slate-300 font-bold uppercase tracking-widest text-xs italic">Nenhum curso encontrado</td>
                                </tr>
                            ) : (
                                filteredCourses.map((c) => (
                                    <tr key={c.id} className="hover:bg-blue-50/20 transition-all group">
                                        <td className="px-10 py-8">
                                            <div className="flex items-center gap-5">
                                                <div className="size-14 rounded-[20px] bg-white border border-slate-100 shadow-sm flex items-center justify-center text-[#137fec] relative overflow-hidden">
                                                    {c.banner_url ? (
                                                        <img src={c.banner_url} className="absolute inset-0 w-full h-full object-cover" />
                                                    ) : (
                                                        <span className="material-symbols-outlined text-3xl">school</span>
                                                    )}
                                                </div>
                                                <div className="flex flex-col gap-1">
                                                    <span className="text-base font-black text-[#111418] group-hover:text-[#137fec] transition-colors">{c.title}</span>
                                                    <div className="flex gap-2">
                                                        <span className="text-[9px] font-black bg-slate-100 text-slate-500 px-2 py-0.5 rounded uppercase tracking-wider">{c.area}</span>
                                                        <span className="text-[9px] font-black bg-blue-50 text-blue-600 px-2 py-0.5 rounded uppercase tracking-wider">{c.cargo}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-10 py-8">
                                            <div className="flex flex-col">
                                                <span className="text-xs font-black text-slate-900">{c.bancas?.name || 'Várias Bancas'}</span>
                                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">{c.state || 'Nacional'}</span>
                                            </div>
                                        </td>
                                        <td className="px-10 py-8 text-center">
                                            <button
                                                onClick={() => toggleStatus(c)}
                                                className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border transition-all ${c.status === 'Ativo' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-slate-50 text-slate-400 border-slate-100'}`}
                                            >
                                                {c.status}
                                            </button>
                                        </td>
                                        <td className="px-10 py-8">
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    onClick={() => handlePreview(c)}
                                                    className="size-10 flex items-center justify-center text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 rounded-xl transition-all"
                                                    title="Ver Landpage"
                                                >
                                                    <span className="material-symbols-outlined text-[20px]">visibility</span>
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        setSelectedCourseForLP(c);
                                                        setLpSelectionModalOpen(true);
                                                    }}
                                                    className="px-4 py-2 bg-slate-900 text-white rounded-xl flex items-center gap-2 font-black text-[9px] uppercase tracking-widest hover:bg-blue-600 transition-all active:scale-95 shadow-lg shadow-slate-200"
                                                    title="Configurar Landing Page"
                                                >
                                                    <span className="material-symbols-outlined text-[16px]">auto_awesome</span>
                                                    Página de Vendas
                                                </button>
                                                <button
                                                    onClick={() => handleOpenNotice(c)}
                                                    className="size-10 flex items-center justify-center text-slate-400 hover:text-amber-500 hover:bg-amber-50 rounded-xl transition-all"
                                                    title="Avisos do Curso"
                                                >
                                                    <span className="material-symbols-outlined text-[20px]">notifications</span>
                                                </button>
                                                <button
                                                    onClick={() => handleDuplicate(c)}
                                                    className="size-10 flex items-center justify-center text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded-xl transition-all"
                                                    title="Duplicar"
                                                >
                                                    <span className="material-symbols-outlined text-[20px]">content_copy</span>
                                                </button>
                                                <button
                                                    onClick={() => handleOpenForm(c)}
                                                    className="size-10 flex items-center justify-center text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all font-black"
                                                    title="Editar"
                                                >
                                                    <span className="material-symbols-outlined text-[20px]">edit_note</span>
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteCourse(c.id)}
                                                    className="size-10 flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                                                    title="Excluir"
                                                >
                                                    <span className="material-symbols-outlined text-[20px]">delete</span>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* LP Selection Modal */}
            {lpSelectionModalOpen && selectedCourseForLP && (
                <div className="fixed inset-0 z-[1000] flex items-center justify-center p-6 animate-in fade-in duration-300">
                    <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md" onClick={() => setLpSelectionModalOpen(false)}></div>
                    <div className="relative w-full max-w-6xl bg-white rounded-[48px] shadow-huge overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col max-h-[90vh]">
                        <div className="p-10 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                            <div className="flex items-center gap-6">
                                <div className="size-16 bg-blue-500 text-white rounded-[24px] flex items-center justify-center shadow-xl shadow-blue-500/20">
                                    <span className="material-symbols-outlined text-4xl">auto_awesome</span>
                                </div>
                                <div>
                                    <h3 className="text-3xl font-black tracking-tighter text-slate-900">Modelos de Landing Page</h3>
                                    <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Personalizando: {selectedCourseForLP.title}</p>
                                </div>
                            </div>
                            <button onClick={() => setLpSelectionModalOpen(false)} className="size-14 bg-white border border-slate-200 rounded-full flex items-center justify-center text-slate-400 hover:text-red-500 hover:border-red-100 transition-all shadow-sm">
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-10 custom-scrollbar space-y-12">
                            {[
                                { title: 'Premium & Alta Conversão', desc: 'Designs de alto impacto aprovados.', models: [
                                    { id: 'impacto-neon', label: 'Impacto Neon', desc: 'Design luxuoso com tons neon, modo escuro e efeitos cibernéticos.', color: '#00f5d4' },
                                    { id: 'elite_gold', label: 'Elite Gold', desc: 'Design agressivo, focado em autoridade e escassez.', color: '#facc15' },
                                    { id: 'premium', label: 'Premium Impacto', desc: 'Design clean, profissional e moderno.', color: '#137fec' }
                                ]}
                            ].map((group, gIdx) => (
                                <div key={gIdx} className="space-y-6">
                                    <div className="border-l-4 border-blue-500 pl-6">
                                        <h4 className="text-xl font-black text-slate-800 uppercase tracking-tight">{group.title}</h4>
                                        <p className="text-sm text-slate-400 font-medium">{group.desc}</p>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                        {group.models.map(m => (
                                            <div 
                                                key={m.id} 
                                                onClick={async () => {
                                                    setLoading(true);
                                                    const { error } = await supabase.from('courses').update({ lp_model: m.id }).eq('id', selectedCourseForLP.id);
                                                    if (error) alert('Erro ao atualizar: ' + error.message);
                                                    else {
                                                        fetchCourses();
                                                        setLpSelectionModalOpen(false);
                                                        window.open(`/curso/lp/${selectedCourseForLP.id}`, '_blank');
                                                    }
                                                    setLoading(false);
                                                }}
                                                className={`group p-8 rounded-[40px] border-2 cursor-pointer transition-all flex flex-col items-center text-center gap-6 relative overflow-hidden ${selectedCourseForLP.lp_model === m.id ? 'bg-blue-50 border-blue-500 shadow-2xl' : 'bg-white border-slate-100 hover:border-blue-200 hover:shadow-xl'}`}
                                            >
                                                <div className="size-20 rounded-[28px] flex items-center justify-center shadow-huge transform group-hover:scale-110 group-hover:rotate-3 transition-all duration-500" style={{ backgroundColor: m.color }}>
                                                    <span className="material-symbols-outlined text-white text-5xl">design_services</span>
                                                </div>
                                                <div className="space-y-2">
                                                    <p className="text-lg font-black text-slate-800">{m.label}</p>
                                                    <p className="text-xs text-slate-400 font-bold leading-relaxed">{m.desc}</p>
                                                </div>
                                                {selectedCourseForLP.lp_model === m.id && (
                                                    <div className="absolute top-6 right-6 text-blue-500 scale-125">
                                                        <span className="material-symbols-outlined">check_circle</span>
                                                    </div>
                                                )}
                                                <div className="absolute inset-x-0 bottom-0 h-1.5 bg-blue-500 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                        
                        <div className="p-8 bg-slate-50 border-t border-slate-100 flex justify-end">
                            <button onClick={() => setLpSelectionModalOpen(false)} className="px-12 py-4 bg-white border border-slate-200 text-slate-600 rounded-[24px] font-black uppercase text-xs tracking-widest hover:bg-slate-100 transition-all shadow-sm">Fechar</button>
                        </div>
                    </div>
                </div>
            )}
            {isMediaModalOpen && <MediaLibraryModalContent />}
        </div>
    );
};

export default Cursos;
