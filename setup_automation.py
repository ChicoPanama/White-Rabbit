#!/usr/bin/env python3
"""
WhiteRabbit Automation Setup
Complete automated setup for autonomous Immunify bounty hunting
"""

import os
import subprocess
import json
import sys
from pathlib import Path
import requests

class AutomationSetup:
    def __init__(self):
        self.setup_dir = Path.cwd()
        self.venv_dir = self.setup_dir / "whiterabbit_env"
        
    def run_command(self, command, description):
        """Run shell command with error handling"""
        print(f"🔧 {description}...")
        try:
            result = subprocess.run(command, shell=True, check=True, capture_output=True, text=True)
            print(f"   ✅ Success: {description}")
            return result.stdout
        except subprocess.CalledProcessError as e:
            print(f"   ❌ Error: {e}")
            print(f"   Output: {e.stdout}")
            print(f"   Error: {e.stderr}")
            return None
    
    def setup_python_environment(self):
        """Setup Python virtual environment and dependencies"""
        print("🐍 SETTING UP PYTHON ENVIRONMENT")
        
        # Create virtual environment
        self.run_command(f"python3 -m venv {self.venv_dir}", "Creating virtual environment")
        
        # Install required packages
        pip_path = self.venv_dir / "bin" / "pip"
        packages = [
            "requests>=2.31.0",
            "asyncio",
            "schedule>=1.2.0", 
            "aiohttp>=3.8.0",
            "web3>=6.0.0",
            "pathlib",
            "dataclasses"
        ]
        
        package_str = " ".join(packages)
        self.run_command(f"{pip_path} install {package_str}", "Installing Python dependencies")
        
        print("✅ Python environment ready")
    
    def create_directory_structure(self):
        """Create organized directory structure"""
        print("📁 CREATING DIRECTORY STRUCTURE")
        
        directories = [
            "hunt_results",
            "hunt_results/logs", 
            "hunt_results/evidence",
            "hunt_results/poc_frameworks",
            "hunt_results/submissions",
            "config",
            "scripts",
            "backups"
        ]
        
        for directory in directories:
            Path(directory).mkdir(parents=True, exist_ok=True)
            print(f"   📁 Created: {directory}")
        
        print("✅ Directory structure created")
    
    def create_automation_config(self):
        """Create automation configuration"""
        print("⚙️  CREATING AUTOMATION CONFIGURATION")
        
        config = {
            "automation": {
                "enabled": True,
                "schedule_hours": [6, 12, 18, 0],
                "chains_per_cycle": ["base", "arbitrum", "polygon"],
                "max_targets_per_chain": 50,
                "concurrent_chains": 3
            },
            "hunting": {
                "tvl_range": {"min": 10000, "max": 1000000},
                "alert_threshold": 25000,
                "max_concurrent": 15,
                "scan_interval_hours": 6
            },
            "alerts": {
                "bounty_threshold": 50000,
                "telegram_enabled": False,
                "telegram_chat_id": "",
                "discord_webhook": "",
                "email_enabled": False
            },
            "safety": {
                "auto_submission_enabled": False,
                "max_daily_submissions": 10,
                "require_manual_review": True,
                "testnet_only": True,
                "never_exploit_mainnet": True
            },
            "storage": {
                "results_directory": "hunt_results",
                "archive_after_days": 30,
                "backup_enabled": True
            },
            "monitoring": {
                "performance_tracking": True,
                "success_rate_tracking": True,
                "error_reporting": True,
                "log_level": "INFO"
            },
            "rpc_endpoints": {
                "base": "https://mainnet.base.org",
                "ethereum": "https://eth.llamarpc.com",
                "arbitrum": "https://arb1.arbitrum.io/rpc",
                "polygon": "https://polygon.llamarpc.com",
                "optimism": "https://optimism.llamarpc.com"
            }
        }
        
        with open("config/automation_config.json", "w") as f:
            json.dump(config, f, indent=2)
        
        print("✅ Configuration created")
        return config
    
    def create_start_script(self):
        """Create startup scripts"""
        print("📝 CREATING STARTUP SCRIPTS")
        
        # Main startup script
        startup_script = '''#!/bin/bash
# WhiteRabbit Automation Startup Script

echo "🐇 WHITERABBIT AUTONOMOUS IMMUNIFY HUNTER"
echo "========================================"

# Activate virtual environment
source whiterabbit_env/bin/activate

echo "🚀 Starting automation system..."
python automated_hunt_manager.py start

echo "✅ WhiteRabbit automation running!"
'''
        
        with open("scripts/start_automation.sh", "w") as f:
            f.write(startup_script)
        
        os.chmod("scripts/start_automation.sh", 0o755)
        
        # Manual hunt script
        manual_hunt_script = '''#!/bin/bash
# Manual Hunt Trigger Script

if [ $# -eq 0 ]; then
    echo "Usage: $0 <chain> [max_targets]"
    echo "Chains: base, ethereum, arbitrum, polygon, optimism"
    exit 1
fi

source whiterabbit_env/bin/activate

CHAIN=$1
TARGETS=${2:-20}

echo "🎯 Triggering manual hunt on $CHAIN (max $TARGETS targets)..."
python automated_hunt_manager.py hunt --chain $CHAIN --targets $TARGETS
'''
        
        with open("scripts/manual_hunt.sh", "w") as f:
            f.write(manual_hunt_script)
        
        os.chmod("scripts/manual_hunt.sh", 0o755)
        
        # Status check script
        status_script = '''#!/bin/bash
# Status Check Script

source whiterabbit_env/bin/activate
python automated_hunt_manager.py status
'''
        
        with open("scripts/check_status.sh", "w") as f:
            f.write(status_script)
        
        os.chmod("scripts/check_status.sh", 0o755)
        
        print("✅ Startup scripts created")
    
    def create_systemd_service(self):
        """Create systemd service for automatic startup"""
        print("🔧 CREATING SYSTEMD SERVICE")
        
        service_content = f'''[Unit]
Description=WhiteRabbit Autonomous Immunify Hunter
After=network.target

[Service]
Type=simple
User={os.getenv('USER', 'ubuntu')}
WorkingDirectory={self.setup_dir}
ExecStart={self.setup_dir}/whiterabbit_env/bin/python {self.setup_dir}/automated_hunt_manager.py start
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
'''
        
        service_file = "config/whiterabbit.service"
        with open(service_file, "w") as f:
            f.write(service_content)
        
        print(f"✅ Systemd service file created: {service_file}")
        print("   To install: sudo cp config/whiterabbit.service /etc/systemd/system/")
        print("   To enable: sudo systemctl enable whiterabbit")
        print("   To start: sudo systemctl start whiterabbit")
    
    def create_monitoring_dashboard(self):
        """Create simple monitoring dashboard"""
        print("📊 CREATING MONITORING DASHBOARD")
        
        dashboard_html = '''<!DOCTYPE html>
<html>
<head>
    <title>WhiteRabbit Hunt Monitor</title>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background: #1a1a1a; color: #fff; }
        .container { max-width: 1200px; margin: 0 auto; }
        .header { text-align: center; margin-bottom: 30px; }
        .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .stat-box { background: #2a2a2a; padding: 20px; border-radius: 8px; border-left: 4px solid #00ff00; }
        .stat-number { font-size: 2em; font-weight: bold; color: #00ff00; }
        .stat-label { color: #ccc; margin-top: 5px; }
        .submissions { background: #2a2a2a; padding: 20px; border-radius: 8px; }
        .submission-item { background: #3a3a3a; margin: 10px 0; padding: 15px; border-radius: 5px; border-left: 3px solid #ff6b6b; }
        .submission-title { font-weight: bold; color: #ff6b6b; }
        .submission-value { color: #00ff00; font-size: 1.2em; margin: 5px 0; }
        .last-updated { text-align: center; margin-top: 20px; color: #888; }
    </style>
    <script>
        async function loadStats() {
            try {
                const response = await fetch('hunt_results/global_stats.json');
                const stats = await response.json();
                
                document.getElementById('cycles').textContent = stats.cycles_completed || 0;
                document.getElementById('submissions').textContent = stats.total_submissions || 0;
                document.getElementById('bounty').textContent = '$' + (stats.total_bounty_potential || 0).toLocaleString();
                document.getElementById('last-run').textContent = stats.last_run || 'Never';
                
                document.getElementById('last-updated').textContent = 'Last updated: ' + new Date().toLocaleString();
            } catch (error) {
                console.error('Error loading stats:', error);
            }
        }
        
        setInterval(loadStats, 30000); // Update every 30 seconds
        loadStats(); // Load immediately
    </script>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🐇 WhiteRabbit Hunt Monitor</h1>
            <p>Autonomous Immunify Bounty Hunter</p>
        </div>
        
        <div class="stats">
            <div class="stat-box">
                <div class="stat-number" id="cycles">0</div>
                <div class="stat-label">Hunt Cycles</div>
            </div>
            <div class="stat-box">
                <div class="stat-number" id="submissions">0</div>
                <div class="stat-label">Total Submissions</div>
            </div>
            <div class="stat-box">
                <div class="stat-number" id="bounty">$0</div>
                <div class="stat-label">Total Bounty Potential</div>
            </div>
        </div>
        
        <div class="submissions">
            <h2>Recent High-Value Findings</h2>
            <div id="recent-submissions">
                <p>No recent submissions found. System will populate this as hunts complete.</p>
            </div>
        </div>
        
        <div class="last-updated" id="last-updated">
            Loading...
        </div>
    </div>
</body>
</html>'''
        
        with open("hunt_results/dashboard.html", "w") as f:
            f.write(dashboard_html)
        
        print("✅ Monitoring dashboard created: hunt_results/dashboard.html")
    
    def create_documentation(self):
        """Create comprehensive documentation"""
        print("📚 CREATING DOCUMENTATION")
        
        readme = '''# WhiteRabbit Autonomous Immunify Hunter

## Overview
Fully automated vulnerability hunting system for Immunify bounty programs.

## Features
- **Autonomous Discovery**: Automatically finds and analyzes protocols
- **Multi-Chain Support**: Base, Arbitrum, Polygon, Ethereum, Optimism
- **Vulnerability Detection**: Advanced bytecode analysis
- **Automated PoC Generation**: Non-destructive proof-of-concepts
- **Immunify Integration**: Ready-to-submit bounty packages
- **Safety First**: No mainnet exploitation, analysis only

## Quick Start
```bash
# Start automation
./scripts/start_automation.sh

# Check status
./scripts/check_status.sh

# Manual hunt
./scripts/manual_hunt.sh base 20
```

## Configuration
Edit `config/automation_config.json` to customize:
- Hunt schedules
- Chain preferences  
- Alert thresholds
- Safety settings

## Monitoring
- Dashboard: Open `hunt_results/dashboard.html` in browser
- Logs: Check `hunt_results/logs/`
- Results: Review `hunt_results/cycle_*/`

## Safety Features
- ✅ Read-only analysis
- ✅ Testnet PoCs only
- ✅ Manual submission approval required
- ✅ No automatic exploitation
- ✅ Responsible disclosure built-in

## Directory Structure
```
whiterabbit/
├── autonomous_hunter.py         # Core hunting engine
├── automated_hunt_manager.py    # Automation manager
├── config/                      # Configuration files
├── scripts/                     # Helper scripts
├── hunt_results/               # All results and evidence
├── whiterabbit_env/            # Python environment
└── README.md                   # This file
```

## Support
Check logs for errors. All operations are logged to `hunt_results/logs/`.

## Disclaimer
This tool is for authorized security research only. Always follow responsible disclosure practices and respect bug bounty program terms.
'''
        
        with open("README.md", "w") as f:
            f.write(readme)
        
        # Create troubleshooting guide
        troubleshooting = '''# Troubleshooting Guide

## Common Issues

### Python Environment
- **Issue**: ModuleNotFoundError
- **Solution**: `source whiterabbit_env/bin/activate`

### RPC Errors
- **Issue**: RPC connection failures
- **Solution**: Check `config/automation_config.json` RPC endpoints

### Permission Errors
- **Issue**: Cannot write files
- **Solution**: Check directory permissions: `chmod -R 755 hunt_results/`

### High CPU Usage
- **Issue**: Too many concurrent hunts
- **Solution**: Reduce `max_concurrent` in config

## Logs
Check these locations:
- `hunt_results/logs/hunt_manager_YYYYMMDD.log`
- `hunt_results/cycle_*/cycle_summary.json`

## Reset
To reset completely:
```bash
rm -rf hunt_results/
rm -rf whiterabbit_env/
python setup_automation.py
```
'''
        
        with open("TROUBLESHOOTING.md", "w") as f:
            f.write(troubleshooting)
        
        print("✅ Documentation created")
    
    def run_initial_test(self):
        """Run initial test to verify setup"""
        print("🧪 RUNNING INITIAL TEST")
        
        # Test import
        test_script = '''
import sys
sys.path.append(".")
from autonomous_hunter import AutonomousImmunifyHunter
from automated_hunt_manager import HuntManager

print("✅ Imports successful")

# Test configuration
hunter = AutonomousImmunifyHunter()
manager = HuntManager()

print("✅ Objects created successfully")
print("✅ All systems operational!")
'''
        
        with open("test_setup.py", "w") as f:
            f.write(test_script)
        
        python_path = self.venv_dir / "bin" / "python"
        result = self.run_command(f"{python_path} test_setup.py", "Testing setup")
        
        if result:
            print("✅ Initial test passed")
            os.remove("test_setup.py")
        else:
            print("❌ Initial test failed - check setup")
    
    def complete_setup(self):
        """Run complete automation setup"""
        print("🐇 WHITERABBIT AUTOMATION SETUP")
        print("=" * 50)
        
        self.setup_python_environment()
        self.create_directory_structure()
        self.create_automation_config()
        self.create_start_script()
        self.create_systemd_service() 
        self.create_monitoring_dashboard()
        self.create_documentation()
        self.run_initial_test()
        
        print("\n" + "=" * 50)
        print("🚀 SETUP COMPLETE!")
        print("=" * 50)
        
        print("\n📋 NEXT STEPS:")
        print("1. ✅ Start automation: ./scripts/start_automation.sh")
        print("2. ✅ Check status: ./scripts/check_status.sh") 
        print("3. ✅ Manual hunt: ./scripts/manual_hunt.sh base 10")
        print("4. ✅ Monitor: Open hunt_results/dashboard.html")
        
        print("\n⚙️  CONFIGURATION:")
        print("- Edit config/automation_config.json to customize")
        print("- Logs: hunt_results/logs/")
        print("- Results: hunt_results/cycle_*/")
        
        print("\n🛡️  SAFETY FEATURES ENABLED:")
        print("- ✅ Read-only analysis")
        print("- ✅ Manual approval required")
        print("- ✅ No mainnet exploitation")
        print("- ✅ Responsible disclosure")
        
        print("\n🎯 READY FOR AUTONOMOUS IMMUNIFY HUNTING!")
        
        return True

def main():
    """Main setup execution"""
    if len(sys.argv) > 1 and sys.argv[1] == '--help':
        print("WhiteRabbit Automation Setup")
        print("Usage: python setup_automation.py")
        print("This will create a complete automated vulnerability hunting system.")
        return
    
    setup = AutomationSetup()
    setup.complete_setup()

if __name__ == '__main__':
    main()