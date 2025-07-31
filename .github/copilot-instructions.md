# GitHub Copilot Instructions

<!-- Use this file to provide workspace-specific custom instructions to Copilot. For more details, visit https://code.visualstudio.com/docs/copilot/copilot-customization#_use-a-githubcopilotinstructionsmd-file -->

## Project Overview
This is a stock portfolio management web application called "myAccountIsEmpty".

## Tech Stack
- **Frontend**: Next.js 15, React, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes, NextAuth.js
- **Database**: Prisma ORM with SQLite (dev), PostgreSQL (prod)
- **Visualization**: Chart.js, react-chartjs-2
- **Authentication**: NextAuth.js, JWT
- **Styling**: Tailwind CSS

## Coding Guidelines

### TypeScript
- Use explicit types for all components and functions
- Define data structures using interfaces
- Utilize generic types appropriately

### React Components
- Use functional components
- Utilize React Hooks appropriately
- Follow single responsibility principle

### Styling
- Use Tailwind CSS classes
- Consider responsive design
- Support dark/light mode

### API Design
- Follow RESTful API patterns
- Use appropriate HTTP status codes
- Include error handling

### Database
- Use Prisma ORM for type-safe queries
- Consider relational data modeling
- Use appropriate indexing

### Security
- Validate user inputs
- Prevent SQL Injection
- Handle JWT tokens securely
- Manage sensitive information with environment variables
