#!/usr/bin/env python3
"""
Automated Hunt Manager - Complete Automation Framework
Continuous autonomous hunting with scheduling and monitoring
"""

import asyncio
import json
import os
import time
import schedule
import threading
from datetime import datetime, timedelta
from pathlib import Path
import subprocess
import logging
from autonomous_hunter import AutonomousImmunifyHunter

class HuntManager:
    def __init__(self):
        self.config = self.load_config()
        self.setup_logging()
        self.hunter = AutonomousImmunifyHunter()
        self.running = False
        self.stats = {
            'cycles_completed': 0,
            'total_submissions': 0,
            'total_bounty_potential': 0,
            'last_run': None,
            'next_run': None
        }
        
    def load_config(self):
        """Load or create configuration"""
        config_file = 'hunt_manager_config.json'
        
        default_config = {
            'automation': {
                'enabled': True,
                'schedule_hours': [6, 12, 18, 0],  # Run 4 times per day
                'chains_per_cycle': ['base', 'arbitrum', 'polygon'],
                'max_targets_per_chain': 30,
                'concurrent_chains': 2
            },
            'alerts': {
                'bounty_threshold': 50000,  # Alert for bounties > $50K
                'telegram_enabled': False,
                'telegram_chat_id': '',
                'discord_webhook': '',
                'email_enabled': False
            },
            'safety': {
                'auto_submission_enabled': False,  # Always require manual approval
                'max_daily_submissions': 5,
                'require_manual_review': True,
                'testnet_only': True
            },
            'storage': {
                'results_directory': 'hunt_results',
                'archive_after_days': 30,
                'backup_enabled': True
            },
            'monitoring': {
                'performance_tracking': True,
                'success_rate_tracking': True,
                'error_reporting': True
            }
        }
        
        if os.path.exists(config_file):
            with open(config_file, 'r') as f:
                config = json.load(f)
        else:
            config = default_config
            with open(config_file, 'w') as f:
                json.dump(config, f, indent=2)
                
        return config
    
    def setup_logging(self):
        """Setup comprehensive logging"""
        log_dir = Path(self.config['storage']['results_directory']) / 'logs'
        log_dir.mkdir(parents=True, exist_ok=True)
        
        log_file = log_dir / f"hunt_manager_{datetime.now().strftime('%Y%m%d')}.log"
        
        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
            handlers=[
                logging.FileHandler(log_file),
                logging.StreamHandler()
            ]
        )
        self.logger = logging.getLogger('HuntManager')
        
    async def execute_hunt_cycle(self):
        """Execute complete automated hunt cycle"""
        self.logger.info("🐇 STARTING AUTOMATED HUNT CYCLE")
        
        cycle_start = time.time()
        cycle_id = datetime.now().strftime('%Y%m%d_%H%M%S')
        
        all_submissions = []
        cycle_stats = {
            'cycle_id': cycle_id,
            'start_time': datetime.now().isoformat(),
            'chains': self.config['automation']['chains_per_cycle'],
            'results': {}
        }
        
        # Hunt each configured chain
        for chain in self.config['automation']['chains_per_cycle']:
            self.logger.info(f"🎯 Hunting chain: {chain.upper()}")
            
            try:
                submissions, summary = await self.hunter.autonomous_hunt_cycle(
                    chain=chain,
                    max_targets=self.config['automation']['max_targets_per_chain']
                )
                
                cycle_stats['results'][chain] = {
                    'submissions': len(submissions),
                    'bounty_potential': summary['total_bounty_potential'],
                    'duration': summary['duration_seconds']
                }
                
                all_submissions.extend(submissions)
                self.logger.info(f"✅ {chain}: {len(submissions)} submissions, ${summary['total_bounty_potential']:,.0f}")
                
            except Exception as e:
                self.logger.error(f"❌ Error hunting {chain}: {e}")
                cycle_stats['results'][chain] = {'error': str(e)}
        
        # Process results
        cycle_duration = time.time() - cycle_start
        total_bounty = sum(s.total_bounty for s in all_submissions)
        
        cycle_stats.update({
            'end_time': datetime.now().isoformat(),
            'duration_seconds': cycle_duration,
            'total_submissions': len(all_submissions),
            'total_bounty_potential': total_bounty,
            'high_value_submissions': [s for s in all_submissions if s.total_bounty >= self.config['alerts']['bounty_threshold']]
        })
        
        # Update global stats
        self.stats['cycles_completed'] += 1
        self.stats['total_submissions'] += len(all_submissions)
        self.stats['total_bounty_potential'] += total_bounty
        self.stats['last_run'] = datetime.now().isoformat()
        
        # Save cycle results
        await self.save_cycle_results(cycle_stats, all_submissions)
        
        # Send alerts for high-value findings
        if cycle_stats['high_value_submissions']:
            await self.send_alerts(cycle_stats['high_value_submissions'])
        
        self.logger.info(f"🚨 CYCLE COMPLETE: {len(all_submissions)} submissions, ${total_bounty:,.0f} total")
        
        return cycle_stats
    
    async def save_cycle_results(self, cycle_stats, submissions):
        """Save cycle results and organize files"""
        results_dir = Path(self.config['storage']['results_directory'])
        cycle_dir = results_dir / f"cycle_{cycle_stats['cycle_id']}"
        cycle_dir.mkdir(parents=True, exist_ok=True)
        
        # Save cycle summary
        with open(cycle_dir / 'cycle_summary.json', 'w') as f:
            json.dump(cycle_stats, f, indent=2)
        
        # Save detailed submissions
        submissions_data = []
        for submission in submissions:
            submission_data = {
                'protocol': submission.protocol,
                'total_bounty': submission.total_bounty,
                'vulnerabilities': [
                    {
                        'type': v.vulnerability,
                        'severity': v.severity,
                        'description': v.description,
                        'value': v.exploitable_value,
                        'confidence': v.confidence
                    } for v in submission.vulnerabilities
                ],
                'evidence_files': submission.evidence_files,
                'submission_ready': submission.submission_ready
            }
            submissions_data.append(submission_data)
        
        with open(cycle_dir / 'submissions.json', 'w') as f:
            json.dump(submissions_data, f, indent=2)
        
        # Generate human-readable summary
        summary_md = f"""# Hunt Cycle Summary - {cycle_stats['cycle_id']}

## Overview
- **Start Time:** {cycle_stats['start_time']}
- **Duration:** {cycle_stats['duration_seconds']:.1f} seconds
- **Chains:** {', '.join(cycle_stats['chains'])}
- **Total Submissions:** {cycle_stats['total_submissions']}
- **Total Bounty Potential:** ${cycle_stats['total_bounty_potential']:,.0f}

## Results by Chain
"""
        
        for chain, result in cycle_stats['results'].items():
            if 'error' in result:
                summary_md += f"- **{chain.upper()}:** Error - {result['error']}\n"
            else:
                summary_md += f"- **{chain.upper()}:** {result['submissions']} submissions, ${result['bounty_potential']:,.0f}\n"
        
        if cycle_stats['high_value_submissions']:
            summary_md += f"\n## High-Value Submissions (>${self.config['alerts']['bounty_threshold']:,.0f})\n"
            for submission in cycle_stats['high_value_submissions']:
                summary_md += f"- **{submission.protocol}:** ${submission.total_bounty:,.0f}\n"
        
        with open(cycle_dir / 'SUMMARY.md', 'w') as f:
            f.write(summary_md)
        
        # Update global stats
        with open(results_dir / 'global_stats.json', 'w') as f:
            json.dump(self.stats, f, indent=2)
    
    async def send_alerts(self, high_value_submissions):
        """Send alerts for high-value findings"""
        alert_text = f"🚨 HIGH-VALUE IMMUNIFY TARGETS FOUND!\n\n"
        alert_text += f"Found {len(high_value_submissions)} high-value submissions:\n\n"
        
        for submission in high_value_submissions:
            alert_text += f"🔴 **{submission.protocol}**\n"
            alert_text += f"   💰 Bounty Potential: ${submission.total_bounty:,.0f}\n"
            alert_text += f"   🚨 Vulnerabilities: {len(submission.vulnerabilities)}\n\n"
        
        self.logger.info(f"🚨 ALERT: {len(high_value_submissions)} high-value targets found!")
        
        # TODO: Implement actual alert sending (Telegram, Discord, Email)
        # For now, just log and save alert
        alert_file = f"ALERT_{datetime.now().strftime('%Y%m%d_%H%M%S')}.md"
        with open(alert_file, 'w') as f:
            f.write(alert_text)
    
    def schedule_hunts(self):
        """Set up automated hunting schedule"""
        self.logger.info("📅 Setting up automated hunting schedule...")
        
        for hour in self.config['automation']['schedule_hours']:
            schedule.every().day.at(f"{hour:02d}:00").do(self.run_hunt_cycle)
            self.logger.info(f"   📋 Scheduled hunt at {hour:02d}:00")
        
        self.logger.info("✅ Automated schedule configured")
    
    def run_hunt_cycle(self):
        """Wrapper for running hunt cycle in scheduler"""
        if not self.running:
            self.running = True
            try:
                asyncio.run(self.execute_hunt_cycle())
            except Exception as e:
                self.logger.error(f"❌ Error in scheduled hunt: {e}")
            finally:
                self.running = False
    
    def start_automation(self):
        """Start the automated hunting system"""
        self.logger.info("🚀 STARTING AUTOMATED IMMUNIFY HUNTING SYSTEM")
        
        if not self.config['automation']['enabled']:
            self.logger.warning("⚠️  Automation disabled in config")
            return
        
        # Set up schedule
        self.schedule_hunts()
        
        # Start scheduler thread
        def run_scheduler():
            while True:
                schedule.run_pending()
                time.sleep(60)  # Check every minute
        
        scheduler_thread = threading.Thread(target=run_scheduler, daemon=True)
        scheduler_thread.start()
        
        # Set next run time
        next_run = schedule.next_run()
        self.stats['next_run'] = next_run.isoformat() if next_run else None
        
        self.logger.info(f"✅ Automation started - Next run: {next_run}")
        
        return True
    
    def status(self):
        """Get current status"""
        status = {
            'running': self.running,
            'automation_enabled': self.config['automation']['enabled'],
            'stats': self.stats,
            'next_scheduled_run': schedule.next_run(),
            'config': self.config
        }
        return status
    
    async def manual_hunt(self, chain='base', max_targets=10):
        """Trigger manual hunt cycle"""
        self.logger.info(f"🎯 MANUAL HUNT TRIGGERED: {chain}")
        
        if self.running:
            self.logger.warning("⚠️  Hunt already running, skipping manual trigger")
            return None
        
        self.running = True
        try:
            submissions, summary = await self.hunter.autonomous_hunt_cycle(
                chain=chain, 
                max_targets=max_targets
            )
            return summary
        finally:
            self.running = False

def create_automation_cli():
    """Create CLI interface for automation management"""
    import argparse
    
    parser = argparse.ArgumentParser(description='WhiteRabbit Automated Immunify Hunter')
    parser.add_argument('command', choices=['start', 'status', 'hunt', 'config', 'stop'])
    parser.add_argument('--chain', default='base', help='Chain for manual hunt')
    parser.add_argument('--targets', type=int, default=10, help='Max targets for manual hunt')
    
    return parser

async def main():
    """Main automation interface"""
    parser = create_automation_cli()
    args = parser.parse_args()
    
    manager = HuntManager()
    
    if args.command == 'start':
        print("🐇 WHITERABBIT AUTOMATION STARTING...")
        manager.start_automation()
        
        print("✅ Automation system running!")
        print(f"📅 Scheduled hunts: {len(manager.config['automation']['schedule_hours'])} times per day")
        print(f"🎯 Chains: {', '.join(manager.config['automation']['chains_per_cycle'])}")
        print(f"💰 Alert threshold: ${manager.config['alerts']['bounty_threshold']:,}")
        
        try:
            # Keep running until interrupted
            while True:
                time.sleep(60)
                # Print status every hour
                if datetime.now().minute == 0:
                    status = manager.status()
                    print(f"🔄 Status: {status['stats']['cycles_completed']} cycles, ${status['stats']['total_bounty_potential']:,.0f} total")
                    
        except KeyboardInterrupt:
            print("\n🛑 Automation stopped by user")
            
    elif args.command == 'status':
        status = manager.status()
        print(f"🐇 WHITERABBIT AUTOMATION STATUS")
        print(f"Running: {status['running']}")
        print(f"Cycles completed: {status['stats']['cycles_completed']}")
        print(f"Total submissions: {status['stats']['total_submissions']}")
        print(f"Total bounty potential: ${status['stats']['total_bounty_potential']:,.0f}")
        print(f"Last run: {status['stats']['last_run']}")
        print(f"Next run: {status['next_scheduled_run']}")
        
    elif args.command == 'hunt':
        print(f"🎯 Manual hunt starting on {args.chain}...")
        summary = await manager.manual_hunt(args.chain, args.targets)
        if summary:
            print(f"✅ Hunt complete: {summary['high_value_submissions']} submissions")
            print(f"💰 Bounty potential: ${summary['total_bounty_potential']:,.0f}")
        else:
            print("⚠️  Hunt already running or failed")
            
    elif args.command == 'config':
        print("📋 Current configuration:")
        print(json.dumps(manager.config, indent=2))
        
    elif args.command == 'stop':
        print("🛑 Stopping automation...")
        # TODO: Implement graceful shutdown

if __name__ == '__main__':
    asyncio.run(main())