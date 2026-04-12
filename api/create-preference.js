import { MercadoPagoConfig, Preference } from 'mercadopago';

// Inicializa o cliente MP com o Token de Acesso (definir nas variáveis de ambiente do Vercel)
const client = new MercadoPagoConfig({
    accessToken: process.env.MP_ACCESS_TOKEN || '',
    options: { timeout: 5000 }
});

export default async function handler(req, res) {
    // Apenas método POST
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { title, price, quantity, enrollment_id, payer_email, payer_name, is_pix } = req.body;

        if (!title || !price || !enrollment_id) {
            return res.status(400).json({ error: 'Dados incompletos: title, price ou enrollment_id faltando.' });
        }

        const preference = new Preference(client);

        const result = await preference.create({
            body: {
                items: [
                    {
                        id: enrollment_id,
                        title: title + (is_pix ? ' (Desconto PIX)' : ''),
                        quantity: quantity || 1,
                        unit_price: Number(price)
                    }
                ],
                payer: {
                    email: payer_email,
                    name: payer_name
                },
                payment_methods: {
                    excluded_payment_methods: [],
                    excluded_payment_types: is_pix ? [
                        { id: 'ticket' }, 
                        { id: 'credit_card' }, 
                        { id: 'debit_card' }
                    ] : [],
                    installments: is_pix ? 1 : 12
                },
                external_reference: enrollment_id, // Chave para vincular no webhook
                back_urls: {
                    success: `${process.env.VITE_APP_URL || 'http://localhost:5173'}/aluno/curso/${req.body.course_id}?status=success`,
                    failure: `${process.env.VITE_APP_URL || 'http://localhost:5173'}/aluno/curso/${req.body.course_id}/checkout?status=failure`,
                    pending: `${process.env.VITE_APP_URL || 'http://localhost:5173'}/aluno/curso/${req.body.course_id}/checkout?status=pending`
                },
                auto_return: 'approved',
                statement_descriptor: 'BORA PASSAR'
            }
        });

        return res.status(200).json({
            id: result.id,
            init_point: result.init_point,
            sandbox_init_point: result.sandbox_init_point
        });

    } catch (error) {
        console.error('Erro ao criar preferência:', error);
        return res.status(500).json({ error: 'Erro ao processar pagamento', details: error.message });
    }
}
