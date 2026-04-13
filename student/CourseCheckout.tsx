
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
    const [userProfile, setUserProfile] = useState<any>(null);

    // Form
    const [cpf, setCpf] = useState('');
    const [phone, setPhone] = useState('');
    const [isWhatsApp, setIsWhatsApp] = useState(false);
    const [birthDate, setBirthDate] = useState('');

    // Modal
    const [showTerms, setShowTerms] = useState(false);
    const [agreed, setAgreed] = useState(false);

    // Popup State
    const [popup, setPopup] = useState<{ type: 'success' | 'error' | 'info'; title: string; message: string } | null>(null);

    // Coupon State
    const [couponCode, setCouponCode] = useState('');
    const [appliedCoupon, setAppliedCoupon] = useState<any>(null);
    const [discountAmount, setDiscountAmount] = useState(0);

    // Payment Selection
    const [method, setMethod] = useState<'all' | 'pix'>('all');

    // PIX Data
    const [pixData, setPixData] = useState<{ qr_code: string; qr_code_base64: string } | null>(null);
    const [checkingPayment, setCheckingPayment] = useState(false);

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

    const applyCoupon = () => {
        if (!course || !couponCode.trim()) return;
        
        try {
            let coupons = [];
            if (typeof course.coupons_json === 'string') {
                coupons = JSON.parse(course.coupons_json);
            } else {
                coupons = course.coupons_json || [];
            }

            const found = coupons.find((c: any) => c.name.toUpperCase() === couponCode.trim().toUpperCase());
            
            if (found) {
                let discount = 0;
                if (found.discount_type === 'porcentagem') {
                    discount = (course.price_offer * found.discount_value) / 100;
                } else {
                    discount = found.discount_value;
                }
                
                discount = Math.min(discount, course.price_offer);
                
                setAppliedCoupon(found);
                setDiscountAmount(discount);
                setPopup({ type: 'success', title: 'Cupom Ativado!', message: `Desconto de R$ ${discount.toFixed(2)} aplicado com sucesso.` });
            } else {
                setAppliedCoupon(null);
                setDiscountAmount(0);
                setPopup({ type: 'error', title: 'Cupom Inválido', message: 'Este código não existe ou já expirou.' });
            }
        } catch (e) {
            console.error('Coupon parse error:', e);
            setPopup({ type: 'error', title: 'Erro no Cupom', message: 'Não foi possível validar o cupom agora.' });
        }
    };

    const finalPrice = course ? (course.price_offer - discountAmount) : 0;
    const pixDiscountPercent = 15; // Desconto automático de 15% solicitado pelo usuário
    const pixPrice = finalPrice * (1 - (pixDiscountPercent / 100));
    const isPix = method === 'pix';
    const currentPrice = isPix ? pixPrice : finalPrice;

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

    const handlePreSubmit = () => {
        if (cpf.replace(/\D/g, '').length !== 11) {
            setPopup({ type: 'error', title: 'CPF Inválido', message: 'Por favor, informe um CPF válido para prosseguir.' });
            return;
        }
        if (phone.length < 14) {
            setPopup({ type: 'error', title: 'Telefone Inválido', message: 'O número de telefone deve conter o DDD.' });
            return;
        }
        if (!birthDate) {
            setPopup({ type: 'error', title: 'Data de Nascimento', message: 'Sua data de nascimento é necessária para o cadastro.' });
            return;
        }
        setShowTerms(true);
    };

    const checkPaymentStatus = async (enrollId: string) => {
        setCheckingPayment(true);
        try {
            const response = await fetch('/api/verify-payment', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ enrollment_id: enrollId })
            });

            const result = await response.json();

            if (result.status === 'Ativo') {
                setPopup({ type: 'success', title: 'Pagamento Confirmado!', message: 'Seu acesso já está liberado. Bons estudos!' });
                setTimeout(() => navigate(`/aluno/curso/${id}`), 2000);
            } else if (result.status === 'Cancelado' || result.status === 'rejected') {
                setPopup({ type: 'error', title: 'Pagamento Recusado', message: 'O Mercado Pago informou que seu pagamento foi recusado ou cancelado.' });
            } else if (result.status === 'notFound') {
                setPopup({ type: 'info', title: 'Aguardando...', message: 'Ainda não encontramos nenhum pagamento. Se você já pagou, aguarde 1 minuto e tente novamente.' });
            } else {
                setPopup({ type: 'info', title: 'Status do Pagamento', message: `O pagamento ainda está sendo processado (Status: ${result.paymentStatus || 'Pendente'}).` });
            }
        } catch (e) {
            console.error('Erro ao verificar:', e);
            // Fallback para verificar só no DB se a API falhar
            const { data } = await supabase.from('enrollments').select('status').eq('id', enrollId).single();
            if (data?.status === 'Ativo') {
                setPopup({ type: 'success', title: 'Pagamento Confirmado!', message: 'Seu acesso já está liberado. Bons estudos!' });
                setTimeout(() => navigate(`/aluno/curso/${id}`), 2000);
            } else {
                setPopup({ type: 'error', title: 'Erro de Conexão', message: 'Não conseguimos verificar o status agora. Tente novamente em instantes.' });
            }
        } finally {
            setCheckingPayment(false);
        }
    };

    const handlePlaceOrder = async () => {
        if (!agreed) {
            setPopup({ type: 'info', title: 'Atenção', message: 'Você precisa aceitar os termos de adesão.' });
            return;
        }
        setSubmitting(true);

        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error('Sessão inválida');

            // 1. Atualizar Perfil
            await supabase.from('profiles').update({
                cpf, phone, is_whatsapp: isWhatsApp, birth_date: birthDate, updated_at: new Date().toISOString()
            }).eq('id', session.user.id);

            // 2. Tentar encontrar matrícula existente
            const { data: existingEnroll } = await supabase
                .from('enrollments')
                .select('id, status')
                .eq('course_id', id)
                .eq('profile_id', session.user.id)
                .maybeSingle();

            let enrollment;
            const enrollPayload = {
                course_id: id,
                profile_id: session.user.id,
                status: 'Pendente',
                progress: 0,
                amount_paid: currentPrice, 
                amount_discount: discountAmount + (isPix ? (finalPrice - pixPrice) : 0),
                payment_method: isPix ? 'pix' : 'mercadopago_checkout',
                coupon_applied: appliedCoupon?.name || null
            };

            if (existingEnroll) {
                if (existingEnroll.status === 'Ativo') {
                    setPopup({ type: 'success', title: 'Matrícula Ativa', message: 'Você já possui este curso liberado!' });
                    setTimeout(() => navigate(`/aluno/curso/${id}`), 2000);
                    return;
                }
                const { data: updatedEnroll, error: updateError } = await supabase
                    .from('enrollments')
                    .update(enrollPayload)
                    .eq('id', existingEnroll.id)
                    .select()
                    .single();
                if (updateError) throw updateError;
                enrollment = updatedEnroll;
            } else {
                const { data: newEnroll, error: enrollError } = await supabase
                    .from('enrollments')
                    .insert([enrollPayload])
                    .select()
                    .single();
                if (enrollError) throw enrollError;
                enrollment = newEnroll;
            }

            // 3. SEMPRE Processar via Redirect Mercado Pago (Unificado)
            setPopup({ type: 'info', title: 'Redirecionando...', message: 'Conectando ao ambiente seguro do Mercado Pago.' });
            
            const response = await fetch('/api/create-preference', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: course.title,
                    price: currentPrice,
                    quantity: 1,
                    enrollment_id: enrollment.id,
                    course_id: id,
                    payer_email: session.user.email,
                    payer_name: userProfile?.full_name || 'Aluno',
                    is_pix: method === 'pix' // Força PIX no MP se o aluno escolheu a aba de desconto
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Erro ao criar preferência');
            }

            const { init_point } = await response.json();
            window.location.href = init_point;

        } catch (e: any) {
            console.error('Erro:', e);
            setPopup({ type: 'error', title: 'Erro de Pagamento', message: e.message || 'Não foi possível completar o pedido.' });
        } finally {
            setSubmitting(false);
        }
    };

    if (loading || !course) return <div className="p-20 text-center text-slate-400">Carregando...</div>;

    return (
        <>
            <div className="max-w-4xl mx-auto pb-20 pt-10 px-4 animate-in fade-in">
            <button onClick={() => navigate(-1)} className="mb-6 text-slate-500 hover:text-[#137fec] font-bold flex items-center gap-2"><span className="material-symbols-outlined">arrow_back</span> Voltar</button>

            <div className="bg-white rounded-[40px] shadow-xl border border-slate-100 overflow-hidden">
                <div className="bg-slate-900 p-8 text-white flex justify-between items-center bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]">
                    <div>
                        <p className="text-[#137fec] font-black uppercase tracking-widest text-xs mb-2">Checkout Seguro</p>
                        <h1 className="text-3xl font-black italic">{course.title}</h1>
                    </div>
                    <div className="text-right">
                        <p className="text-sm text-slate-400 font-bold uppercase">Preço Final</p>
                        <p className="text-3xl font-black text-[#137fec]">R$ {currentPrice.toFixed(2).replace('.', ',')}</p>
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
                            <div className="mt-6 space-y-4">
                                <h3 className="font-black text-slate-800 flex items-center gap-2 uppercase tracking-wide text-sm"><span className="material-symbols-outlined">payments</span> Método de Pagamento</h3>
                                
                                <div className="grid grid-cols-2 gap-3">
                                    <button 
                                        onClick={() => setMethod('all')}
                                        className={`p-4 rounded-2xl border-2 transition-all text-left flex flex-col gap-1 ${method === 'all' ? 'border-[#137fec] bg-blue-50' : 'border-slate-100 hover:border-slate-200'}`}
                                    >
                                        <div className="flex justify-between items-center">
                                            <span className="material-symbols-outlined text-[#137fec]">credit_card</span>
                                            {method === 'all' && <span className="material-symbols-outlined text-[#137fec] text-sm">check_circle</span>}
                                        </div>
                                        <span className="text-[10px] font-black uppercase text-slate-900 leading-tight">Cartão / Boleto</span>
                                        <span className="text-[8px] font-bold text-slate-500 uppercase">Cartão em 12x ou Boleto</span>
                                    </button>

                                    <button 
                                        onClick={() => setMethod('pix')}
                                        className={`p-4 rounded-2xl border-2 transition-all text-left flex flex-col gap-1 relative overflow-hidden ${method === 'pix' ? 'border-emerald-500 bg-emerald-50' : 'border-slate-100 hover:border-slate-200'}`}
                                    >
                                        <div className="flex justify-between items-center">
                                            <span className="material-symbols-outlined text-emerald-500">pix</span>
                                            {method === 'pix' && <span className="material-symbols-outlined text-emerald-500 text-sm">check_circle</span>}
                                        </div>
                                        <span className="text-[10px] font-black uppercase text-slate-900 leading-tight">PIX</span>
                                        <span className="text-[8px] font-bold text-emerald-600 uppercase">-{pixDiscountPercent}% OFF</span>
                                        {pixDiscountPercent > 0 && <div className="absolute top-1 -right-4 bg-emerald-500 text-white text-[7px] font-black px-4 py-0.5 rotate-45 uppercase">PROMO</div>}
                                    </button>
                                </div>
                            </div>

                            <div className="mt-8 space-y-4 p-5 bg-slate-900 rounded-2xl text-white shadow-xl">
                                <div className="flex justify-between text-xs items-center">
                                    <span className="text-slate-400 font-bold uppercase tracking-widest">Resumo do Pagamento</span>
                                    <span className="text-[9px] bg-[#137fec] px-2 py-0.5 rounded-full font-black uppercase">{isPix ? 'PIX ATIVO' : 'CRÉDITO/OUTROS'}</span>
                                </div>
                                <div className="space-y-2 pt-2">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-400">Preço Base</span>
                                        <span className="font-bold text-white">R$ {course.price_offer?.toFixed(2).replace('.', ',')}</span>
                                    </div>
                                    {discountAmount > 0 && (
                                        <div className="flex justify-between text-sm text-[#137fec]">
                                            <span className="flex items-center gap-1 font-bold">Cupom: {appliedCoupon?.name}</span>
                                            <span className="font-bold">- R$ {discountAmount.toFixed(2).replace('.', ',')}</span>
                                        </div>
                                    )}
                                    {isPix && pixDiscountPercent > 0 && (
                                        <div className="flex justify-between text-sm text-emerald-400">
                                            <span className="flex items-center gap-1 font-bold">Desconto PIX ({pixDiscountPercent}%)</span>
                                            <span className="font-bold">- R$ {(finalPrice - pixPrice).toFixed(2).replace('.', ',')}</span>
                                        </div>
                                    )}
                                    <div className="pt-3 border-t border-white/10 flex justify-between items-center">
                                        <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Total Líquido</span>
                                        <span className={`${isPix ? 'text-emerald-400' : 'text-[#137fec]'} text-2xl font-black`}>R$ {currentPrice.toFixed(2).replace('.', ',')}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-6 space-y-3">
                                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest pl-1">Possui um Cupom?</label>
                                <div className="flex gap-2">
                                    <input 
                                        type="text" 
                                        value={couponCode} 
                                        onChange={e => setCouponCode(e.target.value)} 
                                        className="flex-1 h-11 px-4 bg-white border border-slate-200 rounded-xl text-sm font-bold uppercase outline-none focus:border-blue-500" 
                                        placeholder="CÓDIGO" 
                                    />
                                    <button 
                                        onClick={applyCoupon}
                                        className="px-4 h-11 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-[#137fec] transition-all"
                                    >
                                        Aplicar
                                    </button>
                                </div>
                            </div>
                        </div>

                        <button 
                            onClick={handlePreSubmit} 
                            className={`w-full mt-4 py-5 rounded-2xl font-black uppercase tracking-widest shadow-lg transition-all flex items-center justify-center gap-2 ${isPix ? 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/20' : 'bg-[#009ee3] hover:bg-[#0081b9] shadow-blue-500/20'} text-white`}
                        >
                            {isPix ? 'Pagar com PIX' : 'Pagar com Mercado Pago'}
                            <span className="material-symbols-outlined">{isPix ? 'qr_code' : 'open_in_new'}</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Modal de PIX interno removido para usar o checkout do Mercado Pago */}

            {/* Terms Modal */}
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

                        <div className="max-h-[350px] overflow-y-auto pr-4 space-y-6 text-sm text-slate-600 custom-scrollbar text-justify">
                            <section>
                                <h4 className="font-black text-slate-900 uppercase text-xs mb-2 flex items-center gap-2">
                                    <span className="size-5 bg-slate-900 text-white rounded-full flex items-center justify-center text-[10px] font-sans">1</span>
                                    Objeto do Serviço
                                </h4>
                                <p className="leading-relaxed">
                                    Ao adquirir este curso, você terá acesso imediato à nossa plataforma de estudos, que inclui <strong>apostilas interativas</strong>, simulados inéditos e um banco de questões comentadas por especialistas. O material é 100% digital e focado no edital vigente.
                                </p>
                            </section>

                            <section>
                                <h4 className="font-black text-slate-900 uppercase text-xs mb-2 flex items-center gap-2">
                                    <span className="size-5 bg-slate-900 text-white rounded-full flex items-center justify-center text-[10px] font-sans">2</span>
                                    Garantia e Reembolso
                                </h4>
                                <p className="leading-relaxed">
                                    Prezamos pela sua total satisfação. Conforme o Código de Defesa do Consumidor, você tem o direito de arrependimento com <strong>devolução integral do valor pago em até 7 (sete) dias</strong> corridos após a compra. Sem burocracia, direto pelo nosso suporte.
                                </p>
                            </section>

                            <section>
                                <h4 className="font-black text-slate-900 uppercase text-xs mb-2 flex items-center gap-2">
                                    <span className="size-5 bg-slate-900 text-white rounded-full flex items-center justify-center text-[10px] font-sans">3</span>
                                    Propriedade Intelectual
                                </h4>
                                <p className="leading-relaxed">
                                    Todo o conteúdo disponibilizado é protegido por leis de direitos autorais. O acesso é pessoal e intransferível. O compartilhamento de login ou a reprodução não autorizada do material resultará no bloqueio imediato da conta e medidas legais cabíveis.
                                </p>
                            </section>

                            <section>
                                <h4 className="font-black text-slate-900 uppercase text-xs mb-2 flex items-center gap-2">
                                    <span className="size-5 bg-slate-900 text-white rounded-full flex items-center justify-center text-[10px] font-sans">4</span>
                                    Privacidade de Dados
                                </h4>
                                <p className="leading-relaxed">
                                    Seus dados pessoais (CPF, e-mail, telefone) são tratados com total segurança e confidencialidade, seguindo rigorosamente as diretrizes da Lei Geral de Proteção de Dados (LGPD).
                                </p>
                            </section>

                            <section className="p-5 bg-slate-50 rounded-3xl border border-slate-100 italic font-medium text-[#137fec] text-center text-xs">
                                "Nossa missão é facilitar sua jornada rumo à farda. Estude com a melhor tecnologia educacional do mercado."
                            </section>
                        </div>

                        <div className="space-y-4 pt-4 border-t border-slate-50">
                            <label className="flex items-center gap-4 p-5 border-2 border-slate-100 rounded-[24px] cursor-pointer hover:border-[#137fec] hover:bg-blue-50/20 transition-all group">
                                <div className="relative flex items-center">
                                    <input 
                                        type="checkbox" 
                                        checked={agreed} 
                                        onChange={e => setAgreed(e.target.checked)} 
                                        className="size-6 rounded-lg border-2 border-slate-300 text-[#137fec] focus:ring-0 cursor-pointer appearance-none checked:bg-[#137fec] checked:border-[#137fec] transition-all" 
                                    />
                                    <span className="material-symbols-outlined absolute inset-0 text-white text-base flex items-center justify-center pointer-events-none opacity-0 group-[&:has(input:checked)]:opacity-100 scale-50 group-[&:has(input:checked)]:scale-100 transition-all font-black">check</span>
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-sm font-black text-slate-800 uppercase tracking-tighter">Li e concordo com os termos</span>
                                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Declaro estar ciente das regras de uso e política de garantia</span>
                                </div>
                            </label>

                            <div className="flex gap-4">
                                <button onClick={() => setShowTerms(false)} className="flex-1 py-4 border border-slate-200 rounded-2xl font-black uppercase text-[10px] tracking-widest text-slate-400 hover:bg-slate-50 transition-all">Cancelar</button>
                                <button 
                                    onClick={handlePlaceOrder} 
                                    disabled={submitting || !agreed} 
                                    className="flex-[2] py-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-[0.2em] shadow-xl shadow-emerald-500/20 disabled:opacity-30 disabled:grayscale transition-all flex items-center justify-center gap-2 group"
                                >
                                    {submitting ? 'Aguarde...' : 'Confirmar e Pagar'}
                                    <span className="material-symbols-outlined text-sm group-hover:translate-x-1 transition-transform">arrow_forward</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Professional Status Popup */}
            {popup && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-white rounded-[40px] shadow-3xl max-w-sm w-full p-10 text-center space-y-6 animate-in zoom-in-95 duration-300 relative overflow-hidden">
                        <div className={`absolute top-0 left-0 w-full h-2 ${popup.type === 'success' ? 'bg-emerald-500' : popup.type === 'error' ? 'bg-rose-500' : 'bg-blue-500'}`}></div>
                        
                        <div className={`size-20 rounded-3xl flex items-center justify-center mx-auto mb-4 ${popup.type === 'success' ? 'bg-emerald-50 text-emerald-500' : popup.type === 'error' ? 'bg-rose-50 text-rose-500' : 'bg-blue-50 text-blue-500'}`}>
                            <span className="material-symbols-outlined text-4xl font-black">
                                {popup.type === 'success' ? 'check_circle' : popup.type === 'error' ? 'error' : 'info'}
                            </span>
                        </div>

                        <div className="space-y-2">
                            <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter italic">{popup.title}</h3>
                            <p className="text-slate-500 text-sm font-medium leading-relaxed">{popup.message}</p>
                        </div>

                        <button 
                            onClick={() => setPopup(null)}
                            className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-[#137fec] transition-all shadow-xl active:scale-95"
                        >
                            Entendido
                        </button>
                    </div>
                </div>
            )}

            <style>{`
                .label-text { display: block; font-size: 10px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.1em; color: #94a3b8; margin-bottom: 4px; padding-left: 4px; }
                .input-field { width: 100%; padding: 12px 16px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; font-weight: 600; color: #334155; outline: none; transition: all; }
                .input-field:focus { border-color: #009ee3; background: #fff; box-shadow: 0 0 0 4px rgba(0,158,227,0.1); }
                .custom-scrollbar::-webkit-scrollbar { width: 5px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #cbd5e1; }
            `}</style>
        </>
    );
};

export default CourseCheckout;
