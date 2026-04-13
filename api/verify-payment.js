import { MercadoPagoConfig, Payment } from 'mercadopago';
import { createClient } from '@supabase/supabase-js';

const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN;
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const client = new MercadoPagoConfig({ accessToken: MP_ACCESS_TOKEN || '' });
const supabase = (SUPABASE_URL && SUPABASE_KEY) ? createClient(SUPABASE_URL, SUPABASE_KEY) : null;

export default async function handler(req, res) {
    console.log(`[Verify] Recebida requisição ${req.method} para /api/verify-payment`);
    
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    if (!MP_ACCESS_TOKEN) {
        console.error('[Verify] Erro: MP_ACCESS_TOKEN não configurado.');
        return res.status(500).json({ error: 'Configuration error', details: 'MP_ACCESS_TOKEN is missing' });
    }

    try {
        const { enrollment_id } = req.body;

        if (!enrollment_id) {
            return res.status(400).json({ error: 'enrollment_id is required' });
        }

        console.log(`[Verify] Iniciando verificação manual para matrícula: ${enrollment_id}`);

        // 1. Buscar se existe algum pagamento para esta referência no Mercado Pago
        // Nota: O ideal seria ter o ID do pagamento salvo, mas podemos buscar por external_reference
        const payment = new Payment(client);
        const searchResponse = await payment.search({
            options: {
                external_reference: enrollment_id,
                sort: 'date_created',
                criteria: 'desc'
            }
        });

        const payments = searchResponse.results || [];

        if (payments.length === 0) {
            return res.status(200).json({ 
                status: 'notFound', 
                message: 'Nenhum pagamento encontrado para esta matrícula no Mercado Pago.' 
            });
        }

        const latestPayment = payments[0];
        const { status, payment_method_id } = latestPayment;

        console.log(`[Verify] Último pagamento encontrado: ${latestPayment.id}, Status: ${status}`);

        let enrollStatus = 'Pendente';
        if (status === 'approved') enrollStatus = 'Ativo';
        else if (status === 'rejected' || status === 'cancelled') enrollStatus = 'Cancelado';

        // 2. Atualizar no Banco de Dados
        
        let clientToUse = supabase;
        
        // Se não tivermos o Service Role Key, tentamos usar o token de acesso do próprio usuário (enviado via header)
        if (!clientToUse && req.headers.authorization && SUPABASE_URL) {
            const anonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
            if (anonKey) {
                clientToUse = createClient(SUPABASE_URL, anonKey, {
                    global: { headers: { Authorization: req.headers.authorization } }
                });
            }
        }

        if (clientToUse) {
            const { data, error: dbError } = await clientToUse

                .from('enrollments')
                .update({
                    status: enrollStatus,
                    payment_method: payment_method_id || 'mercadopago'
                })
                .eq('id', enrollment_id)
                .select();

            if (dbError) {
                console.error('[Verify Erro DB]', dbError);
                return res.status(500).json({
                    error: 'Falha grave ao atualizar Banco de Dados (Supabase)',
                    details: dbError.message,
                    hint: 'Constraint, ForeignKey ou RLS falhou.'
                });
            }

            if (!data || data.length === 0) {
                return res.status(500).json({
                    error: 'Nenhuma linha atualizada no Supabase.',
                    details: 'O ID da matrícula pode não existir ou o Service Role Key da Vercel é inválido e o RLS bloqueou a ação.'
                });
            }

            return res.status(200).json({
                status: enrollStatus,
                paymentStatus: status,
                updated: true
            });
        }

        return res.status(500).json({ 
            error: 'Serviço de Banco de Dados Desconectado',
            details: 'A Vercel não encontrou as chaves SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY.'
        });

    } catch (error) {
        console.error('[Verify] Erro:', error);
        return res.status(500).json({ error: 'Internal Server Error', details: error.message });
    }
}
