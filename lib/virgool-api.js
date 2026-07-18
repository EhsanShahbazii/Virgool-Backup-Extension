/**
 * Virgool API Client & Backup Orchestrator
 * Communicates with virgool.io endpoints to gather posts, bodies, and recursively nested comments.
 */

import { parsePostHtml } from './body-parser.js';

const VIRGOOL_BASE = 'https://virgool.io';
const API_BASE = 'https://virgool.io/api2/app';

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const DEFAULT_HEADERS = {
  Accept: 'application/json, text/plain, */*',
  'Accept-Language': 'fa,en-US,en;q=0.9',
};

/**
 * Modern realistic browser User-Agent pool for random rotation
 */
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:128.0) Gecko/20100101 Firefox/128.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14.5; rv:128.0) Gecko/20100101 Firefox/128.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.0.0',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36 OPR/111.0.0.0',
];

export function getRandomUserAgent() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

/**
 * Preset configuration for Worker concurrency, request delay, and rate-limit risk levels
 */
export const SPEED_PRESETS = {
  1: { workers: 1, delayMs: 50, label: '۱ پردازشگر (امن)', threadText: '۱ ترد (تک‌ترد)', delayText: '۰.۰۵ ثانیه (۵۰ms)', risk: 'low', riskText: 'ریسک بسیار کم (امن)' },
  2: { workers: 2, delayMs: 70, label: '۲ پردازشگر', threadText: '۲ پردازشگر همزمان', delayText: '۰.۰۷ ثانیه', risk: 'low', riskText: 'ریسک پایین' },
  3: { workers: 3, delayMs: 90, label: '۳ پردازشگر', threadText: '۳ پردازشگر همزمان', delayText: '۰.۰۹ ثانیه', risk: 'medium', riskText: 'ریسک متعادل' },
  4: { workers: 4, delayMs: 110, label: '۴ پردازشگر', threadText: '۴ پردازشگر همزمان', delayText: '۰.۱۱ ثانیه', risk: 'medium', riskText: 'ریسک متوسط' },
  5: { workers: 5, delayMs: 130, label: '۵ پردازشگر', threadText: '۵ پردازشگر همزمان', delayText: '۰.۱۳ ثانیه', risk: 'medium', riskText: 'ریسک ملایم' },
  6: { workers: 6, delayMs: 150, label: '۶ پردازشگر', threadText: '۶ پردازشگر همزمان', delayText: '۰.۱۵ ثانیه', risk: 'high', riskText: 'ریسک بالا' },
  7: { workers: 7, delayMs: 180, label: '۷ پردازشگر', threadText: '۷ پردازشگر همزمان', delayText: '۰.۱۸ ثانیه', risk: 'high', riskText: 'ریسک بالا' },
  8: { workers: 8, delayMs: 200, label: '۸ پردازشگر (حداکثر سرعت)', threadText: '۸ پردازشگر همزمان', delayText: '۰.۲ ثانیه (۲۰۰ms)', risk: 'high', riskText: 'ریسک بالا (خطر Rate Limit)' },
};

/**
 * Fetch with automatic retries for Rate-Limit (429), Server Errors (5xx), and network timeouts
 */
export async function fetchWithRetry(url, options = {}, { maxRetries = 3, baseDelay = 1000 } = {}) {
  const signal = options.signal;
  let attempt = 0;

  while (attempt <= maxRetries) {
    if (signal?.aborted) throw new Error('عملیات توسط کاربر لغو شد');

    const headers = {
      ...options.headers,
      'User-Agent': getRandomUserAgent(),
    };

    try {
      const res = await fetch(url, { ...options, headers });

      // Handle HTTP 429 Too Many Requests: backoff and retry
      if (res.status === 429 && attempt < maxRetries) {
        attempt++;
        const backoff = baseDelay * Math.pow(2, attempt) + Math.floor(Math.random() * 500);
        console.warn(`[Virgool Rate Limit 429] Backing off ${backoff}ms (تلاش مجدد ${attempt} از ${maxRetries}) برای ${url}`);
        await delay(backoff);
        continue;
      }

      // Handle HTTP 5xx Server Errors
      if (res.status >= 500 && res.status < 600 && attempt < maxRetries) {
        attempt++;
        const backoff = baseDelay * attempt + Math.floor(Math.random() * 300);
        console.warn(`[Virgool Server Error ${res.status}] تلاش مجدد ${attempt} از ${maxRetries} در ${backoff}ms برای ${url}`);
        await delay(backoff);
        continue;
      }

      return res;
    } catch (err) {
      if (signal?.aborted) throw new Error('عملیات توسط کاربر لغو شد');
      if (attempt < maxRetries) {
        attempt++;
        const backoff = baseDelay * attempt;
        console.warn(`[Network Error] تلاش مجدد ${attempt} از ${maxRetries} در ${backoff}ms: ${err.message}`);
        await delay(backoff);
      } else {
        throw err;
      }
    }
  }
}

/**
 * Fetch all posts metadata for a given user
 */
export async function fetchUserPosts(username, { onProgress, signal, politeDelay = 50 } = {}) {
  const cleanUsername = username.replace(/^@/, '').trim();
  const allPosts = [];
  let currentPage = 1;
  let lastPage = 1;
  let totalPosts = 0;
  let userProfile = null;

  do {
    if (signal?.aborted) throw new Error('عملیات توسط کاربر لغو شد');

    const url = `${API_BASE}/users/${cleanUsername}/posts?page=${currentPage}`;
    if (onProgress) {
      onProgress({
        phase: 'posts_list',
        currentPage,
        lastPage: lastPage || 1,
        message: `در حال دریافت لیست مقالات (صفحه ${currentPage})...`,
      });
    }

    const res = await fetchWithRetry(url, { headers: DEFAULT_HEADERS, signal });
    if (!res.ok) {
      if (res.status === 404) {
        throw new Error(`کاربر «${cleanUsername}» در ویرگول یافت نشد.`);
      }
      throw new Error(`خطا در ارتباط با ویرگول (کد وضعیت: ${res.status})`);
    }

    const json = await res.json();
    const data = json.data || [];
    const pagination = json.pagination || {};

    lastPage = pagination.lastPage || 1;
    totalPosts = pagination.total || data.length;

    if (data.length > 0) {
      allPosts.push(...data);
      if (!userProfile && data[0].user) {
        userProfile = data[0].user;
      }
    }

    currentPage++;
    if (currentPage <= lastPage && politeDelay > 0) {
      await delay(politeDelay);
    }
  } while (currentPage <= lastPage);

  return {
    user: userProfile || { username: cleanUsername },
    total: totalPosts,
    posts: allPosts,
  };
}

/**
 * Fetch the full HTML body and extracted content of a single post
 */
export async function fetchPostFullBody(postUrl, { signal } = {}) {
  if (!postUrl) return { bodyHtml: '', bodyMarkdown: '', plainText: '', images: [] };

  const res = await fetchWithRetry(postUrl, {
    headers: {
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'fa,en-US,en;q=0.9',
    },
    signal,
  });

  if (!res.ok) {
    console.warn(`Failed to fetch post HTML: ${postUrl}, status: ${res.status}`);
    return { bodyHtml: '', bodyMarkdown: '', plainText: '', images: [] };
  }

  const html = await res.text();
  return parsePostHtml(html);
}

/**
 * Recursively fetch replies for a comment and all its nested sub-replies
 */
async function fetchCommentRepliesRecursively(comment, options) {
  const { signal, politeDelay = 50, depth = 1, maxDepth = 10, onReplyFound } = options;
  if (!comment || !comment.hash || comment.replies === 0 || depth > maxDepth) {
    comment.repliesList = comment.repliesList || [];
    return;
  }

  comment.repliesList = [];
  let page = 1;
  let lastPage = 1;

  do {
    if (signal?.aborted) throw new Error('عملیات توسط کاربر لغو شد');
    if (politeDelay > 0) await delay(politeDelay);

    try {
      const url = `${API_BASE}/comments/${comment.hash}?page=${page}`;
      const res = await fetchWithRetry(url, { headers: DEFAULT_HEADERS, signal });
      if (!res.ok) break;

      const json = await res.json();
      const replies = json.data || [];
      const pagination = json.pagination || {};
      lastPage = pagination.lastPage || 1;

      for (const reply of replies) {
        comment.repliesList.push(reply);
        if (onReplyFound) onReplyFound(reply, depth);

        // If this reply itself has nested replies, recursively fetch them
        if (reply.replies > 0) {
          await fetchCommentRepliesRecursively(reply, {
            ...options,
            depth: depth + 1,
          });
        }
      }

      page++;
    } catch (err) {
      console.warn(`Error fetching replies for comment ${comment.hash} page ${page}:`, err);
      break;
    }
  } while (page <= lastPage);
}

/**
 * Fetch all top-level comments and all their nested replies recursively for a post
 */
export async function fetchPostComments(postHash, { signal, politeDelay = 50, onReplyFound } = {}) {
  if (!postHash) return [];

  const comments = [];
  let currentPage = 1;
  let lastPage = 1;

  // 1. Fetch top-level comments
  do {
    if (signal?.aborted) throw new Error('عملیات توسط کاربر لغو شد');

    const url = `${API_BASE}/posts/${postHash}/comments?page=${currentPage}`;
    try {
      const res = await fetchWithRetry(url, { headers: DEFAULT_HEADERS, signal });
      if (!res.ok) break;

      const json = await res.json();
      const data = json.data || [];
      const pagination = json.pagination || {};

      lastPage = pagination.lastPage || 1;
      comments.push(...data);

      currentPage++;
      if (currentPage <= lastPage && politeDelay > 0) {
        await delay(politeDelay);
      }
    } catch (err) {
      console.warn(`Error fetching comments page ${currentPage} for ${postHash}:`, err);
      break;
    }
  } while (currentPage <= lastPage);

  // 2. Fetch nested replies recursively for every comment that has replies
  for (const comment of comments) {
    if (comment.replies > 0 && comment.hash) {
      await fetchCommentRepliesRecursively(comment, {
        signal,
        politeDelay,
        depth: 1,
        maxDepth: 10,
        onReplyFound,
      });
    } else {
      comment.repliesList = [];
    }
  }

  return comments;
}

/**
 * Calculate total comments count including all nested replies at any depth
 */
export function countAllComments(commentsList) {
  let count = 0;
  function traverse(list) {
    if (!list || !Array.isArray(list)) return;
    for (const c of list) {
      count++;
      if (c.repliesList && c.repliesList.length > 0) {
        traverse(c.repliesList);
      }
    }
  }
  traverse(commentsList);
  return count;
}

/**
 * Orchestrate a complete backup run for a user with concurrent worker pool support
 */
export async function backupUser(username, { onProgress, signal, workers = 1, delayMs = 50, politeDelay } = {}) {
  const startTime = Date.now();
  const actualDelay = delayMs !== undefined ? delayMs : (politeDelay !== undefined ? politeDelay : 50);
  const workerCount = Math.min(Math.max(1, parseInt(workers, 10) || 1), 8);

  // Phase 1: Fetch posts listing
  if (onProgress) {
    onProgress({
      phase: 'starting',
      percent: 5,
      message: `در حال دریافت مشخصات کاربر @${username}...`,
    });
  }

  const { user, total, posts } = await fetchUserPosts(username, {
    signal,
    politeDelay: actualDelay,
    onProgress: (p) => {
      if (onProgress) {
        onProgress({
          phase: 'listing',
          percent: Math.min(20, Math.round((p.currentPage / (p.lastPage || 1)) * 20)),
          message: p.message,
        });
      }
    },
  });

  const totalCount = posts.length;
  const enrichedPosts = new Array(totalCount);
  let processedCount = 0;
  let nextPostIndex = 0;

  const processPost = async (post, postIndex) => {
    if (signal?.aborted) throw new Error('عملیات توسط کاربر لغو شد');

    const basePercent = 20 + Math.round((processedCount / totalCount) * 75);
    if (onProgress) {
      onProgress({
        phase: 'processing_post',
        current: processedCount + 1,
        total: totalCount,
        percent: basePercent,
        postTitle: post.title,
        message: `در حال دریافت متن و نظرات (${processedCount + 1} از ${totalCount}): «${post.title}»`,
      });
    }

    // Fetch full post body
    let bodyData = { bodyHtml: '', bodyMarkdown: '', plainText: '', images: [] };
    if (post.url) {
      try {
        bodyData = await fetchPostFullBody(post.url, { signal });
      } catch (e) {
        console.warn(`Could not parse body for ${post.url}:`, e);
      }
      if (actualDelay > 0) await delay(actualDelay);
    }

    // Fetch comments & deeply nested replies
    let comments = [];
    if (post.commentsCount > 0 || post.hash) {
      try {
        comments = await fetchPostComments(post.hash, { signal, politeDelay: actualDelay });
      } catch (e) {
        console.warn(`Could not fetch comments for ${post.hash}:`, e);
      }
    }

    processedCount++;
    if (onProgress) {
      const updatedPercent = 20 + Math.round((processedCount / totalCount) * 75);
      onProgress({
        phase: 'processing_post',
        current: processedCount,
        total: totalCount,
        percent: updatedPercent,
        postTitle: post.title,
        message: `تکمیل شد (${processedCount} از ${totalCount}): «${post.title}»`,
      });
    }

    return {
      ...post,
      content: {
        bodyHtml: bodyData.bodyHtml,
        bodyMarkdown: bodyData.bodyMarkdown,
        plainText: bodyData.plainText,
        extractedImages: bodyData.images,
      },
      comments,
    };
  };

  // Execute concurrent workers pool
  const workersPool = Array.from({ length: Math.min(workerCount, totalCount) }, async () => {
    while (nextPostIndex < totalCount) {
      const idx = nextPostIndex++;
      enrichedPosts[idx] = await processPost(posts[idx], idx);
      if (actualDelay > 0) {
        await delay(actualDelay);
      }
    }
  });

  await Promise.all(workersPool);

  // Calculate total comments including all nested replies across all posts
  const totalAllComments = enrichedPosts.reduce(
    (acc, p) => acc + (p ? countAllComments(p.comments) : 0),
    0
  );

  const backupPackage = {
    id: `backup_${user.username}_${Date.now()}`,
    createdAt: new Date().toISOString(),
    virgoolUrl: `${VIRGOOL_BASE}/@${user.username}`,
    user,
    stats: {
      totalPosts: enrichedPosts.length,
      totalComments: totalAllComments,
      durationMs: Date.now() - startTime,
      workersUsed: workerCount,
      delayMsUsed: actualDelay,
    },
    posts: enrichedPosts,
  };

  if (onProgress) {
    onProgress({
      phase: 'complete',
      percent: 100,
      message: `پشتیبان‌گیری کامل با موفقیت انجام شد! (${enrichedPosts.length} مقاله، ${totalAllComments} نظر و پاسخ)`,
    });
  }

  return backupPackage;
}
