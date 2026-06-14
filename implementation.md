FULL PROJECT ARCHITECTURE & CODEBASE AUDIT

You are a Senior Software Architect, Staff Backend Engineer, AI Systems Engineer, and DevOps Reviewer.

Analyze the ENTIRE project codebase.

Do NOT only explain files individually.

Perform a complete architectural review and produce a professional technical documentation report.

PHASE 1 — PROJECT DISCOVERY

First scan the entire repository and identify:

Project Overview
Project name
Purpose
Business goal
Main user workflow
Core features
Technology Stack

Identify:

Frontend framework
Backend framework
Database
Authentication
AI/LLM providers
Memory systems
Vector databases
External APIs
Cloud services
Deployment methods
Docker usage

Generate a technology inventory table.

PHASE 2 — ARCHITECTURE ANALYSIS

Create a detailed architecture document.

Explain:

Frontend Architecture

Identify:

Routing
Components
State management
UI flow
API communication

Generate:

Component hierarchy
Data flow diagram
Backend Architecture

Identify:

Entry points
Routes
Services
Controllers
Repositories
Utilities
Middleware

Generate:

Request flow diagram
Service dependency diagram
Database Architecture

Identify:

Collections
Tables
Models
Relationships

Generate:

Database schema documentation
ER diagram description
PHASE 3 — AI AGENT ANALYSIS

Identify the complete AI workflow.

Document:

Request Pipeline

Trace:

User Message
→ Frontend
→ Backend
→ Memory
→ LLM
→ Tools
→ Response

Step-by-step.

Memory System

Identify:

Conversation memory
Session memory
Summaries
Persistence
Retrieval strategy

Explain:

How memory works
When memory is updated
When memory is retrieved
Memory limitations
Prompt Engineering

Find:

System prompts
Dynamic prompts
Prompt builders

Analyze:

Token efficiency
Context structure
Risks
Tool Calling

Identify:

MCP tools
External APIs
Function calling

Document:

Tool flow
Tool execution lifecycle
Tool dependencies
PHASE 4 — PERFORMANCE AUDIT

Analyze:

Slow Response Causes

Measure possible bottlenecks:

Database queries
Memory retrieval
LLM calls
Multiple LLM calls
Tool calls
Network requests
Large payloads
Blocking operations

For every bottleneck provide:

Cause
Impact
Severity
Suggested Fix

Token Usage Audit

Identify:

Excessive history usage
Prompt bloat
Duplicate context
Repeated summarization

Estimate:

Wasted tokens
Potential savings
Scalability Review

Estimate:

10 users
100 users
1000 users
10000 users

Identify breaking points.

PHASE 5 — PIPELINE LEAK DETECTION

Search entire project for:

Memory Leaks

Examples:

Unbounded message history
Large objects retained
Missing cleanup
Token Leaks

Examples:

Sending full history repeatedly
Duplicate prompts
Redundant summaries
Database Leaks

Examples:

Unlimited growth
Missing indexes
Duplicate storage
API Leaks

Examples:

Repeated API calls
Unnecessary retries
N+1 requests
Context Leaks

Examples:

Same context reconstructed every request
Duplicate memory retrieval

For each leak provide:

Location
Problem
Impact
Recommended Solution

PHASE 6 — SECURITY AUDIT

Analyze:

Authentication
Authorization
Secrets Management
Environment Variables
Prompt Injection Risks
API Abuse Risks
Session Risks
Data Exposure Risks
Rate Limiting

Provide severity:

Critical
High
Medium
Low

PHASE 7 — CODE QUALITY REVIEW

Review:

Folder structure
Naming conventions
Reusability
Modularity
Technical debt
Dead code
Duplicate code

Score each area from 1–10.

PHASE 8 — DEVOPS REVIEW

Analyze:

Docker
Azure VM
Deployment Process
CI/CD
Monitoring
Logging
Error Tracking
Backups

Provide improvement recommendations.

PHASE 9 — FEATURE COMPLETION AUDIT

Identify:

Completed Features
Partially Completed Features
Missing Features
Planned Features

Create:

Feature	Status	Completion %
PHASE 10 — IMPROVEMENT ROADMAP

Generate:

Immediate Fixes (1–3 days)
Short-Term Improvements (1–2 weeks)
Medium-Term Improvements (1 month)
Long-Term Improvements (3+ months)

Prioritize by:

Impact
Effort
Risk

PHASE 11 — FINAL REPORT

Generate a professional report containing:

Executive Summary
Architecture Overview
System Flow
AI Agent Workflow
Memory Architecture
Database Design
Security Findings
Performance Findings
Pipeline Leak Findings
Scalability Assessment
Feature Completion Matrix
Technical Debt Analysis
Production Readiness Score
Top 20 Recommended Improvements

Also provide:

Overall Project Score

Architecture: /10
Performance: /10
Security: /10
Scalability: /10
Maintainability: /10
AI Design: /10

Final Overall Score: /100

Do not skip any files.
Analyze the entire repository before producing conclusions.
Support findings with exact file paths and code references where possible.