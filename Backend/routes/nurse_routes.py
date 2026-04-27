"""
Nurse Routes - Complete implementation for all nurse functions
"""

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import datetime, date, timedelta
from sqlalchemy import func, and_, or_

from models import (
    db, User, Patient, Nurse, Referral, Appointment, 
    RescheduleRequest, Notification, NotificationType,
    UserRole, ReferralPriority, ReferralStatus, AppointmentStatus,
    Facility, Specialty, UserActivityLog
)
from services.registry_service import NationalRegistryService
from services.ai_priority_service import AIPriorityService
from services.checkin_service import CheckInService

nurse_bp = Blueprint('nurse', __name__, url_prefix='/api/nurse')


# ============ DASHBOARD & STATS ============

@nurse_bp.route('/stats', methods=['GET'])
@jwt_required()
def get_stats():
    """Get nurse dashboard statistics"""
    current_user_id = get_jwt_identity()
    
    # Get nurse's facility
    nurse = Nurse.query.filter_by(user_id=current_user_id).first()
    facility_id = nurse.facility_id if nurse else None
    
    # Pending referrals at this facility
    pending_referrals = Referral.query.filter_by(
        referred_to_facility_id=facility_id,
        status=ReferralStatus.PENDING
    ).count() if facility_id else 0
    
    # Today's appointments
    today = datetime.utcnow().date()
    tomorrow = today + timedelta(days=1)
    today_appointments = Appointment.query.filter(
        Appointment.appointment_date >= today,
        Appointment.appointment_date < tomorrow
    ).count()
    
    # Waiting patients (checked in, not completed)
    waiting_patients = Appointment.query.filter(
        Appointment.appointment_date >= today,
        Appointment.appointment_date < tomorrow,
        Appointment.checked_in == True,
        Appointment.status != AppointmentStatus.COMPLETED
    ).count()
    
    # Pending reschedule requests
    pending_reschedules = RescheduleRequest.query.filter_by(
        status='pending'
    ).count()
    
    return jsonify({
        'pendingReferrals': pending_referrals,
        'todayAppointments': today_appointments,
        'waitingPatients': waiting_patients,
        'rescheduleRequests': pending_reschedules
    }), 200


# ============ NATIONAL REGISTRY SEARCH ============

@nurse_bp.route('/registry/search', methods=['POST'])
@jwt_required()
def search_national_registry():
    """Search national patient registry by Omang"""
    data = request.get_json()
    omang = data.get('omang')
    
    if not omang:
        return jsonify({'error': 'Omang number required'}), 400
    
    result = NationalRegistryService.search_national_registry(
        omang,
        data.get('full_name'),
        data.get('phone'),
        data.get('email')
    )
    
    # Log activity
    UserActivityLog.log_action(
        user_id=get_jwt_identity(),
        action_type='REGISTRY_SEARCH',
        resource_type='Patient',
        resource_details={'omang': omang, 'found': result.get('found_in_national')},
        ip_address=request.remote_addr
    )
    
    if result['success']:
        return jsonify(result), 200
    else:
        return jsonify({'error': result['error']}), 400


@nurse_bp.route('/registry/import', methods=['POST'])
@jwt_required()
def import_from_national_registry():
    """Import patient data from national registry"""
    current_user_id = get_jwt_identity()
    data = request.get_json()
    
    omang = data.get('omang')
    if not omang:
        return jsonify({'error': 'Omang required'}), 400
    
    result = NationalRegistryService.import_from_registry(omang, data)
    
    if result['success']:
        # Log activity
        UserActivityLog.log_action(
            user_id=current_user_id,
            action_type='PATIENT_IMPORT',
            resource_type='Patient',
            resource_id=result.get('patient_id'),
            resource_details={'omang': omang, 'source': 'national_registry'},
            ip_address=request.remote_addr
        )
        return jsonify(result), 201
    else:
        return jsonify({'error': result['error']}), 400


# ============ PATIENT SEARCH & REGISTRATION ============

@nurse_bp.route('/patients/search', methods=['GET'])
@jwt_required()
def search_patients():
    """Search for patients by name, Omang, or passport"""
    query = request.args.get('q', '')
    if len(query) < 2:
        return jsonify([]), 200
    
    search_pattern = f"%{query}%"
    
    patients = Patient.query.join(User).filter(
        or_(
            User.full_name.ilike(search_pattern),
            User.omang.ilike(search_pattern),
            Patient.passport_number.ilike(search_pattern),
            Patient.national_patient_id.ilike(search_pattern)
        )
    ).limit(20).all()
    
    results = []
    for patient in patients:
        results.append({
            'id': patient.id,
            'uuid': str(patient.uuid),
            'full_name': patient.user.full_name,
            'omang': patient.user.omang,
            'passport_number': patient.passport_number,
            'national_patient_id': patient.national_patient_id,
            'date_of_birth': patient.date_of_birth.isoformat() if patient.date_of_birth else None,
            'phone': patient.user.phone,
            'village': patient.village,
            'district': patient.district
        })
    
    return jsonify(results), 200


@nurse_bp.route('/patients', methods=['POST'])
@jwt_required()
def create_patient():
    """Create a new patient (citizen or non-citizen)"""
    current_user_id = get_jwt_identity()
    data = request.get_json()
    
    # Check if patient already exists
    if data.get('omang'):
        existing = User.query.filter_by(omang=data['omang']).first()
        if existing:
            return jsonify({'error': 'Patient with this Omang already exists'}), 409
    
    if data.get('passport_number'):
        existing = Patient.query.filter_by(passport_number=data['passport_number']).first()
        if existing:
            return jsonify({'error': 'Patient with this passport number already exists'}), 409
    
    # Generate temporary PIN
    import random
    temp_pin = data.get('temp_pin') or f"{random.randint(1000, 9999)}"
    
    # Create user
    new_user = User(
        omang=data.get('omang'),
        full_name=data['full_name'],
        role=UserRole.PATIENT,
        gender=data.get('gender'),
        phone=data.get('phone'),
        email=data.get('email')
    )
    new_user.set_pin(temp_pin)
    
    db.session.add(new_user)
    db.session.flush()
    
    # Create patient record
    new_patient = Patient(
        user_id=new_user.id,
        omang=data.get('omang'),
        passport_number=data.get('passport_number'),
        date_of_birth=datetime.fromisoformat(data['date_of_birth']).date() if data.get('date_of_birth') else None,
        village=data.get('village'),
        district=data.get('district'),
        next_of_kin_name=data.get('next_of_kin_name'),
        next_of_kin_phone=data.get('next_of_kin_phone'),
        next_of_kin_relationship=data.get('next_of_kin_relationship'),
        medical_aid_number=data.get('medical_aid_number'),
        medical_aid_name=data.get('medical_aid_name'),
        nationality=data.get('nationality', 'Botswana'),
        address=data.get('address')
    )
    
    db.session.add(new_patient)
    db.session.commit()
    
    # Log activity
    UserActivityLog.log_action(
        user_id=current_user_id,
        action_type='PATIENT_CREATE',
        resource_type='Patient',
        resource_id=new_patient.id,
        resource_details={'full_name': data['full_name'], 'is_citizen': bool(data.get('omang'))},
        ip_address=request.remote_addr
    )
    
    return jsonify({
        'success': True,
        'message': 'Patient created successfully',
        'patient_id': new_patient.id,
        'patient_uuid': str(new_patient.uuid),
        'temp_pin': temp_pin
    }), 201


# ============ REFERRAL MANAGEMENT WITH AI ============

@nurse_bp.route('/referrals/analyze', methods=['POST'])
@jwt_required()
def analyze_referral():
    """Get AI priority suggestion for a referral"""
    data = request.get_json()
    reason = data.get('reason', '')
    
    if not reason:
        return jsonify({'error': 'Referral reason required'}), 400
    
    analysis = AIPriorityService.analyze_referral(
        reason=reason,
        clinical_summary=data.get('clinical_summary'),
        specialty_name=data.get('specialty'),
        patient_age=data.get('patient_age'),
        diagnosis=data.get('diagnosis'),
        symptoms=data.get('symptoms')
    )
    
    return jsonify(analysis), 200


@nurse_bp.route('/referrals', methods=['POST'])
@jwt_required()
def create_referral():
    """Create a new referral with AI priority suggestion"""
    current_user_id = get_jwt_identity()
    data = request.get_json()
    
    # Get nurse
    nurse = Nurse.query.filter_by(user_id=current_user_id).first()
    if not nurse:
        return jsonify({'error': 'Nurse profile not found'}), 404
    
    # Get patient
    patient = Patient.query.get(data.get('patient_id'))
    if not patient:
        return jsonify({'error': 'Patient not found'}), 404
    
    # Calculate patient age
    patient_age = None
    if patient.date_of_birth:
        today = date.today()
        dob = patient.date_of_birth
        patient_age = today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))
    
    # Get AI priority suggestion
    ai_analysis = AIPriorityService.analyze_referral(
        reason=data.get('reason', ''),
        clinical_summary=data.get('clinical_summary'),
        specialty_name=data.get('specialty_name'),
        patient_age=patient_age,
        diagnosis=data.get('diagnosis'),
        symptoms=data.get('symptoms')
    )
    
    # Generate referral number
    import uuid as uuid_lib
    referral_number = f"REF-{datetime.utcnow().strftime('%Y%m%d')}-{uuid_lib.uuid4().hex[:6].upper()}"
    
    # Create referral
    referral = Referral(
        referral_number=referral_number,
        patient_id=patient.id,
        referring_nurse_id=nurse.id,
        referring_facility_id=data.get('referring_facility_id') or nurse.facility_id,
        referred_to_facility_id=data.get('referred_to_facility_id'),
        reason=data.get('reason'),
        clinical_summary=data.get('clinical_summary'),
        diagnosis=data.get('diagnosis'),
        symptoms=data.get('symptoms'),
        priority=ai_analysis['priority'],
        status=ReferralStatus.PENDING,
        assigned_specialist_id=data.get('assigned_specialist_id'),
        duration_of_condition=data.get('duration_of_condition'),
        previous_treatment=data.get('previous_treatment')
    )
    
    db.session.add(referral)
    db.session.commit()
    
    # Log activity
    UserActivityLog.log_action(
        user_id=current_user_id,
        action_type='REFERRAL_CREATE',
        resource_type='Referral',
        resource_id=referral.id,
        resource_details={'referral_number': referral_number, 'priority': ai_analysis['priority']},
        ip_address=request.remote_addr
    )
    
    return jsonify({
        'success': True,
        'message': 'Referral created successfully',
        'referral_id': referral.id,
        'referral_number': referral_number,
        'ai_suggestion': {
            'priority': ai_analysis['priority'],
            'score': ai_analysis['score'],
            'confidence': ai_analysis['confidence'],
            'suggested_timeframe': ai_analysis['suggested_timeframe'],
            'reasoning': ai_analysis['reasoning']
        }
    }), 201


@nurse_bp.route('/referrals', methods=['GET'])
@jwt_required()
def get_referrals():
    """Get referrals with optional filters"""
    status = request.args.get('status')
    priority = request.args.get('priority')
    limit = request.args.get('limit', 50, type=int)
    
    query = Referral.query
    
    if status:
        query = query.filter_by(status=status)
    if priority:
        query = query.filter_by(priority=priority)
    
    referrals = query.order_by(Referral.created_at.desc()).limit(limit).all()
    
    results = []
    for ref in referrals:
        results.append({
            'id': ref.id,
            'referral_number': ref.referral_number,
            'patient_name': ref.patient_rel.user.full_name if ref.patient_rel else None,
            'reason': ref.reason[:200],
            'priority': ref.priority,
            'status': ref.status,
            'created_at': ref.created_at.isoformat()
        })
    
    return jsonify(results), 200


# ============ APPOINTMENT MANAGEMENT ============

@nurse_bp.route('/appointments/today', methods=['GET'])
@jwt_required()
def get_today_appointments():
    """Get today's appointments"""
    today = datetime.utcnow().date()
    tomorrow = today + timedelta(days=1)
    
    current_user_id = get_jwt_identity()
    nurse = Nurse.query.filter_by(user_id=current_user_id).first()
    
    query = Appointment.query.filter(
        Appointment.appointment_date >= today,
        Appointment.appointment_date < tomorrow
    )
    
    # If nurse has a facility, filter by facility
    if nurse and nurse.facility_id:
        query = query.join(Referral).filter(Referral.referred_to_facility_id == nurse.facility_id)
    
    appointments = query.order_by(Appointment.appointment_date.asc()).all()
    
    results = []
    for apt in appointments:
        results.append({
            'id': apt.id,
            'appointment_number': apt.appointment_number,
            'patient_name': apt.patient_rel.user.full_name if apt.patient_rel else None,
            'patient_id': apt.patient_id,
            'specialist_name': apt.specialist_rel.user.full_name if apt.specialist_rel else None,
            'appointment_date': apt.appointment_date.isoformat(),
            'status': apt.status,
            'checked_in': apt.checked_in
        })
    
    return jsonify(results), 200


@nurse_bp.route('/appointments/search', methods=['GET'])
@jwt_required()
def search_appointments():
    """Search for appointments by patient name or appointment number"""
    query = request.args.get('q', '')
    if len(query) < 2:
        return jsonify([]), 200
    
    search_pattern = f"%{query}%"
    
    appointments = Appointment.query.join(Patient).join(User).filter(
        or_(
            Appointment.appointment_number.ilike(search_pattern),
            User.full_name.ilike(search_pattern),
            User.omang.ilike(search_pattern)
        )
    ).limit(20).all()
    
    results = []
    for apt in appointments:
        results.append({
            'id': apt.id,
            'appointment_number': apt.appointment_number,
            'patient_name': apt.patient_rel.user.full_name if apt.patient_rel else None,
            'patient_id': apt.patient_id,
            'specialist_name': apt.specialist_rel.user.full_name if apt.specialist_rel else None,
            'appointment_date': apt.appointment_date.isoformat(),
            'status': apt.status,
            'checked_in': apt.checked_in
        })
    
    return jsonify(results), 200


# ============ PATIENT CHECK-IN ============

@nurse_bp.route('/appointments/<int:appointment_id>/checkin', methods=['POST'])
@jwt_required()
def check_in_patient(appointment_id):
    """Check in a patient for their appointment"""
    current_user_id = get_jwt_identity()
    data = request.get_json()
    
    nurse = Nurse.query.filter_by(user_id=current_user_id).first()
    if not nurse:
        return jsonify({'error': 'Nurse profile not found'}), 404
    
    result = CheckInService.check_in_patient(
        appointment_id=appointment_id,
        checked_in_by=nurse.id,
        vitals=data.get('vitals'),
        notes=data.get('notes')
    )
    
    if result['success']:
        # Log activity
        UserActivityLog.log_action(
            user_id=current_user_id,
            action_type='PATIENT_CHECK_IN',
            resource_type='Appointment',
            resource_id=appointment_id,
            resource_details={'waiting_number': result.get('waiting_number')},
            ip_address=request.remote_addr
        )
        return jsonify(result), 200
    else:
        return jsonify({'error': result['error']}), 400


@nurse_bp.route('/appointments/<int:appointment_id>/vitals', methods=['POST'])
@jwt_required()
def record_vitals(appointment_id):
    """Record patient vitals"""
    data = request.get_json()
    
    result = CheckInService.record_vitals(appointment_id, data.get('vitals', {}))
    
    if result['success']:
        return jsonify(result), 200
    else:
        return jsonify({'error': result['error']}), 400


@nurse_bp.route('/queue', methods=['GET'])
@jwt_required()
def get_waiting_queue():
    """Get current waiting queue"""
    date_str = request.args.get('date')
    queue_date = datetime.fromisoformat(date_str).date() if date_str else None
    
    result = CheckInService.get_waiting_queue(queue_date)
    return jsonify(result), 200


# ============ RESCHEDULE REQUESTS ============

@nurse_bp.route('/reschedule-requests', methods=['GET'])
@jwt_required()
def get_reschedule_requests():
    """Get all pending reschedule requests"""
    status = request.args.get('status', 'pending')
    
    requests = RescheduleRequest.query.filter_by(status=status).all()
    
    results = []
    for req in requests:
        results.append({
            'id': req.id,
            'request_number': req.request_number,
            'appointment_id': req.appointment_id,
            'appointment_number': req.appointment.appointment_number if req.appointment else None,
            'patient_name': req.patient.user.full_name if req.patient and req.patient.user else None,
            'current_appointment_date': req.appointment.appointment_date.isoformat() if req.appointment else None,
            'requested_date': req.requested_date.isoformat() if req.requested_date else None,
            'reason': req.reason,
            'additional_notes': req.additional_notes,
            'status': req.status,
            'created_at': req.created_at.isoformat()
        })
    
    return jsonify(results), 200


@nurse_bp.route('/reschedule-requests/<int:request_id>/approve', methods=['POST'])
@jwt_required()
def approve_reschedule_request(request_id):
    """Approve a reschedule request"""
    current_user_id = get_jwt_identity()
    data = request.get_json()
    
    nurse = Nurse.query.filter_by(user_id=current_user_id).first()
    if not nurse:
        return jsonify({'error': 'Nurse profile not found'}), 404
    
    reschedule_request = RescheduleRequest.query.get(request_id)
    if not reschedule_request:
        return jsonify({'error': 'Request not found'}), 404
    
    # Update appointment
    new_date = data.get('new_date')
    if new_date:
        reschedule_request.appointment.appointment_date = datetime.fromisoformat(new_date)
        reschedule_request.appointment.status = AppointmentStatus.SCHEDULED
        reschedule_request.appointment.updated_at = datetime.utcnow()
    
    # Update request status
    reschedule_request.status = 'approved'
    reschedule_request.reviewed_by = nurse.id
    reschedule_request.reviewed_at = datetime.utcnow()
    reschedule_request.review_notes = data.get('review_notes')
    
    # Notify patient
    if reschedule_request.patient and reschedule_request.patient.user:
        notification = Notification(
            user_id=reschedule_request.patient.user_id,
            type=NotificationType.RESCHEDULE_APPROVED,
            title='Reschedule Request Approved',
            message=f"Your appointment has been rescheduled to {reschedule_request.appointment.appointment_date.strftime('%B %d, %Y at %H:%M')}",
            data={
                'appointment_id': reschedule_request.appointment_id,
                'appointment_number': reschedule_request.appointment.appointment_number,
                'new_date': new_date
            },
            is_read=False
        )
        db.session.add(notification)
    
    db.session.commit()
    
    # Log activity
    UserActivityLog.log_action(
        user_id=current_user_id,
        action_type='RESCHEDULE_APPROVE',
        resource_type='RescheduleRequest',
        resource_id=request_id,
        ip_address=request.remote_addr
    )
    
    return jsonify({
        'success': True,
        'message': 'Reschedule request approved',
        'new_appointment_date': reschedule_request.appointment.appointment_date.isoformat()
    }), 200


@nurse_bp.route('/reschedule-requests/<int:request_id>/deny', methods=['POST'])
@jwt_required()
def deny_reschedule_request(request_id):
    """Deny a reschedule request"""
    current_user_id = get_jwt_identity()
    data = request.get_json()
    
    nurse = Nurse.query.filter_by(user_id=current_user_id).first()
    if not nurse:
        return jsonify({'error': 'Nurse profile not found'}), 404
    
    reschedule_request = RescheduleRequest.query.get(request_id)
    if not reschedule_request:
        return jsonify({'error': 'Request not found'}), 404
    
    reschedule_request.status = 'denied'
    reschedule_request.reviewed_by = nurse.id
    reschedule_request.reviewed_at = datetime.utcnow()
    reschedule_request.review_notes = data.get('review_notes')
    
    # Notify patient
    if reschedule_request.patient and reschedule_request.patient.user:
        notification = Notification(
            user_id=reschedule_request.patient.user_id,
            type=NotificationType.RESCHEDULE_DENIED,
            title='Reschedule Request Denied',
            message=data.get('reason', 'Your reschedule request was not approved. Please contact the hospital for assistance.'),
            data={'appointment_id': reschedule_request.appointment_id},
            is_read=False
        )
        db.session.add(notification)
    
    db.session.commit()
    
    # Log activity
    UserActivityLog.log_action(
        user_id=current_user_id,
        action_type='RESCHEDULE_DENY',
        resource_type='RescheduleRequest',
        resource_id=request_id,
        ip_address=request.remote_addr
    )
    
    return jsonify({
        'success': True,
        'message': 'Reschedule request denied'
    }), 200


# ============ SPECIALIST SCHEDULE VIEW ============

@nurse_bp.route('/specialists', methods=['GET'])
@jwt_required()
def get_specialists():
    """Get list of specialists for scheduling"""
    specialty_id = request.args.get('specialty_id', type=int)
    facility_id = request.args.get('facility_id', type=int)
    
    query = Specialist.query.filter_by(is_available=True)
    
    if specialty_id:
        query = query.filter_by(specialty_id=specialty_id)
    if facility_id:
        query = query.filter_by(facility_id=facility_id)
    
    specialists = query.all()
    
    results = []
    for spec in specialists:
        results.append({
            'id': spec.id,
            'uuid': str(spec.uuid),
            'full_name': spec.user.full_name if spec.user else None,
            'specialty': spec.specialty_rel.name if spec.specialty_rel else None,
            'specialty_id': spec.specialty_id,
            'sub_specialty': spec.sub_specialty,
            'consultation_duration': spec.consultation_duration,
            'max_patients_per_day': spec.max_patients_per_day,
            'facility_id': spec.facility_id
        })
    
    return jsonify(results), 200


@nurse_bp.route('/specialists/<int:specialist_id>/schedule', methods=['GET'])
@jwt_required()
def get_specialist_schedule(specialist_id):
    """Get specialist's schedule for a given week"""
    week_start_str = request.args.get('week_start')
    
    if week_start_str:
        week_start = datetime.fromisoformat(week_start_str).date()
    else:
        week_start = datetime.utcnow().date()
        # Adjust to Monday
        week_start = week_start - timedelta(days=week_start.weekday())
    
    # Get recurring schedule
    from models import SpecialistSchedule
    schedules = SpecialistSchedule.query.filter_by(
        specialist_id=specialist_id,
        is_active=True
    ).all()
    
    # Build week schedule
    week_schedule = []
    for day_offset in range(7):
        current_date = week_start + timedelta(days=day_offset)
        day_of_week = current_date.weekday()  # 0=Monday
        
        day_schedule = {
            'date': current_date.isoformat(),
            'day_name': current_date.strftime('%A'),
            'slots': []
        }
        
        # Find schedule for this day
        day_schedule_config = next((s for s in schedules if s.day_of_week == day_of_week), None)
        
        if day_schedule_config:
            # Generate time slots
            current_time = datetime.combine(current_date, day_schedule_config.start_time)
            end_time = datetime.combine(current_date, day_schedule_config.end_time)
            
            while current_time < end_time:
                slot_end = current_time + timedelta(minutes=30)
                
                # Check if slot is booked
                is_booked = Appointment.query.filter(
                    Appointment.specialist_id == specialist_id,
                    Appointment.appointment_date >= current_time,
                    Appointment.appointment_date < slot_end,
                    Appointment.status != AppointmentStatus.CANCELLED
                ).first() is not None
                
                day_schedule['slots'].append({
                    'start_time': current_time.isoformat(),
                    'end_time': slot_end.isoformat(),
                    'is_available': not is_booked
                })
                
                current_time = slot_end
        
        week_schedule.append(day_schedule)
    
    return jsonify({
        'specialist_id': specialist_id,
        'week_start': week_start.isoformat(),
        'schedule': week_schedule
    }), 200


@nurse_bp.route('/appointments', methods=['POST'])
@jwt_required()
def create_appointment():
    """Create a new appointment for a referral"""
    current_user_id = get_jwt_identity()
    data = request.get_json()
    
    # Get nurse
    nurse = Nurse.query.filter_by(user_id=current_user_id).first()
    if not nurse:
        return jsonify({'error': 'Nurse profile not found'}), 404
    
    # Get referral
    referral = Referral.query.get(data.get('referral_id'))
    if not referral:
        return jsonify({'error': 'Referral not found'}), 404
    
    # Get specialist
    specialist = Specialist.query.get(data.get('specialist_id'))
    if not specialist:
        return jsonify({'error': 'Specialist not found'}), 404
    
    # Check for conflicts
    appointment_datetime = datetime.fromisoformat(data['appointment_datetime'])
    
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
    
    # Create appointment
    appointment = Appointment(
        appointment_number=appointment_number,
        referral_id=referral.id,
        patient_id=referral.patient_id,
        specialist_id=specialist.id,
        appointment_date=appointment_datetime,
        duration=data.get('duration', 30),
        end_time=appointment_datetime + timedelta(minutes=data.get('duration', 30)),
        status=AppointmentStatus.SCHEDULED,
        created_by=current_user_id
    )
    
    # Update referral status
    referral.status = ReferralStatus.SCHEDULED
    
    db.session.add(appointment)
    db.session.commit()
    
    # Create notification for patient
    if referral.patient_rel and referral.patient_rel.user:
        notification = Notification(
            user_id=referral.patient_rel.user_id,
            type=NotificationType.APPOINTMENT_SCHEDULED,
            title='Appointment Scheduled',
            message=f"Your appointment with {specialist.user.full_name if specialist.user else 'specialist'} is scheduled for {appointment_datetime.strftime('%B %d, %Y at %H:%M')}",
            data={'appointment_id': appointment.id, 'appointment_number': appointment_number},
            is_read=False
        )
        db.session.add(notification)
        db.session.commit()
    
    # Log activity
    UserActivityLog.log_action(
        user_id=current_user_id,
        action_type='APPOINTMENT_CREATE',
        resource_type='Appointment',
        resource_id=appointment.id,
        resource_details={'appointment_number': appointment_number, 'specialist_id': specialist.id},
        ip_address=request.remote_addr
    )
    
    return jsonify({
        'success': True,
        'message': 'Appointment created successfully',
        'appointment_id': appointment.id,
        'appointment_number': appointment_number
    }), 201