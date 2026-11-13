import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query

from app.api.deps import SessionDep, get_current_user
from app.models import (
    Employee,
    Message,
    PerformanceReview,
    PerformanceReviewCreate,
    PerformanceReviewPublic,
    PerformanceReviewsPublic,
    PerformanceReviewUpdate,
)
from app.services import payroll as payroll_service

router = APIRouter(
    prefix="/performance",
    tags=["performance"],
    dependencies=[Depends(get_current_user)],
)


@router.get("/", response_model=PerformanceReviewsPublic)
def read_performance_reviews(
    session: SessionDep,
    employee_id: Annotated[uuid.UUID | None, Query()] = None,
    period_month: Annotated[int | None, Query(ge=1, le=12)] = None,
    period_year: Annotated[int | None, Query(ge=2000, le=2100)] = None,
) -> PerformanceReviewsPublic:
    """List performance evaluations and bonuses."""
    data = payroll_service.list_performance_reviews(
        session=session,
        employee_id=employee_id,
        period_month=period_month,
        period_year=period_year,
    )
    return PerformanceReviewsPublic(data=data, count=len(data))


@router.post("/", response_model=PerformanceReviewPublic)
def create_performance_review(
    session: SessionDep, review_in: PerformanceReviewCreate
) -> PerformanceReviewPublic:
    """Record a performance evaluation & bonus (updating base salary + SalaryHistory if raised)."""
    return payroll_service.create_performance_review(
        session=session, review_in=review_in
    )


@router.patch("/{id}", response_model=PerformanceReviewPublic)
def update_performance_review(
    session: SessionDep, id: uuid.UUID, review_in: PerformanceReviewUpdate
) -> PerformanceReviewPublic:
    """Update performance review score, bonus, or notes."""
    review = session.get(PerformanceReview, id)
    if not review:
        raise HTTPException(status_code=404, detail="Performance review not found")
    update_data = review_in.model_dump(exclude_unset=True)
    review.sqlmodel_update(update_data)
    session.add(review)
    session.commit()
    session.refresh(review)
    emp = session.get(Employee, review.employee_id)
    return payroll_service.to_performance_public(review, {emp.id: emp} if emp else {})


@router.delete("/{id}", response_model=Message)
def delete_performance_review(session: SessionDep, id: uuid.UUID) -> Message:
    """Delete a performance review."""
    review = session.get(PerformanceReview, id)
    if not review:
        raise HTTPException(status_code=404, detail="Performance review not found")
    session.delete(review)
    session.commit()
    return Message(message="Performance review deleted successfully")
