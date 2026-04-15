# AIM-RCA: Adaptive Incident Management & Root Cause Analysis System

AIM-RCA is a web-based system designed to manage software incidents in a structured and efficient manner.  
It provides a centralized platform to report, track, and analyze incidents, helping teams respond faster and reduce downtime.

---

## Features

- **Incident Reporting:** Submit incidents with category, severity, team, and description.
- **Severity-Based Alerts:** High and critical incidents are clearly highlighted for quick attention.
- **Dashboard View:** Displays all incidents in a structured format for easy monitoring.
- **Database Integration:** Uses Supabase for storing and retrieving incident data in real time.
- **Basic Root Cause Analysis:** Helps in identifying possible causes based on incident patterns.
- **User Interaction:** Simple login system with role-based selection.

---

## Tech Stack

- **Frontend:** HTML, CSS, JavaScript  
- **Backend:** Supabase (Database and API)

---

## Project Structure
aim-rca-system/
│
├── index.html
├── app.js

---

## How to Run

1. Clone the repository: git clone https://github.com/ananya052004-maker/aim-rca-system.git

2. Navigate to the project directory:

cd aim-rca-system


3. Start a local server:

python3 -m http.server 5500


4. Open in browser:

http://localhost:5500


---

## Configuration

Before running the project, update the following in `app.js`:


SUPABASE_URL
SUPABASE_ANON_KEY


Use your own Supabase project credentials.

---

## Use Case

This system can be used by development or operations teams to:

- Track incidents in a structured way  
- Assign responsibility to teams  
- Monitor severity and priority  
- Improve resolution time  

---

## Limitations

- Basic authentication (not production-level security)  
- Limited automation in root cause analysis  
- No advanced reporting or analytics  

---

## Future Improvements

- Role-based authentication with proper security  
- Real-time notifications and alerts  
- Advanced analytics and visualization  
- Integration with monitoring tools  

---
