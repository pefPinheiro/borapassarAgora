import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';

type TicketStatus = 'Aberto' | 'Em Análise' | 'Respondido' | 'Fechado' | 'Resolvido';

interface Message {
  id: string;
  sender_id: string;
  message: string;
  created_at: string;
}

interface Ticket {
  id: string;
  subject: string;
  category: string;
  status: TicketStatus;
  created_at: string;
}

const SupportTicket: React.FC = () => {
  const navigate = useNavigate();
  const [view, setView] = useState<'list' | 'create' | 'detail'>('list');
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessageText, setNewMessageText] = useState('');
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setUserId(user.id);
        fetchTickets(user.id);
      }
    });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, view]);

  // ESCUTAR REALTIME
  useEffect(() => {
    if (!selectedTicket || view !== 'detail') return;

    const channel = supabase
      .channel(`chat-${selectedTicket.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'support_messages',
          filter: `ticket_id=eq.${selectedTicket.id}`
        },
        (payload) => {
          const newMsg = payload.new as Message;
          setMessages((prev) => {
            if (prev.some(m => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'support_tickets',
          filter: `id=eq.${selectedTicket.id}`
        },
        (payload) => {
          const updated = payload.new as Ticket;
          setSelectedTicket(prev => prev ? { ...prev, status: updated.status } : null);
        }
      )
      .subscribe((status) => {
        console.log("Status da conexão Realtime Aluno:", status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedTicket?.id, view]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchTickets = async (uid: string) => {
    setLoading(true);
    const { data, error } = await supabase
      .from('support_tickets')
      .select('*')
      .eq('student_id', uid)
      .order('created_at', { ascending: false });

    if (!error && data) setTickets(data as any);
    setLoading(false);
  };

  const fetchMessages = async (ticketId: string) => {
    const { data, error } = await supabase
      .from('support_messages')
      .select('*')
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: true });

    if (!error && data) setMessages(data as any);
  };

  const openTicketDetail = (ticket: Ticket) => {
    setSelectedTicket(ticket);
    fetchMessages(ticket.id);
    setView('detail');
  };

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;

    const formData = new FormData(e.target as HTMLFormElement);
    const subject = formData.get('subject') as string;
    const category = formData.get('category') as string;
    const initialMessage = formData.get('message') as string;

    try {
      const { data: ticketData } = await supabase
        .from('support_tickets')
        .insert([{ student_id: userId, subject, category, status: 'Aberto' }])
        .select()
        .single();

      if (ticketData) {
        await supabase
          .from('support_messages')
          .insert([{ ticket_id: ticketData.id, sender_id: userId, message: initialMessage }]);

        await fetchTickets(userId);
        setView('list');
      }
    } catch (error) {
      console.error('Error creating ticket:', error);
    }
  };

  const handleSendMessage = async () => {
    if (!newMessageText.trim() || !selectedTicket || !userId) return;

    const tempId = `temp-${Date.now()}`;
    const sentText = newMessageText;

    // UI OTIMISTA: Mostra a mensagem imediatamente para o aluno
    const tempMsg: Message = {
      id: tempId,
      sender_id: userId,
      message: sentText,
      created_at: new Date().toISOString()
    };
    setMessages(prev => [...prev, tempMsg]);
    setNewMessageText('');

    try {
      const { data, error } = await supabase
        .from('support_messages')
        .insert([{
          ticket_id: selectedTicket.id,
          sender_id: userId,
          message: sentText
        }])
        .select()
        .single();

      if (error) throw error;

      // Substitui o temp ID pelo ID real do banco
      setMessages(prev => prev.map(m => m.id === tempId ? data : m));

      await supabase
        .from('support_tickets')
        .update({ status: 'Aberto', updated_at: new Date().toISOString() })
        .eq('id', selectedTicket.id);

    } catch (error) {
      setMessages(prev => prev.filter(m => m.id !== tempId));
      setNewMessageText(sentText);
      alert('Erro ao enviar mensagem.');
    }
  };

  if (view === 'create') {
    return (
      <div className="max-w-[600px] mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
        <button onClick={() => setView('list')} className="flex items-center gap-2 text-slate-400 hover:text-blue-600 transition-colors mb-6 font-bold uppercase text-[10px] tracking-widest">
          <span className="material-symbols-outlined text-lg">arrow_back</span>
          Voltar para listagem
        </button>

        <div className="bg-white rounded-[32px] border border-slate-200 shadow-xl overflow-hidden">
          <div className="p-8 bg-slate-50 border-b border-slate-100/50">
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">Novo Chamado</h2>
            <p className="text-slate-500 text-sm font-medium mt-1">Utilize este canal para problemas técnicos, acesso ou financeiro.</p>
          </div>

          <form onSubmit={handleCreateTicket} className="p-8 space-y-6">
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Assunto</label>
              <input name="subject" required className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-blue-500/20 outline-none" placeholder="Ex: Problema no acesso ao curso" />
            </div>

            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Categoria</label>
              <select name="category" className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-blue-500/20 appearance-none outline-none">
                <option>Suporte Técnico</option>
                <option>Financeiro</option>
                <option>Acesso / Login</option>
                <option>Outros</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Mensagem</label>
              <textarea name="message" required rows={4} className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-blue-500/20 resize-none outline-none" placeholder="Digite sua mensagem aqui..."></textarea>
            </div>

            <button type="submit" className="w-full py-5 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl shadow-slate-200">
              Enviar Solicitação
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (view === 'detail' && selectedTicket) {
    return (
      <div className="max-w-[800px] mx-auto h-[calc(100vh-160px)] flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-500">
        <header className="flex items-center justify-between mb-6">
          <button onClick={() => setView('list')} className="flex items-center gap-2 text-slate-400 hover:text-blue-600 transition-colors font-bold uppercase text-[10px] tracking-widest">
            <span className="material-symbols-outlined text-lg">arrow_back</span>
            Voltar
          </button>
          <div className="text-right">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">#{selectedTicket.id.slice(0, 8)}</span>
            <div className='flex items-center justify-end gap-2'>
              <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${selectedTicket.status === 'Fechado' || selectedTicket.status === 'Resolvido' ? 'bg-red-100 text-red-600' :
                selectedTicket.status === 'Respondido' ? 'bg-blue-100 text-blue-600' :
                  'bg-emerald-100 text-emerald-600'
                }`}>{selectedTicket.status}</span>
              <h2 className="text-lg font-black text-slate-900 leading-none">{selectedTicket.subject}</h2>
            </div>
          </div>
        </header>

        <div className="flex-1 bg-white rounded-[32px] border border-slate-200 shadow-xl overflow-hidden flex flex-col">
          <div className="flex-1 p-8 overflow-y-auto space-y-6 custom-scrollbar bg-slate-50/50">
            {messages.map((msg) => {
              const isMine = msg.sender_id === userId;
              return (
                <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] p-5 rounded-2xl shadow-sm ${isMine
                    ? 'bg-blue-600 text-white rounded-br-none'
                    : 'bg-white text-slate-700 rounded-bl-none border border-slate-100'
                    }`}>
                    <p className="text-sm font-medium leading-relaxed whitespace-pre-wrap">{msg.message}</p>
                    <span className={`text-[9px] font-bold uppercase opacity-60 mt-2 block ${isMine ? 'text-blue-100' : 'text-slate-400'}`}>
                      {isMine ? 'Você' : 'Suporte'} • {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          <div className="p-6 bg-white border-t border-slate-100">
            {selectedTicket.status === 'Fechado' || selectedTicket.status === 'Resolvido' ? (
              <div className="bg-slate-100 border border-slate-200 p-4 rounded-2xl flex items-center justify-center gap-2 text-slate-500 font-bold text-xs uppercase tracking-widest">
                <span className="material-symbols-outlined text-lg">lock</span>
                Chamado Fechado
              </div>
            ) : (
              <div className="relative">
                <input
                  value={newMessageText}
                  onChange={(e) => setNewMessageText(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                  className="w-full pl-6 pr-16 py-5 bg-slate-50 border border-slate-200 rounded-[2rem] text-sm font-bold focus:ring-4 focus:ring-blue-500/10 transition-all outline-none"
                  placeholder="Digite sua resposta..."
                />
                <button
                  onClick={handleSendMessage}
                  className="absolute right-2 top-1/2 -translate-y-1/2 size-12 bg-slate-900 text-white rounded-full flex items-center justify-center hover:scale-110 active:scale-95 transition-all shadow-lg"
                >
                  <span className="material-symbols-outlined">send</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[800px] mx-auto space-y-10 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-slate-200 pb-10">
        <div className="space-y-2">
          <div className="px-3 py-1 bg-blue-600/10 text-blue-600 text-[10px] font-black rounded-full uppercase tracking-widest inline-block">Central de Ajuda</div>
          <h2 className="text-4xl font-black text-slate-900 tracking-tight">Como podemos ajudar?</h2>
          <p className="text-slate-500 font-medium tracking-tight">Nossa equipe está pronta para tirar suas dúvidas.</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={() => navigate('/aluno/faq')}
            className="px-6 py-4 bg-white border-2 border-slate-100 text-slate-600 rounded-2xl font-black uppercase text-[10px] tracking-[0.15em] hover:bg-slate-50 transition-all flex items-center gap-3"
          >
            <span className="material-symbols-outlined text-xl">live_help</span>
            Perguntas Frequentes
          </button>
          <button
            onClick={() => setView('create')}
            className="px-6 py-4 bg-blue-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-[0.15em] hover:bg-blue-700 hover:scale-105 active:scale-95 transition-all shadow-xl shadow-blue-600/20 flex items-center gap-3"
          >
            <span className="material-symbols-outlined text-xl">add_circle</span>
            Abrir Novo Ticket
          </button>
        </div>
      </div>

      <div className="bg-white rounded-[32px] border border-slate-200 shadow-xl overflow-hidden">
        <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <h3 className="font-black text-slate-900 flex items-center gap-3">
            <span className="material-symbols-outlined text-blue-600">history</span>
            Seus Chamados
          </h3>
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{tickets.length} Históricos</span>
        </div>

        <div className="divide-y divide-slate-100">
          {loading ? (
            <div className="p-10 text-center text-slate-400 font-bold">Carregando...</div>
          ) : tickets.length === 0 ? (
            <div className="p-20 text-center space-y-4">
              <div className="size-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto text-slate-200">
                <span className="material-symbols-outlined text-4xl">inbox</span>
              </div>
              <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">Nenhum chamado aberto</p>
            </div>
          ) : (
            tickets.map(ticket => (
              <div
                key={ticket.id}
                onClick={() => openTicketDetail(ticket)}
                className="p-8 flex items-center justify-between hover:bg-slate-50 transition-all cursor-pointer group"
              >
                <div className="flex items-center gap-6">
                  <div className={`size-14 rounded-2xl flex items-center justify-center transition-all ${ticket.status === 'Resolvido' || ticket.status === 'Fechado' ? 'bg-slate-100 text-slate-500' : 'bg-blue-50 text-blue-600'
                    } group-hover:scale-110`}>
                    <span className="material-symbols-outlined text-2xl">
                      {ticket.status === 'Resolvido' || ticket.status === 'Fechado' ? 'lock' : 'forum'}
                    </span>
                  </div>
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest">#{ticket.id.slice(0, 8)}</span>
                      <span className="size-1 bg-slate-200 rounded-full"></span>
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{ticket.category}</span>
                    </div>
                    <h4 className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors">{ticket.subject}</h4>
                    <p className="text-xs text-slate-400 font-medium mt-1 uppercase tracking-tight">{new Date(ticket.created_at).toLocaleDateString()}</p>
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest shadow-sm ${ticket.status === 'Resolvido' || ticket.status === 'Fechado' ? 'bg-slate-200 text-slate-500' :
                    ticket.status === 'Respondido' ? 'bg-blue-500 text-white' :
                      'bg-emerald-500 text-white'
                    }`}>
                    {ticket.status}
                  </span>
                  <span className="material-symbols-outlined text-slate-300 group-hover:translate-x-2 transition-transform">chevron_right</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-slate-900 p-8 rounded-[32px] text-white flex items-center justify-between group cursor-pointer hover:bg-slate-800 transition-all">
          <div className="space-y-2">
            <h4 className="text-lg font-black tracking-tight">WhatsApp Suporte</h4>
            <p className="text-white/60 text-sm font-medium">Atendimento ultra-rápido via celular.</p>
          </div>
          <div className="size-12 bg-white/10 rounded-2xl flex items-center justify-center group-hover:bg-emerald-500 transition-all">
            <span className="material-symbols-outlined">call</span>
          </div>
        </div>
        <div className="bg-[#144bb8] p-8 rounded-[32px] text-white flex items-center justify-between group cursor-pointer hover:bg-blue-800 transition-all">
          <div className="space-y-2">
            <h4 className="text-lg font-black tracking-tight">E-mail Direto</h4>
            <p className="text-white/60 text-sm font-medium">Para assuntos formais e parcerias.</p>
          </div>
          <div className="size-12 bg-white/10 rounded-2xl flex items-center justify-center group-hover:bg-white/20 transition-all">
            <span className="material-symbols-outlined">mail</span>
          </div>
        </div>
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
      `}</style>
    </div>
  );
};

export default SupportTicket;
