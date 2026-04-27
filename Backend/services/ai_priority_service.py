"""
AI Priority Service for Referrals
Integrates with existing Referral model using priority enum (emergency/urgent/routine)
"""

import re
from datetime import datetime, date
from typing import Dict, List, Tuple, Optional
from models import Referral, Patient, ReferralPriority

class AIPriorityService:
    """AI-powered priority suggestion for referrals using rule-based inference"""
    
    # Emergency keywords (weight 10)
    EMERGENCY_KEYWORDS = {
        'critical': 10, 'emergency': 10, 'immediate': 10, 'life threatening': 10,
        'cardiac arrest': 10, 'respiratory arrest': 10, 'unconscious': 10,
        'stroke': 9, 'heart attack': 9, 'myocardial infarction': 9,
        'severe bleeding': 9, 'haemorrhage': 9, 'hemorrhage': 9,
        'seizure': 8, 'meningitis': 8, 'sepsis': 8,
        'difficulty breathing': 9, 'respiratory distress': 9,
        'head injury': 8, 'trauma': 7
    }
    
    # Urgent keywords (weight 5-7)
    URGENT_KEYWORDS = {
        'urgent': 7, 'severe': 6, 'acute': 6, 'chest pain': 6,
        'suspected cancer': 7, 'malignant': 7, 'tumor': 6,
        'fracture': 5, 'dislocation': 5, 'infection': 4,
        'high fever': 5, 'persistent vomiting': 5, 'dehydration': 4,
        'hiv': 4, 'tuberculosis': 4, 'tb': 4, 'pneumonia': 4
    }
    
    # Routine keywords (negative weights)
    ROUTINE_KEYWORDS = {
        'routine': -5, 'follow-up': -4, 'review': -3, 'check-up': -3,
        'screening': -2, 'wellness': -2, 'preventive': -2, 'stable': -3,
        'controlled': -2, 'medication refill': -2, 'annual': -2
    }
    
    # Specialty urgency multipliers
    SPECIALTY_URGENCY = {
        'cardiology': 1.5, 'oncology': 1.8, 'neurology': 1.6,
        'emergency medicine': 2.0, 'critical care': 2.0, 'neonatology': 1.7,
        'pediatrics': 1.2, 'obstetrics': 1.4, 'neurosurgery': 1.9,
        'cardiothoracic': 1.8, 'hematology': 1.5
    }
    
    # Age-based risk factors
    AGE_RISK_FACTORS = {
        (0, 1): 1.5,      # Infants
        (1, 5): 1.3,      # Toddlers
        (65, 80): 1.4,    # Elderly
        (80, 150): 1.8    # Very elderly
    }
    
    @classmethod
    def analyze_referral(cls, reason: str, clinical_summary: str = None,
                         specialty_name: str = None, patient_age: int = None,
                         diagnosis: str = None, symptoms: str = None) -> Dict:
        """
        Analyze referral and provide AI priority suggestion
        
        Returns:
            Dict with priority, score, confidence, and reasoning
        """
        # Combine all text for analysis
        full_text = reason
        if clinical_summary:
            full_text += " " + clinical_summary
        if diagnosis:
            full_text += " " + diagnosis
        if symptoms:
            full_text += " " + symptoms
        
        full_text_lower = full_text.lower()
        
        # Calculate base score
        urgency_score = cls._calculate_keyword_score(full_text_lower)
        
        # Apply specialty multiplier
        if specialty_name and specialty_name.lower() in cls.SPECIALTY_URGENCY:
            urgency_score *= cls.SPECIALTY_URGENCY[specialty_name.lower()]
        
        # Apply age factor
        if patient_age:
            for (min_age, max_age), factor in cls.AGE_RISK_FACTORS.items():
                if min_age <= patient_age < max_age:
                    urgency_score *= factor
                    break
        
        # Check for dangerous conditions
        dangerous_conditions = cls._detect_dangerous_conditions(full_text_lower)
        if dangerous_conditions:
            urgency_score = min(urgency_score * 1.5, 100)
        
        # Determine priority based on score
        priority, confidence = cls._score_to_priority(urgency_score)
        
        # Generate explanation
        reasoning = cls._generate_reasoning(
            urgency_score, priority, dangerous_conditions,
            specialty_name, patient_age
        )
        
        return {
            'priority': priority,
            'priority_value': priority,  # 'emergency', 'urgent', or 'routine'
            'score': round(urgency_score, 2),
            'confidence': round(confidence, 2),
            'reasoning': reasoning,
            'suggested_timeframe': cls._get_suggested_timeframe(priority),
            'keywords_matched': cls._get_matched_keywords(full_text_lower),
            'dangerous_conditions': dangerous_conditions,
            'requires_immediate_action': priority == 'emergency'
        }
    
    @classmethod
    def _calculate_keyword_score(cls, text: str) -> float:
        """Calculate urgency score based on keyword matching"""
        score = 50  # Start at neutral
        
        for keyword, weight in cls.EMERGENCY_KEYWORDS.items():
            if keyword in text:
                score += weight
        
        for keyword, weight in cls.URGENT_KEYWORDS.items():
            if keyword in text:
                score += weight
        
        for keyword, weight in cls.ROUTINE_KEYWORDS.items():
            if keyword in text:
                score += weight
        
        # Normalize to 0-100
        return min(max(score, 0), 100)
    
    @classmethod
    def _detect_dangerous_conditions(cls, text: str) -> List[str]:
        """Detect specific dangerous conditions"""
        dangerous = []
        
        danger_patterns = {
            'stroke': ['stroke', 'cva', 'brain attack', 'hemiplegia'],
            'heart attack': ['heart attack', 'myocardial infarction', 'mi', 'acute coronary'],
            'sepsis': ['sepsis', 'septic', 'blood infection', 'septic shock'],
            'respiratory failure': ['respiratory failure', 'cant breathe', 'difficulty breathing', 'hypoxia'],
            'active bleeding': ['bleeding', 'haemorrhage', 'hemorrhage', 'blood loss', 'hematemesis'],
            'loss of consciousness': ['unconscious', 'passed out', 'fainted', 'coma', 'syncope'],
            'meningitis': ['meningitis', 'neck stiffness', 'photophobia'],
            'organ failure': ['kidney failure', 'liver failure', 'renal failure', 'hepatic failure']
        }
        
        for condition, patterns in danger_patterns.items():
            for pattern in patterns:
                if pattern in text:
                    dangerous.append(condition)
                    break
        
        return dangerous
    
    @classmethod
    def _score_to_priority(cls, score: float) -> Tuple[str, float]:
        """Convert score to priority level with confidence"""
        if score >= 75:
            return ReferralPriority.EMERGENCY, min(0.7 + (score - 75) / 25 * 0.3, 0.95)
        elif score >= 50:
            return ReferralPriority.URGENT, min(0.6 + (score - 50) / 25 * 0.3, 0.85)
        else:
            return ReferralPriority.ROUTINE, min(0.5 + score / 50 * 0.4, 0.9)
    
    @classmethod
    def _generate_reasoning(cls, score: float, priority: str,
                           dangerous_conditions: List[str],
                           specialty: str, age: int) -> str:
        """Generate human-readable reasoning"""
        reasons = []
        
        if dangerous_conditions:
            reasons.append(f"⚠️ Detected potential {', '.join(dangerous_conditions)}")
        
        if specialty and specialty.lower() in cls.SPECIALTY_URGENCY:
            multiplier = cls.SPECIALTY_URGENCY[specialty.lower()]
            if multiplier > 1.3:
                reasons.append(f"📋 {specialty} referrals typically require faster attention")
        
        if age:
            if age < 5:
                reasons.append(f"👶 Pediatric patient (age {age}) - higher priority")
            elif age >= 65:
                reasons.append(f"👴 Elderly patient (age {age}) - higher priority")
        
        if score >= 75:
            reasons.insert(0, "🔴 HIGH URGENCY - Multiple risk factors present")
        elif score >= 50:
            reasons.insert(0, "🟡 Moderate urgency - Requires attention within 1-2 weeks")
        else:
            reasons.insert(0, "🟢 Routine referral - Can be scheduled normally")
        
        return " | ".join(reasons) if reasons else "Standard referral based on provided information"
    
    @classmethod
    def _get_suggested_timeframe(cls, priority: str) -> str:
        """Get suggested appointment timeframe"""
        timeframes = {
            ReferralPriority.EMERGENCY: 'Within 24-48 hours',
            ReferralPriority.URGENT: 'Within 1-2 weeks',
            ReferralPriority.ROUTINE: 'Within 1-3 months'
        }
        return timeframes.get(priority, 'Schedule as appropriate')
    
    @classmethod
    def _get_matched_keywords(cls, text: str) -> List[str]:
        """Get matched keywords"""
        matched = []
        all_keywords = {**cls.EMERGENCY_KEYWORDS, **cls.URGENT_KEYWORDS, **cls.ROUTINE_KEYWORDS}
        for keyword in all_keywords.keys():
            if keyword in text:
                matched.append(keyword)
        return matched[:10]
    
    @classmethod
    def analyze_existing_referral(cls, referral_id: int) -> Dict:
        """Analyze an existing referral from the database"""
        from models import db, Referral, Patient
        
        referral = db.session.get(Referral, referral_id)
        if not referral:
            return {'error': 'Referral not found'}
        
        # Get patient age
        patient_age = None
        if referral.patient_rel and referral.patient_rel.date_of_birth:
            today = date.today()
            dob = referral.patient_rel.date_of_birth
            patient_age = today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))
        
        # Get specialty name
        specialty_name = None
        if referral.assigned_specialist and referral.assigned_specialist.specialty_rel:
            specialty_name = referral.assigned_specialist.specialty_rel.name
        
        return cls.analyze_referral(
            reason=referral.reason,
            clinical_summary=referral.clinical_summary,
            specialty_name=specialty_name,
            patient_age=patient_age,
            diagnosis=referral.diagnosis,
            symptoms=referral.symptoms
        )
    
    @classmethod
    def batch_analyze(cls, referrals: List[Dict]) -> List[Dict]:
        """Analyze multiple referrals for queue prioritization"""
        results = []
        for referral_data in referrals:
            analysis = cls.analyze_referral(
                reason=referral_data.get('reason', ''),
                clinical_summary=referral_data.get('clinical_summary'),
                specialty_name=referral_data.get('specialty'),
                patient_age=referral_data.get('patient_age'),
                diagnosis=referral_data.get('diagnosis'),
                symptoms=referral_data.get('symptoms')
            )
            results.append({
                'referral_id': referral_data.get('id'),
                **analysis
            })
        
        # Sort by score descending
        results.sort(key=lambda x: x['score'], reverse=True)
        return results


class ReferralQueueOptimizer:
    """Optimize referral queue based on AI priority scores"""
    
    @staticmethod
    def prioritize_queue(referrals: List[Dict]) -> List[Dict]:
        """Sort referrals by priority with waiting time consideration"""
        current_time = datetime.utcnow()
        
        for referral in referrals:
            created_at = referral.get('created_at')
            if created_at:
                waiting_days = (current_time - created_at).days
                waiting_factor = min(waiting_days * 0.5, 10)
                referral['adjusted_score'] = referral.get('ai_priority_score', 50) + waiting_factor
            else:
                referral['adjusted_score'] = referral.get('ai_priority_score', 50)
        
        return sorted(referrals, key=lambda x: x['adjusted_score'], reverse=True)
    
    @staticmethod
    def estimate_wait_time(priority: str, queue_position: int,
                          avg_daily_capacity: int = 10) -> int:
        """Estimate wait time in days"""
        base_days = {
            ReferralPriority.EMERGENCY: 1,
            ReferralPriority.URGENT: 7,
            ReferralPriority.ROUTINE: 30
        }
        
        multiplier = queue_position / max(avg_daily_capacity, 1)
        estimated_days = base_days.get(priority, 14) + int(multiplier * 3)
        
        return min(estimated_days, 90)