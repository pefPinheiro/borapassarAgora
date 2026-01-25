
import React, { useState } from 'react';

interface Mensagem {
    id: string;
    autor: string;
    role: 'aluno' | 'admin';
    content: string;
    timestamp: string;
}

interface Ticket {
    id: string;
    aluno: string;
    email: string;
    assunto: string;
    categoria: 'Financeiro' | 'Dúvida Técnica' | 'Conteúdo' | 'Outros';
    prioridade: 'Alta' | 'Normal' | 'Baixa';
    status: 'Aberto' | 'Em Atendimento' | 'Aguardando Aluno' | 'Resolvido';
    dataAbertura: string;
    ultimaAtualizacao: string;
    historico: Mensagem[];
}

const TicketsAdmin: React.FC = () => {
    const [tickets, setTickets] = useState<Ticket[]>([
        {
            id: '#1289',
            aluno: 'Marcos Paulo',
            email: 'marcos.p@email.com',
            assunto: 'Erro ao baixar PDF de Direito',
            categoria: 'Dúvida Técnica',
            prioridade: 'Alta',
            status: 'Aberto',
            dataAbertura: '10/01/2026 14:20',
            ultimaAtualizacao: '10/01/2026 14:20',
            historico: [
                { id: '1', autor: 'Marcos Paulo', role: 'aluno', content: 'Não consigo baixar o material da aula 04.', timestamp: '14:20' }
            ]
        },
        {
            id: '#1290',
            aluno: 'Ana Julia',
            email: 'ana.j@email.com',
            assunto: 'Dúvida aula 03 - Crase',
            categoria: 'Conteúdo',
            prioridade: 'Normal',
            status: 'Em Atendimento',
            dataAbertura: '10/01/2026 15:00',
            ultimaAtualizacao: '10/01/2026 15:45',
            historico: [
                { id: '1', autor: 'Ana Julia', role: 'aluno', content: 'Professor, não entendi a regra da crase antes de pronomes.', timestamp: '15:00' },
                { id: '2', autor: 'Admin', role: 'admin', content: 'Olá Ana, estamos analisando seu caso.', timestamp: '15:45' }
            ]
        }
    ]);

    const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
    const [replyText, setReplyText] = useState('');

    const getStatusColor = (status: Ticket['status']) => {
        switch (status) {
            case 'Aberto': return 'bg-amber-100 text-amber-600 border-amber-200';
            case 'Em Atendimento': return 'bg-blue-100 text-blue-600 border-blue-200';
            case 'Aguardando Aluno': return 'bg-purple-100 text-purple-600 border-purple-200';
            case 'Resolvido': return 'bg-emerald-100 text-emerald-600 border-emerald-200';
            default: return 'bg-slate-100 text-slate-500';
        }
    };

    const handleReply = (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedTicket || !replyText) return;

        const newMessage: Mensagem = {
            id: Math.random().toString(),
            autor: 'Suporte',
            role: 'admin',
            content: replyText,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };

        const updatedTicket = {
            ...selectedTicket,
            status: 'Aguardando Aluno' as const,
            ultimaAtualizacao: new Date().toLocaleString(),
            historico: [...selectedTicket.historico, newMessage]
        };

        setTickets(prev => prev.map(t => t.id === selectedTicket.id ? updatedTicket : t));
        setSelectedTicket(updatedTicket);
        setReplyText('');
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-500 pb-20">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-[#111418] text-3xl font-black tracking-tight uppercase">Central de Tickets</h2>
                    <p className="text-[#617589] font-medium">Gerencie o suporte direto e resolva problemas dos alunos.</p>
                </div>
                <div className="flex bg-white p-1 rounded-xl border border-slate-200 shadow-sm text-[10px] font-black uppercase">
                    <button className="px-4 py-2 bg-slate-900 text-white rounded-lg">Todos</button>
                    <button className="px-4 py-2 text-slate-400 hover:text-slate-900 transition-colors">Pendentes</button>
                    <button className="px-4 py-2 text-slate-400 hover:text-slate-900 transition-colors">Resolvidos</button>
                </div>
            </div>

            <div className="bg-white rounded-[40px] border border-slate-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-[#f8fafc] text-[#64748b] text-[10px] font-black uppercase tracking-widest border-b border-[#f1f5f9]">
                                <th className="px-8 py-5">Ticket</th>
                                <th className="px-8 py-5">Aluno</th>
                                <th className="px-8 py-5">Assunto / Categoria</th>
                                <th className="px-8 py-5 text-center">Prioridade</th>
                                <th className="px-8 py-5 text-right">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[#f1f5f9]">
                            {tickets.map((t) => (
                                <tr
                                    key={t.id}
                                    onClick={() => setSelectedTicket(t)}
                                    className="hover:bg-[#f8fafc] transition-all cursor-pointer group"
                                >
                                    <td className="px-8 py-6">
                                        <span className="text-xs font-black text-blue-600 uppercase tracking-widest">{t.id}</span>
                                    </td>
                                    <td className="px-8 py-6">
                                        <div>
                                            <p className="text-sm font-black text-[#111418] mb-0.5">{t.aluno}</p>
                                            <p className="text-[10px] text-slate-400 font-bold tracking-tight uppercase">{t.email}</p>
                                        </div>
                                    </td>
                                    <td className="px-8 py-6">
                                        <div>
                                            <p className="text-sm font-bold text-slate-700 mb-1">{t.assunto}</p>
                                            <span className="text-[9px] font-black uppercase tracking-widest bg-slate-100 px-2 py-0.5 rounded text-slate-500">{t.categoria}</span>
                                        </div>
                                    </td>
                                    <td className="px-8 py-6 text-center">
                                        <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-full border ${t.prioridade === 'Alta' ? 'bg-red-50 text-red-500 border-red-100 animate-pulse' : 'bg-slate-50 text-slate-400 border-slate-100'
                                            }`}>
                                            {t.prioridade}
                                        </span>
                                    </td>
                                    <td className="px-8 py-6 text-right">
                                        <span className={`px-4 py-1.5 rounded-xl border text-[10px] font-black uppercase tracking-widest ${getStatusColor(t.status)}`}>
                                            {t.status}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {selectedTicket && (
                <div className="fixed inset-0 z-[100] flex items-center justify-end">
                    <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setSelectedTicket(null)}></div>
                    <div className="relative bg-white w-full max-w-xl h-full shadow-2xl animate-in slide-in-from-right duration-300 flex flex-col">
                        {/* Header do Chat */}
                        <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-[#f8fafc]">
                            <div>
                                <p className="text-[10px] font-black text-blue-600 uppercase tracking-[0.2em] mb-1">{selectedTicket.id}</p>
                                <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">{selectedTicket.aluno}</h3>
                            </div>
                            <button onClick={() => setSelectedTicket(null)} className="p-2 text-slate-400 hover:text-slate-900 transition-all">
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>

                        {/* Conteúdo / Histórico */}
                        <div className="flex-1 overflow-y-auto p-8 space-y-6 bg-white custom-scrollbar">
                            <div className="pb-4 border-b border-slate-50">
                                <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Assunto Original</h4>
                                <p className="text-lg font-bold text-slate-800">{selectedTicket.assunto}</p>
                            </div>

                            {selectedTicket.historico.map(msg => (
                                <div key={msg.id} className={`flex ${msg.role === 'admin' ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`max-w-[85%] p-5 rounded-[24px] ${msg.role === 'admin'
                                        ? 'bg-blue-600 text-white rounded-tr-none'
                                        : 'bg-slate-100 text-slate-700 rounded-tl-none border border-slate-200'
                                        }`}>
                                        <p className="text-[10px] font-black uppercase opacity-60 mb-2">{msg.autor} • {msg.timestamp}</p>
                                        <p className="text-sm font-medium leading-relaxed">{msg.content}</p>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Footer / Responder */}
                        <div className="p-8 border-t border-slate-100 bg-[#f8fafc]">
                            <form onSubmit={handleReply} className="space-y-4">
                                <textarea
                                    value={replyText}
                                    onChange={e => setReplyText(e.target.value)}
                                    placeholder="Digite sua resposta aqui..."
                                    className="w-full h-32 p-5 bg-white border border-slate-200 rounded-[24px] font-medium text-sm outline-none focus:border-blue-500 shadow-sm resize-none transition-all"
                                />
                                <div className="flex justify-between items-center">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Shift + Enter para enviar</span>
                                    <button
                                        type="submit"
                                        className="px-8 py-3 bg-slate-900 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-xl shadow-slate-200 hover:bg-slate-800 transition-all active:scale-95"
                                    >
                                        Enviar Resposta
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
          .custom-scrollbar::-webkit-scrollbar { width: 4px; }
          .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
          .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
      `}</style>
        </div>
    );
};

export default TicketsAdmin;
