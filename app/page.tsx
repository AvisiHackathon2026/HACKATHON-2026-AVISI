"use client";

import { useState } from 'react';

export default function Home() {
    // 1. State for the user inputs (defaulted to your example numbers)
    const [maxClientRate, setMaxClientRate] = useState<number>(120);
    const [desiredMargin, setDesiredMargin] = useState<number>(10);
    const [costFactor, setCostFactor] = useState<number>(2.0);
    const [hoursPerWeek, setHoursPerWeek] = useState<number>(40);

    // 2. Real-time Math Logic (runs instantly when any number changes)
    const targetCostPrice = maxClientRate - desiredMargin;
    const grossHourlyWage = targetCostPrice / costFactor;
    const grossWeeklySalary = grossHourlyWage * hoursPerWeek;
    const grossMonthlySalary = (grossWeeklySalary * 13) / 3;

    // 3. The User Interface
    return (
        <main style={{ padding: '2rem', fontFamily: 'sans-serif', maxWidth: '800px' }}>
            <h1>Recruiter Calculator</h1>

            {/* Input Section */}
            <section style={{ border: '1px solid #ccc', padding: '1.5rem', marginBottom: '2rem', borderRadius: '8px' }}>
                <h3 style={{ marginTop: 0 }}>Step 1: Enter Details (Budget ➔ Salary)</h3>

                <label style={{ display: 'flex', justifyContent: 'space-between', margin: '10px 0' }}>
                    Max Client Budget/Rate (€):
                    <input type="number" value={maxClientRate} onChange={(e) => setMaxClientRate(Number(e.target.value))} />
                </label>

                <label style={{ display: 'flex', justifyContent: 'space-between', margin: '10px 0' }}>
                    Desired Margin (€):
                    <input type="number" value={desiredMargin} onChange={(e) => setDesiredMargin(Number(e.target.value))} />
                </label>

                <label style={{ display: 'flex', justifyContent: 'space-between', margin: '10px 0' }}>
                    Cost Price Factor:
                    <input type="number" step="0.1" value={costFactor} onChange={(e) => setCostFactor(Number(e.target.
                        value))} />
                </label>

                <label style={{ display: 'flex', justifyContent: 'space-between', margin: '10px 0' }}>
                    Workweek (Hours):
                    <input type="number" value={hoursPerWeek} onChange={(e) => setHoursPerWeek(Number(e.target.value))} />
                </label>
            </section>

            {/* Real-time Breakdown Section */}
            <section style={{
                background: '#f8f9fa', padding: '1.5rem', border: '1px solid #ddd', borderRadius: '8px'
            }}>
                <h3 style={{ marginTop: 0 }}>Step 2: Transparent Breakdown</h3>
                <p><strong>1. Target Cost Price:</strong> €{maxClientRate} - €{desiredMargin} margin = €{targetCostPrice.
                    toFixed(2)} / hour</p>
                <p><strong>2. Gross Hourly Wage:</strong> €{targetCostPrice.toFixed(2)} / {costFactor} factor =
                    €{grossHourlyWage.toFixed(2)}</p>
                <p><strong>3. Gross Weekly Salary:</strong> €{grossHourlyWage.toFixed(2)} × {hoursPerWeek} hours =
                    €{grossWeeklySalary.toFixed(2)}</p>
                <p><strong>4. Max Monthly Salary (13/3 Rule):</strong> (€{grossWeeklySalary.toFixed(2)} × 13) / 3 =
                    <strong>€{grossMonthlySalary.toFixed(2)}</strong></p>

                <hr style={{ margin: '1.5rem 0' }} />
                <h2 style={{ color: '#2e7d32', margin: 0 }}>Indicative Max Monthly Salary: €{grossMonthlySalary.
                    toFixed(2)}</h2>
                <p style={{ color: '#d32f2f', fontSize: '0.85rem', fontWeight: 'bold' }}>⚠️ Important: This is indicative
                    and strictly excludes travel costs until specific candidate details are known.</p>
            </section>
        </main>
    );
}