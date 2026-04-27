"""
FHIR R4 Compliant Service
Based on Botswana-specific FHIR Implementation Guide by Jembi Health Systems
Supports integration with IPMS, OpenMRS, and national lab systems
"""

import uuid
from datetime import datetime
from typing import Dict, List, Optional, Any
from flask import jsonify

class FHIRService:
    """
    FHIR R4 compliant service for healthcare interoperability
    Implements core resources: Patient, Appointment, ServiceRequest (Referral)
    """
    
    # Botswana-specific identifier systems
    IDENTIFIER_SYSTEMS = {
        'omang': 'http://health.gov.bw/identifier/omang',
        'passport': 'http://health.gov.bw/identifier/passport',
        'national_patient_id': 'http://health.gov.bw/identifier/npid',
        'facility_code': 'http://health.gov.bw/identifier/facility',
        'specialist_reg': 'http://health.gov.bw/identifier/specialist-reg'
    }
    
    @classmethod
    def build_patient_resource(cls, patient_data: Dict) -> Dict:
        """
        Build FHIR Patient resource from local patient data
        
        https://hl7.org/fhir/R4/patient.html
        """
        patient = {
            "resourceType": "Patient",
            "id": str(patient_data.get('uuid', uuid.uuid4())),
            "identifier": [],
            "active": True,
            "name": [],
            "telecom": [],
            "gender": cls._map_gender(patient_data.get('gender')),
            "birthDate": patient_data.get('date_of_birth'),
            "address": [],
            "managingOrganization": {
                "reference": f"Organization/{patient_data.get('facility_id', 'unknown')}"
            }
        }
        
        # Add Omang identifier
        if patient_data.get('omang'):
            patient['identifier'].append({
                "system": cls.IDENTIFIER_SYSTEMS['omang'],
                "value": patient_data['omang'],
                "type": {
                    "coding": [{
                        "system": "http://terminology.hl7.org/CodeSystem/v2-0203",
                        "code": "NI",
                        "display": "National unique identifier"
                    }]
                }
            })
        
        # Add passport identifier
        if patient_data.get('passport_number'):
            patient['identifier'].append({
                "system": cls.IDENTIFIER_SYSTEMS['passport'],
                "value": patient_data['passport_number'],
                "type": {
                    "coding": [{
                        "system": "http://terminology.hl7.org/CodeSystem/v2-0203",
                        "code": "PPN",
                        "display": "Passport number"
                    }]
                }
            })
        
        # Add name
        patient['name'].append({
            "use": "official",
            "text": patient_data.get('full_name', ''),
            "family": patient_data.get('last_name', ''),
            "given": [patient_data.get('first_name', '')] if patient_data.get('first_name') else []
        })
        
        # Add telecom
        if patient_data.get('phone'):
            patient['telecom'].append({
                "system": "phone",
                "value": patient_data['phone'],
                "use": "mobile"
            })
        
        if patient_data.get('email'):
            patient['telecom'].append({
                "system": "email",
                "value": patient_data['email'],
                "use": "home"
            })
        
        # Add address
        if patient_data.get('village') or patient_data.get('district'):
            address = {"use": "home"}
            if patient_data.get('village'):
                address['city'] = patient_data['village']
            if patient_data.get('district'):
                address['district'] = patient_data['district']
            if patient_data.get('address'):
                address['text'] = patient_data['address']
            patient['address'].append(address)
        
        return patient
    
    @classmethod
    def build_appointment_resource(cls, appointment_data: Dict) -> Dict:
        """
        Build FHIR Appointment resource
        
        https://hl7.org/fhir/R4/appointment.html
        """
        appointment = {
            "resourceType": "Appointment",
            "id": str(appointment_data.get('uuid', uuid.uuid4())),
            "identifier": [{
                "system": "http://health.gov.bw/identifier/appointment",
                "value": appointment_data.get('appointment_number', '')
            }],
            "status": cls._map_appointment_status(appointment_data.get('status', 'scheduled')),
            "serviceType": [{
                "coding": [{
                    "system": "http://snomed.info/sct",
                    "code": appointment_data.get('specialty_code', '394814009'),
                    "display": appointment_data.get('specialty_name', 'Specialist consultation')
                }]
            }],
            "appointmentType": {
                "coding": [{
                    "system": "http://terminology.hl7.org/CodeSystem/v2-0276",
                    "code": "ROUTINE",
                    "display": "Routine appointment"
                }]
            },
            "reasonCode": [{
                "coding": [{
                    "system": "http://snomed.info/sct",
                    "code": appointment_data.get('reason_code', '183452005'),
                    "display": appointment_data.get('reason_display', 'Referral for specialist consultation')
                }]
            }],
            "start": appointment_data.get('appointment_date'),
            "end": appointment_data.get('end_time'),
            "minutesDuration": appointment_data.get('duration', 30),
            "participant": [
                {
                    "actor": {
                        "reference": f"Patient/{appointment_data.get('patient_id')}",
                        "display": appointment_data.get('patient_name', 'Patient')
                    },
                    "required": "required",
                    "status": "accepted"
                },
                {
                    "actor": {
                        "reference": f"Practitioner/{appointment_data.get('specialist_id')}",
                        "display": appointment_data.get('specialist_name', 'Specialist')
                    },
                    "required": "required",
                    "status": "accepted"
                }
            ]
        }
        
        return appointment
    
    @classmethod
    def build_service_request_resource(cls, referral_data: Dict) -> Dict:
        """
        Build FHIR ServiceRequest resource for referrals
        
        https://hl7.org/fhir/R4/servicerequest.html
        This is the FHIR equivalent of a referral
        """
        service_request = {
            "resourceType": "ServiceRequest",
            "id": str(referral_data.get('uuid', uuid.uuid4())),
            "identifier": [{
                "system": "http://health.gov.bw/identifier/referral",
                "value": referral_data.get('referral_number', '')
            }],
            "status": cls._map_referral_status(referral_data.get('status', 'active')),
            "intent": "plan",
            "priority": cls._map_priority(referral_data.get('priority', 'routine')),
            "code": {
                "coding": [{
                    "system": "http://snomed.info/sct",
                    "code": referral_data.get('service_code', '103693007'),
                    "display": referral_data.get('service_name', 'Diagnostic procedure')
                }]
            },
            "subject": {
                "reference": f"Patient/{referral_data.get('patient_id')}",
                "display": referral_data.get('patient_name', 'Patient')
            },
            "requester": {
                "reference": f"Practitioner/{referral_data.get('requester_id')}",
                "display": referral_data.get('requester_name', 'Referring provider')
            },
            "performer": [{
                "reference": f"Practitioner/{referral_data.get('performer_id')}",
                "display": referral_data.get('performer_name', 'Specialist')
            }] if referral_data.get('performer_id') else [],
            "reasonCode": [{
                "text": referral_data.get('reason', '')
            }],
            "reasonReference": referral_data.get('reason_reference', []),
            "note": [{
                "text": referral_data.get('clinical_summary', '')
            }] if referral_data.get('clinical_summary') else [],
            "occurrenceDateTime": referral_data.get('occurrence_date'),
            "authoredOn": referral_data.get('created_at')
        }
        
        return service_request
    
    @classmethod
    def build_bundle(cls, resources: List[Dict], bundle_type: str = "batch") -> Dict:
        """Build FHIR Bundle containing multiple resources"""
        return {
            "resourceType": "Bundle",
            "id": str(uuid.uuid4()),
            "type": bundle_type,
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "entry": [
                {
                    "fullUrl": f"urn:uuid:{resource.get('id', uuid.uuid4())}",
                    "resource": resource,
                    "request": {
                        "method": "PUT",
                        "url": f"{resource.get('resourceType', 'Unknown')}/{resource.get('id', '')}"
                    }
                }
                for resource in resources
            ]
        }
    
    @classmethod
    def parse_fhir_patient(cls, fhir_resource: Dict) -> Dict:
        """Parse FHIR Patient resource into local format"""
        result = {}
        
        # Extract identifiers
        for identifier in fhir_resource.get('identifier', []):
            system = identifier.get('system', '')
            if 'omang' in system:
                result['omang'] = identifier.get('value')
            elif 'passport' in system:
                result['passport_number'] = identifier.get('value')
            elif 'npid' in system:
                result['national_patient_id'] = identifier.get('value')
        
        # Extract name
        for name in fhir_resource.get('name', []):
            result['full_name'] = name.get('text', '')
            if name.get('family'):
                result['last_name'] = name.get('family')
            if name.get('given'):
                result['first_name'] = name.get('given', [''])[0]
        
        # Extract telecom
        for telecom in fhir_resource.get('telecom', []):
            if telecom.get('system') == 'phone':
                result['phone'] = telecom.get('value')
            elif telecom.get('system') == 'email':
                result['email'] = telecom.get('value')
        
        # Extract address
        for address in fhir_resource.get('address', []):
            result['village'] = address.get('city')
            result['district'] = address.get('district')
            result['address'] = address.get('text')
        
        # Basic demographics
        result['gender'] = cls._unmap_gender(fhir_resource.get('gender'))
        result['date_of_birth'] = fhir_resource.get('birthDate')
        
        return result
    
    @classmethod
    def _map_gender(cls, gender: str) -> str:
        """Map local gender to FHIR gender codes"""
        mapping = {
            'male': 'male',
            'female': 'female',
            'other': 'other',
            'unknown': 'unknown'
        }
        return mapping.get(gender, 'unknown')
    
    @classmethod
    def _unmap_gender(cls, fhir_gender: str) -> str:
        """Map FHIR gender to local format"""
        mapping = {
            'male': 'male',
            'female': 'female',
            'other': 'other',
            'unknown': 'unknown'
        }
        return mapping.get(fhir_gender, 'unknown')
    
    @classmethod
    def _map_appointment_status(cls, status: str) -> str:
        """Map local appointment status to FHIR"""
        mapping = {
            'scheduled': 'booked',
            'confirmed': 'booked',
            'checked_in': 'arrived',
            'in_progress': 'fulfilled',
            'completed': 'fulfilled',
            'missed': 'noshow',
            'cancelled': 'cancelled',
            'rescheduled': 'cancelled'
        }
        return mapping.get(status, 'booked')
    
    @classmethod
    def _map_referral_status(cls, status: str) -> str:
        """Map local referral status to FHIR ServiceRequest status"""
        mapping = {
            'pending': 'active',
            'pending_approval': 'active',
            'assigned': 'active',
            'scheduled': 'active',
            'completed': 'completed',
            'cancelled': 'revoked',
            'rejected': 'revoked'
        }
        return mapping.get(status, 'active')
    
    @classmethod
    def _map_priority(cls, priority: str) -> str:
        """Map local priority to FHIR priority codes"""
        mapping = {
            'emergency': 'stat',
            'urgent': 'urgent',
            'routine': 'routine'
        }
        return mapping.get(priority, 'routine')
    
    @classmethod
    def validate_fhir_resource(cls, resource: Dict, resource_type: str) -> Dict:
        """Validate FHIR resource against specification"""
        errors = []
        
        # Check required fields
        if resource.get('resourceType') != resource_type:
            errors.append(f"Invalid resourceType: expected {resource_type}, got {resource.get('resourceType')}")
        
        # Type-specific validation
        if resource_type == 'Patient':
            if not resource.get('name'):
                errors.append("Patient resource must have at least one name")
        
        elif resource_type == 'Appointment':
            if not resource.get('participant'):
                errors.append("Appointment resource must have participants")
            if not resource.get('start'):
                errors.append("Appointment resource must have start time")
        
        elif resource_type == 'ServiceRequest':
            if not resource.get('subject'):
                errors.append("ServiceRequest resource must have a subject")
            if not resource.get('requester'):
                errors.append("ServiceRequest resource must have a requester")
        
        return {
            'valid': len(errors) == 0,
            'errors': errors,
            'resource_type': resource_type
        }