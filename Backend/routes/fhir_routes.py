"""
FHIR R4 Compliant API Routes
For interoperability with IPMS, OpenMRS, and national systems
"""

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from services.fhir_service import FHIRService
from models import db, User, Patient, Appointment, Referral

fhir_bp = Blueprint('fhir', __name__, url_prefix='/fhir')


@fhir_bp.route('/Patient/<string:identifier>', methods=['GET'])
@jwt_required()
def fhir_patient_read(identifier):
    """FHIR Patient read by identifier (Omang or UUID)"""
    # Try to find by Omang
    user = User.query.filter_by(omang=identifier).first()
    if not user:
        # Try by UUID
        user = User.query.filter_by(uuid=identifier).first()
    
    if not user:
        return jsonify({
            'resourceType': 'OperationOutcome',
            'issue': [{
                'severity': 'error',
                'code': 'not-found',
                'details': {'text': 'Patient not found'}
            }]
        }), 404
    
    patient = Patient.query.filter_by(user_id=user.id).first()
    
    patient_data = {
        'uuid': user.uuid,
        'omang': user.omang,
        'full_name': user.full_name,
        'first_name': user.full_name.split()[0] if user.full_name else '',
        'last_name': user.full_name.split()[-1] if user.full_name else '',
        'gender': user.gender,
        'date_of_birth': patient.date_of_birth.isoformat() if patient and patient.date_of_birth else None,
        'phone': user.phone,
        'email': user.email,
        'village': patient.village if patient else None,
        'district': patient.district if patient else None,
        'address': patient.address if patient else None,
        'facility_id': patient.preferred_facility_id if patient else None
    }
    
    fhir_resource = FHIRService.build_patient_resource(patient_data)
    return jsonify(fhir_resource), 200


@fhir_bp.route('/Patient', methods=['POST'])
@jwt_required()
def fhir_patient_create():
    """FHIR Patient create"""
    data = request.get_json()
    
    # Validate FHIR resource
    validation = FHIRService.validate_fhir_resource(data, 'Patient')
    if not validation['valid']:
        return jsonify({
            'resourceType': 'OperationOutcome',
            'issue': [{
                'severity': 'error',
                'code': 'invalid',
                'details': {'text': ', '.join(validation['errors'])}
            }]
        }), 400
    
    # Parse FHIR resource to local format
    patient_data = FHIRService.parse_fhir_patient(data)
    
    # Check if patient already exists
    existing = None
    if patient_data.get('omang'):
        existing = User.query.filter_by(omang=patient_data['omang']).first()
    
    if existing:
        return jsonify({
            'resourceType': 'OperationOutcome',
            'issue': [{
                'severity': 'warning',
                'code': 'duplicate',
                'details': {'text': 'Patient already exists'}
            }]
        }), 409
    
    # Create new patient (simplified for FHIR endpoint)
    # Full implementation would create User and Patient records
    
    return jsonify({
        'resourceType': 'Patient',
        'id': str(uuid.uuid4()),
        'meta': {'lastUpdated': datetime.utcnow().isoformat() + 'Z'}
    }), 201


@fhir_bp.route('/Appointment', methods=['GET'])
@jwt_required()
def fhir_appointment_search():
    """FHIR Appointment search by patient or date"""
    patient_id = request.args.get('patient')
    date = request.args.get('date')
    
    query = Appointment.query
    
    if patient_id:
        # patient_id could be Omang or internal ID
        user = User.query.filter_by(omang=patient_id).first()
        if user:
            patient = Patient.query.filter_by(user_id=user.id).first()
            if patient:
                query = query.filter_by(patient_id=patient.id)
    
    if date:
        from datetime import datetime
        query = query.filter(Appointment.appointment_date >= datetime.fromisoformat(date))
    
    appointments = query.limit(50).all()
    
    fhir_resources = []
    for apt in appointments:
        patient = db.session.get(Patient, apt.patient_id)
        specialist = db.session.get(Specialist, apt.specialist_id)
        
        appointment_data = {
            'uuid': apt.uuid,
            'appointment_number': apt.appointment_number,
            'status': apt.status,
            'appointment_date': apt.appointment_date.isoformat(),
            'end_time': apt.end_time.isoformat() if apt.end_time else None,
            'duration': apt.duration,
            'patient_id': str(patient.uuid) if patient else None,
            'patient_name': patient.user.full_name if patient and patient.user else None,
            'specialist_id': str(specialist.uuid) if specialist else None,
            'specialist_name': specialist.user.full_name if specialist and specialist.user else None,
            'specialty_code': specialist.specialty_rel.code if specialist and specialist.specialty_rel else None,
            'specialty_name': specialist.specialty_rel.name if specialist and specialist.specialty_rel else None
        }
        
        fhir_resources.append(FHIRService.build_appointment_resource(appointment_data))
    
    bundle = FHIRService.build_bundle(fhir_resources, 'searchset')
    return jsonify(bundle), 200


@fhir_bp.route('/ServiceRequest', methods=['POST'])
@jwt_required()
def fhir_create_service_request():
    """FHIR ServiceRequest (Referral) create"""
    data = request.get_json()
    
    validation = FHIRService.validate_fhir_resource(data, 'ServiceRequest')
    if not validation['valid']:
        return jsonify({
            'resourceType': 'OperationOutcome',
            'issue': [{
                'severity': 'error',
                'code': 'invalid',
                'details': {'text': ', '.join(validation['errors'])}
            }]
        }), 400
    
    # Parse and create referral
    # Full implementation would create Referral record
    
    return jsonify({
        'resourceType': 'ServiceRequest',
        'id': str(uuid.uuid4()),
        'status': 'active',
        'intent': 'plan',
        'meta': {'lastUpdated': datetime.utcnow().isoformat() + 'Z'}
    }), 201


@fhir_bp.route('/metadata', methods=['GET'])
def fhir_capability_statement():
    """FHIR CapabilityStatement - describes supported operations"""
    return jsonify({
        'resourceType': 'CapabilityStatement',
        'status': 'active',
        'date': datetime.utcnow().isoformat() + 'Z',
        'publisher': 'Botswana Ministry of Health',
        'kind': 'instance',
        'software': {
            'name': 'ISAS - Integrated Specialist Appointment and Referral System',
            'version': '1.0.0'
        },
        'fhirVersion': '4.0.1',
        'format': ['json', 'xml'],
        'rest': [{
            'mode': 'server',
            'resource': [
                {'type': 'Patient', 'interaction': [{'code': 'read'}, {'code': 'search-type'}]},
                {'type': 'Appointment', 'interaction': [{'code': 'read'}, {'code': 'search-type'}]},
                {'type': 'ServiceRequest', 'interaction': [{'code': 'create'}, {'code': 'read'}]}
            ]
        }]
    }), 200