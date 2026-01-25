
import React from 'react';
import { useNavigate } from 'react-router-dom';

const NotFound: React.FC = () => {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-8 font-sans selection:bg-blue-100 selection:text-blue-900">
            <div className="max-w-md w-full text-center space-y-8 animate-in zoom-in-95 duration-500">
                <div className="relative">
                    <h1 className="text-[180px] font-black text-slate-200 leading-none tracking-tighter select-none">404</h1>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pt-10">
                        <div className="size-20 bg-white rounded-[32px] shadow-2xl flex items-center justify-center text-blue-600 mb-4 animate-bounce duration-[2000ms]">
                            <span className="material-symbols-outlined text-4xl">travel_explore</span>
                        </div>
                    </div>
                </div>

                <div className="space-y-3">
                    <h2 className="text-3xl font-black text-slate-900 uppercase tracking-tight">Caminho Bloqueado!</h2>
                    <p className="text-slate-500 font-medium">Parece que você tentou acessar um conteúdo que não existe ou foi movido para outra área do portal.</p>
                </div>

                <div className="pt-4 flex flex-col sm:flex-row gap-4">
                    <button
                        onClick={() => navigate(-1)}
                        className="flex-[1] py-4 bg-white border border-slate-200 text-slate-600 rounded-2xl font-bold hover:bg-slate-50 transition-all uppercase tracking-widest text-xs"
                    >
                        Voltar
                    </button>
                    <button
                        onClick={() => navigate('/')}
                        className="flex-[2] py-4 bg-slate-900 text-white rounded-2xl font-black shadow-2xl shadow-slate-200 hover:bg-blue-600 transition-all uppercase tracking-widest text-xs"
                    >
                        Ir para o Início
                    </button>
                </div>

                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.3em]">Bora Passar Agora • Tecnologia de Aprovação</p>
            </div>
        </div>
    );
};

export default NotFound;
