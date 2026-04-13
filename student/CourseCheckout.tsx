
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

    const checkPaymentStatus = async (idToVerify: string, isManual: boolean = true) => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const headers: any = { 'Content-Type': 'application/json' };
            if (session?.access_token) {
                headers['Authorization'] = `Bearer ${session.access_token}`;
            }

            const response = await fetch('/api/verify-payment', {
                method: 'POST',
                headers,
                body: JSON.stringify({ enrollment_id: idToVerify })
            });
            const result = await response.json();
            
            if (result.status === 'Ativo') {
                // Fallback de segurança: Tenta atualizar status no frontend caso backend falhe por falta de chave
                try {
                    await supabase.from('enrollments').update({ status: 'Ativo', updated_at: new Date().toISOString() }).eq('id', idToVerify);
                } catch (e) {
                    console.log('Update frontend falhou, dependendo do backend:', e);
                }

                if (isManual) setPopup({ type: 'success', title: 'Confirmado!', message: 'Seu acesso foi liberado!' });
                setTimeout(() => window.location.href = `/aluno/curso/${id}`, 1000);
            } else {
                if (isManual) {
                    setPopup({ type: 'info', title: 'Aguardando', message: 'O pagamento ainda não foi identificado. Aguarde alguns instantes.' });
                }
            }
        } catch (e) {
            if (isManual) setPopup({ type: 'error', title: 'Erro', message: 'Falha ao verificar pagamento.' });
            console.error('Erro no polling:', e);
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
                checkPaymentStatus(enroll.id, false);
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
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md overflow-y-auto">
                    <div className="bg-white rounded-[40px] shadow-2xl border border-white max-w-xl w-full p-10 space-y-8 animate-in zoom-in-95 duration-300">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-6">
                            <div>
                                <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter italic">Termos de <span className="text-[#137fec]">Adesão.</span></h3>
                                <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mt-1">Leia com atenção antes de confirmar sua inscrição</p>
                            </div>
                            <div className="size-12 bg-blue-50 rounded-2xl flex items-center justify-center text-[#137fec]">
                                <span className="material-symbols-outlined font-bold">gavel</span>
                            </div>
                        </div>

                        <div className="max-h-[350px] overflow-y-auto pr-4 space-y-6 text-sm text-slate-600 custom-scrollbar text-justify font-medium leading-relaxed">
                            <p>
                                Ao clicar em "Confirmar e Pagar", você estará manifestando sua plena e expressa concordância com os Termos de Uso e a Política de Privacidade estipulados pela plataforma <strong>Bora Passar Agora</strong>.
                            </p>
                            <p>
                                <strong>1. Objeto e Liberação de Acesso:</strong> O produto objeto desta transação é um material exclusivamente digital, desprovido de videoaulas. O conteúdo adquirido engloba: <strong>Apostilas Interativas, Banco de Questões exclusivas e Simulados estrategicamente elaborados.</strong> O acesso a esses recursos será liberado em sua conta na plataforma logo após a confirmação sistêmica do pagamento via PIX.
                            </p>
                            <p>
                                <strong>2. Direitos Autorais e Antipirataria:</strong> Todo o material oferecido é protegido pela Lei Geral de Direitos Autorais (Lei nº 9.610/98). É terminantemente proibida a cópia, reprodução, distribuição, rateio, venda ou compartilhamento – pago ou gratuito – de qualquer parte deste conteúdo. A plataforma possui rastreamento por IP, metadados em PDF e bloqueio automático para acessos simultâneos não autorizados. Identificadas infrações, a conta será bloqueada sem aviso prévio, e as medidas judiciais cabíveis serão adotadas.
                            </p>
                            <div className="p-5 bg-blue-50 text-blue-900 rounded-2xl border border-blue-200">
                                <h4 className="font-black uppercase tracking-widest text-[10px] mb-2 flex items-center gap-2"><span className="material-symbols-outlined text-sm">update</span> Atualização do Material</h4>
                                <p className="text-xs">
                                    O <strong>Bora Passar Agora</strong> se reserva o direito de realizar atualizações contínuas no material. Você terá acesso aos simulados e questões mais recentes adicionados ao pacote enquanto sua matrícula estiver vigente.
                                </p>
                            </div>
                            <p>
                                <strong>3. Garantia e Devolução:</strong> Em conformidade com o Artigo 49 do Código de Defesa do Consumidor, garantimos a você o "Direito de Arrependimento". Caso sinta que o material não condiz com as suas expectativas, você poderá solicitar o cancelamento e reembolso de 100% do seu investimento no prazo máximo de <strong>7 (sete) dias corridos</strong> a partir da data e hora da liberação do pagamento.
                            </p>
                            <p>
                                Ao prosseguir, declaro sob as penas da lei ter lido e compreendido perfeitamente os termos acima.
                            </p>
                        </div>

                        <div className="pt-6 border-t border-slate-100">
                            <label className={`flex items-center gap-4 p-5 rounded-2xl border-2 transition-all cursor-pointer ${agreed ? 'bg-blue-50 border-[#137fec] text-[#137fec]' : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100 group'}`}>
                                <input 
                                    type="checkbox" 
                                    checked={agreed} 
                                    onChange={e => setAgreed(e.target.checked)} 
                                    className="size-6 text-[#137fec] border-2 border-slate-300 rounded-lg focus:ring-[#137fec]" 
                                />
                                <span className="font-black uppercase tracking-widest text-[11px] group-hover:text-slate-900 transition-colors">Li e concordo expressamente com os termos</span>
                            </label>

                            <div className="flex gap-4 mt-8">
                                <button 
                                    onClick={() => setShowTerms(false)} 
                                    className="px-8 py-5 rounded-2xl font-black uppercase tracking-widest text-[#137fec] bg-blue-50 hover:bg-blue-100 transition-colors text-xs"
                                >
                                    Voltar
                                </button>
                                <button 
                                    onClick={handlePlaceOrder} 
                                    disabled={!agreed || submitting} 
                                    className={`flex-1 py-5 rounded-2xl font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all text-white text-xs ${agreed && !submitting ? 'bg-emerald-500 hover:bg-emerald-600 shadow-xl shadow-emerald-500/20' : 'bg-slate-200 cursor-not-allowed'}`}
                                >
                                    {submitting ? (
                                        <><span className="material-symbols-outlined animate-spin">refresh</span> Processando...</>
                                    ) : (
                                        <><span className="material-symbols-outlined">check_circle</span> Confirmar Inscrição</>
                                    )}
                                </button>
                            </div>
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
