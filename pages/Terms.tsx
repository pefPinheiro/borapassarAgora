import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

const Terms: React.FC = () => {
    const navigate = useNavigate();
    const [isLoggedIn, setIsLoggedIn] = useState(false);

    useEffect(() => {
        supabase.auth.getUser().then(({ data: { user } }) => setIsLoggedIn(!!user));
    }, []);

    return (
        <div className="min-h-screen bg-slate-50 font-sans selection:bg-blue-100 selection:text-blue-900">
            {/* Header Simples */}
            <nav className="h-20 bg-white border-b border-slate-200 flex items-center justify-between px-8 md:px-20 sticky top-0 z-50">
                <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('/')}>
                    <img src="/bora_passar_logo.png" alt="Bora Passar Agora" className="h-10 w-auto" />
                </div>
                <button onClick={() => navigate(-1)} className="text-slate-400 font-bold hover:text-slate-900 transition-all text-sm flex items-center gap-2 uppercase tracking-widest">
                    <span className="material-symbols-outlined text-sm">arrow_back</span>
                    Voltar
                </button>
            </nav>

            <main className="max-w-4xl mx-auto px-8 py-20 animate-in fade-in duration-700">
                <div className="bg-white p-12 md:p-20 rounded-[48px] shadow-2xl shadow-slate-200 border border-white">
                    <header className="mb-12 border-b border-slate-100 pb-12">
                        <p className="text-[10px] font-black text-blue-600 uppercase tracking-[0.3em] mb-4">Atualizado em 10 de Janeiro de 2026</p>
                        <h1 className="text-5xl font-black text-slate-900 tracking-tighter uppercase leading-none">Termos de <span className="text-slate-400">Uso &</span> Privacidade.</h1>
                    </header>

                    <div className="prose prose-slate prose-lg max-w-none space-y-12 text-slate-600">
                        <section>
                            <h2 className="text-slate-900 font-black uppercase tracking-tight text-xl mb-4">1. Do Acesso e Uso</h2>
                            <p>
                                O acesso à plataforma <strong>Bora Passar Agora</strong> é pessoal e intransferível. O compartilhamento de credenciais de acesso resulta no bloqueio imediato da conta sem direito a reembolso, visando a segurança dos dados e a proteção intelectual do conteúdo.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-slate-900 font-black uppercase tracking-tight text-xl mb-4">2. Propriedade Intelectual</h2>
                            <p>
                                Todo o conteúdo disponível, incluindo PDFs, videoaulas, simulados e questões, é de propriedade exclusiva da nossa plataforma. A reprodução total ou parcial, download não autorizado ou distribuição é crime previsto em lei.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-slate-900 font-black uppercase tracking-tight text-xl mb-4">3. Política de Reembolso</h2>
                            <p>
                                Garantimos o direito de arrependimento em até 7 dias após a compra, conforme o Código de Defesa do Consumidor. O processo de estorno deve ser solicitado via Ticket de Suporte.
                            </p>
                        </section>

                        <section className="bg-slate-50 p-8 rounded-[32px] border border-slate-100 space-y-4">
                            <div className="flex items-center gap-3 text-emerald-600">
                                <span className="material-symbols-outlined">security</span>
                                <h4 className="font-bold uppercase tracking-widest text-sm">Privacidade de Dados</h4>
                            </div>
                            <p className="text-sm font-medium leading-relaxed">
                                Seus dados estão protegidos pela LGPD. Não vendemos suas informações para terceiros. Utilizamos cookies apenas para melhorar sua experiência de navegação e performance da plataforma.
                            </p>
                        </section>
                    </div>

                    <footer className="mt-20 pt-10 border-t border-slate-100 flex flex-col items-center gap-6">
                        <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Dúvidas sobre os termos? Entre em contato com o suporte.</p>
                        <button
                            onClick={() => isLoggedIn ? navigate('/aluno') : navigate('/')}
                            className="px-12 py-4 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-[0.2em] text-xs shadow-xl hover:bg-blue-600 transition-all"
                        >
                            {isLoggedIn ? 'Voltar ao Portal' : 'Aceitar e Voltar'}
                        </button>
                    </footer>
                </div>
            </main>
        </div>
    );
};

export default Terms;
