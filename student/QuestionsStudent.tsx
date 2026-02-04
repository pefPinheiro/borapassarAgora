
import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Questao, Disciplina, Assunto } from '../types';
import InteractiveQuestion from '../components/InteractiveQuestion';

interface Banca {
    id: string;
    name: string;
}

const QuestionsStudent: React.FC = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const filtroInicial = searchParams.get('filtro');

    const [isFocusMode, setIsFocusMode] = useState(false);
    const [questions, setQuestions] = useState<Questao[]>([]);
    const [loading, setLoading] = useState(true);
    const [userAnswers, setUserAnswers] = useState<Record<string, number | null>>({});
    const [showExplanations, setShowExplanations] = useState<Record<string, boolean>>({});
    const containerRef = useRef<HTMLDivElement>(null);

    // Filters Data
    const [disciplinas, setDisciplinas] = useState<Disciplina[]>([]);
    const [assuntos, setAssuntos] = useState<Assunto[]>([]);
    const [bancas, setBancas] = useState<Banca[]>([]);
    const [filteredAssuntos, setFilteredAssuntos] = useState<Assunto[]>([]);

    // Selected Filters
    const [filterDisciplina, setFilterDisciplina] = useState(searchParams.get('disciplina') || '');
    const [filterAssunto, setFilterAssunto] = useState(searchParams.get('assunto') || '');
    const [filterBanca, setFilterBanca] = useState('');
    const [filterAno, setFilterAno] = useState('');
    const [filterStatus, setFilterStatus] = useState('all');
    const [filterModalidade, setFilterModalidade] = useState('');

    const [resolvedIds, setResolvedIds] = useState<Set<string>>(new Set());

    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const pageSize = 10;

    // Daily Limit State
    const [dailyLimitStatus, setDailyLimitStatus] = useState({ is_premium: false, questions_today: 0, daily_limit: 20 });
    const [showLimitPopup, setShowLimitPopup] = useState(false);

    useEffect(() => {
        fetchAuxiliaryData();
        fetchQuestions(1);
        checkDailyLimit();
    }, []);

    const checkDailyLimit = async () => {
        const { data, error } = await supabase.rpc('get_student_daily_status');
        if (data) {
            setDailyLimitStatus(data);
        }
    };

    // Filter effect: When filters change, reset to page 1
    useEffect(() => {
        setPage(1);
        fetchQuestions(1);
    }, [filterDisciplina, filterAssunto, filterBanca, filterAno, filterStatus, filterModalidade]);

    // Update filtered assuntos when disciplina changes
    useEffect(() => {
        // Wait for assuntos to be loaded
        if (assuntos.length === 0) return;

        if (filterDisciplina) {
            setFilteredAssuntos(assuntos.filter(a => a.disciplina_id === filterDisciplina));
        } else {
            setFilteredAssuntos(assuntos);
        }

        // If the selected assunto is not in the new list, reset it
        // Only verify if we have both filter and active discipline context
        if (filterAssunto && filterDisciplina) {
            const exists = assuntos.find(a => a.id === filterAssunto && a.disciplina_id === filterDisciplina);
            if (!exists) setFilterAssunto('');
        }
    }, [filterDisciplina, assuntos, filterAssunto]);

    const fetchAuxiliaryData = async () => {
        try {
            const [dRes, aRes, bRes] = await Promise.all([
                supabase.from('disciplinas').select('*').order('name'),
                supabase.from('assuntos').select('*').order('name'),
                supabase.from('bancas').select('*').order('name')
            ]);
            if (dRes.data) setDisciplinas(dRes.data);
            if (aRes.data) {
                setAssuntos(aRes.data);
                setFilteredAssuntos(aRes.data);
            }
            if (bRes.data) {
                const excludedBancas = ['Bora Passar Agora - Relax', 'Bora Passar Agora - Simulado'];
                setBancas(bRes.data.filter(b =>
                    !excludedBancas.includes(b.name) &&
                    !b.name.toUpperCase().includes('SIMULADOS - BPA')
                ));
            }
        } catch (error) {
            console.error('Error fetching filter data:', error);
        }
    };


    const fetchQuestions = async (pageNumber: number) => {
        if (pageNumber === 1) setLoading(true);
        const start = (pageNumber - 1) * pageSize;
        const end = start + pageSize - 1;

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                navigate('/login');
                return;
            }

            // 1. Fetch Resolved IDs for the user
            const { data: historyData } = await supabase
                .from('student_question_history')
                .select('question_id')
                .eq('student_id', user.id);

            const rIds = new Set(historyData?.map(h => h.question_id) || []);
            setResolvedIds(rIds);

            // 2. Build Query
            let query = supabase
                .from('questions')
                .select('*, disciplinas(name), bancas!inner(name, sigla), text_bases(content, title), assuntos(name)', { count: 'exact' });

            // Apply Filters
            if (filterDisciplina) query = query.eq('disciplina_id', filterDisciplina);
            if (filterAssunto) query = query.eq('assunto_id', filterAssunto);
            if (filterBanca) query = query.eq('banca_id', filterBanca);
            if (filterAno) query = query.eq('ano', filterAno);

            // Modalidade Filter
            if (filterModalidade === 'Certo/Errado') {
                query = query.eq('modalidade', 'Certo/Errado');
            } else if (filterModalidade === 'Multipla Escolha') {
                query = query.ilike('modalidade', '%Multipla Escolha%');
            }

            // Exclude Simulados and Relax
            query = query.not('bancas.name', 'ilike', '%SIMULADOS%BPA%')
                .neq('bancas.name', 'Bora Passar Agora - Relax')
                .neq('bancas.name', 'Bora Passar Agora - Simulado');

            // Status Filter (Resolved/Unresolved) - Note: Large scale this is bad, but for current scale usually okay.
            // Supabase doesn't support "NOT IN" with subquery easily in JS client without RPC.
            // We'll iterate. If 'resolved', we use .in(). If 'unresolved', we use .not.in().
            const idsArray = Array.from(rIds);
            if (filterStatus === 'resolved') {
                if (idsArray.length === 0) {
                    setQuestions([]);
                    setLoading(false);
                    return; // No resolved questions
                }
                query = query.in('id', idsArray);
            } else if (filterStatus === 'unresolved' && idsArray.length > 0) {
                // Warning: Passing huge array to URL param might fail if history is massive.
                // Ideally separate 'unresolved' logic or DB view. 
                // For now, assuming reasonable distinct valid questions.
                query = query.not('id', 'in', `(${idsArray.join(',')})`);
            }

            const { data, error, count } = await query
                .range(start, end)
                .order('created_at', { ascending: false });

            if (error) throw error;

            if (data) {
                if (pageNumber === 1) {
                    setQuestions(data as unknown as Questao[]);
                } else {
                    setQuestions(prev => [...prev, ...(data as unknown as Questao[])]);
                }
                setHasMore(data.length === pageSize);
            }
        } catch (e) {
            console.error('Error fetching questions:', e);
        } finally {
            setLoading(false);
        }
    };


    const loadMore = () => {
        const nextPage = page + 1;
        setPage(nextPage);
        fetchQuestions(nextPage);
    };

    const toggleFocus = () => {
        if (!document.fullscreenElement) {
            containerRef.current?.requestFullscreen().catch(err => {
                console.error(`Error: ${err.message}`);
            });
            setIsFocusMode(true);
        } else {
            document.exitFullscreen();
            setIsFocusMode(false);
        }
    };

    useEffect(() => {
        const handleFullscreenChange = () => {
            setIsFocusMode(!!document.fullscreenElement);
        };
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
    }, []);

    const handleQuestionAnswer = async (questionId: string, altId: string) => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // Check Limit before saving (Optimistic UI check)
            if (!dailyLimitStatus.is_premium && dailyLimitStatus.questions_today >= dailyLimitStatus.daily_limit) {
                setShowLimitPopup(true);
                return;
            }

            // Calculate correctness locally or wait? InteractiveQuestion knows internal state, 
            // but mapped IDs are 'questionId-idx'.
            // Let's assume passed altId is valid. 
            // We need to find the question object to check correctness.
            const question = questions.find(q => q.id === questionId);
            if (!question) return;

            const altIndex = parseInt(altId.split('-').pop() || '0');
            const isCorrect = question.alternativas[altIndex]?.isCorreta || false;

            // Insert into history
            await supabase.from('student_question_history').upsert({
                student_id: user.id,
                question_id: question.id,
                selected_alternative_index: altIndex,
                is_correct: isCorrect,
                created_at: new Date().toISOString() // Update timestamp to ensure daily limit counts this interaction
            }, { onConflict: 'student_id,question_id' });

            // Update local set to reflect 'resolved' immediately
            setResolvedIds(prev => new Set(prev).add(questionId));

            // Increment local count if not premium
            if (!dailyLimitStatus.is_premium) {
                setDailyLimitStatus(prev => ({ ...prev, questions_today: prev.questions_today + 1 }));
            }

        } catch (error) {
            console.error('Error saving answer history:', error);
        }
    };



    return (
        <div
            ref={containerRef}
            className={`min-h-screen transition-all duration-500 overflow-y-auto ${isFocusMode ? 'bg-white p-0' : 'bg-[#f6f7f9] p-4 md:p-12'}`}
        >
            {/* Vibrant Toolbar */}
            <div className={`flex items-center justify-between mx-auto max-w-5xl transition-all duration-500 ${isFocusMode ? 'fixed top-6 right-8 z-[100] gap-4' : 'mb-12'}`}>
                {!isFocusMode && (
                    <button
                        onClick={() => navigate(-1)}
                        className="size-12 flex items-center justify-center bg-white text-slate-400 hover:text-slate-900 transition-all rounded-2xl border border-slate-100 shadow-sm"
                    >
                        <span className="material-symbols-outlined">arrow_back</span>
                    </button>
                )}

                <div className={`flex items-center gap-3 ${isFocusMode ? '' : 'ml-auto'}`}>


                    <button
                        onClick={toggleFocus}
                        className={`size-12 flex items-center justify-center transition-all rounded-2xl border ${isFocusMode ? 'bg-[#137fec] text-white' : 'bg-white text-slate-400 border-slate-100'}`}
                        title="Modo Foco"
                    >
                        <span className="material-symbols-outlined">{isFocusMode ? 'close_fullscreen' : 'fullscreen'}</span>
                    </button>
                </div>
            </div>

            <div className="max-w-5xl mx-auto space-y-12">
                {/* Modern Filter Cluster */}
                {!isFocusMode && (
                    <div className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm space-y-8 animate-in slide-in-from-top-10 duration-700">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="size-10 bg-blue-50 text-[#137fec] rounded-xl flex items-center justify-center">
                                    <span className="material-symbols-outlined">tune</span>
                                </div>
                                <h3 className="text-[11px] font-black text-slate-900 uppercase tracking-[0.4em]">Laboratório de Questões</h3>
                            </div>
                            <span className="px-4 py-1.5 bg-slate-50 text-slate-400 text-[9px] font-black uppercase tracking-widest rounded-full">Base de Elite</span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
                            {/* Disciplina Filter */}
                            <div className="relative group md:col-span-1">
                                <select
                                    value={filterDisciplina}
                                    onChange={(e) => setFilterDisciplina(e.target.value)}
                                    className="w-full h-14 pl-6 pr-10 bg-slate-50 border-transparent rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-900 focus:bg-white focus:border-[#137fec] focus:ring-8 focus:ring-[#137fec]/5 transition-all outline-none appearance-none"
                                >
                                    <option value="">Todas as Disciplinas</option>
                                    {disciplinas.map(d => (
                                        <option key={d.id} value={d.id}>{d.name}</option>
                                    ))}
                                </select>
                                <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none group-hover:text-[#137fec] transition-colors">expand_more</span>
                            </div>

                            {/* Assunto Filter - Visible only if Disciplina selected */}
                            {filterDisciplina && (
                                <div className="relative group md:col-span-1">
                                    <select
                                        value={filterAssunto}
                                        onChange={(e) => setFilterAssunto(e.target.value)}
                                        className="w-full h-14 pl-6 pr-10 bg-slate-50 border-transparent rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-900 focus:bg-white focus:border-[#137fec] focus:ring-8 focus:ring-[#137fec]/5 transition-all outline-none appearance-none"
                                    >
                                        <option value="">Todos os Assuntos</option>
                                        {filteredAssuntos.map(a => (
                                            <option key={a.id} value={a.id}>{a.name}</option>
                                        ))}
                                    </select>
                                    <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none group-hover:text-[#137fec] transition-colors">expand_more</span>
                                </div>
                            )}

                            {/* Banca Filter */}
                            <div className="relative group md:col-span-1">
                                <select
                                    value={filterBanca}
                                    onChange={(e) => setFilterBanca(e.target.value)}
                                    className="w-full h-14 pl-6 pr-10 bg-slate-50 border-transparent rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-900 focus:bg-white focus:border-[#137fec] focus:ring-8 focus:ring-[#137fec]/5 transition-all outline-none appearance-none"
                                >
                                    <option value="">Todas as Bancas</option>
                                    {bancas.map(b => (
                                        <option key={b.id} value={b.id}>{b.name}</option>
                                    ))}
                                </select>
                                <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none group-hover:text-[#137fec] transition-colors">expand_more</span>
                            </div>

                            {/* Modalidade Filter */}
                            <div className="relative group md:col-span-1">
                                <select
                                    value={filterModalidade}
                                    onChange={(e) => setFilterModalidade(e.target.value)}
                                    className="w-full h-14 pl-6 pr-10 bg-slate-50 border-transparent rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-900 focus:bg-white focus:border-[#137fec] focus:ring-8 focus:ring-[#137fec]/5 transition-all outline-none appearance-none"
                                >
                                    <option value="">Modalidade</option>
                                    <option value="Multipla Escolha">Múltipla Escolha</option>
                                    <option value="Certo/Errado">Certo/Errado</option>
                                </select>
                                <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none group-hover:text-[#137fec] transition-colors">expand_more</span>
                            </div>

                            {/* Status Filter */}
                            <div className="relative group md:col-span-1">
                                <select
                                    value={filterStatus}
                                    onChange={(e) => setFilterStatus(e.target.value)}
                                    className="w-full h-14 pl-6 pr-10 bg-slate-50 border-transparent rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-900 focus:bg-white focus:border-[#137fec] focus:ring-8 focus:ring-[#137fec]/5 transition-all outline-none appearance-none"
                                >
                                    <option value="all">Todas as Questões</option>
                                    <option value="resolved">Resolvidas</option>
                                    <option value="unresolved">Não Resolvidas</option>
                                </select>
                                <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none group-hover:text-[#137fec] transition-colors">expand_more</span>
                            </div>

                            {/* Ano Filter */}
                            <div className="relative group md:col-span-1">
                                <select
                                    value={filterAno}
                                    onChange={(e) => setFilterAno(e.target.value)}
                                    className="w-full h-14 pl-6 pr-10 bg-slate-50 border-transparent rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-900 focus:bg-white focus:border-[#137fec] focus:ring-8 focus:ring-[#137fec]/5 transition-all outline-none appearance-none"
                                >
                                    <option value="">Ano</option>
                                    {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - i).map(y => (
                                        <option key={y} value={y}>{y}</option>
                                    ))}
                                </select>
                                <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none group-hover:text-[#137fec] transition-colors">expand_more</span>
                            </div>
                        </div>
                    </div>
                )}

                {/* Questions Feed */}
                <div className="space-y-12 pb-24">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-24 gap-4">
                            <div className="size-10 border-4 border-slate-100 border-t-[#137fec] rounded-full animate-spin"></div>
                            <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest italic">Sincronizando Banco de Questões...</p>
                        </div>
                    ) : questions.length === 0 ? (
                        <div className="text-center py-24 bg-white rounded-[40px] border border-dashed border-slate-100">
                            <span className="material-symbols-outlined text-6xl text-slate-100 mb-4">inventory_2</span>
                            <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Nenhuma questão encontrada com estes filtros.</p>
                        </div>
                    ) : questions.map((q) => (
                        <div key={q.id}>


                            <InteractiveQuestion
                                question={{
                                    id: q.id,
                                    enunciado: q.enunciado,
                                    texto_base: q.texto_base,
                                    text_bases: q.text_bases,
                                    alternativas: (q.alternativas || []).map((alt, i) => ({
                                        id: `${q.id}-${i}`,
                                        texto: alt.texto,
                                        isCorreta: alt.isCorreta
                                    })),
                                    resposta_professor: q.resposta_professor,
                                    bancas: q.bancas,
                                    disciplinas: q.disciplinas,
                                    assuntos: q.assuntos,
                                    ano: q.ano
                                }}
                                // Removing disabled prop to allow click interception
                                onBeforeAnswer={() => {
                                    if (!dailyLimitStatus.is_premium && dailyLimitStatus.questions_today >= dailyLimitStatus.daily_limit) {
                                        setShowLimitPopup(true);
                                        return false; // Block answering
                                    }
                                    return true; // Allow answering
                                }}
                                onAnswer={(altId) => handleQuestionAnswer(q.id, altId)}
                            />
                        </div>
                    ))}

                    {hasMore && !loading && questions.length > 0 && (
                        <div className="flex justify-center pt-8">
                            <button
                                onClick={loadMore}
                                className="px-8 py-3 bg-white border border-slate-200 text-slate-600 rounded-2xl font-bold hover:bg-slate-50 hover:text-[#137fec] transition-all shadow-sm"
                            >
                                Carregar Mais Questões
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Daily Limit Popup */}
            {showLimitPopup && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-slate-900/80 backdrop-blur-md animate-in fade-in duration-300">
                    <div className="bg-white p-10 rounded-[40px] shadow-3xl max-w-md w-full text-center space-y-6 animate-in zoom-in-95 duration-300 relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-[#137fec] to-[#ff3b9a]"></div>

                        <div className="size-20 bg-amber-50 text-amber-500 rounded-3xl flex items-center justify-center mx-auto mb-4">
                            <span className="material-symbols-outlined text-4xl font-black">lock</span>
                        </div>

                        <div className="space-y-4">
                            <h2 className="text-3xl font-black text-slate-900 uppercase italic tracking-tighter leading-none">
                                Limite Diário <br />
                                <span className="text-amber-500">Atingido!</span>
                            </h2>
                            <p className="text-slate-500 font-medium leading-relaxed">
                                Você atingiu o limite de {dailyLimitStatus.daily_limit} questões gratuitas por dia. Para continuar treinando sem limites e garantir sua aprovação, torne-se um aluno Premium.
                            </p>
                        </div>

                        <div className="space-y-3 pt-4">
                            <button
                                onClick={() => navigate('/aluno/catalogo')}
                                className="w-full py-5 bg-slate-900 text-white rounded-[24px] font-black uppercase tracking-widest hover:bg-[#137fec] transition-all shadow-xl hover:scale-105 active:scale-95 flex items-center justify-center gap-2"
                            >
                                <span className="material-symbols-outlined">workspace_premium</span>
                                Liberar Acesso Ilimitado
                            </button>
                            <button
                                onClick={() => setShowLimitPopup(false)}
                                className="w-full py-4 text-slate-400 font-bold uppercase tracking-widest text-[10px] hover:text-slate-600 transition-colors"
                            >
                                Voltar e descansar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default QuestionsStudent;