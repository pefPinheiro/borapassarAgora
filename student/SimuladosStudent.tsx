
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Simulado, Questao } from '../types';

const SimuladosStudent: React.FC = () => {
    const { id } = useParams();
    const navigate = useNavigate();

    const [simulado, setSimulado] = useState<Simulado | null>(null);
    const [questions, setQuestions] = useState<Questao[]>([]);
    const [status, setStatus] = useState<'loading' | 'ready' | 'running' | 'finished'>('loading');
    const [isFocusMode, setIsFocusMode] = useState(false);
    const [timeLeft, setTimeLeft] = useState(0);
    const [userAnswers, setUserAnswers] = useState<Record<string, number | null>>({});
    const [disciplineWeights, setDisciplineWeights] = useState<Record<string, number>>({});
    const [showReview, setShowReview] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const [courseInfo, setCourseInfo] = useState<{ title: string; banner?: string } | null>(null);

    useEffect(() => {
        if (id) fetchSimuladoData();
    }, [id]);

    const fetchSimuladoData = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                navigate('/login');
                return;
            }

            // 0. Check Access
            const { data: courseLinks } = await supabase
                .from('course_simulados')
                .select('course_id')
                .eq('simulado_id', id);
            
            const courseIds = courseLinks?.map(cl => cl.course_id) || [];
            
            const { data: enrollmentData } = await supabase
                .from('enrollments')
                .select('status')
                .eq('profile_id', user.id)
                .in('course_id', courseIds)
                .eq('status', 'Ativo')
                .limit(1)
                .maybeSingle();

            if (!enrollmentData) {
                const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
                if (!['admin', 'super', 'teacher', 'editor', 'moderator', 'collaborator'].includes(profile?.role)) {
                    console.error('Sem acesso ao simulado: Matrícula não ativa.');
                    alert('Você não tem uma matrícula ativa em um curso que ofereça este simulado.');
                    navigate('/aluno/cursos');
                    return;
                }
            }

            const { data: sData, error: sError } = await supabase
                .from('simulados')
                .select('*')
                .eq('id', id)
                .single();

            if (sError) throw sError;
            setSimulado(sData);
            setTimeLeft(sData.duration * 60);

            // Fetch course info tied to this simulado (take the first one found)
            const { data: cData } = await supabase
                .from('course_simulados')
                .select('courses(title, banner_url)')
                .eq('simulado_id', id)
                .limit(1)
                .maybeSingle();

            if (cData?.courses) {
                // @ts-ignore
                setCourseInfo({ title: cData.courses.title, banner: cData.courses.banner_url });
            }

            const { data: qData, error: qError } = await supabase
                .from('simulado_questions')
                .select(`
                    question_id,
                    position,
                    section,
                    questao:questions (
                        *,
                        alternativas,
                        bancas (name),
                        disciplinas (name),
                        text_bases (content)
                    )
                `)
                .eq('simulado_id', id)
                .order('position', { ascending: true });

            if (qError) throw qError;

            // Fetch Weights
            const { data: wData } = await supabase
                .from('simulado_disciplina_weights')
                .select('*')
                .eq('simulado_id', id);

            const wMap: Record<string, number> = {};
            if (wData) wData.forEach((w: any) => wMap[w.disciplina_id] = w.weight);
            setDisciplineWeights(wMap);

            // Map correctly to Questao objects
            const qs = qData.map(item => ({ ...(item.questao as any), section: item.section }));
            setQuestions(qs);
            setStatus('ready');
        } catch (error) {
            console.error('Error fetching simulado data:', error);
            alert('Erro ao carregar simulado');
            navigate(-1);
        }
    };

    const handlePrint = () => {
        window.print();
    };

    const handleFinish = async () => {
        const { correct, wrong, blank, netScore } = calculateScore();

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (user && simulado) {
                await supabase.from('student_simulado_attempts').insert({
                    student_id: user.id,
                    simulado_id: simulado.id,
                    correct,
                    wrong,
                    blank,
                    net_score: parseFloat(netScore)
                });
            }
        } catch (error) {
            console.error('Error saving attempt:', error);
            alert('Erro ao salvar resultado do simulado. Verifique se o banco de dados está atualizado (Tabela student_simulado_attempts).');
        }

        setStatus('finished');
    };

    useEffect(() => {
        let timer: any;
        if (status === 'running' && timeLeft > 0) {
            timer = setInterval(() => {
                setTimeLeft(prev => prev - 1);
            }, 1000);
        } else if (status === 'running' && timeLeft === 0) {
            handleFinish();
        }
        return () => clearInterval(timer);
    }, [status, timeLeft]);

    const formatTime = (seconds: number) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
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

    const handleAnswer = (questionId: string, optionIndex: number) => {
        if (status !== 'running') return;
        setUserAnswers(prev => ({ ...prev, [questionId]: optionIndex }));
    };

    const calculateScore = () => {
        let correct = 0;
        let wrong = 0;
        let blank = 0;

        let weightedCorrect = 0;

        questions.forEach(q => {
            const answer = userAnswers[q.id];
            const weight = disciplineWeights[q.disciplina_id] || 1;

            if (answer === undefined || answer === null) {
                blank++;
            } else {
                const correctIdx = q.alternativas.findIndex(a => a.isCorreta);
                if (answer === correctIdx) {
                    correct++;
                    weightedCorrect += weight;
                } else {
                    wrong++;
                }
            }
        });

        const penaltyValue = simulado?.penalty || 0;
        const netScore = Math.max(0, weightedCorrect - (wrong * penaltyValue));

        return { correct, wrong, blank, netScore: netScore.toFixed(2) };
    };

    const stats = calculateScore();

    if (status === 'loading') return <div className="min-h-screen flex items-center justify-center">Carregando Simulado...</div>;

    if (status === 'ready') {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
                <div className="max-w-xl w-full bg-white rounded-[2.5rem] border border-slate-200 shadow-2xl p-12 text-center animate-in zoom-in-95 duration-500">
                    <div className="size-24 bg-blue-500/10 rounded-3xl flex items-center justify-center text-blue-600 mx-auto mb-8">
                        <span className="material-symbols-outlined text-5xl">assignment</span>
                    </div>
                    <h1 className="text-3xl font-black text-slate-900 mb-4 tracking-tight">{simulado?.title}</h1>
                    <div className="flex flex-col gap-2 mb-10">
                        <p className="text-slate-500 font-medium leading-relaxed">
                            Você terá <span className="text-slate-900 font-bold">{simulado?.duration} minutos</span> para realizar este simulado.
                        </p>
                        {simulado && simulado.penalty > 0 && (
                            <div className="p-3 bg-red-50 text-red-600 rounded-xl text-xs font-black uppercase tracking-widest">
                                ⚠️ Atenção: Penalidade de {simulado.penalty} pontos por erro.
                            </div>
                        )}
                        <p className="text-xs text-slate-400 font-bold mt-2">{questions.length} Questões</p>
                    </div>

                    {/* Discipline Weights Breakdown */}
                    {Object.keys(disciplineWeights).length > 0 && (
                        <div className="bg-slate-50 border border-slate-100 rounded-2xl p-6 mb-8 text-left max-h-60 overflow-y-auto custom-scrollbar">
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4 text-center">Distribuição de Pontos</p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {Array.from(new Set(questions.map(q => q.disciplina_id))).filter(Boolean).map(dId => {
                                    const discName = questions.find(q => q.disciplina_id === dId)?.disciplinas?.name || 'Geral';
                                    const weight = disciplineWeights[dId] || 1;
                                    return (
                                        <div key={dId} className="flex justify-between items-center bg-white px-3 py-2 rounded-xl border border-slate-200 shadow-sm">
                                            <span className="text-[10px] font-bold text-slate-700 truncate max-w-[70%] uppercase">{discName}</span>
                                            <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded">{weight} pts</span>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    )}

                    <div className="space-y-4">
                        <button
                            onClick={() => setStatus('running')}
                            className="w-full py-5 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest hover:scale-[1.02] transition-all shadow-xl"
                        >
                            Começar Agora
                        </button>
                        <button
                            onClick={() => navigate(-1)}
                            className="w-full py-5 bg-white text-slate-400 border border-slate-100 rounded-2xl font-bold uppercase tracking-widest hover:text-slate-900 transition-colors"
                        >
                            Voltar
                        </button>
                    </div>
                </div>

                {/* Hidden Print Container for Ready State (Optional, mostly for when running) */}
            </div>
        );
    }

    return (
        <div
            ref={containerRef}
            className={`min-h-screen transition-all duration-500 overflow-y-auto ${isFocusMode ? 'bg-white p-0' : 'bg-[#f8fafc] p-0'} print:bg-white`}
        >
            <header className={`no-print sticky top-0 bg-white/80 backdrop-blur-xl border-b border-slate-200 z-[100] transition-all duration-500 ${isFocusMode ? 'px-8 py-3' : 'px-8 md:px-20 py-4'}`}>
                <div className="max-w-6xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-6">
                        <h2 className="text-xl font-black text-[#111418] leading-none">{simulado?.title}</h2>
                    </div>

                    {status === 'running' && (
                        <div className="flex flex-col items-center">
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Tempo Restante</p>
                            <p className={`text-lg font-black tabular-nums transition-colors ${timeLeft < 300 ? 'text-red-500 animate-pulse' : 'text-slate-900'}`}>
                                {formatTime(timeLeft)}
                            </p>
                        </div>
                    )}

                    <div className="flex items-center gap-2">
                        <button onClick={handlePrint} className="hidden md:flex items-center justify-center size-9 rounded-lg border bg-white text-slate-400 border-slate-200 hover:text-blue-500">
                            <span className="material-symbols-outlined text-lg">print</span>
                        </button>
                        <button onClick={toggleFocus} className={`size-9 flex items-center justify-center rounded-lg border ${isFocusMode ? 'bg-slate-900 text-white' : 'bg-white text-slate-400 border-slate-200'}`}>
                            <span className="material-symbols-outlined text-lg">{isFocusMode ? 'fullscreen_exit' : 'fullscreen'}</span>
                        </button>
                        {status === 'running' && (
                            <button onClick={handleFinish} className="px-5 h-9 bg-red-500 text-white text-[10px] font-black uppercase rounded-lg">Finalizar</button>
                        )}
                        {status === 'finished' && (
                            <button onClick={() => navigate(-1)} className="px-5 h-9 bg-slate-900 text-white text-[10px] font-black uppercase rounded-lg">Sair</button>
                        )}
                    </div>
                </div>
                {status === 'running' && (
                    <div className="absolute bottom-0 left-0 w-full h-[2px] bg-slate-100">
                        <div
                            className="h-full bg-blue-500 transition-all duration-500"
                            style={{ width: `${(Object.keys(userAnswers).length / questions.length) * 100}%` }}
                        ></div>
                    </div>
                )}
            </header>

            <main className="max-w-4xl mx-auto py-8 px-6 md:py-12 print:max-w-none print:p-0 print:mx-0">
                {/* Print Header */}
                <div className="hidden print:block mb-8 border-b-2 border-black pb-4">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-4">
                            {/* Logo */}
                            <div className="size-12 bg-black text-white flex items-center justify-center rounded-lg font-black text-xs">BPA</div>
                            <div>
                                <h1 className="text-xl font-black uppercase tracking-tighter">Bora Passar</h1>
                                <p className="text-sm font-bold uppercase tracking-widest text-slate-500">Concursos Públicos</p>
                            </div>
                        </div>
                        <div className="text-right">
                            {courseInfo?.title && (
                                <h2 className="text-lg font-black uppercase tracking-tight">{courseInfo.title}</h2>
                            )}
                            <p className="text-sm font-bold uppercase text-slate-900">{simulado?.title || 'Simulado Oficial'}</p>
                            <p className="text-xs font-medium uppercase text-slate-500">{new Date().toLocaleDateString()}</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 border border-black p-4 mb-4">
                        <div className="space-y-1">
                            <p className="text-xs font-black uppercase tracking-widest">Simulado</p>
                            <p className="text-sm font-bold">{simulado?.title}</p>
                        </div>
                        <div className="space-y-1">
                            <p className="text-xs font-black uppercase tracking-widest">Aluno(a)</p>
                            <div className="border-b border-black border-dashed h-4 w-full"></div>
                        </div>
                    </div>

                    <div className="flex justify-between items-center text-xs font-bold uppercase tracking-widest border-t border-dashed border-slate-300 pt-2">
                        <span>Tempo: {simulado?.duration} min</span>
                        <span>Questões: {questions.length}</span>
                        {simulado?.penalty && simulado.penalty > 0 && <span>Obs: Penalidade de {simulado.penalty} por erro</span>}
                    </div>
                </div>

                {status === 'finished' && !showReview && (
                    <div className="bg-white rounded-[2rem] border border-slate-200 shadow-xl p-10 text-center animate-in scale-in-center print:hidden">
                        <p className="text-[10px] font-black text-blue-500 uppercase tracking-tighter mb-2">Simulado Finalizado</p>
                        <h2 className="text-3xl font-black text-slate-900 mb-8">{simulado?.title}</h2>

                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
                            {[
                                { label: 'Certas', val: stats.correct, color: 'text-emerald-500' },
                                { label: 'Erradas', val: stats.wrong, color: 'text-red-500' },
                                { label: 'Em Branco', val: stats.blank, color: 'text-slate-400' },
                                { label: 'Nota Líquida', val: stats.netScore, color: 'text-blue-600 bg-blue-50 rounded-2xl' }
                            ].map(s => (
                                <div key={s.label} className="p-6 rounded-3xl border border-slate-100 flex flex-col items-center">
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">{s.label}</p>
                                    <p className={`text-3xl font-black ${s.color} px-4 py-2`}>{s.val}</p>
                                </div>
                            ))}
                        </div>

                        <button
                            onClick={() => setShowReview(true)}
                            className="bg-blue-600 text-white px-10 py-4 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-blue-700 transition-all shadow-xl shadow-blue-100"
                        >
                            Revisar Respostas
                        </button>
                    </div>
                )}

                {(status === 'running' || showReview) && (
                    <div className="space-y-12 print:space-y-8">
                        {questions.map((q, idx) => {
                            const selected = userAnswers[q.id];
                            const correctIdx = q.alternativas.findIndex(a => a.isCorreta);
                            const isCorrect = selected === correctIdx;

                            // Check if text base should be shown (if it exists and differs from previous)
                            const textBaseContent = q.texto_base || (q as any).text_bases?.content;
                            const prevQ = questions[idx - 1];
                            const prevTextBaseContent = prevQ ? (prevQ.texto_base || (prevQ as any).text_bases?.content) : null;
                            const showTextBase = textBaseContent && (!prevQ || prevTextBaseContent !== textBaseContent);

                            return (
                                <div key={q.id} className="relative group break-inside-avoid">
                                    {(q as any).section && (
                                        <div className="mb-10 mt-16 pb-4 border-b-2 border-slate-200 print:border-black print:mt-12 print:mb-6 flex items-center gap-4">
                                            <div className="size-10 rounded-xl bg-slate-900 text-white flex items-center justify-center print:hidden">
                                                <span className="material-symbols-outlined">menu_book</span>
                                            </div>
                                            <h2 className="text-2xl font-black text-slate-900 uppercase tracking-widest print:text-black print:text-xl">
                                                {(q as any).section}
                                            </h2>
                                        </div>
                                    )}
                                    {showTextBase && (
                                        <div className="mb-6 p-6 bg-slate-50 border-l-4 border-slate-900 print:bg-transparent print:border-l-2 print:border-black print:p-0 print:pl-4 print:mb-4 break-inside-avoid">
                                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 print:text-black">Texto Base para as questões a seguir</p>
                                            <div className="text-sm font-medium text-slate-700 leading-relaxed text-justify print:text-black break-words whitespace-pre-wrap [&_*]:max-w-full" dangerouslySetInnerHTML={{ __html: textBaseContent || '' }}></div>
                                        </div>
                                    )}

                                    <div className="absolute -left-12 top-0 text-slate-200 font-black text-5xl group-hover:text-blue-100 transition-colors select-none print:static print:text-black print:text-lg print:mb-2 pointer-events-none">
                                        <span className="hidden print:inline mr-2">Questão</span>
                                        {idx + 1}
                                    </div>
                                    <div className={`bg-white rounded-3xl p-8 border ${showReview ? (isCorrect ? 'border-emerald-100 bg-emerald-50/10' : 'border-red-100 bg-red-50/10') : 'border-slate-200 shadow-sm'} print:border-none print:shadow-none print:p-0`}>
                                        <div className="flex flex-wrap gap-2 mb-6 print:hidden">
                                            <span className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded font-black text-[9px] uppercase tracking-widest">{q.bancas?.name}</span>
                                            <span className="px-2 py-0.5 bg-blue-50 text-blue-500 rounded font-black text-[9px] uppercase tracking-widest">{q.disciplinas?.name}</span>
                                            <span className="px-2 py-0.5 bg-amber-50 text-amber-600 rounded font-black text-[9px] uppercase tracking-widest">
                                                Valendo {disciplineWeights[q.disciplina_id] || 1} pts
                                            </span>
                                            {showReview && (
                                                <span className={`px-2 py-0.5 rounded font-black text-[9px] uppercase tracking-widest ${isCorrect ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'}`}>
                                                    {isCorrect ? 'Acertou' : 'Errou'}
                                                </span>
                                            )}
                                        </div>

                                        <div className="text-xl font-bold text-slate-900 leading-tight mb-8 break-words whitespace-pre-wrap [&_*]:max-w-full print:text-base print:mb-4" dangerouslySetInnerHTML={{ __html: q.enunciado }} />

                                        <div className="space-y-3 print:space-y-1">
                                            {q.alternativas.map((alt, i) => {
                                                const isSelected = selected === i;
                                                const isAltCorrect = alt.isCorreta;

                                                let variant = "default";
                                                if (isSelected) variant = "selected";
                                                if (showReview) {
                                                    if (isAltCorrect) variant = "correct";
                                                    else if (isSelected) variant = "wrong";
                                                    else variant = "disabled";
                                                }

                                                return (
                                                    <button
                                                        key={i}
                                                        disabled={status === 'finished'}
                                                        onClick={() => handleAnswer(q.id, i)}
                                                        className={`w-full p-5 rounded-2xl border text-left text-sm font-bold flex gap-4 items-center transition-all print:border-none print:p-1 print:bg-transparent print:shadow-none ${variant === 'selected' ? 'bg-slate-900 text-white border-slate-900 shadow-xl print:text-black' :
                                                            variant === 'correct' ? 'bg-emerald-500 text-white border-emerald-500 shadow-lg print:text-black' :
                                                                variant === 'wrong' ? 'bg-red-500 text-white border-red-500 opacity-80 print:text-black' :
                                                                    variant === 'disabled' ? 'bg-white opacity-40 border-slate-100 text-slate-300 print:hidden' :
                                                                        'bg-white text-slate-600 border-slate-200 hover:border-blue-500/30'
                                                            }`}
                                                    >
                                                        <div className={`size-8 rounded-xl border flex items-center justify-center font-black text-xs shrink-0 ${variant === 'selected' || variant === 'correct' || variant === 'wrong' ? 'border-white/20' : 'border-slate-100 bg-slate-50'} print:border-black print:bg-transparent print:size-6 print:rounded-full print:text-black`}>
                                                            {String.fromCharCode(65 + i)}
                                                        </div>
                                                        <span className="break-words [&_*]:max-w-full print:text-sm" dangerouslySetInnerHTML={{ __html: alt.texto }} />
                                                    </button>
                                                );
                                            })}
                                        </div>

                                        {showReview && q.resposta_professor && (
                                            <div className="mt-8 pt-8 border-t border-slate-100 print:hidden">
                                                <div className="flex items-center gap-2 mb-4 text-[#137fec]">
                                                    <span className="material-symbols-outlined text-lg">psychology</span>
                                                    <p className="text-[10px] font-black uppercase tracking-widest">Comentário do Especialista</p>
                                                </div>
                                                <div className="text-sm font-medium text-slate-600 italic leading-relaxed break-words [&_*]:max-w-full" dangerouslySetInnerHTML={{ __html: q.resposta_professor }} />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </main>
        </div>
    );
};

export default SimuladosStudent;
