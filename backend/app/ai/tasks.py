"""Celery tasks for AI assistant"""
from app.celery_app import celery_app
from app.core.database import SessionLocal
from app.models.goal import Goal, GoalStatus
from app.models.notification import Notification, NotificationType, NotificationCategory
from datetime import datetime, timedelta
import json


@celery_app.task(name="ai.generate_insights")
def generate_insights(user_id: int):
    """Generate financial insights for a user"""
    # TODO: Implement insight generation
    pass


@celery_app.task(name="ai.detect_anomalies")
def detect_anomalies(user_id: int):
    """Detect anomalous transactions"""
    # TODO: Implement anomaly detection
    pass


@celery_app.task(name="ai.predict_expenses")
def predict_expenses(user_id: int, period_days: int = 30):
    """Predict expenses for future period"""
    # TODO: Implement expense prediction
    pass


@celery_app.task(name="ai.recommend_savings")
def recommend_savings(user_id: int):
    """Generate personalized savings recommendations"""
    # TODO: Implement savings recommendations
    pass


def _check_goal_progress_sync(goal: Goal, db: SessionLocal) -> None:
    """Synchronous version of goal progress check for Celery tasks"""
    if goal.status != GoalStatus.ACTIVE:
        return
    
    # Calculate expected progress based on time
    if goal.target_date and goal.start_date:
        total_days = (goal.target_date - goal.start_date).days
        elapsed_days = (datetime.utcnow() - goal.start_date).days
        
        if total_days > 0 and elapsed_days > 0:
            expected_progress = (elapsed_days / total_days) * 100
            actual_progress = goal.progress_percentage
            
            # Check if behind schedule
            if actual_progress < expected_progress - 10:  # 10% threshold
                days_behind = int((expected_progress - actual_progress) / 100 * total_days)
                amount_needed = goal.target_amount - goal.current_amount
                
                # Check if notification was already sent recently (within last 7 days)
                recent_notification = db.query(Notification).filter(
                    Notification.user_id == goal.user_id,
                    Notification.category == NotificationCategory.GOAL_UPDATE,
                    Notification.notification_metadata.contains(f'"goal_id":{goal.id}'),
                    Notification.created_at >= datetime.utcnow() - timedelta(days=7)
                ).first()
                
                if not recent_notification:
                    # Create notification
                    notification = Notification(
                        user_id=goal.user_id,
                        notification_type=NotificationType.WARNING,
                        category=NotificationCategory.GOAL_UPDATE,
                        title=f"⚠️ Отставание от плана: {goal.name}",
                        message=f"Вы отстаете от плана на {days_behind} дней. "
                               f"Для достижения цели необходимо накопить еще {int(amount_needed):,} {goal.currency}. "
                               f"Рекомендуется пересмотреть план накоплений.",
                        notification_metadata=json.dumps({"goal_id": goal.id, "type": "behind_schedule"})
                    )
                    db.add(notification)
                    db.commit()


@celery_app.task(name="goals.check_all_progress")
def check_all_goals_progress():
    """Check progress for all active goals and send notifications"""
    db = SessionLocal()
    try:
        active_goals = db.query(Goal).filter(Goal.status == GoalStatus.ACTIVE).all()
        
        for goal in active_goals:
            try:
                _check_goal_progress_sync(goal, db)
            except Exception as e:
                # Log error but continue with other goals
                print(f"Error checking goal {goal.id}: {e}")
    finally:
        db.close()

