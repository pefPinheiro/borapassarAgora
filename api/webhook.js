import { MercadoPagoConfig, Payment } from 'mercadopago';
import { createClient } from '@supabase/supabase-js';

// Configurações (Ambiente)
const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN;
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL; // Tenta pegar do frontend env se backend não tiver específico, mas ideal é backend env
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY; // NECESSÁRIO KEY DE SERVIÇO PARA UPDATE EM TABELA PROTEGIDA

const client = new MercadoPagoConfig({ accessToken: MP_ACCESS_TOKEN || '' });
const supabase = createClient(SUPABASE_URL || '', SUPABASE_KEY || '');

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(200).send('OK'); // Responder OK para validações de health check
    }

    try {
        const { type, data } = req.body;

        // Mercado Pago envia 'payment' ou 'topic' nas query params as vezes, mas no body vem resource/topic
        // Estrutura padrão v2: type: "payment", data: { id: "..." }

        let paymentId = data?.id;

        // Fallback para query params (notificações antigas ou IPN)
        if (!paymentId && req.query.id && (req.query.topic === 'payment' || req.query.type === 'payment')) {
            paymentId = req.query.id;
        }

        if (type === 'payment' || paymentId) {
            const payment = new Payment(client);
            const paymentInfo = await payment.get({ id: paymentId });
            const { status, external_reference, payment_method_id } = paymentInfo;

            console.log(`[Webhook MP] Recebido: Pagamento ${paymentId}, Status: ${status}, Ref: ${external_reference}`);

            if (external_reference) {
                let enrollStatus = 'Pendente';
                if (status === 'approved') enrollStatus = 'Ativo';
                else if (status === 'rejected' || status === 'cancelled') enrollStatus = 'Cancelado';

                if (SUPABASE_KEY) {
                    const { error } = await supabase
                        .from('enrollments')
                        .update({
                            status: enrollStatus,
                            payment_method: payment_method_id || 'mercadopago',
                            updated_at: new Date().toISOString()
                        })
                        .eq('id', external_reference);

                    if (error) {
                        console.error(`[Webhook Erro] Falha ao atualizar matrícula ${external_reference}:`, error);
                        return res.status(200).json({ error: 'Database update failed' });
                    }
                    console.log(`[Webhook Sucesso] Matrícula ${external_reference} atualizada para ${enrollStatus}`);
                } else {
                    console.warn('[Webhook Aviso] SUPABASE_SERVICE_ROLE_KEY não encontrada!');
                }
            }
        }

        return res.status(200).send('OK');

    } catch (error) {
        console.error('Erro no Webhook:', error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
}
