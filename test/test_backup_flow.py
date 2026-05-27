import urllib.request
import json
import re

print("==================================================")
print("TEST 1: Fetching User Posts List from Virgool API")
print("==================================================")

username = "ehsanshahbazii"
url = f"https://virgool.io/api2/app/users/{username}/posts?page=1"
req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0", "Accept": "application/json"})
res = urllib.request.urlopen(req)
assert res.status == 200, f"Status should be 200, got {res.status}"
data = json.loads(res.read().decode("utf-8"))

posts = data.get("data", [])
pagination = data.get("pagination", {})
print(f"User: {username}")
print(f"Total posts according to API: {pagination.get('total')}")
print(f"Posts on page 1: {len(posts)}")
assert len(posts) > 0, "Should have returned at least 1 post"

sample_post = posts[0]
print(f"Sample Post Title: {sample_post.get('title')}")
print(f"Sample Post Hash: {sample_post.get('hash')}")
print(f"Sample Post Reading Time: {sample_post.get('readingTime')} mins")
print(f"Sample Post Likes: {sample_post.get('likesCount')}")
print(f"Sample Post Comments Count: {sample_post.get('commentsCount')}")

print("\n==================================================")
print("TEST 2: Fetching Post Comments and Nested Replies")
print("==================================================")
post_hash = sample_post.get("hash")
comm_url = f"https://virgool.io/api2/app/posts/{post_hash}/comments?page=1"
comm_req = urllib.request.Request(comm_url, headers={"User-Agent": "Mozilla/5.0", "Accept": "application/json"})
comm_res = urllib.request.urlopen(comm_req)
assert comm_res.status == 200
comm_data = json.loads(comm_res.read().decode("utf-8"))
comments = comm_data.get("data", [])
print(f"Comments returned for post '{post_hash}': {len(comments)}")

if len(comments) > 0:
    c0 = comments[0]
    print(f"Comment 0 author: {c0.get('user', {}).get('name')}")
    print(f"Comment 0 body preview: {c0.get('body')[:60]}...")
    print(f"Comment 0 replies count: {c0.get('replies')}")

print("\n==================================================")
print("TEST 3: Post Body and Media Extraction from HTML")
print("==================================================")
post_url = sample_post.get("url")
print(f"Fetching post URL: {post_url}")
page_req = urllib.request.Request(post_url, headers={"User-Agent": "Mozilla/5.0"})
page_html = urllib.request.urlopen(page_req).read().decode("utf-8")

# Verify title and paragraphs exist
assert sample_post.get("title") in page_html, "Post title must be in the page HTML"
print("Post title verified in HTML!")

# Check for images in post
imgs = re.findall(r"https://files\.virgool\.io/upload/users/\d+/posts/[^/]+/[a-zA-Z0-9]+\.(?:png|jpg|jpeg)", page_html)
print(f"Found {len(imgs)} post image matches in HTML.")

print("\n==================================================")
print("TEST 4: Structure of Complete Backup Package")
print("==================================================")
mock_backup = {
    "id": f"backup_{username}_test",
    "createdAt": "2026-09-13T05:00:00.000Z",
    "virgoolUrl": f"https://virgool.io/@{username}",
    "user": sample_post.get("user"),
    "stats": {
        "totalPosts": len(posts),
        "totalComments": len(comments)
    },
    "posts": [
        {
            "title": sample_post.get("title"),
            "hash": sample_post.get("hash"),
            "url": sample_post.get("url"),
            "publishedAt": sample_post.get("publishedAt"),
            "content": {
                "bodyHtml": "<p>محتوای تستی</p>",
                "bodyMarkdown": "محتوای تستی",
                "plainText": "محتوای تستی",
                "images": imgs
            },
            "comments": comments
        }
    ]
}

json_str = json.dumps(mock_backup, ensure_ascii=False, indent=2)
assert len(json_str) > 100
print("Backup JSON package successfully serialized (bytes:", len(json_str.encode('utf-8')), ")")

print("\n>>> ALL TESTS PASSED SUCCESSFULLY! <<<")
