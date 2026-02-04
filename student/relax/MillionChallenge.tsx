import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import GameRank from './GameRank';

// Game Constants
const LEVELS = [
    { level: 1, prize: 500, label: '500 B' },
    { level: 2, prize: 1000, label: '1K B' },
    { level: 3, prize: 2000, label: '2K B' },
    { level: 4, prize: 3000, label: '3K B' },
    { level: 5, prize: 5000, label: '5K B' }, // Safe point 1
    { level: 6, prize: 10000, label: '10K B' },
    { level: 7, prize: 20000, label: '20K B' },
    { level: 8, prize: 40000, label: '40K B' },
    { level: 9, prize: 60000, label: '60K B' },
    { level: 10, prize: 100000, label: '100K B' }, // Safe point 2
    { level: 11, prize: 200000, label: '200K B' },
    { level: 12, prize: 300000, label: '300K B' },
    { level: 13, prize: 500000, label: '500K B' },
    { level: 14, prize: 750000, label: '750K B' },
    { level: 15, prize: 1000000, label: '1M B' }
];

const MillionChallenge: React.FC = () => {
    const { courseId } = useParams();
    const navigate = useNavigate();

    // Game State
    const [gameState, setGameState] = useState<'intro' | 'playing' | 'decision' | 'won' | 'lost'>('intro');
    const [currentLevelIndex, setCurrentLevelIndex] = useState(0);
    const [currentQuestion, setCurrentQuestion] = useState<any>(null);
    const [questionsStack, setQuestionsStack] = useState<any[]>([]); // All questions pre-fetched or fetched in batches
    const [showRank, setShowRank] = useState(false);

    // Loading & Helpers
    const [loading, setLoading] = useState(false);
    const [selectedAlt, setSelectedAlt] = useState<string | null>(null);
    const [isChecking, setIsChecking] = useState(false);
    const [message, setMessage] = useState('');
    const [finalScore, setFinalScore] = useState(0);

    // Lifelines
    const [lifelines, setLifelines] = useState({
        friends: true,
        skip: true,
        cards: true
    });
    const [activeHelp, setActiveHelp] = useState<'friends' | 'cards' | 'menu' | null>(null);
    const [helpData, setHelpData] = useState<any>(null); // To store generated help data

    // Constants for current level
    const currentPrize = LEVELS[currentLevelIndex].prize;
    // Calculate safe prize based on checkpoints
    const getSafePrize = (levelIdx: number) => {
        if (levelIdx >= 9) return 100000; // Passed level 10 (index 9)
        if (levelIdx >= 4) return 5000;   // Passed level 5 (index 4)
        return 0;
    };
    const safePrize = getSafePrize(currentLevelIndex);

    // Timer State
    const [timeLeft, setTimeLeft] = useState(120);

    // Timer Effect
    useEffect(() => {
        if (gameState !== 'playing' || timeLeft <= 0 || isChecking) return;

        const timer = setInterval(() => {
            setTimeLeft(prev => {
                if (prev <= 1) {
                    clearInterval(timer);
                    endGame(false);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, [gameState, timeLeft, isChecking]);

    // Fullscreen Helper
    const toggleFullscreen = () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen();
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen();
            }
        }
    };

    // Fetch initial data
    useEffect(() => {
        if (gameState === 'intro') {
            fetchInitialQuestions();
        }
    }, [gameState]);

    const fetchInitialQuestions = async () => {
        setLoading(true);
        try {
            // 1. Get Course Structure (Disciplines & Subjects) via Apostilas
            const { data: items } = await supabase
                .from('course_items')
                .select('apostila:apostilas(disciplina_id, assunto_id)')
                .eq('course_id', courseId);

            const specificSubjects = new Set<string>();
            const generalDisciplines = new Set<string>();

            items?.forEach((item: any) => {
                const aps = item.apostila;
                if (!aps) return;
                if (aps.assunto_id) specificSubjects.add(aps.assunto_id);
                else if (aps.disciplina_id) generalDisciplines.add(aps.disciplina_id);
            });

            const subjectsArray = Array.from(specificSubjects);
            const disciplinesArray = Array.from(generalDisciplines);

            if (subjectsArray.length === 0 && disciplinesArray.length === 0) {
                alert('Este curso não possui disciplinas/assuntos vinculados para gerar o jogo.');
                setLoading(false);
                return;
            }

            // Helper to fetch randomized questions
            const fetchByDiff = async (diff: string, limit: number) => {
                let query = supabase
                    .from('questions')
                    .select('*, bancas!inner(name)')
                    .eq('bancas.name', 'Bora Passar Agora - Relax')
                    .ilike('dificuldade', diff);

                // Build OR filter for (assunto IN (...) OR disciplina IN (...))
                // Supabase doesn't easily support mixed AND (OR) logic with fluent API
                // We use .or() with filter string, which needs to include the column names
                // Format: "assunto_id.in.(...ids...),disciplina_id.in.(...ids...)"
                const conditions = [];
                if (subjectsArray.length > 0) conditions.push(`assunto_id.in.(${subjectsArray.join(',')})`);
                if (disciplinesArray.length > 0) conditions.push(`disciplina_id.in.(${disciplinesArray.join(',')})`);

                if (conditions.length > 0) {
                    query = query.or(conditions.join(','));
                }

                // Fetch a larger pool to randomize
                const { data } = await query.limit(50);

                // Shuffle and slice
                return (data || []).sort(() => Math.random() - 0.5).slice(0, limit);
            };

            const [easy, medium, hard] = await Promise.all([
                fetchByDiff('Fácil', 7),
                fetchByDiff('Médio', 6),
                fetchByDiff('Difícil', 2)
            ]);

            const combined = [...easy, ...medium, ...hard];

            // Verify if we have enough questions (Strict or Lenient?)
            // If strictly needed 15 but got less, we might have issues.
            // For now, let's proceed with what we have, but ideally warn or handle duplicate fallout.
            if (combined.length < 15) {
                console.warn('Questions fetched:', combined.length, '/ 15 needed');
            }

            const formatted = combined.map(q => {
                const alts = q.alternativas ? [...q.alternativas] : [];
                // Shuffle alternatives
                for (let i = alts.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [alts[i], alts[j]] = [alts[j], alts[i]];
                }

                return {
                    id: q.id,
                    text: q.enunciado,
                    options: alts.map((a: any) => a.texto),
                    correctIndex: alts.findIndex((a: any) => a.isCorreta), // Relies on internal correct flag
                    difficulty: q.dificuldade
                };
            });

            setQuestionsStack(formatted);
        } catch (e) {
            console.error(e);
            alert('Erro ao carregar questões do desafio.');
        } finally {
            setLoading(false);
        }
    };

    const startGame = () => {
        if (questionsStack.length < 15) {
            alert(`Ops! Encontramos apenas ${questionsStack.length} questões compatíveis com este curso. O jogo precisa de 15.`);
            return;
        }
        setCurrentLevelIndex(0);
        setCurrentQuestion(questionsStack[0]);
        setGameState('playing');
        setLifelines({ friends: true, skip: true, cards: true });
        setActiveHelp(null);
        setHelpData(null);
    };

    const handleAnswer = (idx: number) => {
        if (isChecking) return;
        setSelectedAlt(`opt-${idx}`);
        setIsChecking(true);

        setTimeout(() => {
            const isCorrect = idx === currentQuestion.correctIndex;

            if (isCorrect) {
                if (currentLevelIndex === 14) {
                    endGame(true); // Won 1 Million
                } else {
                    // Correct!
                    setMessage('Resposta Correta!');
                    setTimeout(() => {
                        nextLevel();
                    }, 1500);
                }
            } else {
                endGame(false); // Lost
            }
        }, 3000); // Suspense delay
    };

    const nextLevel = () => {
        setIsChecking(false);
        setSelectedAlt(null);
        setActiveHelp(null);
        setHelpData(null);
        setMessage('');
        setTimeLeft(120); // Reset Timer
        const nextIdx = currentLevelIndex + 1;
        setCurrentLevelIndex(nextIdx);
        setCurrentQuestion(questionsStack[nextIdx]);
    };

    const endGame = async (won: boolean) => {
        const prize = won ? 1000000 : safePrize;
        setFinalScore(prize);

        // Save history and update wallet
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            // 1. Update Wallet via RPC
            await supabase.rpc('update_boras_wallet', { p_user_id: user.id, p_amount: prize });

            // 2. Insert Game History
            await supabase.from('relax_game_history').insert({
                user_id: user.id,
                course_id: courseId || null,
                game_type: 'million_challenge',
                score: prize,
                details: { won, reached_level: currentLevelIndex + 1 }
            });
        }

        setGameState(won ? 'won' : 'lost');
    };

    const handleStop = async () => {
        // Se parar, ganha o prêmio do nível anterior (já garantido), ou 0 se estiver no primeiro
        const stopPrize = currentLevelIndex > 0 ? LEVELS[currentLevelIndex - 1].prize : 0;
        setFinalScore(stopPrize);

        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            await supabase.rpc('update_boras_wallet', { p_user_id: user.id, p_amount: stopPrize });
            await supabase.from('relax_game_history').insert({
                user_id: user.id,
                course_id: courseId || null,
                game_type: 'million_challenge',
                score: stopPrize,
                details: { stopped: true, reached_level: currentLevelIndex }
            });
        }
        setGameState('lost');
    };

    // Lifeline Logic
    const useFriends = () => {
        if (!lifelines.friends) return;
        setLifelines(prev => ({ ...prev, friends: false }));
        setActiveHelp('friends');

        const correctOpt = currentQuestion.correctIndex;
        const friendsList = ['Ana', 'Carlos', 'Beatriz'];

        const friendsData = friendsList.map(name => {
            // 75% chance correct
            const isRight = Math.random() < 0.75;
            let choice = correctOpt;
            if (!isRight) {
                let wrong = Math.floor(Math.random() * 4);
                while (wrong === correctOpt) wrong = Math.floor(Math.random() * 4);
                choice = wrong;
            }
            return { name, choice };
        });

        setHelpData(friendsData);
    };

    const useSkip = () => {
        if (!lifelines.skip) return;
        setLifelines(prev => ({ ...prev, skip: false }));
        // Replace current question with another from pool or just fetch new
        // For simplicity, let's just grab the NEXT one in stack and shift everything if we had a reserve
        // But we pre-fetched exactly 8. Ideally we should have spares.
        // Let's assume we can fetch ONE new question of same difficulty now.
        fetchNewQuestion(currentQuestion.difficulty);
    };

    const fetchNewQuestion = async (diff: string) => {
        setLoading(true);
        const { data } = await supabase
            .from('questions')
            .select('*, bancas!inner(name)')
            .ilike('dificuldade', diff)
            .eq('bancas.name', 'Bora Passar Agora - Relax')
            .neq('id', currentQuestion.id) // Try to avoid duplicate
            .limit(1);

        if (data && data[0]) {
            const q = data[0];
            const formatted = {
                id: q.id,
                text: q.enunciado,
                options: q.alternativas.map((a: any) => a.texto),
                correctIndex: q.alternativas.findIndex((a: any) => a.isCorreta),
                difficulty: q.dificuldade
            };
            setCurrentQuestion(formatted);
        } else {
            alert('Sem questões para pular!');
        }
        setLoading(false);
    };

    const useCards = () => {
        if (!lifelines.cards) return;
        setActiveHelp('cards');
        // Show 3 cards (UI handled). On click logic handled in UI render.
    };

    const handleCardClick = (cardIdx: number) => {
        if (!lifelines.cards) return; // Already used
        setLifelines(prev => ({ ...prev, cards: false }));

        // Returns 1, 2, or 3
        const result = Math.floor(Math.random() * 3) + 1; // 1 to 3 alternatives removed

        // Determine which incorrect to remove
        const incorrectIndices = [0, 1, 2, 3].filter(i => i !== currentQuestion.correctIndex);
        const toRemove = incorrectIndices.sort(() => Math.random() - 0.5).slice(0, result);

        setHelpData({ removedIndices: toRemove, cardVal: result });
    };


    if (gameState === 'intro') {
        return (
            <div className="min-h-screen bg-[#0f172a] flex items-center justify-center p-6 relative overflow-hidden">
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-20 animate-pulse"></div>
                <div className="bg-[#1e293b] max-w-2xl w-full rounded-[40px] p-12 border border-slate-700 shadow-2xl relative z-10 text-center">
                    <h1 className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-500 mb-6 uppercase italic">Desafio do Milhão</h1>
                    <p className="text-slate-400 mb-10 text-lg leading-relaxed">
                        Prepare-se para enfrentar 15 perguntas de nível crescente.
                        Use sua sabedoria e estratégias para conquistar o prêmio máximo!
                    </p>
                    <button
                        onClick={startGame}
                        disabled={loading}
                        className="px-12 py-5 bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl text-white font-black uppercase tracking-[0.2em] hover:scale-105 transition-transform shadow-xl shadow-blue-500/20 disabled:opacity-50"
                    >
                        {loading ? 'Carregando Perguntas...' : 'Começar Desafio'}
                    </button>
                    <button
                        onClick={() => setShowRank(true)}
                        className="mt-4 px-12 py-4 bg-white/5 border border-white/10 text-white rounded-2xl font-black uppercase tracking-[0.2em] hover:bg-white/10 transition-transform shadow-lg w-full flex items-center justify-center gap-2"
                    >
                        <span className="material-symbols-outlined text-amber-500">leaderboard</span>
                        Ver Ranking dos Campeões
                    </button>
                    <button onClick={() => navigate(-1)} className="mt-6 block w-full text-slate-500 text-sm font-bold uppercase hover:text-white transition-colors">Voltar</button>

                    {showRank && (
                        <GameRank
                            courseId={courseId || ''}
                            gameType="million_challenge"
                            onClose={() => setShowRank(false)}
                            gameTitle="Desafio do Milhão"
                        />
                    )}
                </div>
            </div>
        );
    }

    if (gameState === 'playing' && currentQuestion) {
        return (
            <div className="min-h-screen bg-[#0f172a] text-white overflow-hidden flex flex-col">
                {/* HUD */}
                <div className="p-6 flex justify-between items-start bg-[#1e293b]/50 backdrop-blur-md border-b border-white/5">
                    <div className="flex gap-4">
                        <button onClick={() => navigate(-1)} className="size-10 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center"><span className="material-symbols-outlined">arrow_back</span></button>
                        <div>
                            <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Pergunta {currentLevelIndex + 1}/15</p>
                            <p className="text-lg font-black text-amber-400">{currentPrize.toLocaleString()} Boras</p>
                        </div>
                    </div>

                    <div className="flex gap-4 items-center">
                        <div className="flex flex-col items-center min-w-[60px]">
                            <span className={`text-2xl font-black font-mono ${timeLeft < 20 ? 'text-red-500 animate-pulse' : 'text-slate-400'}`}>
                                {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')}
                            </span>
                            <span className="text-[8px] font-black uppercase text-slate-500 tracking-widest">Tempo</span>
                        </div>
                        <div className="w-px h-8 bg-white/10"></div>
                        <button onClick={toggleFullscreen} className="size-10 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all" title="Tela Cheia">
                            <span className="material-symbols-outlined">fullscreen</span>
                        </button>
                    </div>

                    {/* Mobile Lifelines Toggle */}
                    <div className="md:hidden">
                        <button
                            onClick={() => setActiveHelp(activeHelp === 'menu' ? null : 'menu')}
                            disabled={currentLevelIndex === 14}
                            className={`size-10 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/30 ${currentLevelIndex === 14 ? 'bg-slate-700 opacity-50 cursor-not-allowed' : 'bg-blue-600 text-white animate-pulse'}`}
                        >
                            <span className="material-symbols-outlined">help</span>
                        </button>
                    </div>

                    {/* Desktop Lifelines */}
                    <div className="hidden md:flex gap-4 items-center justify-center">
                        {[
                            { id: 'friends', icon: 'public', label: 'Amigos', action: useFriends },
                            { id: 'skip', icon: 'skip_next', label: 'Pular', action: useSkip },
                            { id: 'cards', icon: 'style', label: 'Cartas', action: useCards },
                        ].map(l => (
                            <div key={l.id} className="flex flex-col items-center gap-1 group">
                                <button
                                    onClick={l.action}
                                    disabled={!lifelines[l.id as keyof typeof lifelines] || isChecking || currentLevelIndex === 14}
                                    className={`size-12 rounded-2xl flex items-center justify-center transition-all ${lifelines[l.id as keyof typeof lifelines] && currentLevelIndex !== 14 ? 'bg-blue-600 hover:bg-blue-500 shadow-lg shadow-blue-600/20' : 'bg-slate-700 opacity-50 cursor-not-allowed'}`}
                                >
                                    <span className="material-symbols-outlined text-xl">{l.icon}</span>
                                </button>
                                <span className={`text-[9px] font-black uppercase tracking-widest transition-colors ${lifelines[l.id as keyof typeof lifelines] ? 'text-blue-400 group-hover:text-blue-300' : 'text-slate-600'}`}>
                                    {l.label}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Progress Bar & Heat */}
                <div className="w-full bg-slate-900 border-b border-white/5 relative">
                    {/* Background Track - Clean, no grid */}
                    <div className="absolute inset-0 bg-white/5"></div>

                    {/* Dynamic Bar */}
                    <div
                        className="h-3 transition-all duration-1000 ease-out relative"
                        style={{
                            width: `${((currentLevelIndex + 1) / 15) * 100}%`,
                            backgroundColor: `hsl(${220 - ((currentLevelIndex / 14) * 220)}, 90%, 50%)`,
                            boxShadow: `0 0 15px hsl(${220 - ((currentLevelIndex / 14) * 220)}, 90%, 50%)`
                        }}
                    >
                        <div className="absolute right-0 -top-1 size-5 bg-white rounded-full shadow-lg flex items-center justify-center translate-x-1/2">
                            <div className="size-3 rounded-full animate-pulse" style={{ backgroundColor: `hsl(${220 - ((currentLevelIndex / 14) * 220)}, 90%, 50%)` }}></div>
                        </div>
                    </div>

                    {/* Info Labels */}
                    <div className="px-6 py-3 flex justify-center items-center">
                        <div className="bg-slate-800/80 px-6 py-2 rounded-full border border-white/10 shadow-lg backdrop-blur-sm flex items-center gap-2">
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Acumulado</span>
                            <span className="text-sm font-black text-white text-shadow-sm">{(currentLevelIndex > 0 ? LEVELS[currentLevelIndex - 1].prize : 0).toLocaleString()} <span className="text-amber-400">B</span></span>
                        </div>
                    </div>
                </div>

                {/* Main Game Area */}
                <div className="flex-1 flex flex-col items-center justify-center p-6 md:p-12 relative">

                    {/* Question Bubble */}
                    <div className="relative w-full max-w-4xl bg-gradient-to-br from-[#1e293b] to-[#0f172a] border border-slate-600 p-8 md:p-12 rounded-[40px] shadow-2xl mb-12 text-center animate-in zoom-in duration-500">
                        <div className="absolute -top-6 left-1/2 -translate-x-1/2 px-6 py-2 bg-amber-500 text-black font-black uppercase text-xs tracking-[0.2em] rounded-full shadow-lg shadow-amber-500/20">
                            Valendo {currentPrize.toLocaleString()}
                        </div>

                        {/* Rich Text Render without P tags wrapper inside H2 if content has P tags */}
                        {/* We use a div for dangerous HTML and style it to look like h2 */}
                        <div
                            className="text-xl md:text-3xl font-bold leading-relaxed [&>p]:inline"
                            dangerouslySetInnerHTML={{ __html: currentQuestion.text || '' }}
                        />
                    </div>

                    {/* Alternatives Grid */}
                    <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-4">
                        {currentQuestion.options.map((opt: string, idx: number) => {
                            // Check if removed by cards logic
                            const isRemoved = activeHelp === 'cards' && helpData?.removedIndices?.includes(idx);

                            // Visual State
                            let stateClass = "bg-[#1e293b] border-slate-700 hover:bg-[#334155] hover:border-blue-500";
                            if (selectedAlt === `opt-${idx}`) {
                                stateClass = "bg-amber-500 text-black border-amber-500 shadow-[0_0_30px_rgba(245,158,11,0.4)] scale-[1.02] z-10";
                                if (isChecking) {
                                    // Reveal logic handled by changing color after timeout? 
                                    // For now just keep amber until result shows? 
                                    // Or we can cheat and peek:
                                    const isCorrect = idx === currentQuestion.correctIndex;
                                    // Actually the checking phase has a delay. Let's make it blink or something.
                                    stateClass += " animate-pulse";
                                }
                            }

                            // Reveal Result
                            // (Usually only shows after isChecking phase finishes and we transition, 
                            // but in this code 'nextLevel' happens fast. 
                            // If user lost, we show red. If won, green.)
                            // We can use a 'result' state if we want prolonged reveal using useEffect timeout logic inside render?
                            // Simplified for this iteration.

                            if (isRemoved) {
                                return <div key={idx} className="h-20 bg-black/20 rounded-2xl border border-white/5 opacity-30 flex items-center justify-center text-slate-500 select-none">Opção Eliminada</div>;
                            }

                            return (
                                <button
                                    key={idx}
                                    onClick={() => handleAnswer(idx)}
                                    disabled={isChecking}
                                    className={`relative h-auto min-h-[5rem] p-4 rounded-2xl border-2 transition-all flex items-center gap-4 text-left group ${stateClass}`}
                                >
                                    <span className={`size-8 rounded-full border-2 flex items-center justify-center font-black ${selectedAlt === `opt-${idx}` ? 'border-black text-black' : 'border-slate-500 text-slate-500 group-hover:border-white group-hover:text-white'}`}>
                                        {String.fromCharCode(65 + idx)}
                                    </span>
                                    <span className="font-medium text-lg">{opt}</span>

                                    {/* Helper Indicators - Friends (Deprecated inline, moving to bottom) */}
                                </button>
                            );
                        })}
                    </div>

                    {/* Mobile Helpers Menu */}
                    {activeHelp === 'menu' && (
                        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end md:hidden animate-in slide-in-from-bottom duration-300">
                            <div className="w-full bg-[#1e293b] rounded-t-[32px] p-8 border-t border-white/10 pb-12">
                                <div className="flex justify-between items-center mb-8">
                                    <h3 className="text-xl font-black uppercase text-white tracking-widest">Ajudas Disponíveis</h3>
                                    <button onClick={() => setActiveHelp(null)} className="size-10 bg-slate-800 rounded-full flex items-center justify-center">
                                        <span className="material-symbols-outlined text-slate-400">close</span>
                                    </button>
                                </div>
                                <div className="grid grid-cols-3 gap-4">
                                    {[
                                        { id: 'friends', icon: 'public', label: 'Amigos', action: useFriends },
                                        { id: 'skip', icon: 'skip_next', label: 'Pular', action: useSkip },
                                        { id: 'cards', icon: 'style', label: 'Cartas', action: useCards },
                                    ].map(l => (
                                        <button
                                            key={l.id}
                                            onClick={() => { l.action(); if (l.id !== 'friends' && l.id !== 'cards') setActiveHelp(null); }}
                                            disabled={!lifelines[l.id as keyof typeof lifelines] || isChecking || currentLevelIndex === 14}
                                            className={`flex flex-col items-center gap-3 p-4 rounded-2xl border-2 transition-all ${lifelines[l.id as keyof typeof lifelines] && currentLevelIndex !== 14 ? 'bg-blue-600 border-blue-500 text-white shadow-xl' : 'bg-slate-800 border-slate-700 text-slate-500 opacity-50'}`}
                                        >
                                            <span className="material-symbols-outlined text-3xl">{l.icon}</span>
                                            <span className="text-[10px] font-black uppercase tracking-widest">{l.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Friends Overlay Bottom */}
                    {activeHelp === 'friends' && helpData && (
                        <div className="mt-8 flex gap-4 animate-in slide-in-from-bottom-4 flex-wrap justify-center relative z-20">
                            {helpData.map((friend: any, fIdx: number) => (
                                <div key={fIdx} className="bg-white text-slate-900 px-6 py-3 rounded-2xl shadow-xl flex flex-col items-center gap-2 border-b-4 border-amber-500">
                                    <div className="flex items-center gap-2">
                                        <span className="material-symbols-outlined text-amber-500">face</span>
                                        <span className="text-xs font-black uppercase">{friend.name}</span>
                                    </div>
                                    <p className="text-xs font-bold text-slate-500">Escolheu <span className="text-lg text-slate-900 font-black">{String.fromCharCode(65 + friend.choice)}</span></p>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Feedback Overlay */}
                    {isChecking && message && (
                        <div className={`absolute inset-0 z-50 rounded-[40px] flex items-center justify-center backdrop-blur-sm transition-all duration-300 ${message === 'Resposta Correta!' ? 'bg-emerald-500/20' : 'bg-red-500/20'}`}>
                            <div className={`px-12 py-6 rounded-3xl shadow-2xl border-2 transform scale-110 ${message === 'Resposta Correta!' ? 'bg-emerald-500 border-emerald-400 text-white' : 'bg-red-500 border-red-400 text-white'}`}>
                                <div className="flex flex-col items-center gap-2">
                                    <span className="material-symbols-outlined text-5xl mb-2">{message === 'Resposta Correta!' ? 'check_circle' : 'cancel'}</span>
                                    <h3 className="text-2xl font-black uppercase tracking-widest text-center">{message}</h3>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Cards Overlay */}
                    {activeHelp === 'cards' && !helpData && (
                        <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6">
                            <div className="grid grid-cols-3 gap-4 md:gap-8 w-full max-w-2xl">
                                {[1, 2, 3].map(i => (
                                    <button
                                        key={i}
                                        onClick={() => handleCardClick(i)}
                                        className="aspect-[2/3] bg-gradient-to-br from-red-600 to-red-900 rounded-xl border-4 border-white shadow-2xl transform hover:-translate-y-4 transition-all flex items-center justify-center"
                                    >
                                        <span className="material-symbols-outlined text-4xl md:text-6xl text-white/50">style</span>
                                    </button>
                                ))}
                            </div>
                            <p className="absolute bottom-20 text-white font-black uppercase tracking-widest animate-pulse text-center w-full px-4">Escolha uma carta</p>
                        </div>
                    )}
                </div>

                {/* Footer Controls */}
                <div className="p-6 flex justify-center pb-10">
                    <button
                        onClick={handleStop}
                        disabled={isChecking}
                        className="px-8 py-3 bg-red-500/10 text-red-500 border border-red-500/30 rounded-xl font-bold uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all w-full md:w-auto"
                    >
                        Parar (Garantir {(currentLevelIndex > 0 ? LEVELS[currentLevelIndex - 1].prize : 0).toLocaleString()})
                    </button>
                </div>
            </div>
        );
    }

    // Won/Lost Screen
    return (
        <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white p-8 text-center">
            <div className="size-24 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center mb-8 shadow-2xl shadow-orange-500/50">
                <span className="material-symbols-outlined text-5xl text-white">{gameState === 'won' ? 'trophy' : 'sentiment_dissatisfied'}</span>
            </div>

            <h1 className="text-4xl font-black uppercase mb-2">{gameState === 'won' ? 'PARABÉNS!' : 'FIM DE JOGO'}</h1>
            <p className="text-slate-400 text-lg mb-8">Você conquistou</p>

            <div className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-300 to-yellow-500 mb-12">
                {finalScore.toLocaleString()} <span className="text-2xl text-white">Boras</span>
            </div>

            <button
                onClick={() => navigate(-1)}
                className="px-12 py-4 bg-white text-slate-900 rounded-2xl font-black uppercase tracking-widest hover:scale-105 transition-transform"
            >
                Voltar ao Menu
            </button>
        </div>
    );
};

export default MillionChallenge;
