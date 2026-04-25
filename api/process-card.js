import { MercadoPagoConfig, Payment } from 'mercadopago';

const client = new MercadoPagoConfig({
    accessToken: process.env.MP_ACCESS_TOKEN || '',
    options: { timeout: 5000 }
});

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { 
            token, 
            issuer_id, 
            payment_method_id, 
            transaction_amount, 
            installments, 
            payer,
            enrollment_id,
            course_id
        } = req.body;

        if (!token || !transaction_amount || !enrollment_id) {
            return res.status(400).json({ error: 'DADOS_INCOMPLETOS', message: 'Dados do cartão ou matrícula ausentes.' });
        }

        const payment = new Payment(client);

        const body = {
            transaction_amount: Number(transaction_amount),
            token,
            description: 'Compra de Curso - Bora Passar Agora',
            installments: Number(installments),
            payment_method_id,
            issuer_id,
            payer: {
                email: payer.email,
                identification: {
                    type: 'CPF',
                    number: payer.identification?.number?.replace(/\D/g, '') || ''
                }
            },
            external_reference: enrollment_id,
            notification_url: `${(process.env.VITE_APP_URL || '').replace(/\/$/, '')}/api/webhook`,
            metadata: {
                enrollment_id,
                course_id
            }
        };

        const result = await payment.create({ body });

        return res.status(200).json({
            id: result.id,
            status: result.status,
            status_detail: result.status_detail
        });

    } catch (error) {
        console.error('Erro ao processar Cartão:', error);
        return res.status(500).json({ 
            error: 'ERRO_TECNICO', 
            message: 'Falha ao processar pagamento com cartão.', 
            details: error.message 
        });
    }
}
