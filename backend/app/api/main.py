from fastapi import APIRouter

from app.api.routes import (
    absences,
    dashboard,
    employees,
    inventory,
    invoices,
    login,
    payslips,
    performance,
    products,
    settings,
    suppliers,
    users,
    utils,
    vacations,
)

api_router = APIRouter()
api_router.include_router(login.router)
api_router.include_router(users.router)
api_router.include_router(dashboard.router)
api_router.include_router(employees.router)
api_router.include_router(absences.router)
api_router.include_router(vacations.router)
api_router.include_router(performance.router)
api_router.include_router(payslips.router)
api_router.include_router(settings.router)
api_router.include_router(suppliers.router)
api_router.include_router(products.router)
api_router.include_router(invoices.router)
api_router.include_router(inventory.router)
api_router.include_router(utils.router)
