
import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface FaqItem {
    id: string;
    pergunta: string;
    resposta: string;
    categoria: 'Geral' | 'Financeiro' | 'Plataforma' | 'Conteúdo';
    status: 'Ativo' | 'Rascunho';
}

const FaqStudent: React.FC = () => {
    const [items, setItems] = useState<FaqItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedCategory, setSelectedCategory] = useState<string>('Todos');
    const [openId, setOpenId] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        fetchFaqs();
    }, []);

    const fetchFaqs = async () => {
        try {
            const { data, error } = await supabase
                .from('faq')
                .select('*')
                .eq('status', 'Ativo')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setItems(data || []);
        } catch (error) {
            console.error('Error fetching FAQs:', error);
        } finally {
            setLoading(false);
        }
    };

    const categories = ['Todos', 'Geral', 'Financeiro', 'Plataforma', 'Conteúdo'];

    const filteredItems = items.filter(item => {
        const matchesCategory = selectedCategory === 'Todos' || item.categoria === selectedCategory;
        const matchesSearch = item.pergunta.toLowerCase().includes(searchQuery.toLowerCase()) ||
            item.resposta.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesCategory && matchesSearch;
    });

    const toggleItem = (id: string) => {
        setOpenId(openId === id ? null : id);
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-500 pb-20">
            {/* Header section with gradient */}
            <div className="relative rounded-[32px] overflow-hidden bg-gradient-to-r from-blue-600 to-violet-600 p-8 md:p-12 shadow-2xl shadow-blue-900/20">
                <div className="relative z-10 max-w-2xl">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 text-white backdrop-blur-sm mb-6 border border-white/20">
                        <span className="material-symbols-outlined text-[14px]">live_help</span>
                        <span className="text-[10px] font-black uppercase tracking-widest">Central de Ajuda</span>
                    </div>
                    <h1 className="text-3xl md:text-5xl font-black text-white mb-4 tracking-tight">Perguntas Frequentes</h1>
                    <p className="text-blue-100 text-lg font-medium leading-relaxed">
                        Encontre respostas rápidas para as principais dúvidas sobre a plataforma, pagamentos e conteúdos.
                    </p>
                </div>

                {/* Decorative elements */}
                <div className="absolute right-0 top-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
                <div className="absolute left-0 bottom-0 w-48 h-48 bg-black/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2"></div>
            </div>

            {/* Search and Filters */}
            <div className="flex flex-col md:flex-row gap-6 sticky top-0 bg-[#f8fafc]/90 backdrop-blur-md py-4 z-20 -mx-4 px-4 md:mx-0 md:px-0">
                <div className="flex-1 relative group">
                    <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors">search</span>
                    <input
                        type="text"
                        placeholder="Pesquisar dúvida..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full h-14 pl-12 pr-6 bg-white border border-slate-200 rounded-2xl font-medium text-slate-700 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all shadow-sm shadow-slate-200/50"
                    />
                </div>
                <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0 no-scrollbar">
                    {categories.map(cat => (
                        <button
                            key={cat}
                            onClick={() => setSelectedCategory(cat)}
                            className={`px-6 h-14 rounded-2xl font-bold whitespace-nowrap transition-all border ${selectedCategory === cat
                                    ? 'bg-slate-900 text-white border-slate-900 shadow-lg shadow-slate-900/20 scale-105'
                                    : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50 hover:text-slate-900'
                                }`}
                        >
                            {cat}
                        </button>
                    ))}
                </div>
            </div>

            {/* Content Grid */}
            <div className="grid grid-cols-1 gap-4">
                {loading ? (
                    <div className="text-center py-20">
                        <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-slate-200 border-t-blue-500 mb-4"></div>
                        <p className="text-slate-400 font-bold">Carregando perguntas...</p>
                    </div>
                ) : filteredItems.length === 0 ? (
                    <div className="text-center py-20 bg-white rounded-[32px] border border-slate-100">
                        <span className="material-symbols-outlined text-4xl text-slate-300 mb-4">search_off</span>
                        <p className="text-slate-500 font-bold text-lg">Nenhuma pergunta encontrada</p>
                        <p className="text-slate-400">Tente buscar por outros termos ou categorias</p>
                    </div>
                ) : (
                    filteredItems.map((item, index) => (
                        <div
                            key={item.id}
                            className={`bg-white rounded-[24px] border border-slate-200 overflow-hidden transition-all duration-500 ${openId === item.id
                                    ? 'shadow-xl shadow-blue-900/5 border-blue-200 ring-1 ring-blue-100'
                                    : 'hover:shadow-lg hover:border-slate-300'
                                }`}
                            style={{ animationDelay: `${index * 50}ms` }}
                        >
                            <button
                                onClick={() => toggleItem(item.id)}
                                className="w-full flex items-start gap-4 p-6 text-left"
                            >
                                <div className={`mt-1 size-8 rounded-full flex items-center justify-center shrink-0 transition-colors ${openId === item.id ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-400 group-hover:bg-slate-200'
                                    }`}>
                                    <span className="material-symbols-outlined text-[20px]">
                                        {openId === item.id ? 'remove' : 'add'}
                                    </span>
                                </div>
                                <div className="flex-1">
                                    <h3 className={`text-lg font-bold transition-colors ${openId === item.id ? 'text-blue-700' : 'text-slate-900'
                                        }`}>
                                        {item.pergunta}
                                    </h3>
                                    {openId !== item.id && (
                                        <div className="mt-2 flex items-center gap-2">
                                            <span className="px-2.5 py-1 bg-slate-100 rounded-lg text-[10px] font-black uppercase tracking-widest text-slate-500">
                                                {item.categoria}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </button>

                            <div className={`transition-all duration-300 ease-in-out ${openId === item.id ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'
                                }`}>
                                <div className="px-6 pb-8 pl-[4.5rem] pr-8">
                                    <div
                                        className="prose prose-slate prose-p:text-slate-600 prose-a:text-blue-600 max-w-none text-base"
                                        dangerouslySetInnerHTML={{ __html: item.resposta }}
                                    />
                                    <div className="mt-6 pt-6 border-t border-slate-100 flex items-center justify-between">
                                        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                                            Foi útil?
                                        </span>
                                        <div className="flex gap-2">
                                            <button className="p-2 hover:bg-emerald-50 text-slate-400 hover:text-emerald-600 rounded-lg transition-colors">
                                                <span className="material-symbols-outlined text-[18px]">thumb_up</span>
                                            </button>
                                            <button className="p-2 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-lg transition-colors">
                                                <span className="material-symbols-outlined text-[18px]">thumb_down</span>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            <style>{`
                .no-scrollbar::-webkit-scrollbar { display: none; }
                .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
            `}</style>
        </div>
    );
};

export default FaqStudent;
