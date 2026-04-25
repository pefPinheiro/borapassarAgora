import React, { useState, useRef } from 'react';
import RichTextEditor from './RichTextEditor';
import { supabase } from '../lib/supabase';

interface FaqItem {
    id: string;
    pergunta: string;
    resposta: string;
    categoria: 'Geral' | 'Financeiro' | 'Plataforma' | 'Conteúdo';
    status: 'Ativo' | 'Rascunho';
}

const FaqAdmin: React.FC = () => {
    const [items, setItems] = useState<FaqItem[]>([]);
    const [loading, setLoading] = useState(true);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [formData, setFormData] = useState<Partial<FaqItem>>({
        pergunta: '',
        resposta: '',
        categoria: 'Geral',
        status: 'Ativo'
    });

    const fileInputRef = useRef<HTMLInputElement>(null);

    const promptTemplate = `Gere um arquivo JSON contendo uma lista de perguntas e respostas frequentes para uma plataforma de estudos. O formato deve ser exatamente um array de objetos, onde cada objeto tem as seguintes chaves:
- "pergunta": (string) A pergunta do aluno.
- "resposta": (string) A resposta detalhada (pode conter HTML básico como <p>, <b>, <ul>, <li>).
- "categoria": (string) Deve ser uma destas: "Geral", "Financeiro", "Plataforma" ou "Conteúdo".
- "status": (string) Deve ser "Ativo" ou "Rascunho".

Exemplo:
[
  {
    "pergunta": "Como acesso meu curso?",
    "resposta": "<p>Basta fazer login e clicar em <b>Meus Cursos</b> no menu lateral.</p>",
    "categoria": "Plataforma",
    "status": "Ativo"
  }
]`;

    const handleJsonUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const json = JSON.parse(e.target?.result as string);
                
                if (!Array.isArray(json)) {
                    throw new Error('O arquivo JSON deve conter um array de objetos.');
                }

                // Validação básica
                const isValid = json.every(item => 
                    item.pergunta && 
                    item.resposta && 
                    ['Geral', 'Financeiro', 'Plataforma', 'Conteúdo'].includes(item.categoria)
                );

                if (!isValid) {
                    throw new Error('Alguns itens do JSON não estão no formato correto ou possuem categorias inválidas.');
                }

                const { error } = await supabase
                    .from('faq')
                    .insert(json.map(item => ({
                        pergunta: item.pergunta,
                        resposta: item.resposta,
                        categoria: item.categoria,
                        status: item.status || 'Ativo'
                    })));

                if (error) throw error;

                alert(`${json.length} FAQs importadas com sucesso!`);
                fetchFaqs();
            } catch (error: any) {
                console.error('Error importing JSON:', error);
                alert('Erro ao importar JSON: ' + error.message);
            }
        };
        reader.readAsText(file);
        event.target.value = '';
    };

    const categories = ['Geral', 'Financeiro', 'Plataforma', 'Conteúdo'];

    React.useEffect(() => {
        fetchFaqs();
    }, []);

    const fetchFaqs = async () => {
        try {
            const { data, error } = await supabase
                .from('faq')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setItems(data || []);
        } catch (error) {
            console.error('Error fetching FAQs:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleOpenForm = (item?: FaqItem) => {
        if (item) {
            setEditingId(item.id);
            setFormData(item);
        } else {
            setEditingId(null);
            setFormData({ pergunta: '', resposta: '', categoria: 'Geral', status: 'Ativo' });
        }
        setIsModalOpen(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (editingId) {
                const { error } = await supabase
                    .from('faq')
                    .update(formData)
                    .eq('id', editingId);
                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('faq')
                    .insert([formData]);
                if (error) throw error;
            }
            fetchFaqs();
            setIsModalOpen(false);
        } catch (error) {
            console.error('Error saving FAQ:', error);
            alert('Erro ao salvar FAQ');
        }
    };

    const deleteItem = async (id: string) => {
        if (confirm('Deseja excluir esta FAQ?')) {
            try {
                const { error } = await supabase
                    .from('faq')
                    .delete()
                    .eq('id', id);
                if (error) throw error;
                fetchFaqs();
            } catch (error) {
                console.error('Error deleting FAQ:', error);
            }
        }
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-500 pb-20">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-[#111418] text-3xl font-black tracking-tight uppercase">Base de Conhecimento (FAQ)</h2>
                    <p className="text-[#617589] font-medium">Gerencie as dúvidas frequentes para reduzir chamados de suporte.</p>
                </div>
                <div className="flex flex-wrap gap-4">
                    <button
                        onClick={() => {
                            navigator.clipboard.writeText(promptTemplate);
                            alert('Modelo de prompt copiado para a área de transferência!');
                        }}
                        className="flex items-center gap-2 px-6 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-all active:scale-95 border border-slate-200"
                        title="Copiar modelo de prompt para IA"
                    >
                        <span className="material-symbols-outlined">content_copy</span>
                        Prompt IA
                    </button>
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        className="flex items-center gap-2 px-6 py-3 bg-white text-slate-600 border border-slate-200 rounded-xl font-bold shadow-sm hover:bg-slate-50 transition-all active:scale-95"
                    >
                        <span className="material-symbols-outlined">upload_file</span>
                        Importar JSON
                    </button>
                    <button
                        onClick={() => handleOpenForm()}
                        className="flex items-center gap-2 px-6 py-3 bg-[#137fec] text-white rounded-xl font-bold shadow-lg shadow-blue-100 hover:bg-blue-600 transition-all active:scale-95"
                    >
                        <span className="material-symbols-outlined">add_circle</span>
                        Nova Pergunta
                    </button>
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleJsonUpload}
                        accept=".json"
                        className="hidden"
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
                {items.map(item => (
                    <div key={item.id} className="bg-white p-8 rounded-[32px] border border-slate-200 shadow-sm hover:shadow-md transition-all group relative overflow-hidden">
                        <div className="flex justify-between items-start gap-4">
                            <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="px-3 py-1 bg-slate-100 text-slate-500 rounded-lg text-[9px] font-black uppercase tracking-widest">{item.categoria}</span>
                                    {item.status === 'Rascunho' && <span className="px-3 py-1 bg-amber-50 text-amber-600 rounded-lg text-[9px] font-black uppercase tracking-widest">Rascunho</span>}
                                </div>
                                <h4 className="text-xl font-black text-slate-900 mb-4">{item.pergunta}</h4>
                                <div
                                    className="text-sm text-slate-500 prose prose-slate max-w-none line-clamp-2"
                                    dangerouslySetInnerHTML={{ __html: item.resposta }}
                                />
                            </div>
                            <div className="flex flex-col gap-2">
                                <button onClick={() => handleOpenForm(item)} className="p-2.5 bg-slate-50 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all">
                                    <span className="material-symbols-outlined text-[20px]">edit</span>
                                </button>
                                <button onClick={() => deleteItem(item.id)} className="p-2.5 bg-slate-50 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all">
                                    <span className="material-symbols-outlined text-[20px]">delete</span>
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {isModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsModalOpen(false)}></div>
                    <div className="relative bg-white w-full max-w-3xl rounded-[40px] shadow-2xl p-10 animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto custom-scrollbar">
                        <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tight mb-8">
                            {editingId ? 'Editar FAQ' : 'Nova Pergunta Frequente'}
                        </h3>

                        <form onSubmit={handleSubmit} className="space-y-8">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="md:col-span-2 space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Pergunta</label>
                                    <input
                                        required
                                        type="text"
                                        value={formData.pergunta}
                                        onChange={e => setFormData({ ...formData, pergunta: e.target.value })}
                                        placeholder="Ex: Como acesso as vídeo aulas?"
                                        className="w-full h-12 px-5 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none focus:border-blue-500 transition-all"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Categoria</label>
                                    <select
                                        value={formData.categoria}
                                        onChange={e => setFormData({ ...formData, categoria: e.target.value as any })}
                                        className="w-full h-12 px-5 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none"
                                    >
                                        {categories.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Resposta Detalhada</label>
                                <RichTextEditor
                                    value={formData.resposta || ''}
                                    onChange={(content) => setFormData({ ...formData, resposta: content })}
                                    placeholder="Escreva a resposta aqui..."
                                />
                            </div>

                            <div className="flex items-center justify-between p-6 bg-slate-50 rounded-3xl border border-slate-100">
                                <div>
                                    <h4 className="text-xs font-black text-slate-700 uppercase tracking-tight">Status de Publicação</h4>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase">Define se o aluno poderá ver esta dúvida.</p>
                                </div>
                                <div className="flex bg-white p-1 rounded-xl border border-slate-200">
                                    <button
                                        type="button"
                                        onClick={() => setFormData({ ...formData, status: 'Ativo' })}
                                        className={`px-4 py-2 text-[10px] font-black uppercase rounded-lg transition-all ${formData.status === 'Ativo' ? 'bg-emerald-500 text-white shadow-md shadow-emerald-100' : 'text-slate-400'}`}
                                    >Ativo</button>
                                    <button
                                        type="button"
                                        onClick={() => setFormData({ ...formData, status: 'Rascunho' })}
                                        className={`px-4 py-2 text-[10px] font-black uppercase rounded-lg transition-all ${formData.status === 'Rascunho' ? 'bg-amber-500 text-white shadow-md shadow-amber-100' : 'text-slate-400'}`}
                                    >Rascunho</button>
                                </div>
                            </div>

                            <div className="flex gap-4">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-bold hover:bg-slate-200 transition-all uppercase tracking-widest text-xs"
                                >Cancelar</button>
                                <button
                                    type="submit"
                                    className="flex-[2] py-4 bg-slate-900 text-white rounded-2xl font-black shadow-xl hover:bg-slate-800 transition-all uppercase tracking-widest text-xs"
                                >Salvar FAQ</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            <style>{`
          .ql-container.ql-snow { border: none !important; }
          .ql-toolbar.ql-snow { border: none !important; border-bottom: 1px solid #e2e8f0 !important; background: #f8fafc; }
          .custom-scrollbar::-webkit-scrollbar { width: 4px; }
          .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
          .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
      `}</style>
        </div>
    );
};

export default FaqAdmin;
