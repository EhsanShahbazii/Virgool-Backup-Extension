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
 * Fetch all posts metadata for a given user
 */
export async function fetchUserPosts(username, { onProgress, signal, politeDelay = 350 } = {}) {
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

    const res = await fetch(url, { headers: DEFAULT_HEADERS, signal });
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
    if (currentPage <= lastPage) {
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

  const res = await fetch(postUrl, {
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
  const { signal, politeDelay = 250, depth = 1, maxDepth = 10, onReplyFound } = options;
  if (!comment || !comment.hash || comment.replies === 0 || depth > maxDepth) {
    comment.repliesList = comment.repliesList || [];
    return;
  }

  comment.repliesList = [];
  let page = 1;
  let lastPage = 1;

  do {
    if (signal?.aborted) throw new Error('عملیات توسط کاربر لغو شد');
    await delay(politeDelay);

    try {
      const url = `${API_BASE}/comments/${comment.hash}?page=${page}`;
      const res = await fetch(url, { headers: DEFAULT_HEADERS, signal });
      if (!res.ok) break;

      const json = await res.json();
      const replies = json.data || [];
      const pagination = json.pagination || {};
      lastPage = pagination.lastPage || 1;

      for (const reply of replies) {
        comment.repliesList.push(reply);
        if (onReplyFound) onReplyFound(reply, depth);

        // If this reply itself has nested replies, recursively fetch them!
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
export async function fetchPostComments(postHash, { signal, politeDelay = 250, onReplyFound } = {}) {
  if (!postHash) return [];

  const comments = [];
  let currentPage = 1;
  let lastPage = 1;

  // 1. Fetch top-level comments
  do {
    if (signal?.aborted) throw new Error('عملیات توسط کاربر لغو شد');

    const url = `${API_BASE}/posts/${postHash}/comments?page=${currentPage}`;
    try {
      const res = await fetch(url, { headers: DEFAULT_HEADERS, signal });
      if (!res.ok) break;

      const json = await res.json();
      const data = json.data || [];
      const pagination = json.pagination || {};

      lastPage = pagination.lastPage || 1;
      comments.push(...data);

      currentPage++;
      if (currentPage <= lastPage) {
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
 * Orchestrate a complete backup run for a user
 */
export async function backupUser(username, { onProgress, signal, politeDelay = 300 } = {}) {
  const startTime = Date.now();

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
    politeDelay,
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

  const enrichedPosts = [];
  const totalCount = posts.length;

  // Phase 2 & 3: Fetch body and recursive comments for each post
  for (let i = 0; i < totalCount; i++) {
    if (signal?.aborted) throw new Error('عملیات توسط کاربر لغو شد');

    const post = posts[i];
    const postIndex = i + 1;

    // Progress update
    const basePercent = 20 + Math.round((i / totalCount) * 75);
    if (onProgress) {
      onProgress({
        phase: 'processing_post',
        current: postIndex,
        total: totalCount,
        percent: basePercent,
        postTitle: post.title,
        message: `در حال دریافت متن مقاله (${postIndex} از ${totalCount}): «${post.title}»`,
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
      await delay(politeDelay);
    }

    // Fetch comments & deeply nested replies
    let comments = [];
    if (post.commentsCount > 0 || post.hash) {
      if (onProgress) {
        onProgress({
          phase: 'processing_comments',
          current: postIndex,
          total: totalCount,
          percent: basePercent + 2,
          postTitle: post.title,
          message: `در حال دریافت نظرات و پاسخ‌های تو در توی «${post.title}»...`,
        });
      }
      try {
        comments = await fetchPostComments(post.hash, { signal, politeDelay });
      } catch (e) {
        console.warn(`Could not fetch comments for ${post.hash}:`, e);
      }
    }

    enrichedPosts.push({
      ...post,
      content: {
        bodyHtml: bodyData.bodyHtml,
        bodyMarkdown: bodyData.bodyMarkdown,
        plainText: bodyData.plainText,
        extractedImages: bodyData.images,
      },
      comments,
    });
  }

  // Calculate total comments including all nested replies across all posts
  const totalAllComments = enrichedPosts.reduce(
    (acc, p) => acc + countAllComments(p.comments),
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
