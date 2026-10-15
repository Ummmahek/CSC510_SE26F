---
name: M0 Hypothesis Decision (Persevere / Re-plan / Descope)
about: Record a milestone decision when the M0 repeat-order-rate evaluation runs or falls short of the >= 20% target.
title: "[M0 Decision] Repeat-order rate eval: <PERSEVERE / RE-PLAN / DESCOPE>"
labels: ["milestone-0", "evaluation", "metrics"]
assignees: []
---

## 1. Hypothesis Statement
> **Hypothesis**: Weekly repeat-order rate rises at least 20% (+20.0% relative lift) with the social leaderboard compared to the no-leaderboard baseline.
> *(Reference: Project 1b Proposal Report, Section 2.1 & 3.1)*

## 2. Evaluation Results Summary
- **Evaluation Date**: YYYY-MM-DD
- **Data Source**: `[Seeded Synthetic Simulation (Mulberry32, seed 42) | Real Pilot Dataset (pilot-orders-sample.json)]`
- **Baseline (No-Leaderboard) Weekly Repeat Rate**: `XX.XX%` (active customer-weeks: `N`, repeat: `M`)
- **Leaderboard Group Weekly Repeat Rate**: `YY.YY%` (active customer-weeks: `N`, repeat: `M`)
- **Measured Relative Lift**: `+ZZ.ZZ%` (Target: `>= +20.0%`)
- **Statistical Significance**: `z = X.XX, p = 0.XXXX`
- **Result**: `[PASS | FAIL]`

## 3. Decision
Select one:
- [ ] **PERSEVERE**: Lift is $\ge 20\%$. Gamification mechanics demonstrate behavioral lift. Proceed to Milestone 2 (Trust layer) and Milestone 3 (Social leaderboard UI).
- [ ] **RE-PLAN**: Lift is $< 20\%$. Gamification mechanics need adjustment before UI completion.
- [ ] **DESCOPE**: Lift is $< 0\%$ or flat despite adjustments. Scale down multi-tier social leaderboard to personal streak rewards.

## 4. Root-Cause Analysis (Required if FAIL / RE-PLAN / DESCOPE)
*Explain why the repeat-order rate did not meet the 20% lift threshold:*
- [ ] Low social network density (too few mutual friends to trigger competition)
- [ ] Insufficient reward salience (points/discounts not perceived as valuable enough)
- [ ] Notification fatigue or lack of mid-week engagement nudges
- [ ] Pilot cohort sample size or observation window too short

## 5. Triage Action Plan
If **RE-PLAN**:
1. **Option A (Incentive Multipliers)**: Increase points earn rate from 10% to 15% on repeat orders within the same calendar week.
2. **Option B (Accelerate Team Challenges)**: Bring forward Milestone 3's cooperative team challenges (where groups of friends collaborate on weekly order goals) to add social accountability.

If **DESCOPE**:
1. **Option C (Simplify Gamification)**: Remove multi-tier public rankings; retain personal streaks and direct meal donation milestones to minimize operational complexity.

## 6. Sign-off & Milestone Owners
- Lead Evaluator:
- Reviewed by:
- Sprint / Milestone Target:
