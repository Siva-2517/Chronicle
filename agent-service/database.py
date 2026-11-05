import os
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
from dotenv import load_dotenv

load_dotenv()
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

MONGO_URI = os.getenv("MONGO_URI")
if not MONGO_URI:
    raise RuntimeError("MONGO_URI environment variable is required.")
client = AsyncIOMotorClient(MONGO_URI)

try:
    db = client.get_default_database()
    if db is None:
        db = client["chronicle"]
except Exception:
    db = client["chronicle"]


# Database collections helpers
def get_collection(name):
    return db[name]

async def get_repo(repo_id: str):
    return await db.repos.find_one({"_id": ObjectId(repo_id)})

async def get_commits_for_file(repo_id: str, file_path: str):
    """
    Finds all commits that touched a specific file path
    """
    cursor = db.commits.find({
        "repoId": ObjectId(repo_id),
        "files.filename": file_path
    })
    return await cursor.to_list(length=100)

async def get_prs_for_commits(repo_id: str, commit_shas: list):
    """
    Finds all PRs that are associated with any of the given commit SHAs
    """
    if not commit_shas:
        return []
    cursor = db.pullrequests.find({
        "repoId": ObjectId(repo_id),
        "$or": [
            {"associatedCommits": {"$in": commit_shas}},
            # Also search if any commit message references the PR
            {"comments.diffHunk": {"$regex": "|".join(commit_shas), "$options": "i"}}
        ]
    })
    return await cursor.to_list(length=50)

async def get_all_commits(repo_id: str):
    cursor = db.commits.find({"repoId": ObjectId(repo_id)})
    return await cursor.to_list(length=100)

async def get_all_prs(repo_id: str):
    cursor = db.pullrequests.find({"repoId": ObjectId(repo_id)})
    return await cursor.to_list(length=100)
