"""
AI-Powered Routes for Referral Triage and Quality Scoring
"""

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from services.ai_triage_service import AITriageService
from services.noshow_prediction_service import NoShowPredictionService
from models import db, Referral, Appointment, Patient, User

ai_bp = Blueprint('ai', __name__, url_prefix='/api/ai')


@ai_bp.route('/referral/analyze', methods=['POST'])
@jwt_required()
def analyze_referral_quality():
    """Analyze referral quality and provide AI recommendations"""
    data = request.get_json()
    
    result = AITriageService.analyze_referral_quality(
        reason=data.get('reason', ''),
        clinical_summary=data.get('clinical_summary'),
        diagnosis=data.get('diagnosis'),
        symptoms=data.get('symptoms'),
        specialty=data.get('specialty')
    )
    
    return jsonify({
        'completeness_score': result.completeness_score,
        'missing_fields': result.missing_fields,
        'specialty_match': result.specialty_match,
        'recommendations': result.quality_recommendations,
        'suggested_priority': result.suggested_priority,
        'urgency_indicators': result.urgency_indicators
    }), 200


@ai_bp.route('/referral/template/<specialty>', methods=['GET'])
@jwt_required()
def get_referral_template(specialty):
    """Get structured referral template for a specialty"""
    template = AITriageService.generate_referral_template(specialty)
    return jsonify(template), 200


@ai_bp.route('/appointment/<int:appointment_id>/no-show-risk', methods=['GET'])
@jwt_required()
def predict_no_show_risk(appointment_id):
    """Predict no-show risk for an appointment"""
    appointment = db.session.get(Appointment, appointment_id)
    if not appointment:
        return jsonify({'error': 'Appointment not found'}), 404
    
    patient = db.session.get(Patient, appointment.patient_id)
    patient_user = db.session.get(User, patient.user_id) if patient else None
    
    # Calculate previous no-shows
    previous_appointments = Appointment.query.filter_by(patient_id=patient.id).all()
    previous_no_shows = len([a for a in previous_appointments if a.status == 'missed'])
    
    # Get travel distance (could be calculated from patient village to facility)
    travel_distance = 10  # Default, could be calculated using GIS
    
    appointment_data = {
        'appointment_date': appointment.appointment_date,
        'created_at': appointment.created_at,
        'patient_id': patient.id,
        'appointment_type': 'follow_up' if appointment.referral_rel else 'new_patient',
        'travel_distance_km': travel_distance,
        'communication_preference': 'sms',  # Could come from patient preferences
        'previous_no_shows': previous_no_shows,
        'total_appointments': len(previous_appointments),
        'patient_age': patient.age if hasattr(patient, 'age') else None
    }
    
    prediction = NoShowPredictionService.predict_no_show_risk(appointment_data)
    
    return jsonify({
        'appointment_id': appointment_id,
        'risk_score': prediction.risk_score,
        'risk_level': prediction.risk_level,
        'top_factors': prediction.top_factors,
        'recommended_action': prediction.recommended_action,
        'confidence_interval': prediction.confidence_interval
    }), 200


@ai_bp.route('/appointments/high-risk', methods=['GET'])
@jwt_required()
def get_high_risk_appointments():
    """Get all high-risk appointments for a nurse's department"""
    claims = get_jwt()
    if claims.get('role') not in ['head_nurse', 'admin']:
        return jsonify({'error': 'Forbidden'}), 403
    
    # Get appointments for next 30 days
    from datetime import datetime, timedelta
    start_date = datetime.utcnow()
    end_date = start_date + timedelta(days=30)
    
    appointments = Appointment.query.filter(
        Appointment.appointment_date >= start_date,
        Appointment.appointment_date <= end_date,
        Appointment.status.in_(['scheduled', 'confirmed'])
    ).all()
    
    high_risk = []
    for apt in appointments:
        # Simple risk calculation without full service for batch
        lead_time = (apt.appointment_date - apt.created_at).days
        risk_score = min(0.3 + (lead_time - 30) * 0.01, 0.8) if lead_time > 30 else 0.15
        
        if risk_score > 0.6:
            patient = db.session.get(Patient, apt.patient_id)
            high_risk.append({
                'appointment_id': apt.id,
                'appointment_number': apt.appointment_number,
                'patient_name': patient.user.full_name if patient else 'Unknown',
                'appointment_date': apt.appointment_date.isoformat(),
                'risk_score': round(risk_score, 2),
                'lead_time_days': lead_time
            })
    
    return jsonify({
        'high_risk_appointments': sorted(high_risk, key=lambda x: x['risk_score'], reverse=True),
        'total_high_risk': len(high_risk)
    }), 200