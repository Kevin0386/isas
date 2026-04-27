"""
Analytics Routes for Population Health Management
"""

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from services.analytics_service import AnalyticsService
from models import db, Referral, Appointment, Patient, User, Specialist, Facility

analytics_bp = Blueprint('analytics', __name__, url_prefix='/api/analytics')


@analytics_bp.route('/referral-network', methods=['GET'])
@jwt_required()
def get_referral_network():
    """Get referral network analysis"""
    claims = get_jwt()
    if claims.get('role') not in ['admin', 'head_nurse']:
        return jsonify({'error': 'Forbidden'}), 403
    
    # Get referral data
    referrals = Referral.query.all()
    
    referral_data = []
    for ref in referrals:
        referring_facility = db.session.get(Facility, ref.referring_facility_id)
        referred_facility = db.session.get(Facility, ref.referred_to_facility_id)
        
        # Calculate waiting time
        apt = Appointment.query.filter_by(referral_id=ref.id).first()
        waiting_days = None
        if apt and apt.appointment_date:
            waiting_days = (apt.appointment_date - ref.created_at).days
        
        referral_data.append({
            'referring_facility_name': referring_facility.name if referring_facility else 'Unknown',
            'referred_to_facility_name': referred_facility.name if referred_facility else 'Unknown',
            'priority': ref.priority,
            'waiting_days': waiting_days,
            'created_at': ref.created_at
        })
    
    result = AnalyticsService.analyze_referral_network(referral_data)
    return jsonify(result), 200


@analytics_bp.route('/bottlenecks', methods=['GET'])
@jwt_required()
def get_bottlenecks():
    """Identify bottlenecks in referral process"""
    claims = get_jwt()
    if claims.get('role') not in ['admin', 'head_nurse']:
        return jsonify({'error': 'Forbidden'}), 403
    
    # Get referrals with assignment data
    referrals = Referral.query.all()
    referral_data = []
    for ref in referrals:
        referral_data.append({
            'created_at': ref.created_at,
            'assigned_at': ref.approved_at if hasattr(ref, 'approved_at') else None
        })
    
    # Get appointments with completion data
    appointments = Appointment.query.all()
    appointment_data = []
    for apt in appointments:
        referral = db.session.get(Referral, apt.referral_id)
        appointment_data.append({
            'appointment_date': apt.appointment_date,
            'completed_at': apt.updated_at if apt.status == 'completed' else None,
            'referral_created_at': referral.created_at if referral else None
        })
    
    result = AnalyticsService.identify_bottlenecks(referral_data, appointment_data)
    return jsonify(result), 200


@analytics_bp.route('/seasonal-trends', methods=['GET'])
@jwt_required()
def get_seasonal_trends():
    """Get seasonal referral volume trends"""
    claims = get_jwt()
    if claims.get('role') not in ['admin', 'head_nurse']:
        return jsonify({'error': 'Forbidden'}), 403
    
    referrals = Referral.query.all()
    referral_data = []
    for ref in referrals:
        referral_data.append({
            'created_at': ref.created_at,
            'priority': ref.priority
        })
    
    result = AnalyticsService.analyze_seasonal_trends(referral_data)
    return jsonify(result), 200


@analytics_bp.route('/heatmap', methods=['GET'])
@jwt_required()
def get_heatmap_data():
    """Get geographic heatmap data for referral origins"""
    claims = get_jwt()
    if claims.get('role') not in ['admin', 'head_nurse']:
        return jsonify({'error': 'Forbidden'}), 403
    
    referrals = Referral.query.all()
    referral_data = []
    for ref in referrals:
        patient = db.session.get(Patient, ref.patient_id)
        if patient:
            referral_data.append({
                'patient_district': patient.district,
                'patient_village': patient.village
            })
    
    result = AnalyticsService.generate_heatmap_data(referral_data)
    return jsonify(result), 200


@analytics_bp.route('/specialist-utilization', methods=['GET'])
@jwt_required()
def get_specialist_utilization():
    """Get specialist utilization metrics"""
    claims = get_jwt()
    if claims.get('role') not in ['admin', 'head_nurse']:
        return jsonify({'error': 'Forbidden'}), 403
    
    # Get specialists
    specialists = Specialist.query.all()
    specialist_data = []
    for spec in specialists:
        specialist_data.append({
            'id': spec.id,
            'name': spec.user.full_name if spec.user else 'Unknown',
            'specialty': spec.specialty_rel.name if spec.specialty_rel else 'Unknown',
            'max_patients_per_day': spec.max_patients_per_day or 15
        })
    
    # Get appointments
    appointments = Appointment.query.all()
    appointment_data = []
    for apt in appointments:
        appointment_data.append({
            'specialist_id': apt.specialist_id,
            'status': apt.status
        })
    
    result = AnalyticsService.calculate_specialist_utilization(specialist_data, appointment_data)
    return jsonify(result), 200


@analytics_bp.route('/export/<format>', methods=['GET'])
@jwt_required()
def export_analytics(format):
    """Export analytics data in CSV or JSON format"""
    claims = get_jwt()
    if claims.get('role') != 'admin':
        return jsonify({'error': 'Forbidden'}), 403
    
    report_type = request.args.get('type', 'bottlenecks')
    
    if report_type == 'bottlenecks':
        referrals = Referral.query.all()
        referral_data = [{'created_at': r.created_at} for r in referrals]
        appointments = Appointment.query.all()
        appointment_data = [{'appointment_date': a.appointment_date, 'referral_created_at': a.referral_rel.created_at if a.referral_rel else None} for a in appointments]
        data = AnalyticsService.identify_bottlenecks(referral_data, appointment_data)
    elif report_type == 'specialist_utilization':
        specialists = Specialist.query.all()
        specialist_data = [{'id': s.id, 'name': s.user.full_name, 'specialty': s.specialty_rel.name if s.specialty_rel else None, 'max_patients_per_day': s.max_patients_per_day or 15} for s in specialists]
        appointments = Appointment.query.all()
        appointment_data = [{'specialist_id': a.specialist_id, 'status': a.status} for a in appointments]
        data = AnalyticsService.calculate_specialist_utilization(specialist_data, appointment_data)
    else:
        return jsonify({'error': 'Invalid report type'}), 400
    
    if format == 'json':
        return jsonify(data), 200
    elif format == 'csv':
        import csv
        from io import StringIO
        
        output = StringIO()
        if report_type == 'bottlenecks':
            writer = csv.writer(output)
            writer.writerow(['Stage', 'Avg Delay Days', 'Max Delay Days', '95th Percentile', 'Volume'])
            for b in data.get('bottlenecks', []):
                writer.writerow([b['stage'], b['avg_delay_days'], b['max_delay_days'], b['p95_delay_days'], b['volume']])
        elif report_type == 'specialist_utilization':
            writer = csv.writer(output)
            writer.writerow(['Specialist', 'Specialty', 'Total Appointments', 'Completion Rate', 'Utilization Rate', 'Status'])
            for s in data.get('specialists', []):
                writer.writerow([s['name'], s['specialty'], s['total_appointments'], s['completion_rate'], s['utilization_rate'], s['utilization_status']])
        
        output.seek(0)
        from flask import make_response
        response = make_response(output.getvalue())
        response.headers['Content-Type'] = 'text/csv'
        response.headers['Content-Disposition'] = f'attachment; filename={report_type}_report.csv'
        return response
    else:
        return jsonify({'error': 'Invalid format'}), 400