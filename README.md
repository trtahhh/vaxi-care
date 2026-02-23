# VaxiCare - Vaccination Management System

VaxiCare is a comprehensive system to manage vaccination schedules, history, and resources for parents and administrators.

## Project Structure
- **backend/**: Node.js (Express) + TypeORM API.
- **frontend/**: React + Vite + TailwindCSS (Planned).
- **database/**: Contains initial SQL scripts (if any), but schema is managed by TypeORM.

## Components

### Backend
- **Framework**: Express.js
- **Database**: MySQL (via Laragon)
- **ORM**: TypeORM (Code-First)
- **Authentication**: JWT (Planned)

### Frontend
- **Framework**: React (Vite)

## Setup & Run

### Prerequisites
- Node.js installed.
- **Laragon** (or MySQL) running.
- Database `vaxi_care` created in MySQL.

### Backend
1. `cd backend`
2. `npm install`
3. Copy `.env.example` to `.env` (if exists) or ensure `.env` has DB config.
4. `npm start` (Runs on Port 3000)

### Frontend
1. `cd frontend`
2. `npm install`
3. `npm run dev`

## Features (Planned)
- **Parents**: View schedule, track history, receive notifications.
- **Admin**: Manage vaccines, users, and schedules.
