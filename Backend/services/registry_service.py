"""
National Patient Registry Service
Integrates with Botswana's IPMS (Integrated Patient Management System)
"""

import re
import hashlib
from datetime import datetime, date
from typing import Dict, List, Tuple, Optional
from flask import current_app
from models import db, User, Patient, UserRole, UserStatus

class NationalRegistryService:
    """Service for interacting with Botswana's national patient registry (IPMS)"""
    
    @staticmethod
    def validate_omang(omang_number: str) -> Tuple[bool, str, dict]:
        """
        Validate Botswana Omang number format
        Format: 11 digits
        - First 6 digits: Birth date (YYMMDD)
        - Next 4 digits: Sequence number
        - Last digit: Checksum
        
        Returns: (is_valid, message, extracted_data)
        """
        if not omang_number:
            return False, "Omang number is required", {}
        
        if not re.match(r'^\d{11}$', omang_number):
            return False, "Omang must be exactly 11 digits", {}
        
        extracted = {}
        
        # Extract and validate birth date
        try:
            year = int(omang_number[:2])
            month = int(omang_number[2:4])
            day = int(omang_number[4:6])
            
            current_year = datetime.now().year
            full_year = 1900 + year if year > current_year % 100 else 2000 + year
            
            birth_date = datetime(full_year, month, day).date()
            extracted['date_of_birth'] = birth_date.isoformat()
            
            # Calculate age
            today = date.today()
            age = today.year - birth_date.year - ((today.month, today.day) < (birth_date.month, birth_date.day))
            extracted['age'] = age
            
            if age < 0 or age > 120:
                return False, f"Invalid age ({age}) from Omang", extracted
                
        except ValueError:
            return False, "Invalid birth date in Omang", extracted
        
        # Extract gender (5th digit: 0-4 female, 5-9 male)
        gender_digit = int(omang_number[4]) if len(omang_number) > 4 else 0
        extracted['gender'] = 'female' if 0 <= gender_digit <= 4 else 'male'
        
        # Validate checksum
        if not NationalRegistryService._validate_checksum(omang_number):
            return False, "Invalid Omang checksum", extracted
        
        extracted['is_valid_format'] = True
        return True, "Valid Omang", extracted
    
    @staticmethod
    def _validate_checksum(omang_number: str) -> bool:
        """Validate checksum using modified Luhn algorithm"""
        digits = [int(d) for d in omang_number[:-1]]
        check_digit = int(omang_number[-1])
        
        # Botswana-specific weights
        weights = [2, 1, 2, 1, 2, 1, 2, 1, 2, 1]
        total = 0
        
        for i, digit in enumerate(digits):
            product = digit * weights[i]
            if product > 9:
                product = product - 9
            total += product
        
        calculated_check = (10 - (total % 10)) % 10
        return calculated_check == check_digit
    
    @staticmethod
    def search_national_registry(omang_number: str, full_name: str = None,
                                  phone: str = None, email: str = None) -> Dict:
        """
        Search the national patient registry (IPMS)
        
        In production: This would call Botswana's Ministry of Health API
        For MVP: Validates Omang and checks local database
        """
        # Validate Omang
        is_valid, message, extracted = NationalRegistryService.validate_omang(omang_number)
        if not is_valid:
            return {
                'success': False,
                'error': message,
                'omang_valid': False
            }
        
        # Check local database
        local_user = User.query.filter_by(omang=omang_number).first()
        
        # In production: API call to Ministry of Health
        # response = requests.post(
        #     current_app.config.get('IPMS_API_URL', '') + '/v1/patient/search',
        #     headers={
        #         'Authorization': f'Bearer {current_app.config.get("IPMS_API_KEY", "")}',
        #         'Content-Type': 'application/json'
        #     },
        #     json={
        #         'omang': omang_number,
        #         'fullName': full_name,
        #         'phone': phone,
        #         'email': email
        #     },
        #     timeout=10
        # )
        
        # Simulated registry lookup for MVP
        registry_data = NationalRegistryService._simulate_registry_lookup(
            omang_number, full_name, extracted
        )
        
        return {
            'success': True,
            'omang_valid': True,
            'found_in_national': registry_data is not None,
            'patient_exists_locally': local_user is not None,
            'local_patient_id': local_user.id if local_user else None,
            'local_patient_uuid': str(local_user.uuid) if local_user else None,
            'registry_data': registry_data,
            'extracted_data': extracted,
            'message': 'Patient found in national registry' if registry_data else 'Patient not found in national registry'
        }
    
    @staticmethod
    def _simulate_registry_lookup(omang_number: str, full_name: str = None,
                                   extracted: dict = None) -> Optional[Dict]:
        """
        Simulate national registry lookup
        Replace with actual API call in production
        """
        extracted = extracted or {}
        
        # Simulate found patient
        return {
            'omang': omang_number,
            'full_name': full_name or f"Patient from Omang {omang_number[:6]}",
            'gender': extracted.get('gender', 'unknown'),
            'date_of_birth': extracted.get('date_of_birth'),
            'inferred_age': extracted.get('age'),
            'registry_id': f"IPMS-{omang_number[:6]}-{omang_number[6:10]}",
            'village': 'Unknown',
            'district': 'Unknown',
            'source': 'National Population Registry',
            'last_updated': datetime.utcnow().isoformat()
        }
    
    @staticmethod
    def import_from_registry(omang_number: str, additional_data: Dict = None) -> Dict:
        """
        Import patient data from national registry into local system
        """
        # Search registry
        search_result = NationalRegistryService.search_national_registry(omang_number)
        
        if not search_result['success']:
            return {'success': False, 'error': search_result.get('error', 'Search failed')}
        
        if not search_result.get('registry_data'):
            return {'success': False, 'error': 'Patient not found in national registry'}
        
        # Check if already exists
        existing_user = User.query.filter_by(omang=omang_number).first()
        if existing_user:
            return {
                'success': False,
                'error': 'Patient already exists in local system',
                'patient_id': existing_user.id,
                'patient_uuid': str(existing_user.uuid)
            }
        
        registry_data = search_result['registry_data']
        additional = additional_data or {}
        
        # Generate temporary PIN (last 4 digits of Omang or random)
        temp_pin = additional.get('temp_pin') or omang_number[-4:] or '1234'
        
        # Create user
        new_user = User(
            omang=omang_number,
            full_name=additional.get('full_name') or registry_data.get('full_name', ''),
            role=UserRole.PATIENT,
            status=UserStatus.ACTIVE,
            gender=registry_data.get('gender'),
            phone=additional.get('phone'),
            email=additional.get('email')
        )
        new_user.set_pin(temp_pin)
        
        db.session.add(new_user)
        db.session.flush()
        
        # Parse date of birth
        date_of_birth = None
        dob_str = additional.get('date_of_birth') or registry_data.get('date_of_birth')
        if dob_str:
            try:
                date_of_birth = datetime.fromisoformat(dob_str).date() if isinstance(dob_str, str) else dob_str
            except:
                pass
        
        # Create patient record
        new_patient = Patient(
            user_id=new_user.id,
            omang=omang_number,
            date_of_birth=date_of_birth,
            village=additional.get('village') or registry_data.get('village'),
            district=additional.get('district') or registry_data.get('district'),
            next_of_kin_name=additional.get('next_of_kin_name'),
            next_of_kin_phone=additional.get('next_of_kin_phone'),
            medical_aid_number=additional.get('medical_aid_number'),
            medical_aid_name=additional.get('medical_aid_name'),
            nationality=additional.get('nationality', 'Botswana')
        )
        
        db.session.add(new_patient)
        db.session.commit()
        
        return {
            'success': True,
            'message': 'Patient imported from national registry',
            'patient_id': new_user.id,
            'patient_uuid': str(new_user.uuid),
            'temp_pin': temp_pin,
            'registry_data': registry_data
        }
    
    @staticmethod
    def generate_national_patient_id(omang_number: str = None, passport_number: str = None) -> str:
        """Generate a unique national patient ID"""
        if omang_number:
            base = omang_number
        elif passport_number:
            base = passport_number
        else:
            base = str(datetime.utcnow().timestamp())
        
        hash_obj = hashlib.sha256(base.encode())
        return f"NPID-{hash_obj.hexdigest()[:12].upper()}"