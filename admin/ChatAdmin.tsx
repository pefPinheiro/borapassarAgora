import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

interface Message {
    id: string;
    sender_id: string;
    message: string;
    created_at: string;
}

interface ChatSession {
    id: string; // ticket_id
    studentId: string;
    studentName: string;
    lastMessage: string;
    lastTime: string;
    unreadCount: number;
    status: 'online' | 'offline';
    ticketStatus: string;
    subject: string;
    category: string;
}

const ChatAdmin: React.FC = () => {
    const [sessions, setSessions] = useState<ChatSession[]>([]);
    const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputText, setInputText] = useState('');
    const [filterText, setFilterText] = useState('');
    const [loadingSessions, setLoadingSessions] = useState(true);
    const [isStudentModalOpen, setIsStudentModalOpen] = useState(false);
    const [studentDetails, setStudentDetails] = useState<any>(null);
    const [loadingStudent, setLoadingStudent] = useState(false);

    const fetchStudentDetails = async (studentId: string) => {
        setLoadingStudent(true);
        try {
            // 1. Profile Data
            const { data: profile } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', studentId)
                .single();

            // 2. Enrollments
            const { data: enrollments } = await supabase
                .from('enrollments')
                .select('*, courses(title)')
                .eq('profile_id', studentId);

            // 3. User Stats (Simulados)
            const { data: simulados } = await supabase
                .from('student_simulado_attempts')
                .select('*')
                .eq('student_id', studentId);

            setStudentDetails({
                profile,
                enrollments: enrollments || [],
                simuladosCount: simulados?.length || 0,
                lastAccess: profile?.last_sign_in_at || 'N/A' // Note: profiles table might not have last_sign_in_at by default depending on schema, using placeholder if needed
            });
            setIsStudentModalOpen(true);

        } catch (e) {
            console.error(e);
            alert('Erro ao buscar dados do aluno');
        } finally {
            setLoadingStudent(false);
        }
    };
    const [adminId, setAdminId] = useState<string | null>(null);

    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        supabase.auth.getUser().then(({ data: { user } }) => {
            if (user) setAdminId(user.id);
        });
        fetchSessions();

        const ticketsChannel = supabase
            .channel('admin-global-tickets')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'support_tickets' },
                () => {
                    fetchSessions();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(ticketsChannel);
        };
    }, []);

    useEffect(() => {
        if (!activeSessionId) return;

        const msgChannel = supabase
            .channel(`admin-chat-active-${activeSessionId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'support_messages',
                    filter: `ticket_id=eq.${activeSessionId}`
                },
                (payload) => {
                    const newMsg = payload.new as Message;
                    setMessages((prev) => {
                        if (prev.some(m => m.id === newMsg.id)) return prev;
                        return [...prev, newMsg];
                    });
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(msgChannel);
        };
    }, [activeSessionId]);

    useEffect(() => {
        scrollToBottom();
    }, [messages, activeSessionId]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    const fetchSessions = async () => {
        try {
            const { data: tickets, error } = await supabase
                .from('support_tickets')
                .select('*')
                .order('updated_at', { ascending: false });

            if (error) throw error;

            if (!tickets) {
                setSessions([]);
                return;
            }

            const loadedSessions: ChatSession[] = await Promise.all(tickets.map(async (t: any) => {
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('full_name')
                    .eq('id', t.student_id)
                    .single();

                const { data: lastMsg } = await supabase
                    .from('support_messages')
                    .select('message, created_at')
                    .eq('ticket_id', t.id)
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .single();

                return {
                    id: t.id,
                    studentId: t.student_id,
                    studentName: profile?.full_name || 'Aluno Desconhecido',
                    lastMessage: lastMsg?.message || 'Sem mensagens',
                    lastTime: lastMsg ? new Date(lastMsg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
                    unreadCount: 0,
                    status: 'offline',
                    ticketStatus: t.status,
                    subject: t.subject,
                    category: t.category
                };
            }));

            setSessions(loadedSessions);
        } catch (err) {
            console.error('Error fetching sessions:', err);
        } finally {
            setLoadingSessions(false);
        }
    };

    const fetchMessages = async (ticketId: string) => {
        const { data, error } = await supabase
            .from('support_messages')
            .select('*')
            .eq('ticket_id', ticketId)
            .order('created_at', { ascending: true });

        if (!error && data) {
            setMessages(data as any);
        }
    };

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!inputText.trim() || !activeSessionId || !adminId) return;

        const sentText = inputText;
        setInputText('');

        try {
            const { error } = await supabase
                .from('support_messages')
                .insert([{
                    ticket_id: activeSessionId,
                    sender_id: adminId,
                    message: sentText
                }]);

            if (error) throw error;

            await supabase
                .from('support_tickets')
                .update({ status: 'Respondido', updated_at: new Date().toISOString() })
                .eq('id', activeSessionId);

        } catch (err) {
            console.error("Error sending message", err);
            setInputText(sentText);
            alert("Erro ao enviar mensagem");
        }
    };

    const handleCloseTicket = async () => {
        if (!activeSessionId) return;
        try {
            await supabase
                .from('support_tickets')
                .update({ status: 'Fechado', updated_at: new Date().toISOString() })
                .eq('id', activeSessionId);
        } catch (err) {
            console.error("Error closing ticket", err);
        }
    };

    const filteredSessions = sessions.filter(s =>
        s.studentName.toLowerCase().includes(filterText.toLowerCase()) ||
        s.subject.toLowerCase().includes(filterText.toLowerCase())
    );

    const activeSession = sessions.find(s => s.id === activeSessionId);
    return (
        <div className="flex h-[calc(100vh-180px)] bg-white rounded-[40px] border border-slate-200 overflow-hidden shadow-sm animate-in fade-in duration-500">
            {/* Sidebar de Conversas */}
            <div className="w-80 border-r border-slate-100 flex flex-col bg-[#f8fafc]">
                {/* ... (sidebar content remains same) ... */}
                <div className="p-6 border-b border-slate-100">
                    <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">Atendimentos</h2>
                    <div className="mt-4 relative">
                        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">search</span>
                        <input
                            type="text"
                            placeholder="Buscar ticket ou aluno..."
                            value={filterText}
                            onChange={(e) => setFilterText(e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded-xl py-2 pl-10 pr-4 text-xs font-bold outline-none focus:border-blue-500 transition-all"
                        />
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    {loadingSessions ? (
                        <div className="p-4 text-center text-xs text-slate-400">Carregando...</div>
                    ) : filteredSessions.map(session => (
                        <div
                            key={session.id}
                            onClick={() => {
                                setActiveSessionId(session.id);
                                fetchMessages(session.id);
                            }}
                            className={`p-4 cursor-pointer transition-all border-b border-slate-50 flex items-center gap-3 relative ${activeSessionId === session.id ? 'bg-white' : 'hover:bg-white/50'
                                }`}
                        >
                            {activeSessionId === session.id && <div className="absolute left-0 top-0 w-1 h-full bg-blue-600"></div>}
                            <div className="relative">
                                <div className="size-10 bg-slate-200 rounded-xl flex items-center justify-center text-slate-500 font-black">
                                    {session.studentName[0]}
                                </div>
                                <div className={`absolute -bottom-1 -right-1 size-3 rounded-full border-2 border-white ${session.ticketStatus === 'Fechado' ? 'bg-slate-400' : 'bg-emerald-500'
                                    }`}></div>
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-center mb-0.5">
                                    <h4 className="text-xs font-black text-slate-900 truncate uppercase tracking-tight">{session.studentName}</h4>
                                    <span className="text-[9px] font-bold text-slate-400">{session.lastTime}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <p className="text-[10px] text-slate-900 font-bold truncate mb-0.5 max-w-[120px]">{session.subject}</p>
                                    <span className={`text-[8px] px-1.5 py-0.5 rounded font-black uppercase ${session.ticketStatus === 'Fechado' ? 'bg-slate-100 text-slate-500' :
                                        session.ticketStatus === 'Respondido' ? 'bg-blue-100 text-blue-600' : 'bg-green-100 text-green-600'
                                        }`}>{session.ticketStatus}</span>
                                </div>
                                <p className="text-[10px] text-slate-500 truncate font-medium">{session.lastMessage}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Área Principal do Chat */}
            <div className="flex-1 flex flex-col bg-white">
                {activeSession ? (
                    <>
                        {/* Header do Chat */}
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                            <div className="flex items-center gap-3">
                                <div className="size-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center font-black">
                                    {activeSession.studentName[0]}
                                </div>
                                <div>
                                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">{activeSession.studentName}</h3>
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded text-slate-500 font-bold uppercase">{activeSession.category}</span>
                                        <span className="text-[10px] text-slate-400 font-bold uppercase truncate max-w-[200px]">{activeSession.subject}</span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => fetchStudentDetails(activeSession.studentId)}
                                    className="px-4 py-2 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2"
                                >
                                    <span className="material-symbols-outlined text-sm">person</span>
                                    Ver Aluno
                                </button>
                                {activeSession.ticketStatus !== 'Fechado' && (
                                    <button
                                        onClick={handleCloseTicket}
                                        className="px-4 py-2 bg-slate-100 hover:bg-red-50 text-slate-600 hover:text-red-500 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2"
                                    >
                                        <span className="material-symbols-outlined text-sm">lock</span>
                                        Fechar Ticket
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Mensagens */}
                        <div className="flex-1 overflow-y-auto p-8 space-y-6 flex flex-col custom-scrollbar">
                            {messages.map(msg => {
                                const isAdmin = msg.sender_id === adminId;
                                return (
                                    <div key={msg.id} className={`flex ${isAdmin ? 'justify-end' : 'justify-start'}`}>
                                        <div className={`max-w-[70%] p-4 rounded-2xl shadow-sm ${isAdmin
                                            ? 'bg-blue-600 text-white rounded-tr-none shadow-blue-100'
                                            : 'bg-slate-50 text-slate-700 rounded-tl-none border border-slate-100'
                                            }`}>
                                            <p className="text-sm font-medium leading-relaxed whitespace-pre-wrap">{msg.message}</p>
                                            <p className={`text-[9px] font-black uppercase mt-2 opacity-60 ${isAdmin ? 'text-blue-100 text-right' : 'text-slate-400 text-left'}`}>
                                                {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </p>
                                        </div>
                                    </div>
                                );
                            })}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Input de Mensagem */}
                        <div className="p-6 border-t border-slate-100">
                            {activeSession.ticketStatus === 'Fechado' ? (
                                <div className="text-center p-4 bg-slate-50 rounded-2xl border border-slate-200">
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center justify-center gap-2">
                                        <span className="material-symbols-outlined">lock</span>
                                        Este atendimento foi encerrado
                                    </p>
                                </div>
                            ) : (
                                <form onSubmit={handleSendMessage} className="flex gap-3">
                                    <div className="flex-1 relative">
                                        <input
                                            type="text"
                                            value={inputText}
                                            onChange={e => setInputText(e.target.value)}
                                            placeholder="Escreva sua resposta..."
                                            className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 pl-6 pr-12 text-sm font-medium outline-none focus:border-blue-500 transition-all"
                                        />
                                        <button type="button" className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-blue-600 transition-colors">
                                            <span className="material-symbols-outlined">sentiment_satisfied</span>
                                        </button>
                                    </div>
                                    <button
                                        type="submit"
                                        className="bg-slate-900 text-white size-14 rounded-2xl flex items-center justify-center hover:bg-blue-600 hover:scale-105 transition-all shadow-xl shadow-slate-100"
                                    >
                                        <span className="material-symbols-outlined">send</span>
                                    </button>
                                </form>
                            )}
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                        <div className="size-20 bg-slate-50 rounded-full flex items-center justify-center text-slate-200 mb-6">
                            <span className="material-symbols-outlined text-4xl">chat</span>
                        </div>
                        <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Selecione um Ticket</h3>
                        <p className="text-sm text-slate-400 font-bold max-w-xs mt-2 uppercase tracking-tight">Escolha um chamado na lista ao lado para iniciar o atendimento.</p>
                    </div>
                )}
            </div>

            {/* Modal de Dados do Aluno */}
            {isStudentModalOpen && studentDetails && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsStudentModalOpen(false)}></div>
                    <div className="relative bg-white w-full max-w-lg rounded-[40px] shadow-2xl p-8 animate-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center mb-8">
                            <div>
                                <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Dados do Aluno</h3>
                                <p className="text-xs font-bold text-emerald-600 uppercase tracking-widest mt-1">
                                    {studentDetails.profile.role === 'student' ? 'Estudante' : studentDetails.profile.role}
                                </p>
                            </div>
                            <button onClick={() => setIsStudentModalOpen(false)} className="size-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all">
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>

                        <div className="space-y-6">
                            <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-3xl border border-slate-100">
                                <div className="size-16 bg-white rounded-2xl flex items-center justify-center text-2xl font-black text-slate-300 shadow-sm">
                                    {studentDetails.profile.full_name[0]}
                                </div>
                                <div>
                                    <h4 className="font-bold text-slate-900 text-lg">{studentDetails.profile.full_name}</h4>
                                    <p className="text-xs text-slate-500 font-medium">{studentDetails.profile.email || 'Email não disponível'}</p>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">
                                        ID: <span className="font-mono">{studentDetails.profile.id.split('-')[0]}...</span>
                                    </p>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-4 bg-blue-50/50 rounded-2xl border border-blue-100">
                                    <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1">Cursos Matriculados</p>
                                    <p className="text-2xl font-black text-blue-600">{studentDetails.enrollments.length}</p>
                                </div>
                                <div className="p-4 bg-emerald-50/50 rounded-2xl border border-emerald-100">
                                    <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-1">Simulados Feitos</p>
                                    <p className="text-2xl font-black text-emerald-600">{studentDetails.simuladosCount}</p>
                                </div>
                            </div>

                            <div>
                                <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3 ml-2">Cursos Ativos</h5>
                                <div className="space-y-2 max-h-40 overflow-y-auto custom-scrollbar pr-2">
                                    {studentDetails.enrollments.length > 0 ? (
                                        studentDetails.enrollments.map((en: any) => (
                                            <div key={en.id} className="p-3 bg-white border border-slate-100 rounded-xl flex items-center justify-between">
                                                <span className="text-xs font-bold text-slate-700 truncate max-w-[200px]">{en.courses?.title}</span>
                                                <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded ${en.status === 'Ativo' ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                                                    {en.status}
                                                </span>
                                            </div>
                                        ))
                                    ) : (
                                        <p className="text-xs text-slate-400 italic pl-2">Nenhum curso matriculado.</p>
                                    )}
                                </div>
                            </div>
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

export default ChatAdmin;
