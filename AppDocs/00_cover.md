# NutriSense AI

## Pakistani and South Asian Food Recognition System

---

### Application Deliverable

**Final Year Project — IT Specialization**

---

| | |
|---|---|
| **Project Title** | NutriSense AI |
| **Project Type** | Final Year Project |
| **Institution** | [Your University] |
| **Team Lead / Submitter** | Zeeshan Haider |
| **Team Composition** | 4 members (2 Frontend, 2 Backend / AI) |
| **Supervisor** | _________________________ |
| **Document Type** | Application Deliverable Document |
| **Document Version** | 1.0 |
| **Submission Date** | 24 May 2026 |

---

### Live Production Endpoints (verified at submission)

| Surface | URL |
|---|---|
| Web (custom domain) | **https://nutrisenseai.tech** |
| Backend API | **https://nutrisense-msq1.onrender.com** |
| Source Code | https://github.com/zeeshandesigns/NutriSense |

---

### Table of Contents

1. **Application** ............................................................. 4
   - 1.1 Project Overview
   - 1.2 Headline Metrics
   - 1.3 System Architecture
   - 1.4 Tech Stack
   - 1.5 Feature List by Surface (Web · Mobile · Backend)
   - 1.6 Academic Contribution
   - 1.7 Screenshots

2. **Hosting** ................................................................ 11
   - 2.1 Live URLs
   - 2.2 Web Hosting — Vercel
   - 2.3 Backend Hosting — Render
   - 2.4 Database, Auth, and Storage — Supabase
   - 2.5 ML Training — Modal
   - 2.6 Mobile — EAS Build (Expo)
   - 2.7 End-to-End Deployment Summary

3. **Test Cases** ............................................................ 15
   - 47 detailed test cases across 11 modules
   - Status legend, per-module results, and live API console output

4. **System Testing** ....................................................... 28
   - 4.1 Introduction and Quality Objectives
   - 4.2 Testing Strategy
   - 4.3 Test Environment
   - 4.4 Test Execution Approach
   - 4.5 Functional Testing (FR → TC Traceability)
   - 4.6 Non-Functional Testing
   - 4.7 Acceptance Testing — Persona Walkthroughs
   - 4.8 Model Evaluation Results
   - 4.9 Test Execution Summary
   - 4.10 Bug Log
   - 4.11 Risks and Mitigations
   - 4.12 Sign-off

---

### Summary of Submission

- **Backend API automated test suite:** 6 / 6 Pass against the live Render deployment (2026-05-24)
- **Model accuracy:** Top-1 = 82.65 %, Top-3 = 93.65 % on a held-out 20 % validation split (270 classes)
- **Test pass rate on executed cases:** 100 % (14 / 14 with zero failures, zero blockers)
- **UAT remaining:** 33 of 47 test cases require on-device walkthroughs and are scheduled for the pre-viva persona session
- **Defect gate:** 0 P0, 0 P1, 2 P2, 2 P3 — well within submission gate
- **Deployment:** all four tiers (web, backend, database, mobile APK) live on free-tier infrastructure; cumulative training spend ≈ $7 USD

---

*This document collates the Application, Hosting, Test Cases, and System Testing sections required for the FYP Application deliverable. Each section was authored to be self-contained but is bound here into a single submission PDF.*

\pagebreak
