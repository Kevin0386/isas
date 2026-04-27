"""
No-Show Scheduler Service
Automatically marks missed appointments and tracks monthly statistics
"""

import json                          # FIX 1: was missing, caused NameError on json.dumps()
import threading
import time
from datetime import datetime, timedelta, date
from sqlalchemy import func, extract
from models import db, Appointment, SystemConfig


class NoShowScheduler:
    """Background scheduler that automatically marks missed appointments"""

    def __init__(self):                # FIX 2: no longer requires `app` at construction time
        self.app = None
        self.running = False
        self.thread = None

    def init_app(self, app):          # FIX 3: added init_app() — app.py calls this pattern
        """Initialize with a Flask app (app-factory pattern)"""
        self.app = app

    def start(self):
        """Start the background scheduler"""
        if self.running:
            return
        self.running = True
        self.thread = threading.Thread(target=self._run, daemon=True)
        self.thread.start()
        print("📅 No-Show Scheduler started - Checking appointments every hour")

    def stop(self):
        """Stop the background scheduler"""
        self.running = False
        if self.thread:
            self.thread.join(timeout=5)
        print("📅 No-Show Scheduler stopped")

    def _run(self):
        """Main scheduler loop"""
        while self.running:
            try:
                with self.app.app_context():
                    self._check_and_mark_missed_appointments()
                    self._update_monthly_statistics()
            except Exception as e:
                print(f"No-Show Scheduler error: {e}")
            time.sleep(3600)

    def _check_and_mark_missed_appointments(self):
        """Check for appointments that should be marked as missed"""
        now = datetime.utcnow()

        missed_appointments = Appointment.query.filter(
            Appointment.status.in_(['scheduled', 'confirmed']),
            Appointment.appointment_date < now
        ).all()

        missed_count = 0
        for apt in missed_appointments:
            apt.status = 'missed'
            apt.outcome = 'Patient did not attend - automatically marked as missed'
            apt.updated_at = now
            missed_count += 1

        if missed_count > 0:
            db.session.commit()
            print(f"📅 Marked {missed_count} missed appointments at {now}")

        return missed_count

    def _update_monthly_statistics(self):
        """Update monthly no-show statistics in SystemConfig"""
        current_date = datetime.utcnow().date()
        current_month = current_date.month
        current_year = current_date.year

        stats = MonthlyNoShowStats.calculate(current_year, current_month)

        config = SystemConfig.query.filter_by(
            config_key=f'no_show_stats_{current_year}_{current_month}'
        ).first()
        if not config:
            config = SystemConfig(
                config_key=f'no_show_stats_{current_year}_{current_month}',
                config_type='json',
                description=f'No-show statistics for {current_month}/{current_year}'
            )
            db.session.add(config)

        config.config_value = json.dumps(stats)
        config.updated_at = datetime.utcnow()
        db.session.commit()


class MonthlyNoShowStats:
    """Calculate monthly no-show statistics"""

    @staticmethod
    def calculate(year, month):
        start_date = date(year, month, 1)
        if month == 12:
            end_date = date(year + 1, 1, 1)
        else:
            end_date = date(year, month + 1, 1)

        appointments = Appointment.query.filter(
            Appointment.appointment_date >= start_date,
            Appointment.appointment_date < end_date
        ).all()

        total = len(appointments)
        completed = sum(1 for a in appointments if a.status == 'completed')
        missed = sum(1 for a in appointments if a.status == 'missed')
        cancelled = sum(1 for a in appointments if a.status == 'cancelled')
        scheduled = sum(1 for a in appointments if a.status in ['scheduled', 'confirmed'])

        no_show_rate = (missed / total * 100) if total > 0 else 0

        return {
            'year': year,
            'month': month,
            'month_name': datetime(year, month, 1).strftime('%B'),
            'total_appointments': total,
            'completed': completed,
            'missed': missed,
            'cancelled': cancelled,
            'scheduled': scheduled,
            'no_show_rate': round(no_show_rate, 2),
            'updated_at': datetime.utcnow().isoformat()
        }

    @staticmethod
    def get_last_12_months():
        stats = []
        current_date = datetime.utcnow().date()

        for i in range(11, -1, -1):
            target_date = current_date.replace(day=1)
            if i > 0:
                month = target_date.month - i
                year = target_date.year
                if month < 1:
                    month += 12
                    year -= 1
                target_date = target_date.replace(year=year, month=month)

            month_stats = MonthlyNoShowStats.calculate(target_date.year, target_date.month)
            stats.append(month_stats)

        return stats


# FIX 4: module-level singleton so `from services.no_show_scheduler import no_show_scheduler` works
# app.py calls: no_show_scheduler.init_app(app)
no_show_scheduler = NoShowScheduler()