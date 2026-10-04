from enum import Enum


class Role(str, Enum):
    student = "student"
    staff = "staff"
    admin = "admin"


class Direction(str, Enum):
    lost = "lost"
    found = "found"


class ItemStatus(str, Enum):
    searching = "searching"
    reviewing = "reviewing"
    found = "found"
    withdrawn = "withdrawn"
    pending = "pending"
    returned = "returned"


class ClaimStatus(str, Enum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"
    completed = "completed"


class TicketStatus(str, Enum):
    pending = "pending"
    processing = "processing"
    feedback = "feedback"


class Source(str, Enum):
    manual = "manual"
    rule = "rule"
    cache = "cache"
    model = "model"


class CandidateSource(str, Enum):
    simulated = "simulated"
    rule = "rule"
    cache = "cache"
    model = "model"


class RouteKind(str, Enum):
    polyline = "polyline"
    circle = "circle"


class EvidenceKind(str, Enum):
    image = "image"
    text = "text"