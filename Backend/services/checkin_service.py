"""
Patient Check-In Service
Handles patient check-ins, vitals recording, and waiting queue management
"""

from datetime import datetime, date
from typing import Dict, List, Optional
from flask import current_app
from models import db, Appointment, Patient, Nurse, Notification, NotificationType, AppointmentStatus

class CheckInService:
    """Service for managing patient check-ins"""
    
    @staticmethod
    def check_in_patient(appointment_id: int, checked_in_by: int,
                         vitals: Dict = None, notes: str = None) -> Dict:
        """
        Check in a patient for their appointment
        """
        appointment = db.session.get(Appointment, appointment_id)
        if not appointment:
            return {'success': False, 'error': 'Appointment not found'}
        
        # Check if already checked in
        if appointment.checked_in:
            return {'success': False, 'error': 'Patient already checked in'}
        
        # Check if appointment is today
        today = datetime.utcnow().date()
        if appointment.appointment_date.date() != today:
            return {'success': False, 'error': 'Appointment is not for today'}
        
        # Generate waiting number
        waiting_number = CheckInService._generate_waiting_number(appointment.appointment_date)
        
        # Validate vitals
        vitals_alerts = []
        if vitals:
            is_valid, alerts = CheckInService._validate_vitals(vitals)
            if not is_valid:
                vitals_alerts = alerts
        
        # Update appointment
        appointment.checked_in = True
        appointment.checked_in_at = datetime.utcnow()
        appointment.checked_in_by = checked_in_by
        appointment.status = AppointmentStatus.CHECKED_IN
        
        # Store vitals in appointment (add JSONB column if needed)
        if vitals:
            # You may need to add a vitals JSONB column to Appointment model
            # For now, store in notes
            vitals_text = f"\nVitals: {vitals}"
            appointment.clinical_notes = (appointment.clinical_notes or '') + vitals_text
        
        db.session.commit()
        
        # Create notification for specialist
        specialist_user_id = None
        if appointment.specialist_rel and appointment.specialist_rel.user_id:
            specialist_user_id = appointment.specialist_rel.user_id
            notification = Notification(
                user_id=specialist_user_id,
                type=NotificationType.PATIENT_CHECKED_IN,
                title='Patient Checked In',
                message=f"Patient {appointment.patient_rel.user.full_name} has checked in for appointment at {appointment.appointment_date.strftime('%H:%M')}",
                data={
                    'appointment_id': appointment.id,
                    'appointment_number': appointment.appointment_number,
                    'waiting_number': waiting_number,
                    'vitals_alerts': vitals_alerts
                },
                is_read=False
            )
            db.session.add(notification)
            db.session.commit()
        
        return {
            'success': True,
            'message': 'Patient checked in successfully',
            'appointment_id': appointment.id,
            'appointment_number': appointment.appointment_number,
            'waiting_number': waiting_number,
            'position_in_queue': CheckInService._get_queue_position(appointment.id),
            'vitals_alerts': vitals_alerts,
            'checked_in_at': appointment.checked_in_at.isoformat()
        }
    
    @staticmethod
    def _generate_waiting_number(appointment_date: datetime) -> str:
        """Generate a unique waiting number for the day"""
        date_prefix = appointment_date.strftime('%Y%m%d')
        
        # Count existing check-ins for today
        start_of_day = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
        end_of_day = datetime.utcnow().replace(hour=23, minute=59, second=59, microsecond=999999)
        
        count = Appointment.query.filter(
            Appointment.checked_in == True,
            Appointment.checked_in_at >= start_of_day,
            Appointment.checked_in_at <= end_of_day
        ).count()
        
        # Format: YYYYMMDD-XXX (e.g., 20240115-042)
        return f"{date_prefix}-{count + 1:03d}"
    
    @staticmethod
    def _get_queue_position(appointment_id: int) -> int:
        """Get patient's position in the waiting queue"""
        start_of_day = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
        
        checked_in = Appointment.query.filter(
            Appointment.checked_in == True,
            Appointment.status.in_([AppointmentStatus.CHECKED_IN, AppointmentStatus.IN_PROGRESS]),
            Appointment.checked_in_at >= start_of_day
        ).order_by(Appointment.checked_in_at.asc()).all()
        
        for i, apt in enumerate(checked_in):
            if apt.id == appointment_id:
                return i + 1
        return 0
    
    @staticmethod
    def _validate_vitals(vitals: Dict) -> tuple:
        """Validate vital signs and return alerts"""
        alerts = []
        
        ranges = {
            'temperature': {'min': 35.0, 'max': 42.0, 'unit': '°C', 'name': 'Temperature'},
            'heart_rate': {'min': 30, 'max': 200, 'unit': 'BPM', 'name': 'Heart Rate'},
            'blood_pressure_systolic': {'min': 70, 'max': 250, 'unit': 'mmHg', 'name': 'BP Systolic'},
            'blood_pressure_diastolic': {'min': 40, 'max': 150, 'unit': 'mmHg', 'name': 'BP Diastolic'},
            'respiratory_rate': {'min': 8, 'max': 40, 'unit': '/min', 'name': 'Respiratory Rate'},
            'oxygen_saturation': {'min': 70, 'max': 100, 'unit': '%', 'name': 'O2 Saturation'},
            'blood_glucose': {'min': 20, 'max': 600, 'unit': 'mg/dL', 'name': 'Blood Glucose'}
        }
        
        for key, value in vitals.items():
            if key in ranges and value is not None:
                range_info = ranges[key]
                try:
                    num_value = float(value)
                    if num_value < range_info['min']:
                        alerts.append(f"⚠️ Low {range_info['name']}: {num_value}{range_info['unit']} (normal: {range_info['min']}-{range_info['max']})")
                    elif num_value > range_info['max']:
                        alerts.append(f"⚠️ High {range_info['name']}: {num_value}{range_info['unit']} (normal: {range_info['min']}-{range_info['max']})")
                except (ValueError, TypeError):
                    pass
        
        # Specific critical alerts
        if vitals.get('temperature') and vitals['temperature'] > 39.0:
            alerts.append("🚨 Fever detected - monitor closely")
        if vitals.get('oxygen_saturation') and vitals['oxygen_saturation'] < 90:
            alerts.append("🚨 CRITICAL: Severe hypoxemia - immediate attention required")
        elif vitals.get('oxygen_saturation') and vitals['oxygen_saturation'] < 94:
            alerts.append("⚠️ Low oxygen saturation - needs evaluation")
        if vitals.get('blood_pressure_systolic') and vitals['blood_pressure_systolic'] > 180:
            alerts.append("🚨 Hypertensive crisis - urgent evaluation needed")
        
        return len(alerts) == 0, alerts
    
    @staticmethod
    def record_vitals(appointment_id: int, vitals: Dict) -> Dict:
        """Record or update patient vitals"""
        appointment = db.session.get(Appointment, appointment_id)
        if not appointment:
            return {'success': False, 'error': 'Appointment not found'}
        
        if not appointment.checked_in:
            return {'success': False, 'error': 'Patient not checked in yet'}
        
        # Validate vitals
        is_valid, alerts = CheckInService._validate_vitals(vitals)
        
        # Store vitals
        import json
        vitals_json = json.dumps(vitals)
        
        # Add to clinical notes
        vitals_text = f"\nVitals recorded at {datetime.utcnow().strftime('%H:%M')}: {vitals}"
        appointment.clinical_notes = (appointment.clinical_notes or '') + vitals_text
        db.session.commit()
        
        return {
            'success': True,
            'message': 'Vitals recorded successfully',
            'vitals': vitals,
            'alerts': alerts,
            'requires_attention': len(alerts) > 0
        }
    
    @staticmethod
    def update_appointment_status(appointment_id: int, status: str,
                                  clinical_notes: str = None) -> Dict:
        """Update appointment status (in_progress, completed, etc.)"""
        valid_statuses = ['in_progress', 'completed', 'missed', 'cancelled']
        if status not in valid_statuses:
            return {'success': False, 'error': f'Invalid status. Must be one of {valid_statuses}'}
        
        appointment = db.session.get(Appointment, appointment_id)
        if not appointment:
            return {'success': False, 'error': 'Appointment not found'}
        
        old_status = appointment.status
        appointment.status = status
        
        if clinical_notes:
            appointment.clinical_notes = (appointment.clinical_notes or '') + f"\n[{datetime.utcnow().strftime('%Y-%m-%d %H:%M')}] {clinical_notes}"
        
        # Update referral status if appointment completed
        if status == 'completed' and appointment.referral_rel:
            appointment.referral_rel.status = 'completed'
            appointment.referral_rel.completed_at = datetime.utcnow()
        
        db.session.commit()
        
        return {
            'success': True,
            'message': f'Appointment status updated from {old_status} to {status}',
            'appointment_id': appointment_id,
            'status': status
        }
    
    @staticmethod
    def get_waiting_queue(date: date = None) -> Dict:
        """Get the current waiting queue"""
        if not date:
            date = datetime.utcnow().date()
        
        start_of_day = datetime.combine(date, datetime.min.time())
        end_of_day = datetime.combine(date, datetime.max.time())
        
        appointments = Appointment.query.filter(
            Appointment.appointment_date >= start_of_day,
            Appointment.appointment_date <= end_of_day,
            Appointment.checked_in == True,
            Appointment.status.in_([AppointmentStatus.CHECKED_IN, AppointmentStatus.IN_PROGRESS])
        ).order_by(Appointment.checked_in_at.asc()).all()
        
        queue = []
        for i, apt in enumerate(appointments):
            queue.append({
                'position': i + 1,
                'waiting_number': CheckInService._generate_waiting_number_for_appointment(apt),
                'appointment_number': apt.appointment_number,
                'patient_name': apt.patient_rel.user.full_name if apt.patient_rel else 'Unknown',
                'patient_id': apt.patient_id,
                'arrival_time': apt.checked_in_at.isoformat() if apt.checked_in_at else None,
                'status': apt.status,
                'estimated_wait_minutes': (i + 1) * 15
            })
        
        return {
            'date': date.isoformat(),
            'total_waiting': len(queue),
            'queue': queue
        }
    
    @staticmethod
    def _generate_waiting_number_for_appointment(appointment: Appointment) -> str:
        """Generate waiting number for an appointment"""
        if appointment.checked_in_at:
            return appointment.checked_in_at.strftime('%H%M') + f"-{appointment.id}"
        return f"WAIT-{appointment.id}"