#!/usr/bin/env python3

import json
import pandas as pd
import numpy as np
from collections import Counter, defaultdict
from datetime import datetime
import matplotlib.pyplot as plt
import seaborn as sns
from typing import Dict, List, Tuple

class CryptoHackAnalyzer:
    def __init__(self, data_file: str):
        with open(data_file, 'r') as f:
            self.hacks = json.load(f)
        
        # Convert to DataFrame for easier analysis
        self.df = pd.DataFrame(self.hacks)
        
        # Clean and prepare data
        self.df['date'] = pd.to_datetime(self.df['date'])
        self.df['year'] = self.df['date'].dt.year
        self.df['month'] = self.df['date'].dt.month
        self.df['amountLost'] = self.df['amountLost'].astype(float)
        self.df['returnedFunds'] = self.df['returnedFunds'].astype(float)
        
        # Calculate net losses
        self.df['netLoss'] = self.df['amountLost'] - self.df['returnedFunds']
        
        print(f"Loaded {len(self.hacks)} hacks representing ${self.df['amountLost'].sum()/1e9:.1f}B in total losses")
        print(f"Net losses after recoveries: ${self.df['netLoss'].sum()/1e9:.1f}B")

    def top_techniques_analysis(self):
        """Analyze the most common attack techniques"""
        print("\n" + "="*80)
        print("TOP ATTACK TECHNIQUES ANALYSIS")
        print("="*80)
        
        # Count techniques by frequency
        technique_counts = Counter(self.df['technique'].dropna())
        
        # Calculate total losses by technique
        technique_losses = self.df.groupby('technique')['amountLost'].sum().sort_values(ascending=False)
        
        print("\nTop 20 Attack Techniques by Frequency:")
        for i, (technique, count) in enumerate(technique_counts.most_common(20), 1):
            total_loss = technique_losses.get(technique, 0) / 1e6
            print(f"{i:2d}. {technique:<45} {count:3d} attacks, ${total_loss:8.1f}M total")
        
        print("\nTop 20 Attack Techniques by Total Damage:")
        for i, (technique, total_loss) in enumerate(technique_losses.head(20).items(), 1):
            count = technique_counts[technique]
            avg_loss = total_loss / count / 1e6
            print(f"{i:2d}. {technique:<45} ${total_loss/1e6:8.1f}M, {count:3d} attacks, ${avg_loss:6.1f}M avg")
        
        return technique_counts, technique_losses

    def yearly_trends_analysis(self):
        """Analyze trends by year"""
        print("\n" + "="*80)
        print("YEARLY TRENDS ANALYSIS")
        print("="*80)
        
        yearly_stats = self.df.groupby('year').agg({
            'amountLost': ['count', 'sum', 'mean', 'median'],
            'returnedFunds': 'sum',
            'netLoss': 'sum'
        }).round(2)
        
        yearly_stats.columns = ['Attacks', 'Total_Loss_M', 'Avg_Loss_M', 'Median_Loss_M', 'Returned_M', 'Net_Loss_M']
        yearly_stats[['Total_Loss_M', 'Avg_Loss_M', 'Median_Loss_M', 'Returned_M', 'Net_Loss_M']] /= 1e6
        
        print("\nYear-by-Year Statistics:")
        print(yearly_stats.to_string())
        
        # Technique evolution by year
        print("\n" + "="*60)
        print("TECHNIQUE EVOLUTION BY YEAR")
        print("="*60)
        
        for year in sorted(self.df['year'].unique()):
            year_data = self.df[self.df['year'] == year]
            top_techniques = year_data['technique'].value_counts().head(5)
            total_loss = year_data['amountLost'].sum() / 1e6
            
            print(f"\n{year}: {len(year_data)} attacks, ${total_loss:.0f}M total")
            for tech, count in top_techniques.items():
                print(f"  • {tech}: {count} attacks")
        
        return yearly_stats

    def protocol_analysis(self):
        """Analyze target types and protocols"""
        print("\n" + "="*80)
        print("PROTOCOL & TARGET TYPE ANALYSIS")
        print("="*80)
        
        # Target type analysis
        target_analysis = self.df.groupby('targetType').agg({
            'amountLost': ['count', 'sum', 'mean'],
            'returnedFunds': 'sum'
        }).round(2)
        
        target_analysis.columns = ['Attacks', 'Total_Loss_M', 'Avg_Loss_M', 'Returned_M']
        target_analysis[['Total_Loss_M', 'Avg_Loss_M', 'Returned_M']] /= 1e6
        target_analysis = target_analysis.sort_values('Total_Loss_M', ascending=False)
        
        print("\nAttacks by Target Type:")
        print(target_analysis.to_string())
        
        # Classification analysis
        print("\n" + "="*60)
        print("CLASSIFICATION ANALYSIS")
        print("="*60)
        
        classification_analysis = self.df.groupby('classification').agg({
            'amountLost': ['count', 'sum', 'mean'],
            'returnedFunds': 'sum'
        }).round(2)
        
        classification_analysis.columns = ['Attacks', 'Total_Loss_M', 'Avg_Loss_M', 'Returned_M']
        classification_analysis[['Total_Loss_M', 'Avg_Loss_M', 'Returned_M']] /= 1e6
        classification_analysis = classification_analysis.sort_values('Total_Loss_M', ascending=False)
        
        print(classification_analysis.to_string())
        
        # Programming language analysis
        print("\n" + "="*60)
        print("PROGRAMMING LANGUAGE VULNERABILITIES")
        print("="*60)
        
        lang_analysis = self.df[self.df['language'] != ''].groupby('language').agg({
            'amountLost': ['count', 'sum', 'mean']
        }).round(2)
        
        lang_analysis.columns = ['Attacks', 'Total_Loss_M', 'Avg_Loss_M']
        lang_analysis[['Total_Loss_M', 'Avg_Loss_M']] /= 1e6
        lang_analysis = lang_analysis.sort_values('Total_Loss_M', ascending=False)
        
        print(lang_analysis.to_string())
        
        return target_analysis, classification_analysis, lang_analysis

    def chain_analysis(self):
        """Analyze blockchain networks affected"""
        print("\n" + "="*80)
        print("BLOCKCHAIN NETWORK ANALYSIS")
        print("="*80)
        
        # Flatten chains data
        all_chains = []
        for hack in self.hacks:
            if hack['chains']:
                for chain in hack['chains']:
                    all_chains.append({
                        'chain': chain,
                        'amountLost': hack['amountLost'],
                        'date': hack['date'],
                        'technique': hack['technique'],
                        'bridgeHack': hack['bridgeHack']
                    })
        
        chains_df = pd.DataFrame(all_chains)
        
        # Chain statistics
        chain_stats = chains_df.groupby('chain').agg({
            'amountLost': ['count', 'sum', 'mean']
        }).round(2)
        
        chain_stats.columns = ['Attacks', 'Total_Loss_M', 'Avg_Loss_M']
        chain_stats[['Total_Loss_M', 'Avg_Loss_M']] /= 1e6
        chain_stats = chain_stats.sort_values('Total_Loss_M', ascending=False)
        
        print("\nTop 20 Blockchains by Total Losses:")
        print(chain_stats.head(20).to_string())
        
        # Bridge hack analysis
        print("\n" + "="*60)
        print("BRIDGE HACK ANALYSIS")
        print("="*60)
        
        bridge_hacks = self.df[self.df['bridgeHack'] == True]
        non_bridge_hacks = self.df[self.df['bridgeHack'] == False]
        
        bridge_stats = {
            'Bridge Hacks': {
                'Count': len(bridge_hacks),
                'Total Loss (M)': bridge_hacks['amountLost'].sum() / 1e6,
                'Average Loss (M)': bridge_hacks['amountLost'].mean() / 1e6,
                'Median Loss (M)': bridge_hacks['amountLost'].median() / 1e6
            },
            'Non-Bridge Hacks': {
                'Count': len(non_bridge_hacks),
                'Total Loss (M)': non_bridge_hacks['amountLost'].sum() / 1e6,
                'Average Loss (M)': non_bridge_hacks['amountLost'].mean() / 1e6,
                'Median Loss (M)': non_bridge_hacks['amountLost'].median() / 1e6
            }
        }
        
        bridge_df = pd.DataFrame(bridge_stats).T
        print(bridge_df.to_string())
        
        print(f"\nBridge hacks represent {len(bridge_hacks)/len(self.df)*100:.1f}% of all hacks")
        print(f"But account for {bridge_hacks['amountLost'].sum()/self.df['amountLost'].sum()*100:.1f}% of total losses")
        
        return chain_stats, bridge_df

    def vulnerability_type_analysis(self):
        """Analyze vulnerability types and patterns"""
        print("\n" + "="*80)
        print("VULNERABILITY TYPE ANALYSIS")
        print("="*80)
        
        vuln_analysis = self.df.groupby('vulnType').agg({
            'amountLost': ['count', 'sum', 'mean'],
            'returnedFunds': 'sum'
        }).round(2)
        
        vuln_analysis.columns = ['Attacks', 'Total_Loss_M', 'Avg_Loss_M', 'Returned_M']
        vuln_analysis[['Total_Loss_M', 'Avg_Loss_M', 'Returned_M']] /= 1e6
        vuln_analysis = vuln_analysis.sort_values('Total_Loss_M', ascending=False)
        
        print("\nVulnerability Types by Impact:")
        print(vuln_analysis.to_string())
        
        # Recovery rate analysis
        print("\n" + "="*60)
        print("FUND RECOVERY ANALYSIS")
        print("="*60)
        
        self.df['recovery_rate'] = (self.df['returnedFunds'] / self.df['amountLost']) * 100
        self.df['recovery_rate'] = self.df['recovery_rate'].fillna(0)
        
        recovery_stats = self.df.groupby('targetType').agg({
            'recovery_rate': ['mean', 'count'],
            'returnedFunds': 'sum',
            'amountLost': 'sum'
        }).round(2)
        
        recovery_stats.columns = ['Avg_Recovery_%', 'Attacks', 'Total_Returned_M', 'Total_Lost_M']
        recovery_stats[['Total_Returned_M', 'Total_Lost_M']] /= 1e6
        recovery_stats = recovery_stats.sort_values('Avg_Recovery_%', ascending=False)
        
        print("\nRecovery Rates by Target Type:")
        print(recovery_stats.to_string())
        
        return vuln_analysis, recovery_stats

    def largest_hacks_analysis(self):
        """Analyze the largest hacks in detail"""
        print("\n" + "="*80)
        print("LARGEST HACKS ANALYSIS")
        print("="*80)
        
        # Top 50 largest hacks
        top_hacks = self.df.nlargest(50, 'amountLost')[
            ['name', 'date', 'amountLost', 'returnedFunds', 'technique', 'targetType', 'chains']
        ].copy()
        
        top_hacks['amountLost_M'] = top_hacks['amountLost'] / 1e6
        top_hacks['returnedFunds_M'] = top_hacks['returnedFunds'] / 1e6
        top_hacks['netLoss_M'] = top_hacks['amountLost_M'] - top_hacks['returnedFunds_M']
        
        print("\nTop 50 Largest Hacks:")
        for i, row in top_hacks.iterrows():
            chains_str = ', '.join(row['chains']) if row['chains'] else 'N/A'
            print(f"{len(top_hacks) - list(top_hacks.index).index(i):2d}. {row['name']:<25} "
                  f"${row['amountLost_M']:7.1f}M "
                  f"({row['date'].strftime('%Y-%m-%d')}) "
                  f"{row['technique']:<30} "
                  f"[{chains_str}]")
        
        # Billion dollar hacks
        billion_hacks = self.df[self.df['amountLost'] >= 1e9]
        print(f"\n{len(billion_hacks)} hacks exceeded $1B:")
        for _, hack in billion_hacks.iterrows():
            print(f"• {hack['name']}: ${hack['amountLost']/1e6:.0f}M ({hack['date'].strftime('%Y-%m-%d')})")
        
        return top_hacks

    def temporal_analysis(self):
        """Analyze temporal patterns and trends"""
        print("\n" + "="*80)
        print("TEMPORAL PATTERN ANALYSIS")
        print("="*80)
        
        # Monthly patterns
        monthly_stats = self.df.groupby('month').agg({
            'amountLost': ['count', 'sum', 'mean']
        }).round(2)
        monthly_stats.columns = ['Attacks', 'Total_Loss_M', 'Avg_Loss_M']
        monthly_stats[['Total_Loss_M', 'Avg_Loss_M']] /= 1e6
        
        months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
        monthly_stats.index = months
        
        print("\nAttacks by Month:")
        print(monthly_stats.to_string())
        
        # Growth over time
        print("\n" + "="*60)
        print("ECOSYSTEM GROWTH AND EVOLUTION")
        print("="*60)
        
        for year in sorted(self.df['year'].unique()):
            year_data = self.df[self.df['year'] == year]
            unique_techniques = year_data['technique'].nunique()
            unique_targets = year_data['targetType'].nunique()
            unique_chains = len(set([chain for chains in year_data['chains'] for chain in chains]))
            
            print(f"{year}: {len(year_data):3d} attacks, {unique_techniques:2d} techniques, "
                  f"{unique_targets:2d} target types, {unique_chains:2d} chains")
        
        return monthly_stats

    def advanced_pattern_analysis(self):
        """Advanced pattern recognition and correlations"""
        print("\n" + "="*80)
        print("ADVANCED PATTERN ANALYSIS")
        print("="*80)
        
        # Technique-Target correlations
        technique_target = pd.crosstab(self.df['technique'], self.df['targetType'])
        
        print("\nMost Common Technique-Target Combinations:")
        technique_target_flat = []
        for tech in technique_target.index:
            for target in technique_target.columns:
                if technique_target.loc[tech, target] > 0:
                    technique_target_flat.append({
                        'technique': tech,
                        'target': target,
                        'count': technique_target.loc[tech, target]
                    })
        
        technique_target_df = pd.DataFrame(technique_target_flat).sort_values('count', ascending=False)
        
        for _, row in technique_target_df.head(15).iterrows():
            print(f"• {row['technique']} → {row['target']}: {row['count']} attacks")
        
        # Severity analysis
        print("\n" + "="*60)
        print("HACK SEVERITY ANALYSIS")
        print("="*60)
        
        # Define severity categories
        self.df['severity'] = pd.cut(self.df['amountLost'], 
                                   bins=[0, 1e6, 10e6, 50e6, 100e6, float('inf')],
                                   labels=['<$1M', '$1-10M', '$10-50M', '$50-100M', '>$100M'])
        
        severity_stats = self.df.groupby('severity').agg({
            'amountLost': ['count', 'sum'],
            'technique': lambda x: x.value_counts().index[0] if len(x) > 0 else 'Unknown'
        }).round(2)
        
        severity_stats.columns = ['Count', 'Total_Loss_M', 'Most_Common_Technique']
        severity_stats['Total_Loss_M'] /= 1e6
        
        print(severity_stats.to_string())
        
        return technique_target_df, severity_stats

    def generate_summary_report(self):
        """Generate comprehensive summary"""
        print("\n" + "="*80)
        print("COMPREHENSIVE SUMMARY REPORT")
        print("="*80)
        
        total_hacks = len(self.df)
        total_losses = self.df['amountLost'].sum()
        total_returned = self.df['returnedFunds'].sum()
        net_losses = total_losses - total_returned
        
        avg_hack_size = total_losses / total_hacks
        median_hack_size = self.df['amountLost'].median()
        
        recovery_rate = (total_returned / total_losses) * 100
        
        print(f"\nDATASET OVERVIEW:")
        print(f"• Total hacks analyzed: {total_hacks:,}")
        print(f"• Total losses: ${total_losses/1e9:.1f}B")
        print(f"• Total recovered: ${total_returned/1e9:.1f}B")
        print(f"• Net losses: ${net_losses/1e9:.1f}B")
        print(f"• Overall recovery rate: {recovery_rate:.1f}%")
        print(f"• Average hack size: ${avg_hack_size/1e6:.1f}M")
        print(f"• Median hack size: ${median_hack_size/1e6:.1f}M")
        
        # Time range
        earliest_hack = self.df['date'].min()
        latest_hack = self.df['date'].max()
        print(f"• Time range: {earliest_hack.strftime('%Y-%m-%d')} to {latest_hack.strftime('%Y-%m-%d')}")
        
        # Key statistics
        unique_techniques = self.df['technique'].nunique()
        unique_targets = self.df['targetType'].nunique()
        unique_chains = len(set([chain for chains in self.df['chains'] for chain in chains if chains]))
        bridge_hack_pct = (self.df['bridgeHack'].sum() / total_hacks) * 100
        
        print(f"• Unique attack techniques: {unique_techniques}")
        print(f"• Target types: {unique_targets}")
        print(f"• Blockchain networks affected: {unique_chains}")
        print(f"• Bridge hacks: {bridge_hack_pct:.1f}%")
        
        # Top categories
        top_technique = self.df['technique'].value_counts().index[0]
        top_target = self.df['targetType'].value_counts().index[0]
        most_affected_year = self.df['year'].value_counts().index[0]
        
        print(f"\nKEY FINDINGS:")
        print(f"• Most common attack: {top_technique}")
        print(f"• Most targeted protocol type: {top_target}")
        print(f"• Worst year for hacks: {most_affected_year}")
        
        # Trend analysis
        recent_years = self.df[self.df['year'] >= 2022]
        growth_rate = (len(recent_years[recent_years['year'] == 2024]) / 
                      len(recent_years[recent_years['year'] == 2022]) - 1) * 100
        
        print(f"• Attack frequency change (2022-2024): {growth_rate:+.1f}%")
        
        return {
            'total_hacks': total_hacks,
            'total_losses': total_losses,
            'net_losses': net_losses,
            'recovery_rate': recovery_rate,
            'avg_hack_size': avg_hack_size,
            'unique_techniques': unique_techniques,
            'unique_chains': unique_chains
        }

def main():
    """Main analysis function"""
    print("COMPREHENSIVE CRYPTOCURRENCY HACK DATABASE ANALYSIS")
    print("Analyzing $38B+ in documented cryptocurrency exploits")
    print("="*80)
    
    # Initialize analyzer
    analyzer = CryptoHackAnalyzer('/home/ubuntu/clawd/White-Rabbit/src/data/raw-hacks.json')
    
    # Run all analyses
    try:
        # Core analyses
        analyzer.top_techniques_analysis()
        analyzer.yearly_trends_analysis()
        analyzer.protocol_analysis()
        analyzer.chain_analysis()
        analyzer.vulnerability_type_analysis()
        
        # Advanced analyses
        analyzer.largest_hacks_analysis()
        analyzer.temporal_analysis()
        analyzer.advanced_pattern_analysis()
        
        # Final summary
        summary = analyzer.generate_summary_report()
        
        print("\n" + "="*80)
        print("ANALYSIS COMPLETE")
        print("="*80)
        print(f"Successfully analyzed {summary['total_hacks']} hacks")
        print(f"Total documented losses: ${summary['total_losses']/1e9:.1f}B")
        print("Report generated with comprehensive statistics and patterns")
        
    except Exception as e:
        print(f"Error during analysis: {e}")
        return 1
    
    return 0

if __name__ == "__main__":
    exit(main())