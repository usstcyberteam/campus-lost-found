from enum import Enum


class Role(str, Enum):
    student = "student"
    staff = "staff"
    admin = "admin"


class StaffStatus(str, Enum):
    none = "none"
    pending = "pending"
    approved = "approved"
    rejected = "rejected"


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
    deleted = "deleted"


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


class Visibility(str, Enum):
    public = "public"
    private = "private"


class SimulatedPointKind(str, Enum):
    help_point = "help_point"
    monitor_point = "monitor_point"


class EvidenceKind(str, Enum):
    image = "image"
    text = "text"


class AttachmentPurpose(str, Enum):
    item_photo = "item_photo"
    comment_image = "comment_image"
    evidence = "evidence"


class HelperStatus(str, Enum):
    active = "active"
    abandoned = "abandoned"


class PointReason(str, Enum):
    thank = "thank"
    return_ = "return"
    ticket_feedback = "ticket_feedback"
