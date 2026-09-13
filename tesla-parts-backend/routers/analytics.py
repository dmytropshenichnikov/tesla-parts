from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select, func, delete
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
from database import get_session
from models import SearchQueryLog, get_kyiv_time
from dependencies import get_current_admin

router = APIRouter(prefix="/analytics", tags=["analytics"])


class SearchLogPayload(BaseModel):
    query: str
    results_count: int = 0


@router.post("/search-log")
def log_search_query(payload: SearchLogPayload, session: Session = Depends(get_session)):
    q = (payload.query or "").strip()
    if len(q) < 3 or len(q) > 200:
        return {"status": "ignored"}

    now = get_kyiv_time()
    results_count = max(0, payload.results_count)

    # Check for recent queries in the last 45 seconds to merge continuous typing
    cutoff_time = now - timedelta(seconds=45)
    recent_entry = session.exec(
        select(SearchQueryLog)
        .where(SearchQueryLog.created_at >= cutoff_time)
        .order_by(SearchQueryLog.created_at.desc())
    ).first()

    if recent_entry:
        recent_q = (recent_entry.query or "").strip().lower()
        new_q = q.lower()

        # If identical, just update timestamp & results count
        if recent_q == new_q:
            recent_entry.results_count = results_count
            recent_entry.created_at = now
            session.add(recent_entry)
            session.commit()
            return {"status": "updated", "id": recent_entry.id}

        # If one is a prefix of the other (user typing more characters or deleting typos)
        if new_q.startswith(recent_q) or recent_q.startswith(new_q):
            recent_entry.query = q
            recent_entry.results_count = results_count
            recent_entry.created_at = now
            session.add(recent_entry)
            session.commit()
            return {"status": "updated", "id": recent_entry.id}

    log_entry = SearchQueryLog(
        query=q,
        results_count=results_count,
        created_at=now
    )
    session.add(log_entry)
    session.commit()
    return {"status": "logged", "id": log_entry.id}


@router.get("/search-queries", dependencies=[Depends(get_current_admin)])
def get_search_queries_report(
    limit: int = 50,
    session: Session = Depends(get_session)
) -> Dict[str, Any]:
    # 1. Total & zero-results overview counts
    total_count = session.exec(select(func.count(SearchQueryLog.id))).one() or 0
    zero_count = session.exec(
        select(func.count(SearchQueryLog.id)).where(SearchQueryLog.results_count == 0)
    ).one() or 0

    # 2. Zero results queries (grouped by lowercase query, ordered by frequency)
    zero_results = session.exec(
        select(
            func.lower(SearchQueryLog.query).label("clean_query"),
            func.count(SearchQueryLog.id).label("count"),
            func.max(SearchQueryLog.created_at).label("last_searched")
        )
        .where(SearchQueryLog.results_count == 0)
        .group_by(func.lower(SearchQueryLog.query))
        .order_by(func.count(SearchQueryLog.id).desc())
        .limit(limit)
    ).all()

    # 3. Top popular queries
    popular = session.exec(
        select(
            func.lower(SearchQueryLog.query).label("clean_query"),
            func.count(SearchQueryLog.id).label("count"),
            func.max(SearchQueryLog.results_count).label("last_results_count"),
            func.max(SearchQueryLog.created_at).label("last_searched")
        )
        .group_by(func.lower(SearchQueryLog.query))
        .order_by(func.count(SearchQueryLog.id).desc())
        .limit(limit)
    ).all()

    # 4. Recent searches stream
    recent = session.exec(
        select(SearchQueryLog)
        .order_by(SearchQueryLog.created_at.desc())
        .limit(limit)
    ).all()

    return {
        "total_searches": total_count,
        "zero_results_count": zero_count,
        "zero_results": [
            {
                "query": r[0],
                "count": r[1],
                "last_searched": r[2].isoformat() if hasattr(r[2], "isoformat") else str(r[2])
            }
            for r in zero_results
        ],
        "popular": [
            {
                "query": r[0],
                "count": r[1],
                "results_count": r[2],
                "last_searched": r[3].isoformat() if hasattr(r[3], "isoformat") else str(r[3])
            }
            for r in popular
        ],
        "recent": [
            {
                "id": r.id,
                "query": r.query,
                "results_count": r.results_count,
                "created_at": r.created_at.isoformat() if hasattr(r.created_at, "isoformat") else str(r.created_at)
            }
            for r in recent
        ]
    }


@router.delete("/search-queries", dependencies=[Depends(get_current_admin)])
def clear_search_queries(session: Session = Depends(get_session)):
    session.exec(delete(SearchQueryLog))
    session.commit()
    return {"status": "cleared"}
