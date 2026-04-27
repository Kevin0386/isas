"""
Advanced Analytics Service for Population Health Management
Provides referral pattern analysis, bottleneck detection, and forecasting
"""

from datetime import datetime, timedelta, date
from typing import Dict, List, Tuple, Optional
from collections import defaultdict, Counter
from dataclasses import dataclass
import statistics

@dataclass
class ReferralFlow:
    source_facility: str
    target_facility: str
    count: int
    avg_wait_time: float
    priority_distribution: Dict[str, int]

class AnalyticsService:
    """Healthcare analytics and population health management"""
    
    @classmethod
    def analyze_referral_network(cls, referrals: List[Dict]) -> Dict:
        """
        Analyze referral patterns between facilities
        Identifies most common referral pathways and bottlenecks
        """
        flows = defaultdict(lambda: {
            'count': 0,
            'total_wait_time': 0,
            'priorities': Counter()
        })
        
        for ref in referrals:
            source = ref.get('referring_facility_name', 'unknown')
            target = ref.get('referred_to_facility_name', 'unknown')
            key = (source, target)
            
            flows[key]['count'] += 1
            if ref.get('waiting_days'):
                flows[key]['total_wait_time'] += ref['waiting_days']
            flows[key]['priorities'][ref.get('priority', 'routine')] += 1
        
        network = []
        for (source, target), data in flows.items():
            avg_wait = data['total_wait_time'] / data['count'] if data['count'] > 0 else 0
            
            network.append({
                'source': source,
                'target': target,
                'count': data['count'],
                'avg_wait_days': round(avg_wait, 1),
                'priority_breakdown': dict(data['priorities'])
            })
        
        # Sort by volume
        network.sort(key=lambda x: x['count'], reverse=True)
        
        # Identify top pathways
        top_pathways = network[:10]
        
        # Calculate total referral volume
        total_volume = sum(f['count'] for f in network)
        
        return {
            'total_referrals': total_volume,
            'unique_pathways': len(network),
            'top_pathways': top_pathways,
            'network_visualization_data': {
                'nodes': cls._extract_nodes(network),
                'edges': network
            }
        }
    
    @classmethod
    def _extract_nodes(cls, network: List[Dict]) -> List[Dict]:
        """Extract unique facility nodes from network"""
        nodes = set()
        for edge in network:
            nodes.add(edge['source'])
            nodes.add(edge['target'])
        
        return [{'id': node, 'label': node} for node in nodes]
    
    @classmethod
    def identify_bottlenecks(cls, referrals: List[Dict], appointments: List[Dict]) -> Dict:
        """
        Identify bottlenecks in referral process
        Returns stages with longest delays and highest volumes
        """
        bottlenecks = []
        
        # Stage 1: Referral to Assignment
        assignment_delays = []
        for ref in referrals:
            if ref.get('assigned_at') and ref.get('created_at'):
                delay = (ref['assigned_at'] - ref['created_at']).days
                assignment_delays.append(delay)
        
        if assignment_delays:
            bottlenecks.append({
                'stage': 'Referral to Specialist Assignment',
                'avg_delay_days': round(statistics.mean(assignment_delays), 1),
                'max_delay_days': max(assignment_delays),
                'p95_delay_days': cls._percentile(assignment_delays, 95),
                'volume': len(assignment_delays)
            })
        
        # Stage 2: Assignment to Appointment
        scheduling_delays = []
        for apt in appointments:
            if apt.get('appointment_date') and apt.get('referral_created_at'):
                delay = (apt['appointment_date'] - apt['referral_created_at']).days
                scheduling_delays.append(delay)
        
        if scheduling_delays:
            bottlenecks.append({
                'stage': 'Assignment to Appointment Scheduling',
                'avg_delay_days': round(statistics.mean(scheduling_delays), 1),
                'max_delay_days': max(scheduling_delays),
                'p95_delay_days': cls._percentile(scheduling_delays, 95),
                'volume': len(scheduling_delays)
            })
        
        # Stage 3: Appointment to Completion
        completion_delays = []
        for apt in appointments:
            if apt.get('completed_at') and apt.get('appointment_date'):
                delay = (apt['completed_at'] - apt['appointment_date']).days
                if delay > 0:
                    completion_delays.append(delay)
        
        if completion_delays:
            bottlenecks.append({
                'stage': 'Appointment to Completion',
                'avg_delay_days': round(statistics.mean(completion_delays), 1),
                'max_delay_days': max(completion_delays),
                'p95_delay_days': cls._percentile(completion_delays, 95),
                'volume': len(completion_delays)
            })
        
        # Sort by average delay (largest first)
        bottlenecks.sort(key=lambda x: x['avg_delay_days'], reverse=True)
        
        return {
            'bottlenecks': bottlenecks,
            'recommendations': cls._generate_bottleneck_recommendations(bottlenecks),
            'overall_average_days': cls._calculate_overall_avg(referrals, appointments)
        }
    
    @classmethod
    def _percentile(cls, data: List, percentile: int) -> float:
        """Calculate percentile of data"""
        if not data:
            return 0
        sorted_data = sorted(data)
        index = int(len(sorted_data) * percentile / 100)
        return round(sorted_data[min(index, len(sorted_data) - 1)], 1)
    
    @classmethod
    def _generate_bottleneck_recommendations(cls, bottlenecks: List[Dict]) -> List[str]:
        """Generate actionable recommendations based on bottlenecks"""
        recommendations = []
        
        for b in bottlenecks[:2]:  # Top 2 bottlenecks
            if b['avg_delay_days'] > 14:
                recommendations.append(
                    f"⚠️ {b['stage']} has {b['avg_delay_days']} days average delay. "
                    f"Consider additional staff or process automation."
                )
            elif b['avg_delay_days'] > 7:
                recommendations.append(
                    f"📋 {b['stage']} has {b['avg_delay_days']} days average delay. "
                    f"Review workflow for optimization opportunities."
                )
        
        if not recommendations:
            recommendations.append("✅ No significant bottlenecks detected. System performing well.")
        
        return recommendations
    
    @classmethod
    def _calculate_overall_avg(cls, referrals: List[Dict], appointments: List[Dict]) -> float:
        """Calculate overall average wait time"""
        all_waits = []
        for apt in appointments:
            if apt.get('appointment_date') and apt.get('referral_created_at'):
                wait = (apt['appointment_date'] - apt['referral_created_at']).days
                all_waits.append(wait)
        
        if all_waits:
            return round(statistics.mean(all_waits), 1)
        return 0
    
    @classmethod
    def analyze_seasonal_trends(cls, referrals: List[Dict]) -> Dict:
        """
        Detect seasonal patterns in referral volumes
        Useful for resource planning
        """
        monthly_volume = defaultdict(int)
        monthly_by_priority = defaultdict(lambda: defaultdict(int))
        
        for ref in referrals:
            if ref.get('created_at'):
                month_key = ref['created_at'].strftime('%Y-%m')
                monthly_volume[month_key] += 1
                monthly_by_priority[month_key][ref.get('priority', 'routine')] += 1
        
        # Calculate trends
        months = sorted(monthly_volume.keys())
        volumes = [monthly_volume[m] for m in months]
        
        if len(volumes) >= 3:
            # Simple trend detection
            first_half = sum(volumes[:len(volumes)//2]) / max(len(volumes)//2, 1)
            second_half = sum(volumes[len(volumes)//2:]) / max(len(volumes) - len(volumes)//2, 1)
            
            if second_half > first_half * 1.2:
                trend = "increasing"
                trend_message = "Referral volume is increasing over time. Consider resource expansion."
            elif second_half < first_half * 0.8:
                trend = "decreasing"
                trend_message = "Referral volume is decreasing over time."
            else:
                trend = "stable"
                trend_message = "Referral volume is stable."
        else:
            trend = "insufficient_data"
            trend_message = "Insufficient data for trend analysis."
        
        # Identify peak months
        peak_month = max(monthly_volume.items(), key=lambda x: x[1]) if monthly_volume else None
        
        return {
            'monthly_volume': dict(monthly_volume),
            'monthly_by_priority': {k: dict(v) for k, v in monthly_by_priority.items()},
            'trend': trend,
            'trend_message': trend_message,
            'peak_month': peak_month[0] if peak_month else None,
            'peak_volume': peak_month[1] if peak_month else 0,
            'average_monthly_volume': round(statistics.mean(volumes), 1) if volumes else 0
        }
    
    @classmethod
    def generate_heatmap_data(cls, referrals: List[Dict]) -> Dict:
        """
        Generate geographic heatmap data for referral origins
        """
        district_counts = defaultdict(int)
        village_counts = defaultdict(int)
        
        for ref in referrals:
            district = ref.get('patient_district', 'unknown')
            village = ref.get('patient_village', 'unknown')
            district_counts[district] += 1
            village_counts[village] += 1
        
        return {
            'by_district': [{'district': d, 'count': c} for d, c in sorted(district_counts.items(), key=lambda x: x[1], reverse=True)],
            'by_village': [{'village': v, 'count': c} for v, c in sorted(village_counts.items(), key=lambda x: x[1], reverse=True)[:20]],
            'total_referrals': sum(district_counts.values())
        }
    
    @classmethod
    def calculate_specialist_utilization(cls, specialists: List[Dict], appointments: List[Dict]) -> Dict:
        """
        Calculate specialist utilization metrics
        Identifies over/under-utilized specialists
        """
        specialist_stats = {}
        
        # Initialize stats for each specialist
        for spec in specialists:
            specialist_stats[spec['id']] = {
                'name': spec['name'],
                'specialty': spec['specialty'],
                'total_appointments': 0,
                'completed_appointments': 0,
                'missed_appointments': 0,
                'cancelled_appointments': 0,
                'capacity_per_day': spec.get('max_patients_per_day', 15),
                'working_days_per_week': 5
            }
        
        # Aggregate appointment data
        for apt in appointments:
            spec_id = apt.get('specialist_id')
            if spec_id in specialist_stats:
                specialist_stats[spec_id]['total_appointments'] += 1
                status = apt.get('status', '')
                if status == 'completed':
                    specialist_stats[spec_id]['completed_appointments'] += 1
                elif status == 'missed':
                    specialist_stats[spec_id]['missed_appointments'] += 1
                elif status == 'cancelled':
                    specialist_stats[spec_id]['cancelled_appointments'] += 1
        
        # Calculate utilization rates
        results = []
        for spec_id, stats in specialist_stats.items():
            theoretical_capacity = stats['capacity_per_day'] * stats['working_days_per_week'] * 4  # Monthly
            utilization_rate = (stats['total_appointments'] / theoretical_capacity * 100) if theoretical_capacity > 0 else 0
            
            status = "optimal"
            if utilization_rate > 90:
                status = "over_utilized"
            elif utilization_rate < 40:
                status = "under_utilized"
            
            results.append({
                'specialist_id': spec_id,
                'name': stats['name'],
                'specialty': stats['specialty'],
                'total_appointments': stats['total_appointments'],
                'completion_rate': round(stats['completed_appointments'] / stats['total_appointments'] * 100, 1) if stats['total_appointments'] > 0 else 0,
                'missed_rate': round(stats['missed_appointments'] / stats['total_appointments'] * 100, 1) if stats['total_appointments'] > 0 else 0,
                'utilization_rate': round(utilization_rate, 1),
                'utilization_status': status,
                'recommendation': cls._get_utilization_recommendation(status, stats['specialty'])
            })
        
        return {
            'specialists': results,
            'summary': {
                'total_specialists': len(results),
                'over_utilized': len([r for r in results if r['utilization_status'] == 'over_utilized']),
                'under_utilized': len([r for r in results if r['utilization_status'] == 'under_utilized']),
                'optimal': len([r for r in results if r['utilization_status'] == 'optimal']),
                'average_utilization': round(statistics.mean([r['utilization_rate'] for r in results]), 1) if results else 0
            }
        }
    
    @classmethod
    def _get_utilization_recommendation(cls, status: str, specialty: str) -> str:
        """Get recommendation based on utilization status"""
        if status == 'over_utilized':
            return f"Consider redistributing workload or hiring additional {specialty} specialist"
        elif status == 'under_utilized':
            return f"Increase referrals to this specialist or review scheduling practices"
        else:
            return "Utilization is optimal - maintain current practices"