import urllib.request
import json

print("==================================================================")
print("TEST: Recursive Comments & Replies Verification on Virgool Post")
print("==================================================================")

post_hash = "nqvwvxbe4xmv"
api_base = "https://virgool.io/api2/app"
headers = {"User-Agent": "Mozilla/5.0", "Accept": "application/json"}

def fetch_replies_recursive(comment, depth=1, max_depth=5):
    if not comment.get("hash") or comment.get("replies", 0) == 0 or depth > max_depth:
        comment["repliesList"] = []
        return
    
    rep_url = f"{api_base}/comments/{comment['hash']}?page=1"
    req = urllib.request.Request(rep_url, headers=headers)
    res = urllib.request.urlopen(req)
    rep_data = json.loads(res.read().decode("utf-8")).get("data", [])
    comment["repliesList"] = rep_data

    for child in rep_data:
        if child.get("replies", 0) > 0:
            fetch_replies_recursive(child, depth + 1, max_depth)

# 1. Fetch top comments
top_url = f"{api_base}/posts/{post_hash}/comments?page=1"
req = urllib.request.Request(top_url, headers=headers)
top_res = urllib.request.urlopen(req)
top_comments = json.loads(top_res.read().decode("utf-8")).get("data", [])

print(f"Top comments fetched: {len(top_comments)}")
assert len(top_comments) > 0

# Find comment with hash 'q8maho1wfhyfd02' from apis.txt
target_comment = None
for c in top_comments:
    if c.get("hash") == "q8maho1wfhyfd02":
        target_comment = c
        break

assert target_comment is not None, "Target comment q8maho1wfhyfd02 not found in top comments"
print(f"Found target comment: {target_comment.get('user', {}).get('name')}: '{target_comment.get('body')[:40]}...'")

# Fetch replies recursively
fetch_replies_recursive(target_comment)

replies_l1 = target_comment.get("repliesList", [])
print(f"Level 1 replies count: {len(replies_l1)}")
assert len(replies_l1) > 0, "Level 1 replies should not be empty"

rep1 = replies_l1[0]
print(f"  Level 1 reply by {rep1.get('user', {}).get('name')}: '{rep1.get('body')}'")

replies_l2 = rep1.get("repliesList", [])
print(f"  Level 2 replies count: {len(replies_l2)}")
assert len(replies_l2) > 0, "Level 2 replies should not be empty"

rep2 = replies_l2[0]
print(f"    Level 2 reply by {rep2.get('user', {}).get('name')}: '{rep2.get('body')}'")

print("\n>>> RECURSIVE NESTED REPLIES VERIFIED SUCCESSFULLY! <<<")
