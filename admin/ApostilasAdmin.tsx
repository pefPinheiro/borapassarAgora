
import React, { useState, useEffect, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import { StarterKit } from '@tiptap/starter-kit';
import { Underline } from '@tiptap/extension-underline';
import { TextAlign } from '@tiptap/extension-text-align';
import { Image } from '@tiptap/extension-image';
import { Link } from '@tiptap/extension-link';
import { Highlight } from '@tiptap/extension-highlight';
import { Youtube } from '@tiptap/extension-youtube';
import { Placeholder } from '@tiptap/extension-placeholder';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import { supabase } from '../lib/supabase';
import { Apostila, Disciplina, Assunto, Profile } from '../types';
import TiptapEditor, { TiptapRef } from './TiptapEditor';

interface Banca {
    id: string;
    name: string;
}

const ApostilasAdmin: React.FC = () => {
    const [view, setView] = useState<'list' | 'form'>('list');
    const [apostilas, setApostilas] = useState<Apostila[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentUser, setCurrentUser] = useState<Profile | null>(null);

    // Modal de Questões
    const [isQuestionModalOpen, setIsQuestionModalOpen] = useState(false);
    const [allQuestions, setAllQuestions] = useState<any[]>([]);
    const [searchQ, setSearchQ] = useState('');
    const [qFilterDisciplina, setQFilterDisciplina] = useState('');
    const [qFilterAssunto, setQFilterAssunto] = useState('');
    const [qFilterBanca, setQFilterBanca] = useState('');
    const [qFilterAno, setQFilterAno] = useState('');
    const [qFilterModalidade, setQFilterModalidade] = useState('');
    const [expandedBaseTexts, setExpandedBaseTexts] = useState<Set<string>>(new Set());

    // Form State
    const [editingApostila, setEditingApostila] = useState<Apostila | null>(null);
    const [isToolbarMinimized, setIsToolbarMinimized] = useState(false);

    // Auxiliary Data
    const [bancas, setBancas] = useState<Banca[]>([]);
    const [disciplinas, setDisciplinas] = useState<Disciplina[]>([]);
    const [assuntos, setAssuntos] = useState<Assunto[]>([]);
    const [admins, setAdmins] = useState<Profile[]>([]);

    // Filters
    const [filterSearch, setFilterSearch] = useState('');
    const [filterDisciplina, setFilterDisciplina] = useState('');
    const [filterAuthor, setFilterAuthor] = useState('');

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const [totalCount, setTotalCount] = useState(0);
    const ITEMS_PER_PAGE = 20;

    const [formData, setFormData] = useState<any>({
        title: '',
        description: '',
        content: '',
        estimated_time: '',
        status: 'Ativo',
        disciplina_id: null,
        assunto_id: null,
        assigned_editor_id: null,
        filters: {
            banca_id: '',
            disciplina_id: '',
            assunto_id: '',
            modalidade: '',
            ano: ''
        },
        commission_valid_until: ''
    });

    // Cadernos State
    const [notebooks, setNotebooks] = useState<any[]>([]); // Notebooks vinculados
    const [isCadernoModalOpen, setIsCadernoModalOpen] = useState(false);
    const [cadernoTab, setCadernoTab] = useState<'link' | 'create'>('link');
    const [availableNotebooks, setAvailableNotebooks] = useState<any[]>([]); // Todos notebooks para vincular
    const [selectedNotebookId, setSelectedNotebookId] = useState('');
    const [cadernoSearch, setCadernoSearch] = useState('');
    const [cadernoFilterDisc, setCadernoFilterDisc] = useState('');
    const [cadernoFilterSub, setCadernoFilterSub] = useState('');

    // Create Mode State
    const [cadernoFile, setCadernoFile] = useState<File | null>(null);
    const [cadernoTitle, setCadernoTitle] = useState('');
    const [cadernoDescription, setCadernoDescription] = useState('');
    const [isCadernoSubmitting, setIsCadernoSubmitting] = useState(false);

    useEffect(() => {
        const init = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
                if (profile) setCurrentUser(profile);
            }
            fetchAuxData();
        };
        init();
    }, []);

    const fetchLinkedNotebooks = async (apostilaId: string) => {
        const { data: nbs } = await supabase.from('notebooks').select('*').eq('apostila_id', apostilaId);
        setNotebooks(nbs || []);
    };

    const fetchAvailableNotebooks = async () => {
        // Fetch notebooks that are NOT linked to ANY apostila OR linked to THIS apostila (if we want to unlink/manage?)
        // Usually we want to find notebooks to link. 
        // Logic: Show all, or show only unlinked? User request implies "escolher um caderno salvo".
        // Let's fetch all and let user filter.
        let query = supabase.from('notebooks').select('*, disciplina:disciplinas(name), assunto:assuntos(name)').order('created_at', { ascending: false });

        const { data } = await query;
        if (data) setAvailableNotebooks(data);
    };

    useEffect(() => {
        if (isCadernoModalOpen) {
            fetchAvailableNotebooks();
        }
    }, [isCadernoModalOpen]);

    useEffect(() => {
        fetchApostilas();
    }, [currentPage, filterSearch, filterDisciplina, filterAuthor]);

    // Reset to page 1 when filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [filterSearch, filterDisciplina, filterAuthor]);

    const fetchApostilas = async () => {
        setLoading(true);
        try {
            let query = supabase
                .from('apostilas')
                .select(`
                    *,
                    author:profiles!author_id (full_name),
                    assigned_editor:profiles!assigned_editor_id (full_name),
                    disciplinas (name)
                `, { count: 'exact' });

            if (filterSearch) {
                query = query.ilike('title', `%${filterSearch}%`);
            }
            if (filterDisciplina) {
                query = query.eq('disciplina_id', filterDisciplina);
            }
            if (filterAuthor) {
                query = query.or(`author_id.eq.${filterAuthor},assigned_editor_id.eq.${filterAuthor}`);
            }

            const from = (currentPage - 1) * ITEMS_PER_PAGE;
            const to = from + ITEMS_PER_PAGE - 1;

            const { data, error, count } = await query
                .order('created_at', { ascending: false })
                .range(from, to);

            if (error) throw error;
            setApostilas(data || []);
            setTotalCount(count || 0);
        } catch (error: any) {
            console.error('Error fetching apostilas:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchAuxData = async () => {
        try {
            const [bRes, dRes, aRes, admRes] = await Promise.all([
                supabase.from('bancas').select('id, name').order('name'),
                supabase.from('disciplinas').select('*').order('name'),
                supabase.from('assuntos').select('*').order('name'),
                supabase.from('profiles').select('*').in('role', ['admin', 'super']).order('full_name'),
            ]);
            if (bRes.data) setBancas(bRes.data);
            if (dRes.data) setDisciplinas(dRes.data);
            if (aRes.data) setAssuntos(aRes.data);
            if (admRes.data) setAdmins(admRes.data);

            // Busca inicial de questões (vazias ou recentes)
            handleSearchQuestions('');
        } catch (e) {
            console.error('Error fetching aux data:', e);
        }
    };

    const handleSearchQuestions = async (term: string) => {
        try {
            let query = supabase
                .from('questions')
                .select('id, enunciado, bancas(name), ano, disciplina_id, assunto_id, banca_id, texto_base')
                .limit(50)
                .order('created_at', { ascending: false });

            if (term) {
                if (term.length > 30) {
                    query = query.eq('id', term);
                } else {
                    query = query.ilike('enunciado', `%${term}%`);
                }
            }

            if (qFilterDisciplina) query = query.eq('disciplina_id', qFilterDisciplina);
            if (qFilterAssunto) query = query.eq('assunto_id', qFilterAssunto);
            if (qFilterBanca) query = query.eq('banca_id', qFilterBanca);
            if (qFilterAno) query = query.eq('ano', qFilterAno);
            if (qFilterModalidade) query = query.eq('modalidade', qFilterModalidade);

            const { data } = await query;
            if (data) setAllQuestions(data);
        } catch (e) {
            console.error('Error searching questions:', e);
        }
    };

    // Re-trigger search when filters change
    useEffect(() => {
        if (isQuestionModalOpen) handleSearchQuestions(searchQ);
    }, [qFilterDisciplina, qFilterAssunto, qFilterBanca, qFilterAno, qFilterModalidade]);

    const handleOpenForm = async (apostila?: Apostila) => {
        if (apostila) {
            setEditingApostila(apostila);
            setFormData({
                title: apostila.title || '',
                description: apostila.description || '',
                content: apostila.content || '',
                estimated_time: apostila.estimated_time || '',
                status: apostila.status || 'Ativo',
                disciplina_id: apostila.disciplina_id || null,
                assunto_id: apostila.assunto_id || null,
                assigned_editor_id: apostila.assigned_editor_id || null,
                filters: apostila.filters || {
                    banca_id: '',
                    disciplina_id: '',
                    assunto_id: '',
                    modalidade: '',
                    ano: ''
                },
                commission_valid_until: apostila.commission_valid_until || ''
            });

            fetchLinkedNotebooks(apostila.id);
        } else {
            setEditingApostila(null);
            setFormData({
                title: '',
                description: '',
                content: '',
                estimated_time: '',
                status: 'Ativo',
                disciplina_id: null,
                assunto_id: null,
                assigned_editor_id: null,
                filters: {
                    banca_id: '',
                    disciplina_id: '',
                    assunto_id: '',
                    modalidade: '',
                    ano: ''
                },
                commission_valid_until: ''
            });
            setNotebooks([]);
        }
        setView('form');
    };

    const handleSubmit = async () => {
        if (!formData.title || !formData.disciplina_id) {
            alert('Por favor, preencha o título e selecione uma disciplina.');
            return;
        }

        try {
            // Definir data de comissão padrão (1 ano) se estiver vazia
            let commissionDate = formData.commission_valid_until;
            if (!commissionDate) {
                const oneYearLater = new Date();
                oneYearLater.setFullYear(oneYearLater.getFullYear() + 1);
                commissionDate = oneYearLater.toISOString().split('T')[0];
            }

            // Preservamos todos os campos do formData, garantindo que os auxiliares do select estejam ok
            const apPayload = {
                ...formData,
                commission_valid_until: commissionDate,
                assigned_editor_id: formData.assigned_editor_id || null,
                filters: formData.filters || {},
                updated_at: new Date().toISOString()
            };

            // Removemos campos que não existem na tabela (relações de join)
            delete (apPayload as any).author;
            delete (apPayload as any).assigned_editor;
            delete (apPayload as any).disciplinas;

            if (editingApostila) {
                const { error } = await supabase
                    .from('apostilas')
                    .update(apPayload)
                    .eq('id', editingApostila.id);
                if (error) throw error;
            } else {
                const { error } = await supabase.from('apostilas').insert({
                    ...apPayload,
                    author_id: currentUser?.id,
                    assigned_editor_id: apPayload.assigned_editor_id || currentUser?.id
                });
                if (error) throw error;
            }

            alert('Apostila salva com sucesso!');
            fetchApostilas();
            setView('list');
        } catch (error: any) {
            console.error('Error detail:', error);
            alert(`Erro ao salvar: ${error.message || error.error_description || 'Verifique sua conexão ou permissões admin.'}`);
        }
    };

    const handleDelete = async (id: string) => {
        if (window.confirm('Excluir esta apostila permanentemente de nossos servidores? Esta ação não pode ser desfeita.')) {
            try {
                const { error } = await supabase.from('apostilas').delete().eq('id', id);
                if (error) throw error;
                alert('Apostila removida com sucesso.');
                fetchApostilas();
            } catch (e: any) {
                console.error(e);
                alert(`Erro ao excluir: ${e.message}`);
            }
        }
    };

    const handleDuplicate = async (apostila: Apostila) => {
        if (window.confirm(`Deseja duplicar a apostila "${apostila.title}"?`)) {
            try {
                const { id, created_at, updated_at, author, assigned_editor, disciplinas, ...rest } = apostila;
                const duplicatePayload = {
                    ...rest,
                    title: `${apostila.title} (Cópia)`,
                    status: 'Inativo',
                    author_id: currentUser?.id,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                };

                const { error } = await supabase.from('apostilas').insert(duplicatePayload);
                if (error) throw error;

                alert('Apostila duplicada com sucesso!');
                fetchApostilas();
            } catch (error: any) {
                alert(`Erro ao duplicar: ${error.message}`);
            }
        }
    };

    const handlePreview = (id: string) => {
        window.open(`/aluno/apostila/${id}`, '_blank');
    };

    const editorRef = useRef<TiptapRef>(null);
    const [uploading, setUploading] = useState(false);
    const imageInputRef = useRef<HTMLInputElement>(null);

    const handleFileUpload = async (file: File) => {
        setUploading(true);
        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
            const filePath = `apostilas/${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('public')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('public')
                .getPublicUrl(filePath);

            const tag = `<img src="${publicUrl}" class="w-full rounded-[50px] shadow-2xl border-4 border-white my-8" /><br/>`;
            editorRef.current?.insertContent(tag);
        } catch (e: any) {
            console.error(e);
            alert('Erro ao fazer upload: ' + e.message);
        } finally {
            setUploading(false);
        }
    };

    const handleCadernoSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingApostila) return;

        setIsCadernoSubmitting(true);
        try {
            if (cadernoTab === 'link') {
                if (!selectedNotebookId) {
                    alert('Selecione um caderno da lista.');
                    setIsCadernoSubmitting(false);
                    return;
                }
                const { error } = await supabase
                    .from('notebooks')
                    .update({ apostila_id: editingApostila.id })
                    .eq('id', selectedNotebookId);

                if (error) throw error;
                alert('Caderno vinculado com sucesso!');

            } else {
                // Create Mode
                if (!cadernoFile || !cadernoTitle) {
                    alert('Preencha o título e selecione o arquivo JSON.');
                    setIsCadernoSubmitting(false);
                    return;
                }

                const text = await cadernoFile.text();
                let questions = [];
                try {
                    questions = JSON.parse(text);
                } catch (err) {
                    alert('Erro ao ler JSON.');
                    setIsCadernoSubmitting(false);
                    return;
                }

                if (!Array.isArray(questions)) {
                    alert('JSON inválido (deve ser array).');
                    setIsCadernoSubmitting(false);
                    return;
                }

                const { data: nb, error: nbError } = await supabase
                    .from('notebooks')
                    .insert({
                        title: cadernoTitle,
                        description: cadernoDescription,
                        discipline_id: editingApostila.disciplina_id,
                        subject_id: editingApostila.assunto_id,
                        apostila_id: editingApostila.id
                    })
                    .select()
                    .single();

                if (nbError) throw nbError;

                const formattedQuestions = questions.map((q: any, i: number) => ({
                    notebook_id: nb.id,
                    question_text: q.text || q.question || '',
                    options: q.options || [],
                    correct_answer: q.answer || q.correct_answer || '',
                    explanation: q.explanation || '',
                    order_index: i + 1
                }));

                const { error: qError } = await supabase.from('notebook_questions').insert(formattedQuestions);
                if (qError) throw qError;

                alert('Caderno criado e vinculado!');
            }

            // Cleanup and Refresh
            setIsCadernoModalOpen(false);
            setCadernoTitle('');
            setCadernoDescription('');
            setCadernoFile(null);
            setSelectedNotebookId('');
            fetchLinkedNotebooks(editingApostila.id);

        } catch (e: any) {
            console.error(e);
            alert('Erro: ' + e.message);
        } finally {
            setIsCadernoSubmitting(false);
        }
    };

    const handleUnlinkNotebook = async (notebookId: string) => {
        if (!window.confirm('Tem certeza que deseja desvincular este caderno? Ele permanecerá no sistema, mas não estará mais associado a esta apostila.')) return;

        try {
            const { error } = await supabase
                .from('notebooks')
                .update({ apostila_id: null })
                .eq('id', notebookId);

            if (error) throw error;

            if (editingApostila) fetchLinkedNotebooks(editingApostila.id);
            // alert('Caderno desvinculado com sucesso.');
        } catch (e: any) {
            console.error(e);
            alert('Erro ao desvincular: ' + e.message);
        }
    };

    const insertTag = (tagType: 'question' | 'video' | 'image' | 'math') => {
        if (tagType === 'question') {
            setIsQuestionModalOpen(true);
            return;
        }

        if (tagType === 'image') {
            imageInputRef.current?.click();
            return;
        }

        if (tagType === 'math') {
            const tag = `
<p><strong>Exemplo de Fórmula Matemática (Display):</strong></p>
<p>$$ x = \\frac{-b \\pm \\sqrt{b^2-4ac}}{2a} $$</p>
<p><strong>Exemplo Inline:</strong> A equação \\( E=mc^2 \\) é famosa.</p>
<br/>`;
            editorRef.current?.insertContent(tag);
            return;
        }

        const id = window.prompt(`Digite o Link do Vídeo (Youtube/Vimeo):`);
        if (!id) return;

        const tag = `<div class="ap-placeholder ap-v" data-url="${id}">[VÍDEO AULA: ${id}]</div><br/>`;
        editorRef.current?.insertContent(tag);
    };

    const insertQuestion = (qId: string) => {
        const tag = `<div class="ap-placeholder ap-q" data-id="${qId}">[quest_id:"${qId}"]</div><br/>`;
        editorRef.current?.insertContent(tag);
        setIsQuestionModalOpen(false);
        setSearchQ('');
    };

    // Filter Logic - (unchanged code skipped for brevity)
    // ...

    // ... (rendering code)
    <div className="tiptap-premium-wrapper">
        <TiptapEditor
            ref={editorRef}
            content={formData.content || ''}
            onChange={(val) => setFormData({ ...formData, content: val })}
        />
    </div>

    // Filter Logic - Now handled server-side for performance
    const filteredApostilas = apostilas;

    // Permission Logic
    // Permission Logic
    const getPermissions = (a: Apostila) => {
        if (!currentUser) return { canDelete: false, canEdit: false, canDuplicate: false };
        const isSuper = currentUser.role === 'super';
        const isAuthorized = a.assigned_editor_id === currentUser.id;

        return {
            canDelete: isSuper,
            canEdit: isSuper || isAuthorized,
            canDuplicate: isSuper || isAuthorized
        };
    };

    // Grouping Logic
    const grouped = filteredApostilas.reduce((acc, a) => {
        const dName = a.disciplinas?.name || 'Sem Disciplina';
        if (!acc[dName]) acc[dName] = [];
        acc[dName].push(a);
        return acc;
    }, {} as Record<string, Apostila[]>);

    if (view === 'form') {
        return (
            <div className="flex flex-col gap-6 animate-in slide-in-from-right duration-500 pb-20">
                {/* Hidden Upload Input */}
                <input
                    type="file"
                    ref={imageInputRef}
                    className="hidden"
                    accept="image/*"
                    onChange={(e) => {
                        if (e.target.files?.[0]) handleFileUpload(e.target.files[0]);
                    }}
                />

                {/* Modal de Questões */}
                {isQuestionModalOpen && (
                    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
                        <div className="bg-white w-full max-w-4xl rounded-[40px] shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
                            <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                                <div>
                                    <h3 className="text-xl font-black text-slate-900 uppercase">Selecionar Questão</h3>
                                    <p className="text-xs font-bold text-slate-400">Escolha uma questão para inserir no corpo do texto.</p>
                                </div>
                                <button onClick={() => setIsQuestionModalOpen(false)} className="size-10 rounded-full hover:bg-slate-200 flex items-center justify-center transition-all">
                                    <span className="material-symbols-outlined">close</span>
                                </button>
                            </div>

                            <div className="p-6 bg-white border-b border-slate-100 space-y-4">
                                <div className="flex items-center gap-3 bg-slate-100 px-4 py-3 rounded-2xl">
                                    <span className="material-symbols-outlined text-slate-400">search</span>
                                    <input
                                        type="text"
                                        placeholder="Buscar por enunciado..."
                                        className="bg-transparent border-none outline-none font-bold text-sm w-full"
                                        value={searchQ}
                                        onChange={e => {
                                            setSearchQ(e.target.value);
                                            handleSearchQuestions(e.target.value);
                                        }}
                                    />
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                    <select
                                        value={qFilterDisciplina}
                                        onChange={e => { setQFilterDisciplina(e.target.value); setQFilterAssunto(''); }}
                                        className="h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 outline-none"
                                    >
                                        <option value="">Todas Disciplinas</option>
                                        {disciplinas.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                                    </select>
                                    <select
                                        value={qFilterAssunto}
                                        onChange={e => setQFilterAssunto(e.target.value)}
                                        className="h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 outline-none"
                                        disabled={!qFilterDisciplina}
                                    >
                                        <option value="">Todos Assuntos</option>
                                        {assuntos.filter(a => a.disciplina_id === qFilterDisciplina).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                                    </select>
                                    <select
                                        value={qFilterBanca}
                                        onChange={e => setQFilterBanca(e.target.value)}
                                        className="h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 outline-none"
                                    >
                                        <option value="">Todas Bancas</option>
                                        {bancas.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                                    </select>
                                    <input
                                        type="number"
                                        placeholder="Ano"
                                        value={qFilterAno}
                                        onChange={e => setQFilterAno(e.target.value)}
                                        className="h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 outline-none"
                                    />
                                    <select
                                        value={qFilterModalidade}
                                        onChange={e => setQFilterModalidade(e.target.value)}
                                        className="h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 outline-none"
                                    >
                                        <option value="">Modalidade</option>
                                        <option value="Multipla Escolha (5)">Múltipla Escolha (5)</option>
                                        <option value="Multipla Escolha (4)">Múltipla Escolha (4)</option>
                                        <option value="Certo/Errado">Certo ou Errado</option>
                                        <option value="Discursiva">Discursiva</option>
                                    </select>
                                </div>
                            </div>

                            <div className="flex-1 overflow-y-auto p-4 space-y-2 no-scrollbar">
                                {allQuestions
                                    .map(q => (
                                        <div key={q.id} className="w-full flex flex-col gap-2 group/item bg-white border border-transparent hover:border-blue-100 hover:bg-blue-50/30 rounded-[24px] transition-all p-4">
                                            <div className="flex items-start gap-2">
                                                <button
                                                    onClick={() => insertQuestion(q.id)}
                                                    className="flex-1 text-left"
                                                >
                                                    <div className="flex justify-between items-start gap-4 mb-2">
                                                        <div className="flex gap-2">
                                                            <span className="text-[9px] font-black text-blue-600 bg-blue-50 px-3 py-1 rounded-full uppercase tracking-widest">{q.bancas?.name || 'Geral'} • {q.ano}</span>
                                                            {q.texto_base && (
                                                                <span
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        const newSet = new Set(expandedBaseTexts);
                                                                        if (newSet.has(q.id)) newSet.delete(q.id);
                                                                        else newSet.add(q.id);
                                                                        setExpandedBaseTexts(newSet);
                                                                    }}
                                                                    className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wide cursor-pointer hover:scale-105 transition-all ${expandedBaseTexts.has(q.id) ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-400 hover:bg-indigo-50 hover:text-indigo-500'}`}
                                                                    title="Ver Texto Base"
                                                                >
                                                                    <span className="material-symbols-outlined text-[14px]">description</span>
                                                                    Texto Base
                                                                </span>
                                                            )}
                                                        </div>
                                                        <span className="text-[10px] font-mono text-slate-300 group-hover:text-blue-400">ID: {q.id.substring(0, 8)}...</span>
                                                    </div>
                                                    <div className="text-sm font-bold text-slate-700 line-clamp-2" dangerouslySetInnerHTML={{ __html: q.enunciado.substring(0, 150) + '...' }} />
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        navigator.clipboard.writeText(`[quest_id:"${q.id}"]`);
                                                        alert('Código copiado!');
                                                    }}
                                                    className="p-2 text-slate-300 hover:text-blue-500 hover:bg-blue-50 rounded-xl transition-all h-fit"
                                                    title="Copiar Código"
                                                >
                                                    <span className="material-symbols-outlined text-lg">content_copy</span>
                                                </button>
                                            </div>

                                            {expandedBaseTexts.has(q.id) && q.texto_base && (
                                                <div className="mt-2 text-xs text-slate-600 bg-slate-50 p-4 rounded-xl border border-slate-100 animate-in fade-in slide-in-from-top-2">
                                                    <strong className="block text-slate-400 text-[10px] uppercase tracking-widest mb-2">Texto Base de Apoio</strong>
                                                    <div dangerouslySetInnerHTML={{ __html: q.texto_base }} />
                                                </div>
                                            )}
                                        </div>
                                    ))}
                            </div>
                        </div>
                    </div>
                )}

                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button onClick={() => setView('list')} className="size-12 flex items-center justify-center bg-white border border-slate-200 rounded-2xl text-slate-400 hover:text-slate-900 transition-all shadow-sm">
                            <span className="material-symbols-outlined">arrow_back</span>
                        </button>
                        <div>
                            <h2 className="text-3xl font-black text-[#111418] tracking-tight">{editingApostila ? 'Editando Apostila' : 'Nova Apostila Interativa'}</h2>
                            <p className="text-sm text-slate-500 font-medium italic">Autor do Registro: {editingApostila?.author?.full_name || currentUser?.full_name}</p>
                        </div>
                    </div>
                    <div className="flex gap-4">
                        <button onClick={() => setView('list')} className="px-8 py-3 bg-white border border-slate-200 rounded-2xl font-black text-[10px] uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-all">Cancelar</button>
                        <button onClick={handleSubmit} className="px-10 py-3 bg-[#137fec] text-white rounded-2xl font-black text-[11px] uppercase tracking-[0.2em] shadow-2xl shadow-blue-500/20 hover:bg-blue-600 transition-all active:scale-95">
                            Salvar Alterações
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
                    <div className="xl:col-span-8 space-y-6">
                        <div className="bg-white rounded-[40px] border border-slate-200 shadow-sm p-10 space-y-8">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] pl-1">Título da Obra</label>
                                    <input
                                        type="text"
                                        value={formData.title}
                                        onChange={e => setFormData({ ...formData, title: e.target.value })}
                                        placeholder="Ex: Noções de Direito Constitucional"
                                        className="w-full h-14 px-6 bg-slate-50 border border-slate-100 rounded-2xl text-lg font-black text-[#111418] outline-none focus:ring-4 focus:ring-blue-50 transition-all placeholder:text-slate-300"
                                    />
                                </div>
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] pl-1">Descrição Breve</label>
                                    <input
                                        type="text"
                                        value={formData.description}
                                        onChange={e => setFormData({ ...formData, description: e.target.value })}
                                        placeholder="Resumo do que será tratado..."
                                        className="w-full h-14 px-6 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold text-slate-600 outline-none"
                                    />
                                </div>
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] pl-1">Tempo Estimado</label>
                                    <input
                                        type="text"
                                        value={formData.estimated_time || ''}
                                        onChange={e => setFormData({ ...formData, estimated_time: e.target.value })}
                                        placeholder="Ex: 20 min"
                                        className="w-full h-14 px-6 bg-slate-50 border border-slate-100 rounded-2xl text-lg font-black text-[#111418] outline-none focus:ring-4 focus:ring-blue-50 transition-all placeholder:text-slate-300"
                                    />
                                </div>
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] pl-1">
                                        Validade da Comissão {currentUser?.role !== 'super' && '(Somente Super Admin)'}
                                    </label>
                                    <input
                                        type="date"
                                        disabled={currentUser?.role !== 'super'}
                                        value={formData.commission_valid_until || ''}
                                        onChange={e => setFormData({ ...formData, commission_valid_until: e.target.value })}
                                        className={`w-full h-14 px-6 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold text-slate-600 outline-none ${currentUser?.role !== 'super' ? 'opacity-50 cursor-not-allowed' : ''}`}
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="bg-white rounded-[40px] border border-slate-200 shadow-sm p-10 space-y-8">
                            {/* Floating Toolbar */}
                            <div className={`fixed top-6 left-1/2 -translate-x-1/2 z-[800] transition-all duration-300 ${isToolbarMinimized ? 'w-auto' : 'w-[90%] max-w-4xl'}`}>
                                <div className={`bg-white/80 backdrop-blur-xl border border-white/40 shadow-2xl rounded-[30px] p-2 flex items-center justify-between gap-4 transition-all ${isToolbarMinimized ? 'px-2' : 'px-4 py-2'}`}>

                                    {isToolbarMinimized ? (
                                        <button
                                            onClick={() => setIsToolbarMinimized(false)}
                                            className="size-12 bg-blue-500 text-white rounded-full flex items-center justify-center hover:scale-110 transition-transform shadow-lg shadow-blue-500/30"
                                            title="Expandir Toolbar"
                                        >
                                            <span className="material-symbols-outlined">edit</span>
                                        </button>
                                    ) : (
                                        <>
                                            <div className="flex items-center gap-3 pl-4">
                                                <div className="size-10 bg-gradient-to-br from-slate-800 to-slate-900 text-white rounded-xl flex items-center justify-center shadow-lg">
                                                    <span className="material-symbols-outlined text-[20px]">article</span>
                                                </div>
                                                <div className="hidden sm:block">
                                                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-800">Editor</h3>
                                                    <p className="text-[9px] font-bold text-slate-400">Conteúdo Rico</p>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-2">
                                                <button onClick={() => insertTag('question')} className="flex items-center gap-2 px-4 py-2.5 bg-emerald-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20 active:scale-95">
                                                    <span className="material-symbols-outlined text-[18px]">quiz</span>
                                                    <span className="hidden md:inline">Questão</span>
                                                </button>
                                                <button onClick={() => insertTag('math')} className="flex items-center gap-2 px-4 py-2.5 bg-slate-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-lg shadow-slate-500/20 active:scale-95">
                                                    <span className="material-symbols-outlined text-[18px]">calculate</span>
                                                    <span className="hidden md:inline">Fórmula</span>
                                                </button>
                                                <button onClick={() => insertTag('video')} className="flex items-center gap-2 px-4 py-2.5 bg-red-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-red-600 transition-all shadow-lg shadow-red-500/20 active:scale-95">
                                                    <span className="material-symbols-outlined text-[18px]">play_circle</span>
                                                    <span className="hidden md:inline">Vídeo</span>
                                                </button>
                                                <button onClick={() => insertTag('image')} className="flex items-center gap-2 px-4 py-2.5 bg-indigo-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-600 transition-all shadow-lg shadow-indigo-500/20 active:scale-95">
                                                    <span className="material-symbols-outlined text-[18px]">image</span>
                                                    <span className="hidden md:inline">Imagem</span>
                                                </button>
                                            </div>

                                            <div className="h-8 w-px bg-slate-200 mx-2"></div>

                                            <button
                                                onClick={() => setIsToolbarMinimized(true)}
                                                className="size-10 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl flex items-center justify-center transition-all"
                                                title="Minimizar"
                                            >
                                                <span className="material-symbols-outlined">remove</span>
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* Spacer to prevent overlap if sticking */}
                            <div className="flex-1 w-full max-w-full overflow-hidden">
                                <TiptapEditor
                                    ref={editorRef}
                                    content={formData.content || ''}
                                    onChange={(val) => setFormData({ ...formData, content: val })}
                                    minHeight="600px"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="xl:col-span-4 space-y-6">
                        <div className="bg-[#111418] rounded-[40px] p-10 text-white shadow-2xl sticky top-8">
                            <div className="flex items-center gap-3 mb-8 border-b border-white/5 pb-6">
                                <span className="material-symbols-outlined text-blue-500">settings_suggest</span>
                                <h3 className="text-xs font-black uppercase tracking-[0.3em] text-slate-400">Metadados & Acesso</h3>
                            </div>

                            <div className="space-y-8">
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-1">Disciplina Principal</label>
                                    <select
                                        value={formData.disciplina_id || ''}
                                        onChange={e => setFormData({ ...formData, disciplina_id: e.target.value || null, assunto_id: null })}
                                        className="w-full h-14 px-6 bg-white/5 border border-white/10 rounded-2xl outline-none font-black text-xs text-white focus:border-blue-500/50 transition-all"
                                    >
                                        <option value="" className="text-slate-900">Selecione uma categoria...</option>
                                        {disciplinas.map(d => <option key={d.id} value={d.id} className="text-slate-900">{d.name}</option>)}
                                    </select>
                                </div>
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-1">Tópico / Assunto</label>
                                    <select
                                        disabled={!formData.disciplina_id}
                                        value={formData.assunto_id || ''}
                                        onChange={e => setFormData({ ...formData, assunto_id: e.target.value || null })}
                                        className="w-full h-14 px-6 bg-white/5 border border-white/10 rounded-2xl outline-none font-black text-xs text-white disabled:opacity-20 transition-all"
                                    >
                                        <option value="" className="text-slate-900">Selecione o tópico...</option>
                                        {assuntos.filter(a => a.disciplina_id === formData.disciplina_id).map(a => <option key={a.id} value={a.id} className="text-slate-900">{a.name}</option>)}
                                    </select>
                                </div>

                                {currentUser?.role === 'super' && (
                                    <div className="space-y-3 p-6 bg-blue-500/5 border border-blue-500/20 rounded-3xl">
                                        <label className="text-[10px] font-black text-blue-400 uppercase tracking-widest pl-1">Editor Autorizado</label>
                                        <select
                                            value={formData.assigned_editor_id || ''}
                                            onChange={e => setFormData({ ...formData, assigned_editor_id: e.target.value || null })}
                                            className="w-full h-12 px-6 bg-white/5 border border-white/10 rounded-xl outline-none font-bold text-[11px] text-white"
                                        >
                                            <option value="" className="text-slate-900">Nenhum editor extra</option>
                                            {admins.map(adm => <option key={adm.id} value={adm.id} className="text-slate-900">{adm.full_name}</option>)}
                                        </select>
                                    </div>
                                )}

                                <div className="space-y-4 pt-6">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-1">Visibilidade da Obra</label>
                                    <div className="flex p-1.5 bg-white/5 rounded-[24px] border border-white/10">
                                        {['Ativo', 'Inativo'].map(s => (
                                            <button
                                                key={s}
                                                type="button"
                                                onClick={() => setFormData({ ...formData, status: s as any })}
                                                className={`flex-1 py-4 text-[10px] font-black uppercase rounded-2xl transition-all tracking-[0.2em] ${formData.status === s ? 'bg-blue-600 text-white shadow-xl shadow-blue-500/20' : 'text-slate-500 hover:text-white'}`}
                                            >
                                                {s === 'Ativo' ? 'Publicado' : 'Rascunho'}
                                            </button>
                                        ))}
                                    </div>

                                    <div className="space-y-4 pt-6 border-t border-white/5 mt-6">
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="material-symbols-outlined text-emerald-500">menu_book</span>
                                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Cadernos de Questões</label>
                                        </div>

                                        {editingApostila ? (
                                            <div className="space-y-3">
                                                {notebooks.map(nb => (
                                                    <div key={nb.id} className="p-3 bg-white/5 rounded-xl border border-white/10 flex justify-between items-center group">
                                                        <div className="flex items-center gap-2 overflow-hidden">
                                                            <span className="material-symbols-outlined text-slate-500 text-sm">book</span>
                                                            <span className="text-xs font-bold text-slate-300 truncate max-w-[120px]" title={nb.title}>{nb.title}</span>
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleUnlinkNotebook(nb.id)}
                                                            className="size-6 flex items-center justify-center text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-full transition-all opacity-0 group-hover:opacity-100"
                                                            title="Desvincular Caderno"
                                                        >
                                                            <span className="material-symbols-outlined text-sm">close</span>
                                                        </button>
                                                    </div>
                                                ))}
                                                {notebooks.length === 0 && <p className="text-[10px] text-slate-600 italic px-2">Nenhum caderno vinculado.</p>}

                                                <button
                                                    onClick={() => setIsCadernoModalOpen(true)}
                                                    className="w-full py-3 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-500 hover:text-white transition-all flex items-center justify-center gap-2"
                                                >
                                                    <span className="material-symbols-outlined text-sm">add</span>
                                                    Adicionar Caderno
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="p-4 bg-white/5 rounded-xl border border-white/10 text-center">
                                                <p className="text-[10px] text-slate-500 font-medium">Salve a apostila para vincular cadernos.</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>


                {/* Modal Caderno */}
                {isCadernoModalOpen && (
                    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
                        <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsCadernoModalOpen(false)}></div>
                        <div className="relative bg-white w-full max-w-2xl rounded-3xl shadow-2xl p-8 animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-xl font-black text-[#111418]">Gerenciar Cadernos</h3>
                                <button onClick={() => setIsCadernoModalOpen(false)}><span className="material-symbols-outlined text-slate-400">close</span></button>
                            </div>

                            {/* Tabs */}
                            <div className="flex gap-2 mb-6 p-1 bg-slate-100 rounded-xl">
                                <button
                                    onClick={() => setCadernoTab('link')}
                                    className={`flex-1 py-2.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${cadernoTab === 'link' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                >
                                    Vincular Existente
                                </button>
                                <button
                                    onClick={() => setCadernoTab('create')}
                                    className={`flex-1 py-2.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${cadernoTab === 'create' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                >
                                    Novo Caderno
                                </button>
                            </div>

                            <form onSubmit={handleCadernoSubmit} className="space-y-6">
                                {cadernoTab === 'link' ? (
                                    <div className="space-y-4">
                                        {/* Filters */}
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                            <div className="md:col-span-3">
                                                <input
                                                    type="text"
                                                    placeholder="Buscar por nome..."
                                                    value={cadernoSearch}
                                                    onChange={e => setCadernoSearch(e.target.value)}
                                                    className="w-full h-10 px-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none"
                                                />
                                            </div>
                                            <select
                                                value={cadernoFilterDisc}
                                                onChange={e => setCadernoFilterDisc(e.target.value)}
                                                className="h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 outline-none"
                                            >
                                                <option value="">Todas Disciplinas</option>
                                                {disciplinas.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                                            </select>
                                            <select
                                                value={cadernoFilterSub}
                                                onChange={e => setCadernoFilterSub(e.target.value)}
                                                className="h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 outline-none"
                                            >
                                                <option value="">Todos Assuntos</option>
                                                {assuntos.filter(a => !cadernoFilterDisc || a.disciplina_id === cadernoFilterDisc).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                                            </select>
                                        </div>

                                        {/* List */}
                                        <div className="h-64 overflow-y-auto border border-slate-100 rounded-xl p-2 space-y-2 bg-slate-50">
                                            {availableNotebooks
                                                .filter(nb => {
                                                    const matchSearch = !cadernoSearch || nb.title.toLowerCase().includes(cadernoSearch.toLowerCase());
                                                    const matchDisc = !cadernoFilterDisc || nb.discipline_id === cadernoFilterDisc;
                                                    const matchSub = !cadernoFilterSub || nb.subject_id === cadernoFilterSub;
                                                    return matchSearch && matchDisc && matchSub;
                                                })
                                                .map(nb => (
                                                    <div
                                                        key={nb.id}
                                                        onClick={() => setSelectedNotebookId(nb.id)}
                                                        className={`p-3 rounded-lg border cursor-pointer transition-all flex justify-between items-center ${selectedNotebookId === nb.id ? 'bg-blue-50 border-blue-500 ring-1 ring-blue-500' : 'bg-white border-slate-200 hover:border-blue-300'}`}
                                                    >
                                                        <div>
                                                            <div className="text-sm font-bold text-slate-800">{nb.title}</div>
                                                            <div className="text-[10px] text-slate-400 font-bold uppercase mt-1">
                                                                {nb.disciplina?.name} • {nb.assunto?.name}
                                                            </div>
                                                        </div>
                                                        {nb.apostila_id && (
                                                            <span className="text-[9px] bg-amber-100 text-amber-700 font-black px-2 py-1 rounded-md uppercase tracking-wide">Vinculado</span>
                                                        )}
                                                    </div>
                                                ))}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-5">
                                        <div className="space-y-2">
                                            <label className="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">Título do Caderno</label>
                                            <input
                                                required
                                                value={cadernoTitle}
                                                onChange={e => setCadernoTitle(e.target.value)}
                                                className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none"
                                                placeholder="Ex: Caderno de Memorização"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">Descrição</label>
                                            <textarea
                                                value={cadernoDescription}
                                                onChange={e => setCadernoDescription(e.target.value)}
                                                className="w-full h-20 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-medium outline-none resize-none"
                                                placeholder="Breve descrição..."
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">Arquivo JSON (Questões)</label>
                                            <div className="border-2 border-dashed border-slate-200 rounded-xl p-6 text-center hover:bg-slate-50 transition-colors cursor-pointer relative">
                                                <input
                                                    type="file"
                                                    required
                                                    accept=".json"
                                                    onChange={e => {
                                                        if (e.target.files?.[0]) setCadernoFile(e.target.files[0]);
                                                    }}
                                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                                />
                                                <span className="material-symbols-outlined text-3xl text-slate-300 mb-2">upload_file</span>
                                                <p className="text-sm font-bold text-slate-500">{cadernoFile ? cadernoFile.name : 'Selecionar JSON'}</p>
                                            </div>
                                        </div>
                                        <p className="text-[10px] text-slate-400 text-center">O notebook será criado e vinculado automaticamente a esta apostila.</p>
                                    </div>
                                )}

                                <button
                                    type="submit"
                                    disabled={isCadernoSubmitting}
                                    className="w-full h-12 bg-[#137fec] text-white rounded-xl font-black shadow-lg shadow-blue-200 hover:bg-blue-600 transition-all active:scale-95 disabled:opacity-50 uppercase tracking-widest text-xs"
                                >
                                    {isCadernoSubmitting ? 'Processando...' : (cadernoTab === 'link' ? 'Vincular Selecionado' : 'Criar e Vincular')}
                                </button>
                            </form>
                        </div>
                    </div>
                )}

                <style>{`
                    .tiptap-premium-wrapper .ProseMirror { min-height: 600px; outline: none; font-size: 1.15rem; color: #1e293b; line-height: 1.8; }
                    .tiptap-premium-wrapper .ProseMirror h1 { font-size: 2.5rem; font-weight: 900; margin: 2rem 0; color: #111; }
                    .tiptap-premium-wrapper .ProseMirror h2 { font-size: 1.8rem; font-weight: 800; margin: 1.5rem 0; color: #333; }
                    .tiptap-premium-wrapper .ProseMirror h3 { font-size: 1.4rem; font-weight: 700; margin: 1.2rem 0; }
                    .tiptap-premium-wrapper .ProseMirror p { margin-bottom: 1.5rem; }
                    .tiptap-premium-wrapper .ProseMirror blockquote { border-left: 4px solid #e2e8f0; padding-left: 1.5rem; color: #64748b; font-style: italic; }
                    .tiptap-premium-wrapper .ProseMirror img { max-width: 100%; border-radius: 1rem; margin: 2rem 0; }
                    .tiptap-premium-wrapper .ProseMirror table { border-collapse: collapse; width: 100%; margin: 2rem 0; }
                    .tiptap-premium-wrapper .ProseMirror th, .tiptap-premium-wrapper .ProseMirror td { border: 1px solid #e2e8f0; padding: 0.8rem; }
                    .tiptap-premium-wrapper .ProseMirror th { background: #f8fafc; }
                    
                    /* Custom Placeholders */
                    .ap-placeholder { 
                        display: block;
                        background: #f8fafc; 
                        border: 3px dashed #e2e8f0; 
                        padding: 3rem; 
                        border-radius: 2.5rem; 
                        text-align: center; 
                        font-weight: 900; 
                        text-transform: uppercase; 
                        font-size: 11px; 
                        margin: 3rem 0; 
                        letter-spacing: 0.2em;
                        box-shadow: inset 0 4px 6px -1px rgba(0,0,0,0.02);
                        pointer-events: none; /* No editor, as tags são apenas visuais */
                    }
                    .ap-q { border-color: #10b981; color: #059669; background: #f0fdf4; border-style: solid; border-left-width: 15px; }
                    .ap-v { border-color: #ef4444; color: #dc2626; background: #fef2f2; border-style: solid; border-left-width: 15px; }
                    .no-scrollbar::-webkit-scrollbar { display: none; }
                `}</style>
            </div >
        );
    }

    return (
        <div className="flex flex-col gap-8 pb-10 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-[#111418] text-4xl font-black tracking-tighter">Acervo de Apostilas</h2>
                    <p className="text-slate-500 font-medium">Gestão inteligente de conteúdo teórico e interativo.</p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={fetchApostilas}
                        className="p-3 bg-white border border-slate-200 text-slate-400 rounded-xl hover:text-blue-500 transition-all active:scale-95"
                        title="Sincronizar"
                    >
                        <span className="material-symbols-outlined">sync</span>
                    </button>
                    <button
                        onClick={() => handleOpenForm()}
                        className="flex items-center gap-3 px-8 py-4 bg-[#137fec] text-white rounded-[20px] font-black text-xs uppercase tracking-widest shadow-2xl shadow-blue-500/20 hover:bg-blue-600 transition-all active:scale-95"
                    >
                        <span className="material-symbols-outlined">add_circle</span>
                        Criar Nova Obra
                    </button>
                </div>
            </div>

            <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="flex items-center gap-3 bg-slate-50 border border-slate-100 rounded-[20px] px-6 py-3 transition-all">
                        <span className="material-symbols-outlined text-slate-300">search</span>
                        <input
                            type="text"
                            placeholder="Buscar por título ou autor..."
                            value={filterSearch}
                            onChange={e => setFilterSearch(e.target.value)}
                            className="bg-transparent border-none outline-none text-sm font-bold w-full"
                        />
                    </div>
                    <select
                        value={filterDisciplina}
                        onChange={e => setFilterDisciplina(e.target.value)}
                        className="h-14 px-6 bg-slate-50 border border-slate-100 rounded-[20px] text-sm font-bold text-slate-500 outline-none appearance-none"
                    >
                        <option value="">Todas as Categorias</option>
                        {disciplinas.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                    <select
                        value={filterAuthor}
                        onChange={e => setFilterAuthor(e.target.value)}
                        className="h-14 px-6 bg-slate-50 border border-slate-100 rounded-[20px] text-sm font-bold text-slate-500 outline-none appearance-none"
                    >
                        <option value="">Filtrar Responsável</option>
                        <option value={currentUser?.id || ''}>Minha Produção</option>
                        {admins.filter(adm => adm.id !== currentUser?.id).map(adm => <option key={adm.id} value={adm.id}>{adm.full_name}</option>)}
                    </select>
                </div>
            </div>

            <div className="bg-white rounded-[40px] border border-slate-200 shadow-xl shadow-slate-200/20 overflow-hidden">
                <div className="overflow-x-auto overflow-y-hidden">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-slate-50/50 border-b border-slate-100 text-[#64748b] text-[10px] font-black uppercase tracking-[0.2em]">
                                <th className="px-10 py-6">Conteúdo / Metadata</th>
                                <th className="px-10 py-6">Curadoria</th>
                                <th className="px-10 py-6 text-center">Exibição</th>
                                <th className="px-10 py-6 text-right">Controle Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50 font-medium">
                            {Object.entries(grouped).map(([discName, items]) => (
                                <React.Fragment key={discName}>
                                    <tr className="bg-slate-50/20">
                                        <td colSpan={4} className="px-10 py-3 border-b border-slate-100/50">
                                            <div className="flex items-center gap-3">
                                                <div className="w-1.5 h-1.5 rounded-full bg-blue-500 ring-4 ring-blue-50"></div>
                                                <span className="text-[10px] font-black text-slate-900 uppercase tracking-widest">{discName}</span>
                                                <span className="px-2.5 py-0.5 bg-blue-50 text-[9px] font-black text-blue-600 rounded-lg">{items.length} unidades</span>
                                            </div>
                                        </td>
                                    </tr>
                                    {items.map(a => {
                                        const perms = getPermissions(a);
                                        return (
                                            <tr key={a.id} className="hover:bg-blue-50/20 transition-all group">
                                                <td className="px-10 py-8">
                                                    <div className="flex flex-col gap-1">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-base font-black text-[#111418] group-hover:text-[#137fec] transition-colors">{a.title}</span>
                                                        </div>
                                                        <span className="text-xs text-slate-400 font-bold max-w-sm border-l-2 border-slate-100 pl-3 ml-1">{a.description || 'Sem descrição cadastrada.'}</span>
                                                    </div>
                                                </td>
                                                <td className="px-10 py-8">
                                                    <div className="flex items-center gap-3">
                                                        <div className="size-8 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400">
                                                            <span className="material-symbols-outlined text-sm">person</span>
                                                        </div>
                                                        <div className="flex flex-col">
                                                            <span className="text-[11px] font-black text-slate-900">{a.author?.full_name || 'Equipe BPA'}</span>
                                                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Publicado em: {new Date(a.created_at).toLocaleDateString()}</span>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-10 py-8 text-center">
                                                    <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border ${a.status === 'Ativo' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-slate-50 text-slate-400 border-slate-100'}`}>
                                                        {a.status === 'Ativo' ? 'Publicado' : 'Rascunho'}
                                                    </span>
                                                </td>
                                                <td className="px-10 py-8">
                                                    <div className="flex items-center justify-end gap-2 translate-x-2 group-hover:translate-x-0 transition-transform">
                                                        <button
                                                            onClick={() => handlePreview(a.id)}
                                                            className="size-10 flex items-center justify-center text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 rounded-xl transition-all"
                                                            title="Ver como Aluno"
                                                        >
                                                            <span className="material-symbols-outlined text-[20px]">visibility</span>
                                                        </button>
                                                        {perms.canDuplicate && (
                                                            <button
                                                                onClick={() => handleDuplicate(a)}
                                                                className="size-10 flex items-center justify-center text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded-xl transition-all"
                                                                title="Duplicar"
                                                            >
                                                                <span className="material-symbols-outlined text-[20px]">content_copy</span>
                                                            </button>
                                                        )}
                                                        {perms.canEdit && (
                                                            <button
                                                                onClick={() => handleOpenForm(a)}
                                                                className="size-10 flex items-center justify-center text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all font-black"
                                                                title="Editar"
                                                            >
                                                                <span className="material-symbols-outlined text-[20px]">edit_note</span>
                                                            </button>
                                                        )}
                                                        {perms.canDelete && (
                                                            <button
                                                                onClick={() => handleDelete(a.id)}
                                                                className="size-10 flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                                                                title="Excluir Permanentemente"
                                                            >
                                                                <span className="material-symbols-outlined text-[20px]">delete_sweep</span>
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </React.Fragment>
                            ))}
                            {Object.keys(grouped).length === 0 && (
                                <tr>
                                    <td colSpan={4} className="px-10 py-32 text-center">
                                        <div className="flex flex-col items-center gap-4 text-slate-300">
                                            <span className="material-symbols-outlined text-6xl">library_books</span>
                                            <p className="font-bold text-sm italic">Nenhuma obra literária no acervo atual.</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
                {/* Pagination Controls */}
                {totalCount > ITEMS_PER_PAGE && (
                    <div className="flex items-center justify-between px-10 py-6 bg-slate-50 border-t border-slate-100">
                        <div className="text-[11px] font-black text-slate-400 uppercase tracking-widest">
                            Exibindo {apostilas.length} de {totalCount} obras
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                disabled={currentPage === 1}
                                onClick={() => setCurrentPage(prev => prev - 1)}
                                className="size-10 flex items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-400 hover:text-blue-600 disabled:opacity-30 disabled:hover:text-slate-400 transition-all font-black"
                            >
                                <span className="material-symbols-outlined">chevron_left</span>
                            </button>
                            <div className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-[11px] font-black text-slate-900 uppercase tracking-widest">
                                Página {currentPage} de {Math.ceil(totalCount / ITEMS_PER_PAGE)}
                            </div>
                            <button
                                disabled={currentPage * ITEMS_PER_PAGE >= totalCount}
                                onClick={() => setCurrentPage(prev => prev + 1)}
                                className="size-10 flex items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-400 hover:text-blue-600 disabled:opacity-30 disabled:hover:text-slate-400 transition-all font-black"
                            >
                                <span className="material-symbols-outlined">chevron_right</span>
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ApostilasAdmin;
