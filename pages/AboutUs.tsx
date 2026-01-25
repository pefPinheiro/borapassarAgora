import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

const AboutUs: React.FC = () => {
    const navigate = useNavigate();
    const [isLoggedIn, setIsLoggedIn] = useState(false);

    useEffect(() => {
        supabase.auth.getUser().then(({ data: { user } }) => setIsLoggedIn(!!user));
    }, []);

    return (
        <div className="min-h-screen bg-white font-sans selection:bg-blue-100 selection:text-blue-900">
            {/* Header / Nav */}
            <nav className="h-20 border-b border-slate-100 flex items-center justify-between px-8 md:px-20 max-w-7xl mx-auto w-full sticky top-0 bg-white/80 backdrop-blur-md z-50">
                <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('/')}>
                    <img src="/bora_passar_logo.png" alt="Bora Passar Agora" className="h-10 w-auto" />
                </div>
                <button
                    onClick={() => isLoggedIn ? navigate('/aluno') : navigate('/login')}
                    className="bg-slate-900 text-white px-6 py-2.5 rounded-xl font-bold text-sm shadow-xl hover:bg-blue-600 transition-all"
                >
                    {isLoggedIn ? 'Voltar ao Portal' : 'Acessar Plataforma'}
                </button>
            </nav>

            <main className="max-w-4xl mx-auto px-8 py-20 space-y-16 animate-in fade-in slide-in-from-bottom-6 duration-700">
                <header className="space-y-6">
                    <h1 className="text-5xl md:text-7xl font-black text-slate-900 tracking-tighter leading-[0.9] uppercase">
                        Nossa Missão é a sua <span className="text-blue-600">Aprovação.</span>
                    </h1>
                    <p className="text-xl text-slate-500 font-medium max-w-2xl leading-relaxed">
                        Nascemos da vontade de transformar o estudo para concursos em uma jornada clara, direta e tecnológica.
                    </p>
                </header>

                <section className="grid grid-cols-1 md:grid-cols-2 gap-12 pt-8">
                    <div className="space-y-4">
                        <div className="size-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center shadow-sm">
                            <span className="material-symbols-outlined">rocket_launch</span>
                        </div>
                        <h3 className="text-xl font-black text-slate-900 uppercase">Tecnologia Própria</h3>
                        <p className="text-slate-500 leading-relaxed font-medium">
                            Desenvolvemos nossa própria plataforma para garantir a melhor experiência de leitura e simulados do mercado.
                        </p>
                    </div>
                    <div className="space-y-4">
                        <div className="size-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center shadow-sm">
                            <span className="material-symbols-outlined">verified_user</span>
                        </div>
                        <h3 className="text-xl font-black text-slate-900 uppercase">Conteúdo Curado</h3>
                        <p className="text-slate-500 leading-relaxed font-medium">
                            Nossos professores são especialistas em concursos específicos, focando no que realmente cai na prova.
                        </p>
                    </div>
                </section>

                <article className="prose prose-slate prose-lg max-w-none bg-slate-50 p-12 rounded-[40px] border border-slate-100">
                    <h2 className="text-slate-900 font-black uppercase tracking-tight">Nossa História</h2>
                    <p>
                        O <strong>Bora Passar Agora</strong> começou com um grupo de concurseiros que cansou de materiais genéricos e plataformas lentas. Decidimos criar algo diferente: um ambiente onde o aluno ganha tempo, não perde.
                    </p>
                    <p>
                        Hoje, somos referência em carreiras policiais e tribunais, com milhares de alunos aprovados em todo o território nacional. Nossa metodologia foca na repetição inteligente e no mapeamento estatístico de bancas.
                    </p>
                </article>

                <footer className="text-center pt-10 border-t border-slate-100">
                    <p className="text-slate-400 text-sm font-bold uppercase tracking-[0.2em]">&copy; 2026 Bora Passar Agora • Todos os direitos reservados</p>
                </footer>
            </main>
        </div>
    );
};

export default AboutUs;
