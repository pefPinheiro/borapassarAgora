import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

interface RankItem {
    user_id: string;
    full_name: string;
    avatar_url: string;
    total_score: number;
}

interface GameRankProps {
    courseId: string;
    gameType: string;
    onClose: () => void;
    gameTitle?: string;
}

const GameRank: React.FC<GameRankProps> = ({ courseId, gameType, onClose, gameTitle = 'Ranking' }) => {
    const [rankData, setRankData] = useState<RankItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentUser, setCurrentUser] = useState<string | null>(null);

    useEffect(() => {
        const fetchRank = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) setCurrentUser(user.id);

            try {
                const { data, error } = await supabase.rpc('get_game_ranking', {
                    p_course_id: courseId,
                    p_game_type: gameType
                });

                if (error) throw error;
                setRankData(data || []);
            } catch (error) {
                console.error('Error fetching ranking:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchRank();
    }, [courseId, gameType]);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm" onClick={onClose}></div>
            <div className="relative bg-[#1e293b] w-full max-w-md rounded-[40px] border border-slate-700 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col max-h-[85vh]">

                {/* Header */}
                <div className="p-8 pb-4 text-center bg-gradient-to-b from-slate-800 to-[#1e293b]">
                    <div className="size-16 mx-auto bg-gradient-to-br from-amber-400 to-orange-500 rounded-2xl flex items-center justify-center shadow-lg shadow-orange-500/30 mb-4 rotate-3">
                        <span className="material-symbols-outlined text-3xl text-white">trophy</span>
                    </div>
                    <h2 className="text-2xl font-black text-white uppercase italic tracking-wider">Top 10 Melhores</h2>
                    <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">{gameTitle}</p>
                </div>

                {/* List */}
                <div className="flex-1 overflow-y-auto p-6 space-y-3 no-scrollbar">
                    {loading ? (
                        <div className="text-center py-10">
                            <div className="size-8 border-4 border-slate-600 border-t-amber-500 rounded-full animate-spin mx-auto mb-4"></div>
                            <p className="text-xs text-slate-500 uppercase font-black">Carregando...</p>
                        </div>
                    ) : rankData.length === 0 ? (
                        <div className="text-center py-10 bg-white/5 rounded-3xl border border-white/5">
                            <span className="material-symbols-outlined text-4xl text-slate-600 mb-2">sentiment_dissatisfied</span>
                            <p className="text-sm text-slate-400 font-bold">Nenhum registro ainda.</p>
                            <p className="text-[10px] text-slate-500 uppercase mt-1">Seja o primeiro!</p>
                        </div>
                    ) : (
                        rankData.map((item, index) => {
                            const isMe = item.user_id === currentUser;
                            let medalColor = 'bg-slate-700 text-slate-400';
                            if (index === 0) medalColor = 'bg-amber-400 text-amber-900 ring-4 ring-amber-400/20';
                            if (index === 1) medalColor = 'bg-slate-300 text-slate-800';
                            if (index === 2) medalColor = 'bg-orange-400 text-orange-900';

                            return (
                                <div
                                    key={item.user_id}
                                    className={`flex items-center gap-4 p-3 rounded-2xl transition-all ${isMe ? 'bg-indigo-500/20 border border-indigo-500/50' : 'bg-white/5 border border-white/5'}`}
                                >
                                    <div className={`size-8 rounded-lg flex items-center justify-center font-black text-sm shrink-0 ${medalColor}`}>
                                        {index + 1}º
                                    </div>

                                    <div className="size-10 rounded-full bg-slate-700 overflow-hidden shrink-0 border-2 border-slate-600">
                                        {item.avatar_url ? (
                                            <img src={item.avatar_url} alt="" className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-slate-500">
                                                <span className="material-symbols-outlined text-lg">person</span>
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <div className={`font-bold truncate text-sm ${isMe ? 'text-indigo-300' : 'text-slate-200'}`}>
                                            {item.full_name || 'Aluno BPA'}
                                        </div>
                                        <div className="text-[10px] text-slate-500 uppercase font-black tracking-wider">
                                            {isMe && <span className="text-indigo-400 mr-2">VOCÊ</span>}
                                            Curso Atual
                                        </div>
                                    </div>

                                    <div className="text-right">
                                        <div className="text-amber-400 font-black text-sm">{item.total_score.toLocaleString()}</div>
                                        <div className="text-[9px] text-slate-500 uppercase font-bold tracking-wider">Boras</div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 pt-0">
                    <button
                        onClick={onClose}
                        className="w-full py-4 bg-slate-800 text-slate-300 rounded-2xl font-black uppercase tracking-widest hover:bg-slate-700 hover:text-white transition-all text-xs"
                    >
                        Fechar Ranking
                    </button>
                </div>
            </div>
        </div>
    );
};

export default GameRank;
