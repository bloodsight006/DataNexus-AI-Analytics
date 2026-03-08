# DataNexus AI Analytics 

**Live Demo:** [https://datanexus-analytics.netlify.app/]

DataNexus is a full-stack, AI-powered analytics dashboard that allows users to upload raw datasets (CSV/XLSX) and instantly receive automated exploratory data analysis (EDA) and machine learning insights.

##  Tech Stack
* **Frontend:** React.js, Vite, Axios, Tailwind CSS (or standard CSS)
* **Backend:** Python, FastAPI, Uvicorn
* **Machine Learning:** Pandas, Scikit-Learn, NumPy, OpenPyXL
* **Deployment:** Netlify (Frontend), Render (Backend), Cron-job.org (Server Keep-Alive)

## Key Features
* **Seamless Data Ingestion:** Supports both `.csv` and `.xlsx` file uploads.
* **Stateless Processing:** Files are processed securely in-memory without being stored on a database, ensuring high performance and data privacy.
* **Automated Insights:** Instantly generates statistical summaries and data visualizations.
* **Always-On Architecture:** Engineered a zero-cost deployment pipeline capable of handling 1000+ daily users with zero cold-start latency.

## Run Locally
1. Clone the repository: `git clone https://github.com/your-username/DataNexus-AI-Analytics.git`
2. Install Backend Dependencies: `cd backend` -> `pip install -r requirements.txt` -> `uvicorn main:app --reload`
3. Install Frontend Dependencies: `cd frontend` -> `npm install` -> `npm run dev`
