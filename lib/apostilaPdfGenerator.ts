import { supabase } from './supabase';
import katex from 'katex';
import { toCanvas } from 'html-to-image';
import { jsPDF } from 'jspdf';

export interface GeneratePdfOptions {
  apostilaId: string;
  courseName?: string;
  onProgress?: (status: string) => void;
}

const getBase64Image = async (url: string): Promise<string> => {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(url);
      reader.readAsDataURL(blob);
    });
  } catch {
    return url;
  }
};

export async function downloadApostilaAsPDF({ apostilaId, courseName, onProgress }: GeneratePdfOptions): Promise<void> {
  onProgress?.('Carregando dados da apostila...');

  // 1. Fetch user & profile for watermark
  const { data: { user } } = await supabase.auth.getUser();
  let studentName = 'Aluno Bora Passar';
  let studentCpf = '';

  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, cpf')
      .eq('id', user.id)
      .maybeSingle();

    if (profile) {
      studentName = profile.full_name || studentName;
      studentCpf = profile.cpf || '';
    }
  }

  // 2. Fetch Apostila data
  const { data: apostila, error: apError } = await supabase
    .from('apostilas')
    .select('*, disciplina:disciplinas(name), author:profiles!author_id(full_name), teacher:teachers(*)')
    .eq('id', apostilaId)
    .single();

  if (apError || !apostila) {
    throw new Error('Não foi possível carregar a apostila para download.');
  }

  // 3. Fallback course name if not passed
  let resolvedCourseName = courseName || '';
  if (!resolvedCourseName) {
    const { data: courseItem } = await supabase
      .from('course_items')
      .select('courses(title)')
      .eq('apostila_id', apostilaId)
      .maybeSingle();
    
    if (courseItem?.courses) {
      resolvedCourseName = (courseItem.courses as any).title || '';
    }
  }

  onProgress?.('Processando formatações, equações e questões...');

  // 4. Mathematical and Content Processors
  const cleanLatex = (tex: string) => {
    return tex
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/<\/?(?:p|div|br|span|strong|b|em|i|u|s|h[1-6]|ol|ul|li|pre|code|font)\b[^>]*?>/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  };

  const processMath = (text: string) => {
    if (!text) return '';
    return text
      .replace(/<code>([\s\S]*?\\(?:frac|sqrt|cdot|times|sum|int|align|begin|quad|implies|iff|neg|lor|land)[\s\S]*?)<\/code>/gi, '$1')
      .replace(/\$\$([\s\S]*?)\$\$/g, (_, tex) => {
        try { return katex.renderToString(cleanLatex(tex), { displayMode: true, throwOnError: false }); } catch { return _; }
      })
      .replace(/\\\[([\s\S]*?)\\\]/g, (_, tex) => {
        try { return katex.renderToString(cleanLatex(tex), { displayMode: true, throwOnError: false }); } catch { return _; }
      })
      .replace(/\\\(([\s\S]*?)\\\)/g, (_, tex) => {
        try { return katex.renderToString(cleanLatex(tex), { displayMode: false, throwOnError: false }); } catch { return _; }
      })
      .replace(/\$([^\n\$]+?)\$/g, (_, tex) => {
        if (/[\\^_\{\}\+\=\-\/\(\)]/.test(tex)) {
          try { return katex.renderToString(cleanLatex(tex), { displayMode: false, throwOnError: false }); } catch { return _; }
        }
        return _;
      })
      .replace(/\\begin\{array\}([\s\S]*?)\\end\{array\}/gi, (match) => {
        try { return katex.renderToString(cleanLatex(match), { displayMode: true, throwOnError: false }); } catch { return match; }
      });
  };

  const processMarkdown = (text: string) => {
    let processed = text;

    // Advanced Markdown Tables
    const potentialTableBlockRegex = /((?:(?:<p>|<div>)?\s*(?:(?!<\/?(?:p|div)).)*?\|.*?(?:\s*|<\/p>|<\/div>|<br\s*\/?>)*){2,})/gi;
    processed = processed.replace(potentialTableBlockRegex, (block) => {
      if (block.includes('\\begin') || block.includes('\\end')) return block;

      const lines = block
        .replace(/<(?:p|div|br\s*\/?)>/gi, '\n')
        .replace(/<\/(?:p|div)>/gi, '\n')
        .split('\n')
        .map(l => l.trim())
        .filter(l => l.includes('|'));

      if (lines.length < 2) return block;

      const parseMarkdownRow = (line: string) => {
        let cleaned = line.trim();
        if (cleaned.startsWith('|')) cleaned = cleaned.slice(1);
        if (cleaned.endsWith('|')) cleaned = cleaned.slice(0, -1);
        const parts: string[] = [];
        let current = '';
        for (let i = 0; i < cleaned.length; i++) {
          if (cleaned[i] === '|' && (i === 0 || cleaned[i - 1] !== '\\')) {
            parts.push(current.trim());
            current = '';
          } else {
            current += cleaned[i];
          }
        }
        parts.push(current.trim());
        return parts.map(p => p.replace(/\\\|/g, '|'));
      };

      const headerRow = parseMarkdownRow(lines[0]);
      const dividerRow = parseMarkdownRow(lines[1]);
      const isDivider = dividerRow.every(c => /^[|:\s-]+$/.test(c)) && dividerRow.some(c => c.includes('-'));
      if (!isDivider) return block;

      const alignments = dividerRow.map(c => {
        const start = c.startsWith(':');
        const end = c.endsWith(':');
        if (start && end) return 'center';
        if (end) return 'right';
        return 'left';
      });

      const bodyRows = lines.slice(2).map(parseMarkdownRow);

      let html = '<div class="table-container"><table><thead><tr>';
      headerRow.forEach((h, i) => {
        const align = alignments[i] || 'left';
        html += `<th style="text-align: ${align}">${h}</th>`;
      });
      html += '</tr></thead><tbody>';

      bodyRows.forEach(row => {
        if (row.length === 0 || (row.length === 1 && row[0] === '')) return;
        html += '<tr>';
        for (let i = 0; i < headerRow.length; i++) {
          const align = alignments[i] || 'left';
          html += `<td style="text-align: ${align}">${row[i] || ''}</td>`;
        }
        html += '</tr>';
      });

      html += '</tbody></table></div>';
      return html;
    });

    processed = processed.replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>');
    processed = processed.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

    const headerRegex = /(#{2,4})\s+((?:(?!(?:<br|<\/p>|<div>|\n)).)*)/gi;
    processed = processed.replace(headerRegex, (_, hashes, content) => {
      const level = hashes.length;
      return `<h${level}>${content.trim()}</h${level}>`;
    });

    processed = processed.replace(/<p>\s*<\/p>/g, '');
    return processed;
  };

  const processAll = (text: string) => {
    if (!text) return '';
    let processed = processMath(text);
    processed = processMarkdown(processed);

    // Exact Clean Callout Tags matching print styles
    processed = processed
      .replace(/\[--AVISO--\]([\s\S]*?)\[\/--AVISO--\]/g, '<div class="custom-tag tag-aviso"><div class="tag-body"><strong>Ponto de Atenção</strong></div><div class="tag-text">$1</div></div>')
      .replace(/\[--IMPORTANTE--\]([\s\S]*?)\[\/--IMPORTANTE--\]/g, '<div class="custom-tag tag-importante"><div class="tag-body"><strong>Importante</strong></div><div class="tag-text">$1</div></div>')
      .replace(/\[--LEI--\]([\s\S]*?)\[\/--LEI--\]/g, '<div class="custom-tag tag-lei"><div class="tag-body"><strong>Lei Seca / Jurisprudência</strong></div><div class="tag-text">$1</div></div>')
      .replace(/\[--LINK--\]([\s\S]*?)\[\/--LINK--\]/g, '<div class="custom-tag tag-link"><div class="tag-body"><strong>Recurso Extra</strong></div><div class="tag-text">$1</div></div>')
      .replace(/\[--OBSERVE--\]([\s\S]*?)\[\/--OBSERVE--\]/gi, '<div class="custom-tag tag-observe"><div class="tag-body"><strong>Observe</strong></div><div class="tag-text">$1</div></div>')
      .replace(/\[--FREQUENTE--\]([\s\S]*?)\[\/--FREQUENTE--\]/g, '<div class="custom-tag tag-frequente"><div class="tag-body"><strong>Cai com Frequência</strong></div><div class="tag-text">$1</div></div>')
      .replace(/\[--EXTRA--\]([\s\S]*?)\[\/--EXTRA--\]/g, '<div class="custom-tag tag-extra"><div class="tag-body"><strong>Conteúdo Extra</strong></div><div class="tag-text">$1</div></div>')
      .replace(/\[--NOVIDADE--\]([\s\S]*?)\[\/--NOVIDADE--\]/g, '<div class="custom-tag tag-novidade"><div class="tag-body"><strong>Novidade</strong></div><div class="tag-text">$1</div></div>')
      .replace(/\[--EXEMPLO--\]([\s\S]*?)\[\/--EXEMPLO--\]/g, '<div class="custom-tag tag-exemplo"><div class="tag-body"><strong>Exemplo</strong></div><div class="tag-text">$1</div></div>')
      .replace(/\[--BORA-PRATICAR--\]([\s\S]*?)\[\/--BORA-PRATICAR--\]/g, '<div class="custom-tag tag-praticar"><div class="tag-body"><strong>Bora Praticar Agora!</strong></div><div class="tag-text">$1</div></div>')
      .replace(/\[--CORRECAO--\]([\s\S]*?)\[\/--CORRECAO--\]/g, '<div class="custom-tag tag-correcao"><div class="tag-body"><strong>Correção Necessária</strong></div><div class="tag-text">$1</div></div>')
      .replace(/\[--TITULO--\]([\s\S]*?)\[\/--TITULO--\]/g, '<div class="custom-tag tag-titulo"><div class="tag-text">$1</div></div>')
      .replace(/\[--RESOLVE:?\s*(\d+)?--\]([\s\S]*?)\[\/--RESOLVE--\]/gi, (_, numero, inner) => {
        const num = numero || '00';
        const cleanInner = inner.replace(/\[--SOLUCAO--\]([\s\S]*?)\[\/--SOLUCAO--\]/gi, '<div class="resolve-solution">$1</div>');
        return `<div class="tag-resolve"><div class="resolve-header"><span>BORA PASSAR ${num}</span></div><div class="resolve-body">${cleanInner}</div></div>`;
      });

    return processed;
  };

  // 5. Clean content and extract questions in document order
  let rawContent = (apostila.content || '')
    .replace(/<div class="ap-placeholder[^>]*>([\s\S]*?)<\/div>/gi, '$1')
    .replace(/<div[^>]*data-youtube-video[^>]*>[\s\S]*?<\/div>/gi, '')
    .replace(/<iframe[^>]*>[\s\S]*?<\/iframe>/gi, '')
    .replace(/\[\s*VÍDEO AULA\s*[:=]\s*(?:")?([^"\]]+)(?:")?\s*\]/gi, '');

  const tagRegex = /\[\s*(?:QUESTÃO INTERATIVA ID|QUESTÃO INTERATIVA|VÍDEO AULA|quest_id)\s*[:=]\s*(?:")?([^"\]]+)(?:")?\s*\]|\[--QUESTAO-JSON--\]([\s\S]*?)\[\/--QUESTAO-JSON--\]/gi;
  const questionMatches: Array<{ type: 'json' | 'id', data?: any, id?: string, order: number }> = [];
  let scanMatch: RegExpExecArray | null;
  let qScanCount = 0;

  while ((scanMatch = tagRegex.exec(rawContent)) !== null) {
    const rawId = scanMatch[1]?.trim().replace(/<[^>]*>/g, '') || '';
    const jsonContent = scanMatch[2]?.trim();
    const fullTag = scanMatch[0].toUpperCase();

    if (jsonContent) {
      qScanCount++;
      try {
        const cleanJson = jsonContent.replace(/<[^>]*>/g, '').replace(/\\/g, '\\\\');
        const qData = JSON.parse(cleanJson);
        questionMatches.push({ type: 'json', data: { ...qData, questionNumber: qScanCount }, order: qScanCount });
      } catch (err) {
        console.error('Error parsing inline question json:', err);
      }
    } else if (fullTag.includes('QUESTÃO') || fullTag.includes('QUEST_ID')) {
      qScanCount++;
      questionMatches.push({ type: 'id', id: rawId, order: qScanCount });
    }
  }

  // Batch fetch any database questions
  const dbIds = questionMatches.filter(m => m.type === 'id' && m.id).map(m => m.id as string);
  const dbQuestionsMap = new Map<string, any>();

  if (dbIds.length > 0) {
    onProgress?.('Carregando questões do material...');
    const { data: dbQuestions } = await supabase
      .from('questions')
      .select('*, bancas(name, sigla), disciplinas(name), assuntos(name), text_bases(content, title), alternativas(*)')
      .in('id', dbIds);

    if (dbQuestions) {
      dbQuestions.forEach(q => dbQuestionsMap.set(q.id, q));
    }
  }

  // Resolve questions for final page
  const allResolvedQuestions = questionMatches.map(m => {
    if (m.type === 'json') {
      return m.data;
    } else {
      const dbQ = dbQuestionsMap.get(m.id || '');
      if (dbQ) {
        return { ...dbQ, questionNumber: m.order };
      }
      return null;
    }
  }).filter(Boolean);

  // Helper for inline question cards (with discreet 8pt gabarito, no explanation block)
  let renderCounter = 0;
  const renderInlineQuestionCard = (q: any) => {
    if (!q) return '';
    renderCounter++;
    const qNum = q.questionNumber || renderCounter;
    const letters = ['A', 'B', 'C', 'D', 'E'];
    const alts = Array.isArray(q.alternativas) ? q.alternativas : [];

    const correctAltIdx = alts.findIndex((a: any) => a.isCorreta);
    let gabaritoText = 'N/A';
    if (correctAltIdx !== -1) {
      const text = alts[correctAltIdx]?.texto || '';
      if (['certo', 'errado'].includes(text.toLowerCase().trim())) {
        gabaritoText = text.toUpperCase();
      } else {
        gabaritoText = `Letra ${letters[correctAltIdx] || String.fromCharCode(65 + correctAltIdx)}`;
      }
    }

    const bancaObj = Array.isArray(q.bancas) ? q.bancas[0] : q.bancas;
    const bancaName = bancaObj?.sigla ? `${bancaObj.sigla} - ${bancaObj.name}` : bancaObj?.name;

    const tb = q.text_bases as any;
    let baseTextContent = '';
    if (Array.isArray(tb) && tb.length > 0) baseTextContent = tb[0].content;
    else if (tb && !Array.isArray(tb)) baseTextContent = tb.content;
    else if (q.texto_base) baseTextContent = q.texto_base;

    return `
      <div class="pdf-question-wrapper">
        <div class="pdf-question-header">
          <div class="pdf-q-title">Questão ${String(qNum).padStart(2, '0')}</div>
          <div class="pdf-q-tags">
            ${q.disciplinas?.name ? `<span class="pdf-q-tag">${q.disciplinas.name}</span>` : ''}
            ${bancaName ? `<span class="pdf-q-tag pdf-tag-banca">${bancaName}</span>` : ''}
            ${q.ano ? `<span class="pdf-q-tag pdf-tag-ano">${q.ano}</span>` : ''}
          </div>
        </div>

        ${baseTextContent ? `<div class="pdf-q-text-base"><strong>TEXTO DE APOIO:</strong> ${processAll(baseTextContent)}</div>` : ''}
        
        <div class="pdf-q-enunciado">${processAll(q.enunciado || '')}</div>
        
        <div class="pdf-q-alternatives">
          ${alts.map((alt: any, idx: number) => `
            <div class="pdf-q-alt-item">
              <div class="pdf-q-alt-letter">${letters[idx] || String.fromCharCode(65 + idx)}</div>
              <div class="pdf-q-alt-text">${processAll(alt.texto || '')}</div>
            </div>
          `).join('')}
        </div>

        <!-- Inline Discreet Gabarito (8pt, sem explicação) -->
        <div class="pdf-q-inline-gabarito">
          <span>Gabarito</span>
          <span class="pdf-q-inline-gabarito-val">${gabaritoText}</span>
        </div>
      </div>
    `;
  };

  // Split and render content into HTML node blocks
  tagRegex.lastIndex = 0;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let qCounter = 0;
  const contentHtmlParts: string[] = [];

  while ((match = tagRegex.exec(rawContent)) !== null) {
    if (match.index > lastIndex) {
      const textBefore = rawContent.substring(lastIndex, match.index);
      if (textBefore.replace(/<br\s*\/?>/g, '').trim()) {
        contentHtmlParts.push(processAll(textBefore));
      }
    }

    const rawId = match[1]?.trim().replace(/<[^>]*>/g, '') || '';
    const jsonContent = match[2]?.trim();
    const fullTag = match[0].toUpperCase();

    if (jsonContent) {
      qCounter++;
      try {
        const cleanJson = jsonContent.replace(/<[^>]*>/g, '').replace(/\\/g, '\\\\');
        const qData = JSON.parse(cleanJson);
        contentHtmlParts.push(renderInlineQuestionCard({ ...qData, questionNumber: qCounter }));
      } catch (err) {
        console.error('Error rendering inline question json:', err);
      }
    } else if (fullTag.includes('QUESTÃO') || fullTag.includes('QUEST_ID')) {
      qCounter++;
      const dbQ = dbQuestionsMap.get(rawId);
      if (dbQ) {
        contentHtmlParts.push(renderInlineQuestionCard({ ...dbQ, questionNumber: qCounter }));
      }
    }

    lastIndex = tagRegex.lastIndex;
  }

  if (lastIndex < rawContent.length) {
    const remainingText = rawContent.substring(lastIndex);
    if (remainingText.replace(/<br\s*\/?>/g, '').trim()) {
      contentHtmlParts.push(processAll(remainingText));
    }
  }

  const contestHeader = resolvedCourseName || apostila.disciplina?.name || 'Preparatório para Concursos';
  const teacherAuthor = apostila.teacher?.name 
    ? `Professor: ${apostila.teacher.name}` 
    : (apostila.author?.full_name ? `Prof. ${apostila.author.full_name}` : '');

  // Pre-load logo as DataURL
  const logoDataUrl = await getBase64Image('/bora_passar_logo.png');

  // Build Final Page Questions (Gabarito Comentado) Cards
  const hasFinalQuestions = allResolvedQuestions.length > 0;
  const finalQuestionCardsHtml = hasFinalQuestions ? allResolvedQuestions.map((q: any, idx: number) => {
    const qNum = q.questionNumber || idx + 1;
    const alts = Array.isArray(q.alternativas) ? q.alternativas : [];
    const correctAltIdx = alts.findIndex((a: any) => a.isCorreta);
    let gabaritoText = 'N/A';
    if (correctAltIdx !== -1) {
      const text = alts[correctAltIdx]?.texto || '';
      if (['certo', 'errado'].includes(text.toLowerCase().trim())) {
        gabaritoText = text.toUpperCase();
      } else {
        gabaritoText = `Letra ${String.fromCharCode(65 + correctAltIdx)}`;
      }
    }

    const bancaObj = Array.isArray(q.bancas) ? q.bancas[0] : q.bancas;
    const bancaName = bancaObj?.sigla ? `${bancaObj.sigla} - ${bancaObj.name}` : bancaObj?.name;

    const tb = q.text_bases as any;
    let baseTextContent = '';
    if (Array.isArray(tb) && tb.length > 0) baseTextContent = tb[0].content;
    else if (tb && !Array.isArray(tb)) baseTextContent = tb.content;
    else if (q.texto_base) baseTextContent = q.texto_base;

    return `
      <div class="pdf-final-question-card">
        <div class="pdf-final-card-header">
          <div class="pdf-final-card-meta">
            <span class="pdf-q-title">Questão ${String(qNum).padStart(2, '0')}</span>
            ${q.disciplinas?.name ? `<span class="pdf-q-tag">${q.disciplinas.name}</span>` : ''}
            ${bancaName ? `<span class="pdf-q-tag pdf-tag-banca">${bancaName}</span>` : ''}
            ${q.ano ? `<span class="pdf-q-tag pdf-tag-ano">${q.ano}</span>` : ''}
          </div>
          <div class="pdf-final-gabarito-badge">Gabarito: ${gabaritoText}</div>
        </div>

        ${baseTextContent ? `<div class="pdf-q-text-base"><strong>TEXTO DE APOIO:</strong> ${processAll(baseTextContent)}</div>` : ''}

        <div class="pdf-q-enunciado">${processAll(q.enunciado || '')}</div>

        ${alts.length > 0 ? `
          <div class="pdf-final-alts">
            ${alts.map((alt: any, aIdx: number) => {
              const isCorrect = alt.isCorreta;
              return `
                <div class="pdf-final-alt-item ${isCorrect ? 'is-correct' : ''}">
                  <span class="pdf-final-alt-letter ${isCorrect ? 'is-correct' : ''}">${String.fromCharCode(65 + aIdx)}</span>
                  <span class="pdf-final-alt-text">${processAll(alt.texto || '')}</span>
                </div>
              `;
            }).join('')}
          </div>
        ` : ''}

        ${q.resposta_professor ? `
          <div class="pdf-final-comment">
            <div class="pdf-final-comment-label">Comentário do Especialista / Explicação:</div>
            <div class="pdf-final-comment-body">${processAll(q.resposta_professor)}</div>
          </div>
        ` : ''}
      </div>
    `;
  }).join('') : '';

  // 6. Create isolated IFRAME with pure standard CSS (no oklch)
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.left = '-9999px';
  iframe.style.top = '0';
  iframe.style.width = '794px';
  iframe.style.height = '1123px';
  iframe.style.border = 'none';
  iframe.style.zIndex = '-9999';

  document.body.appendChild(iframe);

  const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!iframeDoc) {
    document.body.removeChild(iframe);
    throw new Error('Não foi possível inicializar o renderizador de PDF.');
  }

  const htmlDocument = `
    <!DOCTYPE html>
    <html lang="pt-BR">
      <head>
        <meta charset="utf-8">
        <title>${apostila.title}</title>
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Lexend:wght@400;600;700;800;900&family=Plus+Jakarta+Sans:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400;1,600&display=swap">
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.27/dist/katex.min.css">
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          body { font-family: 'Plus Jakarta Sans', 'Segoe UI', sans-serif; font-size: 10pt; line-height: 1.55; color: #1e293b; background: #ffffff; width: 794px; margin: 0 auto; padding: 0; }
          .pdf-page { width: 794px; height: 1123px; overflow: hidden; position: relative; background: #ffffff; padding: 35px 40px; }
          .pdf-cover-page { display: flex; flex-direction: column; justify-content: space-between; align-items: center; text-align: center; padding: 70px 40px 50px 40px; }
          .pdf-cover-logo { height: 75px; width: auto; object-fit: contain; filter: brightness(0); margin-bottom: 24px; }
          .pdf-cover-badge { display: inline-block; padding: 6px 20px; border: 2px solid #0f172a; color: #0f172a; font-family: 'Lexend', sans-serif; font-weight: 900; font-size: 9.5px; text-transform: uppercase; letter-spacing: 0.25em; border-radius: 9999px; }
          .pdf-cover-body { margin: auto 0; width: 100%; max-width: 660px; padding: 20px 0; }
          .pdf-cover-contest { font-family: 'Lexend', sans-serif; font-size: 14pt; font-weight: 800; color: #334155; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 14px; }
          .pdf-cover-divider { width: 80px; height: 4px; background: #0f172a; margin: 0 auto 24px auto; border-radius: 2px; }
          .pdf-cover-title { font-family: 'Lexend', sans-serif; font-size: 26pt; font-weight: 900; color: #0f172a; line-height: 1.25; text-transform: uppercase; margin-bottom: 20px; }
          .pdf-cover-meta { font-family: 'Lexend', sans-serif; font-size: 11pt; font-weight: 700; color: #475569; text-transform: uppercase; letter-spacing: 0.05em; margin-top: 8px; }
          .pdf-cover-footer { width: 100%; padding-top: 20px; border-top: 2px solid #0f172a; color: #475569; font-size: 9.5pt; }
          .pdf-cover-footer strong { font-family: 'Lexend', sans-serif; color: #0f172a; text-transform: uppercase; letter-spacing: 0.12em; display: block; margin-bottom: 4px; }
          
          .pdf-editorial-header { margin-bottom: 20px; padding-bottom: 12px; border-bottom: 2px solid #0f172a; }
          .pdf-editorial-top { display: flex; justify-content: space-between; align-items: center; font-size: 8pt; font-weight: 800; text-transform: uppercase; color: #64748b; letter-spacing: 0.08em; margin-bottom: 6px; }
          .pdf-editorial-title { font-family: 'Lexend', sans-serif; font-size: 18pt; font-weight: 900; color: #0f172a; text-transform: uppercase; line-height: 1.2; margin: 0; }
          .pdf-editorial-desc { font-size: 9.5pt; color: #475569; font-style: italic; margin-top: 6px; }

          .apostila-content, .pdf-final-page-inner { font-family: 'Plus Jakarta Sans', sans-serif; color: #1e293b; font-size: 10pt; line-height: 1.55; }
          .apostila-content h1 { font-family: 'Lexend', sans-serif !important; font-size: 16pt !important; font-weight: 900 !important; color: #0f172a !important; margin: 20px 0 10px 0 !important; line-height: 1.2 !important; text-transform: uppercase !important; }
          .apostila-content h2 { font-family: 'Lexend', sans-serif !important; font-size: 12.5pt !important; font-weight: 800 !important; color: #0f172a !important; margin: 18px 0 8px 0 !important; padding: 3px 0 3px 10px !important; border-left: 4.5px solid #2563eb !important; line-height: 1.25 !important; }
          .apostila-content h3 { font-family: 'Lexend', sans-serif !important; font-size: 11pt !important; font-weight: 800 !important; color: #1e293b !important; margin: 14px 0 6px 0 !important; }
          .apostila-content h4 { font-family: 'Lexend', sans-serif !important; font-size: 10pt !important; font-weight: 800 !important; color: #334155 !important; margin: 10px 0 4px 0 !important; text-transform: uppercase !important; }
          .apostila-content p { font-size: 10pt; line-height: 1.55; color: #1e293b; margin-bottom: 8px; text-align: justify; }
          .apostila-content strong, .apostila-content b { font-weight: 800; color: #0f172a; }
          
          .table-container { margin: 12px 0; border: 1px solid #cbd5e1; }
          .table-container table { width: 100%; border-collapse: collapse; font-size: 8.5pt; }
          .table-container th { background: #0f172a; color: #ffffff; padding: 6px 10px; text-align: left; font-family: 'Lexend', sans-serif; font-size: 8pt; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em; border: 1px solid #334155; }
          .table-container td { padding: 6px 10px; border: 1px solid #e2e8f0; font-size: 8.5pt; color: #1e293b; line-height: 1.4; }
          
          .custom-tag { margin: 10px 0; padding: 8px 12px; background: #f8fafc; border: 1px solid #e2e8f0; border-left: 4.5px solid #0f172a; border-radius: 0 4px 4px 0; display: block; }
          .tag-body strong { display: block; font-family: 'Lexend', sans-serif; font-size: 8.5pt; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 4px; font-weight: 800; line-height: 1.2; }
          .tag-text { font-size: 9.5pt; line-height: 1.45; color: #1e293b; }
          .tag-resolve { margin: 14px 0; background: transparent; border: none; display: block; }
          .resolve-header { display: flex; align-items: center; text-align: center; margin: 10px 0; }
          .resolve-header::before, .resolve-header::after { content: ''; flex: 1; border-bottom: 2px solid #e2e8f0; }
          .resolve-header span { padding: 0 10px; font-family: 'Lexend', sans-serif; font-weight: 900; color: #475569; font-size: 8.5pt; text-transform: uppercase; letter-spacing: 0.12em; }
          .resolve-solution { margin-top: 8px; padding: 10px 14px; background-color: #f0f9ff; border-radius: 0 4px 4px 0; border: 1px solid #bae6fd; border-left: 4.5px solid #0284c7; }
          
          .pdf-question-wrapper { margin: 14px 0; padding: 10px 14px; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 4px; }
          .pdf-question-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; padding-bottom: 6px; border-bottom: 1px solid #e2e8f0; }
          .pdf-q-title { font-family: 'Lexend', sans-serif; font-size: 10pt; font-weight: 900; color: #0f172a; text-transform: uppercase; }
          .pdf-q-tag { font-size: 8pt; font-weight: 700; color: #334155; background: #f1f5f9; padding: 2px 6px; border-radius: 3px; }
          .pdf-tag-banca { color: #1d4ed8; background: #eff6ff; border: 1px solid #bfdbfe; }
          .pdf-q-enunciado { font-size: 9.5pt; font-weight: 700; line-height: 1.5; color: #1e293b; margin-bottom: 10px; }
          .pdf-q-inline-gabarito { display: flex; justify-content: space-between; align-items: center; margin-top: 6px; padding-top: 4px; border-top: 1px solid #e2e8f0; color: #94a3b8; font-size: 8pt; font-style: italic; }
          .pdf-q-inline-gabarito-val { color: #475569; font-weight: 800; font-style: normal; }

          .pdf-final-header { margin-bottom: 18px; padding-bottom: 10px; border-bottom: 2px solid #0f172a; }
          .pdf-final-header-top { display: flex; justify-content: space-between; font-size: 8pt; font-weight: 800; text-transform: uppercase; color: #64748b; letter-spacing: 0.08em; margin-bottom: 4px; }
          .pdf-final-title { font-family: 'Lexend', sans-serif; font-size: 16pt; font-weight: 900; color: #0f172a; text-transform: uppercase; margin: 0; }
          .pdf-final-subtitle { font-size: 8.5pt; font-weight: 700; text-transform: uppercase; color: #64748b; letter-spacing: 0.05em; margin-top: 2px; }
          .pdf-final-question-card { border: 1px solid #cbd5e1; border-radius: 4px; padding: 10px 14px; background: #ffffff; margin-bottom: 14px; }
          .pdf-final-card-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; margin-bottom: 8px; }
          
          .katex-display { margin: 10px 0 !important; padding: 8px 12px !important; background: #f8fafc !important; border: 1px solid #e2e8f0 !important; border-radius: 3px; overflow-x: auto !important; }
          code { background: #1e1b4b; color: #f472b6; padding: 2px 6px; border-radius: 3px; font-family: monospace; font-size: 8.5pt; font-weight: bold; }
          img { max-width: 100%; height: auto; border-radius: 4px; margin: 12px auto; display: block; }
        </style>
      </head>
      <body>
        <div id="pdf-root-container">
          <!-- Measurer for Content -->
          <div id="pdf-content-measurer" class="apostila-content" style="width: 714px; position: absolute; left: -9999px; top: 0; opacity: 0; pointer-events: none;">
            ${contentHtmlParts.map(html => `<div class="pdf-measure-block">${html}</div>`).join('')}
          </div>

          <!-- Measurer for Final Questions -->
          ${hasFinalQuestions ? `
            <div id="pdf-final-measurer" class="pdf-final-page-inner" style="width: 714px; position: absolute; left: -9999px; top: 0; opacity: 0; pointer-events: none;">
              ${finalQuestionCardsHtml}
            </div>
          ` : ''}

          <!-- Container where all generated A4 pages will be mounted -->
          <div id="pdf-pages-container" style="width: 794px; margin: 0; padding: 0; background: #ffffff;"></div>
        </div>
      </body>
    </html>
  `;

  iframeDoc.open();
  iframeDoc.write(htmlDocument);
  iframeDoc.close();

  onProgress?.('Renderizando tipografia e imagens...');
  await new Promise(resolve => setTimeout(resolve, 600));

  onProgress?.('Distribuindo páginas do material...');

  const pagesContainer = iframeDoc.getElementById('pdf-pages-container')!;
  const contentMeasurer = iframeDoc.getElementById('pdf-content-measurer')!;
  const finalMeasurer = iframeDoc.getElementById('pdf-final-measurer');

  let pageNumber = 0;

  const createPage = (isCover = false, isFinal = false): { pageEl: HTMLElement; innerEl: HTMLElement; footerEl: HTMLElement } => {
    pageNumber++;
    const pageEl = iframeDoc.createElement('div');
    pageEl.className = isCover ? 'pdf-page pdf-cover-page' : 'pdf-page';
    pageEl.style.cssText = `
      width: 794px;
      height: 1123px;
      min-height: 1123px;
      max-height: 1123px;
      box-sizing: border-box;
      background: #ffffff;
      overflow: hidden;
      position: relative;
      ${isCover ? 'display: flex; flex-direction: column; justify-content: space-between; align-items: center; text-align: center; padding: 70px 40px 50px 40px;' : 'padding: 35px 40px 25px 40px; display: flex; flex-direction: column; justify-content: space-between;'}
    `;

    const innerEl = iframeDoc.createElement('div');
    innerEl.className = isFinal ? 'pdf-final-page-inner' : 'apostila-content';
    innerEl.style.cssText = 'flex: 1; overflow: hidden; width: 100%;';

    const footerEl = iframeDoc.createElement('div');
    footerEl.className = 'pdf-page-footer';
    footerEl.style.cssText = `
      width: 100%;
      padding-top: 6px;
      border-top: 1px solid #e2e8f0;
      font-size: 8pt;
      color: #64748b;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-shrink: 0;
    `;

    if (!isCover) {
      pageEl.appendChild(innerEl);
      pageEl.appendChild(footerEl);
    }
    pagesContainer.appendChild(pageEl);

    return { pageEl, innerEl, footerEl };
  };

  // 1. Page 1: Cover Page
  const { pageEl: coverEl } = createPage(true);
  coverEl.innerHTML = `
    <div>
      <img src="${logoDataUrl}" class="pdf-cover-logo" alt="Bora Passar Agora" />
      <div>
        <span class="pdf-cover-badge">Material Didático Oficial</span>
      </div>
    </div>

    <div class="pdf-cover-body">
      <div class="pdf-cover-contest">${contestHeader}</div>
      <div class="pdf-cover-divider"></div>
      <h1 class="pdf-cover-title">${apostila.title}</h1>
      ${apostila.disciplina?.name ? `<div class="pdf-cover-meta">Disciplina: ${apostila.disciplina.name}</div>` : ''}
      ${teacherAuthor ? `<div class="pdf-cover-meta" style="font-size: 10pt; color: #64748b; margin-top: 10px;">${teacherAuthor}</div>` : ''}
    </div>

    <div class="pdf-cover-footer">
      <strong>Plataforma Bora Passar Agora • Todos os Direitos Reservados</strong>
      <div>Licenciado para: ${studentName} ${studentCpf ? `• CPF: ${studentCpf}` : ''}</div>
    </div>
  `;

  // 2. Page 2 onwards: Editorial Header + Content Blocks
  let { pageEl: curPage, innerEl: curInner } = createPage(false, false);

  const editorialHeader = iframeDoc.createElement('div');
  editorialHeader.className = 'pdf-editorial-header';
  editorialHeader.innerHTML = `
    <div class="pdf-editorial-top">
      <span>${contestHeader}</span>
      <span>Bora Passar Agora</span>
    </div>
    <h1 class="pdf-editorial-title">${apostila.title}</h1>
    ${apostila.description ? `<p class="pdf-editorial-desc">${apostila.description}</p>` : ''}
  `;
  curInner.appendChild(editorialHeader);

  const MAX_USABLE_HEIGHT = 990;

  // Distribute all content blocks
  const measureBlocks = Array.from(contentMeasurer.children);
  for (const block of measureBlocks) {
    const childElements = Array.from(block.children);
    const elementsToAdd = childElements.length > 0 ? childElements : [block];

    for (const elem of elementsToAdd) {
      const clone = elem.cloneNode(true) as HTMLElement;
      curInner.appendChild(clone);

      if (curInner.scrollHeight > MAX_USABLE_HEIGHT && curInner.children.length > 1) {
        curInner.removeChild(clone);
        const next = createPage(false, false);
        curPage = next.pageEl;
        curInner = next.innerEl;
        curInner.appendChild(clone);
      }
    }
  }

  // 3. Final Section: Questões da Apostila — Gabarito e Comentários (starts on a new page)
  if (hasFinalQuestions && finalMeasurer) {
    const firstFinal = createPage(false, true);
    curPage = firstFinal.pageEl;
    curInner = firstFinal.innerEl;

    const finalHeader = iframeDoc.createElement('div');
    finalHeader.className = 'pdf-final-header';
    finalHeader.innerHTML = `
      <div class="pdf-final-header-top">
        <span>${contestHeader}</span>
        <span>Bora Passar Agora</span>
      </div>
      <h2 class="pdf-final-title">Questões da Apostila — Gabarito e Comentários</h2>
      <p class="pdf-final-subtitle">Resoluções detalhadas e análise dos professores</p>
    `;
    curInner.appendChild(finalHeader);

    const finalCards = Array.from(finalMeasurer.children);
    for (const card of finalCards) {
      const clone = card.cloneNode(true) as HTMLElement;
      curInner.appendChild(clone);

      if (curInner.scrollHeight > MAX_USABLE_HEIGHT && curInner.children.length > 1) {
        curInner.removeChild(clone);
        const next = createPage(false, true);
        curPage = next.pageEl;
        curInner = next.innerEl;
        curInner.appendChild(clone);
      }
    }
  }

  // Update page footers with total pages count
  const allPages = Array.from(pagesContainer.querySelectorAll('.pdf-page'));
  const totalPagesCount = allPages.length;

  allPages.forEach((pageEl, idx) => {
    const footer = pageEl.querySelector('.pdf-page-footer');
    if (footer) {
      footer.innerHTML = `
        <span>Bora Passar Agora • ${contestHeader}</span>
        <span>Licenciado para: ${studentName} ${studentCpf ? `• CPF: ${studentCpf}` : ''}</span>
        <span>Pág. ${idx + 1} de ${totalPagesCount}</span>
      `;
    }
  });

  onProgress?.(`Gerando ${totalPagesCount} páginas em PDF...`);

  const safeTitle = (apostila.title || 'Apostila')
    .replace(/[/\\?%*:|"<>]/g, '-')
    .trim();
  const filename = `${safeTitle}.pdf`;

  const PAGE_WIDTH = 794;
  const PAGE_HEIGHT = 1123;

  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true
  });

  for (let i = 0; i < totalPagesCount; i++) {
    onProgress?.(`Gerando página ${i + 1} de ${totalPagesCount}...`);
    const pEl = allPages[i] as HTMLElement;

    const pageCanvas = await toCanvas(pEl, {
      pixelRatio: 2,
      width: PAGE_WIDTH,
      height: PAGE_HEIGHT,
      backgroundColor: '#ffffff',
      cacheBust: false
    });

    const imgData = pageCanvas.toDataURL('image/jpeg', 0.95);

    if (i === 0) {
      pdf.addImage(imgData, 'JPEG', 0, 0, 210, 297, undefined, 'FAST');
    } else {
      pdf.addPage('a4', 'portrait');
      pdf.addImage(imgData, 'JPEG', 0, 0, 210, 297, undefined, 'FAST');
    }
  }

  try {
    onProgress?.('Salvando arquivo...');
    pdf.save(filename);
    onProgress?.('Download concluído!');
  } finally {
    if (document.body.contains(iframe)) {
      document.body.removeChild(iframe);
    }
  }
}
