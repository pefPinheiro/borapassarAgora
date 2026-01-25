import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

const TrophyRoom: React.FC = () => {
    const navigate = useNavigate();
    const [balance, setBalance] = useState(0);
    const [highScore, setHighScore] = useState(0);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetch = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                // Fetch Wallet
                const { data } = await supabase.from('profiles').select('boras_wallet').eq('id', user.id).single();
                if (data) setBalance(data.boras_wallet || 0);

                // Fetch High Score
                const { data: history } = await supabase
                    .from('relax_game_history')
                    .select('score')
                    .eq('user_id', user.id)
                    .order('score', { ascending: false })
                    .limit(1);

                if (history && history.length > 0) {
                    setHighScore(history[0].score);
                }
            }
            setLoading(false);
        };
        fetch();
    }, []);

    // Placeholder data for trophies logic (can be expanded later with a real table)
    const trophies = [
        { id: 1, name: "Iniciante", req: 1000, icon: "military_tech", desc: "Ganhe seus primeiros 1.000 Boras" },
        { id: 2, name: "Milionário", req: 1000000, icon: "local_police", desc: "Acumule 1 Milhão de Boras" },
        { id: 3, name: "Sábio", req: 500000, icon: "school", desc: "Ganhe 500k em uma única partida" },
        { id: 4, name: "Imparável", req: 2000000, icon: "local_fire_department", desc: "2 Milhões Acumulados" },
        // ... more
    ];

    return (
        <div className="min-h-screen bg-[#0f172a] text-white p-6 md:p-12 relative">
            <div className="absolute top-0 left-0 w-full h-[50vh] bg-gradient-to-b from-amber-600/20 to-transparent pointer-events-none"></div>

            <div className="max-w-5xl mx-auto relative z-10">
                <button
                    onClick={() => navigate(-1)}
                    className="mb-8 px-6 py-2 bg-white/10 hover:bg-white/20 rounded-full text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 w-fit backdrop-blur-md"
                >
                    <span className="material-symbols-outlined text-sm">arrow_back</span>
                    Voltar
                </button>

                <div className="text-center mb-16 space-y-4">
                    <div className="inline-flex items-center justify-center p-4 rounded-full bg-gradient-to-br from-amber-300 to-orange-500 shadow-2xl shadow-orange-500/40 mb-4 animate-bounce">
                        <span className="material-symbols-outlined text-5xl text-white">emoji_events</span>
                    </div>
                    <h1 className="text-4xl md:text-6xl font-black uppercase italic tracking-tighter">
                        Sala de <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-300 to-orange-500">Troféus</span>
                    </h1>
                    <div className="flex justify-center gap-6 flex-wrap">
                        <div className="inline-block px-8 py-3 bg-white/5 rounded-2xl border border-white/10 backdrop-blur-xl">
                            <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em] mb-1">Patrimônio Total</p>
                            <p className="text-3xl font-black text-white tracking-tight">{balance.toLocaleString()} <span className="text-amber-400">Boras</span></p>
                        </div>
                        <div className="inline-block px-8 py-3 bg-white/5 rounded-2xl border border-white/10 backdrop-blur-xl">
                            <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em] mb-1">Melhor Pontuação</p>
                            <p className="text-3xl font-black text-white tracking-tight">{highScore.toLocaleString()} <span className="text-amber-400">Pts</span></p>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {trophies.map(trophy => {
                        const unlocked = balance >= trophy.req;
                        return (
                            <div key={trophy.id} className={`relative p-6 rounded-3xl border ${unlocked ? 'bg-gradient-to-br from-amber-500/10 to-orange-500/10 border-amber-500/30' : 'bg-white/5 border-white/5 grayscale opacity-50'} transition-all group overflow-hidden`}>
                                <div className="absolute top-0 right-0 p-4 opacity-10">
                                    <span className="material-symbols-outlined text-6xl">{trophy.icon}</span>
                                </div>

                                <div className={`size-12 rounded-xl flex items-center justify-center mb-4 ${unlocked ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/20' : 'bg-slate-700 text-slate-500'}`}>
                                    <span className="material-symbols-outlined">{unlocked ? trophy.icon : 'lock'}</span>
                                </div>

                                <h3 className="font-bold text-white mb-1">{trophy.name}</h3>
                                <p className="text-xs text-slate-400 leading-relaxed mb-4">{trophy.desc}</p>

                                <div className="w-full h-1.5 bg-slate-700 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-amber-500 transition-all duration-1000"
                                        style={{ width: `${Math.min(100, (balance / trophy.req) * 100)}%` }}
                                    ></div>
                                </div>
                                <p className="text-[9px] text-right mt-1 text-slate-500 font-mono">
                                    {Math.min(100, Math.floor((balance / trophy.req) * 100))}%
                                </p>
                            </div>
                        )
                    })}
                </div>
            </div>
        </div>
    );
};

export default TrophyRoom;
