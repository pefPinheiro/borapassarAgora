
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
import { Apostila, Disciplina, Assunto, Profile, Teacher } from '../types';
import TiptapEditor, { TiptapRef } from './TiptapEditor';

interface Banca {
    id: string;
    name: string;
}

const ApostilasAdmin: React.FC = () => {
    const [view, setView] = useState<'list' | 'form' | 'validator'>('list');
    const [auditingApostila, setAuditingApostila] = useState<Apostila | null>(null);
    const [isExtractingChapters, setIsExtractingChapters] = useState(false);
    const [isAnalyzingChapter, setIsAnalyzingChapter] = useState(false);
    const [analysisResults, setAnalysisResults] = useState<any[]>([]);
    const [analysisProgress, setAnalysisProgress] = useState(0);
    const [analysisError, setAnalysisError] = useState<string | null>(null);
    const [selectedChapter, setSelectedChapter] = useState<string | null>(null);
    const [apostilas, setApostilas] = useState<Apostila[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentUser, setCurrentUser] = useState<Profile | null>(null);
    const [activeActionMenuId, setActiveActionMenuId] = useState<string | null>(null);

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

    // Validation State
    const [isValidationModalOpen, setIsValidationModalOpen] = useState(false);
    const [validatingApostila, setValidatingApostila] = useState<Apostila | null>(null);
    const [isSavingValidation, setIsSavingValidation] = useState(false);

    // Auxiliary Data
    const [bancas, setBancas] = useState<Banca[]>([]);
    const [disciplinas, setDisciplinas] = useState<Disciplina[]>([]);
    const [assuntos, setAssuntos] = useState<Assunto[]>([]);
    const [subassuntos, setSubassuntos] = useState<any[]>([]);
    const [subsubassuntos, setSubsubassuntos] = useState<any[]>([]);
    const [admins, setAdmins] = useState<Profile[]>([]);
    const [teachers, setTeachers] = useState<Teacher[]>([]);

    // Filters
    const [filterSearch, setFilterSearch] = useState('');
    const [filterDisciplina, setFilterDisciplina] = useState('');
    const [filterAuthor, setFilterAuthor] = useState('');
    const [filterProfessor, setFilterProfessor] = useState('');
    const [currentTeacher, setCurrentTeacher] = useState<Teacher | null>(null);
    const [filterSortOrder, setFilterSortOrder] = useState<'asc' | 'desc'>('asc');

    // Observation State
    const [isObservationModalOpen, setIsObservationModalOpen] = useState(false);
    const [observingApostila, setObservingApostila] = useState<Apostila | null>(null);
    const [observationText, setObservationText] = useState('');
    const [isSavingObservation, setIsSavingObservation] = useState(false);

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const [totalCount, setTotalCount] = useState(0);
    const ITEMS_PER_PAGE = 10;

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
            ano: '',
            subassuntos_ids: [],
            subsubassuntos_ids: []
        } as any,
        commission_valid_until: '',
        professor_id: null,
        is_resolution_notebook: false,
        is_resumo_8020: false,
        is_audited: false
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
                if (profile) {
                    setCurrentUser(profile);
                    // Se for professor, buscar registro do professor
                    if (profile.role === 'teacher') {
                        const { data: teacher } = await supabase.from('teachers').select('*').eq('linked_profile_id', profile.id).single();
                        if (teacher) setCurrentTeacher(teacher);
                    }
                }
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
    }, [currentPage, filterSearch, filterDisciplina, filterAuthor, filterProfessor, filterSortOrder]);

    // Reset to page 1 when filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [filterSearch, filterDisciplina, filterAuthor, filterProfessor, filterSortOrder]);

    const fetchApostilas = async () => {
        setLoading(true);
        try {
            let query = supabase
                .from('apostilas')
                .select(`
                    *,
                    author:profiles!author_id (full_name),
                    assigned_editor:profiles!assigned_editor_id (full_name),
                    disciplinas (name),
                    teacher:teachers(*)
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
            if (filterProfessor) {
                query = query.eq('professor_id', filterProfessor);
            }

            const from = (currentPage - 1) * ITEMS_PER_PAGE;
            const to = from + ITEMS_PER_PAGE - 1;

            const { data, error, count } = await query
                .order('created_at', { ascending: filterSortOrder === 'asc' })
                .range(from, to);

            if (error) throw error;

            if (currentPage === 1) {
                setApostilas(data || []);
            } else {
                setApostilas(prev => {
                    const newItems = data || [];
                    const combined = [...prev, ...newItems];
                    const unique = Array.from(new Map(combined.map(item => [item.id, item])).values());
                    return unique;
                });
            }
            setTotalCount(count || 0);
        } catch (error: any) {
            console.error('Error fetching apostilas:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchAuxData = async () => {
        try {
            const [bRes, dRes, aRes, subRes, subsubRes, admRes, tRes] = await Promise.all([
                supabase.from('bancas').select('id, name').order('name'),
                supabase.from('disciplinas').select('*').order('name'),
                supabase.from('assuntos').select('*').order('name'),
                supabase.from('subassuntos').select('id, name, assunto_id').order('name'),
                supabase.from('subsubassuntos').select('id, name, subassunto_id').order('name'),
                supabase.from('profiles').select('*').in('role', ['admin', 'super']).order('full_name'),
                supabase.from('teachers').select('*').order('name'),
            ]);
            if (bRes.data) setBancas(bRes.data);
            if (dRes.data) setDisciplinas(dRes.data);
            if (aRes.data) setAssuntos(aRes.data);
            if (subRes.data) setSubassuntos(subRes.data);
            if (subsubRes.data) setSubsubassuntos(subsubRes.data);
            if (admRes.data) setAdmins(admRes.data);
            if (tRes.data) setTeachers(tRes.data);

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
            const perms = getPermissions(apostila);
            if (!perms.canEdit) {
                alert('Você não tem permissão para editar esta apostila.');
                return;
            }
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
                    ano: '',
                    subassuntos_ids: apostila.filters?.subassuntos_ids || [],
                    subsubassuntos_ids: apostila.filters?.subsubassuntos_ids || []
                },
                commission_valid_until: apostila.commission_valid_until || '',
                professor_id: apostila.professor_id || null,
                is_resolution_notebook: apostila.is_resolution_notebook || false,
                is_resumo_8020: apostila.is_resumo_8020 || false,
                is_audited: apostila.is_audited || false
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
                    ano: '',
                    subassuntos_ids: [],
                    subsubassuntos_ids: []
                },
                commission_valid_until: '',
                professor_id: (currentUser?.role === 'teacher' && currentTeacher) ? currentTeacher.id : null,
                is_resolution_notebook: false,
                is_resumo_8020: false,
                is_audited: false
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
            delete (apPayload as any).teacher;

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
                const { id, created_at, updated_at, author, assigned_editor, disciplinas, teacher, ...rest } = apostila;
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
        if (!formData.disciplina_id) {
            alert('Para manter a organização dos arquivos, por favor selecione a Disciplina antes de fazer o upload de imagens.');
            return;
        }

        setUploading(true);
        try {
            const discObj = disciplinas.find(d => d.id === formData.disciplina_id);
            const subObj = assuntos.find(a => a.id === formData.assunto_id);

            const discName = discObj?.name || 'sem_disciplina';
            const subName = subObj?.name || 'sem_assunto';

            const sanitize = (str: string) => {
                return str
                    .normalize('NFD')
                    .replace(/[\u0300-\u036f]/g, "")
                    .toLowerCase()
                    .replace(/[^a-z0-9]/g, "_")
                    .replace(/_+/g, "_");
            };

            const safeDisc = sanitize(discName);
            const safeSub = sanitize(subName);

            const fileExt = file.name.split('.').pop();
            const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
            const filePath = `apostilas/${safeDisc}/${safeSub}/${fileName}`;

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

    const insertTag = (tagType: 'question' | 'quest_json' | 'video' | 'image' | 'math' | 'exemplo' | 'lei' | 'correcao' | 'resolve' | 'template_8020') => {
        if (tagType === 'template_8020') {
            editorRef.current?.insertContent(`
                <h1>[TÍTULO DO RESUMO 80/20]</h1>
                <p>Este resumo foca nos 20% do conteúdo que garantem 80% do seu resultado.</p>
                
                <h2>[1] O Coração do Assunto (O que mais cai)</h2>
                <p>Descreva aqui a base teórica essencial que é cobrada em quase todas as provas.</p>
                <p>[--IMPORTANTE--] Foque nestes termos-chave: [Termo 1], [Termo 2], [Termo 3]. [/--IMPORTANTE--]</p>

                <h2>[2] Jurisprudência e Lei Seca</h2>
                <p>[--LEI--] Texto da lei ou julgado fundamental aqui... [/--LEI--]</p>

                <h2>[3] Resumo Esquematizado</h2>
                <table>
                    <thead>
                        <tr><th>Conceito</th><th>Aplicação Prática</th></tr>
                    </thead>
                    <tbody>
                        <tr><td>A</td><td>B</td></tr>
                        <tr><td>C</td><td>D</td></tr>
                    </tbody>
                </table>

                <h2>[4] Bora Praticar</h2>
                <p>[--BORA-PRATICAR--] Agora que revisamos a teoria, vamos fixar com questões. [/--BORA-PRATICAR--]</p>
                <div class="ap-placeholder ap-q">[quest_id:"ESCOLHA_UMA_QUESTÃO"]</div>
            `);
            setFormData(prev => ({ ...prev, is_resumo_8020: true }));
            return;
        }

        if (tagType === 'resolve') {
            const num = window.prompt("Número da Questão:", "01");
            if (num === null) return;
            editorRef.current?.insertContent(`
                <p>[--RESOLVE: ${num}--]</p>
                <p>Enunciado da questão aqui...</p>
                <p>[--SOLUCAO--]</p>
                <p>Resolução detalhada aqui...</p>
                <p>[/--SOLUCAO--]</p>
                <p>[/--RESOLVE--]</p>
            `);
            return;
        }

        if (tagType === 'quest_json') {
            const template = `
<p>[--QUESTAO-JSON--]</p>
<pre>
{
  "enunciado": "Digite o enunciado da questão externa aqui...",
  "alternativas": [
    { "id": "1", "texto": "Opção A", "isCorreta": true },
    { "id": "2", "texto": "Opção B", "isCorreta": false },
    { "id": "3", "texto": "Opção C", "isCorreta": false },
    { "id": "4", "texto": "Opção D", "isCorreta": false }
  ],
  "resposta_professor": "Explicação do professor aqui (opcional)",
  "ano": 2024,
  "bancas": { "name": "Banca Externa" },
  "disciplinas": { "name": "Disciplina" }
}
</pre>
<p>[/--QUESTAO-JSON--]</p>
<p><br/></p>`;
            editorRef.current?.insertContent(template);
            return;
        }

        if (tagType === 'question') {
            setIsQuestionModalOpen(true);
            return;
        }

        if (tagType === 'image') {
            imageInputRef.current?.click();
            return;
        }

        if (tagType === 'exemplo') {
            editorRef.current?.insertContent('<p>[--EXEMPLO--] Exemplo prático... [/--EXEMPLO--]</p>');
            return;
        }

        if (tagType === 'lei') {
            editorRef.current?.insertContent('<p>[--LEI--] Texto da lei... [/--LEI--]</p>');
            return;
        }

        if (tagType === 'correcao') {
            editorRef.current?.insertContent('<p>[--CORRECAO--] Observação para correção... [/--CORRECAO--]</p>');
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

    const handleOpenValidationModal = (apostila: Apostila) => {
        const perms = getPermissions(apostila);
        if (!perms.canValidate) {
            alert('Você não tem permissão para validar esta apostila.');
            return;
        }
        setValidatingApostila(apostila);
        setIsValidationModalOpen(true);
    };

    const getPermissions = (a: Apostila) => {
        if (!currentUser) return { canDelete: false, canEdit: false, canDuplicate: false, canValidate: false };
        const isSuper = currentUser.role === 'super' || currentUser.role === 'admin';
        
        // Professor permission
        const isTeacherRole = currentUser.role === 'teacher';
        const isProfessorLinked = currentTeacher && a.professor_id && a.professor_id === currentTeacher.id;

        // Strict rule for professors: only associated workbooks
        if (isTeacherRole) {
            // Se o professor for o professor_id associado, ele pode editar e validar.
            // Caso contrário, APENAS visualizar.
            return {
                canDelete: false,
                canEdit: !!isProfessorLinked,
                canDuplicate: false,
                canValidate: !!isProfessorLinked
            };
        }

        const isAuthor = a.author_id === currentUser.id;
        const isEditor = a.assigned_editor_id === currentUser.id;

        return {
            canDelete: isSuper,
            canEdit: isSuper || isAuthor || isEditor,
            canDuplicate: isSuper || isAuthor || isEditor,
            canValidate: isSuper || !!isProfessorLinked
        };
    };

    const handleToggleValidation = async (field: keyof NonNullable<Apostila['validation']>) => {
        if (!validatingApostila) return;

        const currentValidation = validatingApostila.validation || {
            structure: false,
            images: false,
            notebooks: false,
            questions: false
        };

        const newValidation = {
            ...currentValidation,
            [field]: !currentValidation[field]
        };

        setIsSavingValidation(true);
        try {
            const { error } = await supabase
                .from('apostilas')
                .update({ validation: newValidation })
                .eq('id', validatingApostila.id);

            if (error) throw error;

            // Update local state
            setValidatingApostila({ ...validatingApostila, validation: newValidation });
            setApostilas(prev => prev.map(a => a.id === validatingApostila.id ? { ...a, validation: newValidation } : a));
        } catch (e: any) {
            console.error(e);
            alert('Erro ao atualizar validação: ' + e.message);
        } finally {
            setIsSavingValidation(false);
        }
    };

    const [isChapterModalOpen, setIsChapterModalOpen] = useState(false);

    const handleExtractChapters = async () => {
        if (!auditingApostila) return;
        
        setIsExtractingChapters(true);
        setAnalysisResults([]);
        setSelectedChapter(null);
        setAnalysisProgress(5);
        setAnalysisError(null);

        const timer = setInterval(() => {
            setAnalysisProgress(prev => {
                if (prev >= 90) return prev;
                return prev + Math.floor(Math.random() * 5);
            });
        }, 1500);

        try {
            const cleanContent = (auditingApostila.content?.replace(/<[^>]*>?/gm, ' ') || '').substring(0, 40000);

            const { data, error } = await supabase.functions.invoke('audit-content', {
                body: { 
                    action: 'list_chapters',
                    content: cleanContent, 
                    title: auditingApostila.title 
                }
            });

            if (error) throw error;
            if (data && data.error) throw new Error(data.message || 'Erro na API do Google.');
            
            if (data && Array.isArray(data)) {
                setAnalysisProgress(100);
                const mapped = data.map(cap => ({
                    capitulo: cap,
                    status: 'pending',
                    alertas: []
                }));
                setAnalysisResults(mapped);
                setTimeout(() => {
                    setIsChapterModalOpen(true); // Abre o popup com os capítulos gerados pela IA
                    setAnalysisProgress(0);
                }, 500);
            } else {
                throw new Error('A IA retornou um formato inesperado.');
            }

        } catch (e: any) {
            console.error('Erro na extração de capítulos pela IA:', e);
            let detailedMessage = e.message;
            if (e.name === 'FunctionsHttpError' && e.context) {
                try {
                    const errData = await e.context.json();
                    if (errData && errData.message) detailedMessage = errData.message;
                } catch (_) {}
            }
            setAnalysisError(detailedMessage || 'Erro ao mapear apostila.');
        } finally {
            setIsExtractingChapters(false);
            // @ts-ignore
            clearInterval(timer);
        }
    };

    const handleAnalyzeChapter = async (chapterName: string) => {
        if (!auditingApostila) return;

        setIsAnalyzingChapter(true);
        setIsChapterModalOpen(false); // Fecha o popup para ver o relatório
        setSelectedChapter(chapterName);
        setAnalysisProgress(5);
        setAnalysisError(null);
        
        setAnalysisResults(prev => prev.map(c => c.capitulo === chapterName ? { ...c, status: 'analyzing' } : c));

        const timer = setInterval(() => {
            setAnalysisProgress(prev => {
                if (prev >= 95) return prev;
                return prev + Math.floor(Math.random() * 3);
            });
        }, 1000);

        try {
            const cleanContent = (auditingApostila.content?.replace(/<[^>]*>?/gm, ' ') || '').substring(0, 40000);

            const { data, error } = await supabase.functions.invoke('audit-content', {
                body: { 
                    action: 'analyze_chapter',
                    chapter: chapterName,
                    content: cleanContent, 
                    title: auditingApostila.title 
                }
            });

            if (error) throw error;
            if (data && data.error) throw new Error(data.message || 'Erro na API do Google.');
            
            if (data && Array.isArray(data)) {
                setAnalysisProgress(100);
                // Se o array for vazio, significa que não há erros (validado com sucesso)
                setAnalysisResults(prev => prev.map(c => 
                    c.capitulo === chapterName ? { 
                        ...c, 
                        status: 'validated', 
                        alertas: data 
                    } : c
                ));
                setTimeout(() => setAnalysisProgress(0), 1000);
            } else {
                throw new Error('Formato inesperado retornado.');
            }

        } catch (e: any) {
            console.error('Erro na análise de capítulo:', e);
            let detailedMessage = e.message;
            if (e.name === 'FunctionsHttpError' && e.context) {
                try {
                    const errData = await e.context.json();
                    if (errData && errData.message) detailedMessage = errData.message;
                } catch (_) {}
            }
            setAnalysisResults(prev => prev.map(c => c.capitulo === chapterName ? { ...c, status: 'error' } : c));
            setAnalysisError(detailedMessage || 'Erro na análise de fatos.');
        } finally {
            setIsAnalyzingChapter(false);
            // @ts-ignore
            clearInterval(timer);
        }
    };

    const handleSetProfessor = async (professorId: string | null) => {
        if (!validatingApostila) return;
        await updateApostilaProfessor(validatingApostila.id, professorId);
    };

    const updateApostilaProfessor = async (apostilaId: string, professorId: string | null) => {
        try {
            const { error } = await supabase
                .from('apostilas')
                .update({ professor_id: professorId })
                .eq('id', apostilaId);

            if (error) throw error;

            // Update local state
            const updatedTeacher = teachers.find(t => t.id === professorId) || undefined;
            
            setApostilas(prev => prev.map(a => 
                a.id === apostilaId 
                ? { ...a, professor_id: professorId || undefined, teacher: updatedTeacher } 
                : a
            ));

            if (validatingApostila?.id === apostilaId) {
                setValidatingApostila({ 
                    ...validatingApostila, 
                    professor_id: professorId || undefined, 
                    teacher: updatedTeacher 
                });
            }
        } catch (error: any) {
            console.error('Error saving professor:', error);
            alert('Erro ao salvar professor: ' + error.message);
        }
    };

    const handleToggleAudit = async (apostila: Apostila) => {
        const newValue = !apostila.is_audited;
        try {
            const { error } = await supabase
                .from('apostilas')
                .update({ is_audited: newValue })
                .eq('id', apostila.id);

            if (error) throw error;

            setApostilas(prev => prev.map(a => 
                a.id === apostila.id 
                ? { ...a, is_audited: newValue } 
                : a
            ));
        } catch (error: any) {
            console.error('Error toggling audit:', error);
            alert('Erro ao atualizar auditoria: ' + error.message);
        }
    };

    const getValidationProgress = (validation?: any) => {
        if (!validation || typeof validation !== 'object') return 0;
        const items = [
            validation.structure === true,
            validation.images === true,
            validation.notebooks === true,
            validation.questions === true
        ];
        // professional_validation é um bônus/selo final, não conta no progresso base de 0-100% 
        // ou conta como 5º item? Vamos colocar como informativo.
        const checked = items.filter(v => v).length;
        return Math.round((checked / items.length) * 100);
    };

    const handleOpenObservationModal = (apostila: Apostila) => {
        setObservingApostila(apostila);
        setObservationText(apostila.observations || '');
        setIsObservationModalOpen(true);
    };

    const handleSaveObservation = async () => {
        if (!observingApostila) return;
        setIsSavingObservation(true);
        try {
            const { error } = await supabase
                .from('apostilas')
                .update({ observations: observationText })
                .eq('id', observingApostila.id);
            
            if (error) throw error;
            
            // Local update
            setApostilas(prev => prev.map(a => a.id === observingApostila.id ? { ...a, observations: observationText } : a));
            setIsObservationModalOpen(false);
            alert('Observação salva com sucesso!');
        } catch (e: any) {
            alert('Erro ao salvar observação: ' + e.message);
        } finally {
            setIsSavingObservation(false);
        }
    };

    const handleExportTxt = (apostila: Apostila) => {
        try {
            let content = apostila.content || '';

            // 1. Remover blocos de questões e códigos (PRE e CODE)
            content = content.replace(/<pre[^>]*>[\s\S]*?<\/pre>/gi, '');
            content = content.replace(/<code[^>]*>[\s\S]*?<\/code>/gi, '');
            content = content.replace(/\[--QUESTAO-JSON--\][\s\S]*?\[\/--QUESTAO-JSON--\]/gi, '');
            content = content.replace(/\[--RESOLVE:[\s\S]*?\[\/--RESOLVE--\]/gi, '');
            content = content.replace(/\[quest_id:[\s\S]*?\]/gi, '');

            // 2. Estruturar Capítulos e Seções (Linguagem Natural)
            content = content.replace(/<h1>(.*?)<\/h1>/gi, '\nCapítulo: $1\n');
            content = content.replace(/<h2>(.*?)<\/h2>/gi, '\nSeção: $1\n');
            content = content.replace(/<h3>(.*?)<\/h3>/gi, '\n$1\n');

            // 3. Remover TODAS as TAGS de marcação ([--NOME_TAG--])
            content = content.replace(/\[\/?--[\s\S]*?--\]/g, '');

            // 4. Converter HTML restante para texto limpo
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = content;
            let cleanText = tempDiv.innerText || tempDiv.textContent || '';
            
            // 5. Limpeza final de espaçamentos
            cleanText = cleanText.replace(/\n\s*\n\s*\n/g, '\n\n'); 

            const fileContent = `==================================================\n` +
                               `VALIDAÇÃO DE CONTEÚDO: ${apostila.title.toUpperCase()}\n` +
                               `DISCIPLINA: ${apostila.disciplinas?.name || 'GERAL'}\n` +
                               `==================================================\n\n` +
                               `${cleanText.trim()}`;
            
            const blob = new Blob([fileContent], { type: 'text/plain;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            
            const safeTitle = apostila.title
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .replace(/[^a-zA-Z0-9]/g, '_')
                .toLowerCase();
            
            link.href = url;
            link.download = `validacao_${safeTitle}.txt`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Error exporting TXT:', error);
            alert('Erro ao gerar o arquivo de validação.');
        }
    };

    // Filter Logic - (unchanged code skipped for brevity)
    // ...

    // ... (rendering code)
    <div className="tiptap-premium-wrapper">
        <TiptapEditor
            ref={editorRef}
            content={formData.content || ''}
            onChange={(val) => setFormData({ ...formData, content: val })}
            uploadPath={(() => {
                const s = (str: string) => str.normalize('NFD').replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "_").replace(/_+/g, "_");
                if (!formData.disciplina_id) return '';
                const d = disciplinas.find(x => x.id === formData.disciplina_id);
                const a = assuntos.find(x => x.id === formData.assunto_id);
                return `apostilas/${s(d?.name || 'sem_disciplina')}/${s(a?.name || 'sem_assunto')}`;
            })()}
        />
    </div>

    // Filter Logic - Now handled server-side for performance
    const filteredApostilas = apostilas;


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
                        {editingApostila && (
                            <button 
                                onClick={() => handleExportTxt(editingApostila)} 
                                className="px-6 py-3 bg-slate-100 border border-slate-200 rounded-2xl font-black text-[10px] uppercase tracking-widest text-slate-500 hover:text-slate-700 transition-all flex items-center gap-2"
                            >
                                <span className="material-symbols-outlined text-sm">download</span>
                                Gerar TXT
                            </button>
                        )}
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
                                                <button onClick={() => insertTag('quest_json')} className="flex items-center gap-2 px-4 py-2.5 bg-violet-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-violet-700 transition-all shadow-lg shadow-violet-500/20 active:scale-95">
                                                    <span className="material-symbols-outlined text-[18px]">terminal</span>
                                                    <span className="hidden md:inline">Questão JSON</span>
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

                                                <div className="h-6 w-px bg-slate-200 mx-2"></div>

                                                <button onClick={() => insertTag('exemplo')} className="flex items-center gap-2 px-4 py-2.5 bg-lime-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-lime-600 transition-all shadow-lg shadow-lime-500/20 active:scale-95">
                                                    <span className="material-symbols-outlined text-[18px]">lightbulb</span>
                                                    <span className="hidden md:inline">Exemplo</span>
                                                </button>
                                                <button onClick={() => insertTag('lei')} className="flex items-center gap-2 px-4 py-2.5 bg-amber-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-amber-600 transition-all shadow-lg shadow-amber-500/20 active:scale-95">
                                                    <span className="material-symbols-outlined text-[18px]">gavel</span>
                                                    <span className="hidden md:inline">Lei</span>
                                                </button>
                                                <button onClick={() => insertTag('correcao')} className="flex items-center gap-2 px-4 py-2.5 bg-rose-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-700 transition-all shadow-lg shadow-rose-500/20 active:scale-95">
                                                    <span className="material-symbols-outlined text-[18px]">edit_note</span>
                                                    <span className="hidden md:inline">Correção</span>
                                                </button>
                                                <button onClick={() => insertTag('resolve')} className="flex items-center gap-2 px-4 py-2.5 bg-cyan-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-cyan-700 transition-all shadow-lg shadow-cyan-500/20 active:scale-95">
                                                    <span className="material-symbols-outlined text-[18px]">check_circle</span>
                                                    <span className="hidden md:inline">Resolvida</span>
                                                </button>
                                                <button onClick={() => insertTag('template_8020')} className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-500/20 active:scale-95 animate-bounce-subtle">
                                                    <span className="material-symbols-outlined text-[18px]">bolt</span>
                                                    <span className="hidden md:inline">Template 80/20</span>
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
                                    uploadPath={(() => {
                                        const disc = disciplinas.find(d => String(d.id) === String(formData.disciplina_id));
                                        const sub = assuntos.find(a => String(a.id) === String(formData.assunto_id));
                                        const sanitize = (str: string) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/gi, "_").toLowerCase();

                                        if (disc) {
                                            const discPath = sanitize(disc.name);
                                            const subPath = sub ? sanitize(sub.name) : 'geral';
                                            return `apostilas/${discPath}/${subPath}`;
                                        }
                                        return editingApostila ? `apostilas/${editingApostila.id}` : 'apostilas/sem_disciplina';
                                    })()}
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
                                        onChange={e => setFormData({ ...formData, assunto_id: e.target.value || null, filters: { ...formData.filters, subassuntos_ids: [], subsubassuntos_ids: [] } })}
                                        className="w-full h-14 px-6 bg-white/5 border border-white/10 rounded-2xl outline-none font-black text-xs text-white disabled:opacity-20 transition-all"
                                    >
                                        <option value="" className="text-slate-900">Selecione o tópico...</option>
                                        {assuntos.filter(a => a.disciplina_id === formData.disciplina_id).map(a => <option key={a.id} value={a.id} className="text-slate-900">{a.name}</option>)}
                                    </select>
                                </div>

                                 {formData.assunto_id && subassuntos.filter(s => s.assunto_id === formData.assunto_id).length > 0 && (
                                    <div className="space-y-3 p-5 bg-white/5 border border-white/10 rounded-3xl max-h-64 overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Árvore de Subtópicos</label>
                                        <div className="space-y-3">
                                            {subassuntos.filter(s => s.assunto_id === formData.assunto_id).map(sub => {
                                                const subsubList = subsubassuntos.filter(ss => ss.subassunto_id === sub.id);
                                                const isSubSelected = formData.filters?.subassuntos_ids?.includes(sub.id);
                                                
                                                return (
                                                    <div key={sub.id} className="space-y-2">
                                                        <label className="flex items-center gap-3 cursor-pointer group">
                                                            <div className="relative flex items-center justify-center">
                                                                <input 
                                                                    type="checkbox" 
                                                                    className="peer appearance-none size-5 rounded-md bg-white/10 border-2 border-white/20 checked:bg-blue-500 checked:border-blue-500 transition-all cursor-pointer"
                                                                    checked={isSubSelected}
                                                                    onChange={(e) => {
                                                                        const checked = e.target.checked;
                                                                        let newSubIds = [...(formData.filters?.subassuntos_ids || [])];
                                                                        let newSubsubIds = [...(formData.filters?.subsubassuntos_ids || [])];
                                                                        
                                                                        if (checked) {
                                                                            newSubIds.push(sub.id);
                                                                            subsubList.forEach(ss => {
                                                                                if (!newSubsubIds.includes(ss.id)) newSubsubIds.push(ss.id);
                                                                            });
                                                                        } else {
                                                                            newSubIds = newSubIds.filter(id => id !== sub.id);
                                                                            const idsToRemove = subsubList.map(ss => ss.id);
                                                                            newSubsubIds = newSubsubIds.filter(id => !idsToRemove.includes(id));
                                                                        }
                                                                        
                                                                        setFormData({
                                                                            ...formData,
                                                                            filters: {
                                                                                ...formData.filters,
                                                                                subassuntos_ids: newSubIds,
                                                                                subsubassuntos_ids: newSubsubIds
                                                                            }
                                                                        });
                                                                    }}
                                                                />
                                                                <span className="material-symbols-outlined text-[14px] text-white absolute inset-0 m-auto pointer-events-none opacity-0 peer-checked:opacity-100 transition-opacity">check</span>
                                                            </div>
                                                            <span className="text-xs font-bold text-slate-300 group-hover:text-white transition-colors">{sub.name}</span>
                                                        </label>
                                                        
                                                        {subsubList.length > 0 && (
                                                            <div className="pl-8 space-y-2 border-l border-white/10 ml-[9px]">
                                                                {subsubList.map(ss => {
                                                                    const isSsSelected = formData.filters?.subsubassuntos_ids?.includes(ss.id);
                                                                    return (
                                                                        <label key={ss.id} className="flex items-center gap-3 cursor-pointer group">
                                                                            <div className="relative flex items-center justify-center">
                                                                                <input 
                                                                                    type="checkbox" 
                                                                                    className="peer appearance-none size-4 rounded bg-white/5 border border-white/20 checked:bg-indigo-500 checked:border-indigo-500 transition-all cursor-pointer"
                                                                                    checked={isSsSelected}
                                                                                    onChange={(e) => {
                                                                                        const checked = e.target.checked;
                                                                                        let newSubsubIds = [...(formData.filters?.subsubassuntos_ids || [])];
                                                                                        let newSubIds = [...(formData.filters?.subassuntos_ids || [])];
                                                                                        
                                                                                        if (checked) {
                                                                                            newSubsubIds.push(ss.id);
                                                                                            if (!newSubIds.includes(sub.id)) newSubIds.push(sub.id);
                                                                                        } else {
                                                                                            newSubsubIds = newSubsubIds.filter(id => id !== ss.id);
                                                                                        }
                                                                                        
                                                                                        setFormData({
                                                                                            ...formData,
                                                                                            filters: {
                                                                                                ...formData.filters,
                                                                                                subassuntos_ids: newSubIds,
                                                                                                subsubassuntos_ids: newSubsubIds
                                                                                            }
                                                                                        });
                                                                                    }}
                                                                                />
                                                                                <span className="material-symbols-outlined text-[12px] text-white absolute inset-0 m-auto pointer-events-none opacity-0 peer-checked:opacity-100 transition-opacity">check</span>
                                                                            </div>
                                                                            <span className="text-[10px] font-medium text-slate-400 group-hover:text-indigo-300 transition-colors">{ss.name}</span>
                                                                        </label>
                                                                    );
                                                                })}
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                <div className="space-y-3">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-1">Professor Associado</label>
                                    <select
                                        value={formData.professor_id || ''}
                                        onChange={e => setFormData({ ...formData, professor_id: e.target.value || null })}
                                        disabled={currentUser?.role !== 'super'}
                                        className="w-full h-14 px-6 bg-white/5 border border-white/10 rounded-2xl outline-none font-black text-xs text-white focus:border-blue-500/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <option value="" className="text-slate-900">Selecione um professor...</option>
                                        {teachers.map(t => <option key={t.id} value={t.id} className="text-slate-900">{t.name}</option>)}
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
                                            <span className="material-symbols-outlined text-purple-500">book_4</span>
                                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Tipo de Apostila</label>
                                        </div>
                                        <label className="flex items-center gap-3 p-4 bg-white/5 border border-white/10 rounded-2xl cursor-pointer group hover:border-purple-500/50 transition-all">
                                            <div className="relative">
                                                <input 
                                                    type="checkbox" 
                                                    className="peer appearance-none w-10 h-6 bg-slate-700 rounded-full checked:bg-purple-600 transition-all cursor-pointer"
                                                    checked={formData.is_resolution_notebook || false}
                                                    onChange={(e) => setFormData({ ...formData, is_resolution_notebook: e.target.checked })}
                                                />
                                                <div className="absolute top-1 left-1 size-4 bg-white rounded-full peer-checked:translate-x-4 transition-transform pointer-events-none shadow-sm"></div>
                                            </div>
                                            <div>
                                                <span className="block text-xs font-black text-white group-hover:text-purple-400 transition-colors uppercase tracking-widest">Caderno de Resolução</span>
                                                <span className="text-[9px] text-slate-500">Agrupa em uma aba separada de resolvidas pelo professor</span>
                                            </div>
                                        </label>

                                        <label className="flex items-center gap-3 p-4 bg-white/5 border border-white/10 rounded-2xl cursor-pointer group hover:border-emerald-500/50 transition-all">
                                            <div className="relative">
                                                <input 
                                                    type="checkbox" 
                                                    className="peer appearance-none w-10 h-6 bg-slate-700 rounded-full checked:bg-emerald-600 transition-all cursor-pointer"
                                                    checked={formData.is_resumo_8020 || false}
                                                    onChange={(e) => setFormData({ ...formData, is_resumo_8020: e.target.checked })}
                                                />
                                                <div className="absolute top-1 left-1 size-4 bg-white rounded-full peer-checked:translate-x-4 transition-transform pointer-events-none shadow-sm"></div>
                                            </div>
                                            <div>
                                                <span className="block text-xs font-black text-white group-hover:text-emerald-400 transition-colors uppercase tracking-widest">Módulo de Resumo (80/20)</span>
                                                <span className="text-[9px] text-slate-500">Aplica um estilo focado e minimalista para revisões rápidas</span>
                                            </div>
                                        </label>

                                        <label className="flex items-center gap-3 p-4 bg-white/5 border border-white/10 rounded-2xl cursor-pointer group hover:border-blue-500/50 transition-all">
                                            <div className="relative">
                                                <input 
                                                    type="checkbox" 
                                                    className="peer appearance-none w-10 h-6 bg-slate-700 rounded-full checked:bg-blue-600 transition-all cursor-pointer"
                                                    checked={formData.is_audited || false}
                                                    onChange={(e) => setFormData({ ...formData, is_audited: e.target.checked })}
                                                />
                                                <div className="absolute top-1 left-1 size-4 bg-white rounded-full peer-checked:translate-x-4 transition-transform pointer-events-none shadow-sm"></div>
                                            </div>
                                            <div>
                                                <span className="block text-xs font-black text-white group-hover:text-blue-400 transition-colors uppercase tracking-widest">Auditoria Concluída</span>
                                                <span className="text-[9px] text-slate-500">Marca que a obra passou pelo processo de auditoria</span>
                                            </div>
                                        </label>
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

    if (view === 'validator' && auditingApostila) {
        return (
            <div className="flex flex-col gap-8 pb-10 animate-in fade-in duration-500">
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <button 
                            onClick={() => { setView('list'); setAuditingApostila(null); setAnalysisResults([]); setSelectedChapter(null); }}
                            className="size-12 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-slate-500 hover:text-blue-600 transition-all active:scale-95 shadow-sm"
                        >
                            <span className="material-symbols-outlined">arrow_back</span>
                        </button>
                        <div>
                            <h2 className="text-[#111418] text-3xl font-black tracking-tighter">Validador de Conteúdo IA</h2>
                            <p className="text-slate-500 font-medium italic">Analisando: {auditingApostila.title}</p>
                        </div>
                    </div>
                    {analysisResults.length > 0 && (
                        <button
                            onClick={() => setIsChapterModalOpen(true)}
                            className={`flex items-center gap-3 px-8 py-4 bg-slate-100 text-slate-700 rounded-[20px] font-black text-xs uppercase tracking-widest border border-slate-200 hover:bg-slate-200 transition-all active:scale-95`}
                        >
                            <span className="material-symbols-outlined font-black">format_list_bulleted</span>
                            Ver Capítulos ({analysisResults.length})
                        </button>
                    )}
                    <button
                        onClick={() => handleExtractChapters()}
                        disabled={isExtractingChapters || isAnalyzingChapter}
                        className={`flex items-center gap-3 px-8 py-4 bg-purple-600 text-white rounded-[20px] font-black text-xs uppercase tracking-widest shadow-2xl shadow-purple-500/20 hover:bg-purple-700 transition-all active:scale-95 disabled:opacity-50`}
                    >
                        <span className={`material-symbols-outlined font-black ${isExtractingChapters ? 'animate-spin' : ''}`}>{isExtractingChapters ? 'sync' : 'psychology'}</span>
                        {isExtractingChapters ? 'Processando IA (Pode demorar um pouco)...' : 'Mapear Capítulos (IA)'}
                    </button>
                </div>
                
                {/* Analysis Progress Bar */}
                {(isExtractingChapters || isAnalyzingChapter || analysisProgress > 0) && (
                    <div className="w-full bg-white rounded-[24px] p-6 border border-slate-200 shadow-sm animate-in slide-in-from-top-4">
                        <div className="flex justify-between items-center mb-3">
                            <div className="flex items-center gap-3">
                                <div className="size-8 rounded-lg bg-purple-100 text-purple-600 flex items-center justify-center">
                                    <span className="material-symbols-outlined text-[18px] animate-spin">sync</span>
                                </div>
                                <span className="text-[11px] font-black uppercase tracking-widest text-slate-600">
                                    {isExtractingChapters ? 'Mapeando Estrutura da Apostila...' : `Analisando: ${selectedChapter}`}
                                </span>
                            </div>
                            <span className="text-sm font-black text-purple-600">{analysisProgress || 25}%</span>
                        </div>
                        <div className="h-3 bg-slate-100 rounded-full overflow-hidden p-0.5 border border-slate-200">
                            <div 
                                className="h-full bg-gradient-to-r from-purple-500 to-indigo-600 rounded-full transition-all duration-1000 ease-out shadow-lg shadow-purple-500/20"
                                style={{ width: `${analysisProgress || 25}%` }}
                            ></div>
                        </div>
                        <p className="text-[10px] font-bold text-slate-400 mt-3 text-center italic">
                            O Gemini 3 Flash está processando milhares de tokens para garantir a veracidade do seu material...
                        </p>
                    </div>
                )}

                {/* Analysis Error Message */}
                {analysisError && (
                    <div className="w-full bg-red-50 border border-red-200 rounded-[24px] p-6 flex items-start gap-4 animate-in shake duration-500">
                        <div className="size-12 rounded-2xl bg-red-500 text-white flex items-center justify-center shrink-0 shadow-lg shadow-red-500/20">
                            <span className="material-symbols-outlined text-2xl">error</span>
                        </div>
                        <div className="flex-1">
                            <h4 className="text-sm font-black text-red-900 uppercase tracking-tight">Falha na Comunicação com a IA</h4>
                            <p className="text-xs font-bold text-red-700/70 mt-1">{analysisError}</p>
                            <button 
                                onClick={() => setAnalysisError(null)}
                                className="mt-4 px-6 py-2 bg-red-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-red-600 transition-all active:scale-95 shadow-md shadow-red-500/20"
                            >
                                Entendi
                            </button>
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-1 gap-8">
                    {/* Área de Relatório (Full Width) */}
                    <div className="space-y-6">
                        {!selectedChapter ? (
                            <div className="bg-white rounded-[40px] border border-slate-200 p-20 text-center flex flex-col items-center gap-6 shadow-sm border-dashed">
                                <div className="size-24 rounded-[32px] bg-purple-50 text-purple-500 flex items-center justify-center">
                                    <span className="material-symbols-outlined text-5xl">auto_awesome</span>
                                </div>
                                <div className="max-w-md">
                                    <h4 className="text-xl font-black text-slate-900 uppercase tracking-tighter">Aguardando Inteligência</h4>
                                    <p className="text-slate-500 mt-2 font-medium">
                                        Mapeie a apostila para gerar a estrutura de tópicos via Inteligência Artificial. O <b>Gemini 3 Flash</b> analisará a estrutura semântica conforme as TAGs de geração (ex: [--EXEMPLO--], [Questões]). 
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
                                {(() => {
                                    const currChapter = analysisResults.find(r => r.capitulo === selectedChapter);
                                    if (!currChapter) return null;

                                    if (currChapter.status === 'pending') {
                                        return (
                                            <div className="bg-white rounded-[40px] border border-slate-200 p-20 text-center flex flex-col items-center gap-6 shadow-sm">
                                                <span className="material-symbols-outlined text-5xl text-slate-300">target</span>
                                                <div className="max-w-md">
                                                    <h4 className="text-xl font-black text-slate-900 uppercase tracking-tighter">Pronto para Análise</h4>
                                                    <p className="text-slate-500 mt-2 font-medium">Vamos concentrar o poder computacional exclusivamente neste bloco de texto para garantir precisão máxima.</p>
                                                </div>
                                                <button
                                                    onClick={() => handleAnalyzeChapter(selectedChapter)}
                                                    disabled={isAnalyzingChapter}
                                                    className={`mt-4 flex items-center gap-3 px-8 py-4 bg-slate-900 text-white rounded-[20px] font-black text-xs uppercase tracking-widest shadow-xl shadow-slate-900/20 hover:bg-slate-800 transition-all active:scale-95 disabled:opacity-50`}
                                                >
                                                    <span className="material-symbols-outlined font-black">{isAnalyzingChapter ? 'sync' : 'search'}</span>
                                                    {isAnalyzingChapter ? 'Auditando...' : 'Analisar Este Capítulo'}
                                                </button>
                                            </div>
                                        );
                                    }

                                    if (currChapter.status === 'analyzing') {
                                        return (
                                            <div className="bg-white rounded-[40px] border border-slate-200 p-20 text-center flex flex-col items-center gap-6 shadow-sm">
                                                <span className="material-symbols-outlined text-5xl text-purple-500 animate-spin">refresh</span>
                                                <h4 className="text-xl font-black text-slate-900 uppercase tracking-tighter animate-pulse">Auditando Fatos...</h4>
                                                <p className="text-slate-500">O Gemini está cruzando os dados deste capítulo...</p>
                                            </div>
                                        );
                                    }

                                    if (currChapter.status === 'validated' && currChapter.alertas.length === 0) {
                                        return (
                                            <div className="bg-green-50 rounded-[40px] border border-green-200 p-20 text-center flex flex-col items-center gap-6 shadow-sm">
                                                <span className="material-symbols-outlined text-6xl text-green-500">verified</span>
                                                <div>
                                                    <h4 className="text-xl font-black text-green-900 uppercase tracking-tighter">100% Correto</h4>
                                                    <p className="text-green-700 mt-2 font-medium">Nenhum erro factual ou informação desatualizada foi encontrada neste capítulo.</p>
                                                </div>
                                            </div>
                                        );
                                    }

                                    if (currChapter.status === 'error') {
                                        return (
                                            <div className="bg-red-50 rounded-[40px] border border-red-200 p-20 text-center flex flex-col items-center gap-6 shadow-sm">
                                                <span className="material-symbols-outlined text-5xl text-red-500">warning</span>
                                                <h4 className="text-xl font-black text-red-900 uppercase tracking-tighter">Erro na Análise</h4>
                                                <p className="text-red-700">Houve um problema ao processar este capítulo. Tente novamente.</p>
                                            </div>
                                        );
                                    }

                                    return (
                                        <>
                                            <div className="flex items-center gap-3 px-2">
                                                <div className="size-2 bg-red-500 rounded-full animate-pulse"></div>
                                                <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Erros Factuais Encontrados: {currChapter.alertas.length}</h3>
                                            </div>
                                            
                                            {currChapter.alertas.map((alerta: any, idx: number) => (
                                                <div key={idx} className={`bg-white rounded-[32px] border border-red-100 p-8 flex flex-col gap-6 shadow-sm transition-all hover:shadow-xl`}>
                                                    <div className="flex items-center gap-4">
                                                        <div className="size-12 rounded-xl bg-red-50 text-red-500 flex items-center justify-center shrink-0">
                                                            <span className="material-symbols-outlined text-3xl font-black">report</span>
                                                        </div>
                                                        <div>
                                                            <span className="px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest bg-red-500 text-white inline-block mb-1">
                                                                {alerta.tipo_correcao === 'exclusao' ? 'Apagar Trecho' : alerta.tipo_correcao === 'acrescimo' ? 'Falta de Informação' : 'Substituir Trecho'}
                                                            </span>
                                                            <h4 className="font-black text-slate-800 uppercase tracking-tight text-sm">Problema Factual Detectado</h4>
                                                        </div>
                                                    </div>

                                                    <div className="pl-16 space-y-4">
                                                        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                                                            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1"><span className="material-symbols-outlined text-sm">format_quote</span> Trecho Original da Apostila</div>
                                                            <p className="text-slate-600 font-medium italic">"{alerta.original}"</p>
                                                        </div>

                                                        <div className="bg-red-50 p-4 rounded-2xl border border-red-100">
                                                            <div className="text-[10px] font-black text-red-400 uppercase tracking-widest mb-2 flex items-center gap-1"><span className="material-symbols-outlined text-sm">manage_search</span> Análise do Erro</div>
                                                            <p className="text-red-900 font-medium">{alerta.analise}</p>
                                                        </div>

                                                        {alerta.tipo_correcao !== 'exclusao' && (
                                                            <div className="bg-green-50 p-4 rounded-2xl border border-green-100">
                                                                <div className="text-[10px] font-black text-green-500 uppercase tracking-widest mb-2 flex items-center gap-1"><span className="material-symbols-outlined text-sm">edit_note</span> Sugestão de Correção</div>
                                                                <p className="text-green-800 font-bold">{alerta.sugestao}</p>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </>
                                    );
                                })()}
                            </div>
                        )}
                    </div>
                </div>

                {/* POPUP DE CAPÍTULOS */}
                {isChapterModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in">
                        <div className="bg-white rounded-[40px] w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-300">
                        <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 rounded-t-[40px]">
                            <div>
                                <h3 className="text-2xl font-black text-slate-900 tracking-tight">Capítulos Encontrados</h3>
                                <p className="text-slate-500 font-medium text-sm mt-1">Selecione um bloco para a IA auditar rigorosamente.</p>
                            </div>
                            <button onClick={() => setIsChapterModalOpen(false)} className="size-12 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-slate-400 hover:text-red-500 hover:border-red-200 transition-all">
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>
                        
                        <div className="p-8 overflow-y-auto custom-scrollbar flex-1 space-y-3">
                            {analysisResults.length === 0 ? (
                                <p className="text-center text-slate-400 font-bold p-10">Nenhum capítulo processado.</p>
                            ) : (
                                analysisResults.map((res, idx) => (
                                    <div key={idx} className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-5 rounded-3xl border border-slate-100 bg-white hover:border-purple-200 hover:shadow-md transition-all group">
                                        <div className="flex items-center gap-4 flex-1">
                                            <div className={`size-12 rounded-2xl flex items-center justify-center shrink-0 ${res.status === 'pending' ? 'bg-slate-100 text-slate-400' : res.status === 'analyzing' ? 'bg-purple-100 text-purple-600' : res.status === 'validated' && res.alertas.length === 0 ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                                                <span className={`material-symbols-outlined ${res.status === 'analyzing' ? 'animate-spin' : ''}`}>
                                                    {res.status === 'pending' ? 'description' : res.status === 'analyzing' ? 'refresh' : res.status === 'validated' && res.alertas.length === 0 ? 'verified' : 'report'}
                                                </span>
                                            </div>
                                            <div>
                                                <h4 className="font-black text-slate-800 text-lg uppercase tracking-tighter line-clamp-1">{res.capitulo}</h4>
                                                <div className="flex items-center gap-3 mt-1">
                                                    {res.status === 'validated' && res.alertas.length > 0 && (
                                                        <span className="px-2 py-0.5 bg-red-100 text-red-600 text-[10px] font-black rounded-lg">{res.alertas.length} Erros</span>
                                                    )}
                                                    {res.status === 'validated' && res.alertas.length === 0 && (
                                                        <span className="px-2 py-0.5 bg-green-100 text-green-600 text-[10px] font-black rounded-lg">Validado Factualmente</span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        
                                        <button
                                            onClick={() => handleAnalyzeChapter(res.capitulo)}
                                            disabled={isAnalyzingChapter || res.status === 'analyzing'}
                                            className={`shrink-0 px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all ${
                                                res.status === 'validated' 
                                                    ? 'bg-white border-2 border-slate-200 text-slate-400 hover:border-slate-400' 
                                                    : 'bg-purple-600 text-white hover:bg-purple-700 shadow-lg shadow-purple-500/20'
                                            }`}
                                        >
                                            {res.status === 'analyzing' ? 'Auditando...' : res.status === 'validated' ? 'Analisar Novamente' : 'Auditar Agora'}
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
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
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
                        onChange={e => {
                            const val = e.target.value;
                            if (val.startsWith('prof_')) {
                                setFilterProfessor(val.replace('prof_', ''));
                                setFilterAuthor('');
                            } else {
                                setFilterAuthor(val);
                                setFilterProfessor('');
                            }
                        }}
                        className="h-14 px-6 bg-slate-50 border border-slate-100 rounded-[20px] text-sm font-bold text-slate-500 outline-none appearance-none"
                    >
                        <option value="">Filtrar Responsável</option>
                        <optgroup label="Corpo Administrativo">
                            <option value={currentUser?.id || ''}>Minha Produção (Adm)</option>
                            {admins.filter(adm => adm.id !== currentUser?.id).map(adm => <option key={adm.id} value={adm.id}>{adm.full_name}</option>)}
                        </optgroup>
                        <optgroup label="Professores">
                            {currentTeacher && <option value={`prof_${currentTeacher.id}`}>Minhas Apostilas (Professor)</option>}
                            {teachers.filter(t => t.id !== currentTeacher?.id).map(t => <option key={t.id} value={`prof_${t.id}`}>{t.name}</option>)}
                        </optgroup>
                    </select>
                    <select
                        value={filterSortOrder}
                        onChange={e => setFilterSortOrder(e.target.value as 'asc' | 'desc')}
                        className="h-14 px-6 bg-slate-50 border border-slate-100 rounded-[20px] text-sm font-bold text-slate-500 outline-none appearance-none"
                    >
                        <option value="asc">Mais Antigas Primeiro (Padrão)</option>
                        <option value="desc">Mais Recentes Primeiro</option>
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
                                <th className="px-10 py-6 text-center">Qualidade</th>
                                <th className="px-10 py-6 text-center">Auditoria</th>
                                <th className="px-10 py-6 text-center">Exibição</th>
                                <th className="px-10 py-6 text-right">Controle Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50 font-medium">
                            {Object.entries(grouped).map(([discName, items]) => (
                                <React.Fragment key={discName}>
                                    <tr className="bg-slate-50/20">
                                        <td colSpan={5} className="px-10 py-3 border-b border-slate-100/50">
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
                                                            {a.is_resumo_8020 && (
                                                                <span className="px-2 py-0.5 bg-emerald-500 text-white text-[8px] font-black rounded-lg uppercase tracking-widest animate-pulse">80/20</span>
                                                            )}
                                                            {a.is_resolution_notebook && (
                                                                <span className="px-2 py-0.5 bg-purple-500 text-white text-[8px] font-black rounded-lg uppercase tracking-widest">Resolvida</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-10 py-8">
                                                    <div className="flex items-center gap-3">
                                                        <div className="size-8 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 overflow-hidden">
                                                            {a.teacher?.avatar_url ? (
                                                                <img src={a.teacher.avatar_url} className="w-full h-full object-cover" />
                                                            ) : (
                                                                <span className="material-symbols-outlined text-sm">person</span>
                                                            )}
                                                        </div>
                                                        <div className="flex flex-col">
                                                            {currentUser?.role === 'super' ? (
                                                                <select
                                                                    value={a.professor_id || ''}
                                                                    onChange={(e) => updateApostilaProfessor(a.id, e.target.value || null)}
                                                                    className="text-[11px] font-black text-slate-900 bg-transparent border-none outline-none cursor-pointer hover:text-blue-600 transition-colors focus:ring-0 appearance-none"
                                                                >
                                                                    <option value="">Equipe BPA</option>
                                                                    {teachers.map(t => (
                                                                        <option key={t.id} value={t.id}>{t.name}</option>
                                                                    ))}
                                                                </select>
                                                            ) : (
                                                                <span className="text-[11px] font-black text-slate-900">{a.teacher?.name || 'Equipe BPA'}</span>
                                                            )}
                                                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Publicado em: {new Date(a.created_at).toLocaleDateString()}</span>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-10 py-8 text-center text-slate-300">
                                                    {perms.canValidate ? (
                                                        <div
                                                            onClick={() => handleOpenValidationModal(a)}
                                                            className={`group/qual relative px-4 py-2 rounded-2xl transition-all border-2 flex items-center gap-3 mx-auto cursor-pointer ${a.validation?.professional_validation ? 'bg-indigo-600 border-indigo-400 text-white shadow-lg' : getValidationProgress(a.validation) === 100 ? 'bg-emerald-50 border-emerald-400 text-emerald-600' : getValidationProgress(a.validation) > 0 ? 'bg-amber-50 border-amber-300 text-amber-600' : 'bg-slate-50 border-slate-100 text-slate-400 hover:border-slate-300'}`}
                                                        >
                                                            <span className={`material-symbols-outlined text-[20px] ${getValidationProgress(a.validation) > 0 && getValidationProgress(a.validation) < 100 ? 'animate-pulse' : ''}`}>
                                                                {a.validation?.professional_validation ? 'verified' : getValidationProgress(a.validation) === 100 ? 'verified' : 'verified_user'}
                                                            </span>
                                                            <span className="text-[10px] font-black uppercase tracking-widest">
                                                                {a.validation?.professional_validation ? 'Validado' : `${getValidationProgress(a.validation)}%`}
                                                            </span>
                                                            
                                                            {getValidationProgress(a.validation) > 0 && getValidationProgress(a.validation) < 100 && !a.validation?.professional_validation && (
                                                                <div className="absolute -top-1 -right-1 size-3 bg-amber-500 rounded-full border-2 border-white"></div>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <div className={`relative px-4 py-2 rounded-2xl border-2 flex items-center gap-3 mx-auto opacity-40 grayscale-[0.8] cursor-not-allowed ${a.validation?.professional_validation ? 'bg-indigo-100 border-indigo-200 text-indigo-400' : 'bg-slate-50 border-slate-100 text-slate-300'}`}>
                                                             <span className="material-symbols-outlined text-[20px]">
                                                                {a.validation?.professional_validation ? 'verified' : 'verified_user'}
                                                            </span>
                                                            <span className="text-[10px] font-black uppercase tracking-widest">
                                                                {a.validation?.professional_validation ? 'Validado' : `${getValidationProgress(a.validation)}%`}
                                                            </span>
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-10 py-8 text-center">
                                                    <button
                                                        onClick={() => handleToggleAudit(a)}
                                                        className={`group/audit relative px-4 py-2 rounded-2xl transition-all border-2 flex items-center gap-2 mx-auto cursor-pointer ${a.is_audited ? 'bg-blue-600 border-blue-400 text-white shadow-lg' : 'bg-slate-50 border-slate-100 text-slate-400 hover:border-slate-300'}`}
                                                        title={a.is_audited ? 'Auditado - Clique para desmarcar' : 'Não Auditado - Clique para marcar como auditado'}
                                                    >
                                                        <span className="material-symbols-outlined text-[18px]">
                                                            {a.is_audited ? 'task_alt' : 'inventory_2'}
                                                        </span>
                                                        <span className="text-[10px] font-black uppercase tracking-widest">
                                                            {a.is_audited ? 'Auditado' : 'Auditar'}
                                                        </span>
                                                    </button>
                                                </td>
                                                <td className="px-10 py-8 text-center">
                                                    <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border ${a.status === 'Ativo' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-slate-50 text-slate-400 border-slate-100'}`}>
                                                        {a.status === 'Ativo' ? 'Publicado' : 'Rascunho'}
                                                    </span>
                                                </td>
                                                <td className="px-10 py-8 text-right">
                                                     <button
                                                         onClick={(e) => {
                                                             e.stopPropagation();
                                                             setActiveActionMenuId(a.id);
                                                         }}
                                                         className="size-10 bg-white border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-800 flex items-center justify-center rounded-xl transition-all shadow-sm active:scale-95"
                                                         title="Opções de Ação"
                                                     >
                                                         <span className="material-symbols-outlined text-[22px] font-black">more_horiz</span>
                                                     </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </React.Fragment>
                            ))}
                            {Object.keys(grouped).length === 0 && (
                                <tr>
                                    <td colSpan={6} className="px-10 py-32 text-center">
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

                {/* Modal de Ações Centralizado Premium */}
                {activeActionMenuId && (() => {
                    const a = apostilas.find(item => item.id === activeActionMenuId);
                    if (!a) return null;
                    const perms = getPermissions(a);
                    return (
                        <div 
                            className="fixed inset-0 z-[1050] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300"
                            onClick={() => setActiveActionMenuId(null)}
                        >
                            <div 
                                className="bg-white rounded-[32px] w-full max-w-md shadow-2xl border border-slate-100 p-6 animate-in zoom-in-95 duration-200 flex flex-col gap-6 text-left max-h-[90vh]"
                                onClick={(e) => e.stopPropagation()}
                            >
                                {/* Header */}
                                <div className="flex justify-between items-start pb-4 border-b border-slate-100">
                                    <div className="flex items-center gap-3">
                                        <div className="size-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                                            <span className="material-symbols-outlined text-xl">layers</span>
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight leading-none">Painel de Ações</h3>
                                            <p className="text-[11px] font-bold text-slate-400 mt-1.5 line-clamp-1">{a.title}</p>
                                        </div>
                                    </div>
                                    <button 
                                        onClick={() => setActiveActionMenuId(null)} 
                                        className="size-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-all"
                                    >
                                        <span className="material-symbols-outlined text-lg">close</span>
                                    </button>
                                </div>

                                {/* Organized Action Options */}
                                <div className="overflow-y-auto max-h-[60vh] pr-1 space-y-4 no-scrollbar">
                                    
                                    {/* Grupo 1: Edição e Visualização */}
                                    <div className="space-y-1.5">
                                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Curadoria & Produção</span>
                                        
                                        {perms.canEdit && (
                                            <button
                                                onClick={() => {
                                                    setActiveActionMenuId(null);
                                                    handleOpenForm(a);
                                                }}
                                                className="w-full p-3 rounded-2xl border border-slate-100 hover:bg-blue-50/50 hover:border-blue-200 text-slate-700 flex items-center gap-4 transition-all text-xs font-bold group text-left"
                                            >
                                                <div className="size-9 rounded-xl bg-slate-50 text-slate-400 flex items-center justify-center group-hover:bg-blue-100 group-hover:text-blue-600 transition-colors shrink-0">
                                                    <span className="material-symbols-outlined text-base">edit_note</span>
                                                </div>
                                                <div>
                                                    <p className="font-black text-slate-800 group-hover:text-blue-600">Editar Conteúdo</p>
                                                    <p className="text-[10px] text-slate-400 font-medium">Modificar textos, mídias e tags</p>
                                                </div>
                                            </button>
                                        )}

                                        <button
                                            onClick={() => {
                                                setActiveActionMenuId(null);
                                                handlePreview(a.id);
                                            }}
                                            className="w-full p-3 rounded-2xl border border-slate-100 hover:bg-emerald-50/50 hover:border-emerald-200 text-slate-700 flex items-center gap-4 transition-all text-xs font-bold group text-left"
                                        >
                                            <div className="size-9 rounded-xl bg-slate-50 text-slate-400 flex items-center justify-center group-hover:bg-emerald-100 group-hover:text-emerald-600 transition-colors shrink-0">
                                                <span className="material-symbols-outlined text-base">visibility</span>
                                            </div>
                                            <div>
                                                <p className="font-black text-slate-800 group-hover:text-emerald-600">Ver como Aluno</p>
                                                <p className="text-[10px] text-slate-400 font-medium">Visualizar a obra na trilha do aluno</p>
                                            </div>
                                        </button>

                                        {perms.canDuplicate && (
                                            <button
                                                onClick={() => {
                                                    setActiveActionMenuId(null);
                                                    handleDuplicate(a);
                                                }}
                                                className="w-full p-3 rounded-2xl border border-slate-100 hover:bg-blue-50/50 hover:border-blue-200 text-slate-700 flex items-center gap-4 transition-all text-xs font-bold group text-left"
                                            >
                                                <div className="size-9 rounded-xl bg-slate-50 text-slate-400 flex items-center justify-center group-hover:bg-blue-100 group-hover:text-blue-600 transition-colors shrink-0">
                                                    <span className="material-symbols-outlined text-base">content_copy</span>
                                                </div>
                                                <div>
                                                    <p className="font-black text-slate-800 group-hover:text-blue-600">Duplicar Material</p>
                                                    <p className="text-[10px] text-slate-400 font-medium">Clonar estrutura completa</p>
                                                </div>
                                            </button>
                                        )}
                                    </div>

                                    {/* Grupo 2: Qualidade e Auditoria */}
                                    <div className="space-y-1.5">
                                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Qualidade & IA</span>
                                        
                                        <button
                                            onClick={async () => {
                                                setActiveActionMenuId(null);
                                                handleToggleAudit(a);
                                            }}
                                            className={`w-full p-3 rounded-2xl border flex items-center gap-4 transition-all text-xs font-bold group text-left ${
                                                a.is_audited 
                                                    ? 'bg-blue-50/50 border-blue-200 text-blue-700 hover:bg-blue-100/50' 
                                                    : 'border-slate-100 hover:bg-slate-50 text-slate-700'
                                            }`}
                                        >
                                            <div className={`size-9 rounded-xl flex items-center justify-center transition-colors shrink-0 ${
                                                a.is_audited 
                                                    ? 'bg-blue-100 text-blue-600' 
                                                    : 'bg-slate-50 text-slate-400 group-hover:bg-blue-100 group-hover:text-blue-600'
                                            }`}>
                                                <span className="material-symbols-outlined text-base">
                                                    {a.is_audited ? 'task_alt' : 'inventory_2'}
                                                </span>
                                            </div>
                                            <div>
                                                <p className="font-black text-slate-800">
                                                    {a.is_audited ? 'Obra Auditada' : 'Marcar como Auditada'}
                                                </p>
                                                <p className="text-[10px] text-slate-400 font-medium">
                                                    {a.is_audited ? 'Apostila já revisada pela coordenação' : 'Sinalizar que a curadoria está concluída'}
                                                </p>
                                            </div>
                                        </button>

                                        <button
                                            onClick={() => {
                                                setActiveActionMenuId(null);
                                                setAuditingApostila(a);
                                                setView('validator');
                                            }}
                                            className="w-full p-3 rounded-2xl border border-slate-100 hover:bg-purple-50/50 hover:border-purple-200 text-slate-700 flex items-center gap-4 transition-all text-xs font-bold group text-left"
                                        >
                                            <div className="size-9 rounded-xl bg-slate-50 text-slate-400 flex items-center justify-center group-hover:bg-purple-100 group-hover:text-purple-600 transition-colors shrink-0">
                                                <span className="material-symbols-outlined text-base animate-pulse">psychology</span>
                                            </div>
                                            <div>
                                                <p className="font-black text-slate-800 group-hover:text-purple-600">Auditoria IA (Gemini)</p>
                                                <p className="text-[10px] text-slate-400 font-medium">Validação de erros com inteligência artificial</p>
                                            </div>
                                        </button>

                                        {perms.canValidate && (
                                            <button
                                                onClick={() => {
                                                    setActiveActionMenuId(null);
                                                    handleOpenObservationModal(a);
                                                }}
                                                className="w-full p-3 rounded-2xl border border-slate-100 hover:bg-indigo-50/50 hover:border-indigo-200 text-slate-700 flex items-center gap-4 transition-all text-xs font-bold group text-left"
                                            >
                                                <div className="size-9 rounded-xl bg-slate-50 text-slate-400 flex items-center justify-center group-hover:bg-indigo-100 group-hover:text-indigo-600 transition-colors shrink-0">
                                                    <span className="material-symbols-outlined text-base">assignment_add</span>
                                                </div>
                                                <div>
                                                    <p className="font-black text-slate-800 group-hover:text-indigo-600">Anotar Melhorias</p>
                                                    <p className="text-[10px] text-slate-400 font-medium">Cadastrar apontamentos e revisões</p>
                                                </div>
                                            </button>
                                        )}

                                        <button
                                            onClick={() => {
                                                setActiveActionMenuId(null);
                                                handleExportTxt(a);
                                            }}
                                            className="w-full p-3 rounded-2xl border border-slate-100 hover:bg-slate-50 hover:border-slate-300 text-slate-700 flex items-center gap-4 transition-all text-xs font-bold group text-left"
                                        >
                                            <div className="size-9 rounded-xl bg-slate-50 text-slate-400 flex items-center justify-center group-hover:bg-slate-100 group-hover:text-slate-800 transition-colors shrink-0">
                                                <span className="material-symbols-outlined text-base">description</span>
                                            </div>
                                            <div>
                                                <p className="font-black text-slate-800 group-hover:text-slate-800">Exportar para TXT</p>
                                                <p className="text-[10px] text-slate-400 font-medium">Gerar arquivo em texto puro</p>
                                            </div>
                                        </button>
                                    </div>

                                    {perms.canDelete && (
                                        <div className="space-y-1.5">
                                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Zona Crítica</span>
                                            <button
                                                onClick={() => {
                                                    setActiveActionMenuId(null);
                                                    handleDelete(a.id);
                                                }}
                                                className="w-full p-3 rounded-2xl border border-red-50 hover:bg-red-50 hover:border-red-200 text-slate-700 flex items-center gap-4 transition-all text-xs font-bold group text-left"
                                            >
                                                <div className="size-9 rounded-xl bg-red-50 text-red-400 flex items-center justify-center group-hover:bg-red-500 group-hover:text-white transition-colors shrink-0">
                                                    <span className="material-symbols-outlined text-base">delete_sweep</span>
                                                </div>
                                                <div>
                                                    <p className="font-black text-slate-800 group-hover:text-red-600">Excluir Obra</p>
                                                    <p className="text-[10px] text-red-400 font-medium">Deletar permanentemente do acervo</p>
                                                </div>
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })()}

                {/* Pagination Controls */}
                {apostilas.length < totalCount && (
                    <div className="flex justify-center px-10 py-6 bg-slate-50 border-t border-slate-100">
                        <button
                            onClick={() => setCurrentPage(prev => prev + 1)}
                            disabled={loading}
                            className="flex items-center gap-3 px-8 py-4 bg-white border border-slate-200 text-slate-500 rounded-2xl font-black text-xs uppercase tracking-widest hover:border-blue-500 hover:text-blue-600 shadow-sm transition-all active:scale-95 disabled:opacity-50"
                        >
                            {loading ? (
                                <>
                                    <span className="material-symbols-outlined animate-spin">refresh</span>
                                    Carregando...
                                </>
                            ) : (
                                <>
                                    <span className="material-symbols-outlined">add_circle</span>
                                    Carregar Mais ({totalCount - apostilas.length} restantes)
                                </>
                            )}
                        </button>
                    </div>
                )}
            </div>
            {/* Modal de Validação */}
            {isValidationModalOpen && validatingApostila && (
                <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-white w-full max-w-md rounded-[32px] shadow-2xl overflow-hidden flex flex-col scale-in-center animate-in zoom-in-95 max-h-[90vh]">
                        {/* Header */}
                        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                            <div className="flex items-center gap-3">
                                <div className="size-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-lg shadow-amber-500/20">
                                    <span className="material-symbols-outlined text-[20px]">verified</span>
                                </div>
                                <div className="flex flex-col">
                                    <h3 className="text-base font-black text-slate-900 uppercase leading-none">Verificação</h3>
                                    <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-tighter">Qualidade do Conteúdo</p>
                                </div>
                            </div>
                            <button onClick={() => setIsValidationModalOpen(false)} className="size-8 rounded-full hover:bg-slate-200 flex items-center justify-center transition-all">
                                <span className="material-symbols-outlined text-[20px]">close</span>
                            </button>
                        </div>

                        {/* Content */}
                        <div className="p-6 space-y-6 overflow-y-auto flex-1 custom-scrollbar">
                            {/* Professor Selector */}
                            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 border-dashed">
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1 block mb-2">Responsável</span>
                                <div className="flex items-center gap-3">
                                    <div className="size-10 rounded-xl bg-white border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center shadow-sm">
                                        {validatingApostila.teacher?.avatar_url ? (
                                            <img src={validatingApostila.teacher.avatar_url} className="w-full h-full object-cover" />
                                        ) : (
                                            <span className="material-symbols-outlined text-slate-300 text-[24px]">account_circle</span>
                                        )}
                                    </div>
                                    <select 
                                        value={validatingApostila.professor_id || ''}
                                        onChange={(e) => handleSetProfessor(e.target.value || null)}
                                        disabled={isSavingValidation || currentUser?.role !== 'super'}
                                        className="flex-1 h-10 px-3 bg-white border border-slate-200 rounded-xl font-bold text-xs outline-none focus:ring-2 focus:ring-amber-500/20 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <option value="">Sem professor</option>
                                        {teachers.map(t => (
                                            <option key={t.id} value={t.id}>{t.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Progress bar */}
                            <div className="space-y-2">
                                <div className="flex justify-between items-end px-1">
                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Checklist</span>
                                    <span className="text-xl font-black text-slate-900">{getValidationProgress(validatingApostila.validation)}%</span>
                                </div>
                                <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200 p-0.5">
                                    <div 
                                        className={`h-full rounded-full transition-all duration-700 ease-out ${getValidationProgress(validatingApostila.validation) === 100 ? 'bg-emerald-500' : 'bg-amber-400'}`}
                                        style={{ width: `${getValidationProgress(validatingApostila.validation)}%` }}
                                    ></div>
                                </div>
                            </div>

                            {/* Checklist Grid */}
                            <div className="grid grid-cols-1 gap-2">
                                {[
                                    { id: 'structure', label: 'Estrutura', desc: 'Títulos e hierarquia', icon: 'account_tree' },
                                    { id: 'images', label: 'Imagens', desc: 'Mídias e diagramação', icon: 'image' },
                                    { id: 'notebooks', label: 'Cadernos', desc: 'Memorização vinculada', icon: 'book' },
                                    { id: 'questions', label: 'Questões', desc: 'Formatação e correção', icon: 'quiz' },
                                ].map((item) => {
                                    const isChecked = (validatingApostila.validation as any)?.[item.id] === true;
                                    return (
                                        <button
                                            key={item.id}
                                            onClick={() => handleToggleValidation(item.id as any)}
                                            disabled={isSavingValidation}
                                            className={`flex items-center gap-4 p-3 rounded-2xl border-2 transition-all text-left ${isChecked ? 'bg-emerald-50 border-emerald-500' : 'bg-white border-slate-100 hover:border-slate-200'}`}
                                        >
                                            <div className={`size-8 rounded-lg flex items-center justify-center ${isChecked ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-400'}`}>
                                                <span className="material-symbols-outlined text-[18px]">{isChecked ? 'check' : item.icon}</span>
                                            </div>
                                            <div className="flex-1">
                                                <h4 className={`text-[11px] font-black uppercase tracking-widest ${isChecked ? 'text-emerald-700' : 'text-slate-700'}`}>{item.label}</h4>
                                                <p className={`text-[9px] font-bold ${isChecked ? 'text-emerald-600/60' : 'text-slate-400'}`}>{item.desc}</p>
                                            </div>
                                            <div className={`size-5 rounded-full border-2 flex items-center justify-center ${isChecked ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-200'}`}>
                                                {isChecked && <span className="material-symbols-outlined text-[10px]">check</span>}
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>

                            {/* professional_validation Toggle */}
                            <div className="pt-4 border-t border-slate-100">
                                <button
                                    onClick={() => handleToggleValidation('professional_validation' as any)}
                                    disabled={isSavingValidation}
                                    className={`w-full flex flex-col items-center gap-3 p-6 rounded-3xl border-2 transition-all ${validatingApostila.validation?.professional_validation ? 'bg-indigo-600 border-indigo-400 text-white shadow-xl shadow-indigo-200' : 'bg-slate-50 border-slate-200 text-slate-400 hover:bg-white hover:border-indigo-200'}`}
                                >
                                    <span className="material-symbols-outlined text-[32px]">{validatingApostila.validation?.professional_validation ? 'verified' : 'fact_check'}</span>
                                    <div className="text-center">
                                        <h4 className="text-xs font-black uppercase tracking-[0.2em]">{validatingApostila.validation?.professional_validation ? 'Apostila Validada' : 'Validar Apostila'}</h4>
                                        <p className="text-[9px] font-bold opacity-60 mt-1">{validatingApostila.validation?.professional_validation ? 'Acurácia técnica confirmada pelo mestre' : 'Confirmar revisão final e precisão técnica'}</p>
                                    </div>
                                </button>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="p-4 bg-slate-50 border-t border-slate-100">
                            <button 
                                onClick={() => setIsValidationModalOpen(false)}
                                className="w-full py-3 bg-white border border-slate-200 rounded-xl font-black text-[10px] uppercase tracking-widest text-slate-500 hover:bg-slate-100 transition-all active:scale-95"
                            >
                                Fechar Painel de Verificação
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Observação */}
            {isObservationModalOpen && observingApostila && (
                <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-white w-full max-w-lg rounded-[32px] shadow-2xl overflow-hidden flex flex-col scale-in-center animate-in zoom-in-95">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-indigo-50/30">
                            <div className="flex items-center gap-3">
                                <div className="size-10 rounded-xl bg-indigo-500 text-white flex items-center justify-center shadow-lg shadow-indigo-500/20">
                                    <span className="material-symbols-outlined text-[20px]">comment</span>
                                </div>
                                <div>
                                    <h3 className="text-base font-black text-slate-900 uppercase leading-none">Observações / Melhorias</h3>
                                    <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-tighter">{observingApostila.title}</p>
                                </div>
                            </div>
                            <button onClick={() => setIsObservationModalOpen(false)} className="size-8 rounded-full hover:bg-indigo-100 flex items-center justify-center transition-all">
                                <span className="material-symbols-outlined text-[20px]">close</span>
                            </button>
                        </div>
                        <div className="p-8 space-y-4">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Digite as melhorias necessárias:</label>
                            <textarea
                                value={observationText}
                                onChange={e => setObservationText(e.target.value)}
                                className="w-full h-48 p-5 bg-slate-50 border border-slate-200 rounded-3xl outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-200 transition-all font-medium text-slate-700 resize-none text-sm"
                                placeholder="Descreva aqui o que precisa ser corrigido ou melhorado nesta apostila..."
                            />
                        </div>
                        <div className="p-6 bg-slate-50 border-t border-slate-100 flex gap-3">
                            <button 
                                onClick={() => setIsObservationModalOpen(false)}
                                className="flex-1 py-4 bg-white border border-slate-200 rounded-2xl font-black text-[10px] uppercase tracking-widest text-slate-400 hover:bg-slate-100 transition-all"
                            >
                                Cancelar
                            </button>
                            <button 
                                onClick={handleSaveObservation}
                                disabled={isSavingObservation}
                                className="flex-[2] py-4 bg-indigo-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-600/20 active:scale-95 disabled:opacity-50"
                            >
                                {isSavingObservation ? 'Salvando...' : 'Salvar Observação'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ApostilasAdmin;
