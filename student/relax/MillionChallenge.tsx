import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

// Game Constants
const LEVELS = [
    { level: 1, prize: 500, label: '500 B' },
    { level: 2, prize: 1000, label: '1K B' },
    { level: 3, prize: 5000, label: '5K B' },
    { level: 4, prize: 10000, label: '10K B' }, // Médio Start
    { level: 5, prize: 50000, label: '50K B' },
    { level: 6, prize: 100000, label: '100K B' },
    { level: 7, prize: 500000, label: '500K B' }, // Difícil Start
    { level: 8, prize: 1000000, label: '1M B' }
];

const MillionChallenge: React.FC = () => {
    const { courseId } = useParams();
    const navigate = useNavigate();

    // Game State
    const [gameState, setGameState] = useState<'intro' | 'playing' | 'decision' | 'won' | 'lost'>('intro');
    const [currentLevelIndex, setCurrentLevelIndex] = useState(0);
    const [currentQuestion, setCurrentQuestion] = useState<any>(null);
    const [questionsStack, setQuestionsStack] = useState<any[]>([]); // All questions pre-fetched or fetched in batches

    // Loading & Helpers
    const [loading, setLoading] = useState(false);
    const [selectedAlt, setSelectedAlt] = useState<string | null>(null);
    const [isChecking, setIsChecking] = useState(false);
    const [message, setMessage] = useState('');

    // Lifelines
    const [lifelines, setLifelines] = useState({
        friends: true,
        skip: true,
        cards: true
    });
    const [activeHelp, setActiveHelp] = useState<'friends' | 'cards' | null>(null);
    const [helpData, setHelpData] = useState<any>(null); // To store generated help data

    // Constants for current level
    const currentPrize = LEVELS[currentLevelIndex].prize;
    const safePrize = currentLevelIndex > 0 ? LEVELS[currentLevelIndex - 1].prize : 0;

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
        // Logic to fetch 8 questions: 3 Easy, 3 Medium, 2 Hard
        // We'll fetch a bit more just in case of skipping
        try {
            // Fetch Easy
            const { data: easy } = await supabase
                .from('questions')
                .select('*, bancas!inner(name)')
                .ilike('dificuldade', 'Fácil')
                .eq('bancas.name', 'Bora Passar Agora - Relax')
                .limit(10); // Fetch pool

            // Fetch Medium
            const { data: medium } = await supabase
                .from('questions')
                .select('*, bancas!inner(name)')
                .ilike('dificuldade', 'Médio')
                .eq('bancas.name', 'Bora Passar Agora - Relax')
                .limit(10);

            // Fetch Hard
            const { data: hard } = await supabase
                .from('questions')
                .select('*, bancas!inner(name)')
                .ilike('dificuldade', 'Difícil')
                .eq('bancas.name', 'Bora Passar Agora - Relax')
                .limit(10);

            // Helper to shuffle array
            const shuffle = (array: any[]) => array.sort(() => Math.random() - 0.5);

            const easyQ = shuffle(easy || []).slice(0, 3);
            const medQ = shuffle(medium || []).slice(0, 3);
            const hardQ = shuffle(hard || []).slice(0, 2);

            // Fallback if not enough questions (mock or repeat) - For production should handle better
            const combined = [...easyQ, ...medQ, ...hardQ];
            // Format alternatives to 4 options (if DB has more or less, we need to adapt)
            // Assuming DB structure matches interactive question text/options

            const formatted = combined.map(q => ({
                id: q.id,
                text: q.enunciado,
                options: q.alternativas.map((a: any) => a.texto),
                correctIndex: q.alternativas.findIndex((a: any) => a.isCorreta),
                difficulty: q.dificuldade
            }));

            setQuestionsStack(formatted);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const startGame = () => {
        if (questionsStack.length < 8) {
            alert('Não há questões suficientes para iniciar o jogo neste momento. Tente novamente mais tarde.');
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
                if (currentLevelIndex === 7) {
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
        const finalPrize = won
            ? 1000000
            : safePrize;


        // Save history and update wallet
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            // 1. Update Wallet via RPC
            await supabase.rpc('update_boras_wallet', { p_user_id: user.id, p_amount: finalPrize });

            // 2. Insert Game History
            await supabase.from('relax_game_history').insert({
                user_id: user.id,
                course_id: courseId || null,
                game_type: 'million_challenge',
                score: finalPrize,
                details: { won, reached_level: currentLevelIndex + 1 }
            });
        }

        setGameState(won ? 'won' : 'lost');
    };

    const handleStop = async () => {
        // "se parar ganha até onde acertou" -> safePrize
        const finalPrize = safePrize;

        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            await supabase.rpc('update_boras_wallet', { p_user_id: user.id, p_amount: finalPrize });
            await supabase.from('relax_game_history').insert({
                user_id: user.id,
                course_id: courseId || null,
                game_type: 'million_challenge',
                score: finalPrize,
                details: { stopped: true, reached_level: currentLevelIndex }
            });
        }
        setGameState('lost'); // Reusing lost screen but with specific message for stop?
        // Actually lets create a 'stopped' state or modify 'lost' render
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
                        Prepare-se para enfrentar 8 perguntas de nível crescente.
                        Use sua sabedoria e estratégias para conquistar o prêmio máximo!
                    </p>
                    <button
                        onClick={startGame}
                        disabled={loading}
                        className="px-12 py-5 bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl text-white font-black uppercase tracking-[0.2em] hover:scale-105 transition-transform shadow-xl shadow-blue-500/20 disabled:opacity-50"
                    >
                        {loading ? 'Carregando Perguntas...' : 'Começar Desafio'}
                    </button>
                    <button onClick={() => navigate(-1)} className="mt-6 block w-full text-slate-500 text-sm font-bold uppercase hover:text-white transition-colors">Voltar</button>
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
                            <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Pergunta {currentLevelIndex + 1}/8</p>
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

                    <div className="flex gap-2">
                        {/* Lifelines */}
                        <div className="flex gap-2 p-2 bg-black/30 rounded-2xl">
                            {[
                                { id: 'friends', icon: 'public', label: 'Amigos', action: useFriends },
                                { id: 'skip', icon: 'skip_next', label: 'Pular', action: useSkip },
                                { id: 'cards', icon: 'style', label: 'Cartas', action: useCards },
                            ].map(l => (
                                <button
                                    key={l.id}
                                    onClick={l.action}
                                    disabled={!lifelines[l.id as keyof typeof lifelines] || isChecking}
                                    className={`size-10 rounded-xl flex items-center justify-center transition-all ${lifelines[l.id as keyof typeof lifelines] ? 'bg-blue-600 hover:bg-blue-500 shadow-lg shadow-blue-600/20' : 'bg-slate-700 opacity-50 cursor-not-allowed'}`}
                                    title={l.label}
                                >
                                    <span className="material-symbols-outlined text-lg">{l.icon}</span>
                                </button>
                            ))}
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

                                    {/* Helper Indicators */}
                                    {/* Helper Indicators - Friends (Deprecated inline, moving to bottom) */}
                                </button>
                            );
                        })}
                    </div>

                    {/* Specialists Overlay Sidebar - Removed */}

                    {/* Friends Overlay Bottom */}
                    {activeHelp === 'friends' && helpData && (
                        <div className="mt-8 flex gap-4 animate-in slide-in-from-bottom-4">
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
                                    <h3 className="text-2xl font-black uppercase tracking-widest">{message}</h3>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Cards Overlay */}
                    {activeHelp === 'cards' && !helpData && (
                        <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center">
                            <div className="grid grid-cols-3 gap-8">
                                {[1, 2, 3].map(i => (
                                    <button
                                        key={i}
                                        onClick={() => handleCardClick(i)}
                                        className="w-32 h-48 bg-gradient-to-br from-red-600 to-red-900 rounded-xl border-4 border-white shadow-2xl transform hover:-translate-y-4 transition-all flex items-center justify-center"
                                    >
                                        <span className="material-symbols-outlined text-6xl text-white/50">style</span>
                                    </button>
                                ))}
                            </div>
                            <p className="absolute bottom-20 text-white font-black uppercase tracking-widest animate-pulse">Escolha uma carta</p>
                        </div>
                    )}
                </div>

                {/* Footer Controls */}
                <div className="p-6 flex justify-center pb-10">
                    <button
                        onClick={handleStop}
                        disabled={isChecking}
                        className="px-8 py-3 bg-red-500/10 text-red-500 border border-red-500/30 rounded-xl font-bold uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all"
                    >
                        Parar (Garantir {safePrize.toLocaleString()})
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white p-8 text-center">
            <div className="size-24 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center mb-8 shadow-2xl shadow-orange-500/50">
                <span className="material-symbols-outlined text-5xl text-white">{gameState === 'won' ? 'trophy' : 'sentiment_dissatisfied'}</span>
            </div>

            <h1 className="text-4xl font-black uppercase mb-2">{gameState === 'won' ? 'PARABÉNS!' : 'FIM DE JOGO'}</h1>
            <p className="text-slate-400 text-lg mb-8">Você conquistou</p>

            <div className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-300 to-yellow-500 mb-12">
                {(gameState === 'won' ? 1000000 : safePrize).toLocaleString()} <span className="text-2xl text-white">Boras</span>
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
