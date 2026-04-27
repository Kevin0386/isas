"""
Specialist Routes - Complete implementation for all specialist functions
"""

from flask import Blueprint, request, jsonify, send_file
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import datetime, date, timedelta
from sqlalchemy import or_, and_
import os

from models import (
    db, User, Specialist, Referral, Appointment, 
    ReferralDocument, Notification, NotificationType,
    Patient, UserActivityLog, AppointmentStatus, 
    ReferralStatus, ReferralPriority
)

specialist_bp = Blueprint('specialist', __name__, url_prefix='/api/specialist')


# ============ DASHBOARD & STATS ============

@specialist_bp.route('/dashboard', methods=['GET'])
@jwt_required()
def get_dashboard():
    """Get specialist dashboard with statistics"""
    current_user_id = get_jwt_identity()
    
    # Get specialist profile
    specialist = Specialist.query.filter_by(user_id=current_user_id).first()
    if not specialist:
        return jsonify({'error': 'Specialist profile not found'}), 404
    
    today = datetime.utcnow().date()
    tomorrow = today + timedelta(days=1)
    
    # Today's appointments
    today_appointments = Appointment.query.filter(
        Appointment.specialist_id == specialist.id,
        Appointment.appointment_date >= today,
        Appointment.appointment_date < tomorrow,
        Appointment.status != AppointmentStatus.CANCELLED
    ).count()
    
    # Pending referrals assigned to this specialist
    pending_referrals = Referral.query.filter(
        Referral.assigned_specialist_id == specialist.id,
        Referral.status == ReferralStatus.PENDING
    ).count()
    
    # Total appointments this week
    week_start = today - timedelta(days=today.weekday())
    week_end = week_start + timedelta(days=7)
    weekly_appointments = Appointment.query.filter(
        Appointment.specialist_id == specialist.id,
        Appointment.appointment_date >= week_start,
        Appointment.appointment_date < week_end,
        Appointment.status != AppointmentStatus.CANCELLED
    ).count()
    
    # Completed appointments this month
    month_start = today.replace(day=1)
    completed_appointments = Appointment.query.filter(
        Appointment.specialist_id == specialist.id,
        Appointment.appointment_date >= month_start,
        Appointment.status == AppointmentStatus.COMPLETED
    ).count()
    
    return jsonify({
        'specialist_id': specialist.id,
        'specialist_name': specialist.user.full_name if specialist.user else None,
        'specialty': specialist.specialty_rel.name if specialist.specialty_rel else None,
        'today_appointments': today_appointments,
        'pending_referrals': pending_referrals,
        'weekly_appointments': weekly_appointments,
        'monthly_completed': completed_appointments,
        'is_available': specialist.is_available
    }), 200


# ============ APPOINTMENT SCHEDULE ============

@specialist_bp.route('/appointments', methods=['GET'])
@jwt_required()
def get_appointments():
    """Get specialist's appointments with date filtering"""
    current_user_id = get_jwt_identity()
    
    specialist = Specialist.query.filter_by(user_id=current_user_id).first()
    if not specialist:
        return jsonify({'error': 'Specialist profile not found'}), 404
    
    # Parse query parameters
    date_str = request.args.get('date')
    status = request.args.get('status')
    limit = request.args.get('limit', 50, type=int)
    
    query = Appointment.query.filter_by(specialist_id=specialist.id)
    
    if date_str:
        target_date = datetime.fromisoformat(date_str).date()
        next_date = target_date + timedelta(days=1)
        query = query.filter(
            Appointment.appointment_date >= target_date,
            Appointment.appointment_date < next_date
        )
    
    if status:
        query = query.filter_by(status=status)
    
    appointments = query.order_by(Appointment.appointment_date.asc()).limit(limit).all()
    
    results = []
    for apt in appointments:
        # Get referral letter if exists
        referral_letter = None
        if apt.referral_rel:
            doc = ReferralDocument.query.filter_by(
                referral_id=apt.referral_rel.id,
                document_type='referral_letter_initial'
            ).first()
            if doc:
                referral_letter = {
                    'id': doc.id,
                    'filename': doc.filename,
                    'uploaded_at': doc.uploaded_at.isoformat() if doc.uploaded_at else None
                }
        
        results.append({
            'id': apt.id,
            'appointment_number': apt.appointment_number,
            'patient_id': apt.patient_id,
            'patient_name': apt.patient_rel.user.full_name if apt.patient_rel and apt.patient_rel.user else None,
            'patient_omang': apt.patient_rel.user.omang if apt.patient_rel and apt.patient_rel.user else None,
            'patient_dob': apt.patient_rel.date_of_birth.isoformat() if apt.patient_rel and apt.patient_rel.date_of_birth else None,
            'appointment_date': apt.appointment_date.isoformat(),
            'duration': apt.duration,
            'status': apt.status,
            'checked_in': apt.checked_in,
            'checked_in_at': apt.checked_in_at.isoformat() if apt.checked_in_at else None,
            'outcome': apt.outcome,
            'clinical_notes': apt.clinical_notes,
            'referral_id': apt.referral_id,
            'referral_reason': apt.referral_rel.reason if apt.referral_rel else None,
            'referral_priority': apt.referral_rel.priority if apt.referral_rel else None,
            'referral_letter': referral_letter
        })
    
    return jsonify(results), 200


@specialist_bp.route('/appointments/today', methods=['GET'])
@jwt_required()
def get_today_appointments():
    """Get today's appointments for the specialist"""
    current_user_id = get_jwt_identity()
    
    specialist = Specialist.query.filter_by(user_id=current_user_id).first()
    if not specialist:
        return jsonify({'error': 'Specialist profile not found'}), 404
    
    today = datetime.utcnow().date()
    tomorrow = today + timedelta(days=1)
    
    appointments = Appointment.query.filter(
        Appointment.specialist_id == specialist.id,
        Appointment.appointment_date >= today,
        Appointment.appointment_date < tomorrow,
        Appointment.status != AppointmentStatus.CANCELLED
    ).order_by(Appointment.appointment_date.asc()).all()
    
    results = []
    for apt in appointments:
        results.append({
            'id': apt.id,
            'appointment_number': apt.appointment_number,
            'patient_id': apt.patient_id,
            'patient_name': apt.patient_rel.user.full_name if apt.patient_rel and apt.patient_rel.user else None,
            'patient_age': _calculate_age(apt.patient_rel.date_of_birth) if apt.patient_rel and apt.patient_rel.date_of_birth else None,
            'appointment_time': apt.appointment_date.strftime('%H:%M'),
            'appointment_date': apt.appointment_date.isoformat(),
            'duration': apt.duration,
            'status': apt.status,
            'checked_in': apt.checked_in,
            'checked_in_at': apt.checked_in_at.isoformat() if apt.checked_in_at else None,
            'waiting_time': _calculate_waiting_time(apt.checked_in_at) if apt.checked_in_at else None,
            'referral_reason': apt.referral_rel.reason[:200] if apt.referral_rel else None,
            'referral_priority': apt.referral_rel.priority if apt.referral_rel else None
        })
    
    return jsonify({
        'date': today.isoformat(),
        'total': len(results),
        'appointments': results
    }), 200


@specialist_bp.route('/appointments/week', methods=['GET'])
@jwt_required()
def get_week_appointments():
    """Get specialist's appointments for the current week"""
    current_user_id = get_jwt_identity()
    
    specialist = Specialist.query.filter_by(user_id=current_user_id).first()
    if not specialist:
        return jsonify({'error': 'Specialist profile not found'}), 404
    
    # Get week start (Monday)
    today = datetime.utcnow().date()
    week_start = today - timedelta(days=today.weekday())
    week_end = week_start + timedelta(days=7)
    
    appointments = Appointment.query.filter(
        Appointment.specialist_id == specialist.id,
        Appointment.appointment_date >= week_start,
        Appointment.appointment_date < week_end,
        Appointment.status != AppointmentStatus.CANCELLED
    ).order_by(Appointment.appointment_date.asc()).all()
    
    # Group by day
    week_schedule = {}
    for i in range(7):
        day = week_start + timedelta(days=i)
        week_schedule[day.isoformat()] = []
    
    for apt in appointments:
        day_key = apt.appointment_date.date().isoformat()
        if day_key in week_schedule:
            week_schedule[day_key].append({
                'id': apt.id,
                'appointment_number': apt.appointment_number,
                'patient_name': apt.patient_rel.user.full_name if apt.patient_rel and apt.patient_rel.user else None,
                'appointment_time': apt.appointment_date.strftime('%H:%M'),
                'duration': apt.duration,
                'status': apt.status,
                'checked_in': apt.checked_in
            })
    
    return jsonify({
        'week_start': week_start.isoformat(),
        'week_end': week_end.isoformat(),
        'schedule': week_schedule
    }), 200


# ============ UPDATE APPOINTMENT OUTCOME ============

@specialist_bp.route('/appointments/<int:appointment_id>/outcome', methods=['PUT'])
@jwt_required()
def update_appointment_outcome(appointment_id):
    """Update appointment outcome (completed/missed) and add clinical notes"""
    current_user_id = get_jwt_identity()
    data = request.get_json()
    
    specialist = Specialist.query.filter_by(user_id=current_user_id).first()
    if not specialist:
        return jsonify({'error': 'Specialist profile not found'}), 404
    
    appointment = Appointment.query.get(appointment_id)
    if not appointment:
        return jsonify({'error': 'Appointment not found'}), 404
    
    # Verify this appointment belongs to the specialist
    if appointment.specialist_id != specialist.id:
        return jsonify({'error': 'Unauthorized - This appointment is not assigned to you'}), 403
    
    new_status = data.get('status')
    valid_statuses = [AppointmentStatus.COMPLETED, AppointmentStatus.MISSED]
    
    if new_status not in valid_statuses:
        return jsonify({'error': f'Invalid status. Must be one of {valid_statuses}'}), 400
    
    old_status = appointment.status
    appointment.status = new_status
    appointment.outcome = data.get('outcome')
    appointment.updated_at = datetime.utcnow()
    appointment.updated_by = current_user_id
    
    # Add clinical notes if provided
    if data.get('clinical_notes'):
        timestamp = datetime.utcnow().strftime('%Y-%m-%d %H:%M')
        new_notes = f"\n[{timestamp}] Dr. {specialist.user.full_name}: {data['clinical_notes']}"
        appointment.clinical_notes = (appointment.clinical_notes or '') + new_notes
    
    # Update referral status if appointment completed
    if appointment.referral_rel and new_status == AppointmentStatus.COMPLETED:
        appointment.referral_rel.status = ReferralStatus.COMPLETED
        appointment.referral_rel.completed_at = datetime.utcnow()
    
    db.session.commit()
    
    # Create notification for patient
    if appointment.patient_rel and appointment.patient_rel.user:
        status_message = "completed" if new_status == AppointmentStatus.COMPLETED else "marked as missed"
        notification = Notification(
            user_id=appointment.patient_rel.user_id,
            type=NotificationType.APPOINTMENT_SCHEDULED,  # Reuse or add new type
            title=f'Appointment {status_message.capitalize()}',
            message=f'Your appointment on {appointment.appointment_date.strftime("%B %d, %Y")} has been {status_message}.',
            data={
                'appointment_id': appointment.id,
                'appointment_number': appointment.appointment_number,
                'status': new_status
            },
            is_read=False
        )
        db.session.add(notification)
        db.session.commit()
    
    # Log activity
    UserActivityLog.log_action(
        user_id=current_user_id,
        action_type='APPOINTMENT_UPDATE',
        resource_type='Appointment',
        resource_id=appointment_id,
        resource_details={'old_status': old_status, 'new_status': new_status},
        ip_address=request.remote_addr
    )
    
    return jsonify({
        'success': True,
        'message': f'Appointment marked as {new_status}',
        'appointment_id': appointment.id,
        'old_status': old_status,
        'new_status': new_status,
        'clinical_notes_added': bool(data.get('clinical_notes'))
    }), 200


@specialist_bp.route('/appointments/<int:appointment_id>/notes', methods=['POST'])
@jwt_required()
def add_clinical_notes(appointment_id):
    """Add clinical notes to an appointment"""
    current_user_id = get_jwt_identity()
    data = request.get_json()
    
    specialist = Specialist.query.filter_by(user_id=current_user_id).first()
    if not specialist:
        return jsonify({'error': 'Specialist profile not found'}), 404
    
    appointment = Appointment.query.get(appointment_id)
    if not appointment:
        return jsonify({'error': 'Appointment not found'}), 404
    
    if appointment.specialist_id != specialist.id:
        return jsonify({'error': 'Unauthorized'}), 403
    
    clinical_notes = data.get('clinical_notes')
    if not clinical_notes:
        return jsonify({'error': 'Clinical notes are required'}), 400
    
    timestamp = datetime.utcnow().strftime('%Y-%m-%d %H:%M')
    new_notes = f"\n[{timestamp}] Dr. {specialist.user.full_name}: {clinical_notes}"
    appointment.clinical_notes = (appointment.clinical_notes or '') + new_notes
    appointment.updated_at = datetime.utcnow()
    
    db.session.commit()
    
    # Log activity
    UserActivityLog.log_action(
        user_id=current_user_id,
        action_type='CLINICAL_NOTES_ADD',
        resource_type='Appointment',
        resource_id=appointment_id,
        resource_details={'notes_length': len(clinical_notes)},
        ip_address=request.remote_addr
    )
    
    return jsonify({
        'success': True,
        'message': 'Clinical notes added successfully',
        'appointment_id': appointment.id,
        'clinical_notes': appointment.clinical_notes
    }), 200


# ============ VIEW REFERRAL LETTERS ============

@specialist_bp.route('/referrals/<int:referral_id>/documents', methods=['GET'])
@jwt_required()
def get_referral_documents(referral_id):
    """Get all documents for a referral"""
    current_user_id = get_jwt_identity()
    
    specialist = Specialist.query.filter_by(user_id=current_user_id).first()
    if not specialist:
        return jsonify({'error': 'Specialist profile not found'}), 404
    
    referral = Referral.query.get(referral_id)
    if not referral:
        return jsonify({'error': 'Referral not found'}), 404
    
    # Verify this referral is assigned to the specialist or from their facility
    if referral.assigned_specialist_id != specialist.id:
        return jsonify({'error': 'Unauthorized - This referral is not assigned to you'}), 403
    
    # Mark as viewed by specialist
    if not referral.viewed_by_specialist:
        referral.viewed_by_specialist = True
        referral.viewed_at = datetime.utcnow()
        db.session.commit()
    
    documents = ReferralDocument.query.filter_by(referral_id=referral_id).all()
    
    results = []
    for doc in documents:
        results.append({
            'id': doc.id,
            'uuid': str(doc.uuid),
            'document_type': doc.document_type,
            'filename': doc.filename,
            'file_size': doc.file_size,
            'mime_type': doc.mime_type,
            'title': doc.title,
            'description': doc.description,
            'document_date': doc.document_date.isoformat() if doc.document_date else None,
            'uploaded_at': doc.uploaded_at.isoformat() if doc.uploaded_at else None,
            'uploaded_by': doc.uploader.full_name if doc.uploader else None
        })
    
    return jsonify({
        'referral_id': referral_id,
        'referral_number': referral.referral_number,
        'patient_name': referral.patient_rel.user.full_name if referral.patient_rel else None,
        'documents': results
    }), 200


@specialist_bp.route('/documents/<int:document_id>/download', methods=['GET'])
@jwt_required()
def download_document(document_id):
    """Download a referral document"""
    current_user_id = get_jwt_identity()
    
    specialist = Specialist.query.filter_by(user_id=current_user_id).first()
    if not specialist:
        return jsonify({'error': 'Specialist profile not found'}), 404
    
    document = ReferralDocument.query.get(document_id)
    if not document:
        return jsonify({'error': 'Document not found'}), 404
    
    # Verify access
    referral = Referral.query.get(document.referral_id)
    if referral and referral.assigned_specialist_id != specialist.id:
        return jsonify({'error': 'Unauthorized'}), 403
    
    # Update access count
    document.last_accessed_at = datetime.utcnow()
    document.access_count = (document.access_count or 0) + 1
    db.session.commit()
    
    # Check if file exists
    if not os.path.exists(document.file_path):
        return jsonify({'error': 'File not found on server'}), 404
    
    return send_file(
        document.file_path,
        mimetype=document.mime_type or 'application/pdf',
        as_attachment=True,
        download_name=document.filename
    )


# ============ MANAGE PENDING REFERRALS ============

@specialist_bp.route('/referrals/pending', methods=['GET'])
@jwt_required()
def get_pending_referrals():
    """Get pending referrals assigned to this specialist"""
    current_user_id = get_jwt_identity()
    
    specialist = Specialist.query.filter_by(user_id=current_user_id).first()
    if not specialist:
        return jsonify({'error': 'Specialist profile not found'}), 404
    
    referrals = Referral.query.filter(
        Referral.assigned_specialist_id == specialist.id,
        Referral.status.in_([ReferralStatus.PENDING, ReferralStatus.PENDING_APPROVAL])
    ).order_by(
        # Emergency first, then urgent, then routine
        db.case(
            (Referral.priority == ReferralPriority.EMERGENCY, 1),
            (Referral.priority == ReferralPriority.URGENT, 2),
            (Referral.priority == ReferralPriority.ROUTINE, 3),
            else_=4
        ),
        Referral.created_at.asc()
    ).all()
    
    results = []
    for ref in referrals:
        # Calculate waiting days
        waiting_days = (datetime.utcnow() - ref.created_at).days
        
        results.append({
            'id': ref.id,
            'referral_number': ref.referral_number,
            'patient_id': ref.patient_id,
            'patient_name': ref.patient_rel.user.full_name if ref.patient_rel and ref.patient_rel.user else None,
            'patient_age': _calculate_age(ref.patient_rel.date_of_birth) if ref.patient_rel and ref.patient_rel.date_of_birth else None,
            'patient_village': ref.patient_rel.village if ref.patient_rel else None,
            'patient_district': ref.patient_rel.district if ref.patient_rel else None,
            'reason': ref.reason,
            'clinical_summary': ref.clinical_summary,
            'diagnosis': ref.diagnosis,
            'symptoms': ref.symptoms,
            'priority': ref.priority,
            'status': ref.status,
            'created_at': ref.created_at.isoformat(),
            'waiting_days': waiting_days,
            'has_documents': ReferralDocument.query.filter_by(referral_id=ref.id).count() > 0
        })
    
    return jsonify({
        'total': len(results),
        'referrals': results
    }), 200


@specialist_bp.route('/referrals/<int:referral_id>/accept', methods=['POST'])
@jwt_required()
def accept_referral(referral_id):
    """Accept a pending referral and optionally schedule appointment"""
    current_user_id = get_jwt_identity()
    data = request.get_json()
    
    specialist = Specialist.query.filter_by(user_id=current_user_id).first()
    if not specialist:
        return jsonify({'error': 'Specialist profile not found'}), 404
    
    referral = Referral.query.get(referral_id)
    if not referral:
        return jsonify({'error': 'Referral not found'}), 404
    
    if referral.assigned_specialist_id != specialist.id:
        return jsonify({'error': 'Unauthorized'}), 403
    
    if referral.status != ReferralStatus.PENDING:
        return jsonify({'error': f'Referral cannot be accepted. Current status: {referral.status}'}), 400
    
    # Update referral status
    referral.status = ReferralStatus.ASSIGNED
    referral.updated_at = datetime.utcnow()
    
    # Create appointment if date provided
    appointment_created = False
    appointment_id = None
    
    if data.get('appointment_date'):
        appointment_datetime = datetime.fromisoformat(data['appointment_date'])
        
        # Check for conflicts
        existing = Appointment.query.filter(
            Appointment.specialist_id == specialist.id,
            Appointment.appointment_date >= appointment_datetime,
            Appointment.appointment_date < appointment_datetime + timedelta(minutes=30),
            Appointment.status != AppointmentStatus.CANCELLED
        ).first()
        
        if existing:
            return jsonify({'error': 'Time slot already booked'}), 409
        
        # Generate appointment number
        import uuid as uuid_lib
        appointment_number = f"APT-{datetime.utcnow().strftime('%Y%m%d')}-{uuid_lib.uuid4().hex[:6].upper()}"
        
        appointment = Appointment(
            appointment_number=appointment_number,
            referral_id=referral.id,
            patient_id=referral.patient_id,
            specialist_id=specialist.id,
            appointment_date=appointment_datetime,
            duration=data.get('duration', specialist.consultation_duration or 30),
            end_time=appointment_datetime + timedelta(minutes=data.get('duration', specialist.consultation_duration or 30)),
            status=AppointmentStatus.SCHEDULED,
            created_by=current_user_id
        )
        
        db.session.add(appointment)
        db.session.flush()
        appointment_created = True
        appointment_id = appointment.id
        referral.status = ReferralStatus.SCHEDULED
    
    db.session.commit()
    
    # Create notification for patient
    if referral.patient_rel and referral.patient_rel.user:
        message = f"Dr. {specialist.user.full_name} has accepted your referral"
        if appointment_created:
            message += f" and scheduled an appointment for {appointment_datetime.strftime('%B %d, %Y at %H:%M')}"
        
        notification = Notification(
            user_id=referral.patient_rel.user_id,
            type=NotificationType.REFERRAL_ASSIGNED,
            title='Referral Accepted',
            message=message,
            data={
                'referral_id': referral.id,
                'referral_number': referral.referral_number,
                'appointment_id': appointment_id
            },
            is_read=False
        )
        db.session.add(notification)
        db.session.commit()
    
    # Log activity
    UserActivityLog.log_action(
        user_id=current_user_id,
        action_type='REFERRAL_ACCEPT',
        resource_type='Referral',
        resource_id=referral_id,
        resource_details={'appointment_created': appointment_created},
        ip_address=request.remote_addr
    )
    
    return jsonify({
        'success': True,
        'message': 'Referral accepted successfully',
        'referral_id': referral.id,
        'referral_number': referral.referral_number,
        'status': referral.status,
        'appointment_created': appointment_created,
        'appointment_id': appointment_id
    }), 200


@specialist_bp.route('/referrals/<int:referral_id>/decline', methods=['POST'])
@jwt_required()
def decline_referral(referral_id):
    """Decline a pending referral with reason"""
    current_user_id = get_jwt_identity()
    data = request.get_json()
    
    specialist = Specialist.query.filter_by(user_id=current_user_id).first()
    if not specialist:
        return jsonify({'error': 'Specialist profile not found'}), 404
    
    referral = Referral.query.get(referral_id)
    if not referral:
        return jsonify({'error': 'Referral not found'}), 404
    
    if referral.assigned_specialist_id != specialist.id:
        return jsonify({'error': 'Unauthorized'}), 403
    
    reason = data.get('reason', 'Not specified')
    
    referral.status = ReferralStatus.REJECTED
    referral.cancellation_reason = f"Declined by Dr. {specialist.user.full_name}: {reason}"
    referral.cancelled_at = datetime.utcnow()
    db.session.commit()
    
    # Create notification for nurse
    if referral.referring_nurse and referral.referring_nurse.user:
        notification = Notification(
            user_id=referral.referring_nurse.user_id,
            type=NotificationType.REFERRAL_RECEIVED,
            title='Referral Declined',
            message=f"Dr. {specialist.user.full_name} declined referral {referral.referral_number}. Reason: {reason}",
            data={'referral_id': referral.id, 'referral_number': referral.referral_number},
            is_read=False
        )
        db.session.add(notification)
        db.session.commit()
    
    # Log activity
    UserActivityLog.log_action(
        user_id=current_user_id,
        action_type='REFERRAL_DECLINE',
        resource_type='Referral',
        resource_id=referral_id,
        resource_details={'reason': reason},
        ip_address=request.remote_addr
    )
    
    return jsonify({
        'success': True,
        'message': 'Referral declined',
        'referral_id': referral.id,
        'referral_number': referral.referral_number
    }), 200


@specialist_bp.route('/referrals/<int:referral_id>/view', methods=['POST'])
@jwt_required()
def mark_referral_viewed(referral_id):
    """Mark a referral as viewed by the specialist"""
    current_user_id = get_jwt_identity()
    
    specialist = Specialist.query.filter_by(user_id=current_user_id).first()
    if not specialist:
        return jsonify({'error': 'Specialist profile not found'}), 404
    
    referral = Referral.query.get(referral_id)
    if not referral:
        return jsonify({'error': 'Referral not found'}), 404
    
    if referral.assigned_specialist_id != specialist.id:
        return jsonify({'error': 'Unauthorized'}), 403
    
    referral.viewed_by_specialist = True
    referral.viewed_at = datetime.utcnow()
    db.session.commit()
    
    return jsonify({
        'success': True,
        'message': 'Referral marked as viewed',
        'referral_id': referral_id,
        'viewed_at': referral.viewed_at.isoformat()
    }), 200


# ============ AVAILABILITY MANAGEMENT ============

@specialist_bp.route('/availability', methods=['PUT'])
@jwt_required()
def update_availability():
    """Update specialist's availability status"""
    current_user_id = get_jwt_identity()
    data = request.get_json()
    
    specialist = Specialist.query.filter_by(user_id=current_user_id).first()
    if not specialist:
        return jsonify({'error': 'Specialist profile not found'}), 404
    
    is_available = data.get('is_available', False)
    specialist.is_available = is_available
    specialist.updated_at = datetime.utcnow()
    db.session.commit()
    
    # Log activity
    UserActivityLog.log_action(
        user_id=current_user_id,
        action_type='AVAILABILITY_UPDATE',
        resource_type='Specialist',
        resource_id=specialist.id,
        resource_details={'is_available': is_available},
        ip_address=request.remote_addr
    )
    
    return jsonify({
        'success': True,
        'message': f'Availability set to {is_available}',
        'is_available': is_available
    }), 200


@specialist_bp.route('/schedule', methods=['GET'])
@jwt_required()
def get_my_schedule():
    """Get specialist's recurring schedule template"""
    current_user_id = get_jwt_identity()
    
    specialist = Specialist.query.filter_by(user_id=current_user_id).first()
    if not specialist:
        return jsonify({'error': 'Specialist profile not found'}), 404
    
    from models import SpecialistSchedule
    
    schedules = SpecialistSchedule.query.filter_by(
        specialist_id=specialist.id,
        is_active=True
    ).order_by(SpecialistSchedule.day_of_week).all()
    
    days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
    
    results = []
    for sched in schedules:
        results.append({
            'id': sched.id,
            'day_of_week': sched.day_of_week,
            'day_name': days[sched.day_of_week] if sched.day_of_week < len(days) else 'Unknown',
            'start_time': sched.start_time.isoformat(),
            'end_time': sched.end_time.isoformat(),
            'max_patients': sched.max_patients,
            'is_active': sched.is_active
        })
    
    return jsonify({
        'specialist_id': specialist.id,
        'specialist_name': specialist.user.full_name if specialist.user else None,
        'consultation_duration': specialist.consultation_duration,
        'max_patients_per_day': specialist.max_patients_per_day,
        'schedule': results
    }), 200


# ============ HELPER FUNCTIONS ============

def _calculate_age(birth_date):
    """Calculate age from birth date"""
    if not birth_date:
        return None
    today = date.today()
    return today.year - birth_date.year - ((today.month, today.day) < (birth_date.month, birth_date.day))


def _calculate_waiting_time(checked_in_at):
    """Calculate waiting time in minutes"""
    if not checked_in_at:
        return None
    waiting = (datetime.utcnow() - checked_in_at).total_seconds() / 60
    return round(waiting)