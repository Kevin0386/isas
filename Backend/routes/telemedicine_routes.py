"""
Telemedicine Routes for Virtual Consultations
"""

from flask import Blueprint, request, jsonify, render_template
from flask_jwt_extended import jwt_required, get_jwt_identity
from services.telemedicine_service import TelemedicineService, RemotePatientMonitoring
from models import db, Appointment, Patient, User, Specialist, Notification

telemedicine_bp = Blueprint('telemedicine', __name__, url_prefix='/api/telemedicine')

# Initialize telemedicine service
telemedicine_service = TelemedicineService(provider='daily')


@telemedicine_bp.route('/session/create', methods=['POST'])
@jwt_required()
def create_telemedicine_session():
    """Create a new telemedicine session for an appointment"""
    claims = get_jwt()
    if claims.get('role') not in ['head_nurse', 'specialist', 'admin']:
        return jsonify({'error': 'Forbidden'}), 403
    
    data = request.get_json()
    appointment_id = data.get('appointment_id')
    
    appointment = db.session.get(Appointment, appointment_id)
    if not appointment:
        return jsonify({'error': 'Appointment not found'}), 404
    
    patient = db.session.get(Patient, appointment.patient_id)
    specialist = db.session.get(Specialist, appointment.specialist_id)
    
    if not patient or not specialist:
        return jsonify({'error': 'Patient or specialist not found'}), 404
    
    # Check if session already exists
    existing = telemedicine_service.get_session_by_appointment(appointment_id)
    if existing:
        return jsonify({
            'session_id': existing.id,
            'room_url': existing.room_url,
            'specialist_join_url': existing.specialist_join_url,
            'patient_join_url': existing.patient_join_url,
            'status': existing.status
        }), 200
    
    # Create new session
    session = telemedicine_service.create_session(
        appointment_id=appointment_id,
        patient_name=patient.user.full_name,
        specialist_name=specialist.user.full_name,
        scheduled_start=appointment.appointment_date,
        duration_minutes=appointment.duration or 30
    )
    
    # Update appointment to indicate telemedicine
    appointment.is_telemedicine = True  # You may need to add this column
    
    # Notify patient
    notification = Notification(
        user_id=patient.user_id,
        type='telemedicine_session',
        title='Virtual Consultation Scheduled',
        message=f'Your virtual consultation with Dr. {specialist.user.full_name} has been scheduled. Click the link to join.',
        data={
            'join_url': session.patient_join_url,
            'session_id': session.id,
            'appointment_id': appointment_id,
            'scheduled_start': session.scheduled_start.isoformat()
        }
    )
    db.session.add(notification)
    db.session.commit()
    
    return jsonify({
        'success': True,
        'session_id': session.id,
        'room_url': session.room_url,
        'specialist_join_url': session.specialist_join_url,
        'patient_join_url': session.patient_join_url,
        'scheduled_start': session.scheduled_start.isoformat(),
        'scheduled_end': session.scheduled_end.isoformat(),
        'meeting_password': session.meeting_password
    }), 201


@telemedicine_bp.route('/session/<session_id>/join', methods=['GET'])
@jwt_required()
def get_join_link(session_id):
    """Get join link for a telemedicine session"""
    user_id = get_jwt_identity()
    user = db.session.get(User, user_id)
    
    session = telemedicine_service.get_session(session_id)
    if not session:
        return jsonify({'error': 'Session not found'}), 404
    
    # Determine user role
    if user.role == 'specialist':
        join_data = telemedicine_service.generate_join_token(session_id, 'specialist')
    elif user.role == 'patient':
        join_data = telemedicine_service.generate_join_token(session_id, 'patient')
    else:
        return jsonify({'error': 'Unauthorized'}), 403
    
    return jsonify(join_data), 200


@telemedicine_bp.route('/session/<session_id>/status', methods=['PUT'])
@jwt_required()
def update_session_status(session_id):
    """Update telemedicine session status"""
    data = request.get_json()
    status = data.get('status')
    
    valid_statuses = ['active', 'completed', 'cancelled']
    if status not in valid_statuses:
        return jsonify({'error': f'Invalid status. Must be one of {valid_statuses}'}), 400
    
    if status == 'completed':
        telemedicine_service.end_session(session_id)
    elif status == 'cancelled':
        telemedicine_service.cancel_session(session_id)
    else:
        telemedicine_service.update_session_status(session_id, status)
    
    return jsonify({'success': True, 'status': status}), 200


@telemedicine_bp.route('/sessions/active', methods=['GET'])
@jwt_required()
def get_active_sessions():
    """Get active sessions for current specialist"""
    claims = get_jwt()
    if claims.get('role') != 'specialist':
        return jsonify({'error': 'Forbidden'}), 403
    
    user_id = get_jwt_identity()
    specialist = Specialist.query.filter_by(user_id=user_id).first()
    
    if not specialist:
        return jsonify({'error': 'Specialist not found'}), 404
    
    active = telemedicine_service.get_active_sessions_for_specialist(specialist.id)
    return jsonify(active), 200


@telemedicine_bp.route('/vitals/validate', methods=['POST'])
@jwt_required()
def validate_vital():
    """Validate a vital sign reading"""
    data = request.get_json()
    vital_name = data.get('vital_name')
    value = data.get('value')
    
    if not vital_name or value is None:
        return jsonify({'error': 'Vital name and value required'}), 400
    
    result = RemotePatientMonitoring.validate_vital(vital_name, float(value))
    return jsonify(result), 200


@telemedicine_bp.route('/patient/<int:patient_id>/vitals/trend', methods=['GET'])
@jwt_required()
def get_vital_trends(patient_id):
    """Get vital sign trends for a patient"""
    claims = get_jwt()
    role = claims.get('role')
    
    # Verify access
    if role == 'patient':
        current_patient = Patient.query.filter_by(user_id=get_jwt_identity()).first()
        if not current_patient or current_patient.id != patient_id:
            return jsonify({'error': 'Unauthorized'}), 403
    
    # Get vital readings for patient
    # In production, this would query a vital_readings table
    # For MVP, return mock data
    mock_readings = [
        {
            'recorded_at': datetime.utcnow() - timedelta(days=30),
            'vitals': {'blood_pressure_systolic': 125, 'blood_pressure_diastolic': 82, 'heart_rate': 72}
        },
        {
            'recorded_at': datetime.utcnow() - timedelta(days=20),
            'vitals': {'blood_pressure_systolic': 128, 'blood_pressure_diastolic': 84, 'heart_rate': 75}
        },
        {
            'recorded_at': datetime.utcnow() - timedelta(days=10),
            'vitals': {'blood_pressure_systolic': 130, 'blood_pressure_diastolic': 85, 'heart_rate': 78}
        },
        {
            'recorded_at': datetime.utcnow(),
            'vitals': {'blood_pressure_systolic': 132, 'blood_pressure_diastolic': 86, 'heart_rate': 80}
        }
    ]
    
    analysis = RemotePatientMonitoring.generate_trend_analysis(mock_readings)
    return jsonify(analysis), 200


@telemedicine_bp.route('/room/<session_id>', methods=['GET'])
def telemedicine_room(session_id):
    """Render telemedicine room HTML (for testing)"""
    session = telemedicine_service.get_session(session_id)
    if not session:
        return "Session not found", 404
    
    return render_template('telemedicine_room.html', session=session)