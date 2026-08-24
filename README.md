# 🏆 Hackathon Management System — Smart India Hackathon (SIH 2026) Coordination Portal

> **Official Coordination Portal for Chaitanya (Deemed to be University), Hyderabad**  
> *Internal Hackathon Coordination for Smart India Hackathon (SIH 2026) • Organised by Department of Computer Science & Engineering (CSE)*

---

![Portal Banner](/public/gallery/event_poster.jpg)

## 🌟 Overview

The **Hackathon Management System** is a state-of-the-art, production-ready web application built for managing student team registrations, problem statement submissions, presentation (PPT/PDF) validation, and SPOC review workflows for **Smart India Hackathon 2026**.

Built specifically for **Chaitanya (Deemed to be University), Hyderabad**, the portal provides atomic validation rules, direct file downloads, printable team PDF reports, and master Excel (.xlsx) data export for administrative efficiency.

---

## ✨ Key Features

### 🎓 Student Team Portal
- **Atomic 6-Member Validation**: Every team must register exactly 6 team members (Member 1 initialized as Team Lead).
- **Mandatory Female Team Member Rule**: Enforces SIH compliance requiring at least 1 female team member per team.
- **Faculty / Stream Selection**: Dedicated dropdown selection for each team member:
  - *Faculty of Engineering*
  - *Faculty of Science*
  - *Faculty of Forensic Science*
  - *Faculty of Radiology*
  - *Faculty of Physiotherapy*
  - *Others*
- **Presentation Upload Inspector**: Supports `.pptx` and `.pdf` presentation uploads with automated slide count validation (maximum 6 slides allowed per SIH guidelines).

### 🛡️ College SPOC Admin Portal
- **Authorized Access Control**: Secure login restricted to designated SPOC Admin (`rpkumar2024@chaitanya.edu.in` / `SIH@2026`).
- **Real-Time Submissions Table**: Filter teams by status (*Valid, Under Review, Needs Correction, Invalid*) and female compliance.
- **Direct File Downloads**: Single-click direct raw download for `.pptx` and `.pdf` solution files.
- **Printable Team PDF Reports**: Generates formal single-page PDF reports containing full team member rosters, problem statement info, solution summary, and SPOC remarks.
- **Delete & Reset Submission**: Allows SPOC Admin to clear/reset a team submission so students can resubmit updated presentations.
- **Master Excel (.xlsx) Data Export**: One-click native Excel export generating a complete master report with:
  - Team Name & Problem Statement ID
  - Total Members, Total Males Count, Total Females Count
  - All 6 Team Members' Names, Roll Numbers, Emails, Mobiles, Genders, Branches, Academic Years, and Faculty Streams in a single organized row per team.

### 📸 Live Event Photo Gallery
- **2-Second Automatic Carousel**: High-resolution 10-slide non-stop automated slideshow showcasing Chaitanya University hackathon orientation sessions, mentorship labs, student team presentations, and judging rounds.
- **Uncropped Full-Fit Display**: `object-contain` 720px expanded layout ensuring 100% full top-to-bottom visibility.

---

## 🛠️ Technology Stack

- **Frontend**: React 18, TypeScript, Vite, TailwindCSS, Lucide Icons
- **Backend / DB**: Supabase PostgreSQL, Supabase Auth, Row Level Security (RLS)
- **Export Libraries**: SheetJS (`xlsx`) for native Excel reports, HTML5 Canvas PDF Printing
- **Deployment**: Netlify (Single Page App with `_redirects` configuration)

---

## 🔐 Credentials & Access

| Portal | Login Email | Password | Access Level |
| :--- | :--- | :--- | :--- |
| **SPOC Admin Portal** | `rpkumar2024@chaitanya.edu.in` | `SIH@2026` | Full Admin Privileges (Review, Download, Export, Delete) |
| **Student Portal** | Any registered student email | Password set on signup | Student Team Registration & Submission |

---

## 🚀 Local Development Setup

1. **Clone the Repository**:
   ```bash
   git clone https://github.com/AbdulRazak5764/Hackathon-Management-System.git
   cd Hackathon-Management-System
   ```

2. **Install Dependencies**:
   ```bash
   npm install
   ```

3. **Configure Environment Variables**:
   Create a `.env` file in the root directory:
   ```env
   VITE_SUPABASE_URL=https://gcutaskxofmwgahnogmo.supabase.co
   VITE_SUPABASE_ANON_KEY=sb_publishable_XdHdRmHuF2DlX5mGyH5TyA_9JzFQGK6
   ```

4. **Run Dev Server**:
   ```bash
   npm run dev
   ```

5. **Build for Production**:
   ```bash
   npm run build
   ```

---

## 🗄️ Database Setup (Supabase SQL)

Run the provided `supabase_schema.sql` script in your [Supabase SQL Editor](https://supabase.com/dashboard):
- Creates `user_profiles`, `teams`, `team_members`, `submissions`, `submission_history`, and `audit_logs` tables.
- Applies Row Level Security (RLS) policies and atomic PostgreSQL RPC functions (`save_team_with_members`, `review_submission`).

---

## 📄 License & Ownership

**Organized By**: Department of Computer Science & Engineering (CSE)  
**Institution**: Chaitanya (Deemed to be University), Himayathnagar Village, Moinabad Mandal, Ranga Reddy District, Hyderabad, Telangana  
**SPOC**: Dr R Praveen Kumar, Department of CSE  
