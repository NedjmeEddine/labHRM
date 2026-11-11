import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import col, select

from app.api.deps import SessionDep, get_current_user
from app.models import (
    Employee,
    Message,
    PerformanceReview,
    PerformanceReviewCreate,
    PerformanceReviewPublic,
    PerformanceReviewsPublic,
    PerformanceReviewUpdate,
    SalaryHistory,
)

router = APIRouter(
    prefix="/performance",
    tags=["performance"],
    dependencies=[Depends(get_current_user)],
)


def _to_public(
    rev: PerformanceReview, employees_map: dict[uuid.UUID, Employee]
) -> PerformanceReviewPublic:
    emp = employees_map.get(rev.employee_id)
    return PerformanceReviewPublic(
        id=rev.id,
        employee_id=rev.employee_id,
        period_month=rev.period_month,
        period_year=rev.period_year,
        score=rev.score,
        bonus_amount=rev.bonus_amount,
        new_base_salary=rev.new_base_salary,
        notes=rev.notes,
        employee_name=emp.full_name if emp else None,
        employee_code=emp.employee_code if emp else None,
        created_at=rev.created_at,
    )


@router.get("/", response_model=PerformanceReviewsPublic)
def read_performance_reviews(
    session: SessionDep,
    employee_id: Annotated[uuid.UUID | None, Query()] = None,
    period_month: Annotated[int | None, Query(ge=1, le=12)] = None,
    period_year: Annotated[int | None, Query(ge=2000, le=2100)] = None,
) -> PerformanceReviewsPublic:
    """List performance evaluations and bonuses."""
    stmt = select(PerformanceReview).order_by(
        col(PerformanceReview.period_year).desc(),
        col(PerformanceReview.period_month).desc(),
        col(PerformanceReview.created_at).desc(),
    )
    if employee_id:
        stmt = stmt.where(PerformanceReview.employee_id == employee_id)
    if period_month:
        stmt = stmt.where(PerformanceReview.period_month == period_month)
    if period_year:
        stmt = stmt.where(PerformanceReview.period_year == period_year)

    reviews = session.exec(stmt).all()
    employees = {e.id: e for e in session.exec(select(Employee)).all()}
    data = [_to_public(r, employees) for r in reviews]
    return PerformanceReviewsPublic(data=data, count=len(data))


@router.post("/", response_model=PerformanceReviewPublic)
def create_performance_review(
    session: SessionDep, review_in: PerformanceReviewCreate
) -> PerformanceReviewPublic:
    """
    Record a performance evaluation & bonus.
    If new_base_salary is specified and differs from current base_salary,
    updates employee.base_salary and logs SalaryHistory automatically.
    """
    emp = session.get(Employee, review_in.employee_id)
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")

    review = PerformanceReview.model_validate(review_in)
    session.add(review)

    if (
        review_in.new_base_salary is not None
        and review_in.new_base_salary != emp.base_salary
    ):
        history = SalaryHistory(
            employee_id=emp.id,
            previous_salary=emp.base_salary,
            new_salary=review_in.new_base_salary,
            reason=f"Performance review ({review_in.period_month:02d}/{review_in.period_year} - Score {review_in.score}/5)",
        )
        emp.base_salary = review_in.new_base_salary
        session.add(emp)
        session.add(history)

    session.commit()
    session.refresh(review)
    return _to_public(review, {emp.id: emp})


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
    return _to_public(review, {emp.id: emp} if emp else {})


@router.delete("/{id}", response_model=Message)
def delete_performance_review(session: SessionDep, id: uuid.UUID) -> Message:
    """Delete a performance review."""
    review = session.get(PerformanceReview, id)
    if not review:
        raise HTTPException(status_code=404, detail="Performance review not found")
    session.delete(review)
    session.commit()
    return Message(message="Performance review deleted successfully")
