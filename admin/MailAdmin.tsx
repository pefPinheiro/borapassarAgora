import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import RichTextEditor from './RichTextEditor';

interface Message {
    id: string;
    sender_id: string;
    recipient_id: string;
    subject: string;
    content: string;
    is_read: boolean;
    created_at: string;
    sender?: { full_name: string; email: string; avatar_url: string };
    recipient?: { full_name: string; email: string; avatar_url: string };
}

interface Profile {
    id: string;
    full_name: string;
    email: string;
    role: string;
}

const MailAdmin: React.FC = () => {
    const [user, setUser] = useState<any>(null);
    const [activeFolder, setActiveFolder] = useState<'inbox' | 'sent' | 'trash'>('inbox');
    const [messages, setMessages] = useState<Message[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
    const [isListVisible, setIsListVisible] = useState(true); // Controla visibilidade da lista

    // Compose State
    const [isComposing, setIsComposing] = useState(false);
    const [composeRecipient, setComposeRecipient] = useState('');
    const [recipientList, setRecipientList] = useState<Profile[]>([]);
    const [composeSubject, setComposeSubject] = useState('');
    const [composeBody, setComposeBody] = useState('');
    const [sending, setSending] = useState(false);

    useEffect(() => {
        supabase.auth.getUser().then(({ data: { user } }) => {
            if (user) {
                setUser(user);
                fetchMessages(user.id, activeFolder);
            }
        });
        fetchRecipients();
    }, [activeFolder]);

    const fetchRecipients = async () => {
        const { data } = await supabase
            .from('profiles')
            .select('id, full_name, email, role')
            .in('role', ['admin', 'super', 'editor', 'teacher', 'moderator'])
            .order('full_name');
        if (data) setRecipientList(data);
    };

    const fetchMessages = async (userId: string, folder: string) => {
        setLoading(true);
        let query = supabase.from('admin_messages').select(`
            *,
            sender:sender_id(full_name, email, avatar_url),
            recipient:recipient_id(full_name, email, avatar_url)
        `).order('created_at', { ascending: false });

        if (folder === 'inbox') {
            query = query
                .eq('recipient_id', userId)
                .eq('deleted_by_recipient', false);
        } else if (folder === 'sent') {
            query = query
                .eq('sender_id', userId)
                .eq('deleted_by_sender', false);
        } else if (folder === 'trash') {
            query = query.or(`and(recipient_id.eq.${userId},deleted_by_recipient.eq.true),and(sender_id.eq.${userId},deleted_by_sender.eq.true)`);
        }

        const { data, error } = await query;
        if (error) console.error('Error fetching messages:', error);
        else setMessages(data || []);

        setLoading(false);
    };

    const handleSelectMessage = async (msg: Message) => {
        setSelectedMessageId(msg.id);

        if (activeFolder === 'inbox' && !msg.is_read && user?.id === msg.recipient_id) {
            // Mark as read
            const { error } = await supabase
                .from('admin_messages')
                .update({ is_read: true })
                .eq('id', msg.id);

            if (!error) {
                setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, is_read: true } : m));
            }
        }
    };

    const handleDeleteMessage = async (msg: Message) => {
        if (!user) return;

        const updates: any = {};
        if (msg.sender_id === user.id) updates.deleted_by_sender = true;
        if (msg.recipient_id === user.id) updates.deleted_by_recipient = true;

        const { error } = await supabase
            .from('admin_messages')
            .update(updates)
            .eq('id', msg.id);

        if (!error) {
            fetchMessages(user.id, activeFolder);
            setSelectedMessageId(null);
        }
    };

    const handleSendMessage = async () => {
        if (!user || !composeRecipient || !composeSubject) return;
        setSending(true);

        try {
            if (composeRecipient === 'ALL') {
                // Send to all staff
                const messagesToSend = recipientList.map(rec => ({
                    sender_id: user.id,
                    recipient_id: rec.id,
                    subject: composeSubject,
                    content: composeBody
                }));

                const { error } = await supabase.from('admin_messages').insert(messagesToSend);
                if (error) throw error;
            } else {
                // Send to single recipient
                const { error } = await supabase.from('admin_messages').insert({
                    sender_id: user.id,
                    recipient_id: composeRecipient,
                    subject: composeSubject,
                    content: composeBody
                });
                if (error) throw error;
            }

            setIsComposing(false);
            setComposeSubject('');
            setComposeBody('');
            setComposeRecipient('');
            if (activeFolder === 'sent') fetchMessages(user.id, 'sent');
            alert('Mensagem enviada com sucesso!');
        } catch (error: any) {
            alert('Erro ao enviar mensagem: ' + error.message);
        } finally {
            setSending(false);
        }
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return {
            date: date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }),
            time: date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
        };
    };

    const selectedMessage = messages.find(m => m.id === selectedMessageId);

    const folders = [
        { id: 'inbox', label: 'Caixa de Entrada', icon: 'inbox' },
        { id: 'sent', label: 'Enviados', icon: 'send' },
        { id: 'trash', label: 'Lixeira', icon: 'delete' },
    ];

    return (
        <div className="flex h-[calc(100vh-160px)] bg-white rounded-[40px] border border-slate-200 shadow-sm overflow-hidden animate-in fade-in duration-500">
            {/* Sidebar de Pastas */}
            <aside className="w-64 border-r border-slate-100 flex flex-col shrink-0 bg-slate-50/50">
                <div className="p-6">
                    <button
                        onClick={() => setIsComposing(true)}
                        className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-xl shadow-slate-900/10 hover:bg-slate-800 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2"
                    >
                        <span className="material-symbols-outlined text-sm">edit</span>
                        Escrever
                    </button>
                </div>

                <nav className="flex-1 px-4 space-y-2">
                    {folders.map(folder => (
                        <button
                            key={folder.id}
                            onClick={() => { setActiveFolder(folder.id as any); setSelectedMessageId(null); }}
                            className={`w-full flex items-center justify-between px-6 py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all ${activeFolder === folder.id
                                ? 'bg-white text-blue-600 shadow-md shadow-slate-200/50'
                                : 'text-slate-400 hover:bg-white hover:text-slate-600'
                                }`}
                        >
                            <div className="flex items-center gap-3">
                                <span className="material-symbols-outlined text-[20px]">{folder.icon}</span>
                                {folder.label}
                            </div>
                        </button>
                    ))}
                </nav>
            </aside>

            {/* Lista de E-mails */}
            <div className={`flex flex-col min-w-0 border-r border-slate-100 bg-white transition-all duration-300 ease-in-out ${isListVisible ? 'w-full md:w-[400px] opacity-100' : 'w-0 opacity-0 overflow-hidden border-none'
                } ${selectedMessageId ? 'hidden md:flex' : 'flex'}`}>
                <div className="h-20 border-b border-slate-50 px-8 flex items-center justify-between bg-white shrink-0">
                    <h2 className="text-sm font-black uppercase text-slate-900 tracking-widest">
                        {folders.find(f => f.id === activeFolder)?.label}
                    </h2>
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center p-12">
                            <div className="size-8 border-4 border-slate-200 border-t-blue-500 rounded-full animate-spin"></div>
                        </div>
                    ) : messages.length > 0 ? (
                        messages.map(msg => {
                            const { date, time } = formatDate(msg.created_at);
                            const otherParty = activeFolder === 'sent' ? msg.recipient : msg.sender;
                            const isUnread = !msg.is_read && activeFolder === 'inbox';

                            return (
                                <div
                                    key={msg.id}
                                    onClick={() => handleSelectMessage(msg)}
                                    className={`p-6 border-b border-slate-50 cursor-pointer transition-all hover:bg-slate-50 relative group ${selectedMessageId === msg.id ? 'bg-blue-50/30' : ''
                                        }`}
                                >
                                    {isUnread && (
                                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500"></div>
                                    )}
                                    <div className="flex gap-4">
                                        <div className="size-12 rounded-2xl bg-slate-100 overflow-hidden shrink-0 border-2 border-white shadow-sm">
                                            {otherParty?.avatar_url ? (
                                                <img src={otherParty.avatar_url} className="size-full object-cover" />
                                            ) : (
                                                <div className="size-full flex items-center justify-center bg-slate-200 text-slate-400 font-black text-sm">
                                                    {otherParty?.full_name?.[0] || '?'}
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0 py-1">
                                            <div className="flex items-center justify-between mb-1">
                                                <p className={`text-sm tracking-tight truncate ${isUnread ? 'font-black text-slate-900' : 'font-bold text-slate-600'}`}>
                                                    {otherParty?.full_name || 'Desconhecido'}
                                                </p>
                                                <span className={`text-[10px] font-bold shrink-0 ${isUnread ? 'text-blue-600' : 'text-slate-400'}`}>{date}</span>
                                            </div>
                                            <p className={`text-xs mb-1 truncate ${isUnread ? 'font-bold text-slate-800' : 'text-slate-500'}`}>
                                                {msg.subject || '(Sem Assunto)'}
                                            </p>
                                            <p className="text-[11px] text-slate-400 line-clamp-1" dangerouslySetInnerHTML={{ __html: msg.content?.replace(/<[^>]*>?/gm, '') || '' }}></p>
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center p-12 text-center opacity-30">
                            <div className="size-20 bg-slate-100 rounded-3xl flex items-center justify-center mb-6">
                                <span className="material-symbols-outlined text-4xl text-slate-400">mail_outline</span>
                            </div>
                            <p className="font-black uppercase tracking-widest text-[10px] text-slate-500">Nenhuma mensagem aqui</p>
                        </div>
                    )}
                </div>
            </div>

            <div className={`flex-1 flex flex-col min-w-0 bg-slate-50/50 ${selectedMessageId ? 'flex' : 'hidden md:flex'}`}>
                {selectedMessage ? (
                    <div className="flex-1 flex flex-col animate-in fade-in slide-in-from-right-4 duration-300">
                        <div className="h-20 border-b border-slate-200/60 px-8 flex items-center justify-between bg-white/80 backdrop-blur-md shrink-0 sticky top-0 z-10">
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setSelectedMessageId(null)}
                                    className="md:hidden p-2 text-slate-400 hover:text-slate-600 mr-2"
                                >
                                    <span className="material-symbols-outlined">arrow_back</span>
                                </button>

                                <button
                                    onClick={() => setIsListVisible(!isListVisible)}
                                    className="hidden md:flex p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all mr-2"
                                    title={isListVisible ? "Expandir Leitura" : "Mostrar Lista"}
                                >
                                    <span className="material-symbols-outlined text-[20px]">
                                        {isListVisible ? 'fullscreen' : 'fullscreen_exit'}
                                    </span>
                                </button>

                                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                                    <button onClick={() => handleDeleteMessage(selectedMessage)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-white rounded-lg transition-all shadow-sm" title="Mover para Lixeira">
                                        <span className="material-symbols-outlined text-[20px]">delete</span>
                                    </button>
                                    <button className="p-2 text-slate-400 hover:text-blue-500 hover:bg-white rounded-lg transition-all shadow-sm" title="Arquivar">
                                        <span className="material-symbols-outlined text-[20px]">archive</span>
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-8 md:p-12 custom-scrollbar">
                            <div className="max-w-3xl mx-auto space-y-8">
                                <div className="animate-in slide-in-from-bottom-4 duration-500">
                                    <h1 className="text-3xl font-black text-slate-900 leading-tight mb-8">
                                        {selectedMessage.subject}
                                    </h1>
                                    <div className="flex items-center justify-between pb-8 border-b border-slate-200">
                                        <div className="flex items-center gap-5">
                                            <div className="size-14 rounded-[20px] bg-slate-100 flex items-center justify-center overflow-hidden shadow-md ring-4 ring-white">
                                                {selectedMessage.sender?.avatar_url ? (
                                                    <img src={selectedMessage.sender.avatar_url} className="size-full object-cover" />
                                                ) : (
                                                    <span className="text-xl font-black text-slate-400">{selectedMessage.sender?.full_name?.[0]}</span>
                                                )}
                                            </div>
                                            <div>
                                                <p className="text-base font-black text-slate-900">{selectedMessage.sender?.full_name}</p>
                                                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mt-1">
                                                    <span className="lowercase font-medium bg-slate-100 px-2 py-0.5 rounded-md">{selectedMessage.sender?.email}</span>
                                                </p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-xs font-black text-slate-400 uppercase tracking-widest">{formatDate(selectedMessage.created_at).date}</p>
                                            <p className="text-[10px] font-bold text-slate-300 mt-1">{formatDate(selectedMessage.created_at).time}</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="p-10 bg-white rounded-[40px] shadow-sm max-h-[600px] overflow-y-auto custom-scrollbar text-slate-700 leading-relaxed font-medium text-lg animate-in slide-in-from-bottom-8 duration-700 delay-100" dangerouslySetInnerHTML={{ __html: selectedMessage.content }}>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center p-12 text-center opacity-40">
                        <div className="size-32 rounded-[40px] bg-slate-200/50 flex items-center justify-center mb-8 animate-pulse">
                            <span className="material-symbols-outlined text-6xl text-slate-400">mark_email_read</span>
                        </div>
                        <h3 className="font-black uppercase tracking-[0.2em] text-sm text-slate-500 mb-2">Selecione uma mensagem</h3>
                        <p className="text-xs font-bold text-slate-400 max-w-xs">Escolha um e-mail da lista ao lado para visualizar o conteúdo completo.</p>
                    </div>
                )}
            </div>

            {/* Compositor de E-mail */}
            {isComposing && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsComposing(false)}></div>
                    <div className="relative bg-white w-full max-w-2xl rounded-[40px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="bg-slate-900 p-8 flex items-center justify-between text-white shrink-0">
                            <div className="flex items-center gap-3">
                                <span className="material-symbols-outlined">edit</span>
                                <span className="font-black uppercase tracking-widest text-xs">Nova Mensagem</span>
                            </div>
                            <button onClick={() => setIsComposing(false)} className="size-8 flex items-center justify-center hover:bg-white/10 rounded-lg transition-all">
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>
                        <div className="p-8 space-y-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Para</label>
                                <select
                                    className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none focus:border-blue-500 transition-all appearance-none"
                                    value={composeRecipient}
                                    onChange={e => setComposeRecipient(e.target.value)}
                                >
                                    <option value="">Selecione um destinatário...</option>
                                    <option value="ALL" className="font-bold text-blue-600 bg-blue-50">📢 ENVIAR PARA TODOS (Staff)</option>
                                    {recipientList.map(rec => (
                                        <option key={rec.id} value={rec.id}>
                                            {rec.full_name} ({rec.role})
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Assunto</label>
                                <input type="text" value={composeSubject} onChange={e => setComposeSubject(e.target.value)} placeholder="Qual o motivo do contato?" className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none focus:border-blue-500 transition-all" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Mensagem</label>
                                <RichTextEditor
                                    value={composeBody}
                                    onChange={setComposeBody}
                                    placeholder="Escreva sua mensagem aqui..."
                                />
                            </div>
                            <div className="flex gap-4 pt-2">
                                <button type="button" onClick={() => setIsComposing(false)} className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-bold hover:bg-slate-200 transition-all uppercase tracking-widest text-[10px]">Cancelar</button>
                                <button onClick={handleSendMessage} disabled={sending} className="flex-[2] py-4 bg-blue-600 text-white rounded-2xl font-black shadow-xl hover:bg-blue-700 transition-all uppercase tracking-widest text-[10px] flex items-center justify-center gap-2">
                                    {sending ? 'Enviando...' : 'Enviar Mensagem'}
                                    <span className="material-symbols-outlined text-sm">send</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            <style>{`
                .custom-scrollbar::-webkit-scrollbar { width: 4px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
            `}</style>
        </div>
    );
};

export default MailAdmin;
