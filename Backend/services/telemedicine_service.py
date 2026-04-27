"""
Telemedicine Service for Virtual Consultations
Supports video calls, screen sharing, and recording
"""

import uuid
import json
import secrets
from datetime import datetime, timedelta
from typing import Dict, List, Optional
from dataclasses import dataclass

@dataclass
class TelemedicineSession:
    id: str
    appointment_id: int
    room_id: str
    room_url: str
    specialist_join_url: str
    patient_join_url: str
    status: str  # scheduled, active, completed, cancelled
    created_at: datetime
    scheduled_start: datetime
    scheduled_end: datetime
    meeting_password: str

class TelemedicineService:
    """Virtual consultation service with video conferencing"""
    
    # Supported video providers
    PROVIDERS = {
        'daily': {
            'api_url': 'https://api.daily.co/v1',
            'room_url_template': 'https://{domain}.daily.co/{room_name}'
        },
        'jitsi': {
            'api_url': 'https://meet.jit.si',
            'room_url_template': 'https://meet.jit.si/{room_name}'
        },
        'zoom': {
            'api_url': 'https://api.zoom.us/v2',
            'room_url_template': 'https://zoom.us/j/{meeting_id}'
        }
    }
    
    def __init__(self, provider: str = 'daily'):
        self.provider = provider
        self.sessions: Dict[str, TelemedicineSession] = {}
    
    def create_session(self, appointment_id: int, patient_name: str,
                       specialist_name: str, scheduled_start: datetime,
                       duration_minutes: int = 30) -> TelemedicineSession:
        """Create a new telemedicine session"""
        
        session_id = str(uuid.uuid4())
        room_name = f"consult-{appointment_id}-{secrets.token_hex(4)}"
        meeting_password = secrets.token_hex(8)
        
        # Create room based on provider
        if self.provider == 'daily':
            room_url = self._create_daily_room(room_name, meeting_password)
        elif self.provider == 'jitsi':
            room_url = self._create_jitsi_room(room_name, meeting_password)
        else:
            room_url = self._create_zoom_meeting(room_name, meeting_password, scheduled_start, duration_minutes)
        
        session = TelemedicineSession(
            id=session_id,
            appointment_id=appointment_id,
            room_id=room_name,
            room_url=room_url,
            specialist_join_url=f"{room_url}?role=host&password={meeting_password}",
            patient_join_url=f"{room_url}?role=participant&password={meeting_password}",
            status='scheduled',
            created_at=datetime.utcnow(),
            scheduled_start=scheduled_start,
            scheduled_end=scheduled_start + timedelta(minutes=duration_minutes),
            meeting_password=meeting_password
        )
        
        self.sessions[session_id] = session
        return session
    
    def _create_daily_room(self, room_name: str, password: str) -> str:
        """Create a room using Daily.co API"""
        # In production, call Daily.co API
        # For MVP, generate mock URL
        return f"https://isas.daily.co/{room_name}"
    
    def _create_jitsi_room(self, room_name: str, password: str) -> str:
        """Create a room using Jitsi Meet"""
        return f"https://meet.jit.si/{room_name}"
    
    def _create_zoom_meeting(self, room_name: str, password: str,
                              start_time: datetime, duration: int) -> str:
        """Create a Zoom meeting"""
        # In production, call Zoom API
        meeting_id = secrets.token_hex(6)
        return f"https://zoom.us/j/{meeting_id}"
    
    def get_session(self, session_id: str) -> Optional[TelemedicineSession]:
        """Get session by ID"""
        return self.sessions.get(session_id)
    
    def get_session_by_appointment(self, appointment_id: int) -> Optional[TelemedicineSession]:
        """Get session by appointment ID"""
        for session in self.sessions.values():
            if session.appointment_id == appointment_id:
                return session
        return None
    
    def update_session_status(self, session_id: str, status: str) -> bool:
        """Update session status"""
        if session_id in self.sessions:
            self.sessions[session_id].status = status
            return True
        return False
    
    def end_session(self, session_id: str) -> bool:
        """End an active session"""
        return self.update_session_status(session_id, 'completed')
    
    def cancel_session(self, session_id: str) -> bool:
        """Cancel a scheduled session"""
        return self.update_session_status(session_id, 'cancelled')
    
    def generate_join_token(self, session_id: str, user_role: str) -> Dict:
        """Generate a join token for the session"""
        session = self.get_session(session_id)
        if not session:
            return {'error': 'Session not found'}
        
        if user_role == 'specialist':
            return {
                'url': session.specialist_join_url,
                'role': 'host',
                'session_id': session_id,
                'appointment_id': session.appointment_id
            }
        else:
            return {
                'url': session.patient_join_url,
                'role': 'participant',
                'session_id': session_id,
                'appointment_id': session.appointment_id
            }
    
    def get_active_sessions_for_specialist(self, specialist_id: int) -> List[Dict]:
        """Get all active sessions for a specialist"""
        active = []
        for session in self.sessions.values():
            if session.status == 'active':
                active.append({
                    'session_id': session.id,
                    'appointment_id': session.appointment_id,
                    'room_url': session.room_url,
                    'scheduled_start': session.scheduled_start.isoformat(),
                    'join_url': session.specialist_join_url
                })
        return active
    
    def get_upcoming_sessions_for_patient(self, patient_id: int) -> List[Dict]:
        """Get upcoming sessions for a patient"""
        upcoming = []
        now = datetime.utcnow()
        for session in self.sessions.values():
            if session.scheduled_start > now and session.status == 'scheduled':
                upcoming.append({
                    'session_id': session.id,
                    'appointment_id': session.appointment_id,
                    'scheduled_start': session.scheduled_start.isoformat(),
                    'scheduled_end': session.scheduled_end.isoformat(),
                    'join_url': session.patient_join_url
                })
        return upcoming


class RemotePatientMonitoring:
    """Remote Patient Monitoring (RPM) integration"""
    
    VITAL_RANGES = {
        'blood_pressure_systolic': {'min': 90, 'max': 180, 'unit': 'mmHg'},
        'blood_pressure_diastolic': {'min': 60, 'max': 120, 'unit': 'mmHg'},
        'heart_rate': {'min': 50, 'max': 120, 'unit': 'bpm'},
        'temperature': {'min': 36.0, 'max': 38.5, 'unit': '°C'},
        'oxygen_saturation': {'min': 92, 'max': 100, 'unit': '%'},
        'blood_glucose': {'min': 70, 'max': 180, 'unit': 'mg/dL'},
        'weight': {'min': 20, 'max': 200, 'unit': 'kg'},
        'respiratory_rate': {'min': 12, 'max': 20, 'unit': 'breaths/min'}
    }
    
    @classmethod
    def validate_vital(cls, vital_name: str, value: float) -> Dict:
        """Validate a vital sign reading"""
        if vital_name not in cls.VITAL_RANGES:
            return {'valid': False, 'error': f'Unknown vital: {vital_name}'}
        
        ranges = cls.VITAL_RANGES[vital_name]
        is_valid = ranges['min'] <= value <= ranges['max']
        
        return {
            'valid': is_valid,
            'value': value,
            'unit': ranges['unit'],
            'is_abnormal': not is_valid,
            'abnormal_level': cls._get_abnormal_level(vital_name, value) if not is_valid else None,
            'normal_range': f"{ranges['min']} - {ranges['max']} {ranges['unit']}"
        }
    
    @classmethod
    def _get_abnormal_level(cls, vital_name: str, value: float) -> str:
        """Determine if abnormal reading is critical or warning"""
        ranges = cls.VITAL_RANGES[vital_name]
        
        # Critical thresholds (more extreme)
        critical_margins = {
            'blood_pressure_systolic': 40,
            'heart_rate': 30,
            'oxygen_saturation': 15,
            'temperature': 2.0
        }
        
        margin = critical_margins.get(vital_name, 20)
        
        if value < ranges['min'] - margin or value > ranges['max'] + margin:
            return 'critical'
        return 'warning'
    
    @classmethod
    def generate_trend_analysis(cls, readings: List[Dict]) -> Dict:
        """Generate trend analysis from historical readings"""
        if not readings:
            return {'has_data': False, 'message': 'No data available'}
        
        analysis = {
            'has_data': True,
            'period_days': 0,
            'trends': {},
            'alerts': []
        }
        
        # Calculate date range
        dates = [r.get('recorded_at') for r in readings if r.get('recorded_at')]
        if dates:
            min_date = min(dates)
            max_date = max(dates)
            analysis['period_days'] = (max_date - min_date).days
        
        # Analyze each vital type
        vital_types = set()
        for reading in readings:
            for vital in reading.get('vitals', {}):
                vital_types.add(vital)
        
        for vital in vital_types:
            values = []
            dates_list = []
            for reading in readings:
                if reading.get('vitals', {}).get(vital):
                    values.append(reading['vitals'][vital])
                    if reading.get('recorded_at'):
                        dates_list.append(reading['recorded_at'])
            
            if len(values) >= 2:
                # Calculate trend
                first_third = sum(values[:len(values)//3]) / max(len(values)//3, 1)
                last_third = sum(values[-len(values)//3:]) / max(len(values)//3, 1)
                
                if last_third > first_third * 1.1:
                    trend = 'increasing'
                elif last_third < first_third * 0.9:
                    trend = 'decreasing'
                else:
                    trend = 'stable'
                
                analysis['trends'][vital] = {
                    'trend': trend,
                    'current_value': values[-1] if values else None,
                    'average': sum(values) / len(values),
                    'min': min(values),
                    'max': max(values)
                }
                
                # Check for concerning trends
                if trend == 'increasing' and vital in ['blood_pressure_systolic', 'heart_rate', 'blood_glucose']:
                    analysis['alerts'].append(f"⚠️ {vital.replace('_', ' ').title()} is increasing - monitor closely")
                elif trend == 'decreasing' and vital in ['oxygen_saturation']:
                    analysis['alerts'].append(f"⚠️ {vital.replace('_', ' ').title()} is decreasing - requires attention")
        
        return analysis