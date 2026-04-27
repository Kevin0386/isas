"""
AI-Powered Referral Triage & Quality Scoring Service
Based on research from Journal of Primary Health Care (2025)
"""

import re
import json
from typing import Dict, List, Tuple, Optional
from datetime import datetime
from dataclasses import dataclass

@dataclass
class ReferralQualityResult:
    completeness_score: float
    missing_fields: List[str]
    specialty_match: Dict[str, float]
    quality_recommendations: List[str]
    suggested_priority: str
    urgency_indicators: List[str]

class AITriageService:
    """AI-assisted referral quality assessment and specialty matching"""
    
    # Specialty-specific required data fields
    SPECIALTY_REQUIREMENTS = {
        'cardiology': {
            'required': ['chest_pain_characteristics', 'ecg_results', 'cardiac_risk_factors'],
            'optional': ['echocardiogram', 'stress_test', 'lipid_profile'],
            'keywords': ['chest', 'heart', 'cardiac', 'ecg', 'palpitations', 'shortness of breath']
        },
        'neurology': {
            'required': ['symptom_onset', 'neurological_exam_findings', 'imaging_results'],
            'optional': ['eeg_results', 'lumbar_puncture'],
            'keywords': ['headache', 'seizure', 'stroke', 'neuropathy', 'dizziness', 'numbness']
        },
        'oncology': {
            'required': ['tumor_markers', 'biopsy_results', 'staging_information'],
            'optional': ['genetic_testing', 'previous_treatment'],
            'keywords': ['cancer', 'tumor', 'malignancy', 'chemotherapy', 'radiation', 'mass']
        },
        'pediatrics': {
            'required': ['growth_percentiles', 'vaccination_status', 'developmental_milestones'],
            'optional': ['birth_history', 'feeding_history'],
            'keywords': ['child', 'infant', 'pediatric', 'growth', 'development', 'vaccine']
        },
        'obstetrics': {
            'required': ['gestational_age', 'obstetric_history', 'fetal_heart_rate'],
            'optional': ['ultrasound_results', 'blood_pressure_trends'],
            'keywords': ['pregnancy', 'prenatal', 'obstetric', 'fetal', 'labor', 'delivery']
        },
        'orthopedics': {
            'required': ['injury_mechanism', 'imaging_results', 'range_of_motion'],
            'optional': ['previous_surgery', 'physical_therapy_history'],
            'keywords': ['bone', 'fracture', 'joint', 'arthritis', 'spine', 'muscle']
        },
        'dermatology': {
            'required': ['lesion_description', 'duration_of_lesion', 'previous_treatment'],
            'optional': ['biopsy_results', 'photograph'],
            'keywords': ['rash', 'lesion', 'skin', 'dermatitis', 'eczema', 'melanoma']
        },
        'psychiatry': {
            'required': ['mood_assessment', 'suicide_risk_assessment', 'previous_psychiatric_history'],
            'optional': ['medication_history', 'substance_use'],
            'keywords': ['depression', 'anxiety', 'psychosis', 'bipolar', 'suicidal', 'mental health']
        }
    }
    
    # Priority indicators
    URGENCY_INDICATORS = {
        'emergency': {
            'weight': 10,
            'keywords': [
                'life threatening', 'critical', 'emergency', 'immediate', 'unconscious',
                'severe bleeding', 'stroke', 'heart attack', 'respiratory distress',
                'sepsis', 'status epilepticus', 'anaphylaxis'
            ]
        },
        'urgent': {
            'weight': 5,
            'keywords': [
                'urgent', 'severe pain', 'fracture', 'acute', 'infection', 'fever',
                'dehydration', 'suspected cancer', 'rapid progression', 'worsening'
            ]
        },
        'routine': {
            'weight': 0,
            'keywords': ['routine', 'follow-up', 'chronic', 'stable', 'screening']
        }
    }
    
    @classmethod
    def analyze_referral_quality(cls, reason: str, clinical_summary: str = None,
                                  diagnosis: str = None, symptoms: str = None,
                                  specialty: str = None) -> ReferralQualityResult:
        """
        Analyze referral quality and provide AI recommendations
        """
        full_text = f"{reason} {clinical_summary or ''} {diagnosis or ''} {symptoms or ''}".lower()
        
        # Calculate completeness score
        completeness_score, missing_fields = cls._calculate_completeness(
            reason, clinical_summary, diagnosis, symptoms, specialty
        )
        
        # Match to appropriate specialty
        specialty_match = cls._match_specialty(full_text, reason, diagnosis)
        
        # Generate quality recommendations
        recommendations = cls._generate_recommendations(missing_fields, specialty_match, specialty)
        
        # Determine suggested priority
        suggested_priority, urgency_indicators = cls._determine_priority(full_text)
        
        return ReferralQualityResult(
            completeness_score=completeness_score,
            missing_fields=missing_fields,
            specialty_match=specialty_match,
            quality_recommendations=recommendations,
            suggested_priority=suggested_priority,
            urgency_indicators=urgency_indicators
        )
    
    @classmethod
    def _calculate_completeness(cls, reason: str, clinical_summary: str,
                                 diagnosis: str, symptoms: str,
                                 specialty: str) -> Tuple[float, List[str]]:
        """Calculate referral completeness score (0-100)"""
        score = 0
        max_score = 100
        missing = []
        
        # Check reason field (30 points)
        if reason and len(reason) > 50:
            score += 20
            if len(reason) > 200:
                score += 10
        else:
            missing.append("Detailed referral reason (>50 characters)")
        
        # Check clinical summary (25 points)
        if clinical_summary and len(clinical_summary) > 30:
            score += 25
        else:
            missing.append("Clinical summary of patient condition")
        
        # Check diagnosis (20 points)
        if diagnosis and len(diagnosis) > 10:
            score += 20
        else:
            missing.append("Working diagnosis or differential diagnosis")
        
        # Check symptoms (15 points)
        if symptoms and len(symptoms) > 20:
            score += 15
        else:
            missing.append("Key symptoms and their duration")
        
        # Specialty-specific requirements (10 points)
        if specialty and specialty.lower() in cls.SPECIALTY_REQUIREMENTS:
            reqs = cls.SPECIALTY_REQUIREMENTS[specialty.lower()]
            found_count = 0
            full_text = f"{reason} {clinical_summary or ''} {diagnosis or ''}".lower()
            
            for req in reqs['required']:
                req_word = req.replace('_', ' ')
                if req_word in full_text:
                    found_count += 1
                else:
                    missing.append(f"{req.replace('_', ' ').title()} for {specialty} referral")
            
            score += (found_count / len(reqs['required'])) * 10
        
        return round(score, 1), missing[:8]  # Limit to 8 missing fields
    
    @classmethod
    def _match_specialty(cls, full_text: str, reason: str, 
                         diagnosis: str) -> Dict[str, float]:
        """Match referral to appropriate specialty with confidence scores"""
        matches = {}
        
        for specialty, data in cls.SPECIALTY_REQUIREMENTS.items():
            confidence = 0
            keyword_matches = 0
            
            for keyword in data['keywords']:
                if keyword in full_text:
                    keyword_matches += 1
            
            if keyword_matches > 0:
                confidence = min(keyword_matches / len(data['keywords']) * 100, 95)
            
            # Boost confidence if specialty is explicitly mentioned
            if specialty in full_text:
                confidence = min(confidence + 20, 95)
            
            if confidence > 10:
                matches[specialty] = round(confidence, 1)
        
        # Sort by confidence and return top matches
        matches = dict(sorted(matches.items(), key=lambda x: x[1], reverse=True))
        
        # Ensure at least one match
        if not matches:
            matches = {'general_practice': 50}
        
        return matches
    
    @classmethod
    def _generate_recommendations(cls, missing_fields: List[str],
                                   specialty_match: Dict[str, float],
                                   selected_specialty: str) -> List[str]:
        """Generate actionable quality improvement recommendations"""
        recommendations = []
        
        # Missing field recommendations
        for field in missing_fields[:3]:
            recommendations.append(f"➕ Add missing information: {field}")
        
        # Specialty mismatch warning
        if selected_specialty and selected_specialty.lower() in specialty_match:
            confidence = specialty_match.get(selected_specialty.lower(), 0)
            if confidence < 50 and len(specialty_match) > 0:
                top_match = list(specialty_match.keys())[0]
                if top_match != selected_specialty.lower():
                    recommendations.append(
                        f"🎯 Consider {top_match.title()} - {specialty_match[top_match]}% match based on referral text"
                    )
        
        # General quality tips
        if len(missing_fields) > 5:
            recommendations.append("📋 Referral lacks critical information - consider using structured referral template")
        
        return recommendations
    
    @classmethod
    def _determine_priority(cls, full_text: str) -> Tuple[str, List[str]]:
        """Determine suggested priority based on urgency indicators"""
        urgency_found = []
        max_weight = 0
        suggested = 'routine'
        
        for priority, data in cls.URGENCY_INDICATORS.items():
            for keyword in data['keywords']:
                if keyword in full_text:
                    urgency_found.append(keyword)
                    if data['weight'] > max_weight:
                        max_weight = data['weight']
                        suggested = priority
        
        # Emergency keywords get special handling
        if any(k in full_text for k in cls.URGENCY_INDICATORS['emergency']['keywords']):
            suggested = 'emergency'
        elif any(k in full_text for k in cls.URGENCY_INDICATORS['urgent']['keywords']):
            suggested = 'urgent'
        
        return suggested, urgency_found[:5]
    
    @classmethod
    def generate_referral_template(cls, specialty: str) -> Dict:
        """Generate structured referral template for specialty"""
        if specialty not in cls.SPECIALTY_REQUIREMENTS:
            specialty = 'general'
        
        requirements = cls.SPECIALTY_REQUIREMENTS.get(specialty, {})
        
        return {
            'specialty': specialty,
            'required_fields': requirements.get('required', []),
            'optional_fields': requirements.get('optional', []),
            'suggested_format': cls._get_template_format(specialty),
            'example_referral': cls._get_example_referral(specialty)
        }
    
    @classmethod
    def _get_template_format(cls, specialty: str) -> Dict:
        """Get structured format for referral"""
        base_format = {
            'patient_demographics': ['full_name', 'omang', 'date_of_birth', 'phone'],
            'clinical_information': [
                'chief_complaint',
                'history_of_present_illness',
                'past_medical_history',
                'medications',
                'allergies'
            ],
            'examination_findings': ['vitals', 'physical_exam', 'neurological_exam'],
            'investigations': ['lab_results', 'imaging_results', 'special_tests'],
            'assessment': ['working_diagnosis', 'differential_diagnosis'],
            'plan': ['reason_for_referral', 'urgency', 'specific_questions']
        }
        
        # Specialty-specific additions
        specialty_additions = {
            'cardiology': ['ecg_findings', 'cardiac_risk_factors', 'chest_pain_characteristics'],
            'neurology': ['neurological_exam', 'imaging_findings', 'seizure_description'],
            'oncology': ['tumor_characteristics', 'staging', 'previous_treatment'],
            'pediatrics': ['birth_history', 'growth_chart', 'developmental_milestones'],
            'obstetrics': ['gestational_age', 'obstetric_history', 'fetal_assessment'],
            'orthopedics': ['injury_mechanism', 'range_of_motion', 'imaging'],
            'dermatology': ['lesion_description', 'location', 'duration', 'photograph'],
            'psychiatry': ['mental_status_exam', 'risk_assessment', 'substance_use']
        }
        
        if specialty in specialty_additions:
            base_format['specialty_specific'] = specialty_additions[specialty]
        
        return base_format
    
    @classmethod
    def _get_example_referral(cls, specialty: str) -> str:
        """Get example referral text for specialty"""
        examples = {
            'cardiology': """CHIEF COMPLAINT: 65yo male with exertional chest pain for 2 weeks
HPI: Chest pain occurs with walking 2 blocks, relieved by rest. No pain at rest. Associated with shortness of breath.
PMH: Hypertension x10 years, Type 2 diabetes x5 years
MEDICATIONS: Lisinopril 10mg daily, Metformin 500mg BID
EXAM: BP 145/90, HR 88, regular. No JVD, clear lungs
ECG: Normal sinus, no acute changes
ASSESSMENT: Suspected stable angina
REASON FOR REFERRAL: Further evaluation with stress test and possible angiography""",
            
            'neurology': """CHIEF COMPLAINT: 45yo female with episodic severe headaches x3 months
HPI: Headaches occur 2-3x/week, lasting 4-6 hours. Throbbing, unilateral, associated with nausea and photophobia.
NEURO EXAM: Normal cranial nerves, motor, sensory, reflexes
IMAGING: CT head normal
ASSESSMENT: Migraine without aura
REASON FOR REFERRAL: Failure of first-line prophylactic medications"""
        }
        
        return examples.get(specialty, "Please provide detailed clinical information following the structured format.")