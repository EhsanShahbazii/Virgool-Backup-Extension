/**
 * Content Script for virgool.io
 * Runs in the context of Virgool pages to detect active user profile and page metadata.
 */

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'GET_VIRGOOL_PAGE_INFO') {
    const info = extractVirgoolPageInfo();
    sendResponse(info);
  }
  return true;
});

function extractVirgoolPageInfo() {
  const path = window.location.pathname;
  const match = path.match(/^\/@([a-zA-Z0-9_.-]+)(?:\/(.*))?$/);

  if (match) {
    const username = match[1];
    const postSlug = match[2] || null;
    return {
      isVirgool: true,
      username,
      postSlug,
      isPost: !!postSlug,
      url: window.location.href,
    };
  }

  return {
    isVirgool: true,
    username: null,
    postSlug: null,
    isPost: false,
    url: window.location.href,
  };
}
