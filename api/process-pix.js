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
        const { amount, description, payer, enrollment_id, course_id } = req.body;

        if (!amount || !payer || !enrollment_id) {
            return res.status(400).json({ error: 'DADOS_INCOMPLETOS', message: 'Dados necessários não fornecidos.' });
        }

        const payment = new Payment(client);

        const body = {
            transaction_amount: Number(amount),
            description: description || 'Compra de Curso - Bora Passar Agora',
            payment_method_id: 'pix',
            payer: {
                email: payer.email,
                first_name: payer.first_name || 'Aluno',
                last_name: payer.last_name || 'BPA',
                identification: {
                    type: 'CPF',
                    number: payer.cpf.replace(/\D/g, '')
                }
            },
            external_reference: enrollment_id,
            notification_url: `${process.env.VITE_APP_URL}/api/webhook`, // Opcional, o webhook geral já trata
            metadata: {
                enrollment_id,
                course_id
            }
        };

        const result = await payment.create({ body });

        return res.status(200).json({
            id: result.id,
            status: result.status,
            status_detail: result.status_detail,
            qr_code: result.point_of_interaction.transaction_data.qr_code,
            qr_code_base64: result.point_of_interaction.transaction_data.qr_code_base64,
            ticket_url: result.point_of_interaction.transaction_data.ticket_url
        });

    } catch (error) {
        console.error('Erro ao processar PIX:', error);
        return res.status(500).json({ 
            error: 'ERRO_MP', 
            message: 'Erro ao gerar QR Code PIX', 
            details: error.message 
        });
    }
}
