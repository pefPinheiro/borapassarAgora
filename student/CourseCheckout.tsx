
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

            if (!response.ok) {
                if (isManual) setPopup({ type: 'error', title: 'Erro Crítico no Banco', message: result.details || result.error || 'Falha ao processar.' });
                console.error('Erro detalhado:', result);
                return;
            }

            if (result.status === 'Ativo') {
                // Fallback de segurança: Tenta atualizar status no frontend caso backend falhe por falta de chave
                try {
                    await supabase.from('enrollments').update({ status: 'Ativo' }).eq('id', idToVerify);
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

                <div className={`p-8 ${pixData ? 'max-w-md mx-auto' : 'grid grid-cols-1 md:grid-cols-2 gap-10'}`}>
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
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-xl overflow-y-auto">
                    <div className="bg-white rounded-[48px] shadow-2xl border border-white max-w-2xl w-full flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-300 overflow-hidden">
                        {/* Header do Modal */}
                        <div className="bg-slate-50 p-8 md:p-10 border-b border-slate-100 flex items-center justify-between">
                            <div className="space-y-1">
                                <h3 className="text-3xl font-black text-slate-900 uppercase tracking-tighter italic leading-none">Contrato de <span className="text-blue-500">Adesão.</span></h3>
                                <p className="text-[10px] font-black uppercase text-slate-400 tracking-[0.3em]">Leia os detalhes da sua inscrição abaixo</p>
                            </div>
                            <div className="size-14 bg-white shadow-xl rounded-2xl flex items-center justify-center text-blue-500 border border-slate-100">
                                <span className="material-symbols-outlined text-3xl">verified_user</span>
                            </div>
                        </div>

                        {/* Corpo do Modal - Resumo em Destaque */}
                        <div className="flex-1 overflow-y-auto custom-scrollbar">
                            <div className="p-8 md:p-10 space-y-10">
                                
                                {/* Box de Destaque dos Dados do Curso */}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="md:col-span-3 p-6 bg-blue-600 text-white rounded-[32px] shadow-lg shadow-blue-500/20 relative overflow-hidden group">
                                        <div className="absolute top-0 right-0 size-32 bg-white/10 rounded-full -translate-x-1/2 -translate-y-1/2 blur-2xl"></div>
                                        <p className="text-[9px] font-black uppercase tracking-[0.3em] opacity-60 mb-2">Você está adquirindo:</p>
                                        <h4 className="text-2xl font-black italic leading-tight">{course.title}</h4>
                                    </div>
                                    <div className="p-5 bg-slate-50 border border-slate-100 rounded-3xl text-center">
                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Investimento</p>
                                        <p className="text-xl font-black text-slate-900 leading-none">R$ {currentPrice.toFixed(2).replace('.', ',')}</p>
                                    </div>
                                    <div className="p-5 bg-slate-50 border border-slate-100 rounded-3xl text-center">
                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Duração do Acesso</p>
                                        <p className="text-xl font-black text-slate-900 leading-none">{course.access_days || 365} Dias</p>
                                    </div>
                                    <div className="p-5 bg-slate-50 border border-slate-100 rounded-3xl text-center">
                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Conteúdo</p>
                                        <p className="text-xl font-black text-slate-900 leading-none italic uppercase">Digital</p>
                                    </div>
                                </div>

                                {/* Texto dos Termos */}
                                <div className="space-y-6 text-sm text-slate-600 font-medium leading-relaxed">
                                    <div className="space-y-4 text-justify">
                                        <p>
                                            Ao confirmar esta inscrição, você declara estar ciente de que o <strong>Bora Passar Agora</strong> fornece um ecossistema de aprendizagem estratégica focado em desempenho.
                                        </p>

                                        <div className="p-6 bg-rose-50 rounded-3xl border border-rose-100 text-rose-900 space-y-2">
                                            <h5 className="font-black text-xs uppercase tracking-widest flex items-center gap-2 text-rose-600"><span className="material-symbols-outlined text-lg">videocam_off</span> Aviso Importante: Natureza do Material</h5>
                                            <p className="text-xs font-bold leading-relaxed">
                                                Este curso foi estrategicamente desenvolvido para o estudo ativo. Portanto, <strong>NÃO é um curso baseado em videoaulas tradicionais</strong>. Nosso foco total é a aprovação através de <strong>Apostilas Digitais Interativas</strong> (com exportação para PDF), Banco de Questões e Simulados. Eventuais vídeos podem existir como complementos pontuais de algum assunto, mas a metodologia central é baseada em leitura estratégica e prática de questões.
                                            </p>
                                        </div>
                                        
                                        <div className="p-6 bg-amber-50 rounded-3xl border border-amber-100 text-amber-900 space-y-4">
                                            <h5 className="font-black text-xs uppercase tracking-widest flex items-center gap-2"><span className="material-symbols-outlined text-lg">database</span> Sobre o Acervo de Questões</h5>
                                            <p className="text-xs leading-relaxed">
                                                Declaramos que o volume de questões disponível na plataforma é dinâmico e diversificado, incluindo: <strong>Questões de múltiplas Bancas Examinadoras</strong> (focadas no edital), <strong>Questões Inéditas</strong> (desenvolvidas por nosso time pedagógico), questões vinculadas a <strong>módulos interativos</strong>, além de acesso integral a <strong>Cadernos</strong> e <strong>Simulados</strong> periódicos.
                                            </p>
                                        </div>

                                        <p>
                                            <strong>1. Direitos sobre o Conteúdo:</strong> O material é protegido pela Lei de Direitos Autorais. A cópia, o rateio, a venda ou o compartilhamento das credenciais de acesso é crime e resultará em banimento imediato sem restituição de valores, além de sanções civis e criminais.
                                        </p>

                                        <p>
                                            <strong>2. Prazo de Garantia:</strong> Respeitamos integralmente o seu direito de arrependimento (Art. 49 do CDC). Você tem o prazo incondicional de <strong>7 (sete) dias corridos</strong> para solicitar o cancelamento e obter reembolso total, caso o material não atenda suas expectativas.
                                        </p>

                                        <p>
                                            <strong>3. Atualizações:</strong> Por se tratar de um material digital para concursos, atualizações de novos Simulados e questões ocorrerão conforme necessidade pedagógica e publicações de novos editais/retificações durante o seu período de acesso.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Footer do Modal com Checkbox e Submissão */}
                        <div className="p-8 md:p-10 bg-slate-50 border-t border-slate-100 space-y-6">
                            <label className={`flex items-center gap-4 p-5 rounded-3xl border-2 transition-all cursor-pointer ${agreed ? 'bg-blue-600 border-blue-600 text-white shadow-xl shadow-blue-500/20' : 'bg-white border-slate-200 text-slate-500 hover:border-blue-300'}`}>
                                <input 
                                    type="checkbox" 
                                    checked={agreed} 
                                    onChange={e => setAgreed(e.target.checked)} 
                                    className="size-6 text-blue-600 border-2 border-slate-300 rounded-lg focus:ring-blue-500" 
                                />
                                <span className={`font-black uppercase tracking-widest text-[11px] ${agreed ? 'text-white' : 'text-slate-500'}`}>Li e concordo com todos os termos acima</span>
                            </label>

                            <div className="flex gap-4">
                                <button 
                                    onClick={() => setShowTerms(false)} 
                                    className="px-8 py-5 rounded-3xl font-black uppercase tracking-widest text-slate-400 bg-white border border-slate-200 hover:bg-slate-50 transition-colors text-xs"
                                >
                                    Cancelar
                                </button>
                                <button 
                                    onClick={handlePlaceOrder} 
                                    disabled={!agreed || submitting} 
                                    className={`flex-1 py-5 rounded-3xl font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all text-white text-xs ${agreed && !submitting ? 'bg-blue-600 hover:bg-blue-700 shadow-xl shadow-blue-600/30' : 'bg-slate-300 cursor-not-allowed'}`}
                                >
                                    {submitting ? (
                                        <><span className="material-symbols-outlined animate-spin">refresh</span> Validando...</>
                                    ) : (
                                        <><span className="material-symbols-outlined">rocket_launch</span> Confirmar e Pagar</>
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
