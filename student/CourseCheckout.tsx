
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

const formatCPF = (value: string) => value.replace(/\D/g, '').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})/, '$1-$2').replace(/(-\d{2})\d+?$/, '$1');
const formatPhone = (value: string) => value.replace(/\D/g, '').replace(/^(\d{2})(\d)/g, '($1) $2').replace(/(\d)(\d{4})$/, '$1-$2').slice(0, 15);

const CourseCheckout: React.FC = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [course, setCourse] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState<any>(null);
    const [submitting, setSubmitting] = useState(false);
    const [userProfile, setUserProfile] = useState<any>(null);

    const [cpf, setCpf] = useState('');
    const [phone, setPhone] = useState('');
    const [isWhatsApp, setIsWhatsApp] = useState(false);
    const [birthDate, setBirthDate] = useState('');

    const [showTerms, setShowTerms] = useState(false);
    const [agreed, setAgreed] = useState(false);
    const [popup, setPopup] = useState<{ type: 'success' | 'error' | 'info'; title: string; message: string } | null>(null);

    const [couponCode, setCouponCode] = useState('');
    const [appliedCoupon, setAppliedCoupon] = useState<any>(null);
    const [discountAmount, setDiscountAmount] = useState(0);

    const [pixData, setPixData] = useState<{ qr_code: string; qr_code_base64: string } | null>(null);
    const [enrollmentId, setEnrollmentId] = useState<string | null>(null);

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
                setUserProfile(profile);
                setCpf(formatCPF(profile.cpf || ''));
                setPhone(formatPhone(profile.phone || ''));
                setIsWhatsApp(profile.is_whatsapp || false);
                setBirthDate(profile.birth_date || '');
            }
        } else {
            navigate(`/login?redirect=/aluno/curso/${id}/checkout`);
        }
    };

    const applyCoupon = () => {
        if (!course || !couponCode.trim()) return;
        try {
            let coupons = Array.isArray(course.coupons_json) ? course.coupons_json : JSON.parse(course.coupons_json || '[]');
            const found = coupons.find((c: any) => c.name.toUpperCase() === couponCode.trim().toUpperCase());
            if (found) {
                let discount = found.discount_type === 'porcentagem' ? (course.price_offer * found.discount_value) / 100 : found.discount_value;
                discount = Math.min(discount, course.price_offer);
                setAppliedCoupon(found);
                setDiscountAmount(discount);
                setPopup({ type: 'success', title: 'Cupom Ativado!', message: `Desconto de R$ ${discount.toFixed(2)} aplicado.` });
            } else {
                setAppliedCoupon(null);
                setDiscountAmount(0);
                setPopup({ type: 'error', title: 'Cupom Inválido', message: 'Código não encontrado.' });
            }
        } catch (e) {
            setPopup({ type: 'error', title: 'Erro', message: 'Falha ao validar cupom.' });
        }
    };

    const currentPrice = course ? (course.price_offer - discountAmount) : 0;

    const handlePreSubmit = () => {
        if (cpf.replace(/\D/g, '').length !== 11) {
            setPopup({ type: 'error', title: 'CPF Inválido', message: 'Informe um CPF válido.' });
            return;
        }
        if (phone.length < 14) {
            setPopup({ type: 'error', title: 'Telefone Inválido', message: 'Informe o telefone com DDD.' });
            return;
        }
        if (!birthDate) {
            setPopup({ type: 'error', title: 'Data de Nascimento', message: 'Campo obrigatório.' });
            return;
        }
        setShowTerms(true);
    };

    const checkPaymentStatus = async (idToVerify: string) => {
        try {
            const response = await fetch('/api/verify-payment', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ enrollment_id: idToVerify })
            });
            const result = await response.json();
            if (result.status === 'Ativo') {
                setPopup({ type: 'success', title: 'Confirmado!', message: 'Seu acesso foi liberado!' });
                setTimeout(() => navigate(`/aluno/curso/${id}`), 2000);
            } else {
                setPopup({ type: 'info', title: 'Aguardando', message: 'Pagamento ainda não detectado.' });
            }
        } catch (e) {
            setPopup({ type: 'error', title: 'Erro', message: 'Falha ao verificar pagamento.' });
        }
    };

    const handlePlaceOrder = async () => {
        if (!agreed) return;
        setSubmitting(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error('Sessão expirada');

            await supabase.from('profiles').update({
                cpf, phone, is_whatsapp: isWhatsApp, birth_date: birthDate, updated_at: new Date().toISOString()
            }).eq('id', session.user.id);

            const { data: existing } = await supabase.from('enrollments').select('id, status').eq('course_id', id).eq('profile_id', session.user.id).maybeSingle();
            
            const payload = {
                course_id: id,
                profile_id: session.user.id,
                status: 'Pendente',
                amount_paid: currentPrice,
                amount_discount: discountAmount,
                payment_method: 'pix',
                coupon_applied: appliedCoupon?.name || null
            };

            let enroll;
            if (existing) {
                const { data: upd } = await supabase.from('enrollments').update(payload).eq('id', existing.id).select().single();
                enroll = upd;
            } else {
                const { data: ins } = await supabase.from('enrollments').insert([payload]).select().single();
                enroll = ins;
            }

            if (!enroll) throw new Error('Falha ao registrar matrícula');
            setEnrollmentId(enroll.id);

            const res = await fetch('/api/process-pix', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    amount: currentPrice,
                    enrollment_id: enroll.id,
                    course_id: id,
                    payer: { email: session.user.email, first_name: userProfile?.full_name?.split(' ')[0] || 'Aluno', last_name: 'BPA', cpf }
                })
            });

            if (!res.ok) throw new Error('Erro ao gerar PIX');
            const data = await res.json();
            
            setPixData({ qr_code: data.qr_code, qr_code_base64: data.qr_code_base64 });
            setShowTerms(false);
            setPopup(null);

            const poll = setInterval(() => {
                checkPaymentStatus(enroll.id);
            }, 7000);
            return () => clearInterval(poll);

        } catch (e: any) {
            setPopup({ type: 'error', title: 'Erro', message: e.message });
        } finally {
            setSubmitting(false);
        }
    };

    if (loading || !course) return <div className="p-20 text-center">Carregando...</div>;

    return (
        <div className="max-w-4xl mx-auto pb-20 pt-10 px-4">
            <button onClick={() => navigate(-1)} className="mb-6 flex items-center gap-2 font-bold text-slate-500 hover:text-blue-500">
                <span className="material-symbols-outlined">arrow_back</span> Voltar
            </button>

            <div className="bg-white rounded-[40px] shadow-2xl border border-slate-100 overflow-hidden">
                <div className="bg-slate-900 p-8 text-white flex justify-between items-center">
                    <div>
                        <p className="text-blue-400 font-black uppercase tracking-widest text-xs mb-2">Checkout PIX</p>
                        <h1 className="text-3xl font-black italic">{course.title}</h1>
                    </div>
                    <div className="text-right">
                        <p className="text-xs text-slate-400 font-bold uppercase">Total</p>
                        <p className="text-3xl font-black text-blue-400">R$ {currentPrice.toFixed(2).replace('.', ',')}</p>
                    </div>
                </div>

                <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-10">
                    <div className="space-y-6">
                        {pixData ? (
                            <div className="bg-emerald-50/30 p-8 rounded-[40px] border-2 border-emerald-500/20 text-center space-y-6">
                                <h3 className="text-xl font-black text-slate-900 uppercase italic">PIX Gerado!</h3>
                                <div className="bg-white p-4 rounded-3xl shadow-sm inline-block border border-slate-100">
                                    <img src={`data:image/png;base64,${pixData.qr_code_base64}`} className="size-48" alt="QR" />
                                </div>
                                <button 
                                    onClick={() => { navigator.clipboard.writeText(pixData.qr_code); setPopup({ type: 'success', title: 'Copiado!', message: 'Código PIX copiado.' }); }}
                                    className="w-full py-4 bg-white border-2 border-slate-200 rounded-2xl text-xs font-bold hover:border-emerald-500 transition-all flex items-center justify-center gap-2"
                                >
                                    <span className="material-symbols-outlined text-sm">content_copy</span> Copiar Código PIX
                                </button>
                                <div className="pt-4 space-y-3">
                                    <button onClick={() => enrollmentId && checkPaymentStatus(enrollmentId)} className="w-full py-4 bg-emerald-500 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-lg">
                                        Já Paguei, Verificar
                                    </button>
                                    <a href={`https://wa.me/55?text=Paguei o curso ${course.title}`} target="_blank" rel="noreferrer" className="w-full py-3 bg-white text-emerald-600 rounded-2xl font-black uppercase text-[10px] border border-emerald-100 flex items-center justify-center gap-2">
                                        <span className="material-symbols-outlined text-sm">support_agent</span> Suporte WhatsApp
                                    </a>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <h3 className="font-black text-slate-800 uppercase text-sm flex items-center gap-2"><span className="material-symbols-outlined">person</span> Seus Dados</h3>
                                <input value={cpf} onChange={e => setCpf(formatCPF(e.target.value))} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl" placeholder="CPF" />
                                <input value={phone} onChange={e => setPhone(formatPhone(e.target.value))} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl" placeholder="Telefone" />
                                <input type="date" value={birthDate} onChange={e => setBirthDate(e.target.value)} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl" />
                            </div>
                        )}
                    </div>

                    {!pixData && (
                        <div className="flex flex-col justify-between">
                            <div className="bg-slate-900 p-6 rounded-[32px] text-white space-y-4">
                                <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-slate-400">
                                    <span>Resumo</span>
                                    <span className="text-emerald-400">PIX Selecionado</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span>Subtotal</span>
                                    <span>R$ {course.price_offer?.toFixed(2)}</span>
                                </div>
                                {discountAmount > 0 && (
                                    <div className="flex justify-between text-sm text-blue-400 font-bold">
                                        <span>Cupom</span>
                                        <span>- R$ {discountAmount.toFixed(2)}</span>
                                    </div>
                                )}
                                <div className="border-t border-white/10 pt-4 flex justify-between items-center text-xl font-black">
                                    <span className="text-xs uppercase text-slate-400">Total</span>
                                    <span className="text-emerald-400 italic font-mono">R$ {currentPrice.toFixed(2).replace('.', ',')}</span>
                                </div>
                            </div>

                            <div className="mt-6 flex gap-2">
                                <input value={couponCode} onChange={e => setCouponCode(e.target.value)} className="flex-1 p-3 bg-white border border-slate-200 rounded-xl uppercase text-xs font-bold" placeholder="CUPOM" />
                                <button onClick={applyCoupon} className="px-6 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase">Aplicar</button>
                            </div>

                            <button onClick={handlePreSubmit} className="w-full mt-6 py-5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl font-black uppercase tracking-widest shadow-xl flex items-center justify-center gap-2">
                                Gerar PIX <span className="material-symbols-outlined">qr_code</span>
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {showTerms && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm">
                    <div className="bg-white rounded-[40px] max-w-xl w-full p-10 space-y-6">
                        <h3 className="text-2xl font-black uppercase italic">Termos de <span className="text-blue-500">Adesão</span></h3>
                        <div className="max-h-60 overflow-y-auto text-sm text-slate-500 leading-relaxed pr-2">
                            Ao clicar em aceitar, você concorda com a política de acesso à plataforma Bora Passar Agora. O conteúdo é digital e o acesso é liberado após a confirmação do pagamento. Você tem direito a 7 dias de garantia incondicional conforme o CDC.
                        </div>
                        <label className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl cursor-pointer">
                            <input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)} className="size-5 rounded border-slate-300 text-blue-500" />
                            <span className="text-xs font-black uppercase">Li e concordo com os termos</span>
                        </label>
                        <div className="flex gap-4">
                            <button onClick={() => setShowTerms(false)} className="flex-1 py-4 border border-slate-200 rounded-2xl font-black uppercase text-[10px]">Cancelar</button>
                            <button onClick={handlePlaceOrder} disabled={submitting || !agreed} className="flex-[2] py-4 bg-emerald-500 text-white rounded-2xl font-black uppercase text-[10px] disabled:opacity-50">
                                {submitting ? 'Gerando...' : 'Confirmar e Pagar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {popup && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-sm">
                    <div className="bg-white rounded-[40px] max-w-sm w-full p-10 text-center space-y-6">
                        <div className={`size-16 rounded-2xl mx-auto flex items-center justify-center ${popup.type === 'success' ? 'bg-emerald-50 text-emerald-500' : 'bg-blue-50 text-blue-500'}`}>
                            <span className="material-symbols-outlined text-3xl">{popup.type === 'success' ? 'check_circle' : 'info'}</span>
                        </div>
                        <h3 className="text-xl font-black uppercase italic">{popup.title}</h3>
                        <p className="text-slate-500 text-sm">{popup.message}</p>
                        <button onClick={() => setPopup(null)} className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black uppercase text-xs">OK</button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CourseCheckout;
