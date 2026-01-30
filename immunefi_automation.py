#!/usr/bin/env python3
"""
Immunefi Submission Automation Script
Automates SSV DoS vulnerability submission to Immunefi platform
"""

import time
import sys
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.action_chains import ActionChains

class ImmunefiAutomator:
    def __init__(self, email, password, headless=True):
        self.email = email
        self.password = password
        self.headless = headless
        self.driver = None
        
    def setup_browser(self):
        """Initialize Chrome browser with proper options"""
        chrome_options = Options()
        
        if self.headless:
            chrome_options.add_argument('--headless')
            
        chrome_options.add_argument('--no-sandbox')
        chrome_options.add_argument('--disable-dev-shm-usage')
        chrome_options.add_argument('--disable-gpu')
        chrome_options.add_argument('--window-size=1920,1080')
        chrome_options.binary_location = '/snap/bin/chromium'
        
        self.driver = webdriver.Chrome(options=chrome_options)
        self.wait = WebDriverWait(self.driver, 20)
        
    def login(self):
        """Login to Immunefi platform"""
        print("🔑 Logging into Immunefi...")
        
        self.driver.get("https://immunefi.com/login")
        
        # Wait for login form
        email_field = self.wait.until(
            EC.presence_of_element_located((By.CSS_SELECTOR, "input[type='email']"))
        )
        
        password_field = self.driver.find_element(By.CSS_SELECTOR, "input[type='password']")
        
        # Enter credentials
        email_field.clear()
        email_field.send_keys(self.email)
        
        password_field.clear()
        password_field.send_keys(self.password)
        
        # Submit login
        login_button = self.driver.find_element(By.CSS_SELECTOR, "button[type='submit']")
        login_button.click()
        
        # Wait for dashboard or redirect
        self.wait.until(lambda driver: "dashboard" in driver.current_url or "bugs" in driver.current_url)
        print("✅ Login successful")
        
    def navigate_to_ssv_bounty(self):
        """Navigate to SSV Network bug bounty page"""
        print("🎯 Navigating to SSV Network bounty...")
        
        # Search for SSV Network
        self.driver.get("https://immunefi.com/bounties")
        
        # Look for SSV Network program
        search_box = self.wait.until(
            EC.presence_of_element_located((By.CSS_SELECTOR, "input[placeholder*='Search']"))
        )
        search_box.clear()
        search_box.send_keys("SSV Network")
        search_box.submit()
        
        time.sleep(2)
        
        # Click on SSV Network bounty program
        ssv_link = self.wait.until(
            EC.element_to_be_clickable((By.PARTIAL_LINK_TEXT, "SSV"))
        )
        ssv_link.click()
        
        print("✅ Found SSV Network bounty program")
        
    def start_submission(self):
        """Start new vulnerability submission"""
        print("📝 Starting vulnerability submission...")
        
        # Look for submit bug button
        submit_button = self.wait.until(
            EC.element_to_be_clickable((By.PARTIAL_LINK_TEXT, "Submit"))
        )
        submit_button.click()
        
        print("✅ Submission form opened")
        
    def fill_vulnerability_details(self, report_content):
        """Fill vulnerability submission form"""
        print("📋 Filling vulnerability details...")
        
        # Vulnerability title
        title_field = self.wait.until(
            EC.presence_of_element_located((By.CSS_SELECTOR, "input[name*='title']"))
        )
        title_field.clear()
        title_field.send_keys("Integer Overflow DoS in OperatorLib.updateSnapshot() - Missed by Recent Audit")
        
        # Severity selection
        severity_dropdown = self.driver.find_element(By.CSS_SELECTOR, "select[name*='severity']")
        severity_dropdown.click()
        high_option = self.driver.find_element(By.CSS_SELECTOR, "option[value='high']")
        high_option.click()
        
        # Asset affected  
        asset_field = self.driver.find_element(By.CSS_SELECTOR, "input[name*='asset']")
        asset_field.clear()
        asset_field.send_keys("0xDD9BC35aE942eF0cFa76930954a156B3fF30a4E1 (SSV Network Proxy)")
        
        # Vulnerability description
        description_field = self.driver.find_element(By.CSS_SELECTOR, "textarea[name*='description']")
        description_field.clear()
        description_field.send_keys(report_content)
        
        print("✅ Vulnerability details filled")
        
    def upload_poc_files(self, file_paths):
        """Upload proof of concept files"""
        print("📎 Uploading PoC files...")
        
        file_upload = self.driver.find_element(By.CSS_SELECTOR, "input[type='file']")
        
        for file_path in file_paths:
            file_upload.send_keys(file_path)
            time.sleep(1)
            
        print(f"✅ Uploaded {len(file_paths)} files")
        
    def submit_vulnerability(self):
        """Final submission"""
        print("🚀 Submitting vulnerability...")
        
        # Final submit button
        final_submit = self.driver.find_element(By.CSS_SELECTOR, "button[type='submit']")
        final_submit.click()
        
        # Wait for confirmation
        confirmation = self.wait.until(
            EC.presence_of_element_located((By.PARTIAL_TEXT, "submitted"))
        )
        
        print("✅ Vulnerability submitted successfully!")
        
    def automate_ssv_submission(self, report_content, poc_files=None):
        """Full automation workflow"""
        try:
            self.setup_browser()
            self.login()
            self.navigate_to_ssv_bounty()
            self.start_submission()
            self.fill_vulnerability_details(report_content)
            
            if poc_files:
                self.upload_poc_files(poc_files)
                
            # Ask for confirmation before final submit
            response = input("🤔 Ready to submit? Type 'CONFIRM' to proceed: ")
            if response != 'CONFIRM':
                print("❌ Submission cancelled")
                return False
                
            self.submit_vulnerability()
            return True
            
        except Exception as e:
            print(f"❌ Automation failed: {str(e)}")
            return False
            
        finally:
            if self.driver:
                self.driver.quit()
                
def main():
    if len(sys.argv) != 3:
        print("Usage: python3 immunefi_automation.py <email> <password>")
        sys.exit(1)
        
    email = sys.argv[1]
    password = sys.argv[2]
    
    # Load SSV report content
    with open('/home/ubuntu/clawd/memory/ssv-verified/01-integer-overflow/DOS-IMMUNEFI-REPORT.md', 'r') as f:
        report_content = f.read()
        
    automator = ImmunefiAutomator(email, password, headless=False)
    success = automator.automate_ssv_submission(report_content)
    
    if success:
        print("🎉 SSV vulnerability successfully submitted to Immunefi!")
    else:
        print("💥 Submission failed")
        
if __name__ == "__main__":
    main()