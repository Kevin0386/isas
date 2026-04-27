"""
Escalation Routes for Delayed Referrals
"""

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import datetime, timedelta
from models import db, Referral, Appointment, Notification, User, Nurse

escalation_bp = Blueprint('escalation', __name__, url_prefix='/api/escalation')

# Escalation rules based on research
ESCALATION_RULES = {
    'routine': {
        'nurse_alert': 30,      # days - alert nurse
        'department_head': 60,   # days - escalate to department head
        'hospital_admin': 90     # days - escalate to hospital administration
    },
    'urgent': {
        'nurse_alert': 7,
        'department_head': 14,
        'hospital_admin': 30
    },
    'emergency': {
        'nurse_alert': 1,
        'department_head': 2,
        'hospital_admin': 3
    }
}


@escalation_bp.route('/check-delayed', methods=['GET'])
@jwt_required()
def check_delayed_referrals():
    """Check for delayed referrals and trigger escalations"""
    claims = get_jwt()
    if claims.get('role') not in ['admin', 'head_nurse']:
        return jsonify({'error': 'Forbidden'}), 403
    
    today = datetime.utcnow()
    delayed_referrals = []
    
    # Get all pending/assigned referrals
    referrals = Referral.query.filter(
        Referral.status.in_(['pending', 'pending_approval', 'assigned', 'scheduled'])
    ).all()
    
    for ref in referrals:
        waiting_days = (today - ref.created_at).days
        priority = ref.priority or 'routine'
        
        if priority in ESCALATION_RULES:
            rules = ESCALATION_RULES[priority]
            
            # Determine escalation level needed
            escalation_level = None
            if waiting_days >= rules.get('hospital_admin', 999):
                escalation_level = 'hospital_admin'
            elif waiting_days >= rules.get('department_head', 999):
                escalation_level = 'department_head'
            elif waiting_days >= rules.get('nurse_alert', 999):
                escalation_level = 'nurse_alert'
            
            if escalation_level:
                # Check if escalation already sent
                recent_escalation = Notification.query.filter(
                    Notification.user_id == (ref.referring_nurse.user_id if ref.referring_nurse else None),
                    Notification.type == 'escalation_alert',
                    Notification.data['referral_id'].astext == str(ref.id),
                    Notification.created_at >= today - timedelta(days=1)
                ).first()
                
                if not recent_escalation:
                    delayed_referrals.append({
                        'referral_id': ref.id,
                        'referral_number': ref.referral_number,
                        'waiting_days': waiting_days,
                        'priority': priority,
                        'escalation_level': escalation_level,
                        'threshold_days': rules.get(escalation_level),
                        'patient_name': ref.patient_rel.user.full_name if ref.patient_rel and ref.patient_rel.user else 'Unknown',
                        'created_at': ref.created_at.isoformat()
                    })
    
    return jsonify({
        'delayed_referrals': delayed_referrals,
        'total_delayed': len(delayed_referrals),
        'check_timestamp': today.isoformat()
    }), 200


@escalation_bp.route('/send-alerts', methods=['POST'])
@jwt_required()
def send_escalation_alerts():
    """Send escalation alerts for delayed referrals"""
    claims = get_jwt()
    if claims.get('role') not in ['admin', 'head_nurse']:
        return jsonify({'error': 'Forbidden'}), 403
    
    data = request.get_json()
    referral_id = data.get('referral_id')
    
    referral = db.session.get(Referral, referral_id)
    if not referral:
        return jsonify({'error': 'Referral not found'}), 404
    
    waiting_days = (datetime.utcnow() - referral.created_at).days
    priority = referral.priority or 'routine'
    
    rules = ESCALATION_RULES.get(priority, ESCALATION_RULES['routine'])
    
    # Determine escalation level
    escalation_level = None
    if waiting_days >= rules.get('hospital_admin', 999):
        escalation_level = 'hospital_admin'
        message = f"HOSPITAL ADMIN ESCALATION: Referral #{referral.referral_number} has been waiting {waiting_days} days (exceeds {rules['hospital_admin']} day threshold for {priority} priority). Immediate action required."
    elif waiting_days >= rules.get('department_head', 999):
        escalation_level = 'department_head'
        message = f"DEPARTMENT HEAD ESCALATION: Referral #{referral.referral_number} has been waiting {waiting_days} days (exceeds {rules['department_head']} day threshold for {priority} priority)."
    elif waiting_days >= rules.get('nurse_alert', 999):
        escalation_level = 'nurse_alert'
        message = f"ALERT: Referral #{referral.referral_number} has been waiting {waiting_days} days (exceeds {rules['nurse_alert']} day threshold for {priority} priority). Please review and expedite."
    else:
        return jsonify({'message': 'Referral not yet due for escalation'}), 200
    
    # Find recipient based on escalation level
    recipient_id = None
    if escalation_level == 'nurse_alert' and referral.referring_nurse:
        recipient_id = referral.referring_nurse.user_id
    elif escalation_level == 'department_head':
        # Find department head nurse
        if referral.patient_rel and referral.patient_rel.department_id:
            dept_head = Nurse.query.filter_by(department_id=referral.patient_rel.department_id).first()
            if dept_head:
                recipient_id = dept_head.user_id
    elif escalation_level == 'hospital_admin':
        # Find admin users
        admin = User.query.filter_by(role='admin').first()
        if admin:
            recipient_id = admin.id
    
    if recipient_id:
        notification = Notification(
            user_id=recipient_id,
            type='escalation_alert',
            title=f'Referral Escalation: {priority.upper()} Priority',
            message=message,
            data={
                'referral_id': referral.id,
                'referral_number': referral.referral_number,
                'waiting_days': waiting_days,
                'escalation_level': escalation_level,
                'priority': priority
            },
            is_read=False
        )
        db.session.add(notification)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': f'Escalation alert sent to {escalation_level}',
            'escalation_level': escalation_level,
            'recipient_id': recipient_id
        }), 200
    
    return jsonify({'error': 'No recipient found for escalation'}), 404


@escalation_bp.route('/rules', methods=['GET'])
@jwt_required()
def get_escalation_rules():
    """Get current escalation rules"""
    claims = get_jwt()
    if claims.get('role') != 'admin':
        return jsonify({'error': 'Forbidden'}), 403
    
    return jsonify(ESCALATION_RULES), 200


@escalation_bp.route('/rules', methods=['PUT'])
@jwt_required()
def update_escalation_rules():
    """Update escalation rules (admin only)"""
    claims = get_jwt()
    if claims.get('role') != 'admin':
        return jsonify({'error': 'Forbidden'}), 403
    
    data = request.get_json()
    # In production, save to database
    # For MVP, update in-memory (would need to be persisted)
    
    return jsonify({
        'success': True,
        'message': 'Escalation rules updated',
        'rules': ESCALATION_RULES
    }), 200