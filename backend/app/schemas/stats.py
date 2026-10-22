from pydantic import BaseModel


class CountByKey(BaseModel):
    key: str
    name: str
    count: int


class StatsOut(BaseModel):
    total_items: int
    lost_count: int
    found_count: int
    active_count: int
    returned_count: int
    claim_total: int
    claim_pending: int
    claim_approved: int
    claim_completed: int
    recovery_rate: float
    avg_handling_hours: float | None
    by_building: list[CountByKey]
    by_category: list[CountByKey]
    by_status: list[CountByKey]