import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

const RelaxHub: React.FC = () => {
    const { courseId } = useParams();
    const navigate = useNavigate();
    const [balance, setBalance] = useState(0);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchBalance();
    }, []);

    const fetchBalance = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            const { data } = await supabase.from('profiles').select('boras_wallet').eq('id', user.id).single();
            if (data) setBalance(data.boras_wallet || 0);
        }
        setLoading(false);
    };

    return (
        <div className="min-h-screen bg-[#0f172a] text-white p-6 md:p-12 relative overflow-hidden">
            {/* Background Effects */}
            <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 pointer-events-none"></div>
            <div className="absolute top-[-20%] right-[-10%] w-[600px] h-[600px] bg-purple-600/30 rounded-full blur-[100px] pointer-events-none"></div>
            <div className="absolute bottom-[-20%] left-[-10%] w-[600px] h-[600px] bg-blue-600/30 rounded-full blur-[100px] pointer-events-none"></div>

            <div className="max-w-6xl mx-auto relative z-10">
                {/* Header */}
                <header className="flex flex-col md:flex-row justify-between items-center gap-6 mb-16">
                    <div className="flex items-center gap-4">
                        <button onClick={() => navigate(-1)} className="size-12 rounded-2xl bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all backdrop-blur-md">
                            <span className="material-symbols-outlined">arrow_back</span>
                        </button>
                        <div>
                            <h1 className="text-4xl font-black uppercase tracking-tighter italic">
                                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">Relax</span> Zone
                            </h1>
                            <p className="text-slate-400 font-bold text-sm tracking-widest uppercase">Aprenda enquanto se diverte</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-4 bg-white/5 p-2 pr-6 rounded-full border border-white/10 backdrop-blur-md">
                        <div className="size-10 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white shadow-lg shadow-orange-500/20">
                            <span className="material-symbols-outlined text-xl">monetization_on</span>
                        </div>
                        <div>
                            <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest leading-none mb-1">Seu Saldo</p>
                            <p className="text-xl font-black text-white leading-none tracking-tight">{balance.toLocaleString()} <span className="text-amber-400 text-sm">B</span></p>
                        </div>
                    </div>
                </header>

                {/* Game Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">

                    {/* Game 1: Desafio do Milhão */}
                    <div
                        onClick={() => navigate(`/aluno/curso/${courseId}/relax/desafio`)}
                        className="group relative bg-white/5 border border-white/10 rounded-[40px] p-8 hover:bg-white/10 transition-all cursor-pointer hover:scale-[1.02] hover:shadow-2xl hover:shadow-purple-500/20 overflow-hidden"
                    >
                        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 group-hover:h-full transition-all duration-700 opacity-20"></div>

                        <div className="relative z-10 space-y-6">
                            <div className="flex justify-between items-start">
                                <div className="size-16 bg-gradient-to-br from-blue-600 to-purple-600 rounded-3xl flex items-center justify-center shadow-lg shadow-purple-500/30 group-hover:rotate-12 transition-transform duration-500">
                                    <span className="material-symbols-outlined text-3xl">quiz</span>
                                </div>
                                <span className="px-3 py-1 bg-emerald-500/20 text-emerald-400 rounded-full text-[10px] font-black uppercase tracking-widest border border-emerald-500/20">
                                    Populares
                                </span>
                            </div>

                            <div>
                                <h3 className="text-2xl font-black text-white uppercase italic tracking-wide mb-2">Desafio do Milhão</h3>
                                <p className="text-slate-400 text-sm font-medium leading-relaxed">
                                    Teste seus conhecimentos, use ajudas estratégicas e conquiste o prêmio máximo de 1 Milhão de Boras!
                                </p>
                            </div>

                            <button className="w-full py-4 bg-white text-slate-900 rounded-2xl font-black uppercase tracking-widest hover:bg-blue-50 transition-colors flex items-center justify-center gap-2">
                                <span className="material-symbols-outlined">play_circle</span>
                                Jogar Agora
                            </button>
                        </div>
                    </div>

                    {/* Trophy Room Card */}
                    <div
                        onClick={() => navigate(`/aluno/curso/${courseId}/relax/trofeus`)}
                        className="group relative bg-white/5 border border-white/10 rounded-[40px] p-8 hover:bg-white/10 transition-all cursor-pointer hover:scale-[1.02] hover:shadow-2xl hover:shadow-amber-500/20 overflow-hidden"
                    >
                        <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/20 blur-[50px] rounded-full group-hover:bg-amber-500/30 transition-all"></div>

                        <div className="relative z-10 space-y-6">
                            <div className="size-16 bg-gradient-to-br from-amber-400 to-orange-500 rounded-3xl flex items-center justify-center shadow-lg shadow-orange-500/30 group-hover:-rotate-12 transition-transform duration-500">
                                <span className="material-symbols-outlined text-3xl">emoji_events</span>
                            </div>

                            <div>
                                <h3 className="text-2xl font-black text-white uppercase italic tracking-wide mb-2">Sala de Troféus</h3>
                                <p className="text-slate-400 text-sm font-medium leading-relaxed">
                                    Visualize suas conquistas, medalhas e histórico de vitórias lendárias.
                                </p>
                            </div>

                            <button className="w-full py-4 bg-transparent border-2 border-white/20 text-white rounded-2xl font-black uppercase tracking-widest hover:bg-white hover:text-slate-900 transition-all flex items-center justify-center gap-2">
                                <span className="material-symbols-outlined">visibility</span>
                                Ver Coleção
                            </button>
                        </div>
                    </div>

                    {/* Coming Soon */}
                    <div className="bg-white/5 border border-white/5 rounded-[40px] p-8 opacity-50 flex flex-col items-center justify-center text-center space-y-4 grayscale">
                        <span className="material-symbols-outlined text-5xl text-slate-600">sports_esports</span>
                        <h3 className="text-xl font-black text-slate-500 uppercase tracking-widest">Em Breve</h3>
                        <p className="text-xs text-slate-600 font-bold uppercase">Novos jogos em desenvolvimento</p>
                    </div>

                </div>
            </div>
        </div>
    );
};

export default RelaxHub;
