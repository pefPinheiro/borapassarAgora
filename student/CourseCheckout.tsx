
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

// Helper functions
const formatCPF = (value: string) => value.replace(/\D/g, '').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})/, '$1-$2').replace(/(-\d{2})\d+?$/, '$1');
const formatPhone = (value: string) => value.replace(/\D/g, '').replace(/^(\d{2})(\d)/g, '($1) $2').replace(/(\d)(\d{4})$/, '$1-$2').slice(0, 15);

const CourseCheckout: React.FC = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [course, setCourse] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState<any>(null);
    const [submitting, setSubmitting] = useState(false);

    // Form
    const [cpf, setCpf] = useState('');
    const [phone, setPhone] = useState('');
    const [isWhatsApp, setIsWhatsApp] = useState(false);
    const [birthDate, setBirthDate] = useState('');

    // Modal
    const [showTerms, setShowTerms] = useState(false);
    const [agreed, setAgreed] = useState(false);

    useEffect(() => {
        if (id) {
            fetchCourse();
            fetchUser();
        }
    }, [id]);

    const fetchCourse = async () => {
        const { data } = await supabase.from('courses').select('*').eq('id', id).single();
        if (data) setCourse(data);
        setLoading(false);
    };

    const fetchUser = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
            setUser(session.user);
            const { data: profile } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
            if (profile) {
                setCpf(formatCPF(profile.cpf || ''));
                setPhone(formatPhone(profile.phone || ''));
                setIsWhatsApp(profile.is_whatsapp || false);
                setBirthDate(profile.birth_date || '');
            }
        } else {
            navigate(`/login?redirect=/aluno/curso/${id}/checkout`);
        }
    };

    const handlePreSubmit = () => {
        if (cpf.replace(/\D/g, '').length !== 11) return alert('CPF inválido.');
        if (phone.length < 14) return alert('Telefone inválido.');
        if (!birthDate) return alert('Informe a data de nascimento.');
        setShowTerms(true);
    };

    const handlePlaceOrder = async () => {
        if (!agreed) return alert('Aceite os termos.');
        setSubmitting(true);

        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error('Sessão inválida');

            // 1. Atualizar Perfil
            await supabase.from('profiles').update({
                cpf, phone, is_whatsapp: isWhatsApp, birth_date: birthDate, updated_at: new Date().toISOString()
            }).eq('id', session.user.id);

            // 2. Criar Matrícula PENDENTE (Reserva)
            const finalPrice = course.price_offer; // MP aplicará descontos ou lógica extra se configurado lá, ou aqui.
            // Nota: Se quiser aplicar desconto PIX no checkout, teria que criar preferencia customizada.
            // Para simplicidade, vamos mandar o preço cheio e o MP gerencia métodos, ou mandamos já com desconto se o user escolheu PIX (mas MP Checkout é global).
            // Vamos mandar o preço de oferta padrão.

            const { data: enrollment, error: enrollError } = await supabase
                .from('enrollments')
                .insert([{
                    course_id: id,
                    profile_id: session.user.id,
                    status: 'Pendente',
                    progress: 0,
                    amount_paid: finalPrice, // Valor nominal, confirmação real virá no webhook
                    payment_method: 'mercadopago_checkout'
                }])
                .select()
                .single();

            if (enrollError) throw enrollError;

            // 3. Chamar Backend para Criar Preferência MP
            console.log('Chamando API de Pagamento...');
            const response = await fetch('/api/create-preference', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: course.title,
                    price: finalPrice,
                    quantity: 1,
                    enrollment_id: enrollment.id,
                    course_id: id,
                    payer_email: session.user.email,
                    payer_name: cpf // Ou nome se tiver no profile
                })
            });

            if (!response.ok) {
                if (response.status === 404) {
                    throw new Error('Servidor de pagamento não encontrado (404). Se estiver rodando localmente, certifique-se de usar "vercel dev" ou implantar o projeto.');
                }
                const errorData = await response.json();
                throw new Error(errorData.error || 'Erro ao criar preferência');
            }

            const { init_point } = await response.json();

            // 4. Redirecionar
            window.location.href = init_point;

        } catch (e: any) {
            console.error('Erro:', e);
            alert('Falha ao iniciar pagamento: ' + e.message);
            setSubmitting(false);
        }
    };

    if (loading || !course) return <div className="p-20 text-center text-slate-400">Carregando...</div>;

    return (
        <div className="max-w-4xl mx-auto pb-20 pt-10 px-4 animate-in fade-in">
            <button onClick={() => navigate(-1)} className="mb-6 text-slate-500 hover:text-[#137fec] font-bold flex items-center gap-2"><span className="material-symbols-outlined">arrow_back</span> Voltar</button>

            <div className="bg-white rounded-[40px] shadow-xl border border-slate-100 overflow-hidden">
                <div className="bg-slate-900 p-8 text-white flex justify-between items-center bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]">
                    <div>
                        <p className="text-[#137fec] font-black uppercase tracking-widest text-xs mb-2">Checkout Seguro</p>
                        <h1 className="text-3xl font-black italic">{course.title}</h1>
                    </div>
                    <div className="text-right">
                        <p className="text-sm text-slate-400 font-bold uppercase">Valor Total</p>
                        <p className="text-3xl font-black text-[#137fec]">R$ {course.price_offer?.toFixed(2).replace('.', ',')}</p>
                    </div>
                </div>

                <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-10">
                    <div className="space-y-6">
                        <h3 className="font-black text-slate-800 flex items-center gap-2 uppercase tracking-wide text-sm"><span className="material-symbols-outlined">person</span> Seus Dados</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="label-text">CPF</label>
                                <input value={cpf} onChange={e => setCpf(formatCPF(e.target.value))} className="input-field" placeholder="000.000.000-00" />
                            </div>
                            <div>
                                <label className="label-text">Telefone</label>
                                <input value={phone} onChange={e => setPhone(formatPhone(e.target.value))} className="input-field" placeholder="(00) 00000-0000" />
                            </div>
                            <div>
                                <label className="label-text">Nascimento</label>
                                <input type="date" value={birthDate} onChange={e => setBirthDate(e.target.value)} className="input-field" />
                            </div>
                        </div>
                    </div>

                    <div className="space-y-6 flex flex-col justify-between">
                        <div>
                            <h3 className="font-black text-slate-800 flex items-center gap-2 uppercase tracking-wide text-sm mb-4"><span className="material-symbols-outlined">verified_user</span> Resumo</h3>
                            <ul className="space-y-3 text-sm text-slate-600">
                                <li className="flex items-center gap-2"><span className="text-emerald-500 material-symbols-outlined text-lg">check_circle</span> Acesso Imediato (após aprovação)</li>
                                <li className="flex items-center gap-2"><span className="text-emerald-500 material-symbols-outlined text-lg">check_circle</span> Garantia de 7 dias</li>
                                <li className="flex items-center gap-2"><span className="text-emerald-500 material-symbols-outlined text-lg">check_circle</span> Pagamento via Mercado Pago</li>
                            </ul>
                        </div>

                        <button onClick={handlePreSubmit} className="w-full py-4 bg-[#009ee3] hover:bg-[#0081b9] text-white rounded-xl font-black uppercase tracking-widest shadow-lg shadow-blue-500/20 transition-all flex items-center justify-center gap-2">
                            Pagar com Mercado Pago
                            <span className="material-symbols-outlined">open_in_new</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Terms Modal */}
            {showTerms && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-3xl p-8 max-w-lg w-full space-y-6 animate-in zoom-in-95">
                        <h3 className="text-xl font-black text-slate-900">Termos e Condições</h3>
                        <p className="text-sm text-slate-500">Ao confirmar, você concorda com os termos de uso, política de cancelamento e processamento de dados.</p>

                        <label className="flex items-center gap-3 p-4 border rounded-xl cursor-pointer hover:bg-slate-50">
                            <input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)} className="size-5 rounded border-slate-300 text-blue-600 focus:ring-0" />
                            <span className="text-sm font-bold text-slate-700">Li e concordo com os termos</span>
                        </label>

                        <div className="flex gap-3">
                            <button onClick={() => setShowTerms(false)} className="flex-1 py-3 border border-slate-200 rounded-xl font-bold text-slate-500 hover:bg-slate-50">Cancelar</button>
                            <button onClick={handlePlaceOrder} disabled={submitting || !agreed} className="flex-1 py-3 bg-[#009ee3] text-white rounded-xl font-bold disabled:opacity-50">Confirmar</button>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                .label-text { display: block; font-size: 10px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.1em; color: #94a3b8; margin-bottom: 4px; padding-left: 4px; }
                .input-field { width: 100%; padding: 12px 16px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; font-weight: 600; color: #334155; outline: none; transition: all; }
                .input-field:focus { border-color: #009ee3; background: #fff; box-shadow: 0 0 0 4px rgba(0,158,227,0.1); }
            `}</style>
        </div>
    );
};

export default CourseCheckout;
