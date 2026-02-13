/**
 * Markdown Exporter
 * Converts backed-up posts and recursively nested comments into structured Markdown with YAML frontmatter.
 */

import { formatPersianDate } from '../date-utils.js';

export function postToMarkdown(post, author) {
  const frontmatter = [
    '---',
    `title: "${escapeQuotes(post.title)}"`,
    `author: "${escapeQuotes(author?.name || post.user?.name || '')}"`,
    `username: "${escapeQuotes(author?.username || post.user?.username || '')}"`,
    `publishedAt: "${post.publishedAt || ''}"`,
    `shamsiDate: "${formatPersianDate(post.publishedAt)}"`,
    `readingTime: ${post.readingTime || 0}`,
    `likesCount: ${post.likesCount || 0}`,
    `commentsCount: ${post.commentsCount || 0}`,
    `url: "${post.url || ''}"`,
    `tags: [${(post.tags || []).map((t) => `"${escapeQuotes(t.name)}"`).join(', ')}]`,
    `topics: [${(post.topics || []).map((t) => `"${escapeQuotes(t.faName || t.name)}"`).join(', ')}]`,
    '---',
    '',
  ].join('\n');

  let content = post.content?.bodyMarkdown || post.description || '';

  // Append threaded comments section if present
  if (post.comments && post.comments.length > 0) {
    content += '\n\n---\n\n## نظرات خوانندگان\n\n';
    post.comments.forEach((c) => {
      content += renderCommentTreeMarkdown(c, 0);
      content += '\n---\n\n';
    });
  }

  return frontmatter + content;
}

function renderCommentTreeMarkdown(comment, depth = 0) {
  const authorName = escapeQuotes(comment.user?.name || 'کاربر ویرگول');
  const username = comment.user?.username ? `(@${comment.user.username})` : '';
  const dateStr = formatPersianDate(comment.publishedAt, true);

  let md = '';
  if (depth === 0) {
    md += `### نظر از ${authorName} ${username}\n`;
    md += `*تاریخ: ${dateStr}*\n\n`;
    md += `${comment.body}\n\n`;
  } else {
    const prefix = '> '.repeat(depth);
    md += `${prefix}**پاسخ از ${authorName} ${username}:**\n`;
    md += `${prefix}*${dateStr}*\n${prefix}\n`;
    const lines = (comment.body || '').split('\n');
    lines.forEach((line) => {
      md += `${prefix}${line}\n`;
    });
    md += `${prefix}\n`;
  }

  // Render children recursively
  if (comment.repliesList && comment.repliesList.length > 0) {
    comment.repliesList.forEach((child) => {
      md += renderCommentTreeMarkdown(child, depth + 1);
    });
  }

  return md;
}

export function exportSinglePostMarkdown(post, author) {
  const mdContent = postToMarkdown(post, author);
  const cleanTitle = (post.title || 'post').replace(/[\\/:*?"<>|]/g, '-').slice(0, 50);
  const filename = `${cleanTitle}.md`;

  const blob = new Blob([mdContent], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  setTimeout(() => URL.revokeObjectURL(url), 15000);
  return filename;
}

function escapeQuotes(str) {
  if (!str) return '';
  return str.replace(/"/g, '\\"');
}
