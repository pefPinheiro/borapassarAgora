
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { action, content, title, chapter } = await req.json()
    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')
    
    if (!GEMINI_API_KEY) throw new Error('Chave GEMINI_API_KEY não configurada.');

    let systemPrompt = "";
    let promptContent = "";

    if (action === 'list_chapters') {
        systemPrompt = `Você é um estruturador de documentos.
Analise o índice e o conteúdo geral desta apostila e retorne APENAS um array JSON de strings com os títulos dos capítulos ou grandes blocos de assunto.
Cubra a apostila inteira do início ao fim.
Formato: ["Capítulo 1: Introdução", "Capítulo 2: Conceitos", ...]`;
        promptContent = `Apostila: ${title}\n\nConteúdo:\n${content.substring(0, 15000)}`;
    } 
    else if (action === 'analyze_chapter') {
        systemPrompt = `Você é um auditor implacável de material educacional, focado 100% em VERACIDADE FACTUAL (checagem de fatos, leis e atualidades).
Analise APENAS o conteúdo que diz respeito ao capítulo/tópico: "${chapter}".
Sua ÚNICA missão é encontrar erros factuais, dados incorretos, leis revogadas ou mentiras/alucinações. 
IGNORE melhorias de estilo ou gramática. Foque apenas no que for uma informação falsa ou desatualizada.

LIMITE SUA RESPOSTA AOS 5 ERROS MAIS GRAVES encontrados. Se houver mais, ignore. Precisamos de respostas curtas e diretas.
Se o capítulo estiver 100% correto e validado factualmente, retorne um array vazio: []

REGRAS ESTRITAS DE SAÍDA JSON:
- NUNCA insira quebras de linha (Enter) dentro dos textos. Tudo deve estar na mesma linha.
- Escape todas as aspas duplas internas com barra invertida.

Responda APENAS com um array JSON. Formato esperado:
[
  { 
    "original": "A transcrição exata e literal da frase ou parágrafo errado", 
    "tipo_correcao": "substituicao" | "exclusao" | "acrescimo", 
    "sugestao": "O texto exato para substituir, ou texto para adicionar, ou o motivo da exclusão",
    "analise": "Explicação direta do porquê está errado"
  }
]`;
        promptContent = `Apostila: ${title}\nCapítulo Alvo: ${chapter}\n\nConteúdo Completo (encontre e foque apenas na parte correspondente ao capítulo alvo):\n${content.substring(0, 15000)}`;
    } else {
        throw new Error('Ação inválida. Use list_chapters ou analyze_chapter.');
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000); // 25s timeout to prevent 546 Edge limit

    let response;
    try {
      response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: promptContent }, { text: systemPrompt }] }],
          generationConfig: { 
              temperature: 0.1, 
              topP: 0.8, 
              topK: 40, 
              maxOutputTokens: 4096,
              responseMimeType: "application/json"
          }
        }),
        signal: controller.signal
      });
    } catch (e) {
      if (e.name === 'AbortError') {
        throw new Error("A API do Google demorou muito para responder (Timeout de 25s). O conteúdo pode ser grande demais.");
      }
      throw e;
    } finally {
      clearTimeout(timeoutId);
    }

    const responseText = await response.text();
    let data;
    try { data = JSON.parse(responseText); } catch (e) { throw new Error("A API do Google não retornou um JSON válido na casca."); }

    if (!response.ok) {
      console.error("Erro da API do Google:", data);
      throw new Error(data.error?.message || "Erro desconhecido na API do Google.");
    }

    if (!data.candidates || data.candidates.length === 0) throw new Error("A IA não retornou nenhuma análise.");
    
    let aiResponseText = data.candidates[0].content.parts[0].text;
    
    // Sanitize literal newlines and tabs which break JSON.parse when Gemini copies multiline text verbatim
    aiResponseText = aiResponseText.replace(/[\n\r\t]/g, " ");

    // Validate JSON before returning
    let parsedJson;
    try {
      parsedJson = JSON.parse(aiResponseText);
    } catch (e) {
      console.error("Erro ao validar JSON da IA:", aiResponseText);
      throw new Error(`A IA retornou um formato inválido ou incompleto. Resposta: ${aiResponseText.substring(0, 100)}...`);
    }

    // Force extraction of array if AI wrapped it in an object
    if (!Array.isArray(parsedJson)) {
      if (typeof parsedJson === 'object' && parsedJson !== null) {
        const arr = Object.values(parsedJson).find(v => Array.isArray(v));
        if (arr) {
          parsedJson = arr;
          aiResponseText = JSON.stringify(parsedJson);
        } else {
          // Se não encontrou nenhum array dentro do objeto, força um array vazio
          parsedJson = [];
          aiResponseText = "[]";
        }
      } else {
        parsedJson = [];
        aiResponseText = "[]";
      }
    }

    return new Response(aiResponseText, { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })

  } catch (error) {
    console.error("Erro na Edge Function:", error);
    return new Response(JSON.stringify({ error: true, message: error.message || 'Erro interno na função' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500
    })
  }
})
