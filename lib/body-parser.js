/**
 * Virgool Post Body Parser & Converter
 * Extracts clean rich-text HTML, Markdown, images, and text from Virgool post pages.
 */

export function parsePostHtml(htmlString) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlString, 'text/html');

  // Find the post title h1
  const h1 = doc.querySelector('h1');
  const title = h1 ? h1.textContent.trim() : '';

  // Container holding the post blocks is usually the parent of h1 or an article/div
  let container = h1 ? h1.parentElement : null;
  if (!container) {
    container = doc.querySelector('main') || doc.body;
  }

  // Find all content block elements
  // Virgool blocks typically use classes: v-block, md-block-image, v-paragraph, v-blockquote, v-header-1, etc.
  const blockCandidates = container.querySelectorAll(
    'p, figure, img, blockquote, h2, h3, h4, pre, ul, ol, hr'
  );

  const cleanElements = [];
  const extractedImages = [];
  const markdownLines = [];

  blockCandidates.forEach((el) => {
    // Ignore navigation/header/footer elements or widgets
    if (el.closest('.header-print') || el.closest('nav') || el.closest('footer') || el.closest('.is-divider')) {
      return;
    }

    const tagName = el.tagName.toLowerCase();

    // Check if element is a standalone img (not in figure)
    if (tagName === 'img') {
      if (el.closest('figure')) return; // already handled by figure
      const src = el.getAttribute('src') || el.getAttribute('data-src') || '';
      const alt = el.getAttribute('alt') || '';
      if (src && !src.startsWith('data:image/svg') && !src.includes('/avatar/')) {
        extractedImages.push({ src, alt, caption: '' });
        cleanElements.push(`
          <figure class="post-figure">
            <img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" loading="eager" decoding="async" />
          </figure>
        `);
        markdownLines.push(`\n![${escapeMd(alt)}](${src})\n`);
      }
      return;
    }

    // Check if element is a figure/image
    if (tagName === 'figure' || el.classList.contains('md-block-image')) {
      const img = el.querySelector('img');
      const figcaption = el.querySelector('figcaption');
      if (img) {
        const src = img.getAttribute('src') || img.getAttribute('data-src') || '';
        const alt = img.getAttribute('alt') || '';
        const caption = figcaption ? figcaption.textContent.trim() : '';
        if (src && !src.startsWith('data:image/svg')) {
          extractedImages.push({ src, alt, caption });
          cleanElements.push(`
            <figure class="post-figure">
              <img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" loading="eager" decoding="async" />
              ${caption ? `<figcaption>${escapeHtml(caption)}</figcaption>` : ''}
            </figure>
          `);
          markdownLines.push(`\n![${escapeMd(caption || alt)}](${src})\n`);
          if (caption) markdownLines.push(`*${escapeMd(caption)}*\n`);
        }
      }
      return;
    }

    // Paragraphs
    if (tagName === 'p') {
      const text = el.textContent.trim();
      // Skip empty or recommendation prompts
      if (!text || text.includes('شاید از این پست‌ها خوشتان بیاید')) return;

      const innerHtml = sanitizeInlineHtml(el.innerHTML);
      cleanElements.push(`<p class="post-p">${innerHtml}</p>`);
      markdownLines.push(`${htmlToMarkdownInline(innerHtml)}\n`);
      return;
    }

    // Headings
    if (tagName === 'h2' || tagName === 'h3' || tagName === 'h4') {
      const text = el.textContent.trim();
      if (!text) return;
      cleanElements.push(`<${tagName} class="post-heading">${escapeHtml(text)}</${tagName}>`);
      const hashes = '#'.repeat(parseInt(tagName[1], 10));
      markdownLines.push(`\n${hashes} ${text}\n`);
      return;
    }

    // Blockquotes
    if (tagName === 'blockquote') {
      const text = el.textContent.trim();
      if (!text) return;
      cleanElements.push(`<blockquote class="post-quote">${sanitizeInlineHtml(el.innerHTML)}</blockquote>`);
      markdownLines.push(`\n> ${text.replace(/\n/g, '\n> ')}\n`);
      return;
    }

    // Code blocks
    if (tagName === 'pre') {
      const code = el.querySelector('code') || el;
      const codeText = code.textContent;
      cleanElements.push(`<pre class="post-pre"><code>${escapeHtml(codeText)}</code></pre>`);
      markdownLines.push(`\n\`\`\`\n${codeText}\n\`\`\`\n`);
      return;
    }

    // Lists
    if (tagName === 'ul' || tagName === 'ol') {
      const items = Array.from(el.querySelectorAll('li')).map((li) => li.innerHTML.trim());
      if (items.length === 0) return;
      
      cleanElements.push(`
        <${tagName} class="post-list">
          ${items.map((it) => `<li>${sanitizeInlineHtml(it)}</li>`).join('')}
        </${tagName}>
      `);

      items.forEach((it, idx) => {
        const bullet = tagName === 'ol' ? `${idx + 1}. ` : '- ';
        markdownLines.push(`${bullet}${htmlToMarkdownInline(it)}`);
      });
      markdownLines.push('');
      return;
    }

    // Horizontal Rule
    if (tagName === 'hr') {
      cleanElements.push('<hr class="post-divider" />');
      markdownLines.push('\n---\n');
    }
  });

  const bodyHtml = cleanElements.join('\n');
  const bodyMarkdown = markdownLines.join('\n');
  const plainText = container.textContent.trim();

  return {
    title,
    bodyHtml,
    bodyMarkdown,
    plainText,
    images: extractedImages,
  };
}

// Helpers
function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function escapeMd(str) {
  if (!str) return '';
  return str.replace(/([\\`*_{}[\]()#+\-.!])/g, '\\$1');
}

function sanitizeInlineHtml(html) {
  // Allow safe inline tags: strong, em, b, i, a, code, br, span
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/on\w+="[^"]*"/g, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
}

function htmlToMarkdownInline(html) {
  return html
    .replace(/<strong\b[^>]*>(.*?)<\/strong>/gi, '**$1**')
    .replace(/<b\b[^>]*>(.*?)<\/b>/gi, '**$1**')
    .replace(/<em\b[^>]*>(.*?)<\/em>/gi, '*$1*')
    .replace(/<i\b[^>]*>(.*?)<\/i>/gi, '*$1*')
    .replace(/<code\b[^>]*>(.*?)<\/code>/gi, '`$1`')
    .replace(/<a\b[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, '[$2]($1)')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '') // remove remaining tags
    .trim();
}
