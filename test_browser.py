#!/usr/bin/env python3
"""Test browser automation setup"""

from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
import time

def test_browser():
    chrome_options = Options()
    chrome_options.add_argument('--headless')
    chrome_options.add_argument('--no-sandbox') 
    chrome_options.add_argument('--disable-dev-shm-usage')
    chrome_options.add_argument('--disable-gpu')
    chrome_options.binary_location = '/snap/bin/chromium'
    
    service = Service('/usr/bin/chromedriver')
    
    try:
        driver = webdriver.Chrome(service=service, options=chrome_options)
        driver.get("https://immunefi.com")
        print(f"✅ Browser test successful - Title: {driver.title}")
        time.sleep(2)
        driver.quit()
        return True
    except Exception as e:
        print(f"❌ Browser test failed: {str(e)}")
        return False

if __name__ == "__main__":
    test_browser()