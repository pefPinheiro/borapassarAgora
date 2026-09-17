import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Simulado, Questao } from '../types';
import katex from 'katex';
import 'katex/dist/katex.min.css';

const cleanLatex = (tex: string) => {
    return tex
        .replace(/&amp;/gi, '&')
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/<br\s*\/?>/gi, ' ')
        .replace(/<\/?(?:p|div|br|span|strong|b|em|i|u|s|h[1-6]|ol|ul|li|pre|code|font)\b[^>]*?>/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim();
};

const processMath = (text: string) => {
    if (!text) return '';
    return text
        .replace(/<code>([\s\S]*?\\(?:frac|sqrt|cdot|times|sum|int|align|begin|quad|implies|iff|neg|lor|land)[\s\S]*?)<\/code>/gi, '$1')
        .replace(/\$\$([\s\S]*?)\$\$/g, (_, tex) => {
            try {
                return katex.renderToString(cleanLatex(tex).replace(/\\\\/g, '\\'), { displayMode: true, throwOnError: false });
            } catch { return _; }
        })
        .replace(/\\\[([\s\S]*?)\\\]/g, (_, tex) => {
            try {
                return katex.renderToString(cleanLatex(tex).replace(/\\\\/g, '\\'), { displayMode: true, throwOnError: false });
            } catch { return _; }
        })
        .replace(/\\\(([\s\S]*?)\\\)/g, (_, tex) => {
            try {
                return katex.renderToString(cleanLatex(tex).replace(/\\\\/g, '\\'), { displayMode: false, throwOnError: false });
            } catch { return _; }
        })
        .replace(/\$([^\n\$]+?)\$/g, (_, tex) => {
            if (/[\\^_\{\}\+\=\-\/\(\)]/.test(tex)) {
                try {
                    return katex.renderToString(cleanLatex(tex).replace(/\\\\/g, '\\'), { displayMode: false, throwOnError: false });
                } catch { return _; }
            }
            return _;
        })
        .replace(/\\begin\{array\}([\s\S]*?)\\end\{array\}/gi, (match) => {
            try {
                return katex.renderToString(cleanLatex(match).replace(/\\\\/g, '\\'), { displayMode: true, throwOnError: false });
            } catch { return match; }
        });
};

const processMarkdown = (text: string) => {
    let processed = text;

    // Advanced Markdown Tables
    const potentialTableBlockRegex = /((?:(?:<p>|<div>)?\s*(?:(?!<\/?(?:p|div)).)*?\|.*?(?:\s*|<\/p>|<\/div>|<br\s*\/?>)*){2,})/gi;
    processed = processed.replace(potentialTableBlockRegex, (block) => {
        if (block.includes('\\begin') || block.includes('\\end')) return block;

        const lines = block
            .replace(/<(?:p|div|br\s*\/?)>/gi, '\n')
            .replace(/<\/(?:p|div)>/gi, '\n')
            .split('\n')
            .map(l => l.trim())
            .filter(l => l.includes('|'));

        if (lines.length < 2) return block;

        const parseMarkdownRow = (line: string) => {
            let cleaned = line.trim();
            if (cleaned.startsWith('|')) cleaned = cleaned.slice(1);
            if (cleaned.endsWith('|')) cleaned = cleaned.slice(0, -1);
            const parts: string[] = [];
            let current = '';
            for (let i = 0; i < cleaned.length; i++) {
                if (cleaned[i] === '|' && (i === 0 || cleaned[i - 1] !== '\\')) {
                    parts.push(current.trim());
                    current = '';
                } else {
                    current += cleaned[i];
                }
            }
            parts.push(current.trim());
            return parts.map(p => p.replace(/\\\|/g, '|'));
        };

        const headerRow = parseMarkdownRow(lines[0]);
        const dividerRow = parseMarkdownRow(lines[1]);
        const isDivider = dividerRow.every(c => /^[|:\s-]+$/.test(c)) && dividerRow.some(c => c.includes('-'));
        if (!isDivider) return block;

        const alignments = dividerRow.map(c => {
            const start = c.startsWith(':');
            const end = c.endsWith(':');
            if (start && end) return 'center';
            if (end) return 'right';
            return 'left';
        });

        const bodyRows = lines.slice(2).map(parseMarkdownRow);

        let html = '<div class="table-container my-3 overflow-x-auto"><table class="w-full border-collapse text-xs"><thead><tr class="border-b-2 border-black">';
        headerRow.forEach((h, i) => {
            const align = alignments[i] || 'left';
            html += `<th class="p-2 font-black uppercase text-${align} border border-slate-300 bg-slate-100">${h}</th>`;
        });
        html += '</tr></thead><tbody>';

        bodyRows.forEach(row => {
            if (row.length === 0 || (row.length === 1 && row[0] === '')) return;
            html += '<tr class="border-b border-slate-200">';
            for (let i = 0; i < headerRow.length; i++) {
                const align = alignments[i] || 'left';
                html += `<td class="p-2 border border-slate-200 text-${align}">${row[i] || ''}</td>`;
            }
            html += '</tr>';
        });

        html += '</tbody></table></div>';
        return html;
    });

    processed = processed.replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>');
    processed = processed.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

    return processed;
};

const processAll = (text: string) => {
    if (!text) return '';
    let processed = processMath(text);
    processed = processMarkdown(processed);
    return processed;
};

const SimuladosStudent: React.FC = () => {
    const { id } = useParams();
    const [searchParams] = useSearchParams();
    const courseIdParam = searchParams.get('courseId');
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

    const [studentProfile, setStudentProfile] = useState<{ full_name: string; cpf: string } | null>(null);
    const [courseInfo, setCourseInfo] = useState<{ title: string; banner?: string } | null>(null);

    useEffect(() => {
        if (id) fetchSimuladoData();
    }, [id, courseIdParam]);

    const fetchSimuladoData = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                navigate('/login');
                return;
            }

            // Fetch student profile for cover & answer sheet
            const { data: profile } = await supabase
                .from('profiles')
                .select('full_name, cpf, role')
                .eq('id', user.id)
                .maybeSingle();

            if (profile) {
                setStudentProfile({
                    full_name: profile.full_name || '',
                    cpf: profile.cpf || ''
                });
            }

            // 0. Check Access & Courses linked to this simulado
            const { data: courseLinks } = await supabase
                .from('course_simulados')
                .select('course_id, courses(id, title, banner_url)')
                .eq('simulado_id', id);

            const courseIds = courseLinks?.map(cl => cl.course_id).filter(Boolean) || [];

            let activeEnrollments: any[] = [];
            if (courseIds.length > 0) {
                const { data: enrolls } = await supabase
                    .from('enrollments')
                    .select('course_id, status, courses(id, title, banner_url)')
                    .eq('profile_id', user.id)
                    .in('course_id', courseIds)
                    .eq('status', 'Ativo');
                activeEnrollments = enrolls || [];
            }

            const isStaff = ['admin', 'super', 'teacher', 'editor', 'moderator', 'collaborator'].includes(profile?.role || '');

            if (!isStaff && activeEnrollments.length === 0) {
                console.error('Sem acesso ao simulado: Matrícula não ativa.');
                alert('Você não tem uma matrícula ativa em um curso que ofereça este simulado.');
                navigate('/aluno/cursos');
                return;
            }

            const { data: sData, error: sError } = await supabase
                .from('simulados')
                .select('*')
                .eq('id', id)
                .single();

            if (sError) throw sError;
            setSimulado(sData);
            setTimeLeft(sData.duration * 60);

            // 1. Resolve exact course info
            let selectedCourse: { id?: string; title?: string; banner_url?: string } | null = null;

            // Priority A: Explicit ?courseId= from the active course view
            if (courseIdParam) {
                const { data: paramCourse } = await supabase
                    .from('courses')
                    .select('id, title, banner_url')
                    .eq('id', courseIdParam)
                    .maybeSingle();

                if (paramCourse) {
                    selectedCourse = paramCourse;
                }
            }

            // Priority B: Course where user is actively enrolled
            if (!selectedCourse && activeEnrollments.length > 0) {
                const matched = activeEnrollments[0];
                if (matched?.courses) {
                    selectedCourse = matched.courses as any;
                }
            }

            // Priority C: Fallback to first course link
            if (!selectedCourse && courseLinks && courseLinks.length > 0) {
                const first = courseLinks[0];
                if (first?.courses) {
                    selectedCourse = first.courses as any;
                }
            }

            if (selectedCourse) {
                setCourseInfo({
                    title: selectedCourse.title || '',
                    banner: selectedCourse.banner_url || undefined
                });
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
                        bancas (name, sigla),
                        disciplinas (name),
                        text_bases (content, title)
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
            alert('Erro ao salvar resultado do simulado.');
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
                const correctIdx = q.alternativas?.findIndex(a => a.isCorreta);
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

    // Compute optimized columns for the Answer Sheet (Cartão-Resposta) to fit UP TO 120 questions on 1 single page
    const totalQuestions = questions.length;
    let numColumns = 2;
    if (totalQuestions > 90) numColumns = 5;
    else if (totalQuestions > 60) numColumns = 4;
    else if (totalQuestions > 30) numColumns = 3;

    const itemsPerCol = Math.ceil(totalQuestions / (numColumns || 1));
    const answerSheetColumns = Array.from({ length: numColumns }, (_, colIdx) => {
        const start = colIdx * itemsPerCol;
        const end = Math.min(start + itemsPerCol, totalQuestions);
        return questions.slice(start, end).map((q, qIndexInSlice) => ({
            question: q,
            globalNumber: start + qIndexInSlice + 1
        }));
    });

    if (status === 'loading') {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 gap-4">
                <div className="size-12 border-4 border-slate-300 border-t-slate-900 rounded-full animate-spin"></div>
                <p className="text-sm font-black text-slate-700 uppercase tracking-widest">Carregando Simulado...</p>
            </div>
        );
    }

    return (
        <div
            ref={containerRef}
            className={`min-h-screen transition-all duration-500 overflow-y-auto ${isFocusMode ? 'bg-white p-0' : 'bg-[#f8fafc] p-0'} print:bg-white print:p-0`}
        >
            {/* Print Styling Sheet */}
            <style>{`
                @media print {
                    @page {
                        size: A4 portrait;
                        margin: 8mm 8mm 10mm 8mm;
                    }
                    * {
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                    body {
                        background: #ffffff !important;
                        color: #000000 !important;
                        font-family: 'Plus Jakarta Sans', 'Segoe UI', Arial, sans-serif !important;
                        font-size: 9pt !important;
                        line-height: 1.4 !important;
                    }
                    .no-print {
                        display: none !important;
                    }
                    .print-only {
                        display: block !important;
                    }
                    .print-page-break {
                        page-break-after: always !important;
                        break-after: page !important;
                    }
                    .print-page-break-before {
                        page-break-before: always !important;
                        break-before: page !important;
                    }
                    .print-avoid-break {
                        break-inside: avoid !important;
                        page-break-inside: avoid !important;
                    }
                }
                @media screen {
                    .print-only {
                        display: none !important;
                    }
                }
            `}</style>

            {/* SCREEN VIEW: Ready Screen (Start Screen) */}
            {status === 'ready' && (
                <div className="no-print min-h-screen bg-slate-50 flex items-center justify-center p-6">
                    <div className="max-w-xl w-full bg-white rounded-[2.5rem] border border-slate-200 shadow-2xl p-10 md:p-12 text-center animate-in zoom-in-95 duration-500">
                        <div className="size-20 bg-blue-500/10 rounded-3xl flex items-center justify-center text-blue-600 mx-auto mb-6">
                            <span className="material-symbols-outlined text-4xl">assignment</span>
                        </div>
                        <h1 className="text-2xl md:text-3xl font-black text-slate-900 mb-3 tracking-tight uppercase">{simulado?.title}</h1>
                        {courseInfo?.title && (
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-6">{courseInfo.title}</p>
                        )}
                        <div className="flex flex-col gap-2 mb-8 bg-slate-50 p-6 rounded-2xl border border-slate-100">
                            <p className="text-slate-600 font-medium text-sm leading-relaxed">
                                Duração: <span className="text-slate-900 font-black">{simulado?.duration} minutos</span> ({questions.length} questões)
                            </p>
                            {simulado && simulado.penalty > 0 && (
                                <div className="p-2.5 bg-red-50 text-red-600 rounded-xl text-xs font-black uppercase tracking-widest border border-red-100">
                                    ⚠️ Penalidade: {simulado.penalty} pontos por erro.
                                </div>
                            )}
                        </div>

                        {/* Discipline Weights Breakdown */}
                        {Object.keys(disciplineWeights).length > 0 && (
                            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5 mb-8 text-left max-h-52 overflow-y-auto custom-scrollbar">
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3 text-center">Distribuição de Pontos</p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    {Array.from(new Set(questions.map(q => q.disciplina_id))).filter(Boolean).map(dId => {
                                        const discName = questions.find(q => q.disciplina_id === dId)?.disciplinas?.name || 'Geral';
                                        const weight = disciplineWeights[dId] || 1;
                                        return (
                                            <div key={dId} className="flex justify-between items-center bg-white px-3 py-2 rounded-xl border border-slate-200 shadow-sm">
                                                <span className="text-[10px] font-bold text-slate-700 truncate max-w-[70%] uppercase">{discName}</span>
                                                <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded">{weight} pts</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        <div className="space-y-3">
                            <button
                                onClick={() => setStatus('running')}
                                className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-xl active:scale-95"
                            >
                                Iniciar Simulado Online
                            </button>
                            <button
                                onClick={handlePrint}
                                className="w-full py-4 bg-white text-slate-700 border-2 border-slate-200 hover:border-slate-900 hover:text-slate-900 rounded-2xl font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-sm active:scale-95"
                            >
                                <span className="material-symbols-outlined text-lg">print</span>
                                Imprimir Caderno e Cartão de Respostas
                            </button>
                            <button
                                onClick={() => {
                                    if (courseIdParam) {
                                        navigate(`/aluno/curso/${courseIdParam}`);
                                    } else {
                                        navigate(-1);
                                    }
                                }}
                                className="w-full py-3 bg-transparent text-slate-400 font-bold uppercase text-xs tracking-widest hover:text-slate-900 transition-colors"
                            >
                                Voltar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* SCREEN VIEW: Top Bar when Running or Finished */}
            {status !== 'ready' && (
                <header className="no-print sticky top-0 bg-white/90 backdrop-blur-xl border-b border-slate-200 z-[100] transition-all duration-500 px-6 md:px-16 py-3.5 shadow-sm">
                    <div className="max-w-6xl mx-auto flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <h2 className="text-lg md:text-xl font-black text-[#111418] uppercase tracking-tight truncate max-w-xs md:max-w-md">
                                {simulado?.title}
                            </h2>
                        </div>

                        {status === 'running' && (
                            <div className="flex flex-col items-center">
                                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Tempo Restante</p>
                                <p className={`text-base md:text-lg font-black tabular-nums transition-colors ${timeLeft < 300 ? 'text-red-500 animate-pulse' : 'text-slate-900'}`}>
                                    {formatTime(timeLeft)}
                                </p>
                            </div>
                        )}

                        <div className="flex items-center gap-2">
                            <button
                                onClick={handlePrint}
                                className="flex items-center gap-1.5 px-3.5 h-9 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 font-bold text-xs uppercase tracking-wider transition-all shadow-sm active:scale-95"
                                title="Imprimir Simulado"
                            >
                                <span className="material-symbols-outlined text-base">print</span>
                                <span className="hidden sm:inline">Imprimir</span>
                            </button>

                            <button
                                onClick={toggleFocus}
                                className={`size-9 flex items-center justify-center rounded-xl border transition-all ${isFocusMode ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
                                title={isFocusMode ? 'Sair do Modo Foco' : 'Modo Foco'}
                            >
                                <span className="material-symbols-outlined text-lg">{isFocusMode ? 'fullscreen_exit' : 'fullscreen'}</span>
                            </button>

                            {status === 'running' && (
                                <button
                                    onClick={handleFinish}
                                    className="px-4 h-9 bg-red-600 hover:bg-red-700 text-white text-[10px] font-black uppercase tracking-wider rounded-xl transition-all shadow-sm active:scale-95"
                                >
                                    Finalizar
                                </button>
                            )}

                            {status === 'finished' && (
                                <button
                                    onClick={() => {
                                        if (courseIdParam) {
                                            navigate(`/aluno/curso/${courseIdParam}`);
                                        } else {
                                            navigate(-1);
                                        }
                                    }}
                                    className="px-4 h-9 bg-slate-900 hover:bg-slate-800 text-white text-[10px] font-black uppercase tracking-wider rounded-xl transition-all shadow-sm active:scale-95"
                                >
                                    Sair
                                </button>
                            )}
                        </div>
                    </div>
                    {status === 'running' && (
                        <div className="absolute bottom-0 left-0 w-full h-[3px] bg-slate-100">
                            <div
                                className="h-full bg-blue-600 transition-all duration-500"
                                style={{ width: `${(Object.keys(userAnswers).length / Math.max(questions.length, 1)) * 100}%` }}
                            ></div>
                        </div>
                    )}
                </header>
            )}

            {/* SCREEN VIEW: Finished Summary Screen */}
            {status === 'finished' && !showReview && (
                <div className="no-print max-w-3xl mx-auto py-12 px-6">
                    <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-xl p-8 md:p-12 text-center animate-in scale-in-center">
                        <div className="size-16 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                            <span className="material-symbols-outlined text-3xl">verified</span>
                        </div>
                        <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-1">Simulado Concluído</p>
                        <h2 className="text-2xl md:text-3xl font-black text-slate-900 mb-8 uppercase tracking-tight">{simulado?.title}</h2>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 md:gap-4 mb-8">
                            {[
                                { label: 'Certas', val: stats.correct, color: 'text-emerald-600 bg-emerald-50' },
                                { label: 'Erradas', val: stats.wrong, color: 'text-red-600 bg-red-50' },
                                { label: 'Em Branco', val: stats.blank, color: 'text-slate-500 bg-slate-50' },
                                { label: 'Nota Líquida', val: stats.netScore, color: 'text-blue-600 bg-blue-50 font-black' }
                            ].map(s => (
                                <div key={s.label} className={`p-4 md:p-6 rounded-2xl border border-slate-100 flex flex-col items-center justify-center ${s.color}`}>
                                    <p className="text-[9px] font-black uppercase tracking-widest opacity-80 mb-1">{s.label}</p>
                                    <p className="text-2xl md:text-3xl font-black">{s.val}</p>
                                </div>
                            ))}
                        </div>

                        <div className="flex flex-col sm:flex-row gap-3 justify-center">
                            <button
                                onClick={() => setShowReview(true)}
                                className="bg-blue-600 text-white px-8 py-3.5 rounded-xl font-black uppercase text-xs tracking-widest hover:bg-blue-700 transition-all shadow-lg active:scale-95"
                            >
                                Revisar Respostas e Gabarito
                            </button>
                            <button
                                onClick={handlePrint}
                                className="bg-slate-900 text-white px-8 py-3.5 rounded-xl font-black uppercase text-xs tracking-widest hover:bg-slate-800 transition-all shadow-lg flex items-center justify-center gap-2 active:scale-95"
                            >
                                <span className="material-symbols-outlined text-base">print</span>
                                Imprimir Caderno de Prova
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* SCREEN VIEW: Questions List (When running or reviewing on screen) */}
            {status !== 'ready' && (status === 'running' || showReview) && (
                <main className="no-print max-w-4xl mx-auto py-8 px-6 md:py-12">
                    <div className="space-y-8">
                        {questions.map((q, idx) => {
                            const selected = userAnswers[q.id];
                            const correctIdx = q.alternativas?.findIndex(a => a.isCorreta);
                            const isCorrect = selected === correctIdx;

                            const textBaseContent = q.texto_base || (q as any).text_bases?.content;
                            const prevQ = questions[idx - 1];
                            const prevTextBaseContent = prevQ ? (prevQ.texto_base || (prevQ as any).text_bases?.content) : null;
                            const showTextBase = textBaseContent && (!prevQ || prevTextBaseContent !== textBaseContent);

                            const bancaObj = (q as any).bancas;
                            const bancaName = bancaObj?.sigla ? `${bancaObj.sigla} - ${bancaObj.name}` : bancaObj?.name;

                            return (
                                <div key={q.id} className="relative group">
                                    {(q as any).section && (
                                        <div className="mb-8 mt-12 pb-3 border-b-2 border-slate-900 flex items-center gap-3">
                                            <div className="size-8 rounded-lg bg-slate-900 text-white flex items-center justify-center">
                                                <span className="material-symbols-outlined text-base">menu_book</span>
                                            </div>
                                            <h2 className="text-xl font-black text-slate-900 uppercase tracking-wider">
                                                {(q as any).section}
                                            </h2>
                                        </div>
                                    )}

                                    {showTextBase && (
                                        <div className="mb-6 p-6 bg-slate-50 border-l-4 border-slate-900 rounded-r-2xl">
                                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Texto de Apoio</p>
                                            <div className="text-sm font-medium text-slate-700 leading-relaxed text-justify break-words whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: processAll(textBaseContent || '') }}></div>
                                        </div>
                                    )}

                                    <div className={`bg-white rounded-3xl p-6 md:p-8 border ${showReview ? (isCorrect ? 'border-emerald-200 bg-emerald-50/20' : 'border-red-200 bg-red-50/20') : 'border-slate-200 shadow-sm'}`}>
                                        <div className="flex flex-wrap items-center justify-between gap-2 mb-4 pb-3 border-b border-slate-100">
                                            <div className="flex items-center gap-2">
                                                <span className="px-3 py-1 bg-slate-900 text-white rounded-lg font-black text-xs uppercase tracking-wider">
                                                    Questão {String(idx + 1).padStart(2, '0')}
                                                </span>
                                                {bancaName && (
                                                    <span className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-lg font-bold text-[10px] uppercase">
                                                        {bancaName}
                                                    </span>
                                                )}
                                                {q.ano && (
                                                    <span className="px-2.5 py-1 bg-slate-100 text-slate-500 rounded-lg font-bold text-[10px]">
                                                        {q.ano}
                                                    </span>
                                                )}
                                                {q.disciplinas?.name && (
                                                    <span className="px-2.5 py-1 bg-blue-50 text-blue-700 rounded-lg font-bold text-[10px] uppercase">
                                                        {q.disciplinas.name}
                                                    </span>
                                                )}
                                            </div>
                                            {disciplineWeights[q.disciplina_id] && (
                                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                                                    Peso: {disciplineWeights[q.disciplina_id]} pt(s)
                                                </span>
                                            )}
                                        </div>

                                        <div className="text-base md:text-lg font-semibold text-slate-900 leading-relaxed mb-6 break-words text-justify" dangerouslySetInnerHTML={{ __html: processAll(q.enunciado || '') }} />

                                        <div className="space-y-2.5">
                                            {q.alternativas?.map((alt, i) => {
                                                const isSelected = selected === i;
                                                const isAltCorrect = alt.isCorreta;

                                                let btnClass = "bg-white text-slate-700 border-slate-200 hover:border-blue-400";
                                                if (isSelected) btnClass = "bg-slate-900 text-white border-slate-900 shadow-md";
                                                if (showReview) {
                                                    if (isAltCorrect) btnClass = "bg-emerald-600 text-white border-emerald-600 shadow-md font-bold";
                                                    else if (isSelected) btnClass = "bg-red-600 text-white border-red-600 font-bold";
                                                    else btnClass = "bg-slate-50 text-slate-400 border-slate-200 opacity-60";
                                                }

                                                return (
                                                    <button
                                                        key={i}
                                                        disabled={status === 'finished'}
                                                        onClick={() => handleAnswer(q.id, i)}
                                                        className={`w-full p-4 rounded-2xl border text-left text-sm font-medium flex gap-3.5 items-center transition-all ${btnClass}`}
                                                    >
                                                        <div className="size-7 rounded-xl border border-current flex items-center justify-center font-black text-xs shrink-0">
                                                            {String.fromCharCode(65 + i)}
                                                        </div>
                                                        <span className="break-words flex-1 leading-snug" dangerouslySetInnerHTML={{ __html: processAll(alt.texto || '') }} />
                                                    </button>
                                                );
                                            })}
                                        </div>

                                        {showReview && q.resposta_professor && (
                                            <div className="mt-6 pt-6 border-t border-slate-200 bg-slate-50 p-4 rounded-2xl">
                                                <div className="flex items-center gap-2 mb-2 text-blue-700 font-black text-xs uppercase tracking-wider">
                                                    <span className="material-symbols-outlined text-base">psychology</span>
                                                    Comentário do Professor
                                                </div>
                                                <div className="text-xs font-medium text-slate-700 leading-relaxed break-words text-justify" dangerouslySetInnerHTML={{ __html: processAll(q.resposta_professor) }} />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </main>
            )}

            {/* ========================================================================= */}
            {/* PRINT ONLY: OFFICIAL CONCURSO EXAM LAYOUT (PROVA REAL DE CONCURSO) */}
            {/* ========================================================================= */}
            <div className="print-only">
                
                {/* --------------------------------------------------------------------- */}
                {/* PÁGINA 1: CAPA OFICIAL DO CADERNO DE QUESTÕES */}
                {/* --------------------------------------------------------------------- */}
                <div className="print-page-break flex flex-col justify-between border-[2.5px] border-black p-8" style={{ minHeight: '265mm', boxSizing: 'border-box' }}>
                    
                    {/* Header Institucional da Capa */}
                    <div className="border-b-[2px] border-black pb-4 text-center">
                        <div className="flex items-center justify-between mb-3">
                            <img src="/bora_passar_logo.png" alt="Bora Passar Agora" className="h-12 w-auto object-contain filter brightness-0" />
                            <div className="text-right">
                                <span className="inline-block px-3 py-1 border border-black font-black text-[9pt] uppercase tracking-widest">
                                    Simulado Oficial
                                </span>
                            </div>
                        </div>
                        <h1 className="text-[18pt] font-black uppercase tracking-tight text-black leading-tight">
                            {courseInfo?.title || 'Preparatório para Concursos Públicos'}
                        </h1>
                        <p className="text-[12pt] font-bold uppercase tracking-wider text-black mt-1">
                            {simulado?.title}
                        </p>
                        <div className="inline-block bg-black text-white font-black text-[10pt] uppercase tracking-[0.2em] px-6 py-1.5 mt-2 rounded">
                            Caderno de Questões • Prova Objetiva
                        </div>
                    </div>

                    {/* Quadro de Identificação do Candidato */}
                    <div className="border-[1.5px] border-black p-4 my-4">
                        <div className="text-[9pt] font-black uppercase tracking-widest border-b border-black pb-1 mb-3">
                            Identificação do(a) Candidato(a)
                        </div>
                        <div className="grid grid-cols-2 gap-4 text-[9.5pt]">
                            <div>
                                <span className="font-black">Nome:</span>{' '}
                                <span className="font-bold underline uppercase">{studentProfile?.full_name || '____________________________________________________'}</span>
                            </div>
                            <div>
                                <span className="font-black">CPF:</span>{' '}
                                <span className="font-bold underline">{studentProfile?.cpf || '________________________'}</span>
                            </div>
                            <div>
                                <span className="font-black">Sala:</span>{' '}
                                <span>________</span>
                                <span className="font-black ml-6">Carteira:</span>{' '}
                                <span>________</span>
                            </div>
                            <div>
                                <span className="font-black">Data de Aplicação:</span>{' '}
                                <span>{new Date().toLocaleDateString('pt-BR')}</span>
                            </div>
                        </div>

                        {/* Campo para Assinatura */}
                        <div className="mt-4 pt-3 border-t border-black border-dashed flex justify-between items-end">
                            <div className="text-[8.5pt] font-bold uppercase text-slate-700">
                                Assine no quadro ao lado conforme seu documento:
                            </div>
                            <div className="border border-black w-72 h-12 flex items-end justify-center pb-1 text-[7.5pt] font-bold uppercase">
                                Assinatura do(a) Candidato(a)
                            </div>
                        </div>
                    </div>

                    {/* Instruções Oficiais ao Candidato (Caixa de Regras de Concurso) */}
                    <div className="border-[1.5px] border-black p-4 text-[8.5pt] leading-relaxed my-2">
                        <div className="font-black uppercase tracking-widest text-[9pt] border-b border-black pb-1 mb-2 text-center">
                            Leia com Atenção as Instruções Gerais aos Candidatos
                        </div>
                        <ol className="list-decimal pl-5 space-y-1.5 text-justify">
                            <li>
                                <strong>Confira este caderno de provas</strong>, que contém um total de <strong>{questions.length} questões objetivas</strong> numeradas em ordem sequencial. Caso haja qualquer falha de impressão ou ausência de página, solicite imediatamente a substituição ao fiscal.
                            </li>
                            <li>
                                Para cada questão objetiva, são apresentadas opções de resposta. Apenas <strong>uma</strong> alternativa responde corretamente ao enunciado.
                            </li>
                            <li>
                                O tempo total disponível para a realização da prova é de <strong>{simulado?.duration || 240} minutos</strong>, já incluído o tempo destinado ao preenchimento da <strong>Folha de Respostas</strong> localizada na última página deste caderno.
                            </li>
                            <li>
                                Utilize exclusivamente <strong>caneta esferográfica de tinta preta ou azul</strong> fabricada em material transparente para preencher a Folha de Respostas.
                            </li>
                            <li>
                                Preencha a Folha de Respostas cobrindo completamente a bolinha correspondente à alternativa escolhida (exemplo: <strong>●</strong>). Não rasure, não amasse e não dobre a Folha de Respostas.
                            </li>
                            <li>
                                É expressamente proibido portar ou utilizar aparelhos eletrônicos, relógios digitais, calculadoras, celulares ou qualquer outro material de consulta durante a realização do simulado.
                            </li>
                            <li>
                                Anotações ou cálculos realizados neste caderno de questões <strong>não</strong> serão computados para efeito de pontuação. Somente a Folha de Respostas tem valor oficial de correção.
                            </li>
                            {simulado?.penalty && simulado.penalty > 0 ? (
                                <li>
                                    <strong>SISTEMA DE PENALIDADE:</strong> Este simulado adota critério de correção com desconto de <strong>{simulado.penalty} ponto(s)</strong> por questão assinalada em desacordo com o gabarito oficial.
                                </li>
                            ) : (
                                <li>
                                    Cada questão respondida em conformidade com o gabarito oficial pontuará de acordo com o peso atribuído à sua respectiva disciplina.
                                </li>
                            )}
                        </ol>
                    </div>

                    {/* Rodapé da Capa com Aviso Solene */}
                    <div className="border-t-[2px] border-black pt-3 text-center">
                        <div className="text-[10pt] font-black uppercase tracking-widest text-black mb-1">
                            Aguarde a Autorização do Fiscal para Iniciar a Prova
                        </div>
                        <div className="text-[8pt] font-bold text-slate-700">
                            Plataforma Bora Passar Agora • Material Didático e de Avaliação Oficial • Todos os Direitos Reservados
                        </div>
                    </div>
                </div>

                {/* --------------------------------------------------------------------- */}
                {/* PÁGINAS 2 EM DIANTE: CADERNO DE QUESTÕES DIAGRAMADO */}
                {/* --------------------------------------------------------------------- */}
                <div className="pt-2">
                    {/* Top Running Header */}
                    <div className="border-b-2 border-black pb-1.5 mb-5 flex items-center justify-between text-[8pt] font-black uppercase tracking-wider">
                        <span>Bora Passar Agora • Prova Objetiva</span>
                        <span>{simulado?.title}</span>
                    </div>

                    <div className="space-y-5">
                        {questions.map((q, idx) => {
                            const textBaseContent = q.texto_base || (q as any).text_bases?.content;
                            const prevQ = questions[idx - 1];
                            const prevTextBaseContent = prevQ ? (prevQ.texto_base || (prevQ as any).text_bases?.content) : null;
                            const showTextBase = textBaseContent && (!prevQ || prevTextBaseContent !== textBaseContent);

                            const bancaObj = (q as any).bancas;
                            const bancaName = bancaObj?.sigla ? `${bancaObj.sigla} - ${bancaObj.name}` : bancaObj?.name;
                            const discName = q.disciplinas?.name;

                            return (
                                <div key={q.id} className="print-avoid-break">
                                    {/* Section / Discipline Banner */}
                                    {(q as any).section && (
                                        <div className="bg-black text-white font-black text-[9.5pt] uppercase tracking-wider px-3 py-1 mb-3.5 mt-5">
                                            {(q as any).section}
                                        </div>
                                    )}

                                    {/* Support Text Box */}
                                    {showTextBase && (
                                        <div className="border border-black p-3 mb-3 bg-slate-50/50 print-avoid-break">
                                            <div className="font-black text-[7.5pt] uppercase tracking-widest border-b border-black pb-0.5 mb-1.5">
                                                Texto de Apoio
                                            </div>
                                            <div
                                                className="text-[8.5pt] leading-relaxed text-justify break-words whitespace-pre-wrap"
                                                dangerouslySetInnerHTML={{ __html: processAll(textBaseContent || '') }}
                                            />
                                        </div>
                                    )}

                                    {/* Question Box */}
                                    <div className="border-b border-slate-300 pb-3 mb-3">
                                        <div className="flex items-center justify-between mb-1.5">
                                            <div className="flex items-center gap-2">
                                                <span className="font-black text-[9.5pt] uppercase tracking-tight text-black">
                                                    Questão {String(idx + 1).padStart(2, '0')}
                                                </span>
                                                {bancaName && (
                                                    <span className="text-[7pt] font-bold uppercase text-slate-700 border border-slate-400 px-1.5 py-0.2 rounded">
                                                        {bancaName}
                                                    </span>
                                                )}
                                                {q.ano && (
                                                    <span className="text-[7pt] font-bold text-slate-600">
                                                        ({q.ano})
                                                    </span>
                                                )}
                                            </div>
                                            {discName && (
                                                <span className="text-[7pt] font-black uppercase text-slate-600">
                                                    {discName}
                                                </span>
                                            )}
                                        </div>

                                        {/* Enunciado */}
                                        <div
                                            className="text-[8.5pt] font-medium text-black leading-relaxed mb-2 text-justify break-words"
                                            dangerouslySetInnerHTML={{ __html: processAll(q.enunciado || '') }}
                                        />

                                        {/* Alternativas */}
                                        <div className="space-y-1 pl-1">
                                            {q.alternativas?.map((alt, altIdx) => (
                                                <div key={altIdx} className="flex items-start gap-1.5 text-[8pt] leading-snug">
                                                    <span className="font-black font-mono shrink-0">
                                                        ({String.fromCharCode(65 + altIdx)})
                                                    </span>
                                                    <span
                                                        className="text-black break-words"
                                                        dangerouslySetInnerHTML={{ __html: processAll(alt.texto || '') }}
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* --------------------------------------------------------------------- */}
                {/* ÚLTIMA PÁGINA: FOLHA DE RESPOSTAS / CARTÃO-RESPOSTA OFICIAL (1 PÁGINA) */}
                {/* --------------------------------------------------------------------- */}
                <div
                    className="print-page-break-before print-avoid-break border-[2.5px] border-black p-5 flex flex-col justify-between"
                    style={{
                        minHeight: '260mm',
                        maxHeight: '272mm',
                        boxSizing: 'border-box',
                        overflow: 'hidden'
                    }}
                >
                    {/* Topo do Cartão de Respostas */}
                    <div>
                        <div className="border-b-[1.5px] border-black pb-2 mb-2 flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                                <img src="/bora_passar_logo.png" alt="Bora Passar" className="h-7 w-auto object-contain filter brightness-0" />
                                <div>
                                    <h2 className="text-[11.5pt] font-black uppercase tracking-tight leading-tight">Folha de Respostas Oficial</h2>
                                    <p className="text-[7pt] font-bold uppercase tracking-widest text-slate-700">Cartão-Resposta de Avaliação da Prova Objetiva</p>
                                </div>
                            </div>
                            <div className="text-right">
                                <div className="text-[8pt] font-black uppercase truncate max-w-[200px]">{simulado?.title}</div>
                                <div className="text-[7pt] font-bold uppercase text-slate-600 truncate max-w-[200px]">{courseInfo?.title || 'Bora Passar Agora'}</div>
                            </div>
                        </div>

                        {/* Dados do Aluno em Linha Compacta */}
                        <div className="border border-black px-2.5 py-1.5 mb-2 grid grid-cols-4 gap-2 text-[7.5pt] bg-slate-50/60">
                            <div className="col-span-2 truncate">
                                <span className="font-black">Candidato:</span>{' '}
                                <span className="font-bold underline uppercase">{studentProfile?.full_name || '______________________________________'}</span>
                            </div>
                            <div className="truncate">
                                <span className="font-black">CPF:</span>{' '}
                                <span className="font-bold underline">{studentProfile?.cpf || '__________________'}</span>
                            </div>
                            <div className="text-right">
                                <span className="font-black">Data:</span> {new Date().toLocaleDateString('pt-BR')} • <span className="font-black">{totalQuestions} Qs</span>
                            </div>
                        </div>

                        {/* Guia de Preenchimento Visual Compacto */}
                        <div className="border border-black bg-slate-100 px-2 py-1 mb-2.5 flex items-center justify-between text-[7pt]">
                            <div>
                                <span className="font-black uppercase">Instruções:</span> Preencha totalmente a bolha com caneta preta ou azul. Não rasure nem dobre.
                            </div>
                            <div className="flex items-center gap-3 font-mono font-bold">
                                <div className="flex items-center gap-1">
                                    <span>Correto:</span>
                                    <div className="size-3.5 rounded-full bg-black text-white flex items-center justify-center text-[6pt] font-black">A</div>
                                </div>
                                <div className="flex items-center gap-1 text-slate-600">
                                    <span>Incorretos:</span>
                                    <div className="size-3.5 rounded-full border border-black flex items-center justify-center text-[6pt]">✕</div>
                                    <div className="size-3.5 rounded-full border border-black flex items-center justify-center text-[6pt]">✓</div>
                                    <div className="size-3.5 rounded-full border border-black flex items-center justify-center text-[6pt]">─</div>
                                </div>
                            </div>
                        </div>

                        {/* Grade de Questões e Bolinhas (Grid de Cartão de Respostas suportando até 120 questões) */}
                        <div
                            className="grid gap-2 border border-black p-2 bg-white"
                            style={{
                                gridTemplateColumns: `repeat(${numColumns}, minmax(0, 1fr))`
                            }}
                        >
                            {answerSheetColumns.map((col, colIdx) => (
                                <div key={colIdx} className="space-y-0.5 border-r border-slate-300 last:border-r-0 pr-1.5">
                                    <div className="flex justify-between items-center text-[6.5pt] font-black uppercase text-slate-700 border-b border-black pb-0.5 mb-0.5">
                                        <span>Nº</span>
                                        <span>Opções</span>
                                    </div>
                                    {col.map(({ question: qItem, globalNumber }) => {
                                        const alts = qItem.alternativas || [];
                                        const isCertoErrado = alts.length === 2 && alts.some(a => ['certo', 'errado'].includes(a.texto?.toLowerCase().trim()));
                                        const letters = isCertoErrado ? ['C', 'E'] : ['A', 'B', 'C', 'D', 'E'].slice(0, Math.max(alts.length || 5, 4));

                                        return (
                                            <div key={globalNumber} className="flex items-center justify-between py-[1.5px] border-b border-slate-100 last:border-b-0">
                                                <span className="text-[7.5pt] font-black font-mono w-5 text-slate-900 leading-none">
                                                    {String(globalNumber).padStart(2, '0')}
                                                </span>
                                                <div className="flex items-center gap-1">
                                                    {letters.map(letter => (
                                                        <div
                                                            key={letter}
                                                            className="size-[15px] rounded-full border-[1.2px] border-black flex items-center justify-center text-[6.5pt] font-black font-mono text-black leading-none"
                                                        >
                                                            {letter}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Rodapé e Controle do Fiscal (Compacto) */}
                    <div className="border-t-[1.5px] border-black pt-2 mt-2">
                        <div className="grid grid-cols-2 gap-3 items-end">
                            <div className="border border-black p-1.5 h-10 flex flex-col justify-between">
                                <span className="text-[6.5pt] font-black uppercase text-slate-600">Assinatura do(a) Candidato(a):</span>
                                <div className="border-b border-black border-dotted"></div>
                            </div>
                            <div className="border border-black p-1.5 h-10 flex flex-col justify-between">
                                <span className="text-[6.5pt] font-black uppercase text-slate-600">Visto / Assinatura do Fiscal:</span>
                                <div className="border-b border-black border-dotted"></div>
                            </div>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default SimuladosStudent;
