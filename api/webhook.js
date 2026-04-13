import { MercadoPagoConfig, Payment } from 'mercadopago';
import { createClient } from '@supabase/supabase-js';

// Configurações (Ambiente)
const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN;
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const client = new MercadoPagoConfig({ accessToken: MP_ACCESS_TOKEN || '' });
const supabase = createClient(SUPABASE_URL || '', SUPABASE_KEY || '');

export default async function handler(req, res) {
    // Mercado Pago envia POST para notificações
    if (req.method !== 'POST') {
        return res.status(200).send('OK');
    }

    try {
        console.log('[Webhook MP] Notificação recebida:', JSON.stringify(req.body));
        
        const { type, data, action, resource } = req.body;
        let paymentId = data?.id;

        // Fallback 1: Se vier no action/resource (estilo antigo/IPN)
        if (!paymentId && type === 'payment' && resource) {
            paymentId = resource.split('/').pop();
        }

        // Fallback 2: Se vier via Query Params (visto em alguns casos de IPN)
        if (!paymentId && req.query.id && (req.query.topic === 'payment' || req.query.type === 'payment')) {
            paymentId = req.query.id;
        }

        // Se for um teste de webhook (vazio ou sem ID relevante)
        if (!paymentId) {
            console.log('[Webhook MP] Notificação ignorada (ID não encontrado)');
            return res.status(200).send('OK');
        }

        console.log(`[Webhook MP] Processando pagamento ID: ${paymentId}`);

        const payment = new Payment(client);
        const paymentInfo = await payment.get({ id: paymentId });
        
        // No SDK v2, os dados costumam vir na raíz ou no body dependendo da versão interna
        const status = paymentInfo.status;
        const external_reference = paymentInfo.external_reference;
        const payment_method_id = paymentInfo.payment_method_id;

        console.log(`[Webhook MP] Dados extraídos -> Status: ${status}, ExternalRef: ${external_reference}`);

        if (external_reference) {
            let enrollStatus = 'Pendente';
            
            // Mapeamento de status do Mercado Pago
            if (status === 'approved') enrollStatus = 'Ativo';
            else if (status === 'rejected' || status === 'cancelled') enrollStatus = 'Cancelado';
            else if (status === 'in_process' || status === 'pending') enrollStatus = 'Pendente';

            if (SUPABASE_KEY) {
                console.log(`[Webhook MP] Tentando atualizar matrícula ${external_reference} para ${enrollStatus}...`);
                
                const { data: updatedData, error } = await supabase
                    .from('enrollments')
                    .update({
                        status: enrollStatus,
                        payment_method: payment_method_id || 'mercadopago',
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', external_reference)
                    .select();

                if (error) {
                    console.error(`[Webhook Erro DB] Falha ao atualizar matrícula ${external_reference}:`, error);
                    return res.status(200).json({ error: 'Database update failed' }); // Respondemos 200 para evitar loops infinitos do MP se o erro for nosso
                }
                
                if (!updatedData || updatedData.length === 0) {
                    console.warn(`[Webhook MP] Nenhuma matrícula encontrada com ID ${external_reference}`);
                } else {
                    console.log(`[Webhook Sucesso] Matrícula ${external_reference} atualizada com sucesso para ${enrollStatus}`);
                }
            } else {
                console.error('[Webhook Erro] SUPABASE_SERVICE_ROLE_KEY não configurada no Vercel!');
            }
        } else {
            console.warn(`[Webhook MP] Pagamento ${paymentId} sem external_reference.`);
        }

        return res.status(200).send('OK');

    } catch (error) {
        console.error('[Webhook MP] Erro crítico:', error);
        // Respondemos 200 para o Mercado Pago não ficar reenviando se for um erro de parsing
        return res.status(200).send('Internal Error But Handled');
    }
}
