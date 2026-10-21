from fastapi import APIRouter

from app.api.v1 import (
    admin,
    ai,
    auth,
    buildings,
    claims,
    comments,
    helpers,
    items,
    layers,
    me,
    reactions,
    staff_applications,
    tickets,
    uploads,
)

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth")
api_router.include_router(admin.router, prefix="/admin")
api_router.include_router(staff_applications.router, prefix="/admin")
api_router.include_router(items.router, prefix="/items")
api_router.include_router(claims.router, prefix="/claims")
api_router.include_router(layers.router, prefix="/layers")
api_router.include_router(layers.map_router, prefix="/map")
api_router.include_router(buildings.router, prefix="/buildings")
api_router.include_router(tickets.router, prefix="/tickets")
api_router.include_router(me.router, prefix="/me")
api_router.include_router(uploads.router, prefix="/uploads")
api_router.include_router(comments.router)
api_router.include_router(reactions.router)
api_router.include_router(helpers.router)
api_router.include_router(ai.router, prefix="/ai")
