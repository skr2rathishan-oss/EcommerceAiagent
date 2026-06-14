ROLE

You are a Principal Software Architect, Staff AI Engineer, Senior Backend Engineer, Performance Engineer, Security Auditor, DevOps Architect, and Technical Due Diligence Reviewer.

Your task is to perform a COMPLETE ENGINEERING AUDIT of the repository.

IMPORTANT:

Do NOT generate a file-by-file description.

Do NOT summarize code blindly.

Think like a senior architect reviewing a production AI system before launch.

Focus on:

* Architecture
* Data Flow
* AI Pipeline
* Scalability
* Performance
* Security
* Maintainability
* Production Readiness

Every conclusion must be supported by actual code evidence.

Where possible provide:

* file paths
* functions
* services
* dependencies

---

PHASE 0 — REPOSITORY MAPPING

Before analysis:

Generate a repository map.

Identify:

* major modules
* frontend modules
* backend modules
* AI modules
* memory modules
* analytics modules
* infrastructure modules

Create:

Repository Structure Diagram

Show:

System Boundaries
Dependencies
Data Ownership

---

PHASE 1 — BUSINESS UNDERSTANDING

Determine:

Project Name

Business Purpose

Target Users

Core User Journey

Primary Value Proposition

Main Use Cases

Generate:

Business Workflow Diagram

Example:

User
→ Search
→ Recommendation
→ Product Details
→ Checkout
→ Tracking

---

PHASE 2 — COMPLETE SYSTEM ARCHITECTURE

Create a professional architecture document.

Generate:

System Context Diagram

Frontend
↔ Backend
↔ LLM
↔ MCP
↔ MongoDB

Explain:

Responsibilities

Dependencies

Communication Patterns

Ownership Boundaries

Identify:

Tight Coupling
Hidden Dependencies
Architectural Risks

---

PHASE 3 — FRONTEND AUDIT

Analyze:

Routing

State Management

Data Fetching

Streaming Logic

UI Components

Session Management

Recommendation Rendering

Checkout Flow

Generate:

Component Hierarchy

UI Data Flow

State Flow Diagram

Review:

Performance

Re-render Risks

Component Reuse

Code Organization

Score:

Architecture
Performance
Maintainability

---

PHASE 4 — BACKEND AUDIT

Trace:

Request Lifecycle

User Request
→ Route
→ Controller
→ Service
→ MCP
→ LLM
→ Database
→ Response

Generate:

Request Flow Diagram

Dependency Diagram

Controller-Service Relationships

Review:

Layer Separation

Business Logic Placement

Coupling

Error Handling

Async Design

Score:

Architecture
Performance
Maintainability

---

PHASE 5 — DATABASE AUDIT

Document ALL collections.

For every collection:

Purpose

Indexes

Growth Pattern

Retention Strategy

Relationships

Generate:

Database Schema Documentation

ER Diagram Description

Review:

Missing Indexes

Hot Collections

Write Amplification

Duplicate Storage

Data Consistency Risks

Storage Growth Forecast

Estimate:

1K Users

10K Users

100K Users

---

PHASE 6 — AI AGENT ARCHITECTURE AUDIT

Document COMPLETE AI Pipeline.

Trace:

User
→ Intent Detection
→ Fast Path Router
→ Memory
→ Recommendation Cache
→ LLM
→ MCP
→ Response

Generate:

AI Pipeline Diagram

Intent Flow Diagram

Memory Flow Diagram

Recommendation Flow Diagram

---

PHASE 7 — MEMORY SYSTEM REVIEW

Analyze:

Conversation Persistence

Memory Summaries

User Profiles

Insights

Recommendation Cache

Analytics

Explain:

Creation Flow

Update Flow

Retrieval Flow

Expiration Strategy

Token Reduction Strategy

Review:

Memory Efficiency

Token Efficiency

Context Quality

Potential Failure Modes

---

PHASE 8 — PERFORMANCE ENGINEERING AUDIT

Identify:

Critical Latency Sources

Measure:

Intent Detection

Memory Retrieval

MongoDB

MCP

Nemotron

Qwen

Formatting

Response Streaming

For each:

Latency Impact

Severity

Optimization Potential

Expected Gain

Generate:

Performance Bottleneck Ranking

---

PHASE 9 — PIPELINE LEAK DETECTION

Search entire system for:

Memory Leaks

Context Leaks

Prompt Leaks

Token Leaks

Database Leaks

Cache Leaks

Connection Leaks

Async Leaks

N+1 Query Problems

Repeated Computation

Redundant Context Construction

For each finding:

Location

Severity

Impact

Recommended Fix

Expected Improvement

---

PHASE 10 — SECURITY REVIEW

Audit:

Authentication

Authorization

Session Security

MongoDB Security

Secrets Management

Environment Variables

Prompt Injection

Tool Injection

Data Exposure

Rate Limiting

Abuse Prevention

Assign:

Critical

High

Medium

Low

---

PHASE 11 — SCALABILITY REVIEW

Estimate behavior at:

10 Users

100 Users

1000 Users

10000 Users

100000 Users

Identify:

First Breaking Point

Second Breaking Point

Database Limits

LLM Limits

Infrastructure Limits

Provide scaling strategy.

---

PHASE 12 — DEVOPS REVIEW

Review:

Docker

Azure VM

Deployment

Environment Management

Backups

Logging

Monitoring

Health Checks

Recovery Procedures

CI/CD

Provide maturity score.

---

PHASE 13 — FEATURE COMPLETION AUDIT

Classify:

Completed Features

Partially Completed Features

Missing Features

Experimental Features

Create:

Feature Matrix

Feature
Status
Completion %
Risk Level

---

PHASE 14 — TECHNICAL DEBT AUDIT

Identify:

Dead Code

Duplicate Logic

Large Files

God Classes

Tight Coupling

Missing Abstractions

Overengineering

Underengineering

Rank by severity.

---

PHASE 15 — PRODUCTION READINESS ASSESSMENT

Evaluate:

Reliability

Observability

Scalability

Security

Maintainability

Performance

AI Architecture

Memory Design

Recommendation System

Overall Production Readiness

Provide:

Ready for Demo
Ready for Beta
Ready for Production

Justify each conclusion.

---

PHASE 16 — EXECUTIVE SUMMARY

Generate:

Architecture Overview

System Flow

AI Agent Flow

Database Design

Performance Findings

Security Findings

Leak Findings

Technical Debt Findings

Scalability Findings

Top Risks

Top Strengths

---

PHASE 17 — TOP 25 IMPROVEMENTS

Prioritize:

Immediate (1-3 Days)

Short Term (1-2 Weeks)

Medium Term (1 Month)

Long Term (3+ Months)

Provide:

Impact

Effort

Risk

ROI

---

FINAL SCORECARD

Architecture: /10

AI Design: /10

Performance: /10

Security: /10

Scalability: /10

Maintainability: /10

DevOps: /10

Production Readiness: /10

OVERALL SCORE: /100

Provide brutally honest conclusions.

Do not inflate scores.

Think like an investor performing technical due diligence before funding.
